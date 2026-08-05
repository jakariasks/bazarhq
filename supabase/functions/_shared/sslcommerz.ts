export type JsonRecord = Record<string, unknown>

const ENDPOINTS = {
  sandbox: {
    initiate: 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php',
    validate: 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php',
    query: 'https://sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php',
  },
  live: {
    initiate: 'https://securepay.sslcommerz.com/gwprocess/v4/api.php',
    validate: 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php',
    query: 'https://securepay.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php',
  },
} as const

export function sslEndpoints(isLive: boolean) {
  return isLive ? ENDPOINTS.live : ENDPOINTS.sandbox
}

export function callbackUrl(functionName: string) {
  const base = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '')
  if (!base) throw new Error('Missing SUPABASE_URL')
  return `${base}/functions/v1/${functionName}`
}

export function publicSiteUrl() {
  const base = (Deno.env.get('PUBLIC_SITE_URL') || '').replace(/\/$/, '')
  if (!base) throw new Error('Missing PUBLIC_SITE_URL Edge Function secret')
  return base
}

export function makeGatewayTransactionId() {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
  return `BHQ${timestamp}${random}`.slice(0, 30)
}

export async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const text = await response.text()
  let data: JsonRecord = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text.slice(0, 500) }
  }
  return { response, data }
}

export type CredentialCheckCode =
  | 'verified'
  | 'authentication-failed'
  | 'store-inactive'
  | 'invalid-request'
  | 'unexpected-response'

export type CredentialCheckResult = {
  valid: boolean
  apiConnect: string
  code: CredentialCheckCode
  message: string
}

function redactGatewayReason(reason: unknown, storeId: string, password: string) {
  let text = String(reason ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return ''

  for (const secret of [storeId, password]) {
    if (!secret) continue
    text = text.split(secret).join('[redacted]')
  }

  return text.slice(0, 220)
}

function credentialProbeTransactionId() {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 7).toUpperCase()
  return `BHQCFG${timestamp}${random}`.slice(0, 30)
}

/**
 * Verifies a credential pair by requesting a real SSLCOMMERZ hosted-payment
 * session with the documented mandatory fields.
 *
 * Do not use a random Transaction Query API lookup as a credential probe:
 * provider versions can return APIConnect=FAILED when the supplied tran_id
 * does not exist, producing a false "bad password" result. Successful session
 * creation is the authoritative proof that the selected environment accepted
 * the Store ID and Store Password. No payment is made and the URL is never
 * exposed to the merchant during this check.
 */
export async function validateCredentials(storeId: string, password: string, isLive: boolean): Promise<CredentialCheckResult> {
  const transactionId = credentialProbeTransactionId()
  const params = new URLSearchParams({
    store_id: storeId,
    store_passwd: password,
    total_amount: '10.00',
    currency: 'BDT',
    tran_id: transactionId,
    success_url: callbackUrl('sslcommerz-success'),
    fail_url: callbackUrl('sslcommerz-fail'),
    cancel_url: callbackUrl('sslcommerz-cancel'),
    ipn_url: callbackUrl('sslcommerz-ipn'),
    cus_name: 'BazarHQ Gateway Verification',
    cus_email: 'payments@bazarhq.com',
    cus_add1: 'Dhaka',
    cus_city: 'Dhaka',
    cus_postcode: '1205',
    cus_country: 'Bangladesh',
    cus_phone: '01700000000',
    shipping_method: 'NO',
    product_name: 'Gateway credential verification',
    product_category: 'software-service',
    product_profile: 'non-physical-goods',
    value_a: 'bazarhq_credential_check',
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)

  let response: Response
  let data: JsonRecord
  try {
    const result = await fetchJson(sslEndpoints(isLive).initiate, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: controller.signal,
    })
    response = result.response
    data = result.data
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('GATEWAY_UNAVAILABLE')
    throw error
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) throw new Error('GATEWAY_UNAVAILABLE')

  const status = String(data.status ?? '').trim().toUpperCase()
  const gatewayPageUrl = String(data.GatewayPageURL ?? '').trim()
  const sessionKey = String(data.sessionkey ?? '').trim()
  const reason = redactGatewayReason(data.failedreason, storeId, password)

  if (status === 'SUCCESS' && gatewayPageUrl && sessionKey) {
    return {
      valid: true,
      apiConnect: 'DONE',
      code: 'verified',
      message: `SSLCommerz ${isLive ? 'live' : 'sandbox'} credentials verified and enabled.`,
    }
  }

  const lowerReason = reason.toLowerCase()

  if (lowerReason.includes('inactive')) {
    return {
      valid: false,
      apiConnect: 'INACTIVE',
      code: 'store-inactive',
      message: `This SSLCommerz ${isLive ? 'live' : 'sandbox'} store is inactive.`,
    }
  }

  if (
    lowerReason.includes('password') ||
    lowerReason.includes('store id') ||
    lowerReason.includes('store_id') ||
    lowerReason.includes('authentication') ||
    lowerReason.includes('credential') ||
    lowerReason.includes('merchant not found')
  ) {
    return {
      valid: false,
      apiConnect: 'FAILED',
      code: 'authentication-failed',
      message: `Store ID or Store Password was rejected by the ${isLive ? 'live' : 'sandbox'} gateway.`,
    }
  }

  if (status === 'FAILED') {
    return {
      valid: false,
      apiConnect: 'INVALID_REQUEST',
      code: 'invalid-request',
      message: reason
        ? `SSLCommerz rejected the verification request: ${reason}`
        : 'SSLCommerz rejected the credential verification request.',
    }
  }

  return {
    valid: false,
    apiConnect: status || 'UNKNOWN',
    code: 'unexpected-response',
    message: 'SSLCommerz returned an unexpected verification response.',
  }
}

export async function validateByValId(args: { valId: string; storeId: string; password: string; isLive: boolean }) {
  const url = new URL(sslEndpoints(args.isLive).validate)
  url.searchParams.set('val_id', args.valId)
  url.searchParams.set('store_id', args.storeId)
  url.searchParams.set('store_passwd', args.password)
  url.searchParams.set('v', '1')
  url.searchParams.set('format', 'json')
  return fetchJson(url.toString(), { headers: { Accept: 'application/json' } })
}

export async function queryByTransactionId(args: { transactionId: string; storeId: string; password: string; isLive: boolean }) {
  const url = new URL(sslEndpoints(args.isLive).query)
  url.searchParams.set('tran_id', args.transactionId)
  url.searchParams.set('store_id', args.storeId)
  url.searchParams.set('store_passwd', args.password)
  url.searchParams.set('format', 'json')
  return fetchJson(url.toString(), { headers: { Accept: 'application/json' } })
}

export function sanitizedGatewayResponse(data: JsonRecord) {
  const allowed = [
    'status', 'failedreason', 'sessionkey', 'GatewayPageURL', 'APIConnect', 'tran_id', 'val_id',
    'amount', 'currency', 'currency_type', 'bank_tran_id', 'card_type', 'risk_level', 'risk_title',
  ]
  const result: JsonRecord = {}
  for (const key of allowed) if (data[key] !== undefined) result[key] = data[key]
  return result
}

export function normalizeQueryRecord(data: JsonRecord, transactionId: string): JsonRecord | null {
  const raw = data.element
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : []
  const match = rows.find((row) => row && typeof row === 'object' && String((row as JsonRecord).tran_id || '') === transactionId)
  if (match && typeof match === 'object') return match as JsonRecord
  if (String(data.tran_id || '') === transactionId) return data
  return null
}
