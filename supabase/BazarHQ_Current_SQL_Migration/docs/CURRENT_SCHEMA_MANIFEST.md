# BazarHQ Current Database Contract

## Core

- `profiles`: merchant profile, plan, current store, onboarding.
- `stores`: tenant storefront, publishing, theme, policies, lifecycle.
- `products`: catalog, images, stock, JSON variants, rating aggregates.
- `orders`: authenticated customer order, totals, coupon, delivery and payment state.
- `order_timeline`: internal UUID-linked order status history.

## Customer

- `customer_profiles`
- `customer_addresses` — maximum 3 per customer.
- `product_reviews`
- `coupons`
- `coupon_redemptions`

Current order creation RPC: `place_customer_order_v2`.

## Merchant

- `merchant_notifications`
- `merchant_active_sessions`
- `merchant_mfa_recovery_codes`
- `analytics_events`
- `payment_configs`
- `payment_transactions`
- `deletion_cleanup_log`

## Platform / Super Admin

- `admin_users`
- `admin_sessions`
- `admin_login_challenges`
- `admin_ip_allowlist`
- `admin_alert_recipients`
- `admin_audit_log`
- `admin_report_jobs`
- `system_health_log`
- `system_incidents`
- `platform_themes`
- `platform_announcements`
- `platform_content`
- `email_notification_queue`
- `sms_notification_queue`

## Current RPC contract

### Public or storefront-safe

- `track_analytics_event`
- `get_public_payment_methods`
- `validate_coupon`
- `get_public_order_tracking`
- `customer_can_review_product` — authenticated
- `submit_product_review` — authenticated
- `place_customer_order_v2` — authenticated

### Merchant-authenticated

- `apply_store_theme`
- `get_merchant_store_limit`
- `merchant_delete_store`
- `delete_customer_account`
- `store_has_active_payment_method`

### Service-role / Edge Function

- `create_pending_order_reminders`
- `cleanup_deleted_stores_older_than_30_days`
- `write_admin_audit`
- `queue_admin_alert`
- `request_admin_report`
- `record_system_health`
- `send_platform_announcement`
- `submit_platform_content`
- `approve_platform_content`
- `publish_platform_content`
- `superadmin_set_store_status`

## Current trigger ownership

- `orders` insert → one new-order notification/queue trigger.
- `orders.status` update → one customer status queue trigger.
- `products.stock` change → one low/out-of-stock notification trigger.
- `products.variants/stock` → variant availability normalization.
- `merchant_notifications` → alias/read-state synchronization.
- notification queues → recipient alias synchronization.
- `platform_announcements` → sent records immutable.
- `admin_audit_log` → update/delete blocked.
