-- BazarHQ: repair canonical Super Admin global IP allowlist.
-- Safe/idempotent. Run once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.admin_ip_allowlist (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  ip_value text not null,
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.admin_ip_allowlist
  add column if not exists label text,
  add column if not exists ip_value text,
  add column if not exists is_active boolean default true,
  add column if not exists created_by text,
  add column if not exists created_at timestamptz default now();

update public.admin_ip_allowlist
set
  label = coalesce(nullif(label, ''), 'Allowlisted IP'),
  is_active = coalesce(is_active, true),
  created_at = coalesce(created_at, now())
where label is null
   or label = ''
   or is_active is null
   or created_at is null;

-- Canonical columns are required for new rows.
alter table public.admin_ip_allowlist
  alter column label set not null,
  alter column is_active set default true,
  alter column is_active set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

create index if not exists admin_ip_allowlist_active_idx
  on public.admin_ip_allowlist(is_active);

alter table public.admin_ip_allowlist enable row level security;

-- Browser roles must not directly manage the Super Admin allowlist.
revoke all on table public.admin_ip_allowlist from anon, authenticated;

-- Admin Edge Functions use the service-role client.
grant select, insert, update, delete
  on table public.admin_ip_allowlist
  to service_role;

notify pgrst, 'reload schema';
