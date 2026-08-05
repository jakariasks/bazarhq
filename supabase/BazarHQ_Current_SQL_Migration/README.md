# BazarHQ Current SQL Migration Pack

এই pack-এ BazarHQ project-এর বিভিন্ন সময়ে ব্যবহার করা repeated SQL fix-গুলো clean, deduplicate এবং current architecture অনুযায়ী সাজানো হয়েছে।

## অত্যন্ত গুরুত্বপূর্ণ

এটি **existing BazarHQ Supabase database-এর upgrade/repair pack**। এটি zero থেকে নতুন database তৈরির পূর্ণ bootstrap schema নয়। কারণ supplied SQL history-তে core schema-এর সব original constraint, trigger, RPC এবং RLS definition ছিল না।

নতুন Supabase project zero থেকে বানাতে হলে production database থেকে অন্তত নিচের command-গুলোর equivalent schema dump প্রয়োজন:

```bash
supabase db dump --schema public,storage --file supabase/schema.sql
supabase db dump --data-only --schema public --file supabase/seed-data.sql
```

Secret, admin password hash, payment credential এবং user data কখনো Git-এ রাখবেন না।

## Run order

Supabase Dashboard → SQL Editor-এ file-গুলো এই order-এ চালান:

1. `migrations/0000_preflight.sql`
2. `migrations/0001_notifications_analytics.sql`
3. `migrations/0002_customer_checkout.sql`
4. `migrations/0003_payments.sql`
5. `migrations/0004_themes_policies.sql`
6. `migrations/0005_merchant_security_lifecycle.sql`
7. `migrations/0006_superadmin_production.sql`
8. `migrations/0007_rls_security.sql`
9. `verification/verify_current_schema.sql`

`0000_preflight.sql` required core table missing দেখালে পরের migration চালাবেন না।

## Backup first

Production database-এ run করার আগে backup নিন এবং staging project-এ test করুন। Supplied SQLগুলো staticভাবে clean ও consistency-check করা হয়েছে, কিন্তু live Supabase schema/production data এখানে execute করা হয়নি।

## Migration summary

| File | কাজ |
|---|---|
| `0001_notifications_analytics.sql` | Notification schema compatibility, email/SMS queues, analytics, order/status/low-stock triggers |
| `0002_customer_checkout.sql` | Customer profiles/addresses, reviews, coupons, authenticated checkout, stock/variant locking, secure tracking RPC |
| `0003_payments.sql` | Merchant payment configs, public payment-method RPC, SSLCommerz transaction table |
| `0004_themes_policies.sql` | Advanced themes, theme apply RPC, storefront customization, return/shipping/payment policies |
| `0005_merchant_security_lifecycle.sql` | Merchant auth/profile, sessions, recovery codes, free-plan limit, store deletion and 30-day cleanup |
| `0006_superadmin_production.sql` | Custom admin sessions, TOTP support schema, IP allowlist, immutable audit, alerts, reports, health, announcements, policy workflow |
| `0007_rls_security.sql` | Final RLS and grants; removes insecure prototype-wide browser access |

## Canonical compatibility choices

পুরোনো file/version ভাঙা ঠেকাতে কয়েকটি alias রাখা হয়েছে:

- `merchant_notifications.action_url` হলো canonical; `link_url` synchronized alias।
- `merchant_notifications.metadata` হলো canonical; `data` synchronized alias।
- `email_notification_queue.recipient_email` canonical; `to_email` alias।
- `sms_notification_queue.recipient_phone` canonical; `to_phone` alias।
- `analytics_events.event_type` canonical; `event_name` alias।
- `orders.txn_id` canonical; `transaction_id` alias।
- `payment_configs.ssl_store_id` canonical; `store_id_key` alias।

নতুন code-এ canonical নাম ব্যবহার করুন।

## Required frontend alignment

### Public order tracking

Direct anonymous `orders` table query ব্যবহার না করে:

```js
const { data, error } = await supabase.rpc("get_public_order_tracking", {
  p_store_subdomain: storeSlug,
  p_order_id: orderId,
  p_customer_phone: phone,
});
```

`optional/legacy_public_tracking_policy.NOT_RECOMMENDED.sql` শুধু temporary migration aid; production-এ ব্যবহার করা নিরাপদ নয়।

### Super Admin

Super Admin tables/RPC browser `anon` access দিয়ে চালানো যাবে না। Existing custom admin Edge Functions service-role client দিয়ে privileged action করবে।

### Order notification

`place_customer_order_v2` আলাদা করে merchant notification insert করে না। `orders` insert হওয়ার পরে `0001`-এর trigger notification/email/SMS queue তৈরি করে। এতে duplicate notification হয় না।

## Excluded from the cleaned pack

- একই SQL-এর exact duplicate copies।
- পুরোনো `place_customer_order`; current RPC হলো `place_customer_order_v2`।
- hardcoded admin email, UUID বা password-related values।
- `admin_users` table-এর RLS disable করা prototype fix।
- Super Admin table-এ `anon/authenticated using (true)` write policy।
- `orders` এবং `order_timeline`-এর unrestricted public SELECT।
- repeated theme seed/migration versions।
- duplicate low-stock এবং new-order triggers।
- unused experimental `product_variants` normalized table ও `invoice_snapshots`; current source JSON variants এবং generated invoice ব্যবহার করে।
- duplicate `admin_audit_logs` plural table; canonical table হলো `admin_audit_log`।

## Validation

`verification/verify_current_schema.sql` দেখাবে:

- required table/column/RPC missing কি না,
- duplicate trigger আছে কি না,
- notification rows inconsistent কি না,
- default theme count,
- deleted store profile references,
- sensitive table-এ unsafe public policy আছে কি না,
- notification queue status।

## Optional files

- `optional/seed_superadmin.template.sql`: কোনো secret ছাড়া admin seed structure।
- `optional/legacy_public_tracking_policy.NOT_RECOMMENDED.sql`: unsafe legacy behavior-এর documented temporary fallback।

## Recommended repository location

```text
supabase/
├── migrations/
│   ├── 0000_preflight.sql
│   ├── 0001_notifications_analytics.sql
│   ├── 0002_customer_checkout.sql
│   ├── 0003_payments.sql
│   ├── 0004_themes_policies.sql
│   ├── 0005_merchant_security_lifecycle.sql
│   ├── 0006_superadmin_production.sql
│   └── 0007_rls_security.sql
├── verification/
│   └── verify_current_schema.sql
└── optional/
```
