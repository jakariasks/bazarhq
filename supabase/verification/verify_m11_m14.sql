-- BazarHQ M-11 to M-14 verification (read-only)
-- Run after migration + Edge Function deployment + lifecycle scheduler setup.

with checks as (
  select 'M13 profile columns' check_name,
    (select count(*)=10 from information_schema.columns
      where table_schema='public' and table_name='profiles'
        and column_name in (
          'email','full_name','phone','avatar_url','current_store_id',
          'pending_email','email_change_requested_at','merchant_deletion_requested_at',
          'merchant_deleted_at','updated_at'
        )) passed
  union all
  select 'M13 auth-email sync trigger', exists(
    select 1 from information_schema.triggers
    where event_object_schema='auth' and event_object_table='users'
      and trigger_name='on_auth_user_email_sync'
  )
  union all
  select 'M11/M12 merchant analytics RPC', to_regprocedure('public.get_merchant_analytics(uuid,timestamp with time zone,timestamp with time zone)') is not null
  union all
  select 'M11 export reconciliation RPC', to_regprocedure('public.get_merchant_analytics_export_summary(uuid,uuid,timestamp with time zone,timestamp with time zone)') is not null
  union all
  select 'M12 analytics session index', to_regclass('public.analytics_events_store_created_session_idx') is not null
  union all
  select 'M12 analytics type index', to_regclass('public.analytics_events_store_created_type_idx') is not null
  union all
  select 'M14 readiness RPC', to_regprocedure('public.get_merchant_deletion_readiness(uuid)') is not null
  union all
  select 'M14 delete RPC', to_regprocedure('public.merchant_delete_store(uuid)') is not null
  union all
  select 'M14 restore RPC', to_regprocedure('public.merchant_restore_deleted_store(uuid)') is not null
  union all
  select 'M14 cleanup RPC', to_regprocedure('public.cleanup_deleted_stores_older_than_30_days()') is not null
  union all
  select 'M14 cleanup audit table', to_regclass('public.deletion_cleanup_log') is not null
  union all
  select 'M14 cleanup scheduler function', to_regprocedure('public.configure_bazarhq_merchant_lifecycle_scheduler(text,text)') is not null
)
select * from checks order by check_name;

-- Must be zero after the daily cleanup worker has run successfully.
select count(*) as overdue_deleted_stores_waiting_for_cleanup
from public.stores
where account_status='deleted'
  and permanently_deleted_at is null
  and deletion_scheduled_at is not null
  and deletion_scheduled_at<=now();

-- Scheduler status. Expected: one active row after configure_bazarhq_merchant_lifecycle_scheduler(...).
select jobid,jobname,schedule,active
from cron.job
where jobname='bazarhq-deleted-merchant-cleanup';

-- Confirm the two key analytics correctness rules are present in the live RPC definition.
select
  position('cancelled' in lower(pg_get_functiondef('public.get_merchant_analytics(uuid,timestamp with time zone,timestamp with time zone)'::regprocedure)))>0 as cancelled_handling_present,
  position('count(distinct session_id)' in lower(pg_get_functiondef('public.get_merchant_analytics(uuid,timestamp with time zone,timestamp with time zone)'::regprocedure)))>0 as distinct_session_rule_present;
