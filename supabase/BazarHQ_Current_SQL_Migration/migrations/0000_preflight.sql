-- =============================================================================
-- BazarHQ CURRENT MIGRATION 0000
-- Preflight guard for the existing production database
-- =============================================================================
-- This pack upgrades an existing BazarHQ database. It is not a fresh bootstrap.
-- The block raises an error if a required core table is missing.
-- =============================================================================

do $$
declare
  v_missing text;
begin
  select string_agg(r.table_name,', ' order by r.table_name)
  into v_missing
  from (
    values
      ('profiles'),
      ('stores'),
      ('products'),
      ('orders'),
      ('order_timeline')
  ) as r(table_name)
  where to_regclass('public.'||r.table_name) is null;

  if v_missing is not null then
    raise exception
      'BazarHQ preflight failed. Missing core table(s): %. Restore the base schema before running this upgrade pack.',
      v_missing;
  end if;
end $$;

select
  'BazarHQ existing database preflight passed' as status,
  current_database() as database_name,
  now() as checked_at;
