import { handleCors, json } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { requireUser } from '../_shared/auth.ts'
import { callbackUrl, fetchJson, makeGatewayTransactionId, sanitizedGatewayResponse, sslEndpoints } from '../_shared/sslcommerz.ts'

function credentialFailure(data: Record<string, unknown>) {
  const text = `${data.APIConnect || ''} ${data.failedreason || ''}`.toLowerCase()
  return /authentication|credential|store\s*id|password|inactive|invalid store|failed/.test(text)
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return json({ code: 'method-not-allowed', message: 'Method not allowed.' }, 405)

  try {
    const user = await requireUser(req)
    const body = await req.json().catch(() => ({}))
    const publicOrderId = String(body.order_id || '').trim()
    const storeSlug = String(body.store_slug || '').trim().toLowerCase()

    if (!publicOrderId) return json({ code: 'invalid-request', message: 'Order ID is required.' }, 400)

    const admin = createAdminClient()
    let orderQuery = admin
      .from('orders')
      .select('id, order_id, store_id, customer_id, customer_name, customer_phone, customer_email, delivery_address, district, total, payment_method, payment_status, status, items')
      .eq('order_id', publicOrderId)
      .eq('customer_id', user.id)

    const { data: order, error: orderError } = await orderQuery.maybeSingle()
    if (orderError || !order) return json({ code: 'order-not-found', message: 'Order not found.' }, 404)
    if (String(order.payment_method || '').toLowerCase() !== 'ssl') return json({ code: 'wrong-payment-method', message: 'This order does not use online payment.' }, 400)
    if (String(order.payment_status || '').toLowerCase() === 'paid') return json({ code: 'already-paid', message: 'This order is already paid.' }, 409)
    if (String(order.status || '').toLowerCase() === 'cancelled') return json({ code: 'order-cancelled', message: 'This order has been cancelled.' }, 409)

    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('id, shop_name, subdomain, account_status, storefront_published')
      .eq('id', order.store_id)
      .maybeSingle()

    if (storeError || !store || (storeSlug && String(store.subdomain || '').toLowerCase() !== storeSlug)) {
      return json({ code: 'order-not-found', message: 'Order not found.' }, 404)
    }
    if (String(store.account_status || 'active') !== 'active') return json({ code: 'shop-unavailable', message: 'Online payment is unavailable for this shop.' }, 400)

    const { data: config, error: configError } = await admin
      .from('payment_configs')
      .select('id, ssl_store_id, store_password, enabled, is_live, ssl_credentials_valid')
      .eq('store_id', order.store_id)
      .eq('method', 'ssl')
      .maybeSingle()

    if (configError || !config?.enabled || !config?.ssl_credentials_valid || !config.ssl_store_id || !config.store_password) {
      return json({ code: 'credentials-invalid', message: 'Online payment is temporarily unavailable for this shop.' }, 400)
    }

    const amount = Number(order.total || 0)
    if (!Number.isFinite(amount) || amount < 10 || amount > 500000) {
      return json({ code: 'invalid-amount', message: 'This order amount cannot be processed by SSLCommerz.' }, 400)
    }

    const transactionId = makeGatewayTransactionId()
    const mode = config.is_live ? 'live' : 'sandbox'
    const safeRequest = {
      public_order_id: order.order_id,
      gateway_transaction_id: transactionId,
      amount: Number(amount.toFixed(2)),
      currency: 'BDT',
      environment: mode,
      store_slug: store.subdomain,
      customer_id: user.id,
    }

    const { data: paymentTxn, error: transactionError } = await admin
      .from('payment_transactions')
      .insert({
        store_id: order.store_id,
        order_id: order.id,
        payment_config_id: config.id,
        provider: 'sslcommerz',
        transaction_id: transactionId,
        amount: amount.toFixed(2),
        currency: 'BDT',
        status: 'initiating',
        request_payload: safeRequest,
        response_payload: {},
        validation_payload: {},
      })
      .select('id')
      .single()

    if (transactionError || !paymentTxn) throw transactionError || new Error('Could not create payment transaction.')

    const items = Array.isArray(order.items) ? order.items : []
    const productName = items.length
      ? items.slice(0, 3).map((item) => String(item?.title || 'Product')).join(', ').slice(0, 255)
      : `BazarHQ Order ${order.order_id}`

    const params = new URLSearchParams({
      store_id: config.ssl_store_id,
      store_passwd: config.store_password,
      total_amount: amount.toFixed(2),
      currency: 'BDT',
      tran_id: transactionId,
      success_url: callbackUrl('sslcommerz-success'),
      fail_url: callbackUrl('sslcommerz-fail'),
      cancel_url: callbackUrl('sslcommerz-cancel'),
      ipn_url: callbackUrl('sslcommerz-ipn'),
      cus_name: String(order.customer_name || 'Customer').slice(0, 50),
      cus_email: String(order.customer_email || user.email || 'customer@bazarhq.com').slice(0, 50),
      cus_add1: String(order.delivery_address || 'Bangladesh').slice(0, 50),
      cus_city: String(order.district || 'Dhaka').slice(0, 50),
      cus_state: String(order.district || 'Dhaka').slice(0, 50),
      cus_postcode: '1200',
      cus_country: 'Bangladesh',
      cus_phone: String(order.customer_phone || '01700000000').slice(0, 20),
      shipping_method: 'YES',
      ship_name: String(order.customer_name || 'Customer').slice(0, 50),
      ship_add1: String(order.delivery_address || 'Bangladesh').slice(0, 50),
      ship_city: String(order.district || 'Dhaka').slice(0, 50),
      ship_state: String(order.district || 'Dhaka').slice(0, 50),
      ship_postcode: '1200',
      ship_country: 'Bangladesh',
      product_name: productName,
      product_category: 'Ecommerce',
      product_profile: 'general',
      value_a: String(order.order_id),
      value_b: String(store.subdomain || ''),
      value_c: String(paymentTxn.id),
      value_d: mode,
    })

    const { response, data } = await fetchJson(sslEndpoints(Boolean(config.is_live)).initiate, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: params.toString(),
    })

    const gatewayResponse = sanitizedGatewayResponse(data)
    const success = response.ok && String(data.status || '').toUpperCase() === 'SUCCESS' && Boolean(data.GatewayPageURL)

    await admin.from('payment_transactions').update({
      session_key: data.sessionkey ? String(data.sessionkey) : null,
      status: success ? 'session_created' : 'session_failed',
      response_payload: gatewayResponse,
      error_message: success ? null : 'SSLCommerz session creation failed.',
      updated_at: new Date().toISOString(),
    }).eq('id', paymentTxn.id)

    if (!success) {
      if (credentialFailure(data)) {
        await admin.from('payment_configs').update({
          enabled: false,
          ssl_credentials_valid: false,
          ssl_credentials_checked_at: new Date().toISOString(),
          ssl_credentials_error: 'Credentials rejected during payment initiation.',
        }).eq('id', config.id)
      }
      return json({
        code: credentialFailure(data) ? 'credentials-invalid' : 'gateway-unavailable',
        message: credentialFailure(data)
          ? 'Online payment is temporarily unavailable for this shop.'
          : 'The secure payment service could not be opened. Please try again.',
      }, 400)
    }

    await admin.from('orders').update({ payment_status: 'pending_gateway', updated_at: new Date().toISOString() }).eq('id', order.id)

    return json({
      gateway_url: String(data.GatewayPageURL),
      session_key: data.sessionkey ? String(data.sessionkey) : null,
      transaction_id: transactionId,
      environment: mode,
    })
  } catch (error) {
    if (String(error?.message || '') === 'AUTH_REQUIRED') return json({ code: 'auth-required', message: 'Customer login required.' }, 401)
    console.error('sslcommerz-initiate', error)
    return json({ code: 'gateway-init-failed', message: 'Could not start secure payment.' }, 500)
  }
})
