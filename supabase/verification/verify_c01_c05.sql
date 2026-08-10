-- BazarHQ C-01–C-05 structural verification
-- Run after 20260809_customer_variants_order_confirmation_complete.sql.

select
  to_regprocedure('public.get_my_order_confirmation_delivery_status(text)') is not null
    as has_customer_delivery_status_rpc,
  to_regprocedure('public.enqueue_new_order_notifications()') is not null
    as has_order_notification_trigger_function,
  to_regprocedure('public.enrich_order_variant_items()') is not null
    as has_variant_item_enricher;

select
  exists (
    select 1
    from pg_trigger
    where tgname = 'orders_new_order_notifications_tg'
      and not tgisinternal
  ) as has_new_order_confirmation_trigger,
  exists (
    select 1
    from pg_trigger
    where tgname = 'orders_enrich_variant_items_tg'
      and not tgisinternal
  ) as has_variant_enrichment_trigger;

select
  table_name,
  column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'orders',
    'sms_notification_queue',
    'email_notification_queue',
    'notification_delivery_logs'
  )
  and column_name in (
    'customer_confirmation_queued_at',
    'order_id',
    'dedupe_key'
  )
order by table_name, column_name;

-- After placing a real test order, authenticate as that customer and run:
-- select public.get_my_order_confirmation_delivery_status('YOUR_PUBLIC_ORDER_ID');
--
-- A successful production acceptance has:
--   sms.status = 'sent'
--   sms.within_30_seconds = true
-- and, if the customer's order email matches their verified Auth email:
--   email.status = 'sent'
--   email.within_30_seconds = true
