-- Run after migration, function deployment, and one sandbox payment attempt.

-- 1) Credential validation state. Do not select store_password in screenshots/logs.
select
  store_id,
  method,
  enabled,
  is_live,
  ssl_credentials_valid,
  ssl_credentials_checked_at,
  ssl_credentials_error,
  right(coalesce(ssl_store_id, store_id_key, ''), 4) as store_id_last4
from public.payment_configs
where method='ssl'
order by updated_at desc;

-- 2) Latest gateway attempts.
select
  pt.created_at,
  pt.transaction_id,
  pt.status as gateway_status,
  pt.amount,
  pt.currency,
  o.order_id as public_order_id,
  o.payment_status,
  pt.error_message,
  pt.completed_at
from public.payment_transactions pt
left join public.orders o on o.id=pt.order_id
where pt.provider='sslcommerz'
order by pt.created_at desc
limit 20;

-- 3) A successful sandbox payment should have matching paid states.
select
  o.order_id,
  o.payment_method,
  o.payment_status,
  o.txn_id,
  exists(
    select 1 from public.order_timeline t
    where t.order_id=o.id and t.status='payment_confirmed'
  ) as has_payment_confirmed_timeline
from public.orders o
where o.payment_method='ssl'
order by o.created_at desc
limit 20;
