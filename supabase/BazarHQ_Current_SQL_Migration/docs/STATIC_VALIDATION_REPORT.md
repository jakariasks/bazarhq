# Static Validation Report

Generated: 2026-08-01T14:31:01.736312+00:00

## Scope

- Reviewed 14 supplied SQL text files plus the SQL pasted directly in the message.
- Consolidated 8 ordered migration files.
- Performed delimiter, quote, dollar-block and parenthesis balance checks.
- Checked for known unsafe prototype patterns and repeated trigger families.
- Did **not** execute against the user's live Supabase/PostgreSQL database.

## Duplicate-source result

- 14 uploaded files reduced to 7 unique contents.
- Exact duplicate groups:
  - Pasted text (3).txt, Pasted text (4).txt, Pasted text (5).txt
  - Pasted text (8).txt, Pasted text (9).txt, Pasted text (10).txt, Pasted text (11).txt, Pasted text (12).txt
  - Pasted text (13).txt, Pasted text (14).txt

## Generated migration size

- Migration files: 8
- SQL lines: 3,719
- All-in-one lines: 3,766

## Static checks passed

- All generated SQL files have balanced string, identifier, comment, dollar-quote and parenthesis states.
- No hardcoded supplied admin email or UUID exists in canonical migrations.
- No `disable row level security` exists in canonical migrations.
- No unrestricted public order/timeline SELECT policy exists in canonical migrations.
- No legacy `place_customer_order(...)` function exists; canonical checkout is `place_customer_order_v2`.
- Super Admin privileged RPC grants are service-role only.
- Public `anon` execution remains only for explicitly safe functions such as analytics tracking, coupon validation, payment-method projection and identifier-matched order tracking.
- Repeated new-order and low-stock trigger names are explicitly dropped before the canonical trigger is created.

## Required runtime validation

Run `verification/verify_current_schema.sql` after applying the migrations. Then test in staging:

1. Merchant signup/login and first-store onboarding.
2. Free-plan second-store rejection.
3. Product with and without variants.
4. Customer signup/login, address limit and checkout.
5. Coupon, delivery calculation and stock decrement.
6. Merchant new-order and low-stock notifications.
7. bKash/Nagad/Rocket/COD method display.
8. SSLCommerz sandbox initiate/success/fail/cancel/IPN.
9. Theme apply and public storefront rendering.
10. Store self-delete, admin suspend/reinstate/delete.
11. Custom Super Admin login, TOTP, session expiry and audit.
12. Notification queue Edge Function processing.
