const ADMIN_SESSION_KEY = 'bazarhq_admin_server_session'
const DEFAULT_TIMEOUT_MS = 12_000

export class AdminFunctionError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'AdminFunctionError'
    this.status = Number(options.status || 0)
    this.code = options.code || 'ADMIN_REQUEST_FAILED'
    this.retryable = Boolean(options.retryable)
    this.networkError = Boolean(options.networkError)
    this.cause = options.cause
  }
}

export function getStoredAdminSession() {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveAdminSession(payload) {
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(payload))
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY)
}

export function isStoredAdminSessionExpired(session = getStoredAdminSession()) {
  if (!session?.token) return true

  const now = Date.now()
  const absoluteExpiry = Date.parse(session.expires_at || '')
  const idleExpiry = Date.parse(session.idle_expires_at || '')

  if (Number.isFinite(absoluteExpiry) && absoluteExpiry <= now) return true
  if (Number.isFinite(idleExpiry) && idleExpiry <= now) return true
  return false
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

async function requestOnce(name, body, options) {
  const baseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!baseUrl || !anonKey) {
    throw new AdminFunctionError('Supabase configuration is missing.', {
      code: 'ADMIN_CONFIG_MISSING',
      retryable: false,
    })
  }

  const url = `${baseUrl}/functions/v1/${name}`
  const session = getStoredAdminSession()

  let response
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        ...(session?.token ? { 'x-admin-session': session.token } : {}),
        ...(options.headers || {}),
      },
      body: JSON.stringify(body),
    }, options.timeoutMs)
  } catch (error) {
    const timedOut = error?.name === 'AbortError'
    throw new AdminFunctionError(
      timedOut
        ? 'Admin service request timed out. Check your connection and try again.'
        : 'Could not reach the Admin service. Check your connection and Supabase Edge Functions.',
      {
        code: timedOut ? 'ADMIN_REQUEST_TIMEOUT' : 'ADMIN_NETWORK_ERROR',
        retryable: true,
        networkError: true,
        cause: error,
      },
    )
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new AdminFunctionError(
      data.error || data.message || `Function ${name} failed`,
      {
        status: response.status,
        code: data.code || (
          response.status === 401 ? 'ADMIN_SESSION_INVALID'
            : response.status === 403 ? 'ADMIN_FORBIDDEN'
              : response.status === 429 ? 'ADMIN_RATE_LIMITED'
                : response.status >= 500 ? 'ADMIN_SERVICE_UNAVAILABLE'
                  : 'ADMIN_REQUEST_FAILED'
        ),
        retryable: data.retryable === true || response.status === 429 || response.status >= 500,
      },
    )
  }

  return data
}

export async function callAdminFunction(name, body = {}, options = {}) {
  const config = {
    headers: options.headers || {},
    timeoutMs: Number(options.timeoutMs || DEFAULT_TIMEOUT_MS),
    retries: Math.max(0, Number(options.retries || 0)),
  }

  let lastError
  for (let attempt = 0; attempt <= config.retries; attempt += 1) {
    try {
      return await requestOnce(name, body, config)
    } catch (error) {
      lastError = error
      const mayRetry = error?.retryable && attempt < config.retries
      if (!mayRetry) throw error
      await sleep(450 * (attempt + 1))
    }
  }

  throw lastError
}
