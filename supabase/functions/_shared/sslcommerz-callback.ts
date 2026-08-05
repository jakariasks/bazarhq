import { createAdminClient } from './supabaseAdmin.ts'
import { normalizeQueryRecord, publicSiteUrl, queryByTransactionId, sanitizedGatewayResponse, validateByValId } from './sslcommerz.ts'

type CallbackOutcome = 'success' | 'fail' | 'cancel' | 'ipn'
type JsonRecord = Record<string, unknown>

function upper(value: unknown) {
  return String(value || '').trim().toUpperCase()
}

function amountMatches(received: unknown, expected: unknown) {
  const a = Number(received)
  const b = Number(expected)
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 0.01
}

function currencyMatches(record: JsonRecord) {
  return upper(record.currency || record.currency_type) === 'BDT'
}

function recordMatches(record: JsonRecord, transactionId: string, amount: unknown) {
  return String(record.tran_id || '') === transactionId && amountMatches(record.amount, amount) && currencyMatches(record)
}

function reasonFor(status: string) {
  if (status === 'pending_review') return 'payment-risk-review'
  if (status === 'pending_verification') return 'payment-not-verified'
  if (status === 'failed') return 'payment-failed'
  if (status === 'cancelled') return 'payment-cancelled'
  return ''
}

async function insertTimelineOnce(admin: ReturnType<typeof createAdminClient>, orderId: string, status: string, note: string) {
  const { data } = await admin.from('order_timeline').select('id').eq('order_id', orderId).eq('status', status).limit(1).maybeSingle()
  if (!data) await admin.from('order_timeline').insert({ order_id: orderId, status, note })
}

async function queuePaymentNotice(admin: ReturnType<typeof createAdminClient>, order: JsonRecord, status: string) {
  const publicOrderId = String(order.order_id || '')
  const customerEmail = String(order.customer_email || '').trim()
  const customerPhone = String(order.customer_phone || '').trim()
  const storeId = String(order.store_id || '')

  const message = status === 'paid'
    ? `Payment for order ${publicOrderId} has been verified.`
    : status === 'pending_review'
      ? `Payment for order ${publicOrderId} is under review.`
      : `Payment for order ${publicOrderId} is ${status.replace('_', ' ')}.`

  if (customerEmail) {
    await admin.from('email_notification_queue').insert({
      store_id: storeId,
      recipient_email: customerEmail,
      subject: status === 'paid' ? `Payment confirmed for order ${publicOrderId}` : `Payment update for order ${publicOrderId}`,
      body: message,
    })
  }
  if (customerPhone && status === 'paid') {
    await admin.from('sms_notification_queue').insert({ store_id: storeId, recipient_phone: customerPhone, message })
  }
}

export async function handleSslCallback(payload: Record<string, string>, outcome: CallbackOutcome) {
  const admin = createAdminClient()
  const transactionId = String(payload.tran_id || '').trim()
  if (!transactionId) return { ok: false, status: 'missing_transaction', httpStatus: 400, redirect: `${publicSiteUrl()}/payment/fail?reason=payment-not-verified` }

  const { data: transaction, error: txnError } = await admin
    .from('payment_transactions')
    .select('id, order_id, store_id, payment_config_id, transaction_id, session_key, amount, currency, status, request_payload')
    .eq('provider', 'sslcommerz')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (txnError || !transaction?.order_id) {
    return { ok: false, status: 'transaction_not_found', httpStatus: 404, redirect: `${publicSiteUrl()}/payment/fail?reason=payment-not-verified` }
  }

  const { data: order } = await admin
    .from('orders')
    .select('id, order_id, store_id, customer_id, customer_email, customer_phone, total, payment_status, payment_method, status')
    .eq('id', transaction.order_id)
    .maybeSingle()

  const { data: store } = await admin.from('stores').select('id, subdomain, owner_id').eq('id', transaction.store_id).maybeSingle()
  const { data: config } = await admin
    .from('payment_configs')
    .select('id, ssl_store_id, store_password, enabled, is_live, ssl_credentials_valid')
    .eq('id', transaction.payment_config_id)
    .maybeSingle()

  if (!order || !store || !config?.ssl_store_id || !config.store_password) {
    return { ok: false, status: 'configuration_missing', httpStatus: 400, redirect: `${publicSiteUrl()}/payment/fail?reason=credentials-invalid` }
  }

  const modeFromTransaction = String((transaction.request_payload as JsonRecord | null)?.environment || '')
  const isLive = modeFromTransaction ? modeFromTransaction === 'live' : Boolean(config.is_live)
  let validation: JsonRecord = {}
  let paymentStatus = 'pending_verification'
  let verifiedRecord: JsonRecord | null = null
  let credentialRejected = false

  const valId = String(payload.val_id || '').trim()
  if ((outcome === 'success' || outcome === 'ipn') && valId) {
    try {
      const { response, data } = await validateByValId({ valId, storeId: config.ssl_store_id, password: config.store_password, isLive })
      validation = sanitizedGatewayResponse(data)
      const gatewayStatus = upper(data.status)
      const exact = response.ok && ['VALID', 'VALIDATED'].includes(gatewayStatus) && recordMatches(data, transactionId, transaction.amount)
      if (exact) {
        verifiedRecord = data
        paymentStatus = String(data.risk_level || '0') === '1' ? 'pending_review' : 'paid'
      }
    } catch {
      paymentStatus = 'pending_verification'
    }
  }

  if (!verifiedRecord && paymentStatus !== 'paid') {
    try {
      const { response, data } = await queryByTransactionId({ transactionId, storeId: config.ssl_store_id, password: config.store_password, isLive })
      validation = { ...validation, query: sanitizedGatewayResponse(data), APIConnect: data.APIConnect }
      const apiConnect = upper(data.APIConnect)
      credentialRejected = ['FAILED', 'INACTIVE'].includes(apiConnect)

      if (response.ok && apiConnect === 'DONE') {
        const record = normalizeQueryRecord(data, transactionId)
        if (record && recordMatches(record, transactionId, transaction.amount)) {
          const status = upper(record.status)
          if (['VALID', 'VALIDATED'].includes(status)) {
            verifiedRecord = record
            paymentStatus = String(record.risk_level || '0') === '1' ? 'pending_review' : 'paid'
          } else if (status === 'FAILED' || status === 'EXPIRED' || status === 'UNATTEMPTED') {
            paymentStatus = 'failed'
          } else if (status === 'CANCELLED' || status === 'CANCEL') {
            paymentStatus = 'cancelled'
          } else if (status === 'PENDING') {
            paymentStatus = 'pending_gateway'
          }
        }
      }
    } catch {
      paymentStatus = 'pending_verification'
    }
  }

  if (upper(order.payment_status) === 'PAID') paymentStatus = 'paid'

  if (credentialRejected) {
    await admin.from('payment_configs').update({
      enabled: false,
      ssl_credentials_valid: false,
      ssl_credentials_checked_at: new Date().toISOString(),
      ssl_credentials_error: 'Credentials rejected during payment verification.',
    }).eq('id', config.id)
  }

  const now = new Date().toISOString()
  const transactionUpdate: JsonRecord = {
    status: paymentStatus,
    response_payload: sanitizedGatewayResponse(payload),
    validation_payload: validation,
    error_message: ['paid', 'pending_review'].includes(paymentStatus) ? null : `Payment ${paymentStatus}.`,
    updated_at: now,
  }
  if (['paid', 'failed', 'cancelled'].includes(paymentStatus)) transactionUpdate.completed_at = now

  await admin.from('payment_transactions').update(transactionUpdate).eq('id', transaction.id)

  const orderUpdate: JsonRecord = { payment_status: paymentStatus, updated_at: now }
  if (paymentStatus === 'paid') {
    orderUpdate.txn_id = String(verifiedRecord?.bank_tran_id || verifiedRecord?.tran_id || transactionId)
    orderUpdate.transaction_id = orderUpdate.txn_id
  }
  await admin.from('orders').update(orderUpdate).eq('id', order.id)

  const timelineMap: Record<string, [string, string]> = {
    paid: ['payment_confirmed', 'SSLCommerz payment was verified server-side.'],
    pending_review: ['payment_pending_review', 'SSLCommerz marked this payment for risk review.'],
    failed: ['payment_failed', 'SSLCommerz payment failed.'],
    cancelled: ['payment_cancelled', 'SSLCommerz payment was cancelled.'],
    pending_verification: ['payment_pending_verification', 'Payment response received; server verification is pending.'],
  }
  if (timelineMap[paymentStatus]) {
    const [timelineStatus, note] = timelineMap[paymentStatus]
    await insertTimelineOnce(admin, order.id, timelineStatus, note)
  }

  const previousStatus = String(order.payment_status || '')
  if (previousStatus !== paymentStatus && ['paid', 'pending_review', 'failed', 'cancelled'].includes(paymentStatus)) {
    await queuePaymentNotice(admin, order as JsonRecord, paymentStatus)
  }

  const path = paymentStatus === 'paid' ? 'success' : paymentStatus === 'cancelled' ? 'cancel' : 'fail'
  const query = new URLSearchParams({ store: String(store.subdomain || ''), order: String(order.order_id || '') })
  const reason = reasonFor(paymentStatus)
  if (reason) query.set('reason', reason)

  return {
    ok: paymentStatus === 'paid',
    status: paymentStatus,
    httpStatus: 200,
    redirect: `${publicSiteUrl()}/payment/${path}?${query.toString()}`,
  }
}
