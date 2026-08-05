-- =============================================================================
-- BazarHQ CURRENT MIGRATION 0006
-- Production Super Admin data model and privileged RPC support
-- =============================================================================
-- IMPORTANT:
--   Super Admin browser pages use custom admin sessions through Edge Functions.
--   Privileged RPCs below are granted to service_role only.
--   No hardcoded admin email, password, UUID or TOTP secret is included.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Admin identities, sessions, challenges and allowlist
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

create unique index if not exists admin_users_email_lower_uidx
  on public.admin_users(lower(email));

create table if not exists public.admin_ip_allowlist (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  ip_value text not null,
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists admin_ip_allowlist_active_idx
  on public.admin_ip_allowlist(is_active);

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.admin_users(id) on delete cascade,
  token_hash text not null unique,
  ip_address text,
  user_agent text,
  expires_at timestamptz not null,
  idle_expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists admin_sessions_admin_idx
  on public.admin_sessions(admin_id,created_at desc);
create index if not exists admin_sessions_token_hash_idx
  on public.admin_sessions(token_hash);

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

-- ---------------------------------------------------------------------------
-- Immutable audit log
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  admin_email text,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log
  add column if not exists admin_id uuid,
  add column if not exists admin_email text,
  add column if not exists action text,
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists details jsonb default '{}'::jsonb,
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists created_at timestamptz default now();

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log(created_at desc);
create index if not exists admin_audit_log_action_idx
  on public.admin_audit_log(action,created_at desc);
create index if not exists admin_audit_log_target_idx
  on public.admin_audit_log(target_type,target_id);

create or replace function public.prevent_admin_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  raise exception 'Admin audit logs are immutable';
end $$;

drop trigger if exists admin_audit_log_immutable_update
  on public.admin_audit_log;
create trigger admin_audit_log_immutable_update
before update or delete on public.admin_audit_log
for each row execute function public.prevent_admin_audit_mutation();

-- Drop prior callers before changing an older write_admin_audit return type.
drop function if exists public.request_admin_report(text,date,date,text,uuid,text);
drop function if exists public.send_platform_announcement(uuid);
drop function if exists public.send_platform_announcement(uuid,text);
drop function if exists public.submit_platform_content(uuid,text);
drop function if exists public.approve_platform_content(uuid,text);
drop function if exists public.publish_platform_content(uuid,text);
drop function if exists public.write_admin_audit(
  uuid,text,text,text,text,jsonb,text,text
);

create function public.write_admin_audit(
  p_admin_id uuid,
  p_admin_email text,
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_details jsonb default '{}'::jsonb,
  p_ip_address text default null,
  p_user_agent text default null
)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id text;
begin
  insert into public.admin_audit_log(
    admin_id,admin_email,action,target_type,target_id,
    details,ip_address,user_agent
  )
  values(
    p_admin_id,p_admin_email,p_action,p_target_type,p_target_id,
    coalesce(p_details,'{}'::jsonb),p_ip_address,p_user_agent
  )
  returning id::text into v_id;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Admin alert recipients and report jobs
-- ---------------------------------------------------------------------------
create table if not exists public.admin_alert_recipients (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  alert_failed_login boolean not null default true,
  alert_system_outage boolean not null default true,
  alert_reports boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.admin_alert_recipients(email)
select email
from public.admin_users
where email is not null
on conflict(email) do nothing;

create or replace function public.queue_admin_alert(
  p_subject text,
  p_body text,
  p_kind text default 'general'
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer:=0;
begin
  insert into public.email_notification_queue(
    recipient_email,to_email,subject,body
  )
  select
    r.email,r.email,p_subject,p_body
  from public.admin_alert_recipients r
  where r.is_active=true
    and (
      p_kind='general'
      or (p_kind='failed_login' and r.alert_failed_login=true)
      or (p_kind='system_outage' and r.alert_system_outage=true)
      or (p_kind='report' and r.alert_reports=true)
    );

  get diagnostics v_count=row_count;
  return v_count;
end $$;

create table if not exists public.admin_report_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid,
  requested_by_email text,
  report_type text not null default 'platform_analytics',
  date_from date,
  date_to date,
  status text not null default 'queued',
  result_csv text,
  result_url text,
  recipient_email text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  emailed_at timestamptz
);
create index if not exists admin_report_jobs_status_idx
  on public.admin_report_jobs(status,created_at);

create or replace function public.request_admin_report(
  p_report_type text,
  p_date_from date,
  p_date_to date,
  p_recipient_email text,
  p_admin_id uuid default null,
  p_admin_email text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  insert into public.admin_report_jobs(
    report_type,date_from,date_to,recipient_email,
    requested_by,requested_by_email
  )
  values(
    coalesce(nullif(p_report_type,''),'platform_analytics'),
    p_date_from,p_date_to,p_recipient_email,p_admin_id,p_admin_email
  )
  returning id into v_id;

  perform public.write_admin_audit(
    p_admin_id,p_admin_email,'report.queued',
    'admin_report_job',v_id::text,
    jsonb_build_object(
      'report_type',p_report_type,
      'date_from',p_date_from,
      'date_to',p_date_to
    )
  );

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Health log and incident model
-- ---------------------------------------------------------------------------
create table if not exists public.system_health_log (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  status text not null,
  response_ms integer,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

alter table public.system_health_log
  add column if not exists service text,
  add column if not exists status text,
  add column if not exists response_ms integer,
  add column if not exists message text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists checked_at timestamptz default now();

create index if not exists system_health_log_service_idx
  on public.system_health_log(service,checked_at desc);
create index if not exists system_health_log_checked_idx
  on public.system_health_log(checked_at desc);

create table if not exists public.system_incidents (
  id uuid primary key default gen_random_uuid(),
  service text,
  service_name text,
  title text,
  description text,
  message text,
  severity text not null default 'medium',
  status text not null default 'open',
  opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by text,
  updated_at timestamptz not null default now()
);

alter table public.system_incidents
  add column if not exists service text,
  add column if not exists service_name text,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists message text,
  add column if not exists severity text default 'medium',
  add column if not exists status text default 'open',
  add column if not exists opened_at timestamptz default now(),
  add column if not exists created_at timestamptz default now(),
  add column if not exists resolved_at timestamptz,
  add column if not exists created_by text,
  add column if not exists updated_at timestamptz default now();

update public.system_incidents
set service=coalesce(service,service_name),
    service_name=coalesce(service_name,service),
    title=coalesce(title,upper(coalesce(status,'incident'))||': '||
      coalesce(service,service_name,'service')),
    description=coalesce(description,message),
    message=coalesce(message,description),
    opened_at=coalesce(opened_at,created_at,now()),
    created_at=coalesce(created_at,opened_at,now());

create or replace function public.sync_system_incident_columns()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.service:=coalesce(new.service,new.service_name);
  new.service_name:=coalesce(new.service_name,new.service);
  new.description:=coalesce(new.description,new.message);
  new.message:=coalesce(new.message,new.description);
  new.opened_at:=coalesce(new.opened_at,new.created_at,now());
  new.created_at:=coalesce(new.created_at,new.opened_at,now());
  new.updated_at:=now();
  return new;
end $$;

drop trigger if exists system_incidents_sync_tg
  on public.system_incidents;
create trigger system_incidents_sync_tg
before insert or update on public.system_incidents
for each row execute function public.sync_system_incident_columns();

create index if not exists system_incidents_status_idx
  on public.system_incidents(status,opened_at desc);

drop function if exists public.record_system_health(text,text,integer,text);
create function public.record_system_health(
  p_service_name text,
  p_status text,
  p_response_ms integer default null,
  p_message text default null
)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id text;
  v_incident uuid;
  v_normalized_status text:=lower(coalesce(p_status,'down'));
begin
  insert into public.system_health_log(
    service,status,response_ms,message
  )
  values(
    p_service_name,v_normalized_status,p_response_ms,p_message
  )
  returning id::text into v_id;

  if v_normalized_status in ('degraded','down','warning','critical') then
    select id into v_incident
    from public.system_incidents
    where coalesce(service,service_name)=p_service_name
      and status='open'
    order by opened_at desc
    limit 1;

    if v_incident is null then
      insert into public.system_incidents(
        service,service_name,title,description,message,severity,status
      )
      values(
        p_service_name,p_service_name,
        upper(v_normalized_status)||': '||p_service_name,
        p_message,p_message,
        case when v_normalized_status in ('down','critical')
          then 'critical' else 'high' end,
        'open'
      )
      returning id into v_incident;

      perform public.queue_admin_alert(
        'BazarHQ system alert: '||p_service_name,
        coalesce(p_message,v_normalized_status),
        'system_outage'
      );
    end if;
  elsif v_normalized_status in ('operational','healthy','up') then
    update public.system_incidents
    set status='resolved',resolved_at=now(),updated_at=now()
    where coalesce(service,service_name)=p_service_name
      and status='open';
  end if;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
create table if not exists public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all_merchants',
  priority text not null default 'normal',
  status text not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  locked_at timestamptz,
  cancelled_at timestamptz,
  recipient_count integer not null default 0,
  created_by text,
  sent_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_announcements
  add column if not exists audience text default 'all_merchants',
  add column if not exists priority text default 'normal',
  add column if not exists status text default 'draft',
  add column if not exists scheduled_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists recipient_count integer default 0,
  add column if not exists created_by text,
  add column if not exists sent_by text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists platform_announcements_status_idx
  on public.platform_announcements(status,scheduled_at);

create or replace function public.prevent_sent_announcement_mutation()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if old.status='sent' then
    raise exception 'Sent announcements cannot be edited, deleted, or recalled';
  end if;

  if tg_op='DELETE' then
    return old;
  end if;
  return new;
end $$;

drop trigger if exists platform_announcements_sent_lock_update
  on public.platform_announcements;
create trigger platform_announcements_sent_lock_update
before update or delete on public.platform_announcements
for each row execute function public.prevent_sent_announcement_mutation();

create function public.send_platform_announcement(
  p_announcement_id uuid,
  p_admin_email text default null
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_ann public.platform_announcements%rowtype;
  v_count integer:=0;
begin
  select * into v_ann
  from public.platform_announcements
  where id=p_announcement_id
  for update;

  if not found then
    raise exception 'Announcement not found';
  end if;
  if v_ann.status='sent' then
    raise exception 'Announcement already sent and locked';
  end if;
  if v_ann.status='cancelled' then
    raise exception 'Cancelled announcement cannot be sent';
  end if;

  insert into public.merchant_notifications(
    store_id,merchant_id,type,title,message,body,
    action_url,link_url,metadata,is_read
  )
  select
    s.id,s.owner_id,
    case when v_ann.priority='critical' then 'warning' else 'announcement' end,
    v_ann.title,v_ann.body,v_ann.body,
    '/merchant','/merchant',
    jsonb_build_object(
      'announcement_id',v_ann.id,
      'priority',v_ann.priority,
      'audience',v_ann.audience
    ),
    false
  from public.stores s
  where coalesce(s.account_status,'active')<>'deleted'
    and (
      v_ann.audience='all_merchants'
      or (
        v_ann.audience='active_merchants'
        and coalesce(s.account_status,'active')='active'
      )
      or (
        v_ann.audience='live_stores'
        and coalesce(s.storefront_published,false)=true
      )
    );

  get diagnostics v_count=row_count;

  insert into public.email_notification_queue(
    store_id,recipient_email,to_email,subject,body
  )
  select
    s.id,
    coalesce(p.email,s.contact_email),
    coalesce(p.email,s.contact_email),
    '[BazarHQ] '||v_ann.title,
    v_ann.body
  from public.stores s
  left join public.profiles p on p.id=s.owner_id
  where coalesce(s.account_status,'active')<>'deleted'
    and coalesce(p.email,s.contact_email) is not null;

  update public.platform_announcements
  set
    status='sent',
    sent_at=now(),
    locked_at=now(),
    sent_by=p_admin_email,
    recipient_count=v_count,
    updated_at=now()
  where id=p_announcement_id;

  perform public.write_admin_audit(
    null,p_admin_email,'announcement.sent',
    'platform_announcement',p_announcement_id::text,
    jsonb_build_object('recipient_count',v_count)
  );

  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Content / policy workflow with second-admin approval
-- ---------------------------------------------------------------------------
create table if not exists public.platform_content (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  title text,
  body text,
  pending_body text,
  status text not null default 'draft',
  version integer not null default 1,
  effective_at timestamptz,
  submitted_by text,
  submitted_at timestamptz,
  pending_by uuid,
  approved_by text,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_content
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists pending_body text,
  add column if not exists status text default 'draft',
  add column if not exists version integer default 1,
  add column if not exists effective_at timestamptz,
  add column if not exists submitted_by text,
  add column if not exists submitted_at timestamptz,
  add column if not exists pending_by uuid,
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists platform_content_type_uidx
  on public.platform_content(content_type);

insert into public.platform_content(
  content_type,title,body,status,version,published_at,effective_at
)
values
  (
    'terms','Terms of Service',
    'BazarHQ terms of service will be published here.',
    'published',1,now(),now()
  ),
  (
    'privacy','Privacy Policy',
    'BazarHQ privacy policy will be published here.',
    'published',1,now(),now()
  ),
  (
    'faq','Frequently Asked Questions',
    'BazarHQ frequently asked questions will be published here.',
    'published',1,now(),now()
  ),
  (
    'merchant_policy','Merchant Policy',
    'Merchants must provide accurate product, price and delivery information.',
    'published',1,now(),now()
  ),
  (
    'customer_policy','Customer Policy',
    'Final order placement requires an authenticated customer.',
    'published',1,now(),now()
  )
on conflict(content_type) do nothing;

create or replace function public.submit_platform_content(
  p_content_id uuid,
  p_admin_email text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.platform_content
  set
    status='pending_approval',
    submitted_by=p_admin_email,
    submitted_at=now(),
    updated_at=now()
  where id=p_content_id;

  if not found then
    raise exception 'Content not found';
  end if;

  perform public.write_admin_audit(
    null,p_admin_email,'content.submitted',
    'platform_content',p_content_id::text,'{}'::jsonb
  );
end $$;

create or replace function public.approve_platform_content(
  p_content_id uuid,
  p_admin_email text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_content public.platform_content%rowtype;
begin
  select * into v_content
  from public.platform_content
  where id=p_content_id
  for update;

  if not found then
    raise exception 'Content not found';
  end if;
  if v_content.status<>'pending_approval' then
    raise exception 'Only pending content can be approved';
  end if;
  if lower(coalesce(v_content.submitted_by,''))=
     lower(coalesce(p_admin_email,'')) then
    raise exception 'A second Super Admin must approve this policy';
  end if;

  update public.platform_content
  set
    status='approved',
    approved_by=p_admin_email,
    approved_at=now(),
    updated_at=now()
  where id=p_content_id;

  perform public.write_admin_audit(
    null,p_admin_email,'content.approved',
    'platform_content',p_content_id::text,'{}'::jsonb
  );
end $$;

create or replace function public.publish_platform_content(
  p_content_id uuid,
  p_admin_email text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_content public.platform_content%rowtype;
begin
  select * into v_content
  from public.platform_content
  where id=p_content_id
  for update;

  if not found then
    raise exception 'Content not found';
  end if;
  if v_content.status<>'approved' then
    raise exception 'Only approved content can be published';
  end if;

  update public.platform_content
  set
    body=coalesce(nullif(pending_body,''),body),
    pending_body=null,
    status='published',
    published_at=now(),
    effective_at=coalesce(effective_at,now()),
    version=coalesce(version,1)+1,
    updated_at=now()
  where id=p_content_id;

  perform public.write_admin_audit(
    null,p_admin_email,'content.published',
    'platform_content',p_content_id::text,'{}'::jsonb
  );
end $$;

-- ---------------------------------------------------------------------------
-- Store moderation RPC used by Super Admin Edge Functions
-- ---------------------------------------------------------------------------
drop trigger if exists stores_suspension_notice on public.stores;
drop function if exists public.store_suspension_notice_trigger();
drop function if exists public.superadmin_set_store_status(uuid,text,text);

create function public.superadmin_set_store_status(
  p_store_id uuid,
  p_action text,
  p_reason text default null
)
returns table(
  id uuid,
  account_status text,
  storefront_published boolean,
  suspended_reason text,
  suspended_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_owner_id uuid;
  v_title text;
  v_message text;
  v_email text;
begin
  if p_action not in ('suspend','reinstate','delete') then
    raise exception 'Invalid action';
  end if;
  if p_action='suspend' and coalesce(trim(p_reason),'')='' then
    raise exception 'Suspension reason is required';
  end if;

  select s.owner_id,coalesce(p.email,s.contact_email)
  into v_owner_id,v_email
  from public.stores s
  left join public.profiles p on p.id=s.owner_id
  where s.id=p_store_id;

  if v_owner_id is null then
    raise exception 'Store not found';
  end if;

  if p_action='suspend' then
    update public.stores
    set
      account_status='suspended',
      storefront_published=false,
      suspended_reason=trim(p_reason),
      suspended_at=now(),
      deleted_at=null,
      updated_at=now()
    where stores.id=p_store_id;

    v_title:='Your store has been suspended';
    v_message:='BazarHQ suspended your storefront. Reason: '||trim(p_reason);
  elsif p_action='reinstate' then
    update public.stores
    set
      account_status='active',
      suspended_reason=null,
      suspended_at=null,
      deleted_at=null,
      cleanup_status='none',
      updated_at=now()
    where stores.id=p_store_id;

    v_title:='Your store has been reinstated';
    v_message:='BazarHQ reinstated your store. You may publish it again.';
  else
    update public.stores
    set
      account_status='deleted',
      storefront_published=false,
      suspended_reason=coalesce(
        nullif(trim(p_reason),''),
        'Store deleted by BazarHQ.'
      ),
      suspended_at=now(),
      deleted_at=now(),
      deletion_scheduled_at=now()+interval '30 days',
      cleanup_status='scheduled',
      updated_at=now()
    where stores.id=p_store_id;

    v_title:='Your store has been deleted';
    v_message:='BazarHQ deleted this storefront. It is no longer public.';
  end if;

  insert into public.merchant_notifications(
    store_id,merchant_id,type,title,message,body,
    action_url,link_url,metadata,is_read
  )
  values(
    p_store_id,v_owner_id,'store_'||p_action,
    v_title,v_message,v_message,
    '/merchant/settings','/merchant/settings',
    jsonb_build_object(
      'store_id',p_store_id,
      'action',p_action,
      'reason',p_reason
    ),
    false
  );

  if v_email is not null then
    insert into public.email_notification_queue(
      store_id,recipient_email,to_email,subject,body
    )
    values(
      p_store_id,v_email,v_email,v_title,v_message
    );
  end if;

  return query
  select
    s.id,s.account_status,s.storefront_published,
    s.suspended_reason,s.suspended_at,s.deleted_at
  from public.stores s
  where s.id=p_store_id;
end $$;

-- ---------------------------------------------------------------------------
-- Lock private tables and privileged functions to service role.
-- ---------------------------------------------------------------------------
alter table public.admin_users enable row level security;
alter table public.admin_ip_allowlist enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.admin_login_challenges enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.admin_alert_recipients enable row level security;
alter table public.admin_report_jobs enable row level security;
alter table public.system_health_log enable row level security;
alter table public.system_incidents enable row level security;
alter table public.platform_announcements enable row level security;

revoke all on public.admin_users from anon,authenticated;
revoke all on public.admin_ip_allowlist from anon,authenticated;
revoke all on public.admin_sessions from anon,authenticated;
revoke all on public.admin_login_challenges from anon,authenticated;
revoke all on public.admin_audit_log from anon,authenticated;
revoke all on public.admin_alert_recipients from anon,authenticated;
revoke all on public.admin_report_jobs from anon,authenticated;
revoke all on public.system_health_log from anon,authenticated;
revoke all on public.system_incidents from anon,authenticated;
revoke all on public.platform_announcements from anon,authenticated;

revoke all on function public.write_admin_audit(
  uuid,text,text,text,text,jsonb,text,text
) from public;
revoke all on function public.queue_admin_alert(text,text,text) from public;
revoke all on function public.request_admin_report(
  text,date,date,text,uuid,text
) from public;
revoke all on function public.record_system_health(
  text,text,integer,text
) from public;
revoke all on function public.send_platform_announcement(uuid,text)
  from public;
revoke all on function public.submit_platform_content(uuid,text)
  from public;
revoke all on function public.approve_platform_content(uuid,text)
  from public;
revoke all on function public.publish_platform_content(uuid,text)
  from public;
revoke all on function public.superadmin_set_store_status(uuid,text,text)
  from public;

grant execute on function public.write_admin_audit(
  uuid,text,text,text,text,jsonb,text,text
) to service_role;
grant execute on function public.queue_admin_alert(text,text,text)
  to service_role;
grant execute on function public.request_admin_report(
  text,date,date,text,uuid,text
) to service_role;
grant execute on function public.record_system_health(
  text,text,integer,text
) to service_role;
grant execute on function public.send_platform_announcement(uuid,text)
  to service_role;
grant execute on function public.submit_platform_content(uuid,text)
  to service_role;
grant execute on function public.approve_platform_content(uuid,text)
  to service_role;
grant execute on function public.publish_platform_content(uuid,text)
  to service_role;
grant execute on function public.superadmin_set_store_status(uuid,text,text)
  to service_role;

notify pgrst,'reload schema';
