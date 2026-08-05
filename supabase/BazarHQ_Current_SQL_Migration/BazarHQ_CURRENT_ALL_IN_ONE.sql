-- =============================================================================
-- BazarHQ CURRENT SQL UPGRADE — ALL IN ONE
-- Generated from the ordered clean migration files.
-- Prefer running individual files on staging so failures are easier to isolate.
-- This upgrades an EXISTING BazarHQ database; it is not a fresh bootstrap.
-- =============================================================================


-- >>>>>>>>>>>>>>>>>>>>>> BEGIN 0000_preflight.sql <<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- BazarHQ CURRENT MIGRATION 0000
-- Preflight guard for the existing production database
-- =============================================================================
-- This pack upgrades an existing BazarHQ database. It is not a fresh bootstrap.
-- The block raises an error if a required core table is missing.
-- =============================================================================

do $$
declare
  v_missing text;
begin
  select string_agg(r.table_name,', ' order by r.table_name)
  into v_missing
  from (
    values
      ('profiles'),
      ('stores'),
      ('products'),
      ('orders'),
      ('order_timeline')
  ) as r(table_name)
  where to_regclass('public.'||r.table_name) is null;

  if v_missing is not null then
    raise exception
      'BazarHQ preflight failed. Missing core table(s): %. Restore the base schema before running this upgrade pack.',
      v_missing;
  end if;
end $$;

select
  'BazarHQ existing database preflight passed' as status,
  current_database() as database_name,
  now() as checked_at;

-- >>>>>>>>>>>>>>>>>>>>>>> END 0000_preflight.sql <<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>> BEGIN 0001_notifications_analytics.sql <<<<<<<<<<<<<<<<<<<<<<

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

-- >>>>>>>>>>>>>>>>>>>>>>> END 0001_notifications_analytics.sql <<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>> BEGIN 0002_customer_checkout.sql <<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- BazarHQ CURRENT MIGRATION 0002
-- Customer accounts, checkout, reviews, coupons and order tracking
-- =============================================================================
-- Canonical rules:
--   * Final order placement requires an authenticated customer.
--   * Prices, stock, variants, delivery charge and coupon discount are recalculated
--     inside place_customer_order_v2.
--   * Merchant/order notifications are created by triggers in 0001, not here.
-- =============================================================================

create extension if not exists pgcrypto;

-- Customer profiles and saved addresses.
create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  account_status text not null default 'active',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists account_status text default 'active',
  add column if not exists deleted_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  label text not null default 'Home',
  full_name text not null,
  phone text not null,
  address text not null,
  district text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_addresses
  add column if not exists label text default 'Home',
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists district text,
  add column if not exists is_default boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists customer_profiles_phone_idx
  on public.customer_profiles(phone);
create index if not exists customer_addresses_customer_idx
  on public.customer_addresses(customer_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at=now();
  return new;
end $$;

drop trigger if exists customer_profiles_updated_at_tg on public.customer_profiles;
create trigger customer_profiles_updated_at_tg
before update on public.customer_profiles
for each row execute function public.set_updated_at();

drop trigger if exists customer_addresses_updated_at_tg on public.customer_addresses;
create trigger customer_addresses_updated_at_tg
before update on public.customer_addresses
for each row execute function public.set_updated_at();

create or replace function public.limit_customer_addresses()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if (
    select count(*) from public.customer_addresses
    where customer_id=new.customer_id
  ) >= 3 then
    raise exception 'A customer can save up to 3 addresses.';
  end if;
  return new;
end $$;

drop trigger if exists limit_customer_addresses_tg on public.customer_addresses;
drop trigger if exists trg_limit_customer_addresses on public.customer_addresses;
create trigger limit_customer_addresses_tg
before insert on public.customer_addresses
for each row execute function public.limit_customer_addresses();

-- Fields required by the current checkout implementation.
alter table public.stores
  add column if not exists delivery_charge_dhaka numeric(12,2) default 60,
  add column if not exists delivery_charge_outside_dhaka numeric(12,2) default 120,
  add column if not exists free_delivery_min_amount numeric(12,2) default 0;

alter table public.products
  add column if not exists has_variants boolean default false,
  add column if not exists variant_types jsonb default '[]'::jsonb,
  add column if not exists variants jsonb default '[]'::jsonb,
  add column if not exists delivery_charge_mode text default 'store_default',
  add column if not exists delivery_charge_dhaka numeric(12,2),
  add column if not exists delivery_charge_outside_dhaka numeric(12,2);

alter table public.orders
  add column if not exists customer_id uuid references auth.users(id) on delete set null,
  add column if not exists customer_email text,
  add column if not exists txn_id text,
  add column if not exists transaction_id text,
  add column if not exists delivery_note text,
  add column if not exists subtotal numeric(12,2) default 0,
  add column if not exists delivery_charge numeric(12,2) default 0,
  add column if not exists discount_amount numeric(12,2) default 0,
  add column if not exists coupon_code text,
  add column if not exists coupon_id uuid,
  add column if not exists items jsonb default '[]'::jsonb,
  add column if not exists updated_at timestamptz default now();

update public.orders
set txn_id=coalesce(txn_id,transaction_id),
    transaction_id=coalesce(transaction_id,txn_id)
where txn_id is null or transaction_id is null;

create or replace function public.sync_order_transaction_id()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.txn_id:=coalesce(new.txn_id,new.transaction_id);
  new.transaction_id:=coalesce(new.transaction_id,new.txn_id);
  new.updated_at:=now();
  return new;
end $$;

drop trigger if exists orders_sync_transaction_id_tg on public.orders;
create trigger orders_sync_transaction_id_tg
before insert or update on public.orders
for each row execute function public.sync_order_transaction_id();

create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_customer_email_idx on public.orders(customer_email);
create index if not exists orders_customer_phone_idx on public.orders(customer_phone);

create table if not exists public.order_timeline (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists order_timeline_order_idx
  on public.order_timeline(order_id,created_at);

-- Product reviews/rating ---------------------------------------------------------------
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid,
  customer_name text,
  customer_email text,
  rating integer not null check (rating between 1 and 5),
  comment text,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists product_reviews_product_customer_uidx on public.product_reviews(product_id, customer_id) where customer_id is not null;
create index if not exists product_reviews_product_status_idx on public.product_reviews(product_id, status, created_at desc);
alter table public.product_reviews enable row level security;
drop policy if exists "Public reads approved product reviews" on public.product_reviews;
create policy "Public reads approved product reviews" on public.product_reviews for select using (status = 'approved');
drop policy if exists "Customers insert their own reviews" on public.product_reviews;
create policy "Customers insert their own reviews" on public.product_reviews for insert with check (auth.uid() = customer_id);
alter table public.products add column if not exists average_rating numeric(3,2) not null default 0;
alter table public.products add column if not exists rating_count integer not null default 0;

create or replace function public.refresh_product_rating(p_product_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.products p
  set average_rating = coalesce((select round(avg(rating)::numeric, 2) from public.product_reviews r where r.product_id = p_product_id and r.status = 'approved'), 0),
      rating_count = coalesce((select count(*)::integer from public.product_reviews r where r.product_id = p_product_id and r.status = 'approved'), 0),
      updated_at = now()
  where p.id = p_product_id;
end; $$;

create or replace function public.customer_can_review_product(p_store_id uuid, p_product_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    where o.store_id = p_store_id
      and o.customer_id = auth.uid()
      and coalesce(o.status, '') not in ('cancelled')
      and exists (
        select 1 from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) item
        where nullif(item->>'product_id', '')::uuid = p_product_id
      )
  );
$$;
grant execute on function public.customer_can_review_product(uuid, uuid) to authenticated;

create or replace function public.submit_product_review(p_store_id uuid, p_product_id uuid, p_rating integer, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_email text; v_name text;
begin
  if v_uid is null then raise exception 'Customer login required'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if length(trim(coalesce(p_comment, ''))) < 5 then raise exception 'Review comment is too short'; end if;
  if not public.customer_can_review_product(p_store_id, p_product_id) then raise exception 'Only customers who ordered this product can review it'; end if;
  select email into v_email from auth.users where id = v_uid;
  select coalesce(full_name, split_part(v_email, '@', 1)) into v_name from public.customer_profiles where id = v_uid;
  v_name := coalesce(v_name, split_part(v_email, '@', 1), 'Verified customer');
  insert into public.product_reviews (store_id, product_id, customer_id, customer_name, customer_email, rating, comment, status)
  values (p_store_id, p_product_id, v_uid, v_name, v_email, p_rating, trim(p_comment), 'approved')
  on conflict (product_id, customer_id) do update set rating = excluded.rating, comment = excluded.comment, status = 'approved', customer_name = excluded.customer_name, customer_email = excluded.customer_email, updated_at = now();
  perform public.refresh_product_rating(p_product_id);
  return jsonb_build_object('success', true);
end; $$;
grant execute on function public.submit_product_review(uuid, uuid, integer, text) to authenticated;

-- Coupon system hardening --------------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  name text,
  discount_type text not null default 'percent' check (discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  min_order_amount numeric(12,2) not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit integer,
  used_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists coupons_store_upper_code_uidx on public.coupons(store_id, upper(code));
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid references public.coupons(id) on delete set null,
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  customer_id uuid,
  code text,
  discount_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
drop policy if exists "Store owners manage coupons" on public.coupons;
create policy "Store owners manage coupons" on public.coupons for all using (exists (select 1 from public.stores s where s.id = coupons.store_id and s.owner_id = auth.uid())) with check (exists (select 1 from public.stores s where s.id = coupons.store_id and s.owner_id = auth.uid()));
drop policy if exists "Store owners read coupon redemptions" on public.coupon_redemptions;
create policy "Store owners read coupon redemptions" on public.coupon_redemptions for select using (exists (select 1 from public.stores s where s.id = coupon_redemptions.store_id and s.owner_id = auth.uid()));

create or replace function public.validate_coupon(p_store_id uuid, p_code text, p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_coupon public.coupons%rowtype; v_code text := upper(trim(coalesce(p_code, ''))); v_discount numeric(12,2) := 0;
begin
  if v_code = '' then return jsonb_build_object('valid', false, 'message', 'Enter a coupon code.'); end if;
  select * into v_coupon from public.coupons where store_id = p_store_id and upper(code) = v_code limit 1;
  if not found then return jsonb_build_object('valid', false, 'message', 'Coupon code not found.'); end if;
  if not coalesce(v_coupon.is_active, true) then return jsonb_build_object('valid', false, 'message', 'This coupon is inactive.'); end if;
  if v_coupon.starts_at is not null and v_coupon.starts_at > now() then return jsonb_build_object('valid', false, 'message', 'This coupon is not active yet.'); end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then return jsonb_build_object('valid', false, 'message', 'This coupon has expired.'); end if;
  if v_coupon.usage_limit is not null and coalesce(v_coupon.used_count, 0) >= v_coupon.usage_limit then return jsonb_build_object('valid', false, 'message', 'This coupon usage limit has been reached.'); end if;
  if coalesce(p_subtotal, 0) < coalesce(v_coupon.min_order_amount, 0) then return jsonb_build_object('valid', false, 'message', 'Minimum order amount is BDT ' || coalesce(v_coupon.min_order_amount, 0)); end if;
  if v_coupon.discount_type = 'percent' then v_discount := round(coalesce(p_subtotal, 0) * least(greatest(v_coupon.discount_value, 0), 100) / 100, 2); else v_discount := least(greatest(v_coupon.discount_value, 0), coalesce(p_subtotal, 0)); end if;
  return jsonb_build_object('valid', true, 'coupon_id', v_coupon.id, 'code', v_coupon.code, 'discount_type', v_coupon.discount_type, 'discount_value', v_coupon.discount_value, 'discount_amount', v_discount, 'min_order_amount', v_coupon.min_order_amount, 'message', 'Coupon applied successfully.');
end; $$;
grant execute on function public.validate_coupon(uuid, text, numeric) to anon, authenticated;

-- Customer account deletion ------------------------------------------------------------
alter table public.customer_profiles add column if not exists deleted_at timestamptz;
alter table public.customer_profiles add column if not exists account_status text not null default 'active';
create or replace function public.delete_customer_account()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Customer login required'; end if;
  delete from public.customer_addresses where customer_id = v_uid;
  insert into public.customer_profiles (id, account_status, deleted_at, updated_at)
  values (v_uid, 'deleted', now(), now())
  on conflict (id) do update set full_name = null, phone = null, account_status = 'deleted', deleted_at = now(), updated_at = now();
  return jsonb_build_object('success', true);
end; $$;
grant execute on function public.delete_customer_account() to authenticated;

-- Order RPC hardening: stock/variant/coupon/total --------------------------------------
alter table public.orders add column if not exists subtotal numeric(12,2) default 0;
alter table public.orders add column if not exists delivery_charge numeric(12,2) default 0;
alter table public.orders add column if not exists discount_amount numeric(12,2) default 0;
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists coupon_id uuid;
alter table public.orders add column if not exists delivery_note text;

-- Keep your existing place_customer_order_v2 if it is already newer. This function replaces it with a transaction-safe version.
create or replace function public.place_customer_order_v2(p_order_id text, p_store_id uuid, p_customer_name text, p_customer_phone text, p_customer_email text, p_delivery_address text, p_district text, p_delivery_note text, p_payment_method text, p_payment_status text, p_txn_id text, p_items jsonb, p_total numeric default 0, p_coupon_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth_uid uuid := auth.uid(); v_auth_email text; v_store stores%rowtype; v_product products%rowtype; v_item jsonb;
  v_qty integer; v_product_id uuid; v_variant_id text; v_variant_label text; v_variant jsonb; v_variant_stock integer;
  v_price numeric(12,2); v_line_total numeric(12,2); v_subtotal numeric(12,2) := 0; v_store_default_delivery numeric(12,2) := 0; v_item_delivery numeric(12,2) := 0; v_delivery_charge numeric(12,2) := 0; v_order_total numeric(12,2) := 0;
  v_coupon coupons%rowtype; v_coupon_code text := upper(trim(coalesce(p_coupon_code, ''))); v_discount_amount numeric(12,2) := 0;
  v_validated_items jsonb := '[]'::jsonb; v_updated_variants jsonb; v_inserted_id uuid;
begin
  if v_auth_uid is null then raise exception 'Customer login required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;
  select email into v_auth_email from auth.users where id = v_auth_uid;
  select * into v_store from public.stores where id = p_store_id and coalesce(storefront_published, false) is true and coalesce(account_status, 'active') = 'active';
  if not found then raise exception 'Shop is unavailable'; end if;
  insert into public.customer_profiles (id, full_name, phone, account_status, updated_at) values (v_auth_uid, p_customer_name, p_customer_phone, 'active', now()) on conflict (id) do update set full_name = coalesce(nullif(excluded.full_name, ''), public.customer_profiles.full_name), phone = coalesce(nullif(excluded.phone, ''), public.customer_profiles.phone), account_status = 'active', updated_at = now();
  if lower(trim(coalesce(p_district, ''))) = 'dhaka' then v_store_default_delivery := greatest(coalesce(v_store.delivery_charge_dhaka, 60), 0); else v_store_default_delivery := greatest(coalesce(v_store.delivery_charge_outside_dhaka, 120), 0); end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid; v_qty := coalesce((v_item->>'qty')::integer, 0); v_variant_id := nullif(v_item->>'variant_id', ''); v_variant_label := nullif(v_item->>'variant', '');
    if v_qty <= 0 then raise exception 'Invalid quantity'; end if;
    select * into v_product from public.products where id = v_product_id and store_id = p_store_id and status in ('published','active') for update;
    if not found then raise exception 'Product unavailable: %', v_product_id; end if;
    if coalesce(v_product.has_variants, false) then
      select elem into v_variant from jsonb_array_elements(coalesce(v_product.variants::jsonb, '[]'::jsonb)) elem where coalesce(elem->>'id', elem->>'combo', elem->>'label') = coalesce(v_variant_id, v_variant_label) or elem->>'combo' = v_variant_label or elem->>'label' = v_variant_label limit 1;
      if v_variant is null then raise exception 'Selected variant is unavailable for %', v_product.title; end if;
      v_variant_stock := coalesce(nullif(v_variant->>'stock', '')::integer, 0);
      if v_variant_stock < v_qty then raise exception 'Only % left for %', v_variant_stock, v_product.title; end if;
      v_price := coalesce(nullif(v_variant->>'price', '')::numeric, v_product.price, 0);
      select jsonb_agg(case when coalesce(elem->>'id', elem->>'combo', elem->>'label') = coalesce(v_variant_id, v_variant_label) or elem->>'combo' = v_variant_label or elem->>'label' = v_variant_label then jsonb_set(jsonb_set(elem, '{stock}', to_jsonb(greatest(coalesce(nullif(elem->>'stock', '')::integer, 0) - v_qty, 0)), true), '{available}', to_jsonb((greatest(coalesce(nullif(elem->>'stock', '')::integer, 0) - v_qty, 0)) > 0), true) else elem end) into v_updated_variants from jsonb_array_elements(coalesce(v_product.variants::jsonb, '[]'::jsonb)) elem;
      update public.products set variants = coalesce(v_updated_variants, '[]'::jsonb), stock = greatest(coalesce(stock, 0) - v_qty, 0), updated_at = now() where id = v_product.id;
    else
      if coalesce(v_product.stock, 0) < v_qty then raise exception 'Only % left for %', coalesce(v_product.stock, 0), v_product.title; end if;
      v_price := coalesce(v_product.price, 0);
      update public.products set stock = greatest(coalesce(stock, 0) - v_qty, 0), updated_at = now() where id = v_product.id;
    end if;
    v_line_total := v_price * v_qty; v_subtotal := v_subtotal + v_line_total;
    if coalesce(v_product.delivery_charge_mode, 'store_default') = 'free' then v_item_delivery := 0; elsif coalesce(v_product.delivery_charge_mode, 'store_default') = 'custom' then if lower(trim(coalesce(p_district, ''))) = 'dhaka' then v_item_delivery := greatest(coalesce(v_product.delivery_charge_dhaka, v_store_default_delivery), 0); else v_item_delivery := greatest(coalesce(v_product.delivery_charge_outside_dhaka, v_store_default_delivery), 0); end if; else v_item_delivery := v_store_default_delivery; end if;
    v_delivery_charge := greatest(v_delivery_charge, v_item_delivery);
    v_validated_items := v_validated_items || jsonb_build_array(jsonb_build_object('product_id', v_product.id, 'title', v_product.title, 'variant_id', v_variant_id, 'variant', v_variant_label, 'price', v_price, 'qty', v_qty, 'line_total', v_line_total, 'item_delivery_charge', v_item_delivery));
  end loop;
  if coalesce(v_store.free_delivery_min_amount, 0) > 0 and v_subtotal >= coalesce(v_store.free_delivery_min_amount, 0) then v_delivery_charge := 0; end if;
  v_order_total := v_subtotal + v_delivery_charge;
  if v_coupon_code <> '' then
    select * into v_coupon from public.coupons where store_id = p_store_id and upper(code) = v_coupon_code and coalesce(is_active, true) is true and (starts_at is null or starts_at <= now()) and (expires_at is null or expires_at >= now()) for update;
    if not found then raise exception 'Coupon is invalid or expired'; end if;
    if coalesce(v_coupon.min_order_amount, 0) > v_subtotal then raise exception 'Minimum order amount for coupon % is %', v_coupon.code, v_coupon.min_order_amount; end if;
    if v_coupon.usage_limit is not null and coalesce(v_coupon.used_count, 0) >= v_coupon.usage_limit then raise exception 'Coupon usage limit reached'; end if;
    if v_coupon.discount_type = 'percent' then v_discount_amount := round(v_subtotal * least(greatest(v_coupon.discount_value, 0), 100) / 100, 2); else v_discount_amount := least(greatest(v_coupon.discount_value, 0), v_subtotal); end if;
    v_order_total := greatest(0, v_order_total - v_discount_amount);
  end if;
  if abs(coalesce(p_total, v_order_total) - v_order_total) > 1 then raise exception 'Order total changed. Please review the latest total before placing the order.'; end if;
  insert into public.orders (order_id, store_id, customer_name, customer_phone, customer_email, customer_id, delivery_address, district, delivery_note, payment_method, payment_status, txn_id, status, subtotal, delivery_charge, discount_amount, coupon_code, coupon_id, total, items) values (p_order_id, p_store_id, p_customer_name, p_customer_phone, coalesce(nullif(p_customer_email, ''), v_auth_email), v_auth_uid, p_delivery_address, p_district, p_delivery_note, p_payment_method, p_payment_status, p_txn_id, 'pending', v_subtotal, v_delivery_charge, v_discount_amount, nullif(v_coupon_code, ''), case when v_coupon.id is null then null else v_coupon.id end, v_order_total, v_validated_items) returning id into v_inserted_id;
  insert into public.order_timeline (order_id, status, note) values (v_inserted_id, 'pending', 'Order placed by customer');
  if v_coupon.id is not null then update public.coupons set used_count = coalesce(used_count, 0) + 1, updated_at = now() where id = v_coupon.id; insert into public.coupon_redemptions (coupon_id, store_id, order_id, customer_id, code, discount_amount) values (v_coupon.id, p_store_id, v_inserted_id, v_auth_uid, v_coupon.code, v_discount_amount); end if;
  return jsonb_build_object('id', v_inserted_id, 'order_id', p_order_id, 'subtotal', v_subtotal, 'delivery_charge', v_delivery_charge, 'discount_amount', v_discount_amount, 'coupon_code', nullif(v_coupon_code, ''), 'total', v_order_total);
end; $$;
grant execute on function public.place_customer_order_v2(text, uuid, text, text, text, text, text, text, text, text, text, jsonb, numeric, text) to authenticated;


-- Keep aggregate ratings correct when review rows are changed outside the RPC.
create or replace function public.refresh_product_rating_from_review()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='DELETE' then
    perform public.refresh_product_rating(old.product_id);
    return old;
  end if;

  perform public.refresh_product_rating(new.product_id);
  return new;
end $$;

drop trigger if exists product_reviews_refresh_rating_tg on public.product_reviews;
create trigger product_reviews_refresh_rating_tg
after insert or update or delete on public.product_reviews
for each row execute function public.refresh_product_rating_from_review();

-- Secure public tracking RPC. It returns only an order matching all three identifiers.
-- The current frontend can be migrated from direct table reads to this RPC.
create or replace function public.get_public_order_tracking(
  p_store_subdomain text,
  p_order_id text,
  p_customer_phone text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_store public.stores%rowtype;
  v_timeline jsonb;
begin
  select o.*
  into v_order
  from public.orders o
  join public.stores s on s.id=o.store_id
  where lower(s.subdomain)=lower(trim(p_store_subdomain))
    and lower(o.order_id)=lower(trim(p_order_id))
    and regexp_replace(coalesce(o.customer_phone,''),'\D','','g')
        = regexp_replace(coalesce(p_customer_phone,''),'\D','','g')
  limit 1;

  if v_order.id is null then
    return jsonb_build_object('found',false);
  end if;

  select * into v_store
  from public.stores
  where id=v_order.store_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'status',t.status,
        'note',t.note,
        'created_at',t.created_at
      )
      order by t.created_at
    ),
    '[]'::jsonb
  )
  into v_timeline
  from public.order_timeline t
  where t.order_id=v_order.id;

  return jsonb_build_object(
    'found',true,
    'order',jsonb_build_object(
      'id',v_order.id,
      'order_id',v_order.order_id,
      'customer_name',v_order.customer_name,
      'customer_phone',v_order.customer_phone,
      'delivery_address',v_order.delivery_address,
      'district',v_order.district,
      'delivery_note',v_order.delivery_note,
      'payment_method',v_order.payment_method,
      'payment_status',v_order.payment_status,
      'status',v_order.status,
      'subtotal',v_order.subtotal,
      'delivery_charge',v_order.delivery_charge,
      'discount_amount',v_order.discount_amount,
      'total',v_order.total,
      'items',v_order.items,
      'created_at',v_order.created_at,
      'updated_at',v_order.updated_at
    ),
    'store',jsonb_build_object(
      'shop_name',v_store.shop_name,
      'subdomain',v_store.subdomain,
      'phone',v_store.phone,
      'whatsapp_number',v_store.whatsapp_number,
      'contact_email',v_store.contact_email
    ),
    'timeline',v_timeline
  );
end $$;

revoke all on function public.get_public_order_tracking(text,text,text) from public;
grant execute on function public.get_public_order_tracking(text,text,text)
  to anon,authenticated;

revoke all on function public.place_customer_order_v2(
  text,uuid,text,text,text,text,text,text,text,text,text,jsonb,numeric,text
) from public;
grant execute on function public.place_customer_order_v2(
  text,uuid,text,text,text,text,text,text,text,text,text,jsonb,numeric,text
) to authenticated;

notify pgrst,'reload schema';

-- >>>>>>>>>>>>>>>>>>>>>>> END 0002_customer_checkout.sql <<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>> BEGIN 0003_payments.sql <<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- BazarHQ CURRENT MIGRATION 0003
-- Merchant payment methods and SSLCommerz transaction support
-- =============================================================================
-- Canonical method values: bkash, nagad, rocket, ssl, cod.
-- Secrets are never returned by the public checkout RPC.
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.payment_configs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  method text not null,
  enabled boolean not null default false,
  merchant_number text,
  ssl_store_id text,
  store_id_key text,
  store_password text,
  is_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_configs
  add column if not exists enabled boolean default false,
  add column if not exists merchant_number text,
  add column if not exists ssl_store_id text,
  add column if not exists store_id_key text,
  add column if not exists store_password text,
  add column if not exists is_live boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Keep the old store_id_key name compatible with current ssl_store_id.
update public.payment_configs
set ssl_store_id=coalesce(ssl_store_id,store_id_key),
    store_id_key=coalesce(store_id_key,ssl_store_id),
    enabled=coalesce(enabled,false),
    is_live=coalesce(is_live,false),
    updated_at=coalesce(updated_at,now());

create or replace function public.sync_payment_config_columns()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.ssl_store_id:=coalesce(new.ssl_store_id,new.store_id_key);
  new.store_id_key:=coalesce(new.store_id_key,new.ssl_store_id);
  new.updated_at:=now();
  return new;
end $$;

drop trigger if exists payment_configs_touch_updated_at on public.payment_configs;
drop trigger if exists payment_configs_sync_columns_tg on public.payment_configs;
create trigger payment_configs_sync_columns_tg
before insert or update on public.payment_configs
for each row execute function public.sync_payment_config_columns();

-- Normalize the former sslcommerz method name without creating duplicates.
delete from public.payment_configs old_pc
using public.payment_configs canonical_pc
where old_pc.store_id=canonical_pc.store_id
  and old_pc.method='sslcommerz'
  and canonical_pc.method='ssl';

update public.payment_configs
set method='ssl'
where method='sslcommerz';

create unique index if not exists payment_configs_store_method_uidx
  on public.payment_configs(store_id,method);

alter table public.payment_configs
  drop constraint if exists payment_configs_method_check;
alter table public.payment_configs
  add constraint payment_configs_method_check
  check (method in ('bkash','nagad','rocket','ssl','cod'));

-- Callback/audit rows for SSLCommerz and other gateway attempts.
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  payment_config_id uuid references public.payment_configs(id) on delete set null,
  provider text not null default 'sslcommerz',
  transaction_id text,
  session_key text,
  amount numeric(12,2),
  currency text not null default 'BDT',
  status text not null default 'initiated',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  validation_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.payment_transactions
  add column if not exists store_id uuid,
  add column if not exists order_id uuid,
  add column if not exists payment_config_id uuid,
  add column if not exists provider text default 'sslcommerz',
  add column if not exists transaction_id text,
  add column if not exists session_key text,
  add column if not exists amount numeric(12,2),
  add column if not exists currency text default 'BDT',
  add column if not exists status text default 'initiated',
  add column if not exists request_payload jsonb default '{}'::jsonb,
  add column if not exists response_payload jsonb default '{}'::jsonb,
  add column if not exists validation_payload jsonb default '{}'::jsonb,
  add column if not exists error_message text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists completed_at timestamptz;

create index if not exists payment_transactions_order_idx
  on public.payment_transactions(order_id,created_at desc);
create index if not exists payment_transactions_store_idx
  on public.payment_transactions(store_id,created_at desc);
create index if not exists payment_transactions_txn_idx
  on public.payment_transactions(transaction_id)
  where transaction_id is not null;

-- Merchant ownership policies.
alter table public.payment_configs enable row level security;

drop policy if exists "Owners manage own payment configs" on public.payment_configs;
drop policy if exists payment_configs_owner_select on public.payment_configs;
drop policy if exists payment_configs_owner_insert on public.payment_configs;
drop policy if exists payment_configs_owner_update on public.payment_configs;
drop policy if exists payment_configs_owner_delete on public.payment_configs;

create policy payment_configs_owner_select
on public.payment_configs
for select to authenticated
using (
  exists (
    select 1 from public.stores s
    where s.id=payment_configs.store_id
      and s.owner_id=auth.uid()
  )
);

create policy payment_configs_owner_insert
on public.payment_configs
for insert to authenticated
with check (
  exists (
    select 1 from public.stores s
    where s.id=payment_configs.store_id
      and s.owner_id=auth.uid()
      and coalesce(s.account_status,'active')<>'deleted'
  )
);

create policy payment_configs_owner_update
on public.payment_configs
for update to authenticated
using (
  exists (
    select 1 from public.stores s
    where s.id=payment_configs.store_id
      and s.owner_id=auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id=payment_configs.store_id
      and s.owner_id=auth.uid()
      and coalesce(s.account_status,'active')<>'deleted'
  )
);

create policy payment_configs_owner_delete
on public.payment_configs
for delete to authenticated
using (
  exists (
    select 1 from public.stores s
    where s.id=payment_configs.store_id
      and s.owner_id=auth.uid()
  )
);

-- Checkout-safe projection. No SSLCommerz password or secret is exposed.
create or replace function public.get_public_payment_methods(p_store_id uuid)
returns table (
  method text,
  label text,
  needs_txn boolean,
  merchant_number text
)
language sql
security definer
set search_path=public
as $$
  select
    pc.method,
    case pc.method
      when 'bkash' then 'bKash'
      when 'nagad' then 'Nagad'
      when 'rocket' then 'Rocket'
      when 'ssl' then 'Online Payment'
      when 'cod' then 'Cash on Delivery'
      else pc.method
    end,
    pc.method in ('bkash','nagad','rocket'),
    case
      when pc.method in ('bkash','nagad','rocket') then pc.merchant_number
      else null
    end
  from public.payment_configs pc
  join public.stores s on s.id=pc.store_id
  where pc.store_id=p_store_id
    and pc.enabled=true
    and coalesce(s.account_status,'active')='active'
    and coalesce(s.storefront_published,false)=true
  order by case pc.method
    when 'cod' then 1
    when 'bkash' then 2
    when 'nagad' then 3
    when 'rocket' then 4
    when 'ssl' then 5
    else 99
  end;
$$;

revoke all on function public.get_public_payment_methods(uuid) from public;
grant execute on function public.get_public_payment_methods(uuid)
  to anon,authenticated;

create or replace function public.store_has_active_payment_method(p_store_id uuid)
returns boolean
language sql
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.payment_configs pc
    join public.stores s on s.id=pc.store_id
    where pc.store_id=p_store_id
      and pc.enabled=true
      and s.owner_id=auth.uid()
  );
$$;

revoke all on function public.store_has_active_payment_method(uuid) from public;
grant execute on function public.store_has_active_payment_method(uuid)
  to authenticated;

-- Old stores.payment_methods_configured can be boolean or JSON depending on history.
-- JSON forms are migrated; boolean is intentionally not guessed.
do $$
declare
  v_type text;
begin
  select data_type into v_type
  from information_schema.columns
  where table_schema='public'
    and table_name='stores'
    and column_name='payment_methods_configured';

  if v_type in ('json','jsonb') then
    execute $migrate$
      insert into public.payment_configs(store_id,method,enabled)
      select s.id,m.method_name,true
      from public.stores s
      cross join lateral (
        values
          ('bkash',coalesce((s.payment_methods_configured::jsonb->>'bkash')::boolean,false)),
          ('nagad',coalesce((s.payment_methods_configured::jsonb->>'nagad')::boolean,false)),
          ('rocket',coalesce((s.payment_methods_configured::jsonb->>'rocket')::boolean,false)),
          ('ssl',coalesce((s.payment_methods_configured::jsonb->>'ssl')::boolean,
                          (s.payment_methods_configured::jsonb->>'sslcommerz')::boolean,false)),
          ('cod',coalesce((s.payment_methods_configured::jsonb->>'cod')::boolean,false))
      ) m(method_name,is_enabled)
      where m.is_enabled=true
      on conflict(store_id,method) do update set enabled=excluded.enabled
    $migrate$;
  elsif v_type='boolean' then
    raise notice 'payment_methods_configured is boolean; method-level backfill skipped.';
  elsif v_type is not null then
    raise notice 'payment_methods_configured type % is not migrated automatically.',v_type;
  end if;
end $$;

notify pgrst,'reload schema';

-- >>>>>>>>>>>>>>>>>>>>>>> END 0003_payments.sql <<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>> BEGIN 0004_themes_policies.sql <<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- BazarHQ CURRENT MIGRATION 0004
-- Advanced themes, merchant storefront customization and shop policies
-- =============================================================================
-- Super Admin theme writes are expected through service-role Edge Functions.
-- Public/merchant clients may read active themes; merchants apply a theme through
-- apply_store_theme(), which verifies store ownership.
-- =============================================================================

create extension if not exists pgcrypto;

alter table public.stores add column if not exists theme_id text default 'emerald';
alter table public.stores add column if not exists theme_name text;
alter table public.stores add column if not exists brand_color text default '#10b981';
alter table public.stores add column if not exists theme_config jsonb default '{}'::jsonb;
alter table public.stores add column if not exists theme_updated_at timestamptz;

create table if not exists public.platform_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  primary_color text default '#635bff',
  secondary_color text default '#312e81',
  accent_color text default '#8b5cf6',
  is_active boolean default true,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.platform_themes add column if not exists description text;
alter table public.platform_themes add column if not exists primary_color text default '#635bff';
alter table public.platform_themes add column if not exists secondary_color text default '#312e81';
alter table public.platform_themes add column if not exists accent_color text default '#8b5cf6';
alter table public.platform_themes add column if not exists surface_color text default '#ffffff';
alter table public.platform_themes add column if not exists background_color text default '#f8fafc';
alter table public.platform_themes add column if not exists text_color text default '#0f172a';
alter table public.platform_themes add column if not exists layout_preset text default 'modern-brand';
alter table public.platform_themes add column if not exists font_family text default 'inter';
alter table public.platform_themes add column if not exists nav_style text default 'glass';
alter table public.platform_themes add column if not exists hero_style text default 'banner-right';
alter table public.platform_themes add column if not exists card_style text default 'soft';
alter table public.platform_themes add column if not exists button_style text default 'pill';
alter table public.platform_themes add column if not exists corner_radius text default 'extra';
alter table public.platform_themes add column if not exists density text default 'comfortable';
alter table public.platform_themes add column if not exists background_style text default 'gradient';
alter table public.platform_themes add column if not exists animation_style text default 'smooth';
alter table public.platform_themes add column if not exists product_grid text default 'three';
alter table public.platform_themes add column if not exists config jsonb default '{}'::jsonb;
alter table public.platform_themes add column if not exists is_active boolean default true;
alter table public.platform_themes add column if not exists is_default boolean default false;
alter table public.platform_themes add column if not exists created_at timestamptz default now();
alter table public.platform_themes add column if not exists updated_at timestamptz default now();

create or replace function public.platform_theme_config(
  p_slug text,
  p_name text,
  p_description text,
  p_primary text,
  p_secondary text,
  p_accent text,
  p_surface text,
  p_background text,
  p_text text,
  p_layout text,
  p_font text,
  p_nav text,
  p_hero text,
  p_card text,
  p_button text,
  p_radius text,
  p_density text,
  p_bg_style text,
  p_animation text,
  p_grid text,
  p_default boolean
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'slug', p_slug,
    'name', p_name,
    'description', coalesce(p_description, ''),
    'primary_color', p_primary,
    'secondary_color', p_secondary,
    'accent_color', p_accent,
    'surface_color', p_surface,
    'background_color', p_background,
    'text_color', p_text,
    'layout_preset', p_layout,
    'font_family', p_font,
    'nav_style', p_nav,
    'hero_style', p_hero,
    'card_style', p_card,
    'button_style', p_button,
    'corner_radius', p_radius,
    'density', p_density,
    'background_style', p_bg_style,
    'animation_style', p_animation,
    'product_grid', p_grid,
    'is_default', coalesce(p_default, false)
  );
$$;

insert into public.platform_themes (
  name, slug, description, primary_color, secondary_color, accent_color,
  surface_color, background_color, text_color, layout_preset, font_family, nav_style,
  hero_style, card_style, button_style, corner_radius, density, background_style,
  animation_style, product_grid, is_active, is_default, config
)
values
  ('Emerald Commerce', 'emerald', 'Clean green theme for modern Bangladeshi commerce stores.', '#10b981', '#064e3b', '#22c55e', '#ffffff', '#f8fafc', '#0f172a', 'modern-brand', 'inter', 'glass', 'banner-right', 'soft', 'pill', 'extra', 'comfortable', 'gradient', 'smooth', 'three', true, true, public.platform_theme_config('emerald','Emerald Commerce','Clean green theme for modern Bangladeshi commerce stores.','#10b981','#064e3b','#22c55e','#ffffff','#f8fafc','#0f172a','modern-brand','inter','glass','banner-right','soft','pill','extra','comfortable','gradient','smooth','three',true)),
  ('Indigo Premium', 'indigo', 'Premium blue-violet storefront theme.', '#635bff', '#312e81', '#8b5cf6', '#ffffff', '#f8fafc', '#0f172a', 'modern-brand', 'plus-jakarta', 'glass', 'split', 'shadow', 'pill', 'extra', 'comfortable', 'gradient', 'premium', 'three', true, false, public.platform_theme_config('indigo','Indigo Premium','Premium blue-violet storefront theme.','#635bff','#312e81','#8b5cf6','#ffffff','#f8fafc','#0f172a','modern-brand','plus-jakarta','glass','split','shadow','pill','extra','comfortable','gradient','premium','three',false)),
  ('Rose Boutique', 'rose-boutique', 'Editorial boutique theme for fashion and beauty shops.', '#e11d48', '#881337', '#fb7185', '#ffffff', '#fff1f2', '#111827', 'boutique', 'playfair', 'minimal', 'editorial', 'glass', 'soft', 'extra', 'spacious', 'clean', 'smooth', 'two', true, false, public.platform_theme_config('rose-boutique','Rose Boutique','Editorial boutique theme for fashion and beauty shops.','#e11d48','#881337','#fb7185','#ffffff','#fff1f2','#111827','boutique','playfair','minimal','editorial','glass','soft','extra','spacious','clean','smooth','two',false)),
  ('Amber Marketplace', 'amber-marketplace', 'Dense warm marketplace theme for broad product catalogs.', '#f59e0b', '#7c2d12', '#fb923c', '#ffffff', '#fffbeb', '#0f172a', 'marketplace', 'inter', 'solid', 'compact', 'bordered', 'rounded', 'large', 'compact', 'clean', 'minimal', 'four', true, false, public.platform_theme_config('amber-marketplace','Amber Marketplace','Dense warm marketplace theme for broad product catalogs.','#f59e0b','#7c2d12','#fb923c','#ffffff','#fffbeb','#0f172a','marketplace','inter','solid','compact','bordered','rounded','large','compact','clean','minimal','four',false)),
  ('Tech Edge', 'tech-edge', 'Dark high-contrast theme for electronics stores.', '#2563eb', '#020617', '#06b6d4', '#0f172a', '#020617', '#e2e8f0', 'tech', 'manrope', 'dark', 'split', 'bordered', 'sharp', 'medium', 'comfortable', 'dark', 'smooth', 'three', true, false, public.platform_theme_config('tech-edge','Tech Edge','Dark high-contrast theme for electronics stores.','#2563eb','#020617','#06b6d4','#0f172a','#020617','#e2e8f0','tech','manrope','dark','split','bordered','sharp','medium','comfortable','dark','smooth','three',false))
on conflict (slug) do update set
  description = excluded.description,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  accent_color = excluded.accent_color,
  surface_color = excluded.surface_color,
  background_color = excluded.background_color,
  text_color = excluded.text_color,
  layout_preset = excluded.layout_preset,
  font_family = excluded.font_family,
  nav_style = excluded.nav_style,
  hero_style = excluded.hero_style,
  card_style = excluded.card_style,
  button_style = excluded.button_style,
  corner_radius = excluded.corner_radius,
  density = excluded.density,
  background_style = excluded.background_style,
  animation_style = excluded.animation_style,
  product_grid = excluded.product_grid,
  config = excluded.config,
  is_active = true,
  updated_at = now();

-- Backfill platform theme config for existing custom themes.
update public.platform_themes
set config = public.platform_theme_config(
  slug,
  name,
  description,
  coalesce(primary_color, '#635bff'),
  coalesce(secondary_color, '#312e81'),
  coalesce(accent_color, '#8b5cf6'),
  coalesce(surface_color, '#ffffff'),
  coalesce(background_color, '#f8fafc'),
  coalesce(text_color, '#0f172a'),
  coalesce(layout_preset, 'modern-brand'),
  coalesce(font_family, 'inter'),
  coalesce(nav_style, 'glass'),
  coalesce(hero_style, 'banner-right'),
  coalesce(card_style, 'soft'),
  coalesce(button_style, 'pill'),
  coalesce(corner_radius, 'extra'),
  coalesce(density, 'comfortable'),
  coalesce(background_style, 'gradient'),
  coalesce(animation_style, 'smooth'),
  coalesce(product_grid, 'three'),
  coalesce(is_default, false)
)
where config is null or config = '{}'::jsonb;

-- Apply a default full config to old stores that only had theme_id/color.
update public.stores s
set
  theme_name = coalesce(nullif(s.theme_name, ''), pt.name, 'Emerald Commerce'),
  theme_config = public.platform_theme_config(
    coalesce(nullif(s.theme_id, ''), pt.slug, 'emerald'),
    coalesce(nullif(s.theme_name, ''), pt.name, 'Emerald Commerce'),
    coalesce(pt.description, ''),
    coalesce(nullif(s.brand_color, ''), pt.primary_color, '#10b981'),
    coalesce(pt.secondary_color, '#064e3b'),
    coalesce(pt.accent_color, '#22c55e'),
    coalesce(pt.surface_color, '#ffffff'),
    coalesce(pt.background_color, '#f8fafc'),
    coalesce(pt.text_color, '#0f172a'),
    coalesce(pt.layout_preset, 'modern-brand'),
    coalesce(pt.font_family, 'inter'),
    coalesce(pt.nav_style, 'glass'),
    coalesce(pt.hero_style, 'banner-right'),
    coalesce(pt.card_style, 'soft'),
    coalesce(pt.button_style, 'pill'),
    coalesce(pt.corner_radius, 'extra'),
    coalesce(pt.density, 'comfortable'),
    coalesce(pt.background_style, 'gradient'),
    coalesce(pt.animation_style, 'smooth'),
    coalesce(pt.product_grid, 'three'),
    coalesce(pt.is_default, false)
  ),
  theme_updated_at = coalesce(s.theme_updated_at, now())
from public.platform_themes pt
where pt.slug = coalesce(nullif(s.theme_id, ''), 'emerald')
  and (s.theme_config is null or s.theme_config = '{}'::jsonb);


-- Storefront content and policy columns used by Merchant Settings / Checkout.
alter table public.stores
  add column if not exists font_id text default 'inter',
  add column if not exists show_hero boolean default true,
  add column if not exists show_featured boolean default true,
  add column if not exists show_about boolean default false,
  add column if not exists about_text text,
  add column if not exists hero_title text,
  add column if not exists hero_subtitle text,
  add column if not exists hero_banner_urls jsonb default '[]'::jsonb,
  add column if not exists about_title text,
  add column if not exists about_image_url text,
  add column if not exists about_mission text,
  add column if not exists offer_enabled boolean default true,
  add column if not exists offer_badge text,
  add column if not exists offer_title text,
  add column if not exists offer_subtitle text,
  add column if not exists offer_button_text text,
  add column if not exists offer_image_url text,
  add column if not exists return_policy text,
  add column if not exists shipping_policy text,
  add column if not exists payment_policy text,
  add column if not exists notification_prefs jsonb default '{}'::jsonb;

update public.stores
set
  hero_banner_urls=case
    when (hero_banner_urls is null or hero_banner_urls='[]'::jsonb)
      and coalesce(banner_url,'')<>'' then jsonb_build_array(banner_url)
    else coalesce(hero_banner_urls,'[]'::jsonb)
  end,
  return_policy=coalesce(
    return_policy,
    'Return or exchange requests must be discussed with the merchant within 3 days of delivery. Items should be unused and in original condition unless they arrived damaged or incorrect.'
  ),
  shipping_policy=coalesce(
    shipping_policy,
    'Delivery time and charge depend on destination, courier availability, and product type. Customers will see the final delivery charge before placing the order.'
  ),
  payment_policy=coalesce(
    payment_policy,
    'Cash on Delivery remains pending until collection. Mobile banking payments require a valid transaction ID and remain pending until merchant verification.'
  );

comment on column public.stores.return_policy is
  'Merchant-managed return/exchange policy displayed to customers.';
comment on column public.stores.shipping_policy is
  'Merchant-managed shipping/delivery policy displayed to customers.';
comment on column public.stores.payment_policy is
  'Merchant-managed payment policy displayed to customers.';

-- Exactly one platform theme may be marked as the default.
update public.platform_themes
set is_default=(slug='emerald')
where is_default=true or slug='emerald';

create unique index if not exists platform_themes_one_default_idx
  on public.platform_themes(is_default)
  where is_default=true;

alter table public.platform_themes enable row level security;

drop policy if exists "Public can read active platform themes"
  on public.platform_themes;
drop policy if exists "Prototype superadmin can manage themes"
  on public.platform_themes;
drop policy if exists platform_themes_authenticated_all
  on public.platform_themes;

create policy "Public can read active platform themes"
on public.platform_themes
for select
to anon,authenticated
using (is_active=true);

grant select on public.platform_themes to anon,authenticated;
revoke insert,update,delete on public.platform_themes from anon,authenticated;

create or replace function public.apply_store_theme(
  p_store_id uuid,
  p_theme_slug text,
  p_primary_color text default null,
  p_secondary_color text default null,
  p_accent_color text default null
)
returns public.stores
language plpgsql
security definer
set search_path=public
as $$
declare
  v_store public.stores;
  v_theme public.platform_themes;
  v_primary text;
  v_secondary text;
  v_accent text;
  v_config jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_store
  from public.stores
  where id=p_store_id
    and owner_id=auth.uid()
    and coalesce(account_status,'active')<>'deleted'
  for update;

  if not found then
    raise exception 'Store not found or not allowed';
  end if;

  select * into v_theme
  from public.platform_themes
  where slug=lower(trim(p_theme_slug))
    and is_active=true;

  if not found then
    raise exception 'Theme not found or inactive';
  end if;

  v_primary:=case
    when coalesce(p_primary_color,'')~'^#[0-9A-Fa-f]{6}$'
      then p_primary_color
    else v_theme.primary_color
  end;
  v_secondary:=case
    when coalesce(p_secondary_color,'')~'^#[0-9A-Fa-f]{6}$'
      then p_secondary_color
    else v_theme.secondary_color
  end;
  v_accent:=case
    when coalesce(p_accent_color,'')~'^#[0-9A-Fa-f]{6}$'
      then p_accent_color
    else v_theme.accent_color
  end;

  v_config:=coalesce(v_theme.config,'{}'::jsonb)
    || jsonb_build_object(
      'slug',v_theme.slug,
      'name',v_theme.name,
      'description',coalesce(v_theme.description,''),
      'primary_color',v_primary,
      'secondary_color',v_secondary,
      'accent_color',v_accent,
      'is_default',coalesce(v_theme.is_default,false),
      'applied_at',now()
    );

  update public.stores
  set
    theme_id=v_theme.slug,
    theme_name=v_theme.name,
    brand_color=v_primary,
    theme_config=v_config,
    theme_updated_at=now(),
    updated_at=now()
  where id=p_store_id
    and owner_id=auth.uid()
  returning * into v_store;

  return v_store;
end $$;

revoke all on function public.apply_store_theme(uuid,text,text,text,text)
  from public;
grant execute on function public.apply_store_theme(uuid,text,text,text,text)
  to authenticated;

-- Existing owner policy remains the main store update protection.
-- This compatibility policy is safe because ownership is checked.
drop policy if exists "Store owners can update own theme"
  on public.stores;
drop policy if exists "Store owners can update theme fields"
  on public.stores;
create policy "Store owners can update own theme"
on public.stores
for update to authenticated
using (owner_id=auth.uid())
with check (owner_id=auth.uid());

notify pgrst,'reload schema';

-- >>>>>>>>>>>>>>>>>>>>>>> END 0004_themes_policies.sql <<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>> BEGIN 0005_merchant_security_lifecycle.sql <<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- BazarHQ CURRENT MIGRATION 0005
-- Merchant profile, store lifecycle, limits, sessions and recovery codes
-- =============================================================================

create extension if not exists pgcrypto;

-- Merchant profile fields used by auth, onboarding and store switching.
alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists current_store_id uuid,
  add column if not exists plan_tier text default 'free',
  add column if not exists onboarding_progress jsonb default '{}'::jsonb,
  add column if not exists onboarding_step text,
  add column if not exists email_change_requested_at timestamptz,
  add column if not exists pending_email text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.profiles
set plan_tier='free'
where plan_tier is null
   or plan_tier not in ('free','pro','business','enterprise');

alter table public.profiles
  alter column plan_tier set default 'free';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='profiles_plan_tier_check'
      and conrelid='public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_plan_tier_check
      check (plan_tier in ('free','pro','business','enterprise'));
  end if;
end $$;

create unique index if not exists profiles_email_lower_uidx
  on public.profiles(lower(email))
  where email is not null;

-- Store status, onboarding and delayed cleanup.
alter table public.stores
  add column if not exists account_status text default 'active',
  add column if not exists suspended_reason text,
  add column if not exists suspended_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_scheduled_at timestamptz,
  add column if not exists permanently_deleted_at timestamptz,
  add column if not exists cleanup_status text default 'none',
  add column if not exists onboarding_progress jsonb default '{}'::jsonb,
  add column if not exists onboarding_step text,
  add column if not exists onboarding_completed boolean default false,
  add column if not exists low_stock_threshold integer default 5;

update public.stores
set account_status='active'
where account_status is null
   or account_status not in ('active','suspended','deleted');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='stores_account_status_check'
      and conrelid='public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_account_status_check
      check (account_status in ('active','suspended','deleted'));
  end if;
end $$;

create index if not exists stores_owner_status_idx
  on public.stores(owner_id,account_status);
create index if not exists stores_subdomain_public_status_idx
  on public.stores(subdomain,storefront_published,account_status);

-- Product fields used by current Merchant Products and storefront logic.
alter table public.products
  add column if not exists category text,
  add column if not exists tags text[] default '{}',
  add column if not exists has_variants boolean default false,
  add column if not exists variant_types jsonb default '[]'::jsonb,
  add column if not exists variants jsonb default '[]'::jsonb,
  add column if not exists low_stock_threshold integer default 5,
  add column if not exists image_provider text default 'supabase',
  add column if not exists image_metadata jsonb default '{}'::jsonb,
  add column if not exists average_rating numeric(3,2) default 0,
  add column if not exists rating_count integer default 0;

alter table public.stores
  add column if not exists categories text[] default '{}';

-- Keep JSON variant stock/status normalized.
create or replace function public.normalize_product_variants_stock()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_item jsonb;
  v_next jsonb:='[]'::jsonb;
  v_stock integer;
begin
  if new.variants is not null and jsonb_typeof(new.variants)='array' then
    for v_item in select * from jsonb_array_elements(new.variants)
    loop
      v_stock:=coalesce(nullif(v_item->>'stock','')::integer,0);
      if v_stock<=0 then
        v_item:=v_item || jsonb_build_object(
          'stock',0,'available',false,'status','unavailable'
        );
      else
        v_item:=v_item || jsonb_build_object(
          'available',true,
          'status',case
            when coalesce(v_item->>'status','')='unavailable' then 'available'
            else coalesce(nullif(v_item->>'status',''),'available')
          end
        );
      end if;
      v_next:=v_next || jsonb_build_array(v_item);
    end loop;
    new.variants:=v_next;
  end if;

  new.stock:=greatest(coalesce(new.stock,0),0);
  new.updated_at:=now();
  return new;
end $$;

drop trigger if exists products_normalize_variants_stock_tg on public.products;
create trigger products_normalize_variants_stock_tg
before insert or update of variants,stock on public.products
for each row execute function public.normalize_product_variants_stock();

-- Merchant session inventory and MFA recovery codes.
create table if not exists public.merchant_active_sessions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id) on delete cascade,
  session_fingerprint text not null,
  device_label text,
  user_agent text,
  ip_address text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(merchant_id,session_fingerprint)
);

create table if not exists public.merchant_mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique(merchant_id,code_hash)
);

create index if not exists merchant_sessions_merchant_idx
  on public.merchant_active_sessions(merchant_id,last_seen_at desc);
create index if not exists merchant_recovery_unused_idx
  on public.merchant_mfa_recovery_codes(merchant_id)
  where used_at is null;

-- One auth trigger handles merchant/customer role-specific profile creation.
create or replace function public.handle_new_bazarhq_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text:=lower(coalesce(new.raw_user_meta_data->>'role',''));
  v_name text:=nullif(
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    ),
    ''
  );
begin
  if v_role='merchant' then
    insert into public.profiles(
      id,email,full_name,plan_tier,created_at,updated_at
    )
    values(
      new.id,
      lower(new.email),
      coalesce(v_name,split_part(new.email,'@',1)),
      coalesce(nullif(new.raw_user_meta_data->>'plan_tier',''),'free'),
      coalesce(new.created_at,now()),
      now()
    )
    on conflict(id) do update set
      email=excluded.email,
      full_name=coalesce(public.profiles.full_name,excluded.full_name),
      plan_tier=coalesce(public.profiles.plan_tier,excluded.plan_tier,'free'),
      updated_at=now();
  elsif v_role='customer' then
    insert into public.customer_profiles(id,full_name,phone,account_status,updated_at)
    values(
      new.id,
      v_name,
      nullif(new.raw_user_meta_data->>'phone',''),
      'active',
      now()
    )
    on conflict(id) do update set
      full_name=coalesce(excluded.full_name,public.customer_profiles.full_name),
      phone=coalesce(excluded.phone,public.customer_profiles.phone),
      account_status='active',
      updated_at=now();
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_merchant_profile on auth.users;
drop trigger if exists on_auth_customer_created on auth.users;
drop trigger if exists on_auth_user_profile_sync_insert on auth.users;
drop trigger if exists on_auth_user_created_bazarhq on auth.users;
create trigger on_auth_user_created_bazarhq
after insert on auth.users
for each row execute function public.handle_new_bazarhq_user();

create or replace function public.sync_bazarhq_auth_email()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.profiles
  set email=lower(new.email),updated_at=now()
  where id=new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_profile_sync_update on auth.users;
drop trigger if exists on_auth_user_email_sync on auth.users;
create trigger on_auth_user_email_sync
after update of email on auth.users
for each row execute function public.sync_bazarhq_auth_email();

-- Backfill merchant profiles from current auth metadata.
insert into public.profiles(id,email,full_name,plan_tier,created_at,updated_at)
select
  u.id,
  lower(u.email),
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name',''),
    nullif(u.raw_user_meta_data->>'name',''),
    split_part(u.email,'@',1)
  ),
  coalesce(nullif(u.raw_user_meta_data->>'plan_tier',''),'free'),
  coalesce(u.created_at,now()),
  now()
from auth.users u
where lower(coalesce(u.raw_user_meta_data->>'role',''))='merchant'
on conflict(id) do update set
  email=excluded.email,
  full_name=coalesce(public.profiles.full_name,excluded.full_name),
  plan_tier=coalesce(public.profiles.plan_tier,excluded.plan_tier,'free'),
  updated_at=now();

-- Database-level free-plan store limit.
create or replace function public.enforce_free_plan_store_limit()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_plan text;
  v_count integer;
begin
  select coalesce(plan_tier,'free')
  into v_plan
  from public.profiles
  where id=new.owner_id;

  v_plan:=coalesce(v_plan,'free');

  if v_plan='free' and coalesce(new.account_status,'active')<>'deleted' then
    select count(*)
    into v_count
    from public.stores s
    where s.owner_id=new.owner_id
      and s.id<>coalesce(
        new.id,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
      and coalesce(s.account_status,'active')<>'deleted';

    if v_count>=1 then
      raise exception 'Free plan allows only one store per merchant account.'
        using errcode='P0001';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists stores_free_plan_limit_guard on public.stores;
create trigger stores_free_plan_limit_guard
before insert or update of owner_id,account_status
on public.stores
for each row execute function public.enforce_free_plan_store_limit();

create or replace function public.get_merchant_store_limit()
returns table(
  plan_tier text,
  store_count integer,
  store_limit integer,
  can_create boolean,
  existing_store_id uuid,
  existing_store_name text,
  existing_subdomain text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_plan text:='free';
  v_count integer:=0;
  v_limit integer:=1;
  v_store record;
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode='P0001';
  end if;

  select coalesce(p.plan_tier,'free')
  into v_plan
  from public.profiles p
  where p.id=v_uid;

  v_plan:=coalesce(v_plan,'free');
  v_limit:=case when v_plan='free' then 1 else 2147483647 end;

  select count(*) into v_count
  from public.stores s
  where s.owner_id=v_uid
    and coalesce(s.account_status,'active')<>'deleted';

  select s.id,s.shop_name,s.subdomain
  into v_store
  from public.stores s
  where s.owner_id=v_uid
    and coalesce(s.account_status,'active')<>'deleted'
  order by s.created_at
  limit 1;

  return query select
    v_plan,
    v_count,
    v_limit,
    v_count<v_limit,
    v_store.id,
    v_store.shop_name,
    v_store.subdomain;
end $$;

revoke all on function public.get_merchant_store_limit() from public;
grant execute on function public.get_merchant_store_limit()
  to authenticated;

-- Merchant self-delete is a reversible soft delete until scheduled cleanup.
create or replace function public.merchant_delete_store(p_store_id uuid)
returns table(
  id uuid,
  account_status text,
  storefront_published boolean,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode='P0001';
  end if;

  if not exists(
    select 1 from public.stores
    where stores.id=p_store_id
      and stores.owner_id=v_uid
  ) then
    raise exception 'Store not found or not allowed.' using errcode='P0001';
  end if;

  update public.stores
  set
    account_status='deleted',
    storefront_published=false,
    suspended_reason='Deleted by merchant from account settings.',
    deleted_at=now(),
    deletion_scheduled_at=now()+interval '30 days',
    cleanup_status='scheduled',
    updated_at=now()
  where stores.id=p_store_id
    and stores.owner_id=v_uid;

  update public.profiles
  set current_store_id=null,updated_at=now()
  where profiles.id=v_uid
    and profiles.current_store_id=p_store_id;

  insert into public.merchant_notifications(
    store_id,merchant_id,type,title,message,body,
    action_url,link_url,metadata,is_read
  )
  values(
    p_store_id,v_uid,'store_deleted_by_merchant',
    'Store deleted',
    'You deleted this store. The public storefront is unavailable.',
    'You deleted this store. The public storefront is unavailable.',
    '/merchant','/merchant',
    jsonb_build_object('store_id',p_store_id),
    false
  );

  return query
  select s.id,s.account_status,s.storefront_published,s.deleted_at
  from public.stores s
  where s.id=p_store_id;
end $$;

revoke all on function public.merchant_delete_store(uuid) from public;
grant execute on function public.merchant_delete_store(uuid)
  to authenticated;

create table if not exists public.deletion_cleanup_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid,
  owner_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.cleanup_deleted_stores_older_than_30_days()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_store record;
  v_cleaned integer:=0;
begin
  for v_store in
    select id,owner_id,shop_name,subdomain
    from public.stores
    where account_status='deleted'
      and deleted_at<now()-interval '30 days'
      and permanently_deleted_at is null
  loop
    update public.products
    set
      status='archived',
      images='{}',
      description=null,
      variants='[]'::jsonb,
      variant_types='[]'::jsonb,
      updated_at=now()
    where store_id=v_store.id;

    update public.stores
    set
      storefront_published=false,
      shop_name='[deleted store]',
      tagline=null,
      description=null,
      logo_url=null,
      banner_url=null,
      hero_banner_urls='[]'::jsonb,
      about_image_url=null,
      about_mission=null,
      contact_email=null,
      phone=null,
      whatsapp_number=null,
      website_url=null,
      address=null,
      cleanup_status='cleaned',
      permanently_deleted_at=now(),
      updated_at=now()
    where id=v_store.id;

    insert into public.deletion_cleanup_log(
      store_id,owner_id,action,details
    )
    values(
      v_store.id,
      v_store.owner_id,
      'store_cleanup_30_days',
      jsonb_build_object(
        'old_shop_name',v_store.shop_name,
        'old_subdomain',v_store.subdomain
      )
    );

    v_cleaned:=v_cleaned+1;
  end loop;

  return v_cleaned;
end $$;

revoke all on function public.cleanup_deleted_stores_older_than_30_days()
  from public;
grant execute on function public.cleanup_deleted_stores_older_than_30_days()
  to service_role;

-- Detach already deleted stores from current_store_id.
update public.profiles p
set current_store_id=null,updated_at=now()
where exists(
  select 1 from public.stores s
  where s.id=p.current_store_id
    and (
      coalesce(s.account_status,'active')='deleted'
      or s.deleted_at is not null
    )
);

notify pgrst,'reload schema';

-- >>>>>>>>>>>>>>>>>>>>>>> END 0005_merchant_security_lifecycle.sql <<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>> BEGIN 0006_superadmin_production.sql <<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- BazarHQ CURRENT MIGRATION 0006
-- Production Super Admin data model and privileged RPC support
-- =============================================================================
-- IMPORTANT:
--   Super Admin browser pages use custom admin sessions through Edge Functions.
--   Privileged RPCs below are granted to service_role only.
--   No hardcoded admin email, password, UUID or TOTP secret is included.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Admin identities, sessions, challenges and allowlist
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text,
  role text not null default 'full_access',
  is_active boolean not null default true,
  allowed_ips text[] not null default '{}',
  totp_enabled boolean not null default false,
  totp_secret text,
  totp_recovery_hashes jsonb not null default '[]'::jsonb,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  last_login_ip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users
  add column if not exists password_hash text,
  add column if not exists role text default 'full_access',
  add column if not exists is_active boolean default true,
  add column if not exists allowed_ips text[] default '{}',
  add column if not exists totp_enabled boolean default false,
  add column if not exists totp_secret text,
  add column if not exists totp_recovery_hashes jsonb default '[]'::jsonb,
  add column if not exists failed_attempts integer default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists last_login_ip text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists admin_users_email_lower_uidx
  on public.admin_users(lower(email));

create table if not exists public.admin_ip_allowlist (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  ip_value text not null,
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists admin_ip_allowlist_active_idx
  on public.admin_ip_allowlist(is_active);

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.admin_users(id) on delete cascade,
  token_hash text not null unique,
  ip_address text,
  user_agent text,
  expires_at timestamptz not null,
  idle_expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists admin_sessions_admin_idx
  on public.admin_sessions(admin_id,created_at desc);
create index if not exists admin_sessions_token_hash_idx
  on public.admin_sessions(token_hash);

create table if not exists public.admin_login_challenges (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.admin_users(id) on delete cascade,
  challenge_token_hash text not null unique,
  ip_address text,
  user_agent text,
  used_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Immutable audit log
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  admin_email text,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log
  add column if not exists admin_id uuid,
  add column if not exists admin_email text,
  add column if not exists action text,
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists details jsonb default '{}'::jsonb,
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists created_at timestamptz default now();

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_action_idx
  on public.admin_audit_log(action,created_at desc);
create index if not exists admin_audit_log_target_idx
  on public.admin_audit_log(target_type,target_id);

create or replace function public.prevent_admin_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  raise exception 'Admin audit logs are immutable';
end $$;

drop trigger if exists admin_audit_log_immutable_update
  on public.admin_audit_log;
create trigger admin_audit_log_immutable_update
before update or delete on public.admin_audit_log
for each row execute function public.prevent_admin_audit_mutation();

-- Drop prior callers before changing an older write_admin_audit return type.
drop function if exists public.request_admin_report(text,date,date,text,uuid,text);
drop function if exists public.send_platform_announcement(uuid);
drop function if exists public.send_platform_announcement(uuid,text);
drop function if exists public.submit_platform_content(uuid,text);
drop function if exists public.approve_platform_content(uuid,text);
drop function if exists public.publish_platform_content(uuid,text);
drop function if exists public.write_admin_audit(
  uuid,text,text,text,text,jsonb,text,text
);

create function public.write_admin_audit(
  p_admin_id uuid,
  p_admin_email text,
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_details jsonb default '{}'::jsonb,
  p_ip_address text default null,
  p_user_agent text default null
)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id text;
begin
  insert into public.admin_audit_log(
    admin_id,admin_email,action,target_type,target_id,
    details,ip_address,user_agent
  )
  values(
    p_admin_id,p_admin_email,p_action,p_target_type,p_target_id,
    coalesce(p_details,'{}'::jsonb),p_ip_address,p_user_agent
  )
  returning id::text into v_id;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Admin alert recipients and report jobs
-- ---------------------------------------------------------------------------
create table if not exists public.admin_alert_recipients (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  alert_failed_login boolean not null default true,
  alert_system_outage boolean not null default true,
  alert_reports boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.admin_alert_recipients(email)
select email
from public.admin_users
where email is not null
on conflict(email) do nothing;

create or replace function public.queue_admin_alert(
  p_subject text,
  p_body text,
  p_kind text default 'general'
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer:=0;
begin
  insert into public.email_notification_queue(
    recipient_email,to_email,subject,body
  )
  select
    r.email,r.email,p_subject,p_body
  from public.admin_alert_recipients r
  where r.is_active=true
    and (
      p_kind='general'
      or (p_kind='failed_login' and r.alert_failed_login=true)
      or (p_kind='system_outage' and r.alert_system_outage=true)
      or (p_kind='report' and r.alert_reports=true)
    );

  get diagnostics v_count=row_count;
  return v_count;
end $$;

create table if not exists public.admin_report_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid,
  requested_by_email text,
  report_type text not null default 'platform_analytics',
  date_from date,
  date_to date,
  status text not null default 'queued',
  result_csv text,
  result_url text,
  recipient_email text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  emailed_at timestamptz
);
create index if not exists admin_report_jobs_status_idx
  on public.admin_report_jobs(status,created_at);

create or replace function public.request_admin_report(
  p_report_type text,
  p_date_from date,
  p_date_to date,
  p_recipient_email text,
  p_admin_id uuid default null,
  p_admin_email text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  insert into public.admin_report_jobs(
    report_type,date_from,date_to,recipient_email,
    requested_by,requested_by_email
  )
  values(
    coalesce(nullif(p_report_type,''),'platform_analytics'),
    p_date_from,p_date_to,p_recipient_email,p_admin_id,p_admin_email
  )
  returning id into v_id;

  perform public.write_admin_audit(
    p_admin_id,p_admin_email,'report.queued',
    'admin_report_job',v_id::text,
    jsonb_build_object(
      'report_type',p_report_type,
      'date_from',p_date_from,
      'date_to',p_date_to
    )
  );

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Health log and incident model
-- ---------------------------------------------------------------------------
create table if not exists public.system_health_log (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  status text not null,
  response_ms integer,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

alter table public.system_health_log
  add column if not exists service text,
  add column if not exists status text,
  add column if not exists response_ms integer,
  add column if not exists message text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists checked_at timestamptz default now();

create index if not exists system_health_log_service_idx
  on public.system_health_log(service,checked_at desc);
create index if not exists system_health_log_checked_idx
  on public.system_health_log(checked_at desc);

create table if not exists public.system_incidents (
  id uuid primary key default gen_random_uuid(),
  service text,
  service_name text,
  title text,
  description text,
  message text,
  severity text not null default 'medium',
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by text,
  updated_at timestamptz not null default now()
);

alter table public.system_incidents
  add column if not exists service text,
  add column if not exists service_name text,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists message text,
  add column if not exists severity text default 'medium',
  add column if not exists status text default 'open',
  add column if not exists opened_at timestamptz default now(),
  add column if not exists created_at timestamptz default now(),
  add column if not exists resolved_at timestamptz,
  add column if not exists created_by text,
  add column if not exists updated_at timestamptz default now();

update public.system_incidents
set service=coalesce(service,service_name),
    service_name=coalesce(service_name,service),
    title=coalesce(title,upper(coalesce(status,'incident'))||': '||
      coalesce(service,service_name,'service')),
    description=coalesce(description,message),
    message=coalesce(message,description),
    opened_at=coalesce(opened_at,created_at,now()),
    created_at=coalesce(created_at,opened_at,now());

create or replace function public.sync_system_incident_columns()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.service:=coalesce(new.service,new.service_name);
  new.service_name:=coalesce(new.service_name,new.service);
  new.description:=coalesce(new.description,new.message);
  new.message:=coalesce(new.message,new.description);
  new.opened_at:=coalesce(new.opened_at,new.created_at,now());
  new.created_at:=coalesce(new.created_at,new.opened_at,now());
  new.updated_at:=now();
  return new;
end $$;

drop trigger if exists system_incidents_sync_tg
  on public.system_incidents;
create trigger system_incidents_sync_tg
before insert or update on public.system_incidents
for each row execute function public.sync_system_incident_columns();

create index if not exists system_incidents_status_idx
  on public.system_incidents(status,opened_at desc);

drop function if exists public.record_system_health(text,text,integer,text);
create function public.record_system_health(
  p_service_name text,
  p_status text,
  p_response_ms integer default null,
  p_message text default null
)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id text;
  v_incident uuid;
  v_normalized_status text:=lower(coalesce(p_status,'down'));
begin
  insert into public.system_health_log(
    service,status,response_ms,message
  )
  values(
    p_service_name,v_normalized_status,p_response_ms,p_message
  )
  returning id::text into v_id;

  if v_normalized_status in ('degraded','down','warning','critical') then
    select id into v_incident
    from public.system_incidents
    where coalesce(service,service_name)=p_service_name
      and status='open'
    order by opened_at desc
    limit 1;

    if v_incident is null then
      insert into public.system_incidents(
        service,service_name,title,description,message,severity,status
      )
      values(
        p_service_name,p_service_name,
        upper(v_normalized_status)||': '||p_service_name,
        p_message,p_message,
        case when v_normalized_status in ('down','critical')
          then 'critical' else 'high' end,
        'open'
      )
      returning id into v_incident;

      perform public.queue_admin_alert(
        'BazarHQ system alert: '||p_service_name,
        coalesce(p_message,v_normalized_status),
        'system_outage'
      );
    end if;
  elsif v_normalized_status in ('operational','healthy','up') then
    update public.system_incidents
    set status='resolved',resolved_at=now(),updated_at=now()
    where coalesce(service,service_name)=p_service_name
      and status='open';
  end if;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
create table if not exists public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all_merchants',
  priority text not null default 'normal',
  status text not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  locked_at timestamptz,
  cancelled_at timestamptz,
  recipient_count integer not null default 0,
  created_by text,
  sent_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_announcements
  add column if not exists audience text default 'all_merchants',
  add column if not exists priority text default 'normal',
  add column if not exists status text default 'draft',
  add column if not exists scheduled_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists recipient_count integer default 0,
  add column if not exists created_by text,
  add column if not exists sent_by text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists platform_announcements_status_idx
  on public.platform_announcements(status,scheduled_at);

create or replace function public.prevent_sent_announcement_mutation()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if old.status='sent' then
    raise exception 'Sent announcements cannot be edited, deleted, or recalled';
  end if;

  if tg_op='DELETE' then
    return old;
  end if;
  return new;
end $$;

drop trigger if exists platform_announcements_sent_lock_update
  on public.platform_announcements;
create trigger platform_announcements_sent_lock_update
before update or delete on public.platform_announcements
for each row execute function public.prevent_sent_announcement_mutation();

create function public.send_platform_announcement(
  p_announcement_id uuid,
  p_admin_email text default null
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_ann public.platform_announcements%rowtype;
  v_count integer:=0;
begin
  select * into v_ann
  from public.platform_announcements
  where id=p_announcement_id
  for update;

  if not found then
    raise exception 'Announcement not found';
  end if;
  if v_ann.status='sent' then
    raise exception 'Announcement already sent and locked';
  end if;
  if v_ann.status='cancelled' then
    raise exception 'Cancelled announcement cannot be sent';
  end if;

  insert into public.merchant_notifications(
    store_id,merchant_id,type,title,message,body,
    action_url,link_url,metadata,is_read
  )
  select
    s.id,s.owner_id,
    case when v_ann.priority='critical' then 'warning' else 'announcement' end,
    v_ann.title,v_ann.body,v_ann.body,
    '/merchant','/merchant',
    jsonb_build_object(
      'announcement_id',v_ann.id,
      'priority',v_ann.priority,
      'audience',v_ann.audience
    ),
    false
  from public.stores s
  where coalesce(s.account_status,'active')<>'deleted'
    and (
      v_ann.audience='all_merchants'
      or (
        v_ann.audience='active_merchants'
        and coalesce(s.account_status,'active')='active'
      )
      or (
        v_ann.audience='live_stores'
        and coalesce(s.storefront_published,false)=true
      )
    );

  get diagnostics v_count=row_count;

  insert into public.email_notification_queue(
    store_id,recipient_email,to_email,subject,body
  )
  select
    s.id,
    coalesce(p.email,s.contact_email),
    coalesce(p.email,s.contact_email),
    '[BazarHQ] '||v_ann.title,
    v_ann.body
  from public.stores s
  left join public.profiles p on p.id=s.owner_id
  where coalesce(s.account_status,'active')<>'deleted'
    and coalesce(p.email,s.contact_email) is not null;

  update public.platform_announcements
  set
    status='sent',
    sent_at=now(),
    locked_at=now(),
    sent_by=p_admin_email,
    recipient_count=v_count,
    updated_at=now()
  where id=p_announcement_id;

  perform public.write_admin_audit(
    null,p_admin_email,'announcement.sent',
    'platform_announcement',p_announcement_id::text,
    jsonb_build_object('recipient_count',v_count)
  );

  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Content / policy workflow with second-admin approval
-- ---------------------------------------------------------------------------
create table if not exists public.platform_content (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  title text,
  body text,
  pending_body text,
  status text not null default 'draft',
  version integer not null default 1,
  effective_at timestamptz,
  submitted_by text,
  submitted_at timestamptz,
  pending_by uuid,
  approved_by text,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_content
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists pending_body text,
  add column if not exists status text default 'draft',
  add column if not exists version integer default 1,
  add column if not exists effective_at timestamptz,
  add column if not exists submitted_by text,
  add column if not exists submitted_at timestamptz,
  add column if not exists pending_by uuid,
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists platform_content_type_uidx
  on public.platform_content(content_type);

insert into public.platform_content(
  content_type,title,body,status,version,published_at,effective_at
)
values
  (
    'terms','Terms of Service',
    'BazarHQ terms of service will be published here.',
    'published',1,now(),now()
  ),
  (
    'privacy','Privacy Policy',
    'BazarHQ privacy policy will be published here.',
    'published',1,now(),now()
  ),
  (
    'faq','Frequently Asked Questions',
    'BazarHQ frequently asked questions will be published here.',
    'published',1,now(),now()
  ),
  (
    'merchant_policy','Merchant Policy',
    'Merchants must provide accurate product, price and delivery information.',
    'published',1,now(),now()
  ),
  (
    'customer_policy','Customer Policy',
    'Final order placement requires an authenticated customer.',
    'published',1,now(),now()
  )
on conflict(content_type) do nothing;

create or replace function public.submit_platform_content(
  p_content_id uuid,
  p_admin_email text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.platform_content
  set
    status='pending_approval',
    submitted_by=p_admin_email,
    submitted_at=now(),
    updated_at=now()
  where id=p_content_id;

  if not found then
    raise exception 'Content not found';
  end if;

  perform public.write_admin_audit(
    null,p_admin_email,'content.submitted',
    'platform_content',p_content_id::text,'{}'::jsonb
  );
end $$;

create or replace function public.approve_platform_content(
  p_content_id uuid,
  p_admin_email text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_content public.platform_content%rowtype;
begin
  select * into v_content
  from public.platform_content
  where id=p_content_id
  for update;

  if not found then
    raise exception 'Content not found';
  end if;
  if v_content.status<>'pending_approval' then
    raise exception 'Only pending content can be approved';
  end if;
  if lower(coalesce(v_content.submitted_by,''))=
     lower(coalesce(p_admin_email,'')) then
    raise exception 'A second Super Admin must approve this policy';
  end if;

  update public.platform_content
  set
    status='approved',
    approved_by=p_admin_email,
    approved_at=now(),
    updated_at=now()
  where id=p_content_id;

  perform public.write_admin_audit(
    null,p_admin_email,'content.approved',
    'platform_content',p_content_id::text,'{}'::jsonb
  );
end $$;

create or replace function public.publish_platform_content(
  p_content_id uuid,
  p_admin_email text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_content public.platform_content%rowtype;
begin
  select * into v_content
  from public.platform_content
  where id=p_content_id
  for update;

  if not found then
    raise exception 'Content not found';
  end if;
  if v_content.status<>'approved' then
    raise exception 'Only approved content can be published';
  end if;

  update public.platform_content
  set
    body=coalesce(nullif(pending_body,''),body),
    pending_body=null,
    status='published',
    published_at=now(),
    effective_at=coalesce(effective_at,now()),
    version=coalesce(version,1)+1,
    updated_at=now()
  where id=p_content_id;

  perform public.write_admin_audit(
    null,p_admin_email,'content.published',
    'platform_content',p_content_id::text,'{}'::jsonb
  );
end $$;

-- ---------------------------------------------------------------------------
-- Store moderation RPC used by Super Admin Edge Functions
-- ---------------------------------------------------------------------------
drop trigger if exists stores_suspension_notice on public.stores;
drop function if exists public.store_suspension_notice_trigger();
drop function if exists public.superadmin_set_store_status(uuid,text,text);

create function public.superadmin_set_store_status(
  p_store_id uuid,
  p_action text,
  p_reason text default null
)
returns table(
  id uuid,
  account_status text,
  storefront_published boolean,
  suspended_reason text,
  suspended_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_owner_id uuid;
  v_title text;
  v_message text;
  v_email text;
begin
  if p_action not in ('suspend','reinstate','delete') then
    raise exception 'Invalid action';
  end if;
  if p_action='suspend' and coalesce(trim(p_reason),'')='' then
    raise exception 'Suspension reason is required';
  end if;

  select s.owner_id,coalesce(p.email,s.contact_email)
  into v_owner_id,v_email
  from public.stores s
  left join public.profiles p on p.id=s.owner_id
  where s.id=p_store_id;

  if v_owner_id is null then
    raise exception 'Store not found';
  end if;

  if p_action='suspend' then
    update public.stores
    set
      account_status='suspended',
      storefront_published=false,
      suspended_reason=trim(p_reason),
      suspended_at=now(),
      deleted_at=null,
      updated_at=now()
    where stores.id=p_store_id;

    v_title:='Your store has been suspended';
    v_message:='BazarHQ suspended your storefront. Reason: '||trim(p_reason);
  elsif p_action='reinstate' then
    update public.stores
    set
      account_status='active',
      suspended_reason=null,
      suspended_at=null,
      deleted_at=null,
      cleanup_status='none',
      updated_at=now()
    where stores.id=p_store_id;

    v_title:='Your store has been reinstated';
    v_message:='BazarHQ reinstated your store. You may publish it again.';
  else
    update public.stores
    set
      account_status='deleted',
      storefront_published=false,
      suspended_reason=coalesce(
        nullif(trim(p_reason),''),
        'Store deleted by BazarHQ.'
      ),
      suspended_at=now(),
      deleted_at=now(),
      deletion_scheduled_at=now()+interval '30 days',
      cleanup_status='scheduled',
      updated_at=now()
    where stores.id=p_store_id;

    v_title:='Your store has been deleted';
    v_message:='BazarHQ deleted this storefront. It is no longer public.';
  end if;

  insert into public.merchant_notifications(
    store_id,merchant_id,type,title,message,body,
    action_url,link_url,metadata,is_read
  )
  values(
    p_store_id,v_owner_id,'store_'||p_action,
    v_title,v_message,v_message,
    '/merchant/settings','/merchant/settings',
    jsonb_build_object(
      'store_id',p_store_id,
      'action',p_action,
      'reason',p_reason
    ),
    false
  );

  if v_email is not null then
    insert into public.email_notification_queue(
      store_id,recipient_email,to_email,subject,body
    )
    values(
      p_store_id,v_email,v_email,v_title,v_message
    );
  end if;

  return query
  select
    s.id,s.account_status,s.storefront_published,
    s.suspended_reason,s.suspended_at,s.deleted_at
  from public.stores s
  where s.id=p_store_id;
end $$;

-- ---------------------------------------------------------------------------
-- Lock private tables and privileged functions to service role.
-- ---------------------------------------------------------------------------
alter table public.admin_users enable row level security;
alter table public.admin_ip_allowlist enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.admin_login_challenges enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.admin_alert_recipients enable row level security;
alter table public.admin_report_jobs enable row level security;
alter table public.system_health_log enable row level security;
alter table public.system_incidents enable row level security;
alter table public.platform_announcements enable row level security;

revoke all on public.admin_users from anon,authenticated;
revoke all on public.admin_ip_allowlist from anon,authenticated;
revoke all on public.admin_sessions from anon,authenticated;
revoke all on public.admin_login_challenges from anon,authenticated;
revoke all on public.admin_audit_log from anon,authenticated;
revoke all on public.admin_alert_recipients from anon,authenticated;
revoke all on public.admin_report_jobs from anon,authenticated;
revoke all on public.system_health_log from anon,authenticated;
revoke all on public.system_incidents from anon,authenticated;
revoke all on public.platform_announcements from anon,authenticated;

revoke all on function public.write_admin_audit(
  uuid,text,text,text,text,jsonb,text,text
) from public;
revoke all on function public.queue_admin_alert(text,text,text) from public;
revoke all on function public.request_admin_report(
  text,date,date,text,uuid,text
) from public;
revoke all on function public.record_system_health(
  text,text,integer,text
) from public;
revoke all on function public.send_platform_announcement(uuid,text)
  from public;
revoke all on function public.submit_platform_content(uuid,text)
  from public;
revoke all on function public.approve_platform_content(uuid,text)
  from public;
revoke all on function public.publish_platform_content(uuid,text)
  from public;
revoke all on function public.superadmin_set_store_status(uuid,text,text)
  from public;

grant execute on function public.write_admin_audit(
  uuid,text,text,text,text,jsonb,text,text
) to service_role;
grant execute on function public.queue_admin_alert(text,text,text)
  to service_role;
grant execute on function public.request_admin_report(
  text,date,date,text,uuid,text
) to service_role;
grant execute on function public.record_system_health(
  text,text,integer,text
) to service_role;
grant execute on function public.send_platform_announcement(uuid,text)
  to service_role;
grant execute on function public.submit_platform_content(uuid,text)
  to service_role;
grant execute on function public.approve_platform_content(uuid,text)
  to service_role;
grant execute on function public.publish_platform_content(uuid,text)
  to service_role;
grant execute on function public.superadmin_set_store_status(uuid,text,text)
  to service_role;

notify pgrst,'reload schema';

-- >>>>>>>>>>>>>>>>>>>>>>> END 0006_superadmin_production.sql <<<<<<<<<<<<<<<<<<<<<<<

-- >>>>>>>>>>>>>>>>>>>>>> BEGIN 0007_rls_security.sql <<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- BazarHQ CURRENT MIGRATION 0007
-- Final Row Level Security and client grants
-- =============================================================================
-- This removes permissive prototype policies and aligns browser access with the
-- current Merchant, Customer and Edge-Function architecture.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Users manage own profile" on public.profiles;
drop policy if exists profiles_owner_all on public.profiles;

drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select
on public.profiles for select to authenticated
using (id=auth.uid());

drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert
on public.profiles for insert to authenticated
with check (id=auth.uid());

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update
on public.profiles for update to authenticated
using (id=auth.uid())
with check (id=auth.uid());

grant select,insert,update on public.profiles to authenticated;
revoke all on public.profiles from anon;

-- ---------------------------------------------------------------------------
-- Stores
-- ---------------------------------------------------------------------------
alter table public.stores enable row level security;

drop policy if exists "Owners manage own stores" on public.stores;
drop policy if exists "Anyone can view published stores" on public.stores;
drop policy if exists "Public can read active published storefront themes"
  on public.stores;
drop policy if exists "Store owners can update own theme"
  on public.stores;
drop policy if exists "Store owners can update theme fields"
  on public.stores;
drop policy if exists stores_owner_all on public.stores;
drop policy if exists stores_public_select on public.stores;

create policy stores_owner_all
on public.stores for all to authenticated
using (owner_id=auth.uid())
with check (owner_id=auth.uid());

drop policy if exists stores_public_select on public.stores;
create policy stores_public_select
on public.stores for select to anon,authenticated
using (
  coalesce(storefront_published,false)=true
  and coalesce(account_status,'active')='active'
);

grant select on public.stores to anon,authenticated;
grant insert,update,delete on public.stores to authenticated;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
alter table public.products enable row level security;

drop policy if exists "Owners manage own products" on public.products;
drop policy if exists "Anyone can view published products" on public.products;
drop policy if exists products_owner_all on public.products;
drop policy if exists products_public_select on public.products;

create policy products_owner_all
on public.products for all to authenticated
using (
  owner_id=auth.uid()
  or exists(
    select 1 from public.stores s
    where s.id=products.store_id
      and s.owner_id=auth.uid()
  )
)
with check (
  owner_id=auth.uid()
  and exists(
    select 1 from public.stores s
    where s.id=products.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists products_public_select on public.products;
create policy products_public_select
on public.products for select to anon,authenticated
using (
  status in ('published','active')
  and exists(
    select 1 from public.stores s
    where s.id=products.store_id
      and coalesce(s.storefront_published,false)=true
      and coalesce(s.account_status,'active')='active'
  )
);

grant select on public.products to anon,authenticated;
grant insert,update,delete on public.products to authenticated;

-- ---------------------------------------------------------------------------
-- Customer profiles and addresses
-- ---------------------------------------------------------------------------
alter table public.customer_profiles enable row level security;
alter table public.customer_addresses enable row level security;

drop policy if exists "Customers: view own profile"
  on public.customer_profiles;
drop policy if exists "Customers: insert own profile"
  on public.customer_profiles;
drop policy if exists "Customers: update own profile"
  on public.customer_profiles;
drop policy if exists "Customers: delete own profile"
  on public.customer_profiles;

drop policy if exists customer_profiles_own_select on public.customer_profiles;
create policy customer_profiles_own_select
on public.customer_profiles for select to authenticated
using (id=auth.uid());

drop policy if exists customer_profiles_own_insert on public.customer_profiles;
create policy customer_profiles_own_insert
on public.customer_profiles for insert to authenticated
with check (id=auth.uid());

drop policy if exists customer_profiles_own_update on public.customer_profiles;
create policy customer_profiles_own_update
on public.customer_profiles for update to authenticated
using (id=auth.uid())
with check (id=auth.uid());

drop policy if exists customer_profiles_own_delete on public.customer_profiles;
create policy customer_profiles_own_delete
on public.customer_profiles for delete to authenticated
using (id=auth.uid());

drop policy if exists "Customers: manage own addresses"
  on public.customer_addresses;
drop policy if exists "Customers: view own addresses"
  on public.customer_addresses;
drop policy if exists "Customers: insert own addresses"
  on public.customer_addresses;
drop policy if exists "Customers: update own addresses"
  on public.customer_addresses;
drop policy if exists "Customers: delete own addresses"
  on public.customer_addresses;

drop policy if exists customer_addresses_own_all on public.customer_addresses;
create policy customer_addresses_own_all
on public.customer_addresses for all to authenticated
using (customer_id=auth.uid())
with check (customer_id=auth.uid());

grant select,insert,update,delete
  on public.customer_profiles to authenticated;
grant select,insert,update,delete
  on public.customer_addresses to authenticated;
revoke all on public.customer_profiles from anon;
revoke all on public.customer_addresses from anon;

-- ---------------------------------------------------------------------------
-- Orders and timeline
-- ---------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_timeline enable row level security;

drop policy if exists "Store owners manage their orders" on public.orders;
drop policy if exists "Anyone can insert orders" on public.orders;
drop policy if exists "Customers can view their orders by phone" on public.orders;
drop policy if exists "Customers: view own orders by customer_id"
  on public.orders;
drop policy if exists orders_merchant_all on public.orders;
drop policy if exists orders_customer_select on public.orders;

create policy orders_merchant_all
on public.orders for all to authenticated
using (
  exists(
    select 1 from public.stores s
    where s.id=orders.store_id
      and s.owner_id=auth.uid()
  )
)
with check (
  exists(
    select 1 from public.stores s
    where s.id=orders.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists orders_customer_select on public.orders;
create policy orders_customer_select
on public.orders for select to authenticated
using (customer_id=auth.uid());

drop policy if exists "Anyone can view timeline"
  on public.order_timeline;
drop policy if exists "Anyone can insert timeline"
  on public.order_timeline;
drop policy if exists "Customers: view own order timeline"
  on public.order_timeline;
drop policy if exists "Merchants: manage own order timeline"
  on public.order_timeline;

drop policy if exists order_timeline_merchant_all on public.order_timeline;
create policy order_timeline_merchant_all
on public.order_timeline for all to authenticated
using (
  exists(
    select 1
    from public.orders o
    join public.stores s on s.id=o.store_id
    where o.id=order_timeline.order_id
      and s.owner_id=auth.uid()
  )
)
with check (
  exists(
    select 1
    from public.orders o
    join public.stores s on s.id=o.store_id
    where o.id=order_timeline.order_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists order_timeline_customer_select on public.order_timeline;
create policy order_timeline_customer_select
on public.order_timeline for select to authenticated
using (
  exists(
    select 1 from public.orders o
    where o.id=order_timeline.order_id
      and o.customer_id=auth.uid()
  )
);

revoke insert on public.orders from anon,authenticated;
revoke select,update,delete on public.orders from anon;
grant select,update,delete on public.orders to authenticated;
grant select,insert,update,delete
  on public.order_timeline to authenticated;
revoke all on public.order_timeline from anon;

-- ---------------------------------------------------------------------------
-- Reviews and coupons
-- ---------------------------------------------------------------------------
alter table public.product_reviews enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists "Public reads approved product reviews"
  on public.product_reviews;
drop policy if exists "Customers insert their own reviews"
  on public.product_reviews;

drop policy if exists product_reviews_public_select on public.product_reviews;
create policy product_reviews_public_select
on public.product_reviews for select to anon,authenticated
using (status='approved');

drop policy if exists product_reviews_customer_insert on public.product_reviews;
create policy product_reviews_customer_insert
on public.product_reviews for insert to authenticated
with check (customer_id=auth.uid());

drop policy if exists product_reviews_customer_update on public.product_reviews;
create policy product_reviews_customer_update
on public.product_reviews for update to authenticated
using (customer_id=auth.uid())
with check (customer_id=auth.uid());

drop policy if exists product_reviews_customer_delete on public.product_reviews;
create policy product_reviews_customer_delete
on public.product_reviews for delete to authenticated
using (customer_id=auth.uid());

drop policy if exists "Store owners manage coupons"
  on public.coupons;
drop policy if exists coupons_store_owner_all on public.coupons;
create policy coupons_store_owner_all
on public.coupons for all to authenticated
using (
  exists(
    select 1 from public.stores s
    where s.id=coupons.store_id
      and s.owner_id=auth.uid()
  )
)
with check (
  exists(
    select 1 from public.stores s
    where s.id=coupons.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists "Store owners read coupon redemptions"
  on public.coupon_redemptions;
drop policy if exists coupon_redemptions_owner_select on public.coupon_redemptions;
create policy coupon_redemptions_owner_select
on public.coupon_redemptions for select to authenticated
using (
  exists(
    select 1 from public.stores s
    where s.id=coupon_redemptions.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists coupon_redemptions_customer_select on public.coupon_redemptions;
create policy coupon_redemptions_customer_select
on public.coupon_redemptions for select to authenticated
using (customer_id=auth.uid());

grant select on public.product_reviews to anon,authenticated;
grant insert,update,delete on public.product_reviews to authenticated;
grant select,insert,update,delete on public.coupons to authenticated;
grant select on public.coupon_redemptions to authenticated;
revoke all on public.coupons from anon;
revoke all on public.coupon_redemptions from anon;

-- ---------------------------------------------------------------------------
-- Merchant notifications, analytics and security
-- ---------------------------------------------------------------------------
alter table public.merchant_notifications enable row level security;
alter table public.analytics_events enable row level security;
alter table public.merchant_active_sessions enable row level security;
alter table public.merchant_mfa_recovery_codes enable row level security;

drop policy if exists "Merchants can read own notifications"
  on public.merchant_notifications;
drop policy if exists "Merchants can update own notification read state"
  on public.merchant_notifications;

drop policy if exists merchant_notifications_owner_select on public.merchant_notifications;
create policy merchant_notifications_owner_select
on public.merchant_notifications for select to authenticated
using (
  merchant_id=auth.uid()
  or exists(
    select 1 from public.stores s
    where s.id=merchant_notifications.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists merchant_notifications_owner_update on public.merchant_notifications;
create policy merchant_notifications_owner_update
on public.merchant_notifications for update to authenticated
using (
  merchant_id=auth.uid()
  or exists(
    select 1 from public.stores s
    where s.id=merchant_notifications.store_id
      and s.owner_id=auth.uid()
  )
)
with check (
  merchant_id=auth.uid()
  or exists(
    select 1 from public.stores s
    where s.id=merchant_notifications.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists "Merchants can read own analytics"
  on public.analytics_events;
drop policy if exists analytics_events_owner_select on public.analytics_events;
create policy analytics_events_owner_select
on public.analytics_events for select to authenticated
using (
  exists(
    select 1 from public.stores s
    where s.id=analytics_events.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists merchant_sessions_own_all on public.merchant_active_sessions;
create policy merchant_sessions_own_all
on public.merchant_active_sessions for all to authenticated
using (merchant_id=auth.uid())
with check (merchant_id=auth.uid());

drop policy if exists merchant_recovery_codes_own_all on public.merchant_mfa_recovery_codes;
create policy merchant_recovery_codes_own_all
on public.merchant_mfa_recovery_codes for all to authenticated
using (merchant_id=auth.uid())
with check (merchant_id=auth.uid());

grant select on public.merchant_notifications to authenticated;
revoke update on public.merchant_notifications from authenticated;
grant update(is_read,read_at,updated_at)
  on public.merchant_notifications to authenticated;
revoke all on public.merchant_notifications from anon;

grant select on public.analytics_events to authenticated;
revoke insert,update,delete on public.analytics_events
  from anon,authenticated;

grant select,insert,update,delete
  on public.merchant_active_sessions to authenticated;
grant select,insert,update,delete
  on public.merchant_mfa_recovery_codes to authenticated;
revoke all on public.merchant_active_sessions from anon;
revoke all on public.merchant_mfa_recovery_codes from anon;

-- ---------------------------------------------------------------------------
-- Payment transaction visibility
-- ---------------------------------------------------------------------------
alter table public.payment_transactions enable row level security;

drop policy if exists payment_transactions_owner_select on public.payment_transactions;
create policy payment_transactions_owner_select
on public.payment_transactions for select to authenticated
using (
  exists(
    select 1 from public.stores s
    where s.id=payment_transactions.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists payment_transactions_customer_select on public.payment_transactions;
create policy payment_transactions_customer_select
on public.payment_transactions for select to authenticated
using (
  exists(
    select 1 from public.orders o
    where o.id=payment_transactions.order_id
      and o.customer_id=auth.uid()
  )
);

grant select on public.payment_transactions to authenticated;
revoke insert,update,delete
  on public.payment_transactions from anon,authenticated;
revoke all on public.payment_transactions from anon;

-- ---------------------------------------------------------------------------
-- Public platform content and themes
-- ---------------------------------------------------------------------------
alter table public.platform_themes enable row level security;
alter table public.platform_content enable row level security;

drop policy if exists "Public can read active platform themes"
  on public.platform_themes;
drop policy if exists "Prototype superadmin can manage themes"
  on public.platform_themes;
drop policy if exists platform_themes_authenticated_all
  on public.platform_themes;

drop policy if exists platform_themes_public_select on public.platform_themes;
create policy platform_themes_public_select
on public.platform_themes for select to anon,authenticated
using (is_active=true);

drop policy if exists platform_content_authenticated_all
  on public.platform_content;
drop policy if exists platform_content_public_select on public.platform_content;
create policy platform_content_public_select
on public.platform_content for select to anon,authenticated
using (status='published');

grant select on public.platform_themes to anon,authenticated;
grant select on public.platform_content to anon,authenticated;
revoke insert,update,delete
  on public.platform_themes from anon,authenticated;
revoke insert,update,delete
  on public.platform_content from anon,authenticated;

-- ---------------------------------------------------------------------------
-- Queues and admin support tables: Edge Functions/service_role only
-- ---------------------------------------------------------------------------
alter table public.email_notification_queue enable row level security;
alter table public.sms_notification_queue enable row level security;
alter table public.deletion_cleanup_log enable row level security;

revoke all on public.email_notification_queue from anon,authenticated;
revoke all on public.sms_notification_queue from anon,authenticated;
revoke all on public.deletion_cleanup_log from anon,authenticated;

-- Remove known prototype-wide policies.
drop policy if exists system_health_log_authenticated_all
  on public.system_health_log;
drop policy if exists system_incidents_authenticated_all
  on public.system_incidents;
drop policy if exists platform_announcements_authenticated_all
  on public.platform_announcements;
drop policy if exists admin_audit_log_authenticated_read
  on public.admin_audit_log;
drop policy if exists "Audit log: admins can insert"
  on public.admin_audit_log;
drop policy if exists "Audit log: admins can read"
  on public.admin_audit_log;

-- ---------------------------------------------------------------------------
-- Storage bucket and owner-path policies
-- Expected path: <auth.uid()>/<file-name>
-- ---------------------------------------------------------------------------
insert into storage.buckets(id,name,public)
values('shop-branding','shop-branding',true)
on conflict(id) do update set public=true;

drop policy if exists "Users can upload their own files"
  on storage.objects;
drop policy if exists "Public can view files"
  on storage.objects;
drop policy if exists "Users can update their own files"
  on storage.objects;
drop policy if exists "Users can delete their own files"
  on storage.objects;

drop policy if exists "Shop branding: owner upload" on storage.objects;
create policy "Shop branding: owner upload"
on storage.objects for insert to authenticated
with check (
  bucket_id='shop-branding'
  and auth.uid()::text=(storage.foldername(name))[1]
);

drop policy if exists "Shop branding: public read" on storage.objects;
create policy "Shop branding: public read"
on storage.objects for select to public
using (bucket_id='shop-branding');

drop policy if exists "Shop branding: owner update" on storage.objects;
create policy "Shop branding: owner update"
on storage.objects for update to authenticated
using (
  bucket_id='shop-branding'
  and auth.uid()::text=(storage.foldername(name))[1]
)
with check (
  bucket_id='shop-branding'
  and auth.uid()::text=(storage.foldername(name))[1]
);

drop policy if exists "Shop branding: owner delete" on storage.objects;
create policy "Shop branding: owner delete"
on storage.objects for delete to authenticated
using (
  bucket_id='shop-branding'
  and auth.uid()::text=(storage.foldername(name))[1]
);

notify pgrst,'reload schema';

-- >>>>>>>>>>>>>>>>>>>>>>> END 0007_rls_security.sql <<<<<<<<<<<<<<<<<<<<<<<
