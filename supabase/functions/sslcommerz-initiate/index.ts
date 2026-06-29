import { handleCors, json } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

const SANDBOX_INIT_URL = 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php';
const LIVE_INIT_URL = 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';

function getAppUrl(req: Request) {
  return (Deno.env.get('PUBLIC_SITE_URL') || req.headers.get('origin') || '').replace(/\/$/, '');
}

function getFunctionUrl(name: string) {
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  return `${supabaseUrl}/functions/v1/${name}`;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createAdminClient();
    const body = await req.json();
    const orderId = String(body.order_id || '').trim();
    const storeId = String(body.store_id || '').trim();
    const customer = body.customer || {};

    if (!orderId || !storeId) return json({ error: 'Missing order_id or store_id.' }, 400);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .eq('store_id', storeId)
      .maybeSingle();
    if (orderError || !order) return json({ error: 'Order not found.' }, 404);

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, shop_name, subdomain')
      .eq('id', storeId)
      .maybeSingle();
    if (storeError || !store) return json({ error: 'Store not found.' }, 404);

    const { data: ssl, error: sslError } = await supabase
      .from('payment_configs')
      .select('ssl_store_id, store_password, enabled')
      .eq('store_id', storeId)
      .eq('method', 'ssl')
      .maybeSingle();
    if (sslError || !ssl?.enabled || !ssl.ssl_store_id || !ssl.store_password) {
      return json({ error: 'SSLCommerz is not configured for this shop.' }, 400);
    }

    const appUrl = getAppUrl(req);
    const initUrl = Deno.env.get('SSLCOMMERZ_MODE') === 'live' ? LIVE_INIT_URL : SANDBOX_INIT_URL;
    const amount = Number(order.total || body.total || 0).toFixed(2);

    const params = new URLSearchParams({
      store_id: ssl.ssl_store_id,
      store_passwd: ssl.store_password,
      total_amount: amount,
      currency: 'BDT',
      tran_id: orderId,
      success_url: getFunctionUrl('sslcommerz-success'),
      fail_url: getFunctionUrl('sslcommerz-fail'),
      cancel_url: getFunctionUrl('sslcommerz-cancel'),
      ipn_url: getFunctionUrl('sslcommerz-ipn'),
      cus_name: customer.name || order.customer_name || 'Customer',
      cus_email: customer.email || order.customer_email || 'customer@example.com',
      cus_add1: customer.address || order.delivery_address || 'Bangladesh',
      cus_city: customer.district || order.district || 'Dhaka',
      cus_country: 'Bangladesh',
      cus_phone: customer.phone || order.customer_phone || '01700000000',
      shipping_method: 'NO',
      product_name: `BazarHQ Order ${orderId}`,
      product_category: 'General',
      product_profile: 'general',
      value_a: store.subdomain || '',
      value_b: appUrl,
    });

    const response = await fetch(initUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await response.json().catch(() => ({}));

    await supabase.from('payment_transactions').insert({
      store_id: storeId,
      order_id: order.id,
      public_order_id: orderId,
      provider: 'sslcommerz',
      transaction_id: orderId,
      amount: amount,
      currency: 'BDT',
      status: data?.status === 'SUCCESS' ? 'session_created' : 'session_failed',
      request_payload: Object.fromEntries(params.entries()),
      provider_response: data,
    });

    if (!response.ok || data?.status !== 'SUCCESS' || !data?.GatewayPageURL) {
      return json({ error: data?.failedreason || 'Could not create SSLCommerz session.', raw: data }, 400);
    }

    await supabase.from('orders').update({ payment_status: 'pending_gateway' }).eq('id', order.id);

    return json({ gateway_url: data.GatewayPageURL, session_key: data.sessionkey || null });
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
});
