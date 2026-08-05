-- =============================================================================
-- BazarHQ — Secure Public Order Tracking + Invoice-Safe Shop Details
--
-- Replaces the previous get_public_order_tracking RPC with a minimized response.
-- Public tracking succeeds only when store slug + public Order ID + registered
-- Bangladesh mobile number all match the same order.
--
-- Security/privacy rules:
--   1) No anonymous SELECT policy on orders/order_timeline is required.
--   2) Invalid inputs and non-matching combinations return only {"found": false}.
--   3) Internal order/store UUIDs and full transaction IDs are never returned.
--   4) Timeline notes are not exposed; only the cancellation reason is returned.
--   5) Delivered orders older than 90 days are archived and receive no live timeline.
--   6) Only public storefront details needed for a customer invoice are returned.
-- =============================================================================

begin;

create or replace function public.get_public_order_tracking(
  p_store_subdomain text,
  p_order_id text,
  p_customer_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_store public.stores%rowtype;
  v_input_phone text;
  v_input_digits text;
  v_timeline jsonb := '[]'::jsonb;
  v_public_items jsonb := '[]'::jsonb;
  v_delivered_at timestamptz;
  v_last_status_at timestamptz;
  v_cancel_reason text;
  v_archived boolean := false;
  v_transaction_id text;
begin
  -- Normalize common Bangladesh phone representations:
  -- 017XXXXXXXX, 17XXXXXXXX, +88017XXXXXXXX, 88017XXXXXXXX.
  v_input_digits := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  v_input_phone := case
    when v_input_digits ~ '^8801[3-9][0-9]{8}$' then '0' || substring(v_input_digits from 4)
    when v_input_digits ~ '^1[3-9][0-9]{8}$' then '0' || v_input_digits
    when v_input_digits ~ '^01[3-9][0-9]{8}$' then v_input_digits
    else ''
  end;

  -- All three public identifiers are mandatory. Return the same response for
  -- malformed inputs and valid-looking values that do not match an order.
  if nullif(trim(coalesce(p_store_subdomain, '')), '') is null
     or nullif(trim(coalesce(p_order_id, '')), '') is null
     or v_input_phone = '' then
    return jsonb_build_object('found', false);
  end if;

  select o.*
  into v_order
  from public.orders o
  join public.stores s on s.id = o.store_id
  where lower(trim(s.subdomain)) = lower(trim(p_store_subdomain))
    and lower(trim(o.order_id)) = lower(trim(p_order_id))
    and (
      case
        when regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g') ~ '^8801[3-9][0-9]{8}$'
          then '0' || substring(regexp_replace(o.customer_phone, '\D', '', 'g') from 4)
        when regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g') ~ '^1[3-9][0-9]{8}$'
          then '0' || regexp_replace(o.customer_phone, '\D', '', 'g')
        when regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g') ~ '^01[3-9][0-9]{8}$'
          then regexp_replace(o.customer_phone, '\D', '', 'g')
        else ''
      end
    ) = v_input_phone
  limit 1;

  if v_order.id is null then
    return jsonb_build_object('found', false);
  end if;

  select *
  into v_store
  from public.stores
  where id = v_order.store_id;

  select
    max(t.created_at) filter (where lower(t.status) = 'delivered'),
    max(t.created_at)
  into v_delivered_at, v_last_status_at
  from public.order_timeline t
  where t.order_id = v_order.id;

  v_delivered_at := case
    when lower(coalesce(v_order.status, '')) = 'delivered'
      then coalesce(v_delivered_at, v_order.updated_at, v_order.created_at)
    else v_delivered_at
  end;

  v_last_status_at := coalesce(v_last_status_at, v_order.updated_at, v_order.created_at);
  v_archived := lower(coalesce(v_order.status, '')) = 'delivered'
    and v_delivered_at is not null
    and v_delivered_at <= now() - interval '90 days';

  if lower(coalesce(v_order.status, '')) = 'cancelled' then
    select left(nullif(trim(t.note), ''), 500)
    into v_cancel_reason
    from public.order_timeline t
    where t.order_id = v_order.id
      and lower(t.status) = 'cancelled'
      and nullif(trim(coalesce(t.note, '')), '') is not null
    order by t.created_at desc
    limit 1;
  end if;

  -- Public item projection: intentionally omit product_id and variant_id.
  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'title', coalesce(item ->> 'title', item ->> 'name', 'Product'),
          'variant', coalesce(item ->> 'variant', item ->> 'variant_label'),
          'price', item -> 'price',
          'qty', coalesce(item -> 'qty', item -> 'quantity'),
          'line_total', item -> 'line_total',
          'image', coalesce(item -> 'image', item -> 'image_url')
        )
      )
      order by item_index
    ),
    '[]'::jsonb
  )
  into v_public_items
  from jsonb_array_elements(
    case
      when jsonb_typeof(v_order.items) = 'array' then v_order.items
      else '[]'::jsonb
    end
  ) with ordinality as public_item(item, item_index);

  -- Archived orders keep the final summary but no longer expose live timeline data.
  if not v_archived then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'status', lower(t.status),
          'created_at', t.created_at
        )
        order by t.created_at
      ),
      '[]'::jsonb
    )
    into v_timeline
    from public.order_timeline t
    where t.order_id = v_order.id;
  end if;

  v_transaction_id := coalesce(
    to_jsonb(v_order) ->> 'txn_id',
    to_jsonb(v_order) ->> 'transaction_id'
  );

  return jsonb_build_object(
    'found', true,
    'archived', v_archived,
    'live_tracking_available', not v_archived,
    'delivered_at', v_delivered_at,
    'last_status_at', v_last_status_at,
    'cancel_reason', v_cancel_reason,
    'order', jsonb_strip_nulls(jsonb_build_object(
      'order_id', v_order.order_id,
      'customer_name', v_order.customer_name,
      'customer_phone_masked', left(v_input_phone, 3) || '******' || right(v_input_phone, 2),
      'delivery_address', v_order.delivery_address,
      'district', v_order.district,
      'delivery_note', v_order.delivery_note,
      'payment_method', v_order.payment_method,
      'payment_status', v_order.payment_status,
      'transaction_reference', case
        when length(coalesce(v_transaction_id, '')) >= 4
          then '••••' || right(v_transaction_id, 4)
        else null
      end,
      'status', lower(coalesce(v_order.status, 'pending')),
      'subtotal', v_order.subtotal,
      'delivery_charge', v_order.delivery_charge,
      'discount_amount', v_order.discount_amount,
      'total', v_order.total,
      'items', v_public_items,
      'created_at', v_order.created_at,
      'updated_at', v_order.updated_at
    )),
    'store', jsonb_strip_nulls(jsonb_build_object(
      'shop_name', v_store.shop_name,
      'subdomain', v_store.subdomain,
      'logo_url', to_jsonb(v_store) ->> 'logo_url',
      'brand_color', to_jsonb(v_store) ->> 'brand_color',
      'tagline', to_jsonb(v_store) ->> 'tagline',
      'phone', coalesce(
        nullif(to_jsonb(v_store) ->> 'phone', ''),
        nullif(to_jsonb(v_store) ->> 'contact_phone', '')
      ),
      'whatsapp_number', to_jsonb(v_store) ->> 'whatsapp_number',
      'contact_email', to_jsonb(v_store) ->> 'contact_email',
      'address', to_jsonb(v_store) ->> 'address',
      'city', to_jsonb(v_store) ->> 'city',
      'website_url', to_jsonb(v_store) ->> 'website_url',
      'return_policy', to_jsonb(v_store) ->> 'return_policy',
      'shipping_policy', to_jsonb(v_store) ->> 'shipping_policy',
      'payment_policy', to_jsonb(v_store) ->> 'payment_policy'
    )),
    'timeline', v_timeline
  );
end;
$$;

revoke all on function public.get_public_order_tracking(text, text, text) from public;
grant execute on function public.get_public_order_tracking(text, text, text)
  to anon, authenticated;

comment on function public.get_public_order_tracking(text, text, text) is
  'Secure public tracking using exact store slug, public order ID, and normalized Bangladesh customer phone. Returns a minimized response, invoice-safe public shop details, and archives delivered orders after 90 days.';

commit;

notify pgrst, 'reload schema';
