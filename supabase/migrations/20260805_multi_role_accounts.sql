-- BazarHQ multi-role account architecture
-- One Supabase Auth identity can safely hold both customer and merchant roles.

begin;

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.customer_profiles') is null
     or to_regclass('public.customer_addresses') is null then
    raise exception 'BazarHQ multi-role migration requires profiles, customer_profiles, and customer_addresses.';
  end if;
end $$;

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('merchant','customer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index if not exists user_roles_role_user_idx
  on public.user_roles(role,user_id);

alter table public.user_roles enable row level security;

revoke all on public.user_roles from anon;
revoke insert,update,delete on public.user_roles from authenticated;
grant select on public.user_roles to authenticated;

-- A signed-in user may only see their own role memberships.
drop policy if exists user_roles_own_select on public.user_roles;
create policy user_roles_own_select
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.set_user_roles_updated_at()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at:=now();
  return new;
end $$;

drop trigger if exists user_roles_updated_at_tg on public.user_roles;
create trigger user_roles_updated_at_tg
before update on public.user_roles
for each row execute function public.set_user_roles_updated_at();

-- Keep legacy auth metadata informative, but never use it as the authority.
-- The public.user_roles table is authoritative.
create or replace function public.sync_auth_user_role_metadata()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid;
  v_roles text[];
  v_primary_role text;
begin
  if tg_op='DELETE' then v_user_id:=old.user_id; else v_user_id:=new.user_id; end if;

  select coalesce(array_agg(r.role order by case r.role when 'merchant' then 1 else 2 end),'{}'::text[])
  into v_roles
  from public.user_roles r
  where r.user_id=v_user_id;

  select case
    when 'merchant'=any(v_roles) then 'merchant'
    when 'customer'=any(v_roles) then 'customer'
    else null
  end into v_primary_role;

  update auth.users u
  set raw_user_meta_data =
      (coalesce(u.raw_user_meta_data,'{}'::jsonb) - 'roles' - 'role')
      || jsonb_build_object('roles',to_jsonb(v_roles))
      || case when v_primary_role is null then '{}'::jsonb else jsonb_build_object('role',v_primary_role) end,
      updated_at=now()
  where u.id=v_user_id;

  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists user_roles_sync_auth_metadata_tg on public.user_roles;
create trigger user_roles_sync_auth_metadata_tg
after insert or update or delete on public.user_roles
for each row execute function public.sync_auth_user_role_metadata();

-- Any legacy code path that creates a role-specific profile also creates the role membership.
create or replace function public.sync_merchant_role_from_profile()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.user_roles(user_id,role)
  values(new.id,'merchant')
  on conflict(user_id,role) do update set updated_at=now();
  return new;
end $$;

drop trigger if exists profiles_sync_merchant_role_tg on public.profiles;
create trigger profiles_sync_merchant_role_tg
after insert on public.profiles
for each row execute function public.sync_merchant_role_from_profile();

create or replace function public.sync_customer_role_from_profile()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.user_roles(user_id,role)
  values(new.id,'customer')
  on conflict(user_id,role) do update set updated_at=now();
  return new;
end $$;

drop trigger if exists customer_profiles_sync_customer_role_tg on public.customer_profiles;
create trigger customer_profiles_sync_customer_role_tg
after insert on public.customer_profiles
for each row execute function public.sync_customer_role_from_profile();

-- Backfill all current accounts. A user can intentionally receive both rows.
insert into public.user_roles(user_id,role)
select p.id,'merchant'
from public.profiles p
join auth.users u on u.id=p.id
on conflict(user_id,role) do nothing;

insert into public.user_roles(user_id,role)
select c.id,'customer'
from public.customer_profiles c
join auth.users u on u.id=c.id
on conflict(user_id,role) do nothing;

insert into public.user_roles(user_id,role)
select u.id,lower(u.raw_user_meta_data->>'role')
from auth.users u
where lower(coalesce(u.raw_user_meta_data->>'role','')) in ('merchant','customer')
on conflict(user_id,role) do nothing;

insert into public.user_roles(user_id,role)
select u.id,lower(role_value)
from auth.users u
cross join lateral jsonb_array_elements_text(
  case
    when jsonb_typeof(u.raw_user_meta_data->'roles')='array'
      then u.raw_user_meta_data->'roles'
    else '[]'::jsonb
  end
) as role_value
where lower(role_value) in ('merchant','customer')
on conflict(user_id,role) do nothing;

-- New Auth users receive their requested initial role while preserving support for both roles.
create or replace function public.handle_new_bazarhq_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text:=lower(coalesce(new.raw_user_meta_data->>'role',''));
  v_roles jsonb:=case
    when jsonb_typeof(new.raw_user_meta_data->'roles')='array' then new.raw_user_meta_data->'roles'
    else '[]'::jsonb
  end;
  v_name text:=nullif(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),'');
  v_phone text:=nullif(new.raw_user_meta_data->>'phone','');
  v_item text;
  v_has_merchant boolean:=false;
  v_has_customer boolean:=false;
begin
  if v_role='merchant' then v_has_merchant:=true; end if;
  if v_role='customer' then v_has_customer:=true; end if;

  for v_item in select value from jsonb_array_elements_text(v_roles)
  loop
    if lower(v_item)='merchant' then v_has_merchant:=true; end if;
    if lower(v_item)='customer' then v_has_customer:=true; end if;
  end loop;

  if v_has_merchant then
    insert into public.profiles(id,email,full_name,plan_tier,created_at,updated_at)
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

    insert into public.user_roles(user_id,role)
    values(new.id,'merchant')
    on conflict(user_id,role) do nothing;
  end if;

  if v_has_customer then
    insert into public.customer_profiles(id,full_name,phone,account_status,deleted_at,updated_at)
    values(new.id,v_name,v_phone,'active',null,now())
    on conflict(id) do update set
      full_name=coalesce(excluded.full_name,public.customer_profiles.full_name),
      phone=coalesce(excluded.phone,public.customer_profiles.phone),
      account_status='active',
      deleted_at=null,
      updated_at=now();

    insert into public.user_roles(user_id,role)
    values(new.id,'customer')
    on conflict(user_id,role) do nothing;
  end if;

  return new;
end $$;

-- Reinstall only the canonical BazarHQ signup trigger.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_merchant_profile on auth.users;
drop trigger if exists on_auth_customer_created on auth.users;
drop trigger if exists on_auth_user_profile_sync_insert on auth.users;
drop trigger if exists on_auth_user_created_bazarhq on auth.users;
create trigger on_auth_user_created_bazarhq
after insert on auth.users
for each row execute function public.handle_new_bazarhq_user();

-- Secure role reads for the current identity.
create or replace function public.get_my_roles()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'roles',
    coalesce(jsonb_agg(r.role order by case r.role when 'merchant' then 1 else 2 end),'[]'::jsonb)
  )
  from public.user_roles r
  where r.user_id=auth.uid();
$$;

revoke all on function public.get_my_roles() from public;
grant execute on function public.get_my_roles() to authenticated;

create or replace function public.has_my_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select auth.uid() is not null
     and lower(coalesce(p_role,'')) in ('merchant','customer')
     and exists(
       select 1 from public.user_roles r
       where r.user_id=auth.uid() and r.role=lower(p_role)
     );
$$;

revoke all on function public.has_my_role(text) from public;
grant execute on function public.has_my_role(text) to authenticated;

-- Explicitly adding Customer or Merchant access is allowed for a verified account.
-- No privileged/admin role can be added through this function.
create or replace function public.activate_my_role(
  p_role text,
  p_full_name text default null,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_role text:=lower(trim(coalesce(p_role,'')));
  v_user auth.users%rowtype;
  v_name text:=nullif(left(trim(coalesce(p_full_name,'')),120),'');
  v_phone text:=nullif(left(trim(coalesce(p_phone,'')),30),'');
  v_roles jsonb;
begin
  if v_uid is null then
    raise exception 'You must sign in before adding account access.' using errcode='P0001';
  end if;

  if v_role not in ('merchant','customer') then
    raise exception 'Unsupported account role.' using errcode='P0001';
  end if;

  select * into v_user from auth.users where id=v_uid;
  if not found then
    raise exception 'Account not found.' using errcode='P0001';
  end if;

  if v_user.email_confirmed_at is null then
    raise exception 'Verify your email before adding another account type.' using errcode='P0001';
  end if;

  v_name:=coalesce(
    v_name,
    nullif(v_user.raw_user_meta_data->>'full_name',''),
    nullif(v_user.raw_user_meta_data->>'name',''),
    split_part(v_user.email,'@',1)
  );
  v_phone:=coalesce(v_phone,nullif(v_user.raw_user_meta_data->>'phone',''));

  if v_role='merchant' then
    insert into public.profiles(id,email,full_name,plan_tier,created_at,updated_at)
    values(v_uid,lower(v_user.email),v_name,'free',coalesce(v_user.created_at,now()),now())
    on conflict(id) do update set
      email=excluded.email,
      full_name=coalesce(nullif(excluded.full_name,''),public.profiles.full_name),
      plan_tier=coalesce(public.profiles.plan_tier,'free'),
      updated_at=now();
  else
    insert into public.customer_profiles(id,full_name,phone,account_status,deleted_at,updated_at)
    values(v_uid,v_name,v_phone,'active',null,now())
    on conflict(id) do update set
      full_name=coalesce(nullif(excluded.full_name,''),public.customer_profiles.full_name),
      phone=coalesce(nullif(excluded.phone,''),public.customer_profiles.phone),
      account_status='active',
      deleted_at=null,
      updated_at=now();
  end if;

  insert into public.user_roles(user_id,role)
  values(v_uid,v_role)
  on conflict(user_id,role) do update set updated_at=now();

  select public.get_my_roles() into v_roles;
  return v_roles || jsonb_build_object('activated',v_role);
end $$;

revoke all on function public.activate_my_role(text,text,text) from public;
grant execute on function public.activate_my_role(text,text,text) to authenticated;

-- Customer deletion now removes only Customer access. A Merchant profile/store remains usable.
create or replace function public.delete_customer_account()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_remaining integer;
begin
  if v_uid is null then raise exception 'Customer login required'; end if;

  delete from public.customer_addresses where customer_id=v_uid;

  insert into public.customer_profiles(id,account_status,deleted_at,updated_at)
  values(v_uid,'deleted',now(),now())
  on conflict(id) do update set
    full_name=null,
    phone=null,
    account_status='deleted',
    deleted_at=now(),
    updated_at=now();

  delete from public.user_roles where user_id=v_uid and role='customer';
  select count(*) into v_remaining from public.user_roles where user_id=v_uid;

  return jsonb_build_object(
    'success',true,
    'removed_role','customer',
    'remaining_roles',v_remaining
  );
end $$;

revoke all on function public.delete_customer_account() from public;
grant execute on function public.delete_customer_account() to authenticated;

-- Trigger helpers are not public RPC endpoints.
revoke all on function public.set_user_roles_updated_at() from public;
revoke all on function public.sync_auth_user_role_metadata() from public;
revoke all on function public.sync_merchant_role_from_profile() from public;
revoke all on function public.sync_customer_role_from_profile() from public;
revoke all on function public.handle_new_bazarhq_user() from public;

-- Refresh metadata for all migrated users.
update auth.users u
set raw_user_meta_data =
  (coalesce(u.raw_user_meta_data,'{}'::jsonb) - 'roles' - 'role')
  || jsonb_build_object(
    'roles',
    coalesce((select jsonb_agg(r.role order by case r.role when 'merchant' then 1 else 2 end)
              from public.user_roles r where r.user_id=u.id),'[]'::jsonb)
  )
  || case
       when exists(select 1 from public.user_roles r where r.user_id=u.id and r.role='merchant')
         then jsonb_build_object('role','merchant')
       when exists(select 1 from public.user_roles r where r.user_id=u.id and r.role='customer')
         then jsonb_build_object('role','customer')
       else '{}'::jsonb
     end,
    updated_at=now()
where exists(select 1 from public.user_roles r where r.user_id=u.id);

notify pgrst,'reload schema';
commit;
