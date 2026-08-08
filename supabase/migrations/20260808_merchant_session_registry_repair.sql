-- =============================================================================
-- BazarHQ — Merchant Session Registry Complete Repair
-- Date: 2026-08-08
--
-- Fixes:
--   merchant-session -> 503 "Session registry is temporarily unavailable."
--
-- Repairs old/partially-applied session schema and makes remote revocation
-- authoritative for merchant data access.
-- Safe / idempotent for an existing BazarHQ database.
-- =============================================================================

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Profile-level revocation timestamp
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists session_revoked_before timestamptz,
  add column if not exists mfa_recovery_required boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Canonical merchant session registry
-- ---------------------------------------------------------------------------
create table if not exists public.merchant_active_sessions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id) on delete cascade,
  session_fingerprint text not null,
  auth_session_id text,
  device_label text,
  browser_name text,
  os_name text,
  device_type text,
  user_agent text,
  ip_address text,
  country_code text,
  access_expires_at timestamptz,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.merchant_active_sessions
  add column if not exists session_fingerprint text,
  add column if not exists auth_session_id text,
  add column if not exists device_label text,
  add column if not exists browser_name text,
  add column if not exists os_name text,
  add column if not exists device_type text,
  add column if not exists user_agent text,
  add column if not exists ip_address text,
  add column if not exists country_code text,
  add column if not exists access_expires_at timestamptz,
  add column if not exists last_seen_at timestamptz default now(),
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid,
  add column if not exists revocation_reason text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Backfill all old rows before adding the canonical uniqueness contract.
update public.merchant_active_sessions
set
  session_fingerprint = coalesce(
    nullif(session_fingerprint, ''),
    nullif(auth_session_id, ''),
    id::text
  ),
  auth_session_id = coalesce(
    nullif(auth_session_id, ''),
    nullif(session_fingerprint, ''),
    id::text
  ),
  last_seen_at = coalesce(last_seen_at, created_at, now()),
  created_at = coalesce(created_at, last_seen_at, now()),
  updated_at = coalesce(updated_at, last_seen_at, created_at, now());

-- Old partial migrations can leave duplicate auth_session_id rows. This table is
-- only a live device registry, so retain the newest/active copy and remove stale
-- duplicates before creating the real unique index.
with ranked as (
  select
    id,
    row_number() over (
      partition by merchant_id, auth_session_id
      order by
        case when revoked_at is null then 0 else 1 end,
        last_seen_at desc nulls last,
        created_at desc nulls last,
        id
    ) as rn
  from public.merchant_active_sessions
  where auth_session_id is not null
)
delete from public.merchant_active_sessions s
using ranked r
where s.id = r.id
  and r.rn > 1;

alter table public.merchant_active_sessions
  alter column session_fingerprint set not null,
  alter column auth_session_id set not null,
  alter column last_seen_at set default now(),
  alter column last_seen_at set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

-- IMPORTANT:
-- The previous completion migration used a PARTIAL unique index:
--   unique(merchant_id,auth_session_id) WHERE auth_session_id IS NOT NULL
-- A plain Supabase upsert(onConflict: merchant_id,auth_session_id) cannot infer
-- that partial index. Replace it with a normal unique index.
drop index if exists public.merchant_active_sessions_auth_sid_uidx;

create unique index if not exists merchant_active_sessions_auth_sid_uidx
  on public.merchant_active_sessions(merchant_id, auth_session_id);

create index if not exists merchant_active_sessions_merchant_idx
  on public.merchant_active_sessions(merchant_id, last_seen_at desc);

create index if not exists merchant_active_sessions_active_idx
  on public.merchant_active_sessions(merchant_id, last_seen_at desc)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- 3. Security event audit table
-- ---------------------------------------------------------------------------
create table if not exists public.merchant_security_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  auth_session_id text,
  ip_address text,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.merchant_security_events
  add column if not exists auth_session_id text,
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists details jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

update public.merchant_security_events
set
  details = coalesce(details, '{}'::jsonb),
  created_at = coalesce(created_at, now());

create index if not exists merchant_security_events_merchant_idx
  on public.merchant_security_events(merchant_id, created_at desc);

-- Session registry and security events are server-managed.
alter table public.merchant_active_sessions enable row level security;
alter table public.merchant_security_events enable row level security;

revoke all on table public.merchant_active_sessions from anon, authenticated;
revoke all on table public.merchant_security_events from anon, authenticated;

grant select, insert, update, delete
  on table public.merchant_active_sessions
  to service_role;

grant select, insert, update, delete
  on table public.merchant_security_events
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. Authoritative revoked-session guard
-- ---------------------------------------------------------------------------
create or replace function public.merchant_session_is_active()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sid text := nullif(auth.jwt()->>'session_id', '');
  v_iat timestamptz;
  v_revoked_before timestamptz;
begin
  if v_uid is null then
    return false;
  end if;

  -- Customer-only accounts have no merchant profile and are unaffected.
  if not exists (
    select 1
    from public.profiles p
    where p.id = v_uid
  ) then
    return true;
  end if;

  begin
    v_iat := to_timestamp((auth.jwt()->>'iat')::double precision);
  exception when others then
    v_iat := null;
  end;

  select p.session_revoked_before
  into v_revoked_before
  from public.profiles p
  where p.id = v_uid;

  if v_revoked_before is not null
     and (v_iat is null or v_iat <= v_revoked_before) then
    return false;
  end if;

  if v_sid is not null and exists (
    select 1
    from public.merchant_active_sessions s
    where s.merchant_id = v_uid
      and s.auth_session_id = v_sid
      and s.revoked_at is not null
  ) then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.merchant_session_is_active() from public;
grant execute on function public.merchant_session_is_active() to authenticated;

-- Re-attach the restrictive guard to merchant-sensitive tables where they exist.
-- Existing permissive ownership/public policies continue to define which rows can
-- be accessed; this policy only denies revoked merchant sessions.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'stores',
    'products',
    'orders',
    'payment_configs',
    'analytics_events',
    'merchant_notifications',
    'merchant_notification_preferences'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'drop policy if exists merchant_session_guard on public.%I',
        t
      );
      execute format(
        'create policy merchant_session_guard on public.%I as restrictive for all to authenticated using (public.merchant_session_is_active()) with check (public.merchant_session_is_active())',
        t
      );
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';

commit;

-- =============================================================================
-- Verification
-- Expected:
--   auth_session_id = NOT NULL
--   merchant_active_sessions_auth_sid_uidx = unique, non-partial
--   duplicate_session_pairs = 0
-- =============================================================================

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'merchant_active_sessions'
  and column_name in (
    'merchant_id',
    'session_fingerprint',
    'auth_session_id',
    'device_label',
    'browser_name',
    'os_name',
    'device_type',
    'ip_address',
    'last_seen_at',
    'access_expires_at',
    'revoked_at',
    'revoked_by',
    'revocation_reason',
    'updated_at'
  )
order by column_name;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'merchant_active_sessions'
order by indexname;

select count(*) as duplicate_session_pairs
from (
  select merchant_id, auth_session_id
  from public.merchant_active_sessions
  group by merchant_id, auth_session_id
  having count(*) > 1
) duplicates;
