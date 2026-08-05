-- BazarHQ Merchant System Completion
-- MFA recovery, session revocation, publish readiness, lifecycle, notifications,
-- analytics aggregation/export support, and payment configuration hardening.

begin;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Merchant security and session registry
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists session_revoked_before timestamptz,
  add column if not exists mfa_recovery_required boolean not null default false;

alter table public.stores
  add column if not exists published_at timestamptz;

alter table public.merchant_active_sessions
  add column if not exists auth_session_id text,
  add column if not exists browser_name text,
  add column if not exists os_name text,
  add column if not exists device_type text,
  add column if not exists ip_address text,
  add column if not exists country_code text,
  add column if not exists access_expires_at timestamptz,
  add column if not exists revoked_by uuid,
  add column if not exists revocation_reason text,
  add column if not exists updated_at timestamptz not null default now();

update public.merchant_active_sessions
set auth_session_id=coalesce(nullif(auth_session_id,''),session_fingerprint),
    updated_at=coalesce(updated_at,last_seen_at,now())
where auth_session_id is null or auth_session_id='';

create unique index if not exists merchant_active_sessions_auth_sid_uidx
  on public.merchant_active_sessions(merchant_id,auth_session_id)
  where auth_session_id is not null;
create index if not exists merchant_active_sessions_active_idx
  on public.merchant_active_sessions(merchant_id,last_seen_at desc)
  where revoked_at is null;

alter table public.merchant_mfa_recovery_codes
  add column if not exists code_hint text,
  add column if not exists used_by_session_id text,
  add column if not exists invalidated_at timestamptz,
  add column if not exists generation_id uuid not null default gen_random_uuid();

create table if not exists public.merchant_security_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  auth_session_id text,
  ip_address text,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists merchant_security_events_merchant_idx
  on public.merchant_security_events(merchant_id,created_at desc);

create or replace function public.merchant_session_is_active()
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_sid text:=nullif(auth.jwt()->>'session_id','');
  v_iat timestamptz;
  v_revoked_before timestamptz;
begin
  if v_uid is null then return false; end if;

  -- Customer accounts do not have a merchant profile and are unaffected by this guard.
  if not exists(select 1 from public.profiles p where p.id=v_uid) then
    return true;
  end if;

  begin
    v_iat:=to_timestamp((auth.jwt()->>'iat')::double precision);
  exception when others then
    v_iat:=null;
  end;

  select p.session_revoked_before into v_revoked_before
  from public.profiles p where p.id=v_uid;

  if v_revoked_before is not null and (v_iat is null or v_iat<=v_revoked_before) then
    return false;
  end if;

  if v_sid is not null and exists(
    select 1 from public.merchant_active_sessions s
    where s.merchant_id=v_uid and s.auth_session_id=v_sid and s.revoked_at is not null
  ) then
    return false;
  end if;

  return true;
end $$;

revoke all on function public.merchant_session_is_active() from public;
grant execute on function public.merchant_session_is_active() to authenticated;

create or replace function public.merchant_mark_all_sessions_revoked()
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated.' using errcode='P0001'; end if;
  update public.profiles set session_revoked_before=now(),updated_at=now() where id=v_uid;
  update public.merchant_active_sessions
  set revoked_at=coalesce(revoked_at,now()),revoked_by=v_uid,
      revocation_reason=coalesce(revocation_reason,'All sessions revoked'),updated_at=now()
  where merchant_id=v_uid;
  insert into public.merchant_security_events(merchant_id,event_type,auth_session_id,details)
  values(v_uid,'all_sessions_revoked',auth.jwt()->>'session_id','{}'::jsonb);
end $$;
revoke all on function public.merchant_mark_all_sessions_revoked() from public;
grant execute on function public.merchant_mark_all_sessions_revoked() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Notification preferences, retry/fallback, and delivery logs
-- ---------------------------------------------------------------------------
create table if not exists public.merchant_notification_preferences (
  store_id uuid primary key references public.stores(id) on delete cascade,
  merchant_id uuid not null references auth.users(id) on delete cascade,
  new_order boolean not null default true,
  low_stock boolean not null default true,
  order_status boolean not null default true,
  weekly_report boolean not null default false,
  marketing boolean not null default false,
  dashboard_enabled boolean not null default true,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  sms_email_fallback boolean not null default true,
  recipient_email text,
  recipient_phone text,
  max_attempts integer not null default 5 check(max_attempts between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.merchant_notification_preferences enable row level security;
drop policy if exists merchant_notification_preferences_owner_all on public.merchant_notification_preferences;
create policy merchant_notification_preferences_owner_all
on public.merchant_notification_preferences for all to authenticated
using (
  merchant_id=auth.uid() and exists(
    select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()
  )
)
with check (
  merchant_id=auth.uid() and exists(
    select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()
  )
);
grant select,insert,update,delete on public.merchant_notification_preferences to authenticated;

create table if not exists public.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  queue_type text not null check(queue_type in ('email','sms')),
  queue_id uuid,
  notification_type text,
  recipient_masked text,
  status text not null,
  attempt integer not null default 0,
  provider text,
  error_code text,
  error_message text,
  provider_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists notification_delivery_logs_store_idx
  on public.notification_delivery_logs(store_id,created_at desc);
alter table public.notification_delivery_logs enable row level security;
drop policy if exists notification_delivery_logs_owner_select on public.notification_delivery_logs;
create policy notification_delivery_logs_owner_select
on public.notification_delivery_logs for select to authenticated
using (exists(select 1 from public.stores s where s.id=store_id and s.owner_id=auth.uid()));
grant select on public.notification_delivery_logs to authenticated;

alter table public.email_notification_queue
  add column if not exists notification_type text,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists max_attempts integer not null default 5,
  add column if not exists fallback_from_sms_id uuid,
  add column if not exists error_message text,
  add column if not exists updated_at timestamptz not null default now();
alter table public.sms_notification_queue
  add column if not exists notification_type text,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists max_attempts integer not null default 5,
  add column if not exists fallback_email text,
  add column if not exists fallback_queued_at timestamptz,
  add column if not exists error_message text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists email_queue_retry_idx
  on public.email_notification_queue(status,next_attempt_at,created_at)
  where status in ('pending','retry');
create index if not exists sms_queue_retry_idx
  on public.sms_notification_queue(status,next_attempt_at,created_at)
  where status in ('pending','retry');

create or replace function public.merchant_notification_pref_enabled(p_store_id uuid,p_type text)
returns boolean language sql stable security definer set search_path=public as $$
  select case lower(coalesce(p_type,''))
    when 'new_order' then coalesce(p.new_order,true)
    when 'low_stock' then coalesce(p.low_stock,true)
    when 'out_of_stock' then coalesce(p.low_stock,true)
    when 'order_status' then coalesce(p.order_status,true)
    when 'weekly_report' then coalesce(p.weekly_report,false)
    when 'marketing' then coalesce(p.marketing,false)
    else true end
  from public.stores s
  left join public.merchant_notification_preferences p on p.store_id=s.id
  where s.id=p_store_id;
$$;
revoke all on function public.merchant_notification_pref_enabled(uuid,text) from public;
grant execute on function public.merchant_notification_pref_enabled(uuid,text) to service_role,authenticated;


-- Preference-aware order and stock notification triggers.
create or replace function public.enqueue_new_order_notifications()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_store public.stores%rowtype; v_pref public.merchant_notification_preferences%rowtype;
  v_owner_email text; v_owner_phone text; v_url text; v_text text;
begin
  select * into v_store from public.stores where id=new.store_id;
  if not found then return new; end if;
  select * into v_pref from public.merchant_notification_preferences where store_id=new.store_id;
  select coalesce(v_pref.recipient_email,p.email,u.email,v_store.contact_email),
         coalesce(v_pref.recipient_phone,v_store.phone,v_store.whatsapp_number)
  into v_owner_email,v_owner_phone
  from auth.users u left join public.profiles p on p.id=u.id
  where u.id=v_store.owner_id limit 1;

  v_text:='Order #'||coalesce(new.order_id,new.id::text)||' was placed by '||coalesce(new.customer_name,'a customer')||'.';
  v_url:='/track?store='||coalesce(v_store.subdomain,'')||'&order='||coalesce(new.order_id,new.id::text);

  if coalesce(v_pref.new_order,true) and coalesce(v_pref.dashboard_enabled,true) then
    insert into public.merchant_notifications
      (store_id,merchant_id,order_id,type,title,message,body,action_url,link_url,metadata,data)
    values(new.store_id,v_store.owner_id,new.id,'new_order','New order received',v_text,v_text,
      '/merchant/orders','/merchant/orders',
      jsonb_build_object('order_id',new.id,'public_order_id',new.order_id,'total',new.total),
      jsonb_build_object('order_id',new.id,'public_order_id',new.order_id,'total',new.total));
  end if;

  if coalesce(v_pref.new_order,true) and coalesce(v_pref.email_enabled,true) and nullif(v_owner_email,'') is not null then
    insert into public.email_notification_queue(store_id,recipient_email,subject,body,notification_type,max_attempts)
    values(new.store_id,v_owner_email,'New BazarHQ order #'||coalesce(new.order_id,new.id::text),
      'You received a new order from '||coalesce(new.customer_name,'a customer')||'.',
      'merchant_new_order',coalesce(v_pref.max_attempts,5));
  end if;
  if coalesce(v_pref.new_order,true) and coalesce(v_pref.sms_enabled,false) and nullif(v_owner_phone,'') is not null then
    insert into public.sms_notification_queue(store_id,recipient_phone,message,notification_type,max_attempts,fallback_email)
    values(new.store_id,v_owner_phone,'New BazarHQ order '||coalesce(new.order_id,new.id::text)||' received.',
      'merchant_new_order',coalesce(v_pref.max_attempts,5),
      case when coalesce(v_pref.sms_email_fallback,true) then v_owner_email else null end);
  end if;

  -- Customer confirmations are business notifications and do not follow merchant preferences.
  if nullif(new.customer_email,'') is not null then
    insert into public.email_notification_queue(store_id,recipient_email,subject,body,notification_type)
    values(new.store_id,new.customer_email,'Your BazarHQ order #'||coalesce(new.order_id,new.id::text),
      'Your order has been received. Track it here: '||v_url,'customer_order_confirmation');
  end if;
  if nullif(new.customer_phone,'') is not null then
    insert into public.sms_notification_queue(store_id,recipient_phone,message,notification_type,fallback_email)
    values(new.store_id,new.customer_phone,'BazarHQ order '||coalesce(new.order_id,new.id::text)||' received. Track: '||v_url,
      'customer_order_confirmation',new.customer_email);
  end if;
  return new;
end $$;

drop trigger if exists orders_new_order_notifications_tg on public.orders;
create trigger orders_new_order_notifications_tg after insert on public.orders
for each row execute function public.enqueue_new_order_notifications();

create or replace function public.enqueue_order_status_notifications()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_store public.stores%rowtype; v_pref public.merchant_notification_preferences%rowtype;
  v_owner_email text; v_owner_phone text; v_url text; v_text text;
begin
  if old.status is not distinct from new.status then return new; end if;
  select * into v_store from public.stores where id=new.store_id;
  if not found then return new; end if;
  select * into v_pref from public.merchant_notification_preferences where store_id=new.store_id;
  select coalesce(v_pref.recipient_email,p.email,u.email,v_store.contact_email),
         coalesce(v_pref.recipient_phone,v_store.phone,v_store.whatsapp_number)
  into v_owner_email,v_owner_phone
  from auth.users u left join public.profiles p on p.id=u.id where u.id=v_store.owner_id limit 1;
  v_text:='Order #'||coalesce(new.order_id,new.id::text)||' changed to '||coalesce(new.status,'updated')||'.';
  v_url:='/track?store='||coalesce(v_store.subdomain,'')||'&order='||coalesce(new.order_id,new.id::text);

  if coalesce(v_pref.order_status,true) and coalesce(v_pref.dashboard_enabled,true) then
    insert into public.merchant_notifications(store_id,merchant_id,order_id,type,title,message,body,action_url,link_url,metadata,data)
    values(new.store_id,v_store.owner_id,new.id,'order_status','Order status updated',v_text,v_text,
      '/merchant/orders','/merchant/orders',jsonb_build_object('order_id',new.id,'status',new.status),jsonb_build_object('order_id',new.id,'status',new.status));
  end if;
  if coalesce(v_pref.order_status,true) and coalesce(v_pref.email_enabled,true) and nullif(v_owner_email,'') is not null then
    insert into public.email_notification_queue(store_id,recipient_email,subject,body,notification_type,max_attempts)
    values(new.store_id,v_owner_email,'Order #'||coalesce(new.order_id,new.id::text)||' changed to '||coalesce(new.status,''),
      v_text,'merchant_order_status',coalesce(v_pref.max_attempts,5));
  end if;
  if coalesce(v_pref.order_status,true) and coalesce(v_pref.sms_enabled,false) and nullif(v_owner_phone,'') is not null then
    insert into public.sms_notification_queue(store_id,recipient_phone,message,notification_type,max_attempts,fallback_email)
    values(new.store_id,v_owner_phone,v_text,'merchant_order_status',coalesce(v_pref.max_attempts,5),
      case when coalesce(v_pref.sms_email_fallback,true) then v_owner_email else null end);
  end if;

  if nullif(new.customer_email,'') is not null then
    insert into public.email_notification_queue(store_id,recipient_email,subject,body,notification_type)
    values(new.store_id,new.customer_email,'Order #'||coalesce(new.order_id,new.id::text)||' is now '||coalesce(new.status,''),
      'Your order status changed to '||coalesce(new.status,'')||'. Track: '||v_url,'customer_order_status');
  end if;
  if nullif(new.customer_phone,'') is not null then
    insert into public.sms_notification_queue(store_id,recipient_phone,message,notification_type,fallback_email)
    values(new.store_id,new.customer_phone,'BazarHQ order '||coalesce(new.order_id,new.id::text)||' status: '||coalesce(new.status,'')||'. Track: '||v_url,
      'customer_order_status',new.customer_email);
  end if;
  return new;
end $$;

drop trigger if exists orders_status_notifications_tg on public.orders;
create trigger orders_status_notifications_tg after update of status on public.orders
for each row execute function public.enqueue_order_status_notifications();

create or replace function public.enqueue_low_stock_notification()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_store public.stores%rowtype; v_pref public.merchant_notification_preferences%rowtype;
  v_limit integer:=coalesce(new.low_stock_threshold,5); v_old integer:=999999;
  v_text text; v_kind text; v_owner_email text; v_owner_phone text;
begin
  if tg_op='UPDATE' then v_old:=coalesce(old.stock,999999); end if;
  if not ((new.stock=0 and v_old<>0) or (new.stock>0 and new.stock<=v_limit and v_old>v_limit)) then return new; end if;
  select * into v_store from public.stores where id=new.store_id;
  if not found then return new; end if;
  select * into v_pref from public.merchant_notification_preferences where store_id=new.store_id;
  if not coalesce(v_pref.low_stock,true) then return new; end if;
  select coalesce(v_pref.recipient_email,p.email,u.email,v_store.contact_email),
         coalesce(v_pref.recipient_phone,v_store.phone,v_store.whatsapp_number)
  into v_owner_email,v_owner_phone
  from auth.users u left join public.profiles p on p.id=u.id where u.id=v_store.owner_id limit 1;

  if new.stock=0 then v_kind:='out_of_stock'; v_text:=coalesce(new.title,'A product')||' is now out of stock.';
  else v_kind:='low_stock'; v_text:=coalesce(new.title,'A product')||' has only '||new.stock||' unit(s) left.'; end if;

  if coalesce(v_pref.dashboard_enabled,true) then
    insert into public.merchant_notifications(store_id,merchant_id,type,title,message,body,action_url,link_url,metadata,data)
    values(new.store_id,v_store.owner_id,v_kind,case when v_kind='out_of_stock' then 'Out of stock' else 'Low stock alert' end,
      v_text,v_text,'/merchant/products','/merchant/products',jsonb_build_object('product_id',new.id,'stock',new.stock),jsonb_build_object('product_id',new.id,'stock',new.stock));
  end if;
  if coalesce(v_pref.email_enabled,true) and nullif(v_owner_email,'') is not null then
    insert into public.email_notification_queue(store_id,recipient_email,subject,body,notification_type,max_attempts)
    values(new.store_id,v_owner_email,case when v_kind='out_of_stock' then 'Product out of stock' else 'Low stock alert' end,
      v_text,v_kind,coalesce(v_pref.max_attempts,5));
  end if;
  if coalesce(v_pref.sms_enabled,false) and nullif(v_owner_phone,'') is not null then
    insert into public.sms_notification_queue(store_id,recipient_phone,message,notification_type,max_attempts,fallback_email)
    values(new.store_id,v_owner_phone,v_text,v_kind,coalesce(v_pref.max_attempts,5),
      case when coalesce(v_pref.sms_email_fallback,true) then v_owner_email else null end);
  end if;
  return new;
end $$;

drop trigger if exists products_low_stock_notifications_tg on public.products;
create trigger products_low_stock_notifications_tg after insert or update of stock on public.products
for each row execute function public.enqueue_low_stock_notification();

-- Realtime is used for instant dashboard badges and toasts.
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

-- Payment readiness fields are added early because publish-readiness functions reference them.
alter table public.payment_configs
  add column if not exists credential_last4 text,
  add column if not exists credential_valid boolean not null default false,
  add column if not exists credential_error text,
  add column if not exists credential_checked_at timestamptz,
  add column if not exists ssl_credentials_valid boolean not null default false,
  add column if not exists ssl_credentials_error text,
  add column if not exists ssl_credentials_checked_at timestamptz,
  add column if not exists is_live boolean not null default false;

-- Canonicalize legacy SSLCommerz method names without creating duplicate rows.
update public.payment_configs current_ssl
set enabled=coalesce(current_ssl.enabled,false) or coalesce(legacy.enabled,false),
    ssl_store_id=coalesce(nullif(current_ssl.ssl_store_id,''),legacy.ssl_store_id),
    store_id_key=coalesce(nullif(current_ssl.store_id_key,''),legacy.store_id_key),
    store_password=coalesce(nullif(current_ssl.store_password,''),legacy.store_password),
    is_live=coalesce(current_ssl.is_live,legacy.is_live,false),
    ssl_credentials_valid=coalesce(current_ssl.ssl_credentials_valid,false) or coalesce(legacy.ssl_credentials_valid,false),
    ssl_credentials_error=coalesce(current_ssl.ssl_credentials_error,legacy.ssl_credentials_error),
    ssl_credentials_checked_at=greatest(current_ssl.ssl_credentials_checked_at,legacy.ssl_credentials_checked_at),
    updated_at=now()
from public.payment_configs legacy
where current_ssl.store_id=legacy.store_id and current_ssl.method='ssl' and legacy.method='sslcommerz';

delete from public.payment_configs legacy
where legacy.method='sslcommerz'
  and exists(select 1 from public.payment_configs current_ssl where current_ssl.store_id=legacy.store_id and current_ssl.method='ssl');
update public.payment_configs set method='ssl',updated_at=now() where method='sslcommerz';

-- ---------------------------------------------------------------------------
-- 3. Store onboarding, publish readiness, and subdomain suggestions
-- ---------------------------------------------------------------------------
create table if not exists public.reserved_store_subdomains (
  slug text primary key,
  reason text not null,
  created_at timestamptz not null default now()
);
insert into public.reserved_store_subdomains(slug,reason) values
 ('www','Reserved for the main BazarHQ website.'),('api','Reserved for platform APIs.'),
 ('app','Reserved for the BazarHQ application.'),('admin','Reserved for administration.'),
 ('superadmin','Reserved for administration.'),('dashboard','Reserved for dashboards.'),
 ('shop','Reserved for storefront routing.'),('store','Reserved for storefront routing.'),
 ('checkout','Reserved for checkout.'),('auth','Reserved for authentication.'),
 ('login','Reserved for authentication.'),('signup','Reserved for authentication.'),
 ('support','Reserved for BazarHQ support.'),('help','Reserved for BazarHQ help.'),
 ('status','Reserved for service status.'),('bazarhq','Reserved platform name.')
on conflict(slug) do update set reason=excluded.reason;

drop function if exists public.suggest_store_subdomains(text,integer);
create function public.suggest_store_subdomains(p_base text,p_limit integer default 5)
returns table(slug text)
language sql
security definer
set search_path=public
as $$
  with base as (
    select left(
      case
        when length(trim(both '-' from regexp_replace(lower(regexp_replace(coalesce(p_base,''),'[^a-zA-Z0-9]+','-','g')),'-+','-','g')))<3 then 'my-shop'
        when trim(both '-' from regexp_replace(lower(regexp_replace(coalesce(p_base,''),'[^a-zA-Z0-9]+','-','g')),'-+','-','g'))~'^[0-9-]'
          then 'shop-'||trim(both '-' from regexp_replace(lower(regexp_replace(coalesce(p_base,''),'[^a-zA-Z0-9]+','-','g')),'-+','-','g'))
        else trim(both '-' from regexp_replace(lower(regexp_replace(coalesce(p_base,''),'[^a-zA-Z0-9]+','-','g')),'-+','-','g'))
      end,24
    ) b
  ), candidates as (
    select b as candidate,0 ord from base
    union all select left(b||'-shop',32),1 from base
    union all select left(b||'-bd',32),2 from base
    union all select left(b||'-online',32),3 from base
    union all select left(b||'-'||n::text,32),10+n from base cross join generate_series(1,30) n
  )
  select candidate
  from candidates c
  where candidate~'^[a-z][a-z0-9-]{2,31}$'
    and not exists(select 1 from public.stores s where lower(s.subdomain)=candidate)
    and not exists(select 1 from public.reserved_store_subdomains r where r.slug=candidate)
  order by ord
  limit greatest(1,least(coalesce(p_limit,5),10));
$$;
revoke all on function public.suggest_store_subdomains(text,integer) from public;
grant execute on function public.suggest_store_subdomains(text,integer) to anon,authenticated;

create or replace function public.get_store_publish_readiness(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid(); v_store public.stores%rowtype;
  v_products integer:=0; v_payments integer:=0;
  v_policies boolean:=false; v_ready boolean:=false;
begin
  if v_uid is null then raise exception 'Not authenticated.' using errcode='P0001'; end if;
  select * into v_store from public.stores where id=p_store_id and owner_id=v_uid;
  if not found then raise exception 'Store not found.' using errcode='P0001'; end if;

  select count(*) into v_products from public.products
  where store_id=p_store_id and status='published' and coalesce(stock,0)>=0;
  select count(*) into v_payments from public.payment_configs
  where store_id=p_store_id and enabled=true
    and (method<>'ssl' or coalesce(ssl_credentials_valid,false)=true);
  v_policies:=length(trim(coalesce(v_store.return_policy,'')))>=20
    and length(trim(coalesce(v_store.shipping_policy,'')))>=20
    and length(trim(coalesce(v_store.payment_policy,'')))>=20;
  v_ready:=coalesce(v_store.account_status,'active')='active'
    and nullif(trim(v_store.subdomain),'') is not null
    and v_products>0 and v_payments>0 and v_policies;

  return jsonb_build_object(
    'ready',v_ready,'account_active',coalesce(v_store.account_status,'active')='active',
    'has_subdomain',nullif(trim(v_store.subdomain),'') is not null,
    'published_products',v_products,'active_payment_methods',v_payments,
    'policies_complete',v_policies,'is_published',coalesce(v_store.storefront_published,false),
    'status',case when coalesce(v_store.storefront_published,false) then 'live' else 'draft' end
  );
end $$;
revoke all on function public.get_store_publish_readiness(uuid) from public;
grant execute on function public.get_store_publish_readiness(uuid) to authenticated;

create or replace function public.set_storefront_published_guarded(p_store_id uuid,p_publish boolean)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_uid uuid:=auth.uid(); v_ready jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated.' using errcode='P0001'; end if;
  if not exists(select 1 from public.stores where id=p_store_id and owner_id=v_uid) then
    raise exception 'Store not found.' using errcode='P0001';
  end if;
  v_ready:=public.get_store_publish_readiness(p_store_id);
  if p_publish and not coalesce((v_ready->>'ready')::boolean,false) then
    raise exception 'Complete subdomain, one published product, one valid payment method, and all store policies before publishing.' using errcode='P0001';
  end if;
  update public.stores set
    storefront_published=p_publish,
    published_at=case when p_publish then coalesce(published_at,now()) else published_at end,
    onboarding_completed=case when p_publish then true else onboarding_completed end,
    onboarding_step=case when p_publish then 'published' else onboarding_step end,
    updated_at=now()
  where id=p_store_id and owner_id=v_uid;
  return public.get_store_publish_readiness(p_store_id);
end $$;
revoke all on function public.set_storefront_published_guarded(uuid,boolean) from public;
grant execute on function public.set_storefront_published_guarded(uuid,boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Merchant deletion readiness, 30-day restoration, and cleanup
-- ---------------------------------------------------------------------------
create or replace function public.get_merchant_deletion_readiness(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_uid uuid:=auth.uid(); v_pending integer:=0; v_store public.stores%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated.' using errcode='P0001'; end if;
  select * into v_store from public.stores where id=p_store_id and owner_id=v_uid;
  if not found then raise exception 'Store not found.' using errcode='P0001'; end if;
  select count(*) into v_pending from public.orders
  where store_id=p_store_id and lower(coalesce(status,'pending')) in ('pending','confirmed','processing','shipped');
  return jsonb_build_object(
    'can_delete',v_pending=0,'pending_obligations',v_pending,
    'account_status',v_store.account_status,'deleted_at',v_store.deleted_at,
    'deletion_scheduled_at',v_store.deletion_scheduled_at,
    'can_restore',coalesce(v_store.account_status,'active')='deleted'
      and v_store.deletion_scheduled_at>now() and v_store.permanently_deleted_at is null
  );
end $$;
revoke all on function public.get_merchant_deletion_readiness(uuid) from public;
grant execute on function public.get_merchant_deletion_readiness(uuid) to authenticated;

drop function if exists public.merchant_delete_store(uuid);
create function public.merchant_delete_store(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_uid uuid:=auth.uid(); v_pending integer:=0; v_result jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated.' using errcode='P0001'; end if;
  if not exists(select 1 from public.stores where id=p_store_id and owner_id=v_uid) then
    raise exception 'Store not found or not allowed.' using errcode='P0001';
  end if;
  select count(*) into v_pending from public.orders
  where store_id=p_store_id and lower(coalesce(status,'pending')) in ('pending','confirmed','processing','shipped');
  if v_pending>0 then
    raise exception 'Complete or cancel % pending order obligation(s) before deleting this store.',v_pending using errcode='P0001';
  end if;
  update public.stores set account_status='deleted',storefront_published=false,
    deleted_at=now(),deletion_scheduled_at=now()+interval '30 days',
    cleanup_status='scheduled',suspended_reason='Deleted by merchant from account settings.',updated_at=now()
  where id=p_store_id and owner_id=v_uid;
  update public.profiles set current_store_id=null,updated_at=now()
  where id=v_uid and current_store_id=p_store_id;
  insert into public.merchant_security_events(merchant_id,event_type,auth_session_id,details)
  values(v_uid,'store_deletion_scheduled',auth.jwt()->>'session_id',jsonb_build_object('store_id',p_store_id,'cleanup_at',now()+interval '30 days'));
  v_result:=public.get_merchant_deletion_readiness(p_store_id);
  return v_result;
end $$;
revoke all on function public.merchant_delete_store(uuid) from public;
grant execute on function public.merchant_delete_store(uuid) to authenticated;

create or replace function public.merchant_restore_deleted_store(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated.' using errcode='P0001'; end if;
  if exists(
    select 1 from public.stores
    where owner_id=v_uid and id<>p_store_id and coalesce(account_status,'active')<>'deleted'
      and permanently_deleted_at is null
  ) then
    raise exception 'Free plan allows one active store. Delete the newer store before restoring this one.' using errcode='P0001';
  end if;
  update public.stores set account_status='active',storefront_published=false,
    deleted_at=null,deletion_scheduled_at=null,cleanup_status='none',suspended_reason=null,updated_at=now()
  where id=p_store_id and owner_id=v_uid and account_status='deleted'
    and deletion_scheduled_at>now() and permanently_deleted_at is null;
  if not found then raise exception 'Restore period expired or store is not restorable.' using errcode='P0001'; end if;
  update public.profiles set current_store_id=p_store_id,updated_at=now() where id=v_uid;
  insert into public.merchant_security_events(merchant_id,event_type,auth_session_id,details)
  values(v_uid,'store_deletion_cancelled',auth.jwt()->>'session_id',jsonb_build_object('store_id',p_store_id));
  return public.get_merchant_deletion_readiness(p_store_id);
end $$;
revoke all on function public.merchant_restore_deleted_store(uuid) from public;
grant execute on function public.merchant_restore_deleted_store(uuid) to authenticated;

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
declare v_store record; v_cleaned integer:=0;
begin
  for v_store in
    select id,owner_id,shop_name,subdomain from public.stores
    where account_status='deleted' and deletion_scheduled_at<=now() and permanently_deleted_at is null
    for update skip locked
  loop
    update public.products set status='archived',images='{}',description=null,
      variants='[]'::jsonb,variant_types='[]'::jsonb,updated_at=now()
    where store_id=v_store.id;
    update public.stores set storefront_published=false,shop_name='[deleted store]',tagline=null,
      description=null,logo_url=null,banner_url=null,hero_banner_urls='[]'::jsonb,
      about_image_url=null,about_mission=null,contact_email=null,phone=null,
      whatsapp_number=null,website_url=null,address=null,cleanup_status='cleaned',
      permanently_deleted_at=now(),updated_at=now()
    where id=v_store.id;
    insert into public.deletion_cleanup_log(store_id,owner_id,action,details)
    values(v_store.id,v_store.owner_id,'store_cleanup_30_days',jsonb_build_object('old_shop_name',v_store.shop_name,'old_subdomain',v_store.subdomain));
    v_cleaned:=v_cleaned+1;
  end loop;
  return v_cleaned;
end $$;
revoke all on function public.cleanup_deleted_stores_older_than_30_days() from public;
grant execute on function public.cleanup_deleted_stores_older_than_30_days() to service_role;

-- ---------------------------------------------------------------------------
-- 5. Merchant analytics aggregation and accuracy/performance indexes
-- ---------------------------------------------------------------------------
create index if not exists orders_store_created_status_idx
  on public.orders(store_id,created_at desc,status);
create index if not exists analytics_store_created_path_idx
  on public.analytics_events(store_id,created_at desc,path);
create index if not exists analytics_store_product_created_idx
  on public.analytics_events(store_id,product_id,created_at desc)
  where product_id is not null;

create or replace function public.get_merchant_analytics(
  p_store_id uuid,p_start timestamptz,p_end timestamptz
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_result jsonb;
  v_slug text;
begin
  if v_uid is null then raise exception 'Not authenticated.' using errcode='P0001'; end if;
  select subdomain into v_slug from public.stores where id=p_store_id and owner_id=v_uid;
  if not found then raise exception 'Store not found.' using errcode='P0001'; end if;
  if p_start is null or p_end is null or p_start>=p_end then
    raise exception 'Invalid analytics date range.' using errcode='22007';
  end if;
  if p_end-p_start>interval '5 years' then
    raise exception 'Analytics range cannot exceed five years.' using errcode='22007';
  end if;

  with order_rows as (
    select * from public.orders where store_id=p_store_id and created_at>=p_start and created_at<p_end
  ), valid_orders as (
    select * from order_rows where lower(coalesce(status,''))<>'cancelled'
  ), event_rows as (
    select *,coalesce(nullif(path,''),metadata->>'path','/') normalized_path
    from public.analytics_events where store_id=p_store_id and created_at>=p_start and created_at<p_end
  ), product_views as (
    select e.product_id,count(*) views,count(distinct e.session_id) unique_viewers
    from event_rows e where e.event_type='product_view' and e.product_id is not null group by e.product_id
  ), popular_pages as (
    select normalized_path path,count(*) views,count(distinct session_id) unique_visitors
    from event_rows where event_type='page_view' group by normalized_path order by views desc limit 20
  ), viewed_products as (
    select p.id product_id,p.title,pv.views,pv.unique_viewers
    from product_views pv join public.products p on p.id=pv.product_id
    order by pv.views desc,p.title asc limit 20
  )
  select jsonb_build_object(
    'generated_at',now(),'start',p_start,'end',p_end,
    'summary',jsonb_build_object(
      'revenue',coalesce((select sum(coalesce(total,0)) from valid_orders),0),
      'orders',coalesce((select count(*) from order_rows),0),
      'valid_orders',coalesce((select count(*) from valid_orders),0),
      'cancelled_orders',coalesce((select count(*) from order_rows where lower(coalesce(status,''))='cancelled'),0),
      'average_order_value',coalesce((select avg(coalesce(total,0)) from valid_orders),0),
      'unique_visitors',coalesce((select count(distinct session_id) from event_rows where session_id is not null),0),
      'product_views',coalesce((select count(*) from event_rows where event_type='product_view'),0),
      'homepage_visitors',coalesce((select count(distinct session_id) from event_rows where event_type='page_view' and (
        normalized_path=('/shop/'||v_slug) or normalized_path=('/shop/'||v_slug||'/') or metadata->>'page_type'='homepage'
      )),0),
      'category_visitors',coalesce((select count(distinct session_id) from event_rows where event_type='category_view' or metadata->>'page_type'='category'),0)
    ),
    'orders_by_status',coalesce((select jsonb_agg(jsonb_build_object('status',status,'count',count) order by count desc) from (select lower(coalesce(status,'unknown')) status,count(*) count from order_rows group by 1) x),'[]'::jsonb),
    'revenue_by_payment',coalesce((select jsonb_agg(jsonb_build_object('method',method,'revenue',revenue) order by revenue desc) from (select lower(coalesce(payment_method,'other')) method,sum(coalesce(total,0)) revenue from valid_orders group by 1) x),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(jsonb_build_object('date',day,'orders',orders,'revenue',coalesce(revenue,0)) order by day) from (select date_trunc('day',created_at)::date day,count(*) orders,sum(coalesce(total,0)) filter(where lower(coalesce(status,''))<>'cancelled') revenue from order_rows group by 1) x),'[]'::jsonb),
    'popular_pages',coalesce((select jsonb_agg(to_jsonb(popular_pages) order by views desc) from popular_pages),'[]'::jsonb),
    'top_viewed_products',coalesce((select jsonb_agg(jsonb_build_object('product_id',product_id,'title',title,'views',views,'unique_viewers',unique_viewers) order by views desc) from viewed_products),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.get_merchant_analytics(uuid,timestamptz,timestamptz) from public;
grant execute on function public.get_merchant_analytics(uuid,timestamptz,timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Payment configuration hardening
-- ---------------------------------------------------------------------------
alter table public.payment_configs
  add column if not exists credential_last4 text,
  add column if not exists credential_valid boolean not null default false,
  add column if not exists credential_error text,
  add column if not exists credential_checked_at timestamptz,
  add column if not exists ssl_credentials_valid boolean not null default false,
  add column if not exists ssl_credentials_error text,
  add column if not exists ssl_credentials_checked_at timestamptz,
  add column if not exists is_live boolean not null default false;

update public.payment_configs
set credential_last4=case
  when method in ('bkash','nagad','rocket') then right(regexp_replace(coalesce(merchant_number,''),'\D','','g'),4)
  when method='ssl' then right(coalesce(ssl_store_id,store_id_key,''),4)
  else null end,
  credential_valid=case
    when method='cod' then true
    when method in ('bkash','nagad','rocket') then regexp_replace(coalesce(merchant_number,''),'\D','','g')~'^01[3-9][0-9]{8}$'
    when method='ssl' then coalesce(ssl_credentials_valid,false)
    else false end;

create or replace function public.validate_payment_config_row()
returns trigger language plpgsql set search_path=public as $$
begin
  new.method:=case when new.method='sslcommerz' then 'ssl' else lower(new.method) end;
  if new.method in ('bkash','nagad','rocket') then
    new.merchant_number:=regexp_replace(coalesce(new.merchant_number,''),'\D','','g');
    if new.enabled and new.merchant_number!~'^01[3-9][0-9]{8}$' then
      raise exception 'Enter a valid Bangladesh mobile merchant number.' using errcode='23514';
    end if;
    new.credential_last4:=right(new.merchant_number,4);
    new.credential_valid:=new.merchant_number~'^01[3-9][0-9]{8}$';
    new.credential_error:=case when new.credential_valid then null else 'Invalid merchant number.' end;
  elsif new.method='cod' then
    new.credential_valid:=true; new.credential_error:=null; new.credential_last4:=null;
  elsif new.method='ssl' then
    new.credential_last4:=right(coalesce(new.ssl_store_id,new.store_id_key,''),4);
    new.credential_valid:=coalesce(new.ssl_credentials_valid,false);
    new.credential_error:=new.ssl_credentials_error;
    if new.enabled and not new.credential_valid then
      raise exception 'SSLCommerz must be verified before it can be enabled.' using errcode='23514';
    end if;
  end if;
  new.updated_at:=now();
  return new;
end $$;
drop trigger if exists payment_configs_validation_tg on public.payment_configs;
create trigger payment_configs_validation_tg before insert or update on public.payment_configs
for each row execute function public.validate_payment_config_row();

-- Checkout-safe projection: public shoppers receive only the mobile number needed
-- to pay; private SSL credentials are never returned.
create or replace function public.get_public_payment_methods(p_store_id uuid)
returns table(method text,label text,needs_txn boolean,merchant_number text)
language sql
security definer
set search_path=public
as $$
  select pc.method,
    case pc.method when 'bkash' then 'bKash' when 'nagad' then 'Nagad'
      when 'rocket' then 'Rocket' when 'ssl' then 'Online Payment'
      when 'cod' then 'Cash on Delivery' else pc.method end,
    pc.method in ('bkash','nagad','rocket'),
    case when pc.method in ('bkash','nagad','rocket') then pc.merchant_number else null end
  from public.payment_configs pc
  join public.stores s on s.id=pc.store_id
  where pc.store_id=p_store_id and pc.enabled=true
    and coalesce(s.account_status,'active')='active'
    and coalesce(s.storefront_published,false)=true
    and (
      pc.method='cod' or
      (pc.method in ('bkash','nagad','rocket') and coalesce(pc.credential_valid,false)=true) or
      (pc.method='ssl' and coalesce(pc.ssl_credentials_valid,false)=true)
    )
  order by case pc.method when 'cod' then 1 when 'bkash' then 2 when 'nagad' then 3 when 'rocket' then 4 when 'ssl' then 5 else 99 end;
$$;
revoke all on function public.get_public_payment_methods(uuid) from public;
grant execute on function public.get_public_payment_methods(uuid) to anon,authenticated;

create table if not exists public.payment_private_credentials (
  payment_config_id uuid primary key references public.payment_configs(id) on delete cascade,
  cipher_text text not null,
  iv text not null,
  algorithm text not null default 'AES-GCM-256',
  key_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payment_private_credentials enable row level security;
revoke all on public.payment_private_credentials from anon,authenticated;
grant all on public.payment_private_credentials to service_role;

-- Clear legacy browser-readable SSL passwords. Merchants re-enter them through the secure Edge Function.
update public.payment_configs
set store_password=null,enabled=false,ssl_credentials_valid=false,credential_valid=false,
    ssl_credentials_error=coalesce(ssl_credentials_error,'Re-enter credentials after the security upgrade.'),
    credential_error=coalesce(credential_error,'Re-enter credentials after the security upgrade.'),updated_at=now()
where method='ssl' and store_password is not null;

-- Owners can read only safe columns; all writes go through the server-side Edge Function.
revoke select,insert,update,delete on public.payment_configs from anon,authenticated;
grant select(id,store_id,method,enabled,is_live,
  credential_last4,credential_valid,credential_error,credential_checked_at,
  ssl_credentials_valid,ssl_credentials_error,ssl_credentials_checked_at,created_at,updated_at)
on public.payment_configs to authenticated;

-- Guard critical merchant data with the custom revoked-session registry.
do $$
declare t text;
begin
  foreach t in array array['profiles','stores','products','orders','payment_configs','analytics_events','merchant_notifications','merchant_active_sessions','merchant_mfa_recovery_codes','merchant_notification_preferences']
  loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists merchant_session_guard on public.%I',t);
      execute format('create policy merchant_session_guard on public.%I as restrictive for all to authenticated using (public.merchant_session_is_active()) with check (public.merchant_session_is_active())',t);
    end if;
  end loop;
end $$;

notify pgrst,'reload schema';
commit;
