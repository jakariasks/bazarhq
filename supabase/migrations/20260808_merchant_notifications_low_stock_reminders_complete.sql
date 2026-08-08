-- =============================================================================
-- BazarHQ — Merchant Notifications, Low Stock & 48h Reminder Completion
-- Date: 2026-08-08
-- Completes scenario items M-06, M-07, M-08 and M-09.
-- =============================================================================

begin;

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- M-06: product-level threshold + variant-level threshold inheritance.
-- Variant overrides live inside products.variants[*].low_stock_threshold.
-- -----------------------------------------------------------------------------
alter table public.products
  add column if not exists low_stock_threshold integer default 5;

update public.products
set low_stock_threshold = greatest(coalesce(low_stock_threshold, 5), 0)
where low_stock_threshold is null or low_stock_threshold < 0;

alter table public.products
  drop constraint if exists products_low_stock_threshold_check;
alter table public.products
  add constraint products_low_stock_threshold_check
  check (low_stock_threshold >= 0);

-- -----------------------------------------------------------------------------
-- M-07 / M-08 / M-09: merchant preferences + durable queue metadata.
-- -----------------------------------------------------------------------------
create table if not exists public.merchant_notification_preferences (
  store_id uuid primary key references public.stores(id) on delete cascade,
  merchant_id uuid not null references auth.users(id) on delete cascade,
  new_order boolean not null default true,
  low_stock boolean not null default true,
  order_status boolean not null default true,
  pending_order_reminder boolean not null default true,
  weekly_report boolean not null default false,
  marketing boolean not null default false,
  dashboard_enabled boolean not null default true,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default true,
  sms_email_fallback boolean not null default true,
  recipient_email text,
  recipient_phone text,
  max_attempts integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.merchant_notification_preferences
  add column if not exists pending_order_reminder boolean default true;

alter table public.merchant_notification_preferences
  alter column sms_enabled set default true;

update public.merchant_notification_preferences
set pending_order_reminder = coalesce(pending_order_reminder, true)
where pending_order_reminder is null;

alter table public.merchant_notification_preferences enable row level security;
drop policy if exists merchant_notification_preferences_owner_all on public.merchant_notification_preferences;
create policy merchant_notification_preferences_owner_all
on public.merchant_notification_preferences for all to authenticated
using (
  merchant_id = auth.uid()
  and exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid())
)
with check (
  merchant_id = auth.uid()
  and exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid())
);
grant select,insert,update,delete on public.merchant_notification_preferences to authenticated;

create table if not exists public.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  queue_type text not null,
  queue_id uuid,
  notification_type text,
  recipient_masked text,
  status text not null,
  attempt integer not null default 0,
  provider text,
  provider_status integer,
  provider_message_id text,
  latency_ms bigint,
  fallback_used boolean not null default false,
  error_code text,
  error_message text,
  provider_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.notification_delivery_logs
  add column if not exists provider_status integer,
  add column if not exists provider_message_id text,
  add column if not exists latency_ms bigint,
  add column if not exists fallback_used boolean default false;

create index if not exists notification_delivery_logs_store_idx
  on public.notification_delivery_logs(store_id,created_at desc);

alter table public.notification_delivery_logs enable row level security;
drop policy if exists notification_delivery_logs_owner_select on public.notification_delivery_logs;
create policy notification_delivery_logs_owner_select
on public.notification_delivery_logs for select to authenticated
using (exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()));
grant select on public.notification_delivery_logs to authenticated;

-- Canonical durable queues. Existing installations receive only missing columns.
create table if not exists public.email_notification_queue (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  recipient_email text,
  to_email text,
  subject text not null default 'BazarHQ notification',
  body text not null default '',
  html text,
  notification_type text,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  priority smallint not null default 5,
  fallback_from_sms_id uuid,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  provider_response jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_notification_queue
  add column if not exists notification_type text,
  add column if not exists next_attempt_at timestamptz default now(),
  add column if not exists max_attempts integer default 5,
  add column if not exists priority smallint default 5,
  add column if not exists fallback_from_sms_id uuid,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists error_message text,
  add column if not exists updated_at timestamptz default now();

create table if not exists public.sms_notification_queue (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  recipient_phone text,
  to_phone text,
  message text not null default '',
  notification_type text,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  priority smallint not null default 5,
  fallback_email text,
  fallback_queued_at timestamptz,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  provider_response jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sms_notification_queue
  add column if not exists notification_type text,
  add column if not exists next_attempt_at timestamptz default now(),
  add column if not exists max_attempts integer default 5,
  add column if not exists priority smallint default 5,
  add column if not exists fallback_email text,
  add column if not exists fallback_queued_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists error_message text,
  add column if not exists updated_at timestamptz default now();

create index if not exists email_queue_retry_idx
  on public.email_notification_queue(status,next_attempt_at,priority,created_at)
  where status in ('pending','retry');
create index if not exists sms_queue_retry_idx
  on public.sms_notification_queue(status,next_attempt_at,priority,created_at)
  where status in ('pending','retry');
create unique index if not exists email_queue_sms_fallback_uidx
  on public.email_notification_queue(fallback_from_sms_id)
  where fallback_from_sms_id is not null;

-- Queue tables are backend-only.
alter table public.email_notification_queue enable row level security;
alter table public.sms_notification_queue enable row level security;
revoke all on public.email_notification_queue from anon,authenticated;
revoke all on public.sms_notification_queue from anon,authenticated;
grant select,insert,update,delete on public.email_notification_queue to service_role;
grant select,insert,update,delete on public.sms_notification_queue to service_role;

-- -----------------------------------------------------------------------------
-- Shared preference-aware merchant notification enqueuer.
-- -----------------------------------------------------------------------------
create or replace function public.enqueue_merchant_operational_notification(
  p_store_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_order_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_store public.stores%rowtype;
  v_pref public.merchant_notification_preferences%rowtype;
  v_email text;
  v_phone text;
  v_enabled boolean:=true;
  v_max_attempts integer:=5;
begin
  select * into v_store from public.stores where id=p_store_id;
  if not found then return; end if;

  select * into v_pref from public.merchant_notification_preferences where store_id=p_store_id;

  v_enabled := case lower(coalesce(p_type,''))
    when 'new_order' then coalesce(v_pref.new_order,true)
    when 'low_stock' then coalesce(v_pref.low_stock,true)
    when 'out_of_stock' then coalesce(v_pref.low_stock,true)
    when 'order_status' then coalesce(v_pref.order_status,true)
    when 'pending_order_reminder' then coalesce(v_pref.pending_order_reminder,true)
    else true
  end;
  if not v_enabled then return; end if;

  select coalesce(nullif(v_pref.recipient_email,''),u.email,nullif(v_store.contact_email,''))
  into v_email
  from auth.users u where u.id=v_store.owner_id limit 1;
  v_email:=coalesce(v_email,nullif(v_store.contact_email,''));
  v_phone:=coalesce(nullif(v_pref.recipient_phone,''),nullif(v_store.phone,''),nullif(v_store.whatsapp_number,''));
  v_max_attempts:=greatest(1,least(coalesce(v_pref.max_attempts,5),10));

  if coalesce(v_pref.dashboard_enabled,true) then
    insert into public.merchant_notifications
      (store_id,merchant_id,order_id,type,title,message,body,action_url,link_url,metadata,data)
    values(
      p_store_id,v_store.owner_id,p_order_id,p_type,p_title,p_body,p_body,
      case when p_type in ('low_stock','out_of_stock') then '/merchant/products' else '/merchant/orders' end,
      case when p_type in ('low_stock','out_of_stock') then '/merchant/products' else '/merchant/orders' end,
      coalesce(p_metadata,'{}'::jsonb),coalesce(p_metadata,'{}'::jsonb)
    );
  end if;

  if coalesce(v_pref.email_enabled,true) and nullif(v_email,'') is not null then
    insert into public.email_notification_queue
      (store_id,recipient_email,subject,body,notification_type,max_attempts,priority)
    values(p_store_id,v_email,p_title,p_body,'merchant_'||p_type,v_max_attempts,1);
  end if;

  -- If no preference row exists, SMS defaults ON for operational notifications.
  -- A merchant can explicitly switch SMS off in Settings.
  if coalesce(v_pref.sms_enabled,true) and nullif(v_phone,'') is not null then
    insert into public.sms_notification_queue
      (store_id,recipient_phone,message,notification_type,max_attempts,fallback_email,priority)
    values(
      p_store_id,v_phone,p_body,'merchant_'||p_type,v_max_attempts,
      case when coalesce(v_pref.sms_email_fallback,true) and not coalesce(v_pref.email_enabled,true) then v_email else null end,1
    );
  end if;
end $$;
revoke all on function public.enqueue_merchant_operational_notification(uuid,text,text,text,uuid,jsonb) from public;
grant execute on function public.enqueue_merchant_operational_notification(uuid,text,text,text,uuid,jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- M-07: new-order realtime + email + SMS, with customer confirmations preserved.
-- -----------------------------------------------------------------------------
create or replace function public.enqueue_new_order_notifications()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_store public.stores%rowtype;
  v_text text;
  v_url text;
begin
  select * into v_store from public.stores where id=new.store_id;
  if not found then return new; end if;

  v_text:='New order #'||coalesce(new.order_id,new.id::text)||' from '||coalesce(new.customer_name,'customer')||'. Total: ৳'||coalesce(new.total,0)::text||'.';
  perform public.enqueue_merchant_operational_notification(
    new.store_id,'new_order','New order received',v_text,new.id,
    jsonb_build_object('order_id',new.id,'public_order_id',new.order_id,'total',new.total,'queued_at',now())
  );

  v_url:='/track?store='||coalesce(v_store.subdomain,'')||'&order='||coalesce(new.order_id,new.id::text);
  if nullif(new.customer_email,'') is not null then
    insert into public.email_notification_queue
      (store_id,recipient_email,subject,body,notification_type,max_attempts,priority)
    values(
      new.store_id,new.customer_email,'Your BazarHQ order #'||coalesce(new.order_id,new.id::text),
      'Your order has been received. Total: ৳'||coalesce(new.total,0)::text||'. Track: '||v_url,
      'customer_order_confirmation',5,1
    );
  end if;
  if nullif(new.customer_phone,'') is not null then
    insert into public.sms_notification_queue
      (store_id,recipient_phone,message,notification_type,max_attempts,fallback_email,priority)
    values(
      new.store_id,new.customer_phone,
      'BazarHQ order '||coalesce(new.order_id,new.id::text)||' received. Total ৳'||coalesce(new.total,0)::text||'. Track: '||v_url,
      'customer_order_confirmation',5,null,1
    );
  end if;

  return new;
end $$;

drop trigger if exists trg_enqueue_new_order_notifications on public.orders;
drop trigger if exists orders_new_order_notifications_tg on public.orders;
create trigger orders_new_order_notifications_tg
after insert on public.orders
for each row execute function public.enqueue_new_order_notifications();

-- -----------------------------------------------------------------------------
-- M-06: product + variant-aware low-stock alerts.
-- Alert only on threshold crossing (or zero), not on every save below threshold.
-- -----------------------------------------------------------------------------
create or replace function public.enqueue_low_stock_notification()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_live_new boolean:=lower(coalesce(new.status,'draft')) in ('published','active');
  v_live_old boolean:=case when tg_op='UPDATE' then lower(coalesce(old.status,'draft')) in ('published','active') else false end;
  v_default_limit integer:=greatest(coalesce(new.low_stock_threshold,5),0);
  v_old_stock integer;
  v_item jsonb;
  v_old_item jsonb;
  v_variant_id text;
  v_label text;
  v_new_variant_stock integer;
  v_old_variant_stock integer;
  v_variant_limit integer;
  v_kind text;
  v_text text;
begin
  if not v_live_new then return new; end if;

  if coalesce(new.has_variants,false) and jsonb_typeof(coalesce(new.variants,'[]'::jsonb))='array' then
    for v_item in select * from jsonb_array_elements(coalesce(new.variants,'[]'::jsonb))
    loop
      v_variant_id:=coalesce(nullif(v_item->>'id',''),nullif(v_item->>'combo',''),nullif(v_item->>'label',''));
      v_label:=coalesce(nullif(v_item->>'label',''),nullif(v_item->>'combo',''),v_variant_id,'Variant');
      v_new_variant_stock:=case when coalesce(v_item->>'stock','')~'^[0-9]+$' then (v_item->>'stock')::integer else 0 end;
      v_variant_limit:=case
        when coalesce(v_item->>'low_stock_threshold','')~'^[0-9]+$' then (v_item->>'low_stock_threshold')::integer
        else v_default_limit end;

      v_old_variant_stock:=2147483647;
      if tg_op='UPDATE' and v_live_old and v_variant_id is not null then
        select elem into v_old_item
        from jsonb_array_elements(coalesce(old.variants,'[]'::jsonb)) elem
        where coalesce(nullif(elem->>'id',''),nullif(elem->>'combo',''),nullif(elem->>'label',''))=v_variant_id
        limit 1;
        if v_old_item is not null then
          v_old_variant_stock:=case when coalesce(v_old_item->>'stock','')~'^[0-9]+$' then (v_old_item->>'stock')::integer else 0 end;
        end if;
      end if;

      if (v_new_variant_stock=0 and v_old_variant_stock<>0)
         or (v_new_variant_stock>0 and v_new_variant_stock<=v_variant_limit and v_old_variant_stock>v_variant_limit) then
        v_kind:=case when v_new_variant_stock=0 then 'out_of_stock' else 'low_stock' end;
        v_text:=coalesce(new.title,'Product')||' — '||v_label||case
          when v_new_variant_stock=0 then ' is now out of stock.'
          else ' has only '||v_new_variant_stock||' unit(s) left (alert threshold '||v_variant_limit||').' end;
        perform public.enqueue_merchant_operational_notification(
          new.store_id,v_kind,
          case when v_kind='out_of_stock' then 'Variant out of stock' else 'Low stock alert' end,
          v_text,null,
          jsonb_build_object('product_id',new.id,'variant_id',v_variant_id,'variant',v_label,'stock',v_new_variant_stock,'threshold',v_variant_limit)
        );
      end if;
    end loop;
    return new;
  end if;

  v_old_stock:=case when tg_op='UPDATE' and v_live_old then coalesce(old.stock,2147483647) else 2147483647 end;
  if (coalesce(new.stock,0)=0 and v_old_stock<>0)
     or (coalesce(new.stock,0)>0 and coalesce(new.stock,0)<=v_default_limit and v_old_stock>v_default_limit) then
    v_kind:=case when coalesce(new.stock,0)=0 then 'out_of_stock' else 'low_stock' end;
    v_text:=coalesce(new.title,'Product')||case
      when coalesce(new.stock,0)=0 then ' is now out of stock.'
      else ' has only '||new.stock||' unit(s) left (alert threshold '||v_default_limit||').' end;
    perform public.enqueue_merchant_operational_notification(
      new.store_id,v_kind,
      case when v_kind='out_of_stock' then 'Product out of stock' else 'Low stock alert' end,
      v_text,null,
      jsonb_build_object('product_id',new.id,'stock',new.stock,'threshold',v_default_limit)
    );
  end if;

  return new;
end $$;

drop trigger if exists products_low_stock_notify_tg on public.products;
drop trigger if exists trg_enqueue_low_stock_notification_insert on public.products;
drop trigger if exists trg_enqueue_low_stock_notification_update on public.products;
drop trigger if exists products_low_stock_notifications_tg on public.products;
create trigger products_low_stock_notifications_tg
after insert or update of stock,variants,low_stock_threshold,status on public.products
for each row execute function public.enqueue_low_stock_notification();

-- -----------------------------------------------------------------------------
-- M-09: one durable reminder once an order remains Pending beyond 48 hours.
-- -----------------------------------------------------------------------------
alter table public.orders
  add column if not exists pending_reminder_queued_at timestamptz;

create index if not exists orders_pending_48h_idx
  on public.orders(created_at)
  where lower(coalesce(status,'pending'))='pending' and pending_reminder_queued_at is null;

create or replace function public.create_pending_order_reminders()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_count integer:=0;
  v_text text;
begin
  for v_order in
    select * from public.orders
    where lower(coalesce(status,'pending'))='pending'
      and created_at<=now()-interval '48 hours'
      and pending_reminder_queued_at is null
    order by created_at
    for update skip locked
  loop
    v_text:='Order #'||coalesce(v_order.order_id,v_order.id::text)||' has been Pending for more than 48 hours. Please review and confirm or cancel it.';
    perform public.enqueue_merchant_operational_notification(
      v_order.store_id,'pending_order_reminder','Pending order needs attention',v_text,v_order.id,
      jsonb_build_object('order_id',v_order.id,'public_order_id',v_order.order_id,'pending_since',v_order.created_at,'reminder_key','pending-48h-'||v_order.id::text)
    );
    update public.orders set pending_reminder_queued_at=now() where id=v_order.id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;
revoke all on function public.create_pending_order_reminders() from public;
grant execute on function public.create_pending_order_reminders() to service_role;

-- Realtime dashboard delivery remains instant.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(
       select 1 from pg_publication_tables
       where pubname='supabase_realtime' and schemaname='public' and tablename='merchant_notifications'
     ) then
    alter publication supabase_realtime add table public.merchant_notifications;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;

-- -----------------------------------------------------------------------------
-- Scheduler support.
-- Run configure_bazarhq_notification_scheduler() ONCE after deploying the two
-- Edge Functions and setting the same CRON_SECRET in Edge Function secrets.
-- The secret is stored only inside postgres cron.job, never exposed to clients.
-- -----------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.configure_bazarhq_notification_scheduler(
  p_functions_base_url text,
  p_cron_secret text
)
returns jsonb
language plpgsql
security definer
set search_path=public,cron,net
as $$
declare
  v_job record;
  v_base text:=rtrim(coalesce(p_functions_base_url,''),'/');
  v_processor_command text;
  v_reminder_command text;
begin
  if v_base !~ '^https://[a-z0-9.-]+$' then
    raise exception 'Provide a valid HTTPS functions base URL, e.g. https://PROJECT.supabase.co';
  end if;
  if length(coalesce(p_cron_secret,''))<24 then
    raise exception 'CRON secret must be at least 24 characters.';
  end if;

  for v_job in select jobid from cron.job where jobname in ('bazarhq-notification-processor','bazarhq-pending-order-reminders')
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  v_processor_command:=format(
    'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'',''application/json'',''x-cron-secret'',%L), body := ''{"reason":"scheduled_retry"}''::jsonb);',
    v_base||'/functions/v1/process-notification-queue',p_cron_secret
  );
  v_reminder_command:=format(
    'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'',''application/json'',''x-cron-secret'',%L), body := ''{"reason":"pending_48h"}''::jsonb);',
    v_base||'/functions/v1/run-pending-order-reminders',p_cron_secret
  );

  perform cron.schedule('bazarhq-notification-processor','* * * * *',v_processor_command);
  perform cron.schedule('bazarhq-pending-order-reminders','*/5 * * * *',v_reminder_command);

  return jsonb_build_object(
    'ok',true,
    'notification_processor','every minute',
    'pending_order_reminders','every 5 minutes'
  );
end $$;
revoke all on function public.configure_bazarhq_notification_scheduler(text,text) from public;
grant execute on function public.configure_bazarhq_notification_scheduler(text,text) to service_role;

-- Verification helpers
select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='products' and column_name='low_stock_threshold';

select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='orders' and column_name='pending_reminder_queued_at';
