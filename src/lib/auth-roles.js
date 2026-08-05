import { supabase } from '@/integrations/supabase/client'

export const ROLE_MERCHANT = 'merchant'
export const ROLE_CUSTOMER = 'customer'

export const MERCHANT_OAUTH_INTENT_KEY = 'bazarhq_merchant_oauth_intent'
export const CUSTOMER_OAUTH_INTENT_KEY = 'bazarhq_customer_oauth_intent'

const INTENT_MAX_AGE_MS = 15 * 60 * 1000
const VALID_ROLES = new Set([ROLE_MERCHANT, ROLE_CUSTOMER])

export function normalizeRoles(value) {
  const source = Array.isArray(value)
    ? value
    : Array.isArray(value?.roles)
      ? value.roles
      : []

  return [...new Set(source.map((role) => String(role || '').toLowerCase()).filter((role) => VALID_ROLES.has(role)))]
}

export function getUserRolesFromMetadata(user) {
  const roles = normalizeRoles(user?.user_metadata?.roles || user?.app_metadata?.roles || [])
  const legacyRole = String(user?.user_metadata?.role || user?.app_metadata?.role || '').toLowerCase()
  if (VALID_ROLES.has(legacyRole) && !roles.includes(legacyRole)) roles.push(legacyRole)
  return roles
}

export function getUserRole(user) {
  const roles = getUserRolesFromMetadata(user)
  return roles.includes(ROLE_MERCHANT) ? ROLE_MERCHANT : roles[0] || null
}

export function hasRole(roles, role) {
  return normalizeRoles(roles).includes(role)
}

export function safeInternalPath(path, fallback = '/') {
  if (typeof path !== 'string') return fallback
  if (!path.startsWith('/') || path.startsWith('//')) return fallback
  return path
}

export function getStoredIntent(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed?.createdAt || Date.now() - parsed.createdAt > INTENT_MAX_AGE_MS) {
      localStorage.removeItem(key)
      return null
    }

    return parsed
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

export function setStoredIntent(key, data = {}) {
  localStorage.setItem(key, JSON.stringify({ ...data, createdAt: Date.now() }))
}

export function clearStoredIntent(key) {
  localStorage.removeItem(key)
}

export function clearAllRoleIntents() {
  clearStoredIntent(MERCHANT_OAUTH_INTENT_KEY)
  clearStoredIntent(CUSTOMER_OAUTH_INTENT_KEY)
}

function migrationMessage(error) {
  const message = String(error?.message || '')
  if (error?.code === 'PGRST202' || message.includes('get_my_roles') || message.includes('activate_my_role')) {
    return new Error('Multi-role account migration is not installed yet. Run 20260805_multi_role_accounts.sql in Supabase first.')
  }
  return error
}

async function legacyRoleFallback(user) {
  if (!user?.id) return []

  const metadataRoles = getUserRolesFromMetadata(user)
  const [merchantResult, customerResult] = await Promise.all([
    supabase.from('profiles').select('id').eq('id', user.id).maybeSingle(),
    supabase.from('customer_profiles').select('id,account_status').eq('id', user.id).maybeSingle(),
  ])

  const roles = [...metadataRoles]
  if (merchantResult.data && !roles.includes(ROLE_MERCHANT)) roles.push(ROLE_MERCHANT)
  if (customerResult.data && customerResult.data.account_status !== 'deleted' && !roles.includes(ROLE_CUSTOMER)) {
    roles.push(ROLE_CUSTOMER)
  }
  return normalizeRoles(roles)
}

export async function fetchMyRoles(user) {
  if (!user?.id) return []

  const { data, error } = await supabase.rpc('get_my_roles')
  if (!error) return normalizeRoles(data)

  // During a staged deploy, existing profile tables still provide a safe read-only fallback.
  const fallback = await legacyRoleFallback(user)
  if (fallback.length) return fallback
  throw migrationMessage(error)
}

export async function activateMyRole(role, details = {}) {
  if (!VALID_ROLES.has(role)) throw new Error('Unsupported account role.')

  const { data, error } = await supabase.rpc('activate_my_role', {
    p_role: role,
    p_full_name: details.fullName?.trim() || null,
    p_phone: details.phone?.trim() || null,
  })

  if (error) throw migrationMessage(error)
  return normalizeRoles(data)
}

export async function getCurrentSessionUser() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session?.user || null
}

export async function signOutDifferentUser(expectedEmail) {
  const current = await getCurrentSessionUser()
  if (!current) return null

  const normalizedExpected = String(expectedEmail || '').trim().toLowerCase()
  const normalizedCurrent = String(current.email || '').trim().toLowerCase()
  if (normalizedExpected && normalizedCurrent === normalizedExpected) return current

  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error && error.name !== 'AuthSessionMissingError') throw error
  return null
}
