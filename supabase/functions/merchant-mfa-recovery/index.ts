import { clientIp, corsHeaders, json, requireUser, safeError } from '../_shared/merchant-auth.ts'

const encoder = new TextEncoder()

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value.trim().toUpperCase()))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  const value = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
  return `${value.slice(0, 5)}-${value.slice(5)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { admin, user, claims } = await requireUser(req)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'status')
    const sessionId = String(claims.session_id || '')
    const aal = String(claims.aal || 'aal1')

    if (action === 'status') {
      const [{ count }, { data: profile }] = await Promise.all([
        admin.from('merchant_mfa_recovery_codes').select('id', { count: 'exact', head: true })
          .eq('merchant_id', user.id).is('used_at', null).is('invalidated_at', null),
        admin.from('profiles').select('mfa_recovery_required').eq('id', user.id).maybeSingle(),
      ])
      return json({ unusedCodes: count || 0, recoveryRequired: !!profile?.mfa_recovery_required, aal })
    }

    if (action === 'generate') {
      if (aal !== 'aal2') return json({ error: 'Verify your authenticator before generating recovery codes.' }, 403)
      const codes = Array.from({ length: 10 }, randomCode)
      const generationId = crypto.randomUUID()
      const rows = await Promise.all(codes.map(async (code) => ({
        merchant_id: user.id,
        code_hash: await sha256(code),
        code_hint: code.slice(-4),
        generation_id: generationId,
      })))
      await admin.from('merchant_mfa_recovery_codes').update({ invalidated_at: new Date().toISOString() })
        .eq('merchant_id', user.id).is('used_at', null).is('invalidated_at', null)
      const { error } = await admin.from('merchant_mfa_recovery_codes').insert(rows)
      if (error) throw error
      await admin.from('profiles').update({ mfa_recovery_required: false, updated_at: new Date().toISOString() }).eq('id', user.id)
      await admin.from('merchant_security_events').insert({
        merchant_id: user.id, event_type: 'recovery_codes_generated', auth_session_id: sessionId,
        ip_address: clientIp(req), user_agent: req.headers.get('user-agent'), details: { generation_id: generationId },
      })
      return json({ codes })
    }

    if (action === 'recover') {
      const rawCode = String(body.code || '').trim().toUpperCase()
      if (!/^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(rawCode)) return json({ error: 'Enter a valid recovery code.' }, 400)

      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { count: recentFailures } = await admin.from('merchant_security_events')
        .select('id', { count: 'exact', head: true }).eq('merchant_id', user.id)
        .eq('event_type', 'recovery_code_failed').gte('created_at', since)
      if ((recentFailures || 0) >= 5) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429)

      const hash = await sha256(rawCode)
      const { data: row } = await admin.from('merchant_mfa_recovery_codes')
        .select('id').eq('merchant_id', user.id).eq('code_hash', hash)
        .is('used_at', null).is('invalidated_at', null).maybeSingle()

      if (!row) {
        await admin.from('merchant_security_events').insert({
          merchant_id: user.id, event_type: 'recovery_code_failed', auth_session_id: sessionId,
          ip_address: clientIp(req), user_agent: req.headers.get('user-agent'),
        })
        return json({ error: 'Invalid or already used recovery code.' }, 400)
      }

      const now = new Date().toISOString()
      await admin.from('merchant_mfa_recovery_codes').update({ used_at: now, used_by_session_id: sessionId }).eq('id', row.id)

      const { data: factorData, error: factorError } = await admin.auth.admin.mfa.listFactors({ userId: user.id })
      if (factorError) throw factorError
      const factors = [
        ...(factorData?.factors || []),
        ...(factorData?.totp || []),
        ...(factorData?.phone || []),
      ]
      const unique = new Map<string, { id: string; status?: string }>()
      for (const factor of factors) if (factor?.id) unique.set(factor.id, factor)
      for (const factor of unique.values()) {
        if (factor.status === 'verified') {
          const { error } = await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: factor.id })
          if (error) throw error
        }
      }

      await admin.from('profiles').update({
        mfa_recovery_required: true,
        session_revoked_before: now,
        updated_at: now,
      }).eq('id', user.id)
      await admin.from('merchant_active_sessions').update({
        revoked_at: now, revoked_by: user.id, revocation_reason: 'Authenticator reset with recovery code', updated_at: now,
      }).eq('merchant_id', user.id).is('revoked_at', null)
      await admin.from('merchant_security_events').insert({
        merchant_id: user.id, event_type: 'mfa_recovered', auth_session_id: sessionId,
        ip_address: clientIp(req), user_agent: req.headers.get('user-agent'),
      })
      return json({ ok: true, signOutRequired: true, message: 'Authenticator reset. Sign in again and enroll a new authenticator.' })
    }

    if (action === 'complete_recovery') {
      if (aal !== 'aal2') return json({ error: 'A new authenticator must be verified first.' }, 403)
      await admin.from('profiles').update({ mfa_recovery_required: false, updated_at: new Date().toISOString() }).eq('id', user.id)
      return json({ ok: true })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (error) {
    if (error instanceof Response) return error
    return json({ error: safeError(error, 'Could not complete MFA recovery.') }, 500)
  }
})
