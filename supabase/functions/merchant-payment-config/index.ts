import { corsHeaders, json, requireUser, safeError } from '../_shared/merchant-auth.ts'
import { listPaymentConfigs, savePaymentConfig, togglePaymentConfig } from '../_shared/payment-config-service.ts'

function errorResponse(error: unknown) {
  const code = String((error as Error)?.message || '')
  const map: Record<string, [number, string]> = {
    STORE_NOT_FOUND: [404, 'Store not found.'],
    INVALID_REQUEST: [400, 'Invalid payment configuration request.'],
    INVALID_MOBILE_NUMBER: [400, 'Enter a valid Bangladesh mobile merchant number (01XXXXXXXXX).'],
    INVALID_SSL_FORMAT: [400, 'SSLCommerz Store ID or Store Password format is invalid.'],
    GATEWAY_UNAVAILABLE: [503, 'SSLCommerz could not be reached. Existing settings were not changed.'],
    CONFIG_REQUIRED: [400, 'Configure this payment method before enabling it.'],
    CONFIG_INVALID: [400, 'This payment method must pass validation before it can be enabled.'],
    LAST_METHOD_LIVE_STORE: [409, 'A live store must keep at least one valid payment method active. Unpublish the store first or enable another method.'],
  }
  const known = map[code]
  return known ? json({ error: known[1], code }, known[0]) : json({ error: safeError(error, 'Could not update payment settings.') }, 500)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  try {
    const { admin, user } = await requireUser(req)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'list')
    if (action === 'list') return json({ configs: await listPaymentConfigs(admin, user, String(body.store_id || '')) })
    if (action === 'save') {
      const result = await savePaymentConfig(admin, user, body)
      const configs = await listPaymentConfigs(admin, user, String(body.store_id || ''))
      return json({ ...result, configs })
    }
    if (action === 'toggle') {
      const result = await togglePaymentConfig(admin, user, body)
      const configs = await listPaymentConfigs(admin, user, String(body.store_id || ''))
      return json({ ...result, configs })
    }
    return json({ error: 'Unknown action.' }, 400)
  } catch (error) {
    if (error instanceof Response) return error
    return errorResponse(error)
  }
})
