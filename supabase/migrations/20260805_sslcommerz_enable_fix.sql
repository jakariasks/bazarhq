-- BazarHQ — SSLCommerz credential verification / enable-state repair
-- Safe to run more than once.

begin;

alter table public.payment_configs
  add column if not exists is_live boolean not null default false,
  add column if not exists ssl_credentials_valid boolean not null default false,
  add column if not exists ssl_credentials_checked_at timestamptz,
  add column if not exists ssl_credentials_error text;

comment on column public.payment_configs.is_live is
  'false = SSLCommerz sandbox, true = SSLCommerz live';

-- Keep only the canonical method name used by checkout and Edge Functions.
-- If an older sslcommerz row exists and no ssl row exists, migrate it.
update public.payment_configs legacy
set method = 'ssl',
    updated_at = now()
where legacy.method = 'sslcommerz'
  and not exists (
    select 1
    from public.payment_configs canonical
    where canonical.store_id = legacy.store_id
      and canonical.method = 'ssl'
  );

-- If both aliases exist, the canonical ssl row remains authoritative and the
-- legacy row is disabled so it can never appear as a second checkout method.
update public.payment_configs
set enabled = false,
    ssl_credentials_valid = false,
    ssl_credentials_error = coalesce(ssl_credentials_error, 'Legacy SSLCommerz configuration. Revalidate the canonical SSL method.'),
    updated_at = now()
where method = 'sslcommerz';

notify pgrst, 'reload schema';
commit;
