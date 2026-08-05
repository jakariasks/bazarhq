-- =============================================================================
-- BazarHQ — Complete SSLCommerz integration hardening
-- Apply after the current 0000-0007 migration pack.
-- =============================================================================

begin;

alter table public.payment_configs
  add column if not exists ssl_credentials_valid boolean not null default false,
  add column if not exists ssl_credentials_checked_at timestamptz,
  add column if not exists ssl_credentials_error text;

-- Existing credentials must be revalidated through the Edge Function before
-- SSLCommerz is exposed to public checkout.
update public.payment_configs
set enabled = false,
    ssl_credentials_valid = false,
    ssl_credentials_error = case
      when nullif(trim(coalesce(ssl_store_id, store_id_key, '')), '') is null
        or nullif(trim(coalesce(store_password, '')), '') is null
      then 'Credentials are incomplete.'
      else 'Revalidation required after SSLCommerz security upgrade.'
    end
where method in ('ssl', 'sslcommerz')
  and ssl_credentials_checked_at is null;

-- Checkout-safe projection. Secret values are never returned. SSLCommerz is
-- returned only after server-side credential validation succeeds.
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
      when 'ssl' then 'SSLCommerz Secure Payment'
      when 'cod' then 'Cash on Delivery'
      else pc.method
    end,
    pc.method in ('bkash','nagad','rocket'),
    case when pc.method in ('bkash','nagad','rocket') then pc.merchant_number else null end
  from public.payment_configs pc
  join public.stores s on s.id=pc.store_id
  where pc.store_id=p_store_id
    and pc.enabled=true
    and coalesce(s.account_status,'active')='active'
    and coalesce(s.storefront_published,false)=true
    and (
      pc.method <> 'ssl'
      or (
        pc.ssl_credentials_valid=true
        and nullif(trim(coalesce(pc.ssl_store_id,pc.store_id_key,'')),'') is not null
        and nullif(trim(coalesce(pc.store_password,'')),'') is not null
      )
    )
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
grant execute on function public.get_public_payment_methods(uuid) to anon,authenticated;

-- Useful indexes for callback/idempotency lookup.
create index if not exists payment_transactions_provider_txn_created_idx
  on public.payment_transactions(provider,transaction_id,created_at desc)
  where transaction_id is not null;

create index if not exists order_timeline_order_status_idx
  on public.order_timeline(order_id,status);

notify pgrst,'reload schema';
commit;
