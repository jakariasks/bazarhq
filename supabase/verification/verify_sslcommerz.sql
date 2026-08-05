begin;

alter table public.payment_configs
  add column if not exists is_live boolean not null default false;

comment on column public.payment_configs.is_live is
  'false = SSLCommerz sandbox, true = SSLCommerz live environment';

notify pgrst, 'reload schema';

commit;


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
where method in ('ssl', 'sslcommerz')
order by updated_at desc;