-- =============================================================================
-- BazarHQ CURRENT MIGRATION 0007
-- Final Row Level Security and client grants
-- =============================================================================
-- This removes permissive prototype policies and aligns browser access with the
-- current Merchant, Customer and Edge-Function architecture.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Users manage own profile" on public.profiles;
drop policy if exists profiles_owner_all on public.profiles;

drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select
on public.profiles for select to authenticated
using (id=auth.uid());

drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert
on public.profiles for insert to authenticated
with check (id=auth.uid());

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update
on public.profiles for update to authenticated
using (id=auth.uid())
with check (id=auth.uid());

grant select,insert,update on public.profiles to authenticated;
revoke all on public.profiles from anon;

-- ---------------------------------------------------------------------------
-- Stores
-- ---------------------------------------------------------------------------
alter table public.stores enable row level security;

drop policy if exists "Owners manage own stores" on public.stores;
drop policy if exists "Anyone can view published stores" on public.stores;
drop policy if exists "Public can read active published storefront themes"
  on public.stores;
drop policy if exists "Store owners can update own theme"
  on public.stores;
drop policy if exists "Store owners can update theme fields"
  on public.stores;
drop policy if exists stores_owner_all on public.stores;
drop policy if exists stores_public_select on public.stores;

create policy stores_owner_all
on public.stores for all to authenticated
using (owner_id=auth.uid())
with check (owner_id=auth.uid());

drop policy if exists stores_public_select on public.stores;
create policy stores_public_select
on public.stores for select to anon,authenticated
using (
  coalesce(storefront_published,false)=true
  and coalesce(account_status,'active')='active'
);

grant select on public.stores to anon,authenticated;
grant insert,update,delete on public.stores to authenticated;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
alter table public.products enable row level security;

drop policy if exists "Owners manage own products" on public.products;
drop policy if exists "Anyone can view published products" on public.products;
drop policy if exists products_owner_all on public.products;
drop policy if exists products_public_select on public.products;

create policy products_owner_all
on public.products for all to authenticated
using (
  owner_id=auth.uid()
  or exists(
    select 1 from public.stores s
    where s.id=products.store_id
      and s.owner_id=auth.uid()
  )
)
with check (
  owner_id=auth.uid()
  and exists(
    select 1 from public.stores s
    where s.id=products.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists products_public_select on public.products;
create policy products_public_select
on public.products for select to anon,authenticated
using (
  status in ('published','active')
  and exists(
    select 1 from public.stores s
    where s.id=products.store_id
      and coalesce(s.storefront_published,false)=true
      and coalesce(s.account_status,'active')='active'
  )
);

grant select on public.products to anon,authenticated;
grant insert,update,delete on public.products to authenticated;

-- ---------------------------------------------------------------------------
-- Customer profiles and addresses
-- ---------------------------------------------------------------------------
alter table public.customer_profiles enable row level security;
alter table public.customer_addresses enable row level security;

drop policy if exists "Customers: view own profile"
  on public.customer_profiles;
drop policy if exists "Customers: insert own profile"
  on public.customer_profiles;
drop policy if exists "Customers: update own profile"
  on public.customer_profiles;
drop policy if exists "Customers: delete own profile"
  on public.customer_profiles;

drop policy if exists customer_profiles_own_select on public.customer_profiles;
create policy customer_profiles_own_select
on public.customer_profiles for select to authenticated
using (id=auth.uid());

drop policy if exists customer_profiles_own_insert on public.customer_profiles;
create policy customer_profiles_own_insert
on public.customer_profiles for insert to authenticated
with check (id=auth.uid());

drop policy if exists customer_profiles_own_update on public.customer_profiles;
create policy customer_profiles_own_update
on public.customer_profiles for update to authenticated
using (id=auth.uid())
with check (id=auth.uid());

drop policy if exists customer_profiles_own_delete on public.customer_profiles;
create policy customer_profiles_own_delete
on public.customer_profiles for delete to authenticated
using (id=auth.uid());

drop policy if exists "Customers: manage own addresses"
  on public.customer_addresses;
drop policy if exists "Customers: view own addresses"
  on public.customer_addresses;
drop policy if exists "Customers: insert own addresses"
  on public.customer_addresses;
drop policy if exists "Customers: update own addresses"
  on public.customer_addresses;
drop policy if exists "Customers: delete own addresses"
  on public.customer_addresses;

drop policy if exists customer_addresses_own_all on public.customer_addresses;
create policy customer_addresses_own_all
on public.customer_addresses for all to authenticated
using (customer_id=auth.uid())
with check (customer_id=auth.uid());

grant select,insert,update,delete
  on public.customer_profiles to authenticated;
grant select,insert,update,delete
  on public.customer_addresses to authenticated;
revoke all on public.customer_profiles from anon;
revoke all on public.customer_addresses from anon;

-- ---------------------------------------------------------------------------
-- Orders and timeline
-- ---------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_timeline enable row level security;

drop policy if exists "Store owners manage their orders" on public.orders;
drop policy if exists "Anyone can insert orders" on public.orders;
drop policy if exists "Customers can view their orders by phone" on public.orders;
drop policy if exists "Customers: view own orders by customer_id"
  on public.orders;
drop policy if exists orders_merchant_all on public.orders;
drop policy if exists orders_customer_select on public.orders;

create policy orders_merchant_all
on public.orders for all to authenticated
using (
  exists(
    select 1 from public.stores s
    where s.id=orders.store_id
      and s.owner_id=auth.uid()
  )
)
with check (
  exists(
    select 1 from public.stores s
    where s.id=orders.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists orders_customer_select on public.orders;
create policy orders_customer_select
on public.orders for select to authenticated
using (customer_id=auth.uid());

drop policy if exists "Anyone can view timeline"
  on public.order_timeline;
drop policy if exists "Anyone can insert timeline"
  on public.order_timeline;
drop policy if exists "Customers: view own order timeline"
  on public.order_timeline;
drop policy if exists "Merchants: manage own order timeline"
  on public.order_timeline;

drop policy if exists order_timeline_merchant_all on public.order_timeline;
create policy order_timeline_merchant_all
on public.order_timeline for all to authenticated
using (
  exists(
    select 1
    from public.orders o
    join public.stores s on s.id=o.store_id
    where o.id=order_timeline.order_id
      and s.owner_id=auth.uid()
  )
)
with check (
  exists(
    select 1
    from public.orders o
    join public.stores s on s.id=o.store_id
    where o.id=order_timeline.order_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists order_timeline_customer_select on public.order_timeline;
create policy order_timeline_customer_select
on public.order_timeline for select to authenticated
using (
  exists(
    select 1 from public.orders o
    where o.id=order_timeline.order_id
      and o.customer_id=auth.uid()
  )
);

revoke insert on public.orders from anon,authenticated;
revoke select,update,delete on public.orders from anon;
grant select,update,delete on public.orders to authenticated;
grant select,insert,update,delete
  on public.order_timeline to authenticated;
revoke all on public.order_timeline from anon;

-- ---------------------------------------------------------------------------
-- Reviews and coupons
-- ---------------------------------------------------------------------------
alter table public.product_reviews enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists "Public reads approved product reviews"
  on public.product_reviews;
drop policy if exists "Customers insert their own reviews"
  on public.product_reviews;

drop policy if exists product_reviews_public_select on public.product_reviews;
create policy product_reviews_public_select
on public.product_reviews for select to anon,authenticated
using (status='approved');

drop policy if exists product_reviews_customer_insert on public.product_reviews;
create policy product_reviews_customer_insert
on public.product_reviews for insert to authenticated
with check (customer_id=auth.uid());

drop policy if exists product_reviews_customer_update on public.product_reviews;
create policy product_reviews_customer_update
on public.product_reviews for update to authenticated
using (customer_id=auth.uid())
with check (customer_id=auth.uid());

drop policy if exists product_reviews_customer_delete on public.product_reviews;
create policy product_reviews_customer_delete
on public.product_reviews for delete to authenticated
using (customer_id=auth.uid());

drop policy if exists "Store owners manage coupons"
  on public.coupons;
drop policy if exists coupons_store_owner_all on public.coupons;
create policy coupons_store_owner_all
on public.coupons for all to authenticated
using (
  exists(
    select 1 from public.stores s
    where s.id=coupons.store_id
      and s.owner_id=auth.uid()
  )
)
with check (
  exists(
    select 1 from public.stores s
    where s.id=coupons.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists "Store owners read coupon redemptions"
  on public.coupon_redemptions;
drop policy if exists coupon_redemptions_owner_select on public.coupon_redemptions;
create policy coupon_redemptions_owner_select
on public.coupon_redemptions for select to authenticated
using (
  exists(
    select 1 from public.stores s
    where s.id=coupon_redemptions.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists coupon_redemptions_customer_select on public.coupon_redemptions;
create policy coupon_redemptions_customer_select
on public.coupon_redemptions for select to authenticated
using (customer_id=auth.uid());

grant select on public.product_reviews to anon,authenticated;
grant insert,update,delete on public.product_reviews to authenticated;
grant select,insert,update,delete on public.coupons to authenticated;
grant select on public.coupon_redemptions to authenticated;
revoke all on public.coupons from anon;
revoke all on public.coupon_redemptions from anon;

-- ---------------------------------------------------------------------------
-- Merchant notifications, analytics and security
-- ---------------------------------------------------------------------------
alter table public.merchant_notifications enable row level security;
alter table public.analytics_events enable row level security;
alter table public.merchant_active_sessions enable row level security;
alter table public.merchant_mfa_recovery_codes enable row level security;

drop policy if exists "Merchants can read own notifications"
  on public.merchant_notifications;
drop policy if exists "Merchants can update own notification read state"
  on public.merchant_notifications;

drop policy if exists merchant_notifications_owner_select on public.merchant_notifications;
create policy merchant_notifications_owner_select
on public.merchant_notifications for select to authenticated
using (
  merchant_id=auth.uid()
  or exists(
    select 1 from public.stores s
    where s.id=merchant_notifications.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists merchant_notifications_owner_update on public.merchant_notifications;
create policy merchant_notifications_owner_update
on public.merchant_notifications for update to authenticated
using (
  merchant_id=auth.uid()
  or exists(
    select 1 from public.stores s
    where s.id=merchant_notifications.store_id
      and s.owner_id=auth.uid()
  )
)
with check (
  merchant_id=auth.uid()
  or exists(
    select 1 from public.stores s
    where s.id=merchant_notifications.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists "Merchants can read own analytics"
  on public.analytics_events;
drop policy if exists analytics_events_owner_select on public.analytics_events;
create policy analytics_events_owner_select
on public.analytics_events for select to authenticated
using (
  exists(
    select 1 from public.stores s
    where s.id=analytics_events.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists merchant_sessions_own_all on public.merchant_active_sessions;
create policy merchant_sessions_own_all
on public.merchant_active_sessions for all to authenticated
using (merchant_id=auth.uid())
with check (merchant_id=auth.uid());

drop policy if exists merchant_recovery_codes_own_all on public.merchant_mfa_recovery_codes;
create policy merchant_recovery_codes_own_all
on public.merchant_mfa_recovery_codes for all to authenticated
using (merchant_id=auth.uid())
with check (merchant_id=auth.uid());

grant select on public.merchant_notifications to authenticated;
revoke update on public.merchant_notifications from authenticated;
grant update(is_read,read_at,updated_at)
  on public.merchant_notifications to authenticated;
revoke all on public.merchant_notifications from anon;

grant select on public.analytics_events to authenticated;
revoke insert,update,delete on public.analytics_events
  from anon,authenticated;

grant select,insert,update,delete
  on public.merchant_active_sessions to authenticated;
grant select,insert,update,delete
  on public.merchant_mfa_recovery_codes to authenticated;
revoke all on public.merchant_active_sessions from anon;
revoke all on public.merchant_mfa_recovery_codes from anon;

-- ---------------------------------------------------------------------------
-- Payment transaction visibility
-- ---------------------------------------------------------------------------
alter table public.payment_transactions enable row level security;

drop policy if exists payment_transactions_owner_select on public.payment_transactions;
create policy payment_transactions_owner_select
on public.payment_transactions for select to authenticated
using (
  exists(
    select 1 from public.stores s
    where s.id=payment_transactions.store_id
      and s.owner_id=auth.uid()
  )
);

drop policy if exists payment_transactions_customer_select on public.payment_transactions;
create policy payment_transactions_customer_select
on public.payment_transactions for select to authenticated
using (
  exists(
    select 1 from public.orders o
    where o.id=payment_transactions.order_id
      and o.customer_id=auth.uid()
  )
);

grant select on public.payment_transactions to authenticated;
revoke insert,update,delete
  on public.payment_transactions from anon,authenticated;
revoke all on public.payment_transactions from anon;

-- ---------------------------------------------------------------------------
-- Public platform content and themes
-- ---------------------------------------------------------------------------
alter table public.platform_themes enable row level security;
alter table public.platform_content enable row level security;

drop policy if exists "Public can read active platform themes"
  on public.platform_themes;
drop policy if exists "Prototype superadmin can manage themes"
  on public.platform_themes;
drop policy if exists platform_themes_authenticated_all
  on public.platform_themes;

drop policy if exists platform_themes_public_select on public.platform_themes;
create policy platform_themes_public_select
on public.platform_themes for select to anon,authenticated
using (is_active=true);

drop policy if exists platform_content_authenticated_all
  on public.platform_content;
drop policy if exists platform_content_public_select on public.platform_content;
create policy platform_content_public_select
on public.platform_content for select to anon,authenticated
using (status='published');

grant select on public.platform_themes to anon,authenticated;
grant select on public.platform_content to anon,authenticated;
revoke insert,update,delete
  on public.platform_themes from anon,authenticated;
revoke insert,update,delete
  on public.platform_content from anon,authenticated;

-- ---------------------------------------------------------------------------
-- Queues and admin support tables: Edge Functions/service_role only
-- ---------------------------------------------------------------------------
alter table public.email_notification_queue enable row level security;
alter table public.sms_notification_queue enable row level security;
alter table public.deletion_cleanup_log enable row level security;

revoke all on public.email_notification_queue from anon,authenticated;
revoke all on public.sms_notification_queue from anon,authenticated;
revoke all on public.deletion_cleanup_log from anon,authenticated;

-- Remove known prototype-wide policies.
drop policy if exists system_health_log_authenticated_all
  on public.system_health_log;
drop policy if exists system_incidents_authenticated_all
  on public.system_incidents;
drop policy if exists platform_announcements_authenticated_all
  on public.platform_announcements;
drop policy if exists admin_audit_log_authenticated_read
  on public.admin_audit_log;
drop policy if exists "Audit log: admins can insert"
  on public.admin_audit_log;
drop policy if exists "Audit log: admins can read"
  on public.admin_audit_log;

-- ---------------------------------------------------------------------------
-- Storage bucket and owner-path policies
-- Expected path: <auth.uid()>/<file-name>
-- ---------------------------------------------------------------------------
insert into storage.buckets(id,name,public)
values('shop-branding','shop-branding',true)
on conflict(id) do update set public=true;

drop policy if exists "Users can upload their own files"
  on storage.objects;
drop policy if exists "Public can view files"
  on storage.objects;
drop policy if exists "Users can update their own files"
  on storage.objects;
drop policy if exists "Users can delete their own files"
  on storage.objects;

drop policy if exists "Shop branding: owner upload" on storage.objects;
create policy "Shop branding: owner upload"
on storage.objects for insert to authenticated
with check (
  bucket_id='shop-branding'
  and auth.uid()::text=(storage.foldername(name))[1]
);

drop policy if exists "Shop branding: public read" on storage.objects;
create policy "Shop branding: public read"
on storage.objects for select to public
using (bucket_id='shop-branding');

drop policy if exists "Shop branding: owner update" on storage.objects;
create policy "Shop branding: owner update"
on storage.objects for update to authenticated
using (
  bucket_id='shop-branding'
  and auth.uid()::text=(storage.foldername(name))[1]
)
with check (
  bucket_id='shop-branding'
  and auth.uid()::text=(storage.foldername(name))[1]
);

drop policy if exists "Shop branding: owner delete" on storage.objects;
create policy "Shop branding: owner delete"
on storage.objects for delete to authenticated
using (
  bucket_id='shop-branding'
  and auth.uid()::text=(storage.foldername(name))[1]
);

notify pgrst,'reload schema';
