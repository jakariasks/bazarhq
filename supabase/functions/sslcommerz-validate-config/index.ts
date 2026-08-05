// Backward-compatible secure wrapper. New frontend uses merchant-payment-config.
import { corsHeaders, json, requireUser, safeError } from '../_shared/merchant-auth.ts'
import { savePaymentConfig } from '../_shared/payment-config-service.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ valid: false, message: 'Method not allowed.' }, 405)
  try {
    const { admin, user } = await requireUser(req)
    const body = await req.json().catch(() => ({}))
    const result = await savePaymentConfig(admin, user, {
      action: 'save', method: 'ssl', store_id: body.store_id,
      ssl_store_id: body.ssl_store_id, store_password: body.store_password,
      is_live: body.is_live === true, enabled: true,
    })
    return json(result)
  } catch (error) {
    if (error instanceof Response) return error
    const code = String((error as Error)?.message || '')
    if (code === 'GATEWAY_UNAVAILABLE') return json({ valid: false, code, message: 'SSLCommerz could not be reached. Existing settings were not changed.' }, 503)
    return json({ valid: false, code: code || 'internal-error', message: safeError(error, 'Could not validate SSLCommerz settings.') }, code.startsWith('INVALID_') ? 400 : 500)
  }
})
