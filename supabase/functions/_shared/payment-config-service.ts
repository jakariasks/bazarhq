import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2'
import { encryptPaymentSecret } from './payment-secrets.ts'
import { validateCredentials } from './sslcommerz.ts'

const METHODS = new Set(['bkash', 'nagad', 'rocket', 'ssl', 'cod'])

export function canonicalMethod(value: unknown) {
  const method = String(value || '').trim().toLowerCase()
  if (method === 'sslcommerz') return 'ssl'
  if (method === 'cash_on_delivery' || method === 'cashondelivery') return 'cod'
  return method
}

export function normalizeBangladeshNumber(value: unknown) {
  let number = String(value || '').replace(/\D/g, '')
  if (number.startsWith('8801') && number.length === 13) number = number.slice(2)
  if (number.startsWith('1') && number.length === 10) number = `0${number}`
  return number
}

export function validBangladeshMerchantNumber(value: unknown) {
  return /^01[3-9][0-9]{8}$/.test(normalizeBangladeshNumber(value))
}

function maskLast4(value: unknown) {
  const clean = String(value || '').trim()
  return clean ? clean.slice(-4) : null
}

export async function ownedStore(admin: SupabaseClient, user: User, storeId: string) {
  const { data, error } = await admin
    .from('stores')
    .select('id,owner_id,shop_name,storefront_published,account_status')
    .eq('id', storeId)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (error) throw error
  if (!data || String(data.account_status || 'active') === 'deleted') throw new Error('STORE_NOT_FOUND')
  return data
}

export async function listPaymentConfigs(admin: SupabaseClient, user: User, storeId: string) {
  await ownedStore(admin, user, storeId)
  const { data, error } = await admin
    .from('payment_configs')
    .select('id,store_id,method,enabled,is_live,credential_last4,credential_valid,credential_error,credential_checked_at,ssl_credentials_valid,ssl_credentials_error,ssl_credentials_checked_at,merchant_number,ssl_store_id,created_at,updated_at')
    .eq('store_id', storeId)
    .order('created_at')
  if (error) throw error

  return (data || []).map((row) => {
    const method = canonicalMethod(row.method)
    const last4 = row.credential_last4 || (method === 'ssl' ? maskLast4(row.ssl_store_id) : maskLast4(row.merchant_number))
    const valid = method === 'ssl' ? Boolean(row.ssl_credentials_valid) : Boolean(row.credential_valid || method === 'cod')
    return {
      id: row.id,
      store_id: row.store_id,
      method,
      enabled: Boolean(row.enabled),
      is_live: Boolean(row.is_live),
      configured: method === 'cod' || Boolean(last4),
      credential_last4: last4,
      credential_valid: valid,
      credential_error: method === 'ssl' ? row.ssl_credentials_error : row.credential_error,
      credential_checked_at: method === 'ssl' ? row.ssl_credentials_checked_at : row.credential_checked_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  })
}

async function upsertConfig(admin: SupabaseClient, payload: Record<string, unknown>) {
  const { data, error } = await admin
    .from('payment_configs')
    .upsert(payload, { onConflict: 'store_id,method', ignoreDuplicates: false })
    .select('id')
    .single()
  if (error) throw error
  return data
}

export async function savePaymentConfig(admin: SupabaseClient, user: User, args: Record<string, unknown>) {
  const storeId = String(args.store_id || '').trim()
  const method = canonicalMethod(args.method)
  if (!storeId || !METHODS.has(method)) throw new Error('INVALID_REQUEST')
  await ownedStore(admin, user, storeId)
  const now = new Date().toISOString()

  if (method === 'cod') {
    await upsertConfig(admin, {
      store_id: storeId, method, enabled: args.enabled !== false,
      credential_valid: true, credential_error: null, credential_checked_at: now,
      credential_last4: null, updated_at: now,
    })
    return { valid: true, message: 'Cash on Delivery enabled.' }
  }

  if (['bkash', 'nagad', 'rocket'].includes(method)) {
    const number = normalizeBangladeshNumber(args.merchant_number)
    if (!validBangladeshMerchantNumber(number)) throw new Error('INVALID_MOBILE_NUMBER')
    await upsertConfig(admin, {
      store_id: storeId, method, merchant_number: number, enabled: args.enabled !== false,
      credential_last4: number.slice(-4), credential_valid: true,
      credential_error: null, credential_checked_at: now, updated_at: now,
    })
    return { valid: true, message: `${method} merchant number saved.`, last4: number.slice(-4) }
  }

  const sslStoreId = String(args.ssl_store_id || '').trim()
  const password = String(args.store_password || '').trim()
  const isLive = args.is_live === true
  if (!sslStoreId || !password || sslStoreId.length > 80 || password.length > 128) throw new Error('INVALID_SSL_FORMAT')

  let result
  try {
    result = await validateCredentials(sslStoreId, password, isLive)
  } catch (error) {
    if (String((error as Error)?.message || '') === 'GATEWAY_UNAVAILABLE') throw new Error('GATEWAY_UNAVAILABLE')
    throw error
  }

  const safeError = result.valid ? null : result.message
  const config = await upsertConfig(admin, {
    store_id: storeId,
    method: 'ssl',
    ssl_store_id: sslStoreId,
    store_id_key: sslStoreId,
    store_password: null,
    is_live: isLive,
    enabled: result.valid,
    credential_last4: sslStoreId.slice(-4),
    credential_valid: result.valid,
    credential_error: safeError,
    credential_checked_at: now,
    ssl_credentials_valid: result.valid,
    ssl_credentials_error: safeError,
    ssl_credentials_checked_at: now,
    updated_at: now,
  })

  if (result.valid) {
    const encrypted = await encryptPaymentSecret({ ssl_store_id: sslStoreId, store_password: password, is_live: String(isLive) })
    const { error } = await admin.from('payment_private_credentials').upsert({
      payment_config_id: config.id,
      cipher_text: encrypted.cipherText,
      iv: encrypted.iv,
      algorithm: 'AES-GCM-256',
      key_version: 1,
      updated_at: now,
    }, { onConflict: 'payment_config_id' })
    if (error) throw error
  }

  return {
    valid: result.valid,
    code: result.code,
    api_connect: result.apiConnect,
    environment: isLive ? 'live' : 'sandbox',
    message: result.message,
    last4: sslStoreId.slice(-4),
  }
}

export async function togglePaymentConfig(admin: SupabaseClient, user: User, args: Record<string, unknown>) {
  const storeId = String(args.store_id || '').trim()
  const method = canonicalMethod(args.method)
  const enabled = args.enabled === true
  if (!storeId || !METHODS.has(method)) throw new Error('INVALID_REQUEST')
  const store = await ownedStore(admin, user, storeId)

  const { data: config, error } = await admin
    .from('payment_configs')
    .select('id,method,enabled,credential_valid,ssl_credentials_valid')
    .eq('store_id', storeId)
    .eq('method', method)
    .maybeSingle()
  if (error) throw error
  if (!config) throw new Error('CONFIG_REQUIRED')
  const valid = method === 'cod' || (method === 'ssl' ? config.ssl_credentials_valid : config.credential_valid)
  if (enabled && !valid) throw new Error('CONFIG_INVALID')

  if (!enabled && store.storefront_published) {
    const { count } = await admin
      .from('payment_configs')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('enabled', true)
      .neq('method', method)
    if ((count || 0) === 0) throw new Error('LAST_METHOD_LIVE_STORE')
  }

  const { error: updateError } = await admin.from('payment_configs').update({ enabled, updated_at: new Date().toISOString() }).eq('id', config.id)
  if (updateError) throw updateError
  return { ok: true, enabled }
}
