-- ════════════════════════════════════════════════════════════
-- BazarHQ — Customer SRS Migration
-- Run in: Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════

-- ── 1. Customer Profiles ────────────────────────────────────
create table if not exists customer_profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  full_name   text,
  phone       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── 2. Customer Addresses (max 3 per customer) ──────────────
create table if not exists customer_addresses (
  id           uuid default gen_random_uuid() primary key,
  customer_id  uuid references customer_profiles(id) on delete cascade not null,
  label        text default 'Home',
  full_name    text not null,
  phone        text not null,
  address      text not null,
  district     text not null,
  is_default   boolean default false,
  created_at   timestamptz default now()
);

-- ── 3. Add customer_id to orders ────────────────────────────
alter table orders
  add column if not exists customer_id   uuid references auth.users(id),
  add column if not exists txn_id        text,
  add column if not exists delivery_note text;

-- Index for order history lookups
create index if not exists idx_orders_customer_id    on orders(customer_id);
create index if not exists idx_orders_customer_email on orders(customer_email);
create index if not exists idx_orders_customer_phone on orders(customer_phone);

-- ── 4. RLS Policies ─────────────────────────────────────────

-- Customer Profiles
alter table customer_profiles enable row level security;

create policy "Customers: view own profile"
  on customer_profiles for select
  using (auth.uid() = id);

create policy "Customers: insert own profile"
  on customer_profiles for insert
  with check (auth.uid() = id);

create policy "Customers: update own profile"
  on customer_profiles for update
  using (auth.uid() = id);

create policy "Customers: delete own profile"
  on customer_profiles for delete
  using (auth.uid() = id);

-- Customer Addresses
alter table customer_addresses enable row level security;

create policy "Customers: manage own addresses"
  on customer_addresses for all
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

-- Orders: Customers can view their own orders
-- (Merchants already have their own RLS policies)
-- This ADDS a customer-side view policy.
-- Adjust if your existing orders RLS conflicts.

create policy "Customers: view own orders by customer_id"
  on orders for select
  using (
    auth.uid() = customer_id
    OR customer_email = (
      select email from auth.users where id = auth.uid() limit 1
    )
  );

-- ════════════════════════════════════════════════════════════
-- Done! Tables created:
--   customer_profiles  (id, full_name, phone)
--   customer_addresses (id, customer_id, label, full_name, phone, address, district, is_default)
-- Columns added to orders:
--   customer_id, txn_id, delivery_note
-- ════════════════════════════════════════════════════════════
