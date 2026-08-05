-- BazarHQ Merchant System post-deployment verification
-- Run after the migration and Edge Function deployment.

-- 1) Required database objects. This block raises an error when anything is missing.
do $$
declare
  missing text[] := '{}';
  item text;
begin
  foreach item in array array[
    'public.merchant_notification_preferences',
    'public.notification_delivery_logs',
    'public.merchant_security_events',
    'public.payment_private_credentials',
    'public.reserved_store_subdomains'
  ] loop
    if to_regclass(item) is null then missing := array_append(missing,item); end if;
  end loop;

  foreach item in array array[
    'public.merchant_session_is_active()',
    'public.get_store_publish_readiness(uuid)',
    'public.set_storefront_published_guarded(uuid,boolean)',
    'public.get_merchant_deletion_readiness(uuid)',
    'public.merchant_delete_store(uuid)',
    'public.merchant_restore_deleted_store(uuid)',
    'public.cleanup_deleted_stores_older_than_30_days()',
    'public.get_merchant_analytics(uuid,timestamp with time zone,timestamp with time zone)'
  ] loop
    if to_regprocedure(item) is null then missing := array_append(missing,item); end if;
  end loop;

  if array_length(missing,1) is not null then
    raise exception 'Missing merchant-system objects: %', array_to_string(missing,', ');
  end if;
end $$;

-- 2) Required columns.
select table_name,column_name,data_type
from information_schema.columns
where table_schema='public' and (
  (table_name='profiles' and column_name in ('session_revoked_before','mfa_recovery_required')) or
  (table_name='merchant_active_sessions' and column_name in ('auth_session_id','browser_name','os_name','device_type','ip_address','access_expires_at','revoked_at')) or
  (table_name='payment_configs' and column_name in ('credential_last4','credential_valid','credential_error','credential_checked_at','is_live')) or
  (table_name='stores' and column_name in ('storefront_published','deletion_scheduled_at','permanently_deleted_at','cleanup_status'))
)
order by table_name,column_name;

-- 3) Payment configuration integrity. Every count should be 0.
select 'duplicate_store_method' check_name,count(*) violations
from (
  select store_id,case when method='sslcommerz' then 'ssl' else method end method,count(*)
  from public.payment_configs group by 1,2 having count(*)>1
) x
union all
select 'enabled_invalid_method',count(*) from public.payment_configs
where enabled=true and not (
  method='cod' or
  (method in ('bkash','nagad','rocket') and credential_valid=true and merchant_number~'^01[3-9][0-9]{8}$') or
  (method in ('ssl','sslcommerz') and ssl_credentials_valid=true)
)
union all
select 'plaintext_ssl_password',count(*) from public.payment_configs
where store_password is not null and length(trim(store_password))>0
union all
select 'live_store_without_payment',count(*)
from public.stores s
where coalesce(s.storefront_published,false)=true
  and not exists(
    select 1 from public.payment_configs p
    where p.store_id=s.id and p.enabled=true
      and (p.method='cod' or coalesce(p.credential_valid,false)=true or coalesce(p.ssl_credentials_valid,false)=true)
  );

-- 4) Browser roles must not read the private encrypted vault or full payment values.
select grantee,table_name,column_name,privilege_type
from information_schema.column_privileges
where table_schema='public'
  and table_name='payment_configs'
  and grantee in ('anon','authenticated')
  and column_name in ('store_password','merchant_number','ssl_store_id','store_id_key')
order by grantee,column_name;

select grantee,privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name='payment_private_credentials'
  and grantee in ('anon','authenticated');

-- 5) Realtime publication, triggers, and retry queues.
select pubname,schemaname,tablename
from pg_publication_tables
where pubname='supabase_realtime' and schemaname='public' and tablename='merchant_notifications';

select event_object_table,trigger_name,event_manipulation,action_timing
from information_schema.triggers
where trigger_schema='public' and trigger_name in (
  'orders_new_order_notifications_tg','orders_status_notifications_tg','products_low_stock_notifications_tg','payment_configs_validation_tg'
)
order by event_object_table,trigger_name;

select 'email_due' queue,count(*) jobs from public.email_notification_queue
where status in ('pending','retry') and next_attempt_at<=now()
union all
select 'sms_due',count(*) from public.sms_notification_queue
where status in ('pending','retry') and next_attempt_at<=now()
union all
select 'email_final_failures',count(*) from public.email_notification_queue where status='failed'
union all
select 'sms_final_failures',count(*) from public.sms_notification_queue where status='failed';

-- 6) Recent safe delivery logs and deleted-store cleanup state.
select queue_type,notification_type,status,attempt,recipient_masked,error_code,error_message,created_at
from public.notification_delivery_logs
order by created_at desc limit 20;

select id,shop_name,account_status,storefront_published,deleted_at,deletion_scheduled_at,cleanup_status,
  case when deletion_scheduled_at>now() then ceil(extract(epoch from (deletion_scheduled_at-now()))/86400) else 0 end days_remaining
from public.stores
where account_status='deleted' and permanently_deleted_at is null
order by deletion_scheduled_at;

-- 7) Analytics quality indicators. Review rather than expecting all zeros.
select
  count(*) total_events,
  count(*) filter(where session_id is null or trim(session_id)='') missing_session_ids,
  count(distinct session_id) unique_sessions,
  count(*) filter(where event_type='page_view') page_views,
  count(*) filter(where event_type='product_view') product_views,
  count(*) filter(where event_type='category_view') category_views
from public.analytics_events
where created_at>=now()-interval '30 days';

-- 8) Useful manual authenticated tests (run from the app, not service-role SQL Editor):
-- select public.get_store_publish_readiness('<STORE_UUID>');
-- select public.get_merchant_deletion_readiness('<STORE_UUID>');
-- select public.get_merchant_analytics('<STORE_UUID>',now()-interval '30 days',now());
