import { handleCors, json } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { requireUser } from '../_shared/auth.ts'
import { validateCredentials } from '../_shared/sslcommerz.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return json({ valid: false, message: 'Method not allowed.' }, 405)

  try {
    const user = await requireUser(req)
    const body = await req.json().catch(() => ({}))
    const storeId = String(body.store_id || '').trim()
    const sslStoreId = String(body.ssl_store_id || '').trim()
    const storePassword = String(body.store_password || '').trim()
    const isLive = Boolean(body.is_live)

    if (!storeId || !sslStoreId || !storePassword) {
      return json({ valid: false, message: 'Store ID and password are required.' }, 400)
    }
    if (sslStoreId.length > 30 || storePassword.length > 100) {
      return json({ valid: false, message: 'Credential format is invalid.' }, 400)
    }

    const admin = createAdminClient()
    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('id, owner_id, account_status')
      .eq('id', storeId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (storeError || !store || String(store.account_status || 'active') === 'deleted') {
      return json({ valid: false, message: 'Store not found.' }, 404)
    }

    let result
    try {
      result = await validateCredentials(sslStoreId, storePassword, isLive)
    } catch (error) {
      if (String(error?.message || '') === 'GATEWAY_UNAVAILABLE') {
        return json({ valid: false, code: 'gateway-unavailable', message: 'SSLCommerz could not be reached. Existing settings were not changed.' }, 503)
      }
      throw error
    }

    const checkedAt = new Date().toISOString()
    const valid = Boolean(result.valid)
    const safeError = valid ? null : 'Credentials rejected by SSLCommerz.'

    const { error: saveError } = await admin.from('payment_configs').upsert({
      store_id: storeId,
      method: 'ssl',
      ssl_store_id: sslStoreId,
      store_id_key: sslStoreId,
      store_password: storePassword,
      is_live: isLive,
      enabled: valid,
      ssl_credentials_valid: valid,
      ssl_credentials_checked_at: checkedAt,
      ssl_credentials_error: safeError,
      updated_at: checkedAt,
    }, { onConflict: 'store_id,method' })

    if (saveError) throw saveError

    if (!valid) {
      return json({ valid: false, code: 'credentials-invalid', message: 'The credentials were not accepted. SSLCommerz has been disabled.' }, 400)
    }

    return json({ valid: true, environment: isLive ? 'live' : 'sandbox', message: 'SSLCommerz credentials verified.' })
  } catch (error) {
    if (String(error?.message || '') === 'AUTH_REQUIRED') return json({ valid: false, message: 'Merchant login required.' }, 401)
    console.error('sslcommerz-validate-config', error)
    return json({ valid: false, message: 'Could not validate SSLCommerz settings.' }, 500)
  }
})
