import { adminClient } from './merchant-auth.ts'
import { loadPaymentSecret } from './payment-secrets.ts'
import { normalizeQueryRecord, publicSiteUrl, queryByTransactionId, sanitizedGatewayResponse, validateByValId } from './sslcommerz.ts'

type Outcome = 'success' | 'fail' | 'cancel' | 'ipn'
type JsonRecord = Record<string, unknown>
const upper = (value: unknown) => String(value || '').trim().toUpperCase()
const amountMatches = (a: unknown, b: unknown) => Number.isFinite(Number(a)) && Math.abs(Number(a) - Number(b)) <= 0.01
const currencyMatches = (row: JsonRecord) => upper(row.currency || row.currency_type) === 'BDT'
const recordMatches = (row: JsonRecord, tran: string, amount: unknown) => String(row.tran_id || '') === tran && amountMatches(row.amount, amount) && currencyMatches(row)

async function timelineOnce(admin: ReturnType<typeof adminClient>, orderId: string, status: string, note: string) {
  const { data } = await admin.from('order_timeline').select('id').eq('order_id', orderId).eq('status', status).limit(1).maybeSingle()
  if (!data) await admin.from('order_timeline').insert({ order_id: orderId, status, note })
}

export async function handleSslCallback(payload: Record<string, string>, outcome: Outcome) {
  const admin = adminClient()
  const transactionId = String(payload.tran_id || '').trim()
  const base = publicSiteUrl()
  if (!transactionId) return { ok: false, status: 'missing_transaction', httpStatus: 400, redirect: `${base}/payment/fail?reason=payment-not-verified` }

  const { data: transaction } = await admin
    .from('payment_transactions')
    .select('id,order_id,store_id,payment_config_id,transaction_id,amount,currency,status,request_payload')
    .eq('provider', 'sslcommerz').eq('transaction_id', transactionId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!transaction?.order_id) return { ok: false, status: 'transaction_not_found', httpStatus: 404, redirect: `${base}/payment/fail?reason=payment-not-verified` }

  const [{ data: order }, { data: store }, { data: config }] = await Promise.all([
    admin.from('orders').select('id,order_id,store_id,customer_email,customer_phone,total,payment_status').eq('id', transaction.order_id).maybeSingle(),
    admin.from('stores').select('id,subdomain').eq('id', transaction.store_id).maybeSingle(),
    admin.from('payment_configs').select('id,is_live').eq('id', transaction.payment_config_id).maybeSingle(),
  ])
  if (!order || !store || !config) return { ok: false, status: 'configuration_missing', httpStatus: 400, redirect: `${base}/payment/fail?reason=credentials-invalid` }

  let secret: Record<string, string>
  try { secret = await loadPaymentSecret(admin, config.id) }
  catch { return { ok: false, status: 'configuration_missing', httpStatus: 400, redirect: `${base}/payment/fail?reason=credentials-invalid` } }
  const sslStoreId = String(secret.ssl_store_id || '')
  const password = String(secret.store_password || '')
  const mode = String((transaction.request_payload as JsonRecord | null)?.environment || '')
  const isLive = mode ? mode === 'live' : (secret.is_live === 'true' || Boolean(config.is_live))

  let paymentStatus = outcome === 'cancel' ? 'cancelled' : outcome === 'fail' ? 'failed' : 'pending_verification'
  let verifiedRecord: JsonRecord | null = null
  let validation: JsonRecord = {}
  const valId = String(payload.val_id || '').trim()

  if ((outcome === 'success' || outcome === 'ipn') && valId) {
    try {
      const { response, data } = await validateByValId({ valId, storeId: sslStoreId, password, isLive })
      validation = sanitizedGatewayResponse(data)
      if (response.ok && ['VALID', 'VALIDATED'].includes(upper(data.status)) && recordMatches(data, transactionId, transaction.amount)) {
        verifiedRecord = data
        paymentStatus = String(data.risk_level || '0') === '1' ? 'pending_review' : 'paid'
      }
    } catch { paymentStatus = 'pending_verification' }
  }

  if (!verifiedRecord && !['paid', 'cancelled'].includes(paymentStatus)) {
    try {
      const { response, data } = await queryByTransactionId({ transactionId, storeId: sslStoreId, password, isLive })
      validation = { ...validation, query: sanitizedGatewayResponse(data), APIConnect: data.APIConnect }
      if (response.ok && upper(data.APIConnect) === 'DONE') {
        const row = normalizeQueryRecord(data, transactionId)
        if (row && recordMatches(row, transactionId, transaction.amount)) {
          const status = upper(row.status)
          if (['VALID', 'VALIDATED'].includes(status)) { verifiedRecord = row; paymentStatus = String(row.risk_level || '0') === '1' ? 'pending_review' : 'paid' }
          else if (['FAILED', 'EXPIRED', 'UNATTEMPTED'].includes(status)) paymentStatus = 'failed'
          else if (['CANCELLED', 'CANCEL'].includes(status)) paymentStatus = 'cancelled'
          else if (status === 'PENDING') paymentStatus = 'pending_gateway'
        }
      }
    } catch { /* keep current state */ }
  }

  if (upper(order.payment_status) === 'PAID') paymentStatus = 'paid'
  const now = new Date().toISOString()
  await admin.from('payment_transactions').update({
    status: paymentStatus,
    response_payload: sanitizedGatewayResponse(payload),
    validation_payload: validation,
    error_message: ['paid', 'pending_review'].includes(paymentStatus) ? null : `Payment ${paymentStatus}.`,
    completed_at: ['paid', 'failed', 'cancelled'].includes(paymentStatus) ? now : null,
    updated_at: now,
  }).eq('id', transaction.id)
  await admin.from('orders').update({
    payment_status: paymentStatus,
    ...(paymentStatus === 'paid' ? { txn_id: String(verifiedRecord?.bank_tran_id || transactionId), transaction_id: String(verifiedRecord?.bank_tran_id || transactionId) } : {}),
    updated_at: now,
  }).eq('id', order.id)

  const map: Record<string, [string, string]> = {
    paid: ['payment_confirmed', 'SSLCommerz payment verified server-side.'],
    pending_review: ['payment_pending_review', 'SSLCommerz marked this payment for review.'],
    failed: ['payment_failed', 'SSLCommerz payment failed.'],
    cancelled: ['payment_cancelled', 'SSLCommerz payment was cancelled.'],
    pending_verification: ['payment_pending_verification', 'Payment response received; verification is pending.'],
  }
  if (map[paymentStatus]) await timelineOnce(admin, order.id, map[paymentStatus][0], map[paymentStatus][1])

  if (String(order.payment_status || '') !== paymentStatus && order.customer_email) {
    await admin.from('email_notification_queue').insert({
      store_id: order.store_id, recipient_email: order.customer_email,
      subject: paymentStatus === 'paid' ? `Payment confirmed for order ${order.order_id}` : `Payment update for order ${order.order_id}`,
      body: `Payment for order ${order.order_id} is ${paymentStatus.replace('_', ' ')}.`, notification_type: 'customer_payment_status',
    })
  }

  const path = paymentStatus === 'paid' ? 'success' : paymentStatus === 'cancelled' ? 'cancel' : 'fail'
  const query = new URLSearchParams({ store: String(store.subdomain || ''), order: String(order.order_id || '') })
  if (paymentStatus !== 'paid') query.set('reason', `payment-${paymentStatus}`)
  return { ok: paymentStatus === 'paid', status: paymentStatus, httpStatus: 200, redirect: `${base}/payment/${path}?${query}` }
}
