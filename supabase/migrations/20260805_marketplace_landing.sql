-- =============================================================================
-- BazarHQ Marketplace landing, ranking, comparison and recommendation RPCs
-- Safe public payloads only. No merchant credentials or private customer data.
-- =============================================================================

begin;

create extension if not exists pg_trgm;

create or replace function public.marketplace_normalize_text(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select trim(regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', ' ', 'g'));
$$;

create or replace function public.marketplace_safe_numeric(p_value text, p_default numeric default 0)
returns numeric
language sql
immutable
parallel safe
set search_path = public
as $$
  select case
    when trim(coalesce(p_value, '')) ~ '^-?[0-9]+([.][0-9]+)?$' then trim(p_value)::numeric
    else coalesce(p_default, 0)
  end;
$$;

create index if not exists stores_marketplace_live_idx
  on public.stores (storefront_published, account_status, created_at desc);

create index if not exists products_marketplace_status_store_idx
  on public.products (status, store_id, created_at desc);

create index if not exists products_marketplace_category_price_idx
  on public.products (category, price)
  where status = 'published';

create index if not exists products_marketplace_title_trgm_idx
  on public.products using gin (lower(title) gin_trgm_ops);

create index if not exists orders_marketplace_store_status_idx
  on public.orders (store_id, status, created_at desc);

create index if not exists analytics_marketplace_product_idx
  on public.analytics_events (product_id, event_type, created_at desc)
  where product_id is not null;

create or replace function public.get_marketplace_home(
  p_search text default null,
  p_category text default null,
  p_limit integer default 12
)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
with
settings as (
  select
    nullif(public.marketplace_normalize_text(p_search), '') as search_text,
    nullif(trim(coalesce(p_category, '')), '') as category_text,
    greatest(4, least(coalesce(p_limit, 12), 36)) as result_limit
),
live_stores as (
  select s.*, to_jsonb(s) as store_json
  from public.stores s
  where coalesce(s.account_status, 'active') = 'active'
    and coalesce(s.storefront_published, false) = true
    and nullif(trim(coalesce(s.subdomain, '')), '') is not null
),
published_products as (
  select
    p.*,
    to_jsonb(p) as product_json,
    ls.shop_name,
    ls.subdomain,
    ls.logo_url as store_logo_url,
    ls.business_category as store_category,
    ls.store_json,
    to_jsonb(p)->>'sku' as marketplace_sku,
    public.marketplace_safe_numeric(to_jsonb(p)->>'average_rating', 0) as stored_average_rating,
    public.marketplace_safe_numeric(to_jsonb(p)->>'rating_count', 0)::integer as stored_rating_count,
    public.marketplace_normalize_text(
      concat_ws(' ', p.title, p.category, to_jsonb(p)->>'sku', to_jsonb(p)->>'product_name')
    ) as search_key,
    public.marketplace_normalize_text(p.title) as title_key
  from public.products p
  join live_stores ls on ls.id = p.store_id
  where coalesce(p.status, 'draft') = 'published'
),
valid_orders as (
  select o.*
  from public.orders o
  join live_stores s on s.id = o.store_id
  where lower(coalesce(o.status, 'pending')) not in ('cancelled', 'canceled', 'refunded', 'failed')
),
order_items as (
  select
    o.store_id,
    o.id as order_uuid,
    o.total,
    o.status,
    o.created_at,
    item,
    case
      when coalesce(item->>'product_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (item->>'product_id')::uuid
      else null
    end as product_id,
    greatest(
      0,
      public.marketplace_safe_numeric(
        coalesce(item->>'quantity', item->>'qty', '1'),
        1
      )
    ) as quantity
  from valid_orders o
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(coalesce(o.items, '[]'::jsonb)) = 'array' then coalesce(o.items, '[]'::jsonb) else '[]'::jsonb end
  ) as item
),
product_sales as (
  select
    product_id,
    count(distinct order_uuid)::integer as sold_orders,
    coalesce(sum(quantity), 0)::numeric as sold_quantity
  from order_items
  where product_id is not null
  group by product_id
),
store_sales as (
  select
    o.store_id,
    count(*)::integer as order_count,
    coalesce(sum(coalesce(o.total, 0)), 0)::numeric as gross_sales
  from valid_orders o
  group by o.store_id
),
store_item_sales as (
  select store_id, coalesce(sum(quantity), 0)::numeric as sold_quantity
  from order_items
  group by store_id
),
product_views as (
  select
    ae.product_id,
    count(*) filter (where coalesce(ae.event_type, ae.event_name) = 'product_view')::integer as view_count,
    count(distinct nullif(coalesce(ae.session_id, ae.visitor_id), ''))::integer as unique_viewers
  from public.analytics_events ae
  where ae.product_id is not null
  group by ae.product_id
),
store_views as (
  select
    ae.store_id,
    count(*) filter (where coalesce(ae.event_type, ae.event_name) = 'page_view')::integer as page_views,
    count(distinct nullif(coalesce(ae.session_id, ae.visitor_id), ''))::integer as unique_visitors
  from public.analytics_events ae
  group by ae.store_id
),
review_stats as (
  select
    pr.product_id,
    round(avg(pr.rating)::numeric, 2) as average_rating,
    count(*)::integer as rating_count
  from public.product_reviews pr
  where pr.status = 'approved'
  group by pr.product_id
),
comparison_stats as (
  select
    pp.title_key,
    public.marketplace_normalize_text(pp.category) as category_key,
    count(distinct pp.store_id)::integer as comparison_count,
    min(coalesce(pp.price, 0))::numeric as best_price,
    max(coalesce(pp.price, 0))::numeric as highest_price
  from published_products pp
  where pp.title_key <> ''
  group by pp.title_key, public.marketplace_normalize_text(pp.category)
),
product_ranked as (
  select
    pp.*,
    coalesce(ps.sold_orders, 0) as sold_orders,
    coalesce(ps.sold_quantity, 0) as sold_quantity,
    coalesce(pv.view_count, 0) as view_count,
    coalesce(pv.unique_viewers, 0) as unique_viewers,
    coalesce(rs.average_rating, pp.stored_average_rating, 0)::numeric as average_rating_value,
    coalesce(rs.rating_count, pp.stored_rating_count, 0)::integer as rating_count_value,
    coalesce(cs.comparison_count, 1) as comparison_count,
    coalesce(cs.best_price, pp.price, 0)::numeric as best_price,
    coalesce(cs.highest_price, pp.price, 0)::numeric as highest_price,
    (
      coalesce(ps.sold_quantity, 0) * 8
      + coalesce(ps.sold_orders, 0) * 4
      + coalesce(pv.view_count, 0) * 0.12
      + coalesce(rs.average_rating, pp.stored_average_rating, 0) * 2
      + coalesce(rs.rating_count, pp.stored_rating_count, 0) * 0.45
    )::numeric as ranking_score
  from published_products pp
  left join product_sales ps on ps.product_id = pp.id
  left join product_views pv on pv.product_id = pp.id
  left join review_stats rs on rs.product_id = pp.id
  left join comparison_stats cs
    on cs.title_key = pp.title_key
   and cs.category_key = public.marketplace_normalize_text(pp.category)
),
store_product_stats as (
  select
    store_id,
    count(*)::integer as product_count,
    round(avg(nullif(average_rating_value, 0))::numeric, 2) as average_rating,
    sum(rating_count_value)::integer as rating_count
  from product_ranked
  group by store_id
),
store_ranked as (
  select
    ls.*,
    coalesce(sps.product_count, 0) as product_count,
    coalesce(ss.order_count, 0) as order_count,
    coalesce(sis.sold_quantity, 0) as sold_quantity,
    coalesce(sv.page_views, 0) as page_views,
    coalesce(sv.unique_visitors, 0) as unique_visitors,
    coalesce(sps.average_rating, 0)::numeric as average_rating,
    coalesce(sps.rating_count, 0)::integer as rating_count,
    (
      coalesce(sis.sold_quantity, 0) * 6
      + coalesce(ss.order_count, 0) * 3
      + coalesce(sv.unique_visitors, 0) * 0.2
      + coalesce(sps.average_rating, 0) * 4
      + coalesce(sps.rating_count, 0) * 0.3
      + coalesce(sps.product_count, 0) * 0.15
    )::numeric as ranking_score
  from live_stores ls
  left join store_product_stats sps on sps.store_id = ls.id
  left join store_sales ss on ss.store_id = ls.id
  left join store_item_sales sis on sis.store_id = ls.id
  left join store_views sv on sv.store_id = ls.id
),
filtered_products as (
  select pr.*
  from product_ranked pr
  cross join settings st
  where
    (st.category_text is null or lower(coalesce(pr.category, '')) = lower(st.category_text))
    and (
      st.search_text is null
      or pr.search_key like '%' || st.search_text || '%'
      or public.marketplace_normalize_text(pr.shop_name) like '%' || st.search_text || '%'
      or similarity(pr.title_key, st.search_text) >= 0.28
    )
),
comparison_candidates as (
  select
    pr.*,
    row_number() over (
      partition by pr.title_key, public.marketplace_normalize_text(pr.category)
      order by coalesce(pr.price, 0) asc, pr.ranking_score desc, pr.created_at desc
    ) as group_position
  from product_ranked pr
  where pr.comparison_count > 1
),
category_rows as (
  select
    coalesce(nullif(trim(category), ''), 'General') as category,
    count(*)::integer as product_count
  from published_products
  group by coalesce(nullif(trim(category), ''), 'General')
  order by count(*) desc, category asc
  limit 14
),
top_shop_rows as (
  select sr.*, row_number() over (order by sr.ranking_score desc, sr.order_count desc, sr.created_at desc) as rank
  from store_ranked sr
  order by sr.ranking_score desc, sr.order_count desc, sr.created_at desc
  limit 8
),
top_product_rows as (
  select pr.*, row_number() over (order by pr.ranking_score desc, pr.sold_quantity desc, pr.created_at desc) as rank
  from product_ranked pr
  order by pr.ranking_score desc, pr.sold_quantity desc, pr.created_at desc
  limit (select result_limit from settings)
),
search_product_rows as (
  select fp.*
  from filtered_products fp
  order by
    case when (select search_text from settings) is not null then similarity(fp.title_key, (select search_text from settings)) else 0 end desc,
    fp.ranking_score desc,
    fp.created_at desc
  limit greatest((select result_limit from settings), 18)
),
comparison_rows as (
  select cc.*
  from comparison_candidates cc
  where cc.group_position = 1
  order by (cc.highest_price - cc.best_price) desc, cc.comparison_count desc, cc.ranking_score desc
  limit 8
)
select jsonb_build_object(
  'metrics', jsonb_build_object(
    'shops', (select count(*) from live_stores),
    'products', (select count(*) from published_products),
    'orders', (select count(*) from valid_orders),
    'categories', (select count(*) from category_rows)
  ),
  'categories', coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', cr.category,
      'product_count', cr.product_count
    ) order by cr.product_count desc, cr.category asc)
    from category_rows cr
  ), '[]'::jsonb),
  'top_shops', coalesce((
    select jsonb_agg(jsonb_build_object(
      'rank', ts.rank,
      'id', ts.id,
      'shop_name', ts.shop_name,
      'subdomain', ts.subdomain,
      'logo_url', ts.logo_url,
      'business_category', ts.business_category,
      'tagline', coalesce(ts.store_json->>'tagline', ts.store_json->>'store_tagline'),
      'product_count', ts.product_count,
      'order_count', ts.order_count,
      'sold_quantity', ts.sold_quantity,
      'unique_visitors', ts.unique_visitors,
      'average_rating', ts.average_rating,
      'rating_count', ts.rating_count
    ) order by ts.rank)
    from top_shop_rows ts
  ), '[]'::jsonb),
  'top_products', coalesce((
    select jsonb_agg(jsonb_build_object(
      'rank', tp.rank,
      'id', tp.id,
      'store_id', tp.store_id,
      'title', tp.title,
      'slug', tp.slug,
      'sku', tp.marketplace_sku,
      'category', tp.category,
      'price', tp.price,
      'compare_at_price', tp.compare_at_price,
      'stock', tp.stock,
      'images', case when jsonb_typeof(tp.product_json->'images') = 'array' then tp.product_json->'images' else '[]'::jsonb end,
      'image_url', tp.product_json->>'image_url',
      'shop_name', tp.shop_name,
      'store_slug', tp.subdomain,
      'store_logo_url', tp.store_logo_url,
      'sold_quantity', tp.sold_quantity,
      'view_count', tp.view_count,
      'average_rating', tp.average_rating_value,
      'rating_count', tp.rating_count_value,
      'comparison_count', tp.comparison_count,
      'best_price', tp.best_price,
      'highest_price', tp.highest_price
    ) order by tp.rank)
    from top_product_rows tp
  ), '[]'::jsonb),
  'products', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', sp.id,
      'store_id', sp.store_id,
      'title', sp.title,
      'slug', sp.slug,
      'sku', sp.marketplace_sku,
      'category', sp.category,
      'price', sp.price,
      'compare_at_price', sp.compare_at_price,
      'stock', sp.stock,
      'images', case when jsonb_typeof(sp.product_json->'images') = 'array' then sp.product_json->'images' else '[]'::jsonb end,
      'image_url', sp.product_json->>'image_url',
      'shop_name', sp.shop_name,
      'store_slug', sp.subdomain,
      'store_logo_url', sp.store_logo_url,
      'sold_quantity', sp.sold_quantity,
      'view_count', sp.view_count,
      'average_rating', sp.average_rating_value,
      'rating_count', sp.rating_count_value,
      'comparison_count', sp.comparison_count,
      'best_price', sp.best_price,
      'highest_price', sp.highest_price
    ) order by sp.ranking_score desc, sp.created_at desc)
    from search_product_rows sp
  ), '[]'::jsonb),
  'comparisons', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', cp.id,
      'title', cp.title,
      'slug', cp.slug,
      'category', cp.category,
      'price', cp.price,
      'compare_at_price', cp.compare_at_price,
      'images', case when jsonb_typeof(cp.product_json->'images') = 'array' then cp.product_json->'images' else '[]'::jsonb end,
      'image_url', cp.product_json->>'image_url',
      'shop_name', cp.shop_name,
      'store_slug', cp.subdomain,
      'store_logo_url', cp.store_logo_url,
      'comparison_count', cp.comparison_count,
      'best_price', cp.best_price,
      'highest_price', cp.highest_price,
      'saving', greatest(cp.highest_price - cp.best_price, 0)
    ) order by greatest(cp.highest_price - cp.best_price, 0) desc, cp.comparison_count desc)
    from comparison_rows cp
  ), '[]'::jsonb)
);
$$;

create or replace function public.get_marketplace_product_recommendations(
  p_product_id uuid,
  p_limit integer default 12
)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
with
settings as (
  select greatest(4, least(coalesce(p_limit, 12), 24)) as result_limit
),
live_products as (
  select
    p.*,
    to_jsonb(p) as product_json,
    s.shop_name,
    s.subdomain,
    s.logo_url as store_logo_url,
    to_jsonb(p)->>'sku' as marketplace_sku,
    public.marketplace_safe_numeric(to_jsonb(p)->>'average_rating', 0) as stored_average_rating,
    public.marketplace_safe_numeric(to_jsonb(p)->>'rating_count', 0)::integer as stored_rating_count,
    public.marketplace_normalize_text(p.title) as title_key,
    public.marketplace_normalize_text(p.category) as category_key,
    public.marketplace_normalize_text(concat_ws(' ', p.title, to_jsonb(p)->>'sku', p.category)) as search_key
  from public.products p
  join public.stores s on s.id = p.store_id
  where coalesce(p.status, 'draft') = 'published'
    and coalesce(s.account_status, 'active') = 'active'
    and coalesce(s.storefront_published, false) = true
),
target as (
  select * from live_products where id = p_product_id limit 1
),
product_sales as (
  select
    case
      when coalesce(item->>'product_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (item->>'product_id')::uuid
      else null
    end as product_id,
    sum(greatest(0, public.marketplace_safe_numeric(coalesce(item->>'quantity', item->>'qty', '1'), 1)))::numeric as sold_quantity
  from public.orders o
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(coalesce(o.items, '[]'::jsonb)) = 'array' then coalesce(o.items, '[]'::jsonb) else '[]'::jsonb end
  ) item
  where lower(coalesce(o.status, 'pending')) not in ('cancelled', 'canceled', 'refunded', 'failed')
  group by 1
),
review_stats as (
  select product_id, round(avg(rating)::numeric, 2) as average_rating, count(*)::integer as rating_count
  from public.product_reviews
  where status = 'approved'
  group by product_id
),
scored as (
  select
    candidate.*,
    similarity(candidate.title_key, t.title_key) as title_similarity,
    coalesce(ps.sold_quantity, 0) as sold_quantity,
    coalesce(rs.average_rating, candidate.stored_average_rating, 0)::numeric as average_rating_value,
    coalesce(rs.rating_count, candidate.stored_rating_count, 0)::integer as rating_count_value,
    case
      when candidate.title_key = t.title_key then 'same_product'
      when nullif(candidate.marketplace_sku, '') is not null and lower(candidate.marketplace_sku) = lower(t.marketplace_sku) then 'same_product'
      when candidate.category_key = t.category_key and similarity(candidate.title_key, t.title_key) >= 0.38 then 'close_match'
      else 'recommended'
    end as match_type
  from live_products candidate
  cross join target t
  left join product_sales ps on ps.product_id = candidate.id
  left join review_stats rs on rs.product_id = candidate.id
  where candidate.id <> t.id
    and candidate.store_id <> t.store_id
    and (
      candidate.title_key = t.title_key
      or (nullif(candidate.marketplace_sku, '') is not null and lower(candidate.marketplace_sku) = lower(t.marketplace_sku))
      or similarity(candidate.title_key, t.title_key) >= 0.38
      or candidate.category_key = t.category_key
    )
),
same_product_rows as (
  select *
  from scored
  where match_type in ('same_product', 'close_match')
  order by
    case match_type when 'same_product' then 0 else 1 end,
    title_similarity desc,
    price asc,
    sold_quantity desc
  limit (select result_limit from settings)
),
recommended_rows as (
  select *
  from scored
  where match_type = 'recommended'
  order by title_similarity desc, sold_quantity desc, average_rating_value desc, created_at desc
  limit 8
),
comparison_summary as (
  select
    count(*)::integer + 1 as shop_count,
    least(
      coalesce((select min(price) from same_product_rows), (select price from target)),
      coalesce((select price from target), 0)
    )::numeric as best_price,
    greatest(
      coalesce((select max(price) from same_product_rows), (select price from target)),
      coalesce((select price from target), 0)
    )::numeric as highest_price
  from same_product_rows
)
select case
  when not exists (select 1 from target) then jsonb_build_object(
    'target', null,
    'comparison', jsonb_build_object('shop_count', 0, 'best_price', 0, 'highest_price', 0, 'saving', 0),
    'same_product', '[]'::jsonb,
    'recommended', '[]'::jsonb
  )
  else jsonb_build_object(
    'target', (
      select jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'price', t.price,
        'shop_name', t.shop_name,
        'store_slug', t.subdomain
      ) from target t
    ),
    'comparison', (
      select jsonb_build_object(
        'shop_count', cs.shop_count,
        'best_price', cs.best_price,
        'highest_price', cs.highest_price,
        'saving', greatest(cs.highest_price - cs.best_price, 0)
      ) from comparison_summary cs
    ),
    'same_product', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sp.id,
        'store_id', sp.store_id,
        'title', sp.title,
        'slug', sp.slug,
        'sku', sp.marketplace_sku,
        'category', sp.category,
        'price', sp.price,
        'compare_at_price', sp.compare_at_price,
        'stock', sp.stock,
        'images', case when jsonb_typeof(sp.product_json->'images') = 'array' then sp.product_json->'images' else '[]'::jsonb end,
        'image_url', sp.product_json->>'image_url',
        'shop_name', sp.shop_name,
        'store_slug', sp.subdomain,
        'store_logo_url', sp.store_logo_url,
        'sold_quantity', sp.sold_quantity,
        'average_rating', sp.average_rating_value,
        'rating_count', sp.rating_count_value,
        'match_type', sp.match_type,
        'similarity', round(sp.title_similarity::numeric, 3)
      ) order by case sp.match_type when 'same_product' then 0 else 1 end, sp.title_similarity desc, sp.price asc)
      from same_product_rows sp
    ), '[]'::jsonb),
    'recommended', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rp.id,
        'store_id', rp.store_id,
        'title', rp.title,
        'slug', rp.slug,
        'sku', rp.marketplace_sku,
        'category', rp.category,
        'price', rp.price,
        'compare_at_price', rp.compare_at_price,
        'stock', rp.stock,
        'images', case when jsonb_typeof(rp.product_json->'images') = 'array' then rp.product_json->'images' else '[]'::jsonb end,
        'image_url', rp.product_json->>'image_url',
        'shop_name', rp.shop_name,
        'store_slug', rp.subdomain,
        'store_logo_url', rp.store_logo_url,
        'sold_quantity', rp.sold_quantity,
        'average_rating', rp.average_rating_value,
        'rating_count', rp.rating_count_value,
        'match_type', rp.match_type,
        'similarity', round(rp.title_similarity::numeric, 3)
      ) order by rp.title_similarity desc, rp.sold_quantity desc, rp.average_rating_value desc)
      from recommended_rows rp
    ), '[]'::jsonb)
  )
end;
$$;

revoke all on function public.get_marketplace_home(text, text, integer) from public;
grant execute on function public.get_marketplace_home(text, text, integer) to anon, authenticated;

revoke all on function public.get_marketplace_product_recommendations(uuid, integer) from public;
grant execute on function public.get_marketplace_product_recommendations(uuid, integer) to anon, authenticated;

grant execute on function public.marketplace_normalize_text(text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
