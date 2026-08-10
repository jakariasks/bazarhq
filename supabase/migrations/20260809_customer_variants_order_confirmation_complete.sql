-- =============================================================================
-- BazarHQ — Customer Variant + Order Confirmation Completion
-- Date: 2026-08-09
--
-- Completes:
--   C-01 Product variant selection contract
--   C-02 Variant-specific price/stock/unavailable state
--   C-03 Low-stock warning threshold contract
--   C-04 Variant persistence cart -> checkout -> order
--   C-05 Customer SMS/email order confirmation with <=30s delivery instrumentation
--
-- Prerequisite:
--   20260808_merchant_notifications_low_stock_reminders_complete.sql
-- =============================================================================

begin;

create extension if not exists pgcrypto;

do $$
begin
  if to_regprocedure(
    'public.enqueue_merchant_operational_notification(uuid,text,text,text,uuid,jsonb)'
  ) is null then
    raise exception
      'BazarHQ prerequisite missing: run 20260808_merchant_notifications_low_stock_reminders_complete.sql first.';
  end if;

  if to_regclass('public.sms_notification_queue') is null
     or to_regclass('public.email_notification_queue') is null then
    raise exception
      'BazarHQ notification queues are missing. Run the M-06 to M-09 notification migration first.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- C-04: durable variant metadata in order items
-- -----------------------------------------------------------------------------

alter table public.orders
  add column if not exists customer_confirmation_queued_at timestamptz;

create or replace function public.enrich_order_variant_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_result jsonb := '[]'::jsonb;
  v_product public.products%rowtype;
  v_variant jsonb;
  v_product_id uuid;
  v_variant_id text;
  v_variant_label text;
  v_variant_price numeric(12,2);
begin
  if new.items is null or jsonb_typeof(new.items) <> 'array' then
    return new;
  end if;

  for v_item in
    select value
    from jsonb_array_elements(new.items)
  loop
    v_product_id := null;
    v_variant := null;

    begin
      v_product_id := nullif(v_item->>'product_id', '')::uuid;
    exception when others then
      v_product_id := null;
    end;

    v_variant_id := nullif(v_item->>'variant_id', '');
    v_variant_label := coalesce(
      nullif(v_item->>'variant', ''),
      nullif(v_item->>'variant_label', '')
    );

    if v_product_id is not null and (v_variant_id is not null or v_variant_label is not null) then
      select p.*
      into v_product
      from public.products p
      where p.id = v_product_id
        and p.store_id = new.store_id
      limit 1;

      if found then
        select elem
        into v_variant
        from jsonb_array_elements(
          case
            when jsonb_typeof(coalesce(v_product.variants, '[]'::jsonb)) = 'array'
              then coalesce(v_product.variants, '[]'::jsonb)
            else '[]'::jsonb
          end
        ) elem
        where
          coalesce(
            nullif(elem->>'id', ''),
            nullif(elem->>'key', ''),
            nullif(elem->>'combo', ''),
            nullif(elem->>'label', '')
          ) = coalesce(v_variant_id, v_variant_label)
          or nullif(elem->>'combo', '') = v_variant_label
          or nullif(elem->>'label', '') = v_variant_label
        limit 1;

        if v_variant is not null then
          v_variant_price := case
            when nullif(v_variant->>'price', '') is not null
              then greatest((v_variant->>'price')::numeric, 0)
            else greatest(
              coalesce(v_product.price, 0) +
              coalesce(nullif(v_variant->>'price_adjustment', '')::numeric, 0),
              0
            )
          end;

          v_item := v_item || jsonb_strip_nulls(jsonb_build_object(
            'variant_id', coalesce(
              nullif(v_variant->>'id', ''),
              nullif(v_variant->>'key', ''),
              v_variant_id
            ),
            'variant', coalesce(
              nullif(v_variant->>'label', ''),
              nullif(v_variant->>'combo', ''),
              v_variant_label
            ),
            'variant_options', v_variant->'options',
            'variant_sku', nullif(v_variant->>'sku', ''),
            'variant_low_stock_threshold',
              coalesce(
                nullif(v_variant->>'low_stock_threshold', '')::integer,
                v_product.low_stock_threshold,
                5
              ),
            'price', v_variant_price
          ));
        end if;
      end if;
    end if;

    v_result := v_result || jsonb_build_array(v_item);
  end loop;

  new.items := v_result;
  return new;
end;
$$;

drop trigger if exists orders_enrich_variant_items_tg on public.orders;
create trigger orders_enrich_variant_items_tg
before insert or update of items
on public.orders
for each row
execute function public.enrich_order_variant_items();


-- -----------------------------------------------------------------------------
-- C-05: queue identity/order metadata + deduplication
-- -----------------------------------------------------------------------------

alter table public.email_notification_queue
  add column if not exists order_id uuid references public.orders(id) on delete set null,
  add column if not exists dedupe_key text;

alter table public.sms_notification_queue
  add column if not exists order_id uuid references public.orders(id) on delete set null,
  add column if not exists dedupe_key text;

alter table public.notification_delivery_logs
  add column if not exists order_id uuid references public.orders(id) on delete set null;

-- Normal UNIQUE indexes intentionally allow multiple NULL values and can be
-- inferred by ON CONFLICT(dedupe_key).
create unique index if not exists email_notification_queue_dedupe_uidx
  on public.email_notification_queue(dedupe_key);

create unique index if not exists sms_notification_queue_dedupe_uidx
  on public.sms_notification_queue(dedupe_key);

create index if not exists email_notification_queue_order_idx
  on public.email_notification_queue(order_id, created_at desc);

create index if not exists sms_notification_queue_order_idx
  on public.sms_notification_queue(order_id, created_at desc);

create index if not exists notification_delivery_logs_order_idx
  on public.notification_delivery_logs(order_id, created_at desc);


-- Keep merchant notification behavior, but attach order_id to queued deliveries
-- so the authenticated checkout kick can safely scope processing to its own order.
create or replace function public.enqueue_merchant_operational_notification(
  p_store_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_order_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores%rowtype;
  v_pref public.merchant_notification_preferences%rowtype;
  v_email text;
  v_phone text;
  v_enabled boolean := true;
  v_max_attempts integer := 5;
  v_dedupe_base text;
begin
  select *
  into v_store
  from public.stores
  where id = p_store_id;

  if not found then return; end if;

  select *
  into v_pref
  from public.merchant_notification_preferences
  where store_id = p_store_id;

  v_enabled := case lower(coalesce(p_type, ''))
    when 'new_order' then coalesce(v_pref.new_order, true)
    when 'low_stock' then coalesce(v_pref.low_stock, true)
    when 'out_of_stock' then coalesce(v_pref.low_stock, true)
    when 'order_status' then coalesce(v_pref.order_status, true)
    when 'pending_order_reminder' then coalesce(v_pref.pending_order_reminder, true)
    else true
  end;

  if not v_enabled then return; end if;

  select coalesce(
    nullif(v_pref.recipient_email, ''),
    u.email,
    nullif(v_store.contact_email, '')
  )
  into v_email
  from auth.users u
  where u.id = v_store.owner_id
  limit 1;

  v_email := coalesce(v_email, nullif(v_store.contact_email, ''));

  v_phone := coalesce(
    nullif(v_pref.recipient_phone, ''),
    nullif(v_store.phone, ''),
    nullif(v_store.whatsapp_number, '')
  );

  v_max_attempts := greatest(1, least(coalesce(v_pref.max_attempts, 5), 10));

  v_dedupe_base := case
    when p_order_id is null then null
    else 'merchant:' || p_order_id::text || ':' || lower(coalesce(p_type, 'notification'))
  end;

  if coalesce(v_pref.dashboard_enabled, true) then
    insert into public.merchant_notifications (
      store_id,
      merchant_id,
      order_id,
      type,
      title,
      message,
      body,
      action_url,
      link_url,
      metadata,
      data
    )
    values (
      p_store_id,
      v_store.owner_id,
      p_order_id,
      p_type,
      p_title,
      p_body,
      p_body,
      case
        when p_type in ('low_stock', 'out_of_stock') then '/merchant/products'
        else '/merchant/orders'
      end,
      case
        when p_type in ('low_stock', 'out_of_stock') then '/merchant/products'
        else '/merchant/orders'
      end,
      coalesce(p_metadata, '{}'::jsonb),
      coalesce(p_metadata, '{}'::jsonb)
    );
  end if;

  if coalesce(v_pref.email_enabled, true) and nullif(v_email, '') is not null then
    insert into public.email_notification_queue (
      store_id,
      order_id,
      recipient_email,
      subject,
      body,
      notification_type,
      max_attempts,
      priority,
      dedupe_key
    )
    values (
      p_store_id,
      p_order_id,
      v_email,
      p_title,
      p_body,
      'merchant_' || p_type,
      v_max_attempts,
      1,
      case when v_dedupe_base is null then null else v_dedupe_base || ':email' end
    )
    on conflict (dedupe_key) do nothing;
  end if;

  if coalesce(v_pref.sms_enabled, true) and nullif(v_phone, '') is not null then
    insert into public.sms_notification_queue (
      store_id,
      order_id,
      recipient_phone,
      message,
      notification_type,
      max_attempts,
      fallback_email,
      priority,
      dedupe_key
    )
    values (
      p_store_id,
      p_order_id,
      v_phone,
      p_body,
      'merchant_' || p_type,
      v_max_attempts,
      case
        when coalesce(v_pref.sms_email_fallback, true)
          and not coalesce(v_pref.email_enabled, true)
        then v_email
        else null
      end,
      1,
      case when v_dedupe_base is null then null else v_dedupe_base || ':sms' end
    )
    on conflict (dedupe_key) do nothing;
  end if;
end;
$$;

revoke all on function public.enqueue_merchant_operational_notification(
  uuid, text, text, text, uuid, jsonb
) from public;

grant execute on function public.enqueue_merchant_operational_notification(
  uuid, text, text, text, uuid, jsonb
) to service_role;


-- Customer confirmation:
-- * SMS always targets the order's registered customer phone.
-- * Email is queued ONLY if the address matches the authenticated customer's
--   verified Supabase Auth email.
-- * SMS includes Order ID, purchased items, total, and tracking link.
-- * Email contains the same details.
create or replace function public.enqueue_new_order_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores%rowtype;
  v_merchant_text text;
  v_public_order_id text;
  v_items_text text;
  v_tracking_url text;
  v_auth_email text;
  v_email_verified boolean := false;
  v_customer_email text;
  v_customer_phone text;
  v_sms_message text;
  v_email_body text;
  v_email_html text;
begin
  select *
  into v_store
  from public.stores
  where id = new.store_id;

  if not found then return new; end if;

  v_public_order_id := coalesce(new.order_id, new.id::text);

  select left(
    coalesce(
      string_agg(
        coalesce(nullif(item->>'title', ''), 'Product') ||
        case
          when nullif(item->>'variant', '') is not null
            then ' (' || (item->>'variant') || ')'
          else ''
        end ||
        ' x' || greatest(coalesce(nullif(item->>'qty', '')::integer, 1), 1)::text,
        '; ' order by ordinal
      ),
      'Order items'
    ),
    420
  )
  into v_items_text
  from jsonb_array_elements(
    case
      when jsonb_typeof(new.items) = 'array' then new.items
      else '[]'::jsonb
    end
  ) with ordinality as lines(item, ordinal);

  v_tracking_url :=
    'https://bazarhq.com/track?store=' ||
    coalesce(v_store.subdomain, '') ||
    '&order=' ||
    replace(v_public_order_id, ' ', '%20');

  v_merchant_text :=
    'New order #' || v_public_order_id ||
    ' from ' || coalesce(new.customer_name, 'customer') ||
    '. Total: ৳' || coalesce(new.total, 0)::text || '.';

  perform public.enqueue_merchant_operational_notification(
    new.store_id,
    'new_order',
    'New order received',
    v_merchant_text,
    new.id,
    jsonb_build_object(
      'order_id', new.id,
      'public_order_id', new.order_id,
      'total', new.total,
      'queued_at', now()
    )
  );

  v_customer_phone := nullif(
    regexp_replace(coalesce(new.customer_phone, ''), '\D', '', 'g'),
    ''
  );

  v_customer_email := lower(trim(coalesce(new.customer_email, '')));

  if new.customer_id is not null then
    select
      lower(coalesce(u.email, '')),
      (u.email_confirmed_at is not null)
    into
      v_auth_email,
      v_email_verified
    from auth.users u
    where u.id = new.customer_id
    limit 1;
  end if;

  v_sms_message :=
    'BazarHQ order ' || v_public_order_id ||
    ' confirmed. Items: ' || v_items_text ||
    '. Total ৳' || coalesce(new.total, 0)::text ||
    '. Track: ' || v_tracking_url;

  v_email_body :=
    'Order confirmed: ' || v_public_order_id || E'\n\n' ||
    'Items: ' || v_items_text || E'\n' ||
    'Total: ৳' || coalesce(new.total, 0)::text || E'\n' ||
    'Track your order: ' || v_tracking_url || E'\n\n' ||
    'Store: ' || coalesce(v_store.shop_name, 'BazarHQ Store');

  v_email_html :=
    '<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a">' ||
    '<h2 style="margin:0 0 12px">Order received</h2>' ||
    '<p>Your BazarHQ order <strong>' ||
      replace(replace(replace(v_public_order_id, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
    '</strong> has been received successfully.</p>' ||
    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin:16px 0">' ||
      '<p style="margin:0 0 8px"><strong>Items:</strong> ' ||
        replace(replace(replace(v_items_text, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
      '</p>' ||
      '<p style="margin:0"><strong>Total:</strong> ৳' || coalesce(new.total, 0)::text || '</p>' ||
    '</div>' ||
    '<p><a href="' || v_tracking_url ||
    '" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Track order</a></p>' ||
    '<p style="color:#64748b;font-size:13px">Store: ' ||
      replace(replace(replace(coalesce(v_store.shop_name, 'BazarHQ Store'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') ||
    '</p></div>';

  if v_customer_phone is not null then
    insert into public.sms_notification_queue (
      store_id,
      order_id,
      recipient_phone,
      message,
      notification_type,
      max_attempts,
      fallback_email,
      priority,
      dedupe_key
    )
    values (
      new.store_id,
      new.id,
      v_customer_phone,
      v_sms_message,
      'customer_order_confirmation',
      5,
      null,
      0,
      'customer:' || new.id::text || ':sms'
    )
    on conflict (dedupe_key) do nothing;
  end if;

  if
    v_email_verified
    and nullif(v_auth_email, '') is not null
    and v_customer_email = v_auth_email
  then
    insert into public.email_notification_queue (
      store_id,
      order_id,
      recipient_email,
      subject,
      body,
      html,
      notification_type,
      max_attempts,
      priority,
      dedupe_key
    )
    values (
      new.store_id,
      new.id,
      v_auth_email,
      'BazarHQ order ' || v_public_order_id || ' confirmed',
      v_email_body,
      v_email_html,
      'customer_order_confirmation',
      5,
      0,
      'customer:' || new.id::text || ':email'
    )
    on conflict (dedupe_key) do nothing;
  end if;

  update public.orders
  set customer_confirmation_queued_at = now()
  where id = new.id
    and customer_confirmation_queued_at is null;

  return new;
end;
$$;

drop trigger if exists trg_enqueue_new_order_notifications on public.orders;
drop trigger if exists orders_new_order_notifications_tg on public.orders;

create trigger orders_new_order_notifications_tg
after insert on public.orders
for each row
execute function public.enqueue_new_order_notifications();


-- Authenticated customer can inspect delivery status for their own order. This is
-- used for acceptance tests and can later power a non-intrusive success-page badge.
create or replace function public.get_my_order_confirmation_delivery_status(
  p_order_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_sms jsonb;
  v_email jsonb;
begin
  if v_uid is null then
    raise exception 'Customer login required';
  end if;

  select *
  into v_order
  from public.orders
  where customer_id = v_uid
    and (
      id::text = trim(coalesce(p_order_id, ''))
      or lower(order_id) = lower(trim(coalesce(p_order_id, '')))
    )
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  select jsonb_build_object(
    'status', q.status,
    'attempts', q.attempts,
    'created_at', q.created_at,
    'delivered_at', q.delivered_at,
    'latency_ms',
      case
        when q.delivered_at is null then null
        else greatest(
          0,
          floor(extract(epoch from (q.delivered_at - v_order.created_at)) * 1000)
        )::bigint
      end,
    'within_30_seconds',
      case
        when q.delivered_at is null then null
        else q.delivered_at <= v_order.created_at + interval '30 seconds'
      end
  )
  into v_sms
  from public.sms_notification_queue q
  where q.order_id = v_order.id
    and q.notification_type = 'customer_order_confirmation'
  order by q.created_at
  limit 1;

  select jsonb_build_object(
    'status', q.status,
    'attempts', q.attempts,
    'created_at', q.created_at,
    'delivered_at', q.delivered_at,
    'latency_ms',
      case
        when q.delivered_at is null then null
        else greatest(
          0,
          floor(extract(epoch from (q.delivered_at - v_order.created_at)) * 1000)
        )::bigint
      end,
    'within_30_seconds',
      case
        when q.delivered_at is null then null
        else q.delivered_at <= v_order.created_at + interval '30 seconds'
      end
  )
  into v_email
  from public.email_notification_queue q
  where q.order_id = v_order.id
    and q.notification_type = 'customer_order_confirmation'
  order by q.created_at
  limit 1;

  return jsonb_build_object(
    'found', true,
    'order_id', v_order.order_id,
    'queued_at', v_order.customer_confirmation_queued_at,
    'sms', v_sms,
    'email', v_email
  );
end;
$$;

revoke all on function public.get_my_order_confirmation_delivery_status(text) from public;
grant execute on function public.get_my_order_confirmation_delivery_status(text) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Verification: structural only. Real <=30s timing depends on configured SMS/email
-- providers and is measured by get_my_order_confirmation_delivery_status().
select
  column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('email_notification_queue', 'sms_notification_queue')
  and column_name in ('order_id', 'dedupe_key')
order by table_name, column_name;
