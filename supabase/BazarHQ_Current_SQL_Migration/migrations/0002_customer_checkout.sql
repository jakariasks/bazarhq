-- =============================================================================
-- BazarHQ CURRENT MIGRATION 0002
-- Customer accounts, checkout, reviews, coupons and order tracking
-- =============================================================================
-- Canonical rules:
--   * Final order placement requires an authenticated customer.
--   * Prices, stock, variants, delivery charge and coupon discount are recalculated
--     inside place_customer_order_v2.
--   * Merchant/order notifications are created by triggers in 0001, not here.
-- =============================================================================

create extension if not exists pgcrypto;

-- Customer profiles and saved addresses.
create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  account_status text not null default 'active',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists account_status text default 'active',
  add column if not exists deleted_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  label text not null default 'Home',
  full_name text not null,
  phone text not null,
  address text not null,
  district text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_addresses
  add column if not exists label text default 'Home',
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists district text,
  add column if not exists is_default boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists customer_profiles_phone_idx
  on public.customer_profiles(phone);
create index if not exists customer_addresses_customer_idx
  on public.customer_addresses(customer_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at=now();
  return new;
end $$;

drop trigger if exists customer_profiles_updated_at_tg on public.customer_profiles;
create trigger customer_profiles_updated_at_tg
before update on public.customer_profiles
for each row execute function public.set_updated_at();

drop trigger if exists customer_addresses_updated_at_tg on public.customer_addresses;
create trigger customer_addresses_updated_at_tg
before update on public.customer_addresses
for each row execute function public.set_updated_at();

create or replace function public.limit_customer_addresses()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if (
    select count(*) from public.customer_addresses
    where customer_id=new.customer_id
  ) >= 3 then
    raise exception 'A customer can save up to 3 addresses.';
  end if;
  return new;
end $$;

drop trigger if exists limit_customer_addresses_tg on public.customer_addresses;
drop trigger if exists trg_limit_customer_addresses on public.customer_addresses;
create trigger limit_customer_addresses_tg
before insert on public.customer_addresses
for each row execute function public.limit_customer_addresses();

-- Fields required by the current checkout implementation.
alter table public.stores
  add column if not exists delivery_charge_dhaka numeric(12,2) default 60,
  add column if not exists delivery_charge_outside_dhaka numeric(12,2) default 120,
  add column if not exists free_delivery_min_amount numeric(12,2) default 0;

alter table public.products
  add column if not exists has_variants boolean default false,
  add column if not exists variant_types jsonb default '[]'::jsonb,
  add column if not exists variants jsonb default '[]'::jsonb,
  add column if not exists delivery_charge_mode text default 'store_default',
  add column if not exists delivery_charge_dhaka numeric(12,2),
  add column if not exists delivery_charge_outside_dhaka numeric(12,2);

alter table public.orders
  add column if not exists customer_id uuid references auth.users(id) on delete set null,
  add column if not exists customer_email text,
  add column if not exists txn_id text,
  add column if not exists transaction_id text,
  add column if not exists delivery_note text,
  add column if not exists subtotal numeric(12,2) default 0,
  add column if not exists delivery_charge numeric(12,2) default 0,
  add column if not exists discount_amount numeric(12,2) default 0,
  add column if not exists coupon_code text,
  add column if not exists coupon_id uuid,
  add column if not exists items jsonb default '[]'::jsonb,
  add column if not exists updated_at timestamptz default now();

update public.orders
set txn_id=coalesce(txn_id,transaction_id),
    transaction_id=coalesce(transaction_id,txn_id)
where txn_id is null or transaction_id is null;

create or replace function public.sync_order_transaction_id()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.txn_id:=coalesce(new.txn_id,new.transaction_id);
  new.transaction_id:=coalesce(new.transaction_id,new.txn_id);
  new.updated_at:=now();
  return new;
end $$;

drop trigger if exists orders_sync_transaction_id_tg on public.orders;
create trigger orders_sync_transaction_id_tg
before insert or update on public.orders
for each row execute function public.sync_order_transaction_id();

create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_customer_email_idx on public.orders(customer_email);
create index if not exists orders_customer_phone_idx on public.orders(customer_phone);

create table if not exists public.order_timeline (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists order_timeline_order_idx
  on public.order_timeline(order_id,created_at);

-- Product reviews/rating ---------------------------------------------------------------
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid,
  customer_name text,
  customer_email text,
  rating integer not null check (rating between 1 and 5),
  comment text,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists product_reviews_product_customer_uidx on public.product_reviews(product_id, customer_id) where customer_id is not null;
create index if not exists product_reviews_product_status_idx on public.product_reviews(product_id, status, created_at desc);
alter table public.product_reviews enable row level security;
drop policy if exists "Public reads approved product reviews" on public.product_reviews;
create policy "Public reads approved product reviews" on public.product_reviews for select using (status = 'approved');
drop policy if exists "Customers insert their own reviews" on public.product_reviews;
create policy "Customers insert their own reviews" on public.product_reviews for insert with check (auth.uid() = customer_id);
alter table public.products add column if not exists average_rating numeric(3,2) not null default 0;
alter table public.products add column if not exists rating_count integer not null default 0;

create or replace function public.refresh_product_rating(p_product_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.products p
  set average_rating = coalesce((select round(avg(rating)::numeric, 2) from public.product_reviews r where r.product_id = p_product_id and r.status = 'approved'), 0),
      rating_count = coalesce((select count(*)::integer from public.product_reviews r where r.product_id = p_product_id and r.status = 'approved'), 0),
      updated_at = now()
  where p.id = p_product_id;
end; $$;

create or replace function public.customer_can_review_product(p_store_id uuid, p_product_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    where o.store_id = p_store_id
      and o.customer_id = auth.uid()
      and coalesce(o.status, '') not in ('cancelled')
      and exists (
        select 1 from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) item
        where nullif(item->>'product_id', '')::uuid = p_product_id
      )
  );
$$;
grant execute on function public.customer_can_review_product(uuid, uuid) to authenticated;

create or replace function public.submit_product_review(p_store_id uuid, p_product_id uuid, p_rating integer, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_email text; v_name text;
begin
  if v_uid is null then raise exception 'Customer login required'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if length(trim(coalesce(p_comment, ''))) < 5 then raise exception 'Review comment is too short'; end if;
  if not public.customer_can_review_product(p_store_id, p_product_id) then raise exception 'Only customers who ordered this product can review it'; end if;
  select email into v_email from auth.users where id = v_uid;
  select coalesce(full_name, split_part(v_email, '@', 1)) into v_name from public.customer_profiles where id = v_uid;
  v_name := coalesce(v_name, split_part(v_email, '@', 1), 'Verified customer');
  insert into public.product_reviews (store_id, product_id, customer_id, customer_name, customer_email, rating, comment, status)
  values (p_store_id, p_product_id, v_uid, v_name, v_email, p_rating, trim(p_comment), 'approved')
  on conflict (product_id, customer_id) do update set rating = excluded.rating, comment = excluded.comment, status = 'approved', customer_name = excluded.customer_name, customer_email = excluded.customer_email, updated_at = now();
  perform public.refresh_product_rating(p_product_id);
  return jsonb_build_object('success', true);
end; $$;
grant execute on function public.submit_product_review(uuid, uuid, integer, text) to authenticated;

-- Coupon system hardening --------------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  name text,
  discount_type text not null default 'percent' check (discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  min_order_amount numeric(12,2) not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit integer,
  used_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists coupons_store_upper_code_uidx on public.coupons(store_id, upper(code));
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid references public.coupons(id) on delete set null,
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  customer_id uuid,
  code text,
  discount_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
drop policy if exists "Store owners manage coupons" on public.coupons;
create policy "Store owners manage coupons" on public.coupons for all using (exists (select 1 from public.stores s where s.id = coupons.store_id and s.owner_id = auth.uid())) with check (exists (select 1 from public.stores s where s.id = coupons.store_id and s.owner_id = auth.uid()));
drop policy if exists "Store owners read coupon redemptions" on public.coupon_redemptions;
create policy "Store owners read coupon redemptions" on public.coupon_redemptions for select using (exists (select 1 from public.stores s where s.id = coupon_redemptions.store_id and s.owner_id = auth.uid()));

create or replace function public.validate_coupon(p_store_id uuid, p_code text, p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_coupon public.coupons%rowtype; v_code text := upper(trim(coalesce(p_code, ''))); v_discount numeric(12,2) := 0;
begin
  if v_code = '' then return jsonb_build_object('valid', false, 'message', 'Enter a coupon code.'); end if;
  select * into v_coupon from public.coupons where store_id = p_store_id and upper(code) = v_code limit 1;
  if not found then return jsonb_build_object('valid', false, 'message', 'Coupon code not found.'); end if;
  if not coalesce(v_coupon.is_active, true) then return jsonb_build_object('valid', false, 'message', 'This coupon is inactive.'); end if;
  if v_coupon.starts_at is not null and v_coupon.starts_at > now() then return jsonb_build_object('valid', false, 'message', 'This coupon is not active yet.'); end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then return jsonb_build_object('valid', false, 'message', 'This coupon has expired.'); end if;
  if v_coupon.usage_limit is not null and coalesce(v_coupon.used_count, 0) >= v_coupon.usage_limit then return jsonb_build_object('valid', false, 'message', 'This coupon usage limit has been reached.'); end if;
  if coalesce(p_subtotal, 0) < coalesce(v_coupon.min_order_amount, 0) then return jsonb_build_object('valid', false, 'message', 'Minimum order amount is BDT ' || coalesce(v_coupon.min_order_amount, 0)); end if;
  if v_coupon.discount_type = 'percent' then v_discount := round(coalesce(p_subtotal, 0) * least(greatest(v_coupon.discount_value, 0), 100) / 100, 2); else v_discount := least(greatest(v_coupon.discount_value, 0), coalesce(p_subtotal, 0)); end if;
  return jsonb_build_object('valid', true, 'coupon_id', v_coupon.id, 'code', v_coupon.code, 'discount_type', v_coupon.discount_type, 'discount_value', v_coupon.discount_value, 'discount_amount', v_discount, 'min_order_amount', v_coupon.min_order_amount, 'message', 'Coupon applied successfully.');
end; $$;
grant execute on function public.validate_coupon(uuid, text, numeric) to anon, authenticated;

-- Customer account deletion ------------------------------------------------------------
alter table public.customer_profiles add column if not exists deleted_at timestamptz;
alter table public.customer_profiles add column if not exists account_status text not null default 'active';
create or replace function public.delete_customer_account()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Customer login required'; end if;
  delete from public.customer_addresses where customer_id = v_uid;
  insert into public.customer_profiles (id, account_status, deleted_at, updated_at)
  values (v_uid, 'deleted', now(), now())
  on conflict (id) do update set full_name = null, phone = null, account_status = 'deleted', deleted_at = now(), updated_at = now();
  return jsonb_build_object('success', true);
end; $$;
grant execute on function public.delete_customer_account() to authenticated;

-- Order RPC hardening: stock/variant/coupon/total --------------------------------------
alter table public.orders add column if not exists subtotal numeric(12,2) default 0;
alter table public.orders add column if not exists delivery_charge numeric(12,2) default 0;
alter table public.orders add column if not exists discount_amount numeric(12,2) default 0;
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists coupon_id uuid;
alter table public.orders add column if not exists delivery_note text;

-- Keep your existing place_customer_order_v2 if it is already newer. This function replaces it with a transaction-safe version.
create or replace function public.place_customer_order_v2(p_order_id text, p_store_id uuid, p_customer_name text, p_customer_phone text, p_customer_email text, p_delivery_address text, p_district text, p_delivery_note text, p_payment_method text, p_payment_status text, p_txn_id text, p_items jsonb, p_total numeric default 0, p_coupon_code text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth_uid uuid := auth.uid(); v_auth_email text; v_store stores%rowtype; v_product products%rowtype; v_item jsonb;
  v_qty integer; v_product_id uuid; v_variant_id text; v_variant_label text; v_variant jsonb; v_variant_stock integer;
  v_price numeric(12,2); v_line_total numeric(12,2); v_subtotal numeric(12,2) := 0; v_store_default_delivery numeric(12,2) := 0; v_item_delivery numeric(12,2) := 0; v_delivery_charge numeric(12,2) := 0; v_order_total numeric(12,2) := 0;
  v_coupon coupons%rowtype; v_coupon_code text := upper(trim(coalesce(p_coupon_code, ''))); v_discount_amount numeric(12,2) := 0;
  v_validated_items jsonb := '[]'::jsonb; v_updated_variants jsonb; v_inserted_id uuid;
begin
  if v_auth_uid is null then raise exception 'Customer login required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;
  select email into v_auth_email from auth.users where id = v_auth_uid;
  select * into v_store from public.stores where id = p_store_id and coalesce(storefront_published, false) is true and coalesce(account_status, 'active') = 'active';
  if not found then raise exception 'Shop is unavailable'; end if;
  insert into public.customer_profiles (id, full_name, phone, account_status, updated_at) values (v_auth_uid, p_customer_name, p_customer_phone, 'active', now()) on conflict (id) do update set full_name = coalesce(nullif(excluded.full_name, ''), public.customer_profiles.full_name), phone = coalesce(nullif(excluded.phone, ''), public.customer_profiles.phone), account_status = 'active', updated_at = now();
  if lower(trim(coalesce(p_district, ''))) = 'dhaka' then v_store_default_delivery := greatest(coalesce(v_store.delivery_charge_dhaka, 60), 0); else v_store_default_delivery := greatest(coalesce(v_store.delivery_charge_outside_dhaka, 120), 0); end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid; v_qty := coalesce((v_item->>'qty')::integer, 0); v_variant_id := nullif(v_item->>'variant_id', ''); v_variant_label := nullif(v_item->>'variant', '');
    if v_qty <= 0 then raise exception 'Invalid quantity'; end if;
    select * into v_product from public.products where id = v_product_id and store_id = p_store_id and status in ('published','active') for update;
    if not found then raise exception 'Product unavailable: %', v_product_id; end if;
    if coalesce(v_product.has_variants, false) then
      select elem into v_variant from jsonb_array_elements(coalesce(v_product.variants::jsonb, '[]'::jsonb)) elem where coalesce(elem->>'id', elem->>'combo', elem->>'label') = coalesce(v_variant_id, v_variant_label) or elem->>'combo' = v_variant_label or elem->>'label' = v_variant_label limit 1;
      if v_variant is null then raise exception 'Selected variant is unavailable for %', v_product.title; end if;
      v_variant_stock := coalesce(nullif(v_variant->>'stock', '')::integer, 0);
      if v_variant_stock < v_qty then raise exception 'Only % left for %', v_variant_stock, v_product.title; end if;
      v_price := coalesce(nullif(v_variant->>'price', '')::numeric, v_product.price, 0);
      select jsonb_agg(case when coalesce(elem->>'id', elem->>'combo', elem->>'label') = coalesce(v_variant_id, v_variant_label) or elem->>'combo' = v_variant_label or elem->>'label' = v_variant_label then jsonb_set(jsonb_set(elem, '{stock}', to_jsonb(greatest(coalesce(nullif(elem->>'stock', '')::integer, 0) - v_qty, 0)), true), '{available}', to_jsonb((greatest(coalesce(nullif(elem->>'stock', '')::integer, 0) - v_qty, 0)) > 0), true) else elem end) into v_updated_variants from jsonb_array_elements(coalesce(v_product.variants::jsonb, '[]'::jsonb)) elem;
      update public.products set variants = coalesce(v_updated_variants, '[]'::jsonb), stock = greatest(coalesce(stock, 0) - v_qty, 0), updated_at = now() where id = v_product.id;
    else
      if coalesce(v_product.stock, 0) < v_qty then raise exception 'Only % left for %', coalesce(v_product.stock, 0), v_product.title; end if;
      v_price := coalesce(v_product.price, 0);
      update public.products set stock = greatest(coalesce(stock, 0) - v_qty, 0), updated_at = now() where id = v_product.id;
    end if;
    v_line_total := v_price * v_qty; v_subtotal := v_subtotal + v_line_total;
    if coalesce(v_product.delivery_charge_mode, 'store_default') = 'free' then v_item_delivery := 0; elsif coalesce(v_product.delivery_charge_mode, 'store_default') = 'custom' then if lower(trim(coalesce(p_district, ''))) = 'dhaka' then v_item_delivery := greatest(coalesce(v_product.delivery_charge_dhaka, v_store_default_delivery), 0); else v_item_delivery := greatest(coalesce(v_product.delivery_charge_outside_dhaka, v_store_default_delivery), 0); end if; else v_item_delivery := v_store_default_delivery; end if;
    v_delivery_charge := greatest(v_delivery_charge, v_item_delivery);
    v_validated_items := v_validated_items || jsonb_build_array(jsonb_build_object('product_id', v_product.id, 'title', v_product.title, 'variant_id', v_variant_id, 'variant', v_variant_label, 'price', v_price, 'qty', v_qty, 'line_total', v_line_total, 'item_delivery_charge', v_item_delivery));
  end loop;
  if coalesce(v_store.free_delivery_min_amount, 0) > 0 and v_subtotal >= coalesce(v_store.free_delivery_min_amount, 0) then v_delivery_charge := 0; end if;
  v_order_total := v_subtotal + v_delivery_charge;
  if v_coupon_code <> '' then
    select * into v_coupon from public.coupons where store_id = p_store_id and upper(code) = v_coupon_code and coalesce(is_active, true) is true and (starts_at is null or starts_at <= now()) and (expires_at is null or expires_at >= now()) for update;
    if not found then raise exception 'Coupon is invalid or expired'; end if;
    if coalesce(v_coupon.min_order_amount, 0) > v_subtotal then raise exception 'Minimum order amount for coupon % is %', v_coupon.code, v_coupon.min_order_amount; end if;
    if v_coupon.usage_limit is not null and coalesce(v_coupon.used_count, 0) >= v_coupon.usage_limit then raise exception 'Coupon usage limit reached'; end if;
    if v_coupon.discount_type = 'percent' then v_discount_amount := round(v_subtotal * least(greatest(v_coupon.discount_value, 0), 100) / 100, 2); else v_discount_amount := least(greatest(v_coupon.discount_value, 0), v_subtotal); end if;
    v_order_total := greatest(0, v_order_total - v_discount_amount);
  end if;
  if abs(coalesce(p_total, v_order_total) - v_order_total) > 1 then raise exception 'Order total changed. Please review the latest total before placing the order.'; end if;
  insert into public.orders (order_id, store_id, customer_name, customer_phone, customer_email, customer_id, delivery_address, district, delivery_note, payment_method, payment_status, txn_id, status, subtotal, delivery_charge, discount_amount, coupon_code, coupon_id, total, items) values (p_order_id, p_store_id, p_customer_name, p_customer_phone, coalesce(nullif(p_customer_email, ''), v_auth_email), v_auth_uid, p_delivery_address, p_district, p_delivery_note, p_payment_method, p_payment_status, p_txn_id, 'pending', v_subtotal, v_delivery_charge, v_discount_amount, nullif(v_coupon_code, ''), case when v_coupon.id is null then null else v_coupon.id end, v_order_total, v_validated_items) returning id into v_inserted_id;
  insert into public.order_timeline (order_id, status, note) values (v_inserted_id, 'pending', 'Order placed by customer');
  if v_coupon.id is not null then update public.coupons set used_count = coalesce(used_count, 0) + 1, updated_at = now() where id = v_coupon.id; insert into public.coupon_redemptions (coupon_id, store_id, order_id, customer_id, code, discount_amount) values (v_coupon.id, p_store_id, v_inserted_id, v_auth_uid, v_coupon.code, v_discount_amount); end if;
  return jsonb_build_object('id', v_inserted_id, 'order_id', p_order_id, 'subtotal', v_subtotal, 'delivery_charge', v_delivery_charge, 'discount_amount', v_discount_amount, 'coupon_code', nullif(v_coupon_code, ''), 'total', v_order_total);
end; $$;
grant execute on function public.place_customer_order_v2(text, uuid, text, text, text, text, text, text, text, text, text, jsonb, numeric, text) to authenticated;


-- Keep aggregate ratings correct when review rows are changed outside the RPC.
create or replace function public.refresh_product_rating_from_review()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='DELETE' then
    perform public.refresh_product_rating(old.product_id);
    return old;
  end if;

  perform public.refresh_product_rating(new.product_id);
  return new;
end $$;

drop trigger if exists product_reviews_refresh_rating_tg on public.product_reviews;
create trigger product_reviews_refresh_rating_tg
after insert or update or delete on public.product_reviews
for each row execute function public.refresh_product_rating_from_review();

-- Secure public tracking RPC. It returns only an order matching all three identifiers.
-- The current frontend can be migrated from direct table reads to this RPC.
create or replace function public.get_public_order_tracking(
  p_store_subdomain text,
  p_order_id text,
  p_customer_phone text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_store public.stores%rowtype;
  v_timeline jsonb;
begin
  select o.*
  into v_order
  from public.orders o
  join public.stores s on s.id=o.store_id
  where lower(s.subdomain)=lower(trim(p_store_subdomain))
    and lower(o.order_id)=lower(trim(p_order_id))
    and regexp_replace(coalesce(o.customer_phone,''),'\D','','g')
        = regexp_replace(coalesce(p_customer_phone,''),'\D','','g')
  limit 1;

  if v_order.id is null then
    return jsonb_build_object('found',false);
  end if;

  select * into v_store
  from public.stores
  where id=v_order.store_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'status',t.status,
        'note',t.note,
        'created_at',t.created_at
      )
      order by t.created_at
    ),
    '[]'::jsonb
  )
  into v_timeline
  from public.order_timeline t
  where t.order_id=v_order.id;

  return jsonb_build_object(
    'found',true,
    'order',jsonb_build_object(
      'id',v_order.id,
      'order_id',v_order.order_id,
      'customer_name',v_order.customer_name,
      'customer_phone',v_order.customer_phone,
      'delivery_address',v_order.delivery_address,
      'district',v_order.district,
      'delivery_note',v_order.delivery_note,
      'payment_method',v_order.payment_method,
      'payment_status',v_order.payment_status,
      'status',v_order.status,
      'subtotal',v_order.subtotal,
      'delivery_charge',v_order.delivery_charge,
      'discount_amount',v_order.discount_amount,
      'total',v_order.total,
      'items',v_order.items,
      'created_at',v_order.created_at,
      'updated_at',v_order.updated_at
    ),
    'store',jsonb_build_object(
      'shop_name',v_store.shop_name,
      'subdomain',v_store.subdomain,
      'phone',v_store.phone,
      'whatsapp_number',v_store.whatsapp_number,
      'contact_email',v_store.contact_email
    ),
    'timeline',v_timeline
  );
end $$;

revoke all on function public.get_public_order_tracking(text,text,text) from public;
grant execute on function public.get_public_order_tracking(text,text,text)
  to anon,authenticated;

revoke all on function public.place_customer_order_v2(
  text,uuid,text,text,text,text,text,text,text,text,text,jsonb,numeric,text
) from public;
grant execute on function public.place_customer_order_v2(
  text,uuid,text,text,text,text,text,text,text,text,text,jsonb,numeric,text
) to authenticated;

notify pgrst,'reload schema';
