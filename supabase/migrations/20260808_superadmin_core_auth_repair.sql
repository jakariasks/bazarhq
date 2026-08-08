-- ============================================================================
-- BazarHQ Super Admin Core Auth Repair
-- Date: 2026-08-08
-- Purpose:
--   Repair ONLY the custom Super Admin auth/session tables required by the
--   current Edge Functions. Safe to run on an existing BazarHQ database.
--
-- IMPORTANT:
--   This script does NOT set or change the Supabase Auth password.
--   It only ensures the custom admin record/session schema exists.
-- ============================================================================

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Canonical admin_users
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text,
  role text not null default 'full_access',
  is_active boolean not null default true,
  allowed_ips text[] not null default '{}',
  totp_enabled boolean not null default false,
  totp_secret text,
  totp_recovery_hashes jsonb not null default '[]'::jsonb,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  last_login_ip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users
  add column if not exists password_hash text,
  add column if not exists role text default 'full_access',
  add column if not exists is_active boolean default true,
  add column if not exists allowed_ips text[] default '{}',
  add column if not exists totp_enabled boolean default false,
  add column if not exists totp_secret text,
  add column if not exists totp_recovery_hashes jsonb default '[]'::jsonb,
  add column if not exists failed_attempts integer default 0,
  add column if not exists locked_until timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists last_login_ip text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.admin_users
set
  email = lower(trim(email)),
  role = coalesce(nullif(trim(role), ''), 'full_access'),
  is_active = coalesce(is_active, true),
  allowed_ips = coalesce(allowed_ips, '{}'::text[]),
  totp_enabled = coalesce(totp_enabled, false),
  totp_recovery_hashes = coalesce(totp_recovery_hashes, '[]'::jsonb),
  failed_attempts = coalesce(failed_attempts, 0),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

-- ---------------------------------------------------------------------------
-- 2) Global IP allowlist
-- ---------------------------------------------------------------------------
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
  label = coalesce(nullif(trim(label), ''), 'Allowlisted IP'),
  is_active = coalesce(is_active, true),
  created_at = coalesce(created_at, now());

create index if not exists admin_ip_allowlist_active_idx
  on public.admin_ip_allowlist(is_active);

-- ---------------------------------------------------------------------------
-- 3) Custom Admin sessions
-- ---------------------------------------------------------------------------
create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.admin_users(id) on delete cascade,
  token_hash text not null unique,
  ip_address text,
  user_agent text,
  expires_at timestamptz not null,
  idle_expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_sessions
  add column if not exists admin_id uuid,
  add column if not exists token_hash text,
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists expires_at timestamptz,
  add column if not exists idle_expires_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists admin_sessions_admin_idx
  on public.admin_sessions(admin_id, created_at desc);

create index if not exists admin_sessions_token_hash_idx
  on public.admin_sessions(token_hash);

-- ---------------------------------------------------------------------------
-- 4) TOTP login challenges
-- ---------------------------------------------------------------------------
create table if not exists public.admin_login_challenges (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.admin_users(id) on delete cascade,
  challenge_token_hash text not null unique,
  ip_address text,
  user_agent text,
  used_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.admin_login_challenges
  add column if not exists admin_id uuid,
  add column if not exists challenge_token_hash text,
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists used_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists created_at timestamptz default now();

create index if not exists admin_login_challenges_admin_idx
  on public.admin_login_challenges(admin_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5) Ensure the existing Supabase Auth Super Admin has a custom admin row.
--    Password remains managed by Supabase Auth; no password is stored here.
-- ---------------------------------------------------------------------------
do $$
declare
  v_admin_email text := 'admin@bazarhq.com';
  v_auth_email text;
begin
  select lower(email)
  into v_auth_email
  from auth.users
  where lower(email) = lower(v_admin_email)
  limit 1;

  if v_auth_email is null then
    raise exception
      'Supabase Auth user % was not found. Create/confirm that Auth user first.',
      v_admin_email;
  end if;

  if not exists (
    select 1
    from public.admin_users
    where lower(email) = v_auth_email
  ) then
    insert into public.admin_users (
      email,
      role,
      is_active,
      allowed_ips,
      totp_enabled,
      totp_recovery_hashes,
      failed_attempts,
      created_at,
      updated_at
    )
    values (
      v_auth_email,
      'full_access',
      true,
      '{}'::text[],
      false,
      '[]'::jsonb,
      0,
      now(),
      now()
    );
  else
    update public.admin_users
    set
      role = coalesce(nullif(role, ''), 'full_access'),
      is_active = true,
      allowed_ips = coalesce(allowed_ips, '{}'::text[]),
      failed_attempts = 0,
      locked_until = null,
      updated_at = now()
    where lower(email) = v_auth_email;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6) Security: browser roles cannot read/write these tables directly.
--    Edge Functions use the service_role client.
-- ---------------------------------------------------------------------------
alter table public.admin_users enable row level security;
alter table public.admin_ip_allowlist enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.admin_login_challenges enable row level security;

revoke all on table public.admin_users from anon, authenticated;
revoke all on table public.admin_ip_allowlist from anon, authenticated;
revoke all on table public.admin_sessions from anon, authenticated;
revoke all on table public.admin_login_challenges from anon, authenticated;

grant select, insert, update, delete
  on table public.admin_users
  to service_role;

grant select, insert, update, delete
  on table public.admin_ip_allowlist
  to service_role;

grant select, insert, update, delete
  on table public.admin_sessions
  to service_role;

grant select, insert, update, delete
  on table public.admin_login_challenges
  to service_role;

-- Create canonical unique lower(email) index only when existing data is clean.
do $$
begin
  if not exists (
    select 1
    from (
      select lower(email)
      from public.admin_users
      group by lower(email)
      having count(*) > 1
    ) d
  ) then
    execute '
      create unique index if not exists admin_users_email_lower_uidx
      on public.admin_users(lower(email))
    ';
  else
    raise notice
      'Duplicate admin_users emails exist. Login remains duplicate-safe; clean duplicates before adding the unique index.';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;

-- ---------------------------------------------------------------------------
-- Verification result: should return exactly one row for admin@bazarhq.com.
-- ---------------------------------------------------------------------------
select
  id,
  email,
  role,
  is_active,
  totp_enabled,
  failed_attempts,
  locked_until
from public.admin_users
where lower(email) = lower('admin@bazarhq.com')
order by created_at
limit 5;
