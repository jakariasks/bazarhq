-- =============================================================================
-- BazarHQ — Canonical Product Status Contract Repair
-- Date: 2026-08-08
--
-- Canonical database values:
--   draft      = hidden / work in progress
--   published  = active / visible in storefront
--   archived   = retained but hidden
--
-- The Merchant UI may display the word "Active", but it must persist
-- `published` in PostgreSQL. This matches the original BazarHQ products table,
-- checkout RPCs, merchant analytics, and public storefront rules.
-- =============================================================================

begin;

-- Remove the legacy/current named check so data can be normalized safely.
alter table public.products
  drop constraint if exists products_status_check;

-- Normalize any compatibility values that may have entered during previous
-- migrations or service-role operations.
update public.products
set status = case
  when lower(coalesce(status, '')) in ('published', 'active', 'live') then 'published'
  when lower(coalesce(status, '')) = 'archived' then 'archived'
  else 'draft'
end;

alter table public.products
  alter column status set default 'draft';

alter table public.products
  alter column status set not null;

-- Recreate one authoritative status constraint.
alter table public.products
  add constraint products_status_check
  check (status in ('draft', 'published', 'archived'));

-- Keep status queries efficient for storefront/merchant catalog pages.
create index if not exists products_status_store_idx
  on public.products(status, store_id);

notify pgrst, 'reload schema';

commit;

-- Verification: should return exactly draft / published / archived only.
select status, count(*) as product_count
from public.products
group by status
order by status;

select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.products'::regclass
  and conname = 'products_status_check';