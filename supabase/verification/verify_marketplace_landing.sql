-- Run after 20260805_marketplace_landing.sql

select
  to_regprocedure('public.get_marketplace_home(text,text,integer)') is not null as marketplace_home_rpc,
  to_regprocedure('public.get_marketplace_product_recommendations(uuid,integer)') is not null as recommendation_rpc,
  to_regprocedure('public.marketplace_normalize_text(text)') is not null as normalize_helper;

select
  has_function_privilege('anon', 'public.get_marketplace_home(text,text,integer)', 'EXECUTE') as anon_marketplace_access,
  has_function_privilege('authenticated', 'public.get_marketplace_home(text,text,integer)', 'EXECUTE') as authenticated_marketplace_access,
  has_function_privilege('anon', 'public.get_marketplace_product_recommendations(uuid,integer)', 'EXECUTE') as anon_recommendation_access;

select public.get_marketplace_home(null, null, 12) as marketplace_payload;

with payload as (
  select public.get_marketplace_home(null, null, 12) as value
)
select
  jsonb_typeof(value->'metrics') = 'object' as metrics_ok,
  jsonb_typeof(value->'categories') = 'array' as categories_ok,
  jsonb_typeof(value->'top_shops') = 'array' as top_shops_ok,
  jsonb_typeof(value->'top_products') = 'array' as top_products_ok,
  jsonb_typeof(value->'products') = 'array' as products_ok,
  jsonb_typeof(value->'comparisons') = 'array' as comparisons_ok
from payload;

with payload as (
  select public.get_marketplace_home(null, null, 24) as value
), public_shop_ids as (
  select (item->>'id')::uuid as id
  from payload, jsonb_array_elements(value->'top_shops') item
)
select count(*) as invalid_public_shops
from public_shop_ids p
join public.stores s on s.id = p.id
where coalesce(s.account_status, 'active') <> 'active'
   or coalesce(s.storefront_published, false) = false;

with payload as (
  select public.get_marketplace_home(null, null, 36) as value
), product_ids as (
  select item->>'id' as id
  from payload, jsonb_array_elements(value->'products') item
)
select id, count(*)
from product_ids
group by id
having count(*) > 1;

-- Pick one published product and verify recommendation payload shape.
with sample as (
  select p.id
  from public.products p
  join public.stores s on s.id = p.store_id
  where p.status = 'published'
    and coalesce(s.account_status, 'active') = 'active'
    and coalesce(s.storefront_published, false) = true
  limit 1
), payload as (
  select public.get_marketplace_product_recommendations(id, 12) as value from sample
)
select
  value->'target' is not null as target_ok,
  jsonb_typeof(value->'comparison') = 'object' as comparison_ok,
  jsonb_typeof(value->'same_product') = 'array' as same_product_ok,
  jsonb_typeof(value->'recommended') = 'array' as recommended_ok
from payload;
