-- BazarHQ — canonical merchant notifications, delivery queues, analytics,
-- and order/product notification triggers.
-- Replaces the repeated notification compatibility and Scenario 1–6 scripts.

begin;
create extension if not exists pgcrypto;

-- Minimal columns used immediately by trigger functions in this migration.
alter table public.profiles
  add column if not exists email text;

alter table public.stores
  add column if not exists account_status text default 'active';

alter table public.products
  add column if not exists low_stock_threshold integer default 5;

alter table public.orders
  add column if not exists customer_email text;

create table if not exists public.merchant_notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  merchant_id uuid,
  order_id uuid,
  type text not null default 'info',
  title text not null default 'Notification',
  message text not null default 'New notification',
  body text not null default 'New notification',
  action_url text,
  link_url text,
  metadata jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.merchant_notifications
  add column if not exists store_id uuid,
  add column if not exists merchant_id uuid,
  add column if not exists order_id uuid,
  add column if not exists type text default 'info',
  add column if not exists title text default 'Notification',
  add column if not exists message text default 'New notification',
  add column if not exists body text default 'New notification',
  add column if not exists action_url text,
  add column if not exists link_url text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists data jsonb default '{}'::jsonb,
  add column if not exists is_read boolean default false,
  add column if not exists read_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.merchant_notifications
set title=coalesce(nullif(title,''),'Notification'),
    message=coalesce(nullif(message,''),nullif(body,''),'New notification'),
    body=coalesce(nullif(body,''),nullif(message,''),'New notification'),
    action_url=coalesce(action_url,link_url),
    link_url=coalesce(link_url,action_url),
    metadata=coalesce(metadata,data,'{}'::jsonb),
    data=coalesce(data,metadata,'{}'::jsonb),
    type=coalesce(nullif(type,''),'info'),
    is_read=coalesce(is_read,read_at is not null),
    created_at=coalesce(created_at,now()),
    updated_at=coalesce(updated_at,now());

alter table public.merchant_notifications alter column message drop not null;
alter table public.merchant_notifications alter column body drop not null;
alter table public.merchant_notifications alter column title set default 'Notification';
alter table public.merchant_notifications alter column message set default 'New notification';
alter table public.merchant_notifications alter column body set default 'New notification';

create or replace function public.sync_merchant_notification_columns()
returns trigger language plpgsql set search_path=public as $$
begin
  new.title:=coalesce(nullif(new.title,''),'Notification');
  new.message:=coalesce(nullif(new.message,''),nullif(new.body,''),'New notification');
  new.body:=coalesce(nullif(new.body,''),nullif(new.message,''),'New notification');
  new.action_url:=coalesce(new.action_url,new.link_url);
  new.link_url:=coalesce(new.link_url,new.action_url);
  new.metadata:=coalesce(new.metadata,new.data,'{}'::jsonb);
  new.data:=coalesce(new.data,new.metadata,'{}'::jsonb);
  if new.read_at is not null then new.is_read:=true; end if;
  if coalesce(new.is_read,false) and new.read_at is null then new.read_at:=now(); end if;
  new.updated_at:=now();
  return new;
end $$;

drop trigger if exists merchant_notifications_sync_tg on public.merchant_notifications;
create trigger merchant_notifications_sync_tg
before insert or update on public.merchant_notifications
for each row execute function public.sync_merchant_notification_columns();

create index if not exists merchant_notifications_store_created_idx
  on public.merchant_notifications(store_id,created_at desc);
create index if not exists merchant_notifications_store_unread_idx
  on public.merchant_notifications(store_id,created_at desc)
  where read_at is null and is_read=false;

-- Canonical queue columns are recipient_email / recipient_phone.
-- to_email / to_phone remain only for old-code compatibility.
create table if not exists public.email_notification_queue (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  recipient_email text,
  to_email text,
  subject text not null default 'BazarHQ notification',
  body text not null default '',
  html text,
  status text not null default 'pending',
  attempts integer not null default 0,
  error_message text,
  provider_response jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.email_notification_queue
  add column if not exists store_id uuid,
  add column if not exists recipient_email text,
  add column if not exists to_email text,
  add column if not exists subject text default 'BazarHQ notification',
  add column if not exists body text default '',
  add column if not exists html text,
  add column if not exists status text default 'pending',
  add column if not exists attempts integer default 0,
  add column if not exists error_message text,
  add column if not exists provider_response jsonb,
  add column if not exists sent_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.sms_notification_queue (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  recipient_phone text,
  to_phone text,
  message text not null default '',
  status text not null default 'pending',
  attempts integer not null default 0,
  error_message text,
  provider_response jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sms_notification_queue
  add column if not exists store_id uuid,
  add column if not exists recipient_phone text,
  add column if not exists to_phone text,
  add column if not exists message text default '',
  add column if not exists status text default 'pending',
  add column if not exists attempts integer default 0,
  add column if not exists error_message text,
  add column if not exists provider_response jsonb,
  add column if not exists sent_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='email_notification_queue' and column_name='text_body'
  ) then
    execute $sql$
      update public.email_notification_queue
      set body = coalesce(nullif(body, ''), text_body, '')
    $sql$;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='email_notification_queue' and column_name='last_error'
  ) then
    execute $sql$
      update public.email_notification_queue
      set error_message = coalesce(error_message, last_error)
    $sql$;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='sms_notification_queue' and column_name='last_error'
  ) then
    execute $sql$
      update public.sms_notification_queue
      set error_message = coalesce(error_message, last_error)
    $sql$;
  end if;
end $$;

update public.email_notification_queue
set recipient_email=coalesce(recipient_email,to_email),
    to_email=coalesce(to_email,recipient_email),
    body=coalesce(body,''), status=coalesce(status,'pending'),
    attempts=coalesce(attempts,0), updated_at=coalesce(updated_at,now());

update public.sms_notification_queue
set recipient_phone=coalesce(recipient_phone,to_phone),
    to_phone=coalesce(to_phone,recipient_phone),
    message=coalesce(message,''), status=coalesce(status,'pending'),
    attempts=coalesce(attempts,0), updated_at=coalesce(updated_at,now());

create or replace function public.sync_email_notification_queue_columns()
returns trigger language plpgsql set search_path=public as $$
begin
  new.recipient_email:=coalesce(new.recipient_email,new.to_email);
  new.to_email:=coalesce(new.to_email,new.recipient_email);
  new.updated_at:=now();
  return new;
end $$;

create or replace function public.sync_sms_notification_queue_columns()
returns trigger language plpgsql set search_path=public as $$
begin
  new.recipient_phone:=coalesce(new.recipient_phone,new.to_phone);
  new.to_phone:=coalesce(new.to_phone,new.recipient_phone);
  new.updated_at:=now();
  return new;
end $$;

drop trigger if exists email_queue_sync_tg on public.email_notification_queue;
create trigger email_queue_sync_tg before insert or update
on public.email_notification_queue for each row
execute function public.sync_email_notification_queue_columns();

drop trigger if exists sms_queue_sync_tg on public.sms_notification_queue;
create trigger sms_queue_sync_tg before insert or update
on public.sms_notification_queue for each row
execute function public.sync_sms_notification_queue_columns();

create index if not exists email_queue_pending_idx
  on public.email_notification_queue(status,created_at) where status='pending';
create index if not exists sms_queue_pending_idx
  on public.sms_notification_queue(status,created_at) where status='pending';

-- Analytics: event_type is canonical; event_name is retained for compatibility.
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  product_id uuid,
  order_id uuid,
  event_type text not null default 'page_view',
  event_name text,
  session_id text,
  visitor_id text,
  path text,
  referrer text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.analytics_events
  add column if not exists store_id uuid,
  add column if not exists product_id uuid,
  add column if not exists order_id uuid,
  add column if not exists event_type text default 'page_view',
  add column if not exists event_name text,
  add column if not exists session_id text,
  add column if not exists visitor_id text,
  add column if not exists path text,
  add column if not exists referrer text,
  add column if not exists user_agent text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

update public.analytics_events
set event_type=coalesce(nullif(event_type,''),nullif(event_name,''),'page_view'),
    event_name=coalesce(nullif(event_name,''),nullif(event_type,''),'page_view'),
    metadata=coalesce(metadata,'{}'::jsonb),created_at=coalesce(created_at,now());

create index if not exists analytics_store_event_created_idx
  on public.analytics_events(store_id,event_type,created_at desc);
create index if not exists analytics_store_session_idx
  on public.analytics_events(store_id,session_id,created_at desc);

create or replace function public.track_analytics_event(
 p_store_subdomain text default null,p_store_id uuid default null,
 p_event_type text default 'page_view',p_path text default null,
 p_session_id text default null,p_product_id uuid default null,
 p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path=public as $$
declare v_store_id uuid;
begin
 if p_store_id is not null then
   select id into v_store_id from public.stores
   where id=p_store_id and coalesce(account_status,'active')='active'
     and coalesce(storefront_published,false)=true;
 elsif p_store_subdomain is not null then
   select id into v_store_id from public.stores
   where lower(subdomain)=lower(p_store_subdomain)
     and coalesce(account_status,'active')='active'
     and coalesce(storefront_published,false)=true;
 end if;
 if v_store_id is null then return; end if;
 insert into public.analytics_events(store_id,event_type,event_name,path,session_id,product_id,metadata)
 values(v_store_id,coalesce(nullif(p_event_type,''),'page_view'),
        coalesce(nullif(p_event_type,''),'page_view'),p_path,p_session_id,p_product_id,
        coalesce(p_metadata,'{}'::jsonb));
end $$;
revoke all on function public.track_analytics_event(text,uuid,text,text,text,uuid,jsonb) from public;
grant execute on function public.track_analytics_event(text,uuid,text,text,text,uuid,jsonb) to anon,authenticated;

-- One trigger owns new-order notification creation. The checkout RPC must not
-- insert the same merchant notification again.
create or replace function public.enqueue_new_order_notifications()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_store public.stores%rowtype; v_owner_email text; v_url text; v_text text;
begin
 select * into v_store from public.stores where id=new.store_id;
 if not found then return new; end if;
 v_text:='Order #'||coalesce(new.order_id,new.id::text)||' was placed by '||
         coalesce(new.customer_name,'a customer')||'.';
 v_url:='/track?store='||coalesce(v_store.subdomain,'')||'&order='||
       coalesce(new.order_id,new.id::text)||'&phone='||coalesce(new.customer_phone,'');
 insert into public.merchant_notifications
   (store_id,merchant_id,order_id,type,title,message,body,action_url,link_url,metadata,data)
 values(new.store_id,v_store.owner_id,new.id,'new_order','New order received',v_text,v_text,
        '/merchant/orders','/merchant/orders',
        jsonb_build_object('order_id',new.id,'public_order_id',new.order_id,'total',new.total),
        jsonb_build_object('order_id',new.id,'public_order_id',new.order_id,'total',new.total));
 select coalesce(p.email,u.email,v_store.contact_email) into v_owner_email
 from auth.users u left join public.profiles p on p.id=u.id
 where u.id=v_store.owner_id limit 1;
 if v_owner_email is not null then
   insert into public.email_notification_queue(store_id,recipient_email,subject,body)
   values(new.store_id,v_owner_email,'New BazarHQ order #'||coalesce(new.order_id,new.id::text),
          'You received a new order from '||coalesce(new.customer_name,'a customer')||'.');
 end if;
 if nullif(new.customer_email,'') is not null then
   insert into public.email_notification_queue(store_id,recipient_email,subject,body)
   values(new.store_id,new.customer_email,'Your BazarHQ order #'||coalesce(new.order_id,new.id::text),
          'Your order has been received. Track it here: '||v_url);
 end if;
 if nullif(new.customer_phone,'') is not null then
   insert into public.sms_notification_queue(store_id,recipient_phone,message)
   values(new.store_id,new.customer_phone,'BazarHQ order '||
          coalesce(new.order_id,new.id::text)||' received. Track: '||v_url);
 end if;
 return new;
end $$;

drop trigger if exists trg_enqueue_new_order_notifications on public.orders;
drop trigger if exists orders_new_order_notifications_tg on public.orders;
create trigger orders_new_order_notifications_tg after insert on public.orders
for each row execute function public.enqueue_new_order_notifications();

create or replace function public.enqueue_order_status_notifications()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_store public.stores%rowtype; v_url text;
begin
 if old.status is not distinct from new.status then return new; end if;
 select * into v_store from public.stores where id=new.store_id;
 if not found then return new; end if;
 v_url:='/track?store='||coalesce(v_store.subdomain,'')||'&order='||
       coalesce(new.order_id,new.id::text)||'&phone='||coalesce(new.customer_phone,'');
 if nullif(new.customer_email,'') is not null then
   insert into public.email_notification_queue(store_id,recipient_email,subject,body)
   values(new.store_id,new.customer_email,'Order #'||coalesce(new.order_id,new.id::text)||
          ' is now '||coalesce(new.status,''),
          'Your order status changed to '||coalesce(new.status,'')||'. Track: '||v_url);
 end if;
 if nullif(new.customer_phone,'') is not null then
   insert into public.sms_notification_queue(store_id,recipient_phone,message)
   values(new.store_id,new.customer_phone,'BazarHQ order '||
          coalesce(new.order_id,new.id::text)||' status: '||coalesce(new.status,'')||
          '. Track: '||v_url);
 end if;
 return new;
end $$;

drop trigger if exists trg_enqueue_order_status_notifications on public.orders;
drop trigger if exists orders_status_notifications_tg on public.orders;
create trigger orders_status_notifications_tg after update of status on public.orders
for each row execute function public.enqueue_order_status_notifications();

create or replace function public.enqueue_low_stock_notification()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_owner uuid; v_limit integer:=coalesce(new.low_stock_threshold,5);
        v_old integer:=999999; v_text text;
begin
 if tg_op='UPDATE' then v_old:=coalesce(old.stock,999999); end if;
 select owner_id into v_owner from public.stores where id=new.store_id;
 if new.stock=0 and v_old<>0 then
   v_text:=coalesce(new.title,'A product')||' is now out of stock.';
   insert into public.merchant_notifications
    (store_id,merchant_id,type,title,message,body,action_url,link_url,metadata,data)
   values(new.store_id,v_owner,'error','Out of stock',v_text,v_text,
          '/merchant/products','/merchant/products',
          jsonb_build_object('product_id',new.id,'stock',new.stock),
          jsonb_build_object('product_id',new.id,'stock',new.stock));
 elsif new.stock>0 and new.stock<=v_limit and v_old>v_limit then
   v_text:=coalesce(new.title,'A product')||' has only '||new.stock||' unit(s) left.';
   insert into public.merchant_notifications
    (store_id,merchant_id,type,title,message,body,action_url,link_url,metadata,data)
   values(new.store_id,v_owner,'low_stock','Low stock alert',v_text,v_text,
          '/merchant/products','/merchant/products',
          jsonb_build_object('product_id',new.id,'stock',new.stock),
          jsonb_build_object('product_id',new.id,'stock',new.stock));
 end if;
 return new;
end $$;

drop trigger if exists products_low_stock_notify_tg on public.products;
drop trigger if exists trg_enqueue_low_stock_notification_insert on public.products;
drop trigger if exists trg_enqueue_low_stock_notification_update on public.products;
drop trigger if exists products_low_stock_notifications_tg on public.products;
create trigger products_low_stock_notifications_tg
after insert or update of stock on public.products
for each row execute function public.enqueue_low_stock_notification();

create or replace function public.create_pending_order_reminders()
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer:=0;
begin
 insert into public.merchant_notifications
  (store_id,merchant_id,order_id,type,title,message,body,action_url,link_url,metadata,data)
 select o.store_id,s.owner_id,o.id,'warning','Pending order needs attention',
        'Order '||coalesce(o.order_id,o.id::text)||' has been pending for more than 48 hours.',
        'Order '||coalesce(o.order_id,o.id::text)||' has been pending for more than 48 hours.',
        '/merchant/orders','/merchant/orders',
        jsonb_build_object('order_id',o.id,'reminder_key','pending-48h-'||o.id::text),
        jsonb_build_object('order_id',o.id,'reminder_key','pending-48h-'||o.id::text)
 from public.orders o join public.stores s on s.id=o.store_id
 where lower(coalesce(o.status,'pending'))='pending'
   and o.created_at<now()-interval '48 hours'
   and not exists(
     select 1
     from public.merchant_notifications n
     where n.store_id=o.store_id
       and coalesce(
         n.metadata->>'reminder_key',
         n.data->>'reminder_key'
       )='pending-48h-'||o.id::text
   );
 get diagnostics v_count=row_count;
 return v_count;
end $$;
revoke all on function public.create_pending_order_reminders() from public;
grant execute on function public.create_pending_order_reminders() to service_role;

commit;
