-- ════════════════════════════════════════════════════════════════
-- BazarHQ — Super Admin Panel Migration (A1–A4)
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ════════════════════════════════════════════════════════════════

-- ── A1: Admin Users ──────────────────────────────────────────────
create table if not exists admin_users (
  id              uuid default gen_random_uuid() primary key,
  email           text unique not null,
  role            text default 'full_access' check (role in ('full_access','viewer')),
  totp_secret     text,                        -- TOTP secret key
  totp_enabled    boolean default false,
  failed_attempts integer default 0,
  locked_until    timestamptz,
  allowed_ips     text[],                      -- whitelisted IPs (null = all)
  created_at      timestamptz default now(),
  last_login_at   timestamptz
);

-- ── A1: Admin Audit Log (immutable) ─────────────────────────────
create table if not exists admin_audit_log (
  id          bigserial primary key,
  admin_id    uuid references admin_users(id),
  admin_email text,
  action      text not null,        -- e.g. 'merchant.suspend', 'login.success'
  target_type text,                 -- 'merchant' | 'theme' | 'announcement' | 'system'
  target_id   text,
  details     jsonb,
  ip_address  text,
  created_at  timestamptz default now()
);
-- Audit log is read-only for admins — enforced via RLS
alter table admin_audit_log enable row level security;
create policy "Audit log: admins can insert"
  on admin_audit_log for insert with check (true);
create policy "Audit log: admins can read"
  on admin_audit_log for select using (true);
-- No update or delete policies → immutable

-- ── A2: Merchant suspension notes ────────────────────────────────
alter table stores
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists account_status   text default 'active'
    check (account_status in ('active','suspended','deleted'));

-- ── A3: System health log ─────────────────────────────────────────
create table if not exists system_health_log (
  id         bigserial primary key,
  service    text not null,   -- 'database'|'storage'|'email'|'sms'|'web'
  status     text not null,   -- 'up'|'down'|'degraded'
  response_ms integer,
  error_msg  text,
  checked_at timestamptz default now()
);

-- ── A4: Platform Announcements ────────────────────────────────────
create table if not exists platform_announcements (
  id            uuid default gen_random_uuid() primary key,
  title         text not null,
  body          text not null,
  created_by    uuid references admin_users(id),
  scheduled_at  timestamptz,
  sent_at       timestamptz,
  status        text default 'draft' check (status in ('draft','scheduled','sent','cancelled')),
  recipient_count integer default 0,
  created_at    timestamptz default now()
);

-- ── A4: Platform Content (ToS, Privacy Policy, FAQ) ──────────────
create table if not exists platform_content (
  id              uuid default gen_random_uuid() primary key,
  content_type    text unique not null,  -- 'terms_of_service' | 'privacy_policy' | 'faq'
  body            text,
  version         integer default 1,
  pending_body    text,                  -- draft pending second-admin approval
  pending_by      uuid references admin_users(id),
  approved_by     uuid references admin_users(id),
  updated_at      timestamptz default now()
);

-- Seed default content rows
insert into platform_content (content_type, body) values
  ('terms_of_service', 'BazarHQ Terms of Service — Version 1.0'),
  ('privacy_policy',   'BazarHQ Privacy Policy — Version 1.0'),
  ('faq',              '[]')
on conflict (content_type) do nothing;

-- ── Indexes ───────────────────────────────────────────────────────
create index if not exists idx_audit_log_admin_id   on admin_audit_log(admin_id);
create index if not exists idx_audit_log_action     on admin_audit_log(action);
create index if not exists idx_audit_log_created_at on admin_audit_log(created_at desc);
create index if not exists idx_stores_account_status on stores(account_status);
create index if not exists idx_health_log_checked_at on system_health_log(checked_at desc);

-- ════════════════════════════════════════════════════════════════
-- Tables created:
--   admin_users          (admin accounts, TOTP, IP whitelist)
--   admin_audit_log      (immutable action log)
--   system_health_log    (service health checks)
--   platform_announcements (broadcast messages)
--   platform_content     (ToS, Privacy Policy, FAQ)
-- Columns added to stores:
--   suspended_at, suspended_reason, account_status
-- ════════════════════════════════════════════════════════════════
