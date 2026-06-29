const ADMIN_SESSION_KEY = 'bazarhq_admin_server_session'

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

export async function callAdminFunction(name, body = {}, options = {}) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`
  const session = getStoredAdminSession()

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      ...(session?.token ? { 'x-admin-session': session.token } : {}),
      ...(options.headers || {}),
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || data.message || `Function ${name} failed`)
  return data
}
