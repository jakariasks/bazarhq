# Removed or Not Carried Forward

The following old patterns were intentionally not included in the current migration path.

## Security removals

- `alter table admin_users disable row level security`
- anonymous/authenticated `for all using (true)` on Super Admin support tables
- `grant execute superadmin_set_store_status ... to anon`
- public `orders` and `order_timeline` read-all policies
- browser-side Super Admin identity lookup before a trusted session
- hardcoded real admin emails and UUIDs

## Duplicate/obsolete behavior

- repeated notification compatibility scripts
- repeated Merchant Hardening copies
- repeated Scenario Features 1–6 copies
- repeated authenticated checkout copies
- duplicate `enqueue_new_order_notifications`
- duplicate low-stock trigger families
- old `place_customer_order`
- multiple basic theme packs superseded by Advanced Theme System
- both `admin_audit_log` and `admin_audit_logs`

## Not proven current from supplied source

- normalized `product_variants` table
- persisted `invoice_snapshots`

The current application inventory indicates JSON variants on `products` and client-generated invoice output. These experimental tables were therefore not made part of the canonical pack.
