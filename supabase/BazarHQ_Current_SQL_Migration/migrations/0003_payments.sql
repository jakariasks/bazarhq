-- =============================================================================
-- BazarHQ CURRENT MIGRATION 0003
-- Merchant payment methods and SSLCommerz transaction support
-- =============================================================================
-- Canonical method values: bkash, nagad, rocket, ssl, cod.
-- Secrets are never returned by the public checkout RPC.
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.payment_configs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  method text not null,
  enabled boolean not null default false,
  merchant_number text,
  ssl_store_id text,
  store_id_key text,
  store_password text,
  is_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_configs
  add column if not exists enabled boolean default false,
  add column if not exists merchant_number text,
  add column if not exists ssl_store_id text,
  add column if not exists store_id_key text,
  add column if not exists store_password text,
  add column if not exists is_live boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Keep the old store_id_key name compatible with current ssl_store_id.
update public.payment_configs
set ssl_store_id=coalesce(ssl_store_id,store_id_key),
    store_id_key=coalesce(store_id_key,ssl_store_id),
    enabled=coalesce(enabled,false),
    is_live=coalesce(is_live,false),
    updated_at=coalesce(updated_at,now());

create or replace function public.sync_payment_config_columns()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.ssl_store_id:=coalesce(new.ssl_store_id,new.store_id_key);
  new.store_id_key:=coalesce(new.store_id_key,new.ssl_store_id);
  new.updated_at:=now();
  return new;
end $$;

drop trigger if exists payment_configs_touch_updated_at on public.payment_configs;
drop trigger if exists payment_configs_sync_columns_tg on public.payment_configs;
create trigger payment_configs_sync_columns_tg
before insert or update on public.payment_configs
for each row execute function public.sync_payment_config_columns();

-- Normalize the former sslcommerz method name without creating duplicates.
delete from public.payment_configs old_pc
using public.payment_configs canonical_pc
where old_pc.store_id=canonical_pc.store_id
  and old_pc.method='sslcommerz'
  and canonical_pc.method='ssl';

update public.payment_configs
set method='ssl'
where method='sslcommerz';

create unique index if not exists payment_configs_store_method_uidx
  on public.payment_configs(store_id,method);

alter table public.payment_configs
  drop constraint if exists payment_configs_method_check;
alter table public.payment_configs
  add constraint payment_configs_method_check
  check (method in ('bkash','nagad','rocket','ssl','cod'));

-- Callback/audit rows for SSLCommerz and other gateway attempts.
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  payment_config_id uuid references public.payment_configs(id) on delete set null,
  provider text not null default 'sslcommerz',
  transaction_id text,
  session_key text,
  amount numeric(12,2),
  currency text not null default 'BDT',
  status text not null default 'initiated',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  validation_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.payment_transactions
  add column if not exists store_id uuid,
  add column if not exists order_id uuid,
  add column if not exists payment_config_id uuid,
  add column if not exists provider text default 'sslcommerz',
  add column if not exists transaction_id text,
  add column if not exists session_key text,
  add column if not exists amount numeric(12,2),
  add column if not exists currency text default 'BDT',
  add column if not exists status text default 'initiated',
  add column if not exists request_payload jsonb default '{}'::jsonb,
  add column if not exists response_payload jsonb default '{}'::jsonb,
  add column if not exists validation_payload jsonb default '{}'::jsonb,
  add column if not exists error_message text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists completed_at timestamptz;

create index if not exists payment_transactions_order_idx
  on public.payment_transactions(order_id,created_at desc);
create index if not exists payment_transactions_store_idx
  on public.payment_transactions(store_id,created_at desc);
create index if not exists payment_transactions_txn_idx
  on public.payment_transactions(transaction_id)
  where transaction_id is not null;

-- Merchant ownership policies.
alter table public.payment_configs enable row level security;

drop policy if exists "Owners manage own payment configs" on public.payment_configs;
drop policy if exists payment_configs_owner_select on public.payment_configs;
drop policy if exists payment_configs_owner_insert on public.payment_configs;
drop policy if exists payment_configs_owner_update on public.payment_configs;
drop policy if exists payment_configs_owner_delete on public.payment_configs;

create policy payment_configs_owner_select
on public.payment_configs
for select to authenticated
using (
  exists (
    select 1 from public.stores s
    where s.id=payment_configs.store_id
      and s.owner_id=auth.uid()
  )
);

create policy payment_configs_owner_insert
on public.payment_configs
for insert to authenticated
with check (
  exists (
    select 1 from public.stores s
    where s.id=payment_configs.store_id
      and s.owner_id=auth.uid()
      and coalesce(s.account_status,'active')<>'deleted'
  )
);

create policy payment_configs_owner_update
on public.payment_configs
for update to authenticated
using (
  exists (
    select 1 from public.stores s
    where s.id=payment_configs.store_id
      and s.owner_id=auth.uid()
  )
)
with check (
  exists (
    select 1 from public.stores s
    where s.id=payment_configs.store_id
      and s.owner_id=auth.uid()
      and coalesce(s.account_status,'active')<>'deleted'
  )
);

create policy payment_configs_owner_delete
on public.payment_configs
for delete to authenticated
using (
  exists (
    select 1 from public.stores s
    where s.id=payment_configs.store_id
      and s.owner_id=auth.uid()
  )
);

-- Checkout-safe projection. No SSLCommerz password or secret is exposed.
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
      when 'ssl' then 'Online Payment'
      when 'cod' then 'Cash on Delivery'
      else pc.method
    end,
    pc.method in ('bkash','nagad','rocket'),
    case
      when pc.method in ('bkash','nagad','rocket') then pc.merchant_number
      else null
    end
  from public.payment_configs pc
  join public.stores s on s.id=pc.store_id
  where pc.store_id=p_store_id
    and pc.enabled=true
    and coalesce(s.account_status,'active')='active'
    and coalesce(s.storefront_published,false)=true
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
grant execute on function public.get_public_payment_methods(uuid)
  to anon,authenticated;

create or replace function public.store_has_active_payment_method(p_store_id uuid)
returns boolean
language sql
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.payment_configs pc
    join public.stores s on s.id=pc.store_id
    where pc.store_id=p_store_id
      and pc.enabled=true
      and s.owner_id=auth.uid()
  );
$$;

revoke all on function public.store_has_active_payment_method(uuid) from public;
grant execute on function public.store_has_active_payment_method(uuid)
  to authenticated;

-- Old stores.payment_methods_configured can be boolean or JSON depending on history.
-- JSON forms are migrated; boolean is intentionally not guessed.
do $$
declare
  v_type text;
begin
  select data_type into v_type
  from information_schema.columns
  where table_schema='public'
    and table_name='stores'
    and column_name='payment_methods_configured';

  if v_type in ('json','jsonb') then
    execute $migrate$
      insert into public.payment_configs(store_id,method,enabled)
      select s.id,m.method_name,true
      from public.stores s
      cross join lateral (
        values
          ('bkash',coalesce((s.payment_methods_configured::jsonb->>'bkash')::boolean,false)),
          ('nagad',coalesce((s.payment_methods_configured::jsonb->>'nagad')::boolean,false)),
          ('rocket',coalesce((s.payment_methods_configured::jsonb->>'rocket')::boolean,false)),
          ('ssl',coalesce((s.payment_methods_configured::jsonb->>'ssl')::boolean,
                          (s.payment_methods_configured::jsonb->>'sslcommerz')::boolean,false)),
          ('cod',coalesce((s.payment_methods_configured::jsonb->>'cod')::boolean,false))
      ) m(method_name,is_enabled)
      where m.is_enabled=true
      on conflict(store_id,method) do update set enabled=excluded.enabled
    $migrate$;
  elsif v_type='boolean' then
    raise notice 'payment_methods_configured is boolean; method-level backfill skipped.';
  elsif v_type is not null then
    raise notice 'payment_methods_configured type % is not migrated automatically.',v_type;
  end if;
end $$;

notify pgrst,'reload schema';
