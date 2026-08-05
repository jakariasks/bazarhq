-- =============================================================================
-- BazarHQ CURRENT SCHEMA VERIFICATION
-- Read-only checks. Run after migrations 0000-0007.
-- =============================================================================

-- 1) Required tables
with required(table_name) as (
  values
    ('profiles'),('stores'),('products'),('orders'),('order_timeline'),
    ('customer_profiles'),('customer_addresses'),('product_reviews'),
    ('coupons'),('coupon_redemptions'),('payment_configs'),
    ('payment_transactions'),('merchant_notifications'),
    ('merchant_active_sessions'),('merchant_mfa_recovery_codes'),
    ('analytics_events'),('email_notification_queue'),
    ('sms_notification_queue'),('platform_themes'),
    ('admin_users'),('admin_sessions'),('admin_login_challenges'),
    ('admin_ip_allowlist'),('admin_alert_recipients'),
    ('admin_audit_log'),('admin_report_jobs'),
    ('system_health_log'),('system_incidents'),
    ('platform_announcements'),('platform_content')
)
select
  r.table_name,
  case when t.table_name is null then 'MISSING' else 'OK' end as status
from required r
left join information_schema.tables t
  on t.table_schema='public'
 and t.table_name=r.table_name
order by status desc,r.table_name;

-- 2) Canonical compatibility columns
with required(table_name,column_name) as (
  values
    ('merchant_notifications','message'),
    ('merchant_notifications','body'),
    ('merchant_notifications','action_url'),
    ('merchant_notifications','link_url'),
    ('merchant_notifications','metadata'),
    ('merchant_notifications','data'),
    ('email_notification_queue','recipient_email'),
    ('email_notification_queue','to_email'),
    ('sms_notification_queue','recipient_phone'),
    ('sms_notification_queue','to_phone'),
    ('analytics_events','event_type'),
    ('analytics_events','event_name'),
    ('stores','theme_config'),
    ('stores','account_status'),
    ('orders','customer_id'),
    ('orders','txn_id'),
    ('orders','transaction_id')
)
select
  r.table_name,
  r.column_name,
  case when c.column_name is null then 'MISSING' else c.data_type end as result
from required r
left join information_schema.columns c
  on c.table_schema='public'
 and c.table_name=r.table_name
 and c.column_name=r.column_name
order by r.table_name,r.column_name;

-- 3) Current RPCs
with required(signature) as (
  values
    ('apply_store_theme'),
    ('cleanup_deleted_stores_older_than_30_days'),
    ('create_pending_order_reminders'),
    ('customer_can_review_product'),
    ('delete_customer_account'),
    ('get_merchant_store_limit'),
    ('get_public_order_tracking'),
    ('get_public_payment_methods'),
    ('merchant_delete_store'),
    ('place_customer_order_v2'),
    ('queue_admin_alert'),
    ('record_system_health'),
    ('request_admin_report'),
    ('send_platform_announcement'),
    ('submit_product_review'),
    ('superadmin_set_store_status'),
    ('track_analytics_event'),
    ('validate_coupon'),
    ('write_admin_audit')
)
select
  r.signature,
  case when exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname=r.signature
  ) then 'OK' else 'MISSING' end as status
from required r
order by status desc,r.signature;

-- 4) Duplicate active trigger families
select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation
from information_schema.triggers
where trigger_schema='public'
  and event_object_table in (
    'orders','products','merchant_notifications',
    'email_notification_queue','sms_notification_queue',
    'platform_announcements','stores'
  )
order by event_object_table,trigger_name,event_manipulation;

-- 5) Notification compatibility
select
  count(*) filter (
    where coalesce(message,body,'')=''
  ) as empty_notification_text,
  count(*) filter (
    where coalesce(action_url,link_url) is null
  ) as notifications_without_action,
  count(*) filter (
    where coalesce(is_read,false)=false and read_at is not null
  ) as inconsistent_read_state
from public.merchant_notifications;

-- 6) Theme default and store application
select
  count(*) filter(where is_default=true) as default_theme_count,
  count(*) filter(where is_active=true) as active_theme_count
from public.platform_themes;

select
  count(*) as stores_without_theme_config
from public.stores
where theme_config is null or theme_config='{}'::jsonb;

-- 7) Deleted store/current-store consistency
select
  count(*) as profiles_pointing_to_deleted_store
from public.profiles p
join public.stores s on s.id=p.current_store_id
where coalesce(s.account_status,'active')='deleted'
   or s.deleted_at is not null;

-- 8) Potentially unsafe public policies (review any returned rows)
select
  schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies
where schemaname='public'
  and tablename in (
    'admin_users','admin_sessions','admin_login_challenges',
    'admin_audit_log','admin_ip_allowlist','admin_report_jobs',
    'system_health_log','system_incidents','platform_announcements',
    'orders','email_notification_queue','sms_notification_queue'
  )
  and (
    roles::text ilike '%anon%'
    or coalesce(qual,'') in ('true','(true)')
    or coalesce(with_check,'') in ('true','(true)')
  )
order by tablename,policyname;

-- 9) Queue health
select status,count(*)
from public.email_notification_queue
group by status
order by status;

select status,count(*)
from public.sms_notification_queue
group by status
order by status;
