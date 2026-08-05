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

/**
 * Verifies the merchant credential pair against the official Transaction Query API.
 *
 * SSLCOMMERZ documents APIConnect as:
 * DONE = authenticated, FAILED = authentication failed,
 * INACTIVE = store inactive, INVALID_REQUEST = malformed request.
 * A non-existent random transaction ID is intentional: we only need the
 * authenticated API connection result, not a real transaction record.
 */
export async function validateCredentials(storeId: string, password: string, isLive: boolean): Promise<CredentialCheckResult> {
  const url = new URL(sslEndpoints(isLive).query)
  url.searchParams.set('tran_id', `BHQCHECK${Date.now().toString(36).toUpperCase()}`.slice(0, 30))
  url.searchParams.set('store_id', storeId)
  url.searchParams.set('store_passwd', password)
  url.searchParams.set('v', '1')
  url.searchParams.set('format', 'json')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  let response: Response
  let data: JsonRecord
  try {
    const result = await fetchJson(url.toString(), {
      headers: { Accept: 'application/json' },
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

  const apiConnect = String(data.APIConnect ?? data.apiConnect ?? '').trim().toUpperCase()

  if (apiConnect === 'DONE') {
    return {
      valid: true,
      apiConnect,
      code: 'verified',
      message: `SSLCommerz ${isLive ? 'live' : 'sandbox'} credentials verified.`,
    }
  }

  if (apiConnect === 'FAILED') {
    return {
      valid: false,
      apiConnect,
      code: 'authentication-failed',
      message: `Store ID or Store Password was rejected by the ${isLive ? 'live' : 'sandbox'} gateway.`,
    }
  }

  if (apiConnect === 'INACTIVE') {
    return {
      valid: false,
      apiConnect,
      code: 'store-inactive',
      message: `This SSLCommerz ${isLive ? 'live' : 'sandbox'} store is inactive.`,
    }
  }

  if (apiConnect === 'INVALID_REQUEST') {
    return {
      valid: false,
      apiConnect,
      code: 'invalid-request',
      message: 'SSLCommerz rejected the credential-check request.',
    }
  }

  return {
    valid: false,
    apiConnect: apiConnect || 'UNKNOWN',
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
