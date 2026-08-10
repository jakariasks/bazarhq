-- BazarHQ product feedback reliability + customer comments/questions + merchant replies.
-- Safe to apply after earlier customer checkout / review migrations.

-- -----------------------------------------------------------------------------
-- 1) Keep review conversation columns available.
-- -----------------------------------------------------------------------------
alter table public.product_reviews add column if not exists merchant_reply text;
alter table public.product_reviews add column if not exists merchant_replied_at timestamptz;
alter table public.product_reviews add column if not exists merchant_reply_by uuid;

-- -----------------------------------------------------------------------------
-- 2) Reliable review eligibility.
-- Supports current and legacy order item shapes without unsafe UUID casts.
-- Also allows legacy authenticated orders that stored email but not customer_id.
-- -----------------------------------------------------------------------------
create or replace function public.customer_can_review_product(p_store_id uuid, p_product_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null then return false; end if;

  return exists (
    select 1
    from public.orders o
    where o.store_id = p_store_id
      and lower(coalesce(o.status, '')) not in ('cancelled', 'canceled')
      and (
        o.customer_id = v_uid
        or (
          o.customer_id is null
          and v_email <> ''
          and lower(coalesce(o.customer_email, '')) = v_email
        )
      )
      and exists (
        select 1
        from jsonb_array_elements(
          case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end
        ) item
        where coalesce(
          nullif(item ->> 'product_id', ''),
          nullif(item ->> 'productId', ''),
          nullif(item ->> 'id', '')
        ) = p_product_id::text
      )
  );
end;
$$;
grant execute on function public.customer_can_review_product(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3) Reliable review upsert.
-- Do UPDATE-then-INSERT instead of relying on inference of a partial unique index.
-- -----------------------------------------------------------------------------
create or replace function public.submit_product_review(
  p_store_id uuid,
  p_product_id uuid,
  p_rating integer,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := coalesce(auth.jwt() ->> 'email', '');
  v_name text;
  v_comment text := trim(coalesce(p_comment, ''));
begin
  if v_uid is null then raise exception 'Customer login required'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if length(v_comment) < 5 then raise exception 'Review comment is too short'; end if;
  if length(v_comment) > 1200 then raise exception 'Review comment must be 1200 characters or less'; end if;

  if not exists (
    select 1 from public.products p
    where p.id = p_product_id and p.store_id = p_store_id
  ) then
    raise exception 'Product not found in this shop';
  end if;

  if not public.customer_can_review_product(p_store_id, p_product_id) then
    raise exception 'Only customers who ordered this product can review it';
  end if;

  select coalesce(cp.full_name, nullif(split_part(v_email, '@', 1), ''), 'Verified customer')
    into v_name
  from (select 1) seed
  left join public.customer_profiles cp on cp.id = v_uid;

  update public.product_reviews
  set rating = p_rating,
      comment = v_comment,
      status = 'approved',
      customer_name = coalesce(v_name, 'Verified customer'),
      customer_email = nullif(v_email, ''),
      updated_at = now()
  where product_id = p_product_id
    and customer_id = v_uid;

  if not found then
    insert into public.product_reviews (
      store_id, product_id, customer_id, customer_name, customer_email,
      rating, comment, status
    ) values (
      p_store_id, p_product_id, v_uid, coalesce(v_name, 'Verified customer'),
      nullif(v_email, ''), p_rating, v_comment, 'approved'
    );
  end if;

  perform public.refresh_product_rating(p_product_id);
  return jsonb_build_object('success', true);
end;
$$;
grant execute on function public.submit_product_review(uuid, uuid, integer, text) to authenticated;

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

-- -----------------------------------------------------------------------------
-- 4) Customer product comments / questions.
-- These are not purchase-gated reviews. Logged-in customers can ask a question
-- or leave a product comment; the store owner can reply publicly.
-- -----------------------------------------------------------------------------
create table if not exists public.product_comments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid not null,
  customer_name text,
  customer_email text,
  comment text not null,
  status text not null default 'approved' check (status in ('approved', 'hidden')),
  merchant_reply text,
  merchant_replied_at timestamptz,
  merchant_reply_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_comments_product_status_idx
  on public.product_comments(product_id, status, created_at desc);
create index if not exists product_comments_store_created_idx
  on public.product_comments(store_id, created_at desc);

alter table public.product_comments enable row level security;

drop policy if exists product_comments_public_select on public.product_comments;
create policy product_comments_public_select
on public.product_comments for select to anon, authenticated
using (status = 'approved');

-- Writes go through owner-checked security-definer RPCs.
revoke insert, update, delete on public.product_comments from anon, authenticated;
grant select on public.product_comments to anon, authenticated;

create or replace function public.submit_product_comment(
  p_store_id uuid,
  p_product_id uuid,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := coalesce(auth.jwt() ->> 'email', '');
  v_name text;
  v_comment text := trim(coalesce(p_comment, ''));
  v_id uuid;
begin
  if v_uid is null then raise exception 'Customer login required'; end if;
  if length(v_comment) < 3 then raise exception 'Comment is too short'; end if;
  if length(v_comment) > 1200 then raise exception 'Comment must be 1200 characters or less'; end if;

  if not exists (
    select 1 from public.products p
    join public.stores s on s.id = p.store_id
    where p.id = p_product_id
      and p.store_id = p_store_id
      and p.status in ('published', 'active')
      and coalesce(s.storefront_published, false) = true
  ) then
    raise exception 'This product is not available for comments';
  end if;

  select coalesce(cp.full_name, nullif(split_part(v_email, '@', 1), ''), 'Customer')
    into v_name
  from (select 1) seed
  left join public.customer_profiles cp on cp.id = v_uid;

  insert into public.product_comments (
    store_id, product_id, customer_id, customer_name, customer_email, comment, status
  ) values (
    p_store_id, p_product_id, v_uid, coalesce(v_name, 'Customer'), nullif(v_email, ''), v_comment, 'approved'
  ) returning id into v_id;

  return jsonb_build_object('success', true, 'id', v_id);
end;
$$;
grant execute on function public.submit_product_comment(uuid, uuid, text) to authenticated;

create or replace function public.merchant_list_product_comments(p_store_id uuid)
returns table (
  comment_id uuid,
  product_id uuid,
  product_title text,
  customer_name text,
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
  select c.id, c.product_id, coalesce(p.title, 'Product'), coalesce(c.customer_name, 'Customer'),
         c.comment, c.status, c.created_at, c.updated_at, c.merchant_reply, c.merchant_replied_at
  from public.product_comments c
  left join public.products p on p.id = c.product_id
  where c.store_id = p_store_id
  order by c.created_at desc;
end;
$$;
grant execute on function public.merchant_list_product_comments(uuid) to authenticated;

create or replace function public.merchant_reply_product_comment(p_comment_id uuid, p_reply text)
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

  select c.store_id into v_store_id from public.product_comments c where c.id = p_comment_id;
  if v_store_id is null then raise exception 'Comment not found'; end if;
  if not exists (select 1 from public.stores s where s.id = v_store_id and s.owner_id = v_uid) then
    raise exception 'You cannot reply to this comment';
  end if;

  update public.product_comments
  set merchant_reply = v_reply,
      merchant_replied_at = case when v_reply is null then null else now() end,
      merchant_reply_by = case when v_reply is null then null else v_uid end,
      updated_at = now()
  where id = p_comment_id;

  return jsonb_build_object('success', true, 'cleared', v_reply is null);
end;
$$;
grant execute on function public.merchant_reply_product_comment(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5) Realtime feedback updates.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_reviews'
    ) then
      execute 'alter publication supabase_realtime add table public.product_reviews';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_comments'
    ) then
      execute 'alter publication supabase_realtime add table public.product_comments';
    end if;
  end if;
end $$;
