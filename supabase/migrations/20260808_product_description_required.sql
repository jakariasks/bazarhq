-- =============================================================================
-- BazarHQ — Product Description Required
-- Date: 2026-08-08
--
-- Enforces the scenario/product rule that every newly created or updated
-- product must contain a non-empty description.
--
-- NOT VALID is intentional:
-- - New INSERT/UPDATE operations are enforced immediately.
-- - Existing legacy rows with blank descriptions do not break this migration.
-- - When legacy products are edited, the merchant must add a description.
-- =============================================================================

begin;

alter table public.products
  add column if not exists description text;

alter table public.products
  drop constraint if exists products_description_required_check;

alter table public.products
  add constraint products_description_required_check
  check (
    description is not null
    and btrim(description) <> ''
  )
  not valid;

notify pgrst, 'reload schema';

commit;

-- Verification
select
  conname,
  convalidated,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.products'::regclass
  and conname = 'products_description_required_check';
