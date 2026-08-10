-- BazarHQ product review conversations: verified customer review + merchant reply.
alter table public.product_reviews add column if not exists merchant_reply text;
alter table public.product_reviews add column if not exists merchant_replied_at timestamptz;
alter table public.product_reviews add column if not exists merchant_reply_by uuid;

create or replace function public.merchant_list_product_reviews(p_store_id uuid)
returns table (
  review_id uuid,
  product_id uuid,
  product_title text,
  customer_name text,
  rating integer,
  comment text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  merchant_reply text,
  merchant_replied_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.stores s where s.id = p_store_id and s.owner_id = auth.uid()
  ) then
    raise exception 'Merchant access required';
  end if;

  return query
  select r.id, r.product_id, coalesce(p.title, 'Product'), coalesce(r.customer_name, 'Verified customer'),
         r.rating, r.comment, r.status, r.created_at, r.updated_at, r.merchant_reply, r.merchant_replied_at
  from public.product_reviews r
  left join public.products p on p.id = r.product_id
  where r.store_id = p_store_id
  order by r.created_at desc;
end;
$$;
grant execute on function public.merchant_list_product_reviews(uuid) to authenticated;

create or replace function public.merchant_reply_product_review(p_review_id uuid, p_reply text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reply text := nullif(trim(coalesce(p_reply, '')), '');
  v_store_id uuid;
begin
  if v_uid is null then raise exception 'Merchant login required'; end if;
  if v_reply is not null and length(v_reply) > 1500 then raise exception 'Reply must be 1500 characters or less'; end if;

  select r.store_id into v_store_id from public.product_reviews r where r.id = p_review_id;
  if v_store_id is null then raise exception 'Review not found'; end if;
  if not exists (select 1 from public.stores s where s.id = v_store_id and s.owner_id = v_uid) then
    raise exception 'You cannot reply to this review';
  end if;

  update public.product_reviews
  set merchant_reply = v_reply,
      merchant_replied_at = case when v_reply is null then null else now() end,
      merchant_reply_by = case when v_reply is null then null else v_uid end,
      updated_at = now()
  where id = p_review_id;

  return jsonb_build_object('success', true, 'cleared', v_reply is null);
end;
$$;
grant execute on function public.merchant_reply_product_review(uuid, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_reviews'
     ) then
    execute 'alter publication supabase_realtime add table public.product_reviews';
  end if;
end $$;

create or replace function public.get_my_product_review(p_product_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case when r.id is null then null else jsonb_build_object(
    'id', r.id,
    'rating', r.rating,
    'comment', r.comment,
    'updated_at', r.updated_at
  ) end
  from (select auth.uid() as uid) me
  left join lateral (
    select pr.id, pr.rating, pr.comment, pr.updated_at
    from public.product_reviews pr
    where pr.product_id = p_product_id and pr.customer_id = me.uid
    limit 1
  ) r on true;
$$;
grant execute on function public.get_my_product_review(uuid) to authenticated;
