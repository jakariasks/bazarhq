import { supabase } from '@/integrations/supabase/client'

function invoke(name, body) {
  return supabase.functions.invoke(name, { body }).then(({ data, error }) => {
    if (error) throw new Error(data?.error || error.message || 'Request failed.')
    if (data?.error) throw new Error(data.error)
    return data
  })
}

export function detectDevice() {
  const ua = navigator.userAgent || ''
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

export async function heartbeatMerchantSession() {
  return invoke('merchant-session', { action: 'heartbeat', device: detectDevice() })
}

export async function listMerchantSessions() {
  return invoke('merchant-session', { action: 'list' })
}

export async function revokeMerchantSession(sessionId) {
  return invoke('merchant-session', { action: 'revoke', sessionId })
}

export async function revokeAllMerchantSessions() {
  return invoke('merchant-session', { action: 'revoke_all' })
}

export async function getRecoveryStatus() {
  return invoke('merchant-mfa-recovery', { action: 'status' })
}

export async function generateRecoveryCodes() {
  return invoke('merchant-mfa-recovery', { action: 'generate' })
}

export async function recoverMfaWithCode(code) {
  return invoke('merchant-mfa-recovery', { action: 'recover', code })
}

export async function completeMfaRecovery() {
  return invoke('merchant-mfa-recovery', { action: 'complete_recovery' })
}
