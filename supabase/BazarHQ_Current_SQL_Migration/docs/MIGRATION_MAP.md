# Source SQL → Clean Migration Map

## Duplicate files detected

| Uploaded files | Result |
|---|---|
| Pasted text (3), (4), (5) | Exact duplicates; consolidated into `0005_merchant_security_lifecycle.sql` and relevant notification/RLS files |
| Pasted text (8), (9), (10), (11), (12) | Exact duplicates; consolidated into `0001_notifications_analytics.sql` |
| Pasted text (13), (14) | Exact duplicates; superseded by `0002_customer_checkout.sql` and `place_customer_order_v2` |

## Unique source groups

| Source group | Current destination |
|---|---|
| Super Admin Production Hardening Pack | `0006_superadmin_production.sql` |
| Customer Flow Completion Pack | `0002_customer_checkout.sql` |
| Merchant Scenario Hardening Pack | `0001`, `0005`, `0007` |
| Advanced Theme System | `0004_themes_policies.sql` |
| Super Admin Full Completion Pack | `0006_superadmin_production.sql` |
| Scenario Features 1–6 | `0001_notifications_analytics.sql` |
| Authenticated Checkout + Stock + Timeline | Superseded by enhanced `place_customer_order_v2` in `0002` |
| User-pasted payment fix v2 | `0003_payments.sql` |
| User-pasted merchant auth/free-plan/delete fixes | `0005_merchant_security_lifecycle.sql` |
| User-pasted theme live apply/policy fixes | `0004_themes_policies.sql` |
| User-pasted notification compatibility fixes | `0001_notifications_analytics.sql` |
| User-pasted Super Admin prototype fixes | Unsafe portions removed; secure portions merged into `0006`/`0007` |

## Major conflict resolutions

1. `message` বনাম `body`: দুটো synchronized, canonical display fallback নিশ্চিত।
2. `action_url` বনাম `link_url`: `action_url` canonical, alias retained।
3. `metadata` বনাম `data`: `metadata` canonical, alias retained।
4. Queue recipient naming: `recipient_email/recipient_phone` canonical।
5. Analytics: `event_type` canonical, `event_name` compatibility।
6. Payment SSL key: `ssl_store_id` canonical, `store_id_key` compatibility।
7. Checkout: শুধু `place_customer_order_v2`; পুরোনো RPC বাদ।
8. Notifications: order RPC notification insert বাদ; database trigger single owner।
9. Theme: শুধু advanced theme config; broad anonymous theme-management policy বাদ।
10. Super Admin: singular `admin_audit_log`; service-role privileged writes।
11. Tracking: secure RPC; unrestricted public order read বাদ।
12. Admin seed: hardcoded personal email/UUID বাদ।
