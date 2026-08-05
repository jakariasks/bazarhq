import { supabase } from '@/integrations/supabase/client'

const HEARTBEAT_STORAGE_KEY = 'bazarhq:merchant-session:last-heartbeat'
const HEARTBEAT_THROTTLE_MS = 60_000
const REFRESH_WINDOW_MS = 120_000

export class MerchantSecurityError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'MerchantSecurityError'
    this.code = options.code || 'REQUEST_FAILED'
    this.status = Number(options.status || 0)
    this.retryable = Boolean(options.retryable)
    this.cause = options.cause
  }
}

export function isMerchantSessionRevoked(error) {
  return error?.code === 'SESSION_REVOKED' || /session\s+revoked/i.test(error?.message || '')
}

export function isMerchantAuthMissing(error) {
  return ['AUTH_MISSING', 'AUTH_INVALID'].includes(error?.code)
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function readFunctionError(error) {
  let status = Number(error?.context?.status || 0)
  let payload = null

  const response = error?.context
  if (response && typeof response.clone === 'function') {
    try {
      payload = await response.clone().json()
    } catch {
      try {
        const text = await response.clone().text()
        payload = text ? { error: text } : null
      } catch {
        payload = null
      }
    }
  }

  const code = String(payload?.code || '') || (
    status === 401 ? 'AUTH_INVALID'
      : status === 403 ? 'FORBIDDEN'
        : status === 429 ? 'RATE_LIMITED'
          : status >= 500 ? 'SERVICE_UNAVAILABLE'
            : 'REQUEST_FAILED'
  )

  const message = String(payload?.error || payload?.message || error?.message || 'Request failed.')
  const retryable = payload?.retryable === true || status === 0 || status === 429 || status >= 500

  return new MerchantSecurityError(message, { code, status, retryable, cause: error })
}

async function getUsableSession({ forceRefresh = false } = {}) {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw new MerchantSecurityError('Could not read the current login session.', {
      code: 'AUTH_SESSION_READ_FAILED',
      retryable: true,
      cause: error,
    })
  }

  let session = data?.session || null
  if (!session) {
    throw new MerchantSecurityError('Your login session is no longer available.', {
      code: 'AUTH_MISSING',
      status: 401,
      retryable: false,
    })
  }

  const expiresAtMs = Number(session.expires_at || 0) * 1000
  const shouldRefresh = forceRefresh || (expiresAtMs > 0 && expiresAtMs - Date.now() <= REFRESH_WINDOW_MS)

  if (shouldRefresh) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError && refreshed?.session) session = refreshed.session
  }

  return session
}

async function invokeOnce(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (!error && !data?.error) return data

  if (!error && data?.error) {
    throw new MerchantSecurityError(data.error, {
      code: data.code || 'REQUEST_FAILED',
      status: Number(data.status || 0),
      retryable: Boolean(data.retryable),
    })
  }

  throw await readFunctionError(error)
}

async function invoke(name, body, { retryAuth = true, retryTransient = true } = {}) {
  await getUsableSession()

  try {
    return await invokeOnce(name, body)
  } catch (firstError) {
    if (isMerchantSessionRevoked(firstError)) throw firstError

    if (retryAuth && firstError?.status === 401) {
      try {
        await getUsableSession({ forceRefresh: true })
        return await invokeOnce(name, body)
      } catch (retryError) {
        if (isMerchantSessionRevoked(retryError)) throw retryError
        if (retryError?.status === 401) throw retryError
        if (retryTransient && retryError?.retryable) {
          await sleep(500)
          return invokeOnce(name, body)
        }
        throw retryError
      }
    }

    if (retryTransient && firstError?.retryable) {
      await sleep(500)
      try {
        return await invokeOnce(name, body)
      } catch (retryError) {
        throw retryError
      }
    }

    throw firstError
  }
}

export function detectDevice() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
  const browser = ua.includes('Edg/') ? 'Microsoft Edge'
    : ua.includes('OPR/') ? 'Opera'
      : ua.includes('Chrome/') ? 'Chrome'
        : ua.includes('Firefox/') ? 'Firefox'
          : ua.includes('Safari/') ? 'Safari'
            : 'Browser'
  const os = ua.includes('Windows') ? 'Windows'
    : ua.includes('Android') ? 'Android'
      : /iPhone|iPad|iPod/.test(ua) ? 'iOS/iPadOS'
        : ua.includes('Mac OS X') ? 'macOS'
          : ua.includes('Linux') ? 'Linux'
            : 'Unknown OS'
  const deviceType = /Mobi|Android|iPhone|iPad|iPod/.test(ua) ? 'Mobile' : 'Desktop'
  return {
    label: `${deviceType} · ${browser} on ${os}`,
    browser,
    os,
    deviceType,
    userAgent: ua,
  }
}

function heartbeatRecentlySent() {
  try {
    const last = Number(window.localStorage.getItem(HEARTBEAT_STORAGE_KEY) || 0)
    return Date.now() - last < HEARTBEAT_THROTTLE_MS
  } catch {
    return false
  }
}

function markHeartbeatSent() {
  try {
    window.localStorage.setItem(HEARTBEAT_STORAGE_KEY, String(Date.now()))
  } catch {
    // Storage can be blocked in privacy mode; heartbeat still works.
  }
}

export async function heartbeatMerchantSession(options = {}) {
  const force = Boolean(options.force)

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: true, skipped: true, reason: 'offline' }
  }

  if (!force && heartbeatRecentlySent()) {
    return { ok: true, skipped: true, reason: 'throttled' }
  }

  const data = await invoke(
    'merchant-session',
    { action: 'heartbeat', device: detectDevice() },
    { retryAuth: true, retryTransient: true },
  )

  if (data?.ok) markHeartbeatSent()
  return data
}

export async function listMerchantSessions() {
  return invoke('merchant-session', { action: 'list' }, { retryAuth: true, retryTransient: true })
}

export async function revokeMerchantSession(sessionId) {
  return invoke('merchant-session', { action: 'revoke', sessionId }, { retryAuth: true, retryTransient: false })
}

export async function revokeAllMerchantSessions() {
  return invoke('merchant-session', { action: 'revoke_all' }, { retryAuth: true, retryTransient: false })
}

export async function getRecoveryStatus() {
  return invoke('merchant-mfa-recovery', { action: 'status' }, { retryAuth: true, retryTransient: true })
}

export async function generateRecoveryCodes() {
  return invoke('merchant-mfa-recovery', { action: 'generate' }, { retryAuth: true, retryTransient: false })
}

export async function recoverMfaWithCode(code) {
  return invoke('merchant-mfa-recovery', { action: 'recover', code }, { retryAuth: true, retryTransient: false })
}

export async function completeMfaRecovery() {
  return invoke('merchant-mfa-recovery', { action: 'complete_recovery' }, { retryAuth: true, retryTransient: false })
}
