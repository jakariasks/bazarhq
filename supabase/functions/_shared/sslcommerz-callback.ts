import { createAdminClient } from './supabaseAdmin.ts';
import { processNotificationQueue } from './notifications.ts';

const SANDBOX_VALIDATE_URL = 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php';
const LIVE_VALIDATE_URL = 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php';

function appUrl(fallback = '') {
  return (Deno.env.get('PUBLIC_SITE_URL') || fallback || '').replace(/\/$/, '');
}

export async function handleSslCallback(payload: Record<string, string>, outcome: 'success' | 'fail' | 'cancel' | 'ipn', fallbackOrigin = '') {
  const supabase = createAdminClient();
  const tranId = payload.tran_id || payload.tran_id || payload.value_c || '';
  const valId = payload.val_id || '';
  const status = payload.status || outcome;

  const { data: order } = await supabase
    .from('orders')
    .select('*, stores(id, subdomain)')
    .eq('order_id', tranId)
    .maybeSingle();

  if (!order) {
    return { ok: false, redirect: `${appUrl(fallbackOrigin)}/payment/fail?reason=order-not-found`, message: 'Order not found.' };
  }

  const { data: ssl } = await supabase
    .from('payment_configs')
    .select('ssl_store_id, store_password')
    .eq('store_id', order.store_id)
    .eq('method', 'ssl')
    .maybeSingle();

  let validation: Record<string, unknown> = {};
  let verified = false;

  if (outcome === 'success' || outcome === 'ipn') {
    if (valId && ssl?.ssl_store_id && ssl?.store_password) {
      const validateUrl = Deno.env.get('SSLCOMMERZ_MODE') === 'live' ? LIVE_VALIDATE_URL : SANDBOX_VALIDATE_URL;
      const url = new URL(validateUrl);
      url.searchParams.set('val_id', valId);
      url.searchParams.set('store_id', ssl.ssl_store_id);
      url.searchParams.set('store_passwd', ssl.store_password);
      url.searchParams.set('v', '1');
      url.searchParams.set('format', 'json');
      const response = await fetch(url.toString());
      validation = await response.json().catch(() => ({}));
      const validStatus = String(validation.status || '').toUpperCase();
      const validTran = String(validation.tran_id || '') === String(order.order_id || tranId);
      const amountOk = Math.abs(Number(validation.amount || order.total) - Number(order.total || 0)) < 1;
      verified = ['VALID', 'VALIDATED'].includes(validStatus) && validTran && amountOk;
    }
  }

  const paymentStatus = verified ? 'paid' : outcome === 'cancel' ? 'cancelled' : outcome === 'fail' ? 'failed' : 'pending_verification';

  await supabase.from('orders').update({ payment_status: paymentStatus }).eq('id', order.id);
  await supabase.from('payment_transactions').update({
    status: paymentStatus,
    val_id: valId || null,
    provider_response: payload,
    validation_response: validation,
    verified_at: verified ? new Date().toISOString() : null,
  }).eq('public_order_id', order.order_id).eq('provider', 'sslcommerz');

  await supabase.from('order_timeline').insert({
    order_id: order.id,
    status: verified ? 'payment_paid' : `payment_${paymentStatus}`,
    note: verified ? 'SSLCommerz payment verified.' : `SSLCommerz payment ${paymentStatus}.`,
  });

  if (verified) {
    await supabase.from('email_notification_queue').insert({
      store_id: order.store_id,
      recipient_email: order.customer_email,
      subject: `Payment received for order ${order.order_id}`,
      body: `Your SSLCommerz payment for order ${order.order_id} has been verified.`,
    }).then(() => null);
  }

  await processNotificationQueue(10, order.store_id).catch(() => null);

  const base = appUrl(fallbackOrigin);
  const slug = order.stores?.subdomain || payload.value_a || '';
  const query = `store=${encodeURIComponent(slug)}&order=${encodeURIComponent(order.order_id)}&phone=${encodeURIComponent(order.customer_phone || '')}`;
  const path = verified ? 'success' : outcome === 'cancel' ? 'cancel' : 'fail';
  return { ok: verified, redirect: `${base}/payment/${path}?${query}`, paymentStatus, validation };
}
