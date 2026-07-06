import { supabase } from '@/integrations/supabase/client'

function fingerprint() {
  const key = 'bazarhq_merchant_session_fingerprint'
  let value = localStorage.getItem(key)
  if (!value) {
    value = `${Date.now().toString(36)}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`
    localStorage.setItem(key, value)
  }
  return value
}

export async function trackMerchantSession(user) {
  if (!user?.id) return null
  const sessionFingerprint = fingerprint()
  const deviceLabel = `${navigator.platform || 'Device'} · ${navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Browser'}`

  const { data, error } = await supabase
    .from('merchant_active_sessions')
    .upsert({
      merchant_id: user.id,
      session_fingerprint: sessionFingerprint,
      device_label: deviceLabel,
      user_agent: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    }, { onConflict: 'merchant_id,session_fingerprint' })
    .select('*')
    .single()

  if (error) console.warn('Session tracking failed:', error.message)
  return data
}

export async function listMerchantSessions(userId) {
  const { data, error } = await supabase
    .from('merchant_active_sessions')
    .select('*')
    .eq('merchant_id', userId)
    .order('last_seen_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data || []
}

export async function revokeTrackedSession(sessionId) {
  const { error } = await supabase
    .from('merchant_active_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw error
}

export async function sha256(text) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const a = Math.random().toString(36).slice(2, 6).toUpperCase()
    const b = Math.random().toString(36).slice(2, 6).toUpperCase()
    return `${a}-${b}`
  })
}

export async function saveRecoveryCodes(userId, codes) {
  const rows = await Promise.all(codes.map(async (code) => ({
    merchant_id: userId,
    code_hash: await sha256(code),
  })))
  await supabase.from('merchant_mfa_recovery_codes').delete().eq('merchant_id', userId).is('used_at', null)
  const { error } = await supabase.from('merchant_mfa_recovery_codes').insert(rows)
  if (error) throw error
}
