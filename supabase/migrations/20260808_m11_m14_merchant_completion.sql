-- =============================================================================
-- BazarHQ — Merchant M-11 to M-14 Completion
-- 2026-08-08
-- Revision: fixes reserved-keyword alias in daily analytics aggregation.
--
-- M-11: selected-range CSV reconciliation support
-- M-12: analytics correctness/performance contract + top sellers
-- M-13: merchant profile + verified email-change lifecycle
-- M-14: 30-day merchant/store deletion, restore, cleanup + scheduler
-- =============================================================================

begin;
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- M-13: Merchant account profile contract
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists current_store_id uuid,
  add column if not exists onboarding_progress jsonb default '{}'::jsonb,
  add column if not exists onboarding_step text,
  add column if not exists pending_email text,
  add column if not exists email_change_requested_at timestamptz,
  add column if not exists merchant_deletion_requested_at timestamptz,
  add column if not exists merchant_deleted_at timestamptz,
  add column if not exists updated_at timestamptz default now();

create unique index if not exists profiles_email_lower_uidx
  on public.profiles(lower(email))
  where email is not null;

-- Profile pictures reuse the existing owner-scoped public branding bucket.
insert into storage.buckets(id,name,public)
values('shop-branding','shop-branding',true)
on conflict(id) do update set public=true;

-- When Supabase Auth finally changes the verified email, make that address the
-- merchant profile authority and clear the pending-email marker automatically.
create or replace function public.sync_bazarhq_auth_email()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.profiles
  set
    email=lower(new.email),
    pending_email=case
      when lower(coalesce(pending_email,''))=lower(coalesce(new.email,'')) then null
      else pending_email
    end,
    email_change_requested_at=case
      when lower(coalesce(pending_email,''))=lower(coalesce(new.email,'')) then null
      else email_change_requested_at
    end,
    updated_at=now()
  where id=new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_profile_sync_update on auth.users;
drop trigger if exists on_auth_user_email_sync on auth.users;
create trigger on_auth_user_email_sync
after update of email on auth.users
for each row execute function public.sync_bazarhq_auth_email();

revoke all on function public.sync_bazarhq_auth_email() from public;

-- Keep browser access strictly self-owned and align with the canonical RLS names.
alter table public.profiles enable row level security;
drop policy if exists merchant_profile_self_select on public.profiles;
drop policy if exists merchant_profile_self_update on public.profiles;
drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select
on public.profiles for select to authenticated
using (id=auth.uid());

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update
on public.profiles for update to authenticated
using (id=auth.uid())
with check (id=auth.uid());

grant select,update on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- M-11 / M-12: Analytics correctness + performance indexes
-- -----------------------------------------------------------------------------
create index if not exists orders_store_created_status_total_idx
  on public.orders(store_id,created_at,status,total);
create index if not exists analytics_events_store_created_session_idx
  on public.analytics_events(store_id,created_at,session_id)
  where session_id is not null;
create index if not exists analytics_events_store_created_type_idx
  on public.analytics_events(store_id,created_at,event_type);
create index if not exists analytics_events_store_created_product_idx
  on public.analytics_events(store_id,created_at,product_id)
  where product_id is not null;

create or replace function public.get_merchant_analytics(
  p_store_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_result jsonb;
  v_slug text;
begin
  if v_uid is null then
    raise exception 'Not authenticated.' using errcode='P0001';
  end if;

  select subdomain into v_slug
  from public.stores
  where id=p_store_id and owner_id=v_uid;
  if not found then
    raise exception 'Store not found.' using errcode='P0001';
  end if;

  if p_start is null or p_end is null or p_start>=p_end then
    raise exception 'Invalid analytics date range.' using errcode='22007';
  end if;
  if p_end-p_start>interval '5 years' then
    raise exception 'Analytics range cannot exceed five years.' using errcode='22007';
  end if;

  with order_rows as materialized (
    select id,order_id,created_at,status,payment_method,total,items
    from public.orders
    where store_id=p_store_id and created_at>=p_start and created_at<p_end
  ), valid_orders as materialized (
    select * from order_rows where lower(coalesce(status,''))<>'cancelled'
  ), event_rows as materialized (
    select
      event_type,
      session_id,
      product_id,
      coalesce(nullif(path,''),metadata->>'path','/') normalized_path,
      metadata
    from public.analytics_events
    where store_id=p_store_id and created_at>=p_start and created_at<p_end
  ), product_views as (
    select e.product_id,count(*) views,count(distinct e.session_id) unique_viewers
    from event_rows e
    where e.event_type='product_view' and e.product_id is not null
    group by e.product_id
  ), popular_pages as (
    select normalized_path path,count(*) views,count(distinct session_id) unique_visitors
    from event_rows
    where event_type='page_view'
    group by normalized_path
    order by views desc
    limit 20
  ), viewed_products as (
    select p.id product_id,p.title,pv.views,pv.unique_viewers
    from product_views pv
    join public.products p on p.id=pv.product_id
    order by pv.views desc,p.title asc
    limit 20
  ), sold_items as (
    select
      case
        when coalesce(item->>'product_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (item->>'product_id')::uuid
        else null
      end product_id,
      coalesce(nullif(item->>'title',''),'Product') title,
      case when coalesce(item->>'qty','') ~ '^[0-9]+([.][0-9]+)?$' then greatest((item->>'qty')::numeric,0) else 0 end qty,
      case when coalesce(item->>'price','') ~ '^[0-9]+([.][0-9]+)?$' then greatest((item->>'price')::numeric,0) else 0 end unit_price,
      vo.id order_pk
    from valid_orders vo
    cross join lateral jsonb_array_elements(coalesce(vo.items,'[]'::jsonb)) item
  ), top_selling as (
    select
      product_id,
      max(title) title,
      sum(qty) quantity,
      count(distinct order_pk) orders,
      sum(qty*unit_price) sales_value
    from sold_items
    where product_id is not null
    group by product_id
    order by quantity desc,sales_value desc
    limit 20
  )
  select jsonb_build_object(
    'generated_at',now(),
    'start',p_start,
    'end',p_end,
    'summary',jsonb_build_object(
      'revenue',coalesce((select sum(coalesce(total,0)) from valid_orders),0),
      'orders',coalesce((select count(*) from order_rows),0),
      'valid_orders',coalesce((select count(*) from valid_orders),0),
      'cancelled_orders',coalesce((select count(*) from order_rows where lower(coalesce(status,''))='cancelled'),0),
      'average_order_value',coalesce((select avg(coalesce(total,0)) from valid_orders),0),
      'unique_visitors',coalesce((select count(distinct session_id) from event_rows where session_id is not null),0),
      'product_views',coalesce((select count(*) from event_rows where event_type='product_view'),0),
      'homepage_visitors',coalesce((select count(distinct session_id) from event_rows where event_type='page_view' and (
        normalized_path=('/shop/'||v_slug)
        or normalized_path=('/shop/'||v_slug||'/')
        or metadata->>'page_type'='homepage'
      )),0),
      'category_visitors',coalesce((select count(distinct session_id) from event_rows where event_type='category_view' or metadata->>'page_type'='category'),0)
    ),
    'orders_by_status',coalesce((
      select jsonb_agg(jsonb_build_object('status',status,'count',count) order by count desc)
      from (select lower(coalesce(status,'unknown')) status,count(*) count from order_rows group by 1) x
    ),'[]'::jsonb),
    'revenue_by_payment',coalesce((
      select jsonb_agg(jsonb_build_object('method',method,'revenue',revenue) order by revenue desc)
      from (select lower(coalesce(payment_method,'other')) method,sum(coalesce(total,0)) revenue from valid_orders group by 1) x
    ),'[]'::jsonb),
    'daily',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'date', bucket_date,
          'orders', order_count,
          'revenue', coalesce(daily_revenue, 0)
        )
        order by bucket_date
      )
      from (
        select
          date_trunc('day', created_at)::date as bucket_date,
          count(*) as order_count,
          sum(coalesce(total, 0))
            filter (where lower(coalesce(status, '')) <> 'cancelled') as daily_revenue
        from order_rows
        group by date_trunc('day', created_at)::date
      ) daily_rows
    ),'[]'::jsonb),
    'popular_pages',coalesce((select jsonb_agg(to_jsonb(popular_pages) order by views desc) from popular_pages),'[]'::jsonb),
    'top_viewed_products',coalesce((
      select jsonb_agg(jsonb_build_object('product_id',product_id,'title',title,'views',views,'unique_viewers',unique_viewers) order by views desc)
      from viewed_products
    ),'[]'::jsonb),
    'top_selling_products',coalesce((
      select jsonb_agg(jsonb_build_object('product_id',product_id,'title',title,'quantity',quantity,'orders',orders,'sales_value',sales_value) order by quantity desc,sales_value desc)
      from top_selling
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;

revoke all on function public.get_merchant_analytics(uuid,timestamptz,timestamptz) from public;
grant execute on function public.get_merchant_analytics(uuid,timestamptz,timestamptz) to authenticated;

-- Service-role-only summary used by the CSV Edge Function. It deliberately
-- mirrors the dashboard formulas so the browser can reconcile the export.
create or replace function public.get_merchant_analytics_export_summary(
  p_store_id uuid,
  p_owner_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_slug text;
  v_result jsonb;
begin
  if p_store_id is null or p_owner_id is null or p_start is null or p_end is null or p_start>=p_end then
    raise exception 'Invalid export request.' using errcode='22007';
  end if;
  if p_end-p_start>interval '5 years' then
    raise exception 'Analytics range cannot exceed five years.' using errcode='22007';
  end if;

  select subdomain into v_slug
  from public.stores
  where id=p_store_id and owner_id=p_owner_id;
  if not found then raise exception 'Store not found.' using errcode='P0001'; end if;

  with order_rows as materialized (
    select status,total
    from public.orders
    where store_id=p_store_id and created_at>=p_start and created_at<p_end
  ), valid_orders as materialized (
    select * from order_rows where lower(coalesce(status,''))<>'cancelled'
  ), event_rows as materialized (
    select event_type,session_id,coalesce(nullif(path,''),metadata->>'path','/') normalized_path,metadata
    from public.analytics_events
    where store_id=p_store_id and created_at>=p_start and created_at<p_end
  )
  select jsonb_build_object(
    'revenue',coalesce((select sum(coalesce(total,0)) from valid_orders),0),
    'orders',coalesce((select count(*) from order_rows),0),
    'valid_orders',coalesce((select count(*) from valid_orders),0),
    'cancelled_orders',coalesce((select count(*) from order_rows where lower(coalesce(status,''))='cancelled'),0),
    'average_order_value',coalesce((select avg(coalesce(total,0)) from valid_orders),0),
    'unique_visitors',coalesce((select count(distinct session_id) from event_rows where session_id is not null),0),
    'product_views',coalesce((select count(*) from event_rows where event_type='product_view'),0),
    'homepage_visitors',coalesce((select count(distinct session_id) from event_rows where event_type='page_view' and (
      normalized_path=('/shop/'||v_slug) or normalized_path=('/shop/'||v_slug||'/') or metadata->>'page_type'='homepage'
    )),0),
    'category_visitors',coalesce((select count(distinct session_id) from event_rows where event_type='category_view' or metadata->>'page_type'='category'),0)
  ) into v_result;

  return v_result;
end $$;

revoke all on function public.get_merchant_analytics_export_summary(uuid,uuid,timestamptz,timestamptz) from public;
grant execute on function public.get_merchant_analytics_export_summary(uuid,uuid,timestamptz,timestamptz) to service_role;

-- -----------------------------------------------------------------------------
-- M-14: 30-day deletion lifecycle
-- -----------------------------------------------------------------------------
alter table public.stores
  add column if not exists account_status text default 'active',
  add column if not exists storefront_published boolean default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_scheduled_at timestamptz,
  add column if not exists permanently_deleted_at timestamptz,
  add column if not exists cleanup_status text default 'none',
  add column if not exists published_at timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists updated_at timestamptz default now();

create index if not exists stores_deletion_due_idx
  on public.stores(deletion_scheduled_at)
  where account_status='deleted' and permanently_deleted_at is null;

create table if not exists public.deletion_cleanup_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid,
  owner_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.get_merchant_deletion_readiness(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_store public.stores%rowtype;
  v_pending integer:=0;
  v_statuses jsonb:='{}'::jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated.' using errcode='P0001'; end if;
  select * into v_store from public.stores where id=p_store_id and owner_id=v_uid;
  if not found then raise exception 'Store not found.' using errcode='P0001'; end if;

  select count(*),coalesce(jsonb_object_agg(status,count),'{}'::jsonb)
  into v_pending,v_statuses
  from (
    select lower(coalesce(status,'pending')) status,count(*) count
    from public.orders
    where store_id=p_store_id
      and lower(coalesce(status,'pending')) in ('pending','confirmed','processing','shipped')
    group by 1
  ) x;

  return jsonb_build_object(
    'can_delete',v_pending=0,
    'pending_obligations',v_pending,
    'blocking_statuses',v_statuses,
    'account_status',v_store.account_status,
    'storefront_published',coalesce(v_store.storefront_published,false),
    'deleted_at',v_store.deleted_at,
    'deletion_scheduled_at',v_store.deletion_scheduled_at,
    'cleanup_status',v_store.cleanup_status,
    'can_restore',coalesce(v_store.account_status,'active')='deleted'
      and v_store.deletion_scheduled_at>now()
      and v_store.permanently_deleted_at is null,
    'days_remaining',case
      when v_store.deletion_scheduled_at is null then null
      else greatest(0,ceil(extract(epoch from (v_store.deletion_scheduled_at-now()))/86400.0))
    end
  );
end $$;
revoke all on function public.get_merchant_deletion_readiness(uuid) from public;
grant execute on function public.get_merchant_deletion_readiness(uuid) to authenticated;

create or replace function public.merchant_delete_store(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_pending integer:=0;
  v_cleanup_at timestamptz:=now()+interval '30 days';
begin
  if v_uid is null then raise exception 'Not authenticated.' using errcode='P0001'; end if;
  if not exists(select 1 from public.stores where id=p_store_id and owner_id=v_uid) then
    raise exception 'Store not found or not allowed.' using errcode='P0001';
  end if;

  select count(*) into v_pending
  from public.orders
  where store_id=p_store_id
    and lower(coalesce(status,'pending')) in ('pending','confirmed','processing','shipped');
  if v_pending>0 then
    raise exception 'Complete or cancel % active order obligation(s) before deleting this store.',v_pending using errcode='P0001';
  end if;

  update public.stores
  set
    account_status='deleted',
    storefront_published=false,
    published_at=null,
    deleted_at=now(),
    deletion_scheduled_at=v_cleanup_at,
    cleanup_status='scheduled',
    suspended_reason='Deleted by merchant from account settings.',
    updated_at=now()
  where id=p_store_id and owner_id=v_uid;

  update public.profiles
  set current_store_id=null,merchant_deletion_requested_at=now(),merchant_deleted_at=null,updated_at=now()
  where id=v_uid and (current_store_id=p_store_id or current_store_id is null);

  if to_regclass('public.merchant_security_events') is not null then
    insert into public.merchant_security_events(merchant_id,event_type,auth_session_id,details)
    values(v_uid,'store_deletion_scheduled',auth.jwt()->>'session_id',jsonb_build_object('store_id',p_store_id,'cleanup_at',v_cleanup_at));
  end if;

  return public.get_merchant_deletion_readiness(p_store_id);
end $$;
revoke all on function public.merchant_delete_store(uuid) from public;
grant execute on function public.merchant_delete_store(uuid) to authenticated;

create or replace function public.merchant_restore_deleted_store(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated.' using errcode='P0001'; end if;

  if exists(
    select 1 from public.stores
    where owner_id=v_uid and id<>p_store_id
      and coalesce(account_status,'active')<>'deleted'
      and permanently_deleted_at is null
  ) then
    raise exception 'Your current plan allows one active store. Remove the newer store before restoring this one.' using errcode='P0001';
  end if;

  update public.stores
  set
    account_status='active',
    storefront_published=false,
    published_at=null,
    deleted_at=null,
    deletion_scheduled_at=null,
    permanently_deleted_at=null,
    cleanup_status='none',
    suspended_reason=null,
    updated_at=now()
  where id=p_store_id and owner_id=v_uid
    and account_status='deleted'
    and deletion_scheduled_at>now()
    and permanently_deleted_at is null;

  if not found then raise exception 'Restore period expired or store is not restorable.' using errcode='P0001'; end if;

  update public.profiles
  set current_store_id=p_store_id,merchant_deletion_requested_at=null,merchant_deleted_at=null,updated_at=now()
  where id=v_uid;

  if to_regclass('public.merchant_security_events') is not null then
    insert into public.merchant_security_events(merchant_id,event_type,auth_session_id,details)
    values(v_uid,'store_deletion_cancelled',auth.jwt()->>'session_id',jsonb_build_object('store_id',p_store_id));
  end if;

  return public.get_merchant_deletion_readiness(p_store_id);
end $$;
revoke all on function public.merchant_restore_deleted_store(uuid) from public;
grant execute on function public.merchant_restore_deleted_store(uuid) to authenticated;

create or replace function public.cleanup_deleted_stores_older_than_30_days()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_store record;
  v_cleaned integer:=0;
  v_has_active_store boolean;
begin
  for v_store in
    select id,owner_id,shop_name,subdomain,deletion_scheduled_at
    from public.stores
    where account_status='deleted'
      and coalesce(deletion_scheduled_at,deleted_at+interval '30 days')<=now()
      and permanently_deleted_at is null
    for update skip locked
  loop
    -- Keep the row shell required by historical orders, but remove storefront
    -- catalog/business content. Description remains non-empty because the current
    -- products_description_required_check applies to UPDATEs.
    update public.products
    set
      status='archived',
      title='[deleted product]',
      description='[deleted product]',
      sku=null,
      tags='{}'::text[],
      image_url=null,
      images='{}'::text[],
      variants='[]'::jsonb,
      variant_types='[]'::jsonb,
      stock=0,
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

    insert into public.deletion_cleanup_log(store_id,owner_id,action,details)
    values(
      v_store.id,
      v_store.owner_id,
      'store_cleanup_30_days',
      jsonb_build_object('old_shop_name',v_store.shop_name,'old_subdomain',v_store.subdomain,'scheduled_at',v_store.deletion_scheduled_at)
    );

    select exists(
      select 1 from public.stores s
      where s.owner_id=v_store.owner_id
        and s.id<>v_store.id
        and coalesce(s.account_status,'active')<>'deleted'
        and s.permanently_deleted_at is null
    ) into v_has_active_store;

    if not v_has_active_store then
      -- Remove merchant-specific personal profile data while preserving the
      -- Supabase Auth identity if this person also has Customer access.
      update public.profiles
      set
        email=null,
        full_name=null,
        phone=null,
        avatar_url=null,
        current_store_id=null,
        pending_email=null,
        email_change_requested_at=null,
        onboarding_progress='{}'::jsonb,
        onboarding_step=null,
        merchant_deletion_requested_at=null,
        merchant_deleted_at=now(),
        updated_at=now()
      where id=v_store.owner_id;

      if to_regclass('public.user_roles') is not null then
        delete from public.user_roles
        where user_id=v_store.owner_id and role='merchant';
      end if;
    end if;

    v_cleaned:=v_cleaned+1;
  end loop;

  return v_cleaned;
end $$;
revoke all on function public.cleanup_deleted_stores_older_than_30_days() from public;
grant execute on function public.cleanup_deleted_stores_older_than_30_days() to service_role;

notify pgrst,'reload schema';
commit;

-- -----------------------------------------------------------------------------
-- M-14 scheduler. Run this configuration function once after deploying
-- cleanup-deleted-accounts and setting the same CRON_SECRET in Edge secrets.
-- -----------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.configure_bazarhq_merchant_lifecycle_scheduler(
  p_functions_base_url text,
  p_cron_secret text
)
returns jsonb
language plpgsql
security definer
set search_path=public,cron,net
as $$
declare
  v_job record;
  v_base text:=rtrim(coalesce(p_functions_base_url,''),'/');
  v_command text;
begin
  if v_base !~ '^https://[a-z0-9.-]+$' then
    raise exception 'Provide a valid HTTPS functions base URL, e.g. https://PROJECT.supabase.co';
  end if;
  if length(coalesce(p_cron_secret,''))<24 then
    raise exception 'CRON secret must be at least 24 characters.';
  end if;

  for v_job in select jobid from cron.job where jobname='bazarhq-deleted-merchant-cleanup'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  v_command:=format(
    'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'',''application/json'',''x-cron-secret'',%L), body := ''{"reason":"daily_30_day_cleanup"}''::jsonb);',
    v_base||'/functions/v1/cleanup-deleted-accounts',p_cron_secret
  );

  perform cron.schedule('bazarhq-deleted-merchant-cleanup','15 3 * * *',v_command);

  return jsonb_build_object('ok',true,'deleted_merchant_cleanup','daily at 03:15 UTC');
end $$;
revoke all on function public.configure_bazarhq_merchant_lifecycle_scheduler(text,text) from public;
grant execute on function public.configure_bazarhq_merchant_lifecycle_scheduler(text,text) to service_role;