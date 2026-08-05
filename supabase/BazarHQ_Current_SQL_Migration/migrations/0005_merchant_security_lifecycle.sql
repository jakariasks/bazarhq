-- =============================================================================
-- BazarHQ CURRENT MIGRATION 0005
-- Merchant profile, store lifecycle, limits, sessions and recovery codes
-- =============================================================================

create extension if not exists pgcrypto;

-- Merchant profile fields used by auth, onboarding and store switching.
alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists current_store_id uuid,
  add column if not exists plan_tier text default 'free',
  add column if not exists onboarding_progress jsonb default '{}'::jsonb,
  add column if not exists onboarding_step text,
  add column if not exists email_change_requested_at timestamptz,
  add column if not exists pending_email text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.profiles
set plan_tier='free'
where plan_tier is null
   or plan_tier not in ('free','pro','business','enterprise');

alter table public.profiles
  alter column plan_tier set default 'free';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='profiles_plan_tier_check'
      and conrelid='public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_plan_tier_check
      check (plan_tier in ('free','pro','business','enterprise'));
  end if;
end $$;

create unique index if not exists profiles_email_lower_uidx
  on public.profiles(lower(email))
  where email is not null;

-- Store status, onboarding and delayed cleanup.
alter table public.stores
  add column if not exists account_status text default 'active',
  add column if not exists suspended_reason text,
  add column if not exists suspended_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_scheduled_at timestamptz,
  add column if not exists permanently_deleted_at timestamptz,
  add column if not exists cleanup_status text default 'none',
  add column if not exists onboarding_progress jsonb default '{}'::jsonb,
  add column if not exists onboarding_step text,
  add column if not exists onboarding_completed boolean default false,
  add column if not exists low_stock_threshold integer default 5;

update public.stores
set account_status='active'
where account_status is null
   or account_status not in ('active','suspended','deleted');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='stores_account_status_check'
      and conrelid='public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_account_status_check
      check (account_status in ('active','suspended','deleted'));
  end if;
end $$;

create index if not exists stores_owner_status_idx
  on public.stores(owner_id,account_status);
create index if not exists stores_subdomain_public_status_idx
  on public.stores(subdomain,storefront_published,account_status);

-- Product fields used by current Merchant Products and storefront logic.
alter table public.products
  add column if not exists category text,
  add column if not exists tags text[] default '{}',
  add column if not exists has_variants boolean default false,
  add column if not exists variant_types jsonb default '[]'::jsonb,
  add column if not exists variants jsonb default '[]'::jsonb,
  add column if not exists low_stock_threshold integer default 5,
  add column if not exists image_provider text default 'supabase',
  add column if not exists image_metadata jsonb default '{}'::jsonb,
  add column if not exists average_rating numeric(3,2) default 0,
  add column if not exists rating_count integer default 0;

alter table public.stores
  add column if not exists categories text[] default '{}';

-- Keep JSON variant stock/status normalized.
create or replace function public.normalize_product_variants_stock()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_item jsonb;
  v_next jsonb:='[]'::jsonb;
  v_stock integer;
begin
  if new.variants is not null and jsonb_typeof(new.variants)='array' then
    for v_item in select * from jsonb_array_elements(new.variants)
    loop
      v_stock:=coalesce(nullif(v_item->>'stock','')::integer,0);
      if v_stock<=0 then
        v_item:=v_item || jsonb_build_object(
          'stock',0,'available',false,'status','unavailable'
        );
      else
        v_item:=v_item || jsonb_build_object(
          'available',true,
          'status',case
            when coalesce(v_item->>'status','')='unavailable' then 'available'
            else coalesce(nullif(v_item->>'status',''),'available')
          end
        );
      end if;
      v_next:=v_next || jsonb_build_array(v_item);
    end loop;
    new.variants:=v_next;
  end if;

  new.stock:=greatest(coalesce(new.stock,0),0);
  new.updated_at:=now();
  return new;
end $$;

drop trigger if exists products_normalize_variants_stock_tg on public.products;
create trigger products_normalize_variants_stock_tg
before insert or update of variants,stock on public.products
for each row execute function public.normalize_product_variants_stock();

-- Merchant session inventory and MFA recovery codes.
create table if not exists public.merchant_active_sessions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id) on delete cascade,
  session_fingerprint text not null,
  device_label text,
  user_agent text,
  ip_address text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(merchant_id,session_fingerprint)
);

create table if not exists public.merchant_mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique(merchant_id,code_hash)
);

create index if not exists merchant_sessions_merchant_idx
  on public.merchant_active_sessions(merchant_id,last_seen_at desc);
create index if not exists merchant_recovery_unused_idx
  on public.merchant_mfa_recovery_codes(merchant_id)
  where used_at is null;

-- One auth trigger handles merchant/customer role-specific profile creation.
create or replace function public.handle_new_bazarhq_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text:=lower(coalesce(new.raw_user_meta_data->>'role',''));
  v_name text:=nullif(
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      ''
    ),
    ''
  );
begin
  if v_role='merchant' then
    insert into public.profiles(
      id,email,full_name,plan_tier,created_at,updated_at
    )
    values(
      new.id,
      lower(new.email),
      coalesce(v_name,split_part(new.email,'@',1)),
      coalesce(nullif(new.raw_user_meta_data->>'plan_tier',''),'free'),
      coalesce(new.created_at,now()),
      now()
    )
    on conflict(id) do update set
      email=excluded.email,
      full_name=coalesce(public.profiles.full_name,excluded.full_name),
      plan_tier=coalesce(public.profiles.plan_tier,excluded.plan_tier,'free'),
      updated_at=now();
  elsif v_role='customer' then
    insert into public.customer_profiles(id,full_name,phone,account_status,updated_at)
    values(
      new.id,
      v_name,
      nullif(new.raw_user_meta_data->>'phone',''),
      'active',
      now()
    )
    on conflict(id) do update set
      full_name=coalesce(excluded.full_name,public.customer_profiles.full_name),
      phone=coalesce(excluded.phone,public.customer_profiles.phone),
      account_status='active',
      updated_at=now();
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_merchant_profile on auth.users;
drop trigger if exists on_auth_customer_created on auth.users;
drop trigger if exists on_auth_user_profile_sync_insert on auth.users;
drop trigger if exists on_auth_user_created_bazarhq on auth.users;
create trigger on_auth_user_created_bazarhq
after insert on auth.users
for each row execute function public.handle_new_bazarhq_user();

create or replace function public.sync_bazarhq_auth_email()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.profiles
  set email=lower(new.email),updated_at=now()
  where id=new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_profile_sync_update on auth.users;
drop trigger if exists on_auth_user_email_sync on auth.users;
create trigger on_auth_user_email_sync
after update of email on auth.users
for each row execute function public.sync_bazarhq_auth_email();

-- Backfill merchant profiles from current auth metadata.
insert into public.profiles(id,email,full_name,plan_tier,created_at,updated_at)
select
  u.id,
  lower(u.email),
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name',''),
    nullif(u.raw_user_meta_data->>'name',''),
    split_part(u.email,'@',1)
  ),
  coalesce(nullif(u.raw_user_meta_data->>'plan_tier',''),'free'),
  coalesce(u.created_at,now()),
  now()
from auth.users u
where lower(coalesce(u.raw_user_meta_data->>'role',''))='merchant'
on conflict(id) do update set
  email=excluded.email,
  full_name=coalesce(public.profiles.full_name,excluded.full_name),
  plan_tier=coalesce(public.profiles.plan_tier,excluded.plan_tier,'free'),
  updated_at=now();

-- Database-level free-plan store limit.
create or replace function public.enforce_free_plan_store_limit()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_plan text;
  v_count integer;
begin
  select coalesce(plan_tier,'free')
  into v_plan
  from public.profiles
  where id=new.owner_id;

  v_plan:=coalesce(v_plan,'free');

  if v_plan='free' and coalesce(new.account_status,'active')<>'deleted' then
    select count(*)
    into v_count
    from public.stores s
    where s.owner_id=new.owner_id
      and s.id<>coalesce(
        new.id,
        '00000000-0000-0000-0000-000000000000'::uuid
      )
      and coalesce(s.account_status,'active')<>'deleted';

    if v_count>=1 then
      raise exception 'Free plan allows only one store per merchant account.'
        using errcode='P0001';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists stores_free_plan_limit_guard on public.stores;
create trigger stores_free_plan_limit_guard
before insert or update of owner_id,account_status
on public.stores
for each row execute function public.enforce_free_plan_store_limit();

create or replace function public.get_merchant_store_limit()
returns table(
  plan_tier text,
  store_count integer,
  store_limit integer,
  can_create boolean,
  existing_store_id uuid,
  existing_store_name text,
  existing_subdomain text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_plan text:='free';
  v_count integer:=0;
  v_limit integer:=1;
  v_store record;
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode='P0001';
  end if;

  select coalesce(p.plan_tier,'free')
  into v_plan
  from public.profiles p
  where p.id=v_uid;

  v_plan:=coalesce(v_plan,'free');
  v_limit:=case when v_plan='free' then 1 else 2147483647 end;

  select count(*) into v_count
  from public.stores s
  where s.owner_id=v_uid
    and coalesce(s.account_status,'active')<>'deleted';

  select s.id,s.shop_name,s.subdomain
  into v_store
  from public.stores s
  where s.owner_id=v_uid
    and coalesce(s.account_status,'active')<>'deleted'
  order by s.created_at
  limit 1;

  return query select
    v_plan,
    v_count,
    v_limit,
    v_count<v_limit,
    v_store.id,
    v_store.shop_name,
    v_store.subdomain;
end $$;

revoke all on function public.get_merchant_store_limit() from public;
grant execute on function public.get_merchant_store_limit()
  to authenticated;

-- Merchant self-delete is a reversible soft delete until scheduled cleanup.
create or replace function public.merchant_delete_store(p_store_id uuid)
returns table(
  id uuid,
  account_status text,
  storefront_published boolean,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode='P0001';
  end if;

  if not exists(
    select 1 from public.stores
    where stores.id=p_store_id
      and stores.owner_id=v_uid
  ) then
    raise exception 'Store not found or not allowed.' using errcode='P0001';
  end if;

  update public.stores
  set
    account_status='deleted',
    storefront_published=false,
    suspended_reason='Deleted by merchant from account settings.',
    deleted_at=now(),
    deletion_scheduled_at=now()+interval '30 days',
    cleanup_status='scheduled',
    updated_at=now()
  where stores.id=p_store_id
    and stores.owner_id=v_uid;

  update public.profiles
  set current_store_id=null,updated_at=now()
  where profiles.id=v_uid
    and profiles.current_store_id=p_store_id;

  insert into public.merchant_notifications(
    store_id,merchant_id,type,title,message,body,
    action_url,link_url,metadata,is_read
  )
  values(
    p_store_id,v_uid,'store_deleted_by_merchant',
    'Store deleted',
    'You deleted this store. The public storefront is unavailable.',
    'You deleted this store. The public storefront is unavailable.',
    '/merchant','/merchant',
    jsonb_build_object('store_id',p_store_id),
    false
  );

  return query
  select s.id,s.account_status,s.storefront_published,s.deleted_at
  from public.stores s
  where s.id=p_store_id;
end $$;

revoke all on function public.merchant_delete_store(uuid) from public;
grant execute on function public.merchant_delete_store(uuid)
  to authenticated;

create table if not exists public.deletion_cleanup_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid,
  owner_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.cleanup_deleted_stores_older_than_30_days()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_store record;
  v_cleaned integer:=0;
begin
  for v_store in
    select id,owner_id,shop_name,subdomain
    from public.stores
    where account_status='deleted'
      and deleted_at<now()-interval '30 days'
      and permanently_deleted_at is null
  loop
    update public.products
    set
      status='archived',
      images='{}',
      description=null,
      variants='[]'::jsonb,
      variant_types='[]'::jsonb,
      updated_at=now()
    where store_id=v_store.id;

    update public.stores
    set
      storefront_published=false,
      shop_name='[deleted store]',
      tagline=null,
      description=null,
      logo_url=null,
      banner_url=null,
      hero_banner_urls='[]'::jsonb,
      about_image_url=null,
      about_mission=null,
      contact_email=null,
      phone=null,
      whatsapp_number=null,
      website_url=null,
      address=null,
      cleanup_status='cleaned',
      permanently_deleted_at=now(),
      updated_at=now()
    where id=v_store.id;

    insert into public.deletion_cleanup_log(
      store_id,owner_id,action,details
    )
    values(
      v_store.id,
      v_store.owner_id,
      'store_cleanup_30_days',
      jsonb_build_object(
        'old_shop_name',v_store.shop_name,
        'old_subdomain',v_store.subdomain
      )
    );

    v_cleaned:=v_cleaned+1;
  end loop;

  return v_cleaned;
end $$;

revoke all on function public.cleanup_deleted_stores_older_than_30_days()
  from public;
grant execute on function public.cleanup_deleted_stores_older_than_30_days()
  to service_role;

-- Detach already deleted stores from current_store_id.
update public.profiles p
set current_store_id=null,updated_at=now()
where exists(
  select 1 from public.stores s
  where s.id=p.current_store_id
    and (
      coalesce(s.account_status,'active')='deleted'
      or s.deleted_at is not null
    )
);

notify pgrst,'reload schema';
