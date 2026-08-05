-- =============================================================================
-- NOT RECOMMENDED: Legacy anonymous direct order tracking
-- =============================================================================
-- The old storefront tracking page may query orders/order_timeline directly.
-- PostgreSQL RLS cannot verify that the phone supplied in a URL/filter is secret,
-- so any anonymous SELECT policy exposes more data than the secure RPC.
--
-- Preferred fix:
--   supabase.rpc('get_public_order_tracking', {
--     p_store_subdomain,
--     p_order_id,
--     p_customer_phone
--   })
--
-- Only uncomment the following during a temporary frontend transition.
-- Remove it immediately after the tracking page uses the RPC.
-- =============================================================================

/*
drop policy if exists legacy_public_order_tracking on public.orders;
create policy legacy_public_order_tracking
on public.orders for select to anon
using (true);

drop policy if exists legacy_public_timeline_tracking on public.order_timeline;
create policy legacy_public_timeline_tracking
on public.order_timeline for select to anon
using (true);

grant select on public.orders to anon;
grant select on public.order_timeline to anon;
*/
