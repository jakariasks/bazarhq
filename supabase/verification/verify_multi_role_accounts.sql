-- Run after 20260805_multi_role_accounts.sql

select to_regclass('public.user_roles') is not null as user_roles_table_exists;

select
  to_regprocedure('public.get_my_roles()') is not null as get_my_roles_exists,
  to_regprocedure('public.has_my_role(text)') is not null as has_my_role_exists,
  to_regprocedure('public.activate_my_role(text,text,text)') is not null as activate_my_role_exists;

select
  count(*) filter (where role='merchant') as merchant_memberships,
  count(*) filter (where role='customer') as customer_memberships
from public.user_roles;

select count(*) as dual_role_accounts
from (
  select user_id
  from public.user_roles
  group by user_id
  having count(distinct role)=2
) x;

-- Every result below should be 0.
select count(*) as merchant_profiles_missing_role
from public.profiles p
where not exists(
  select 1 from public.user_roles r where r.user_id=p.id and r.role='merchant'
);

select count(*) as customer_profiles_missing_role
from public.customer_profiles c
where coalesce(c.account_status,'active')<>'deleted'
  and not exists(
    select 1 from public.user_roles r where r.user_id=c.id and r.role='customer'
  );

select count(*) as merchant_roles_missing_profile
from public.user_roles r
where r.role='merchant'
  and not exists(select 1 from public.profiles p where p.id=r.user_id);

select count(*) as active_customer_roles_missing_profile
from public.user_roles r
where r.role='customer'
  and not exists(
    select 1 from public.customer_profiles c
    where c.id=r.user_id and coalesce(c.account_status,'active')='active'
  );

select count(*) as unsupported_roles
from public.user_roles
where role not in ('merchant','customer');

select policyname,cmd,roles
from pg_policies
where schemaname='public' and tablename='user_roles'
order by policyname;

select tgname as installed_trigger
from pg_trigger
where not tgisinternal
  and tgname in (
    'on_auth_user_created_bazarhq',
    'profiles_sync_merchant_role_tg',
    'customer_profiles_sync_customer_role_tg',
    'user_roles_sync_auth_metadata_tg'
  )
order by tgname;
