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
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase URL or anon key is missing in environment variables.')
  }

  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${name}`
  const session = getStoredAdminSession()

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        ...(session?.token ? { 'x-admin-session': session.token } : {}),
        ...(options.headers || {}),
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw new Error(
      `Could not reach Supabase Edge Function "${name}". Deploy it and disable JWT verification/CORS preflight blocking. Original error: ${error?.message || error}`
    )
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || data.message || `Function ${name} failed`)
  return data
}
