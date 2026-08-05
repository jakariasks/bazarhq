import { handleCors, json } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { requireUser } from '../_shared/auth.ts'
import { validateCredentials } from '../_shared/sslcommerz.ts'

function cleanCredential(value: unknown) {
  return String(value ?? '').trim()
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return json({ valid: false, message: 'Method not allowed.' }, 405)

  try {
    const user = await requireUser(req)
    const body = await req.json().catch(() => ({}))
    const storeId = cleanCredential(body.store_id)
    const sslStoreId = cleanCredential(body.ssl_store_id)
    const storePassword = cleanCredential(body.store_password)
    const isLive = body.is_live === true
    const environment = isLive ? 'live' : 'sandbox'

    if (!storeId || !sslStoreId || !storePassword) {
      return json({ valid: false, code: 'missing-credentials', message: 'Store ID and Store Password are required.' }, 400)
    }

    // Sandbox-generated passwords can be longer than the legacy 30-character
    // documentation examples. Accept the actual dashboard credential length
    // while still rejecting obviously malformed pasted content.
    if (sslStoreId.length > 80 || storePassword.length > 128) {
      return json({ valid: false, code: 'credential-format', message: 'Store ID or Store Password format is invalid.' }, 400)
    }

    const admin = createAdminClient()
    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('id, owner_id, account_status')
      .eq('id', storeId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (storeError || !store || String(store.account_status || 'active') === 'deleted') {
      return json({ valid: false, code: 'store-not-found', message: 'Store not found.' }, 404)
    }

    let result
    try {
      result = await validateCredentials(sslStoreId, storePassword, isLive)
    } catch (error) {
      if (String(error?.message || '') === 'GATEWAY_UNAVAILABLE') {
        return json({
          valid: false,
          code: 'gateway-unavailable',
          message: 'SSLCommerz could not be reached. Existing settings were not changed.',
        }, 503)
      }
      throw error
    }

    const checkedAt = new Date().toISOString()
    const valid = result.valid === true
    const safeError = valid ? null : result.message

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
    }, { onConflict: 'store_id,method', ignoreDuplicates: false })

    if (saveError) throw saveError

    // Never log or return the password. APIConnect is safe and useful for
    // diagnosing FAILED / INACTIVE / INVALID_REQUEST in Edge Function logs.
    console.info('sslcommerz credential check', {
      storeId,
      environment,
      apiConnect: result.apiConnect,
      code: result.code,
      valid,
    })

    // Credential rejection is an expected business result, not a transport
    // failure. Return HTTP 200 so supabase.functions.invoke exposes the JSON
    // body and the merchant sees the exact safe reason.
    if (!valid) {
      return json({
        valid: false,
        code: result.code,
        api_connect: result.apiConnect,
        environment,
        message: result.message,
      })
    }

    return json({
      valid: true,
      code: result.code,
      api_connect: result.apiConnect,
      environment,
      message: result.message,
    })
  } catch (error) {
    if (String(error?.message || '') === 'AUTH_REQUIRED') {
      return json({ valid: false, code: 'auth-required', message: 'Merchant login required.' }, 401)
    }

    console.error('sslcommerz-validate-config', error)
    return json({ valid: false, code: 'internal-error', message: 'Could not validate SSLCommerz settings.' }, 500)
  }
})
