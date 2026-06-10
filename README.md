# BazarHQ — Local Development Setup

## Prerequisites
- Node.js 18+
- A Supabase project (https://supabase.com)

## 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase project URL and anon key.
Find them in your Supabase dashboard → Settings → API.

## 2. Set up your Supabase database

Run the SQL below in your Supabase SQL Editor (Dashboard → SQL Editor → New Query):

```sql
-- Profiles table (one per user)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  current_store_id uuid,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users manage own profile" on profiles for all using (auth.uid() = id);

-- Stores table
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  shop_name text,
  subdomain text unique,
  business_category text,
  tagline text,
  description text,
  contact_email text,
  phone text,
  whatsapp_number text,
  website_url text,
  address text,
  city text,
  currency text default 'BDT',
  brand_color text default '#6366f1',
  logo_url text,
  banner_url text,
  facebook_handle text,
  instagram_handle text,
  theme_id text default 'indigo',
  announcement_text text,
  announcement_enabled boolean default false,
  storefront_published boolean default false,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table stores enable row level security;
create policy "Owners manage own stores" on stores for all using (auth.uid() = owner_id);
create policy "Anyone can view published stores" on stores for select using (storefront_published = true);

-- Products table
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores(id) on delete cascade not null,
  owner_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  slug text,
  description text,
  price numeric(12,2) default 0,
  compare_at_price numeric(12,2),
  stock integer default 0,
  status text default 'draft' check (status in ('draft','published','archived')),
  images text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table products enable row level security;
create policy "Owners manage own products" on products for all using (auth.uid() = owner_id);
create policy "Anyone can view published products" on products for select using (status = 'published');

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## 3. Set up Supabase Storage

In your Supabase dashboard → Storage → New bucket:
- Name: `shop-branding`
- Public: ✅ checked (so images are publicly viewable)

## 4. Install & run

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Project structure

```
src/
  components/         # Shared components (AuthGuard, StoreSwitcher, PublishCard)
  components/ui/      # shadcn-style UI primitives (Button, Input, Dialog, etc.)
  hooks/              # useAuth hook + AuthProvider
  integrations/       # Supabase client
  lib/                # Utilities (use-current-store, preview-themes, utils)
  pages/              # All route pages
    merchant/         # Dashboard pages (products, orders, settings, etc.)
  routeTree.jsx       # TanStack Router route configuration
  main.jsx            # App entry point
  index.css           # Global styles & Tailwind v4 theme
```
