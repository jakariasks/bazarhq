import { clientIp, corsHeaders, json, requireUser, safeError } from '../_shared/merchant-auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { admin, user, token, claims } = await requireUser(req)
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const action = String(body.action || 'heartbeat')
    const sessionId = String(claims.session_id || '')
    if (!sessionId) return json({ error: 'The current Supabase session has no session_id claim.' }, 400)

    if (action === 'heartbeat') {
      const metadata = body.device || {}
      const expiresAt = claims.exp ? new Date(Number(claims.exp) * 1000).toISOString() : null
      const row = {
        merchant_id: user.id,
        auth_session_id: sessionId,
        session_fingerprint: sessionId,
        device_label: String(metadata.label || 'Unknown device').slice(0, 160),
        browser_name: String(metadata.browser || '').slice(0, 80) || null,
        os_name: String(metadata.os || '').slice(0, 80) || null,
        device_type: String(metadata.deviceType || '').slice(0, 40) || null,
        user_agent: String(req.headers.get('user-agent') || metadata.userAgent || '').slice(0, 500) || null,
        ip_address: clientIp(req),
        access_expires_at: expiresAt,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      const { data: existing } = await admin.from('merchant_active_sessions')
        .select('revoked_at').eq('merchant_id', user.id).eq('auth_session_id', sessionId).maybeSingle()
      if (existing?.revoked_at) return json({ revoked: true }, 401)
      const { error } = await admin.from('merchant_active_sessions').upsert(row, { onConflict: 'merchant_id,auth_session_id' })
      if (error) throw error
      return json({ ok: true, sessionId })
    }

    if (action === 'list') {
      const { data, error } = await admin.from('merchant_active_sessions')
        .select('id,auth_session_id,device_label,browser_name,os_name,device_type,ip_address,country_code,last_seen_at,created_at,access_expires_at,revoked_at,revocation_reason')
        .eq('merchant_id', user.id).order('last_seen_at', { ascending: false }).limit(50)
      if (error) throw error
      return json({ sessions: (data || []).map((row) => ({ ...row, current: row.auth_session_id === sessionId })) })
    }

    if (action === 'revoke') {
      const targetId = String(body.sessionId || '')
      if (!targetId) return json({ error: 'Session ID is required.' }, 400)
      const { data: target, error: readError } = await admin.from('merchant_active_sessions')
        .select('id,auth_session_id').eq('id', targetId).eq('merchant_id', user.id).maybeSingle()
      if (readError) throw readError
      if (!target) return json({ error: 'Session not found.' }, 404)
      const now = new Date().toISOString()
      const { error } = await admin.from('merchant_active_sessions').update({
        revoked_at: now,
        revoked_by: user.id,
        revocation_reason: target.auth_session_id === sessionId ? 'Current device signed out' : 'Revoked remotely by merchant',
        updated_at: now,
      }).eq('id', target.id)
      if (error) throw error
      await admin.from('merchant_security_events').insert({
        merchant_id: user.id,
        event_type: 'session_revoked',
        auth_session_id: sessionId,
        ip_address: clientIp(req),
        user_agent: req.headers.get('user-agent'),
        details: { target_session_id: target.auth_session_id },
      })
      // The restrictive database policy blocks the revoked session immediately.
      return json({ ok: true, revokedCurrent: target.auth_session_id === sessionId })
    }

    if (action === 'revoke_all') {
      const now = new Date().toISOString()
      await admin.from('profiles').update({ session_revoked_before: now, updated_at: now }).eq('id', user.id)
      await admin.from('merchant_active_sessions').update({
        revoked_at: now, revoked_by: user.id, revocation_reason: 'All sessions revoked', updated_at: now,
      }).eq('merchant_id', user.id).is('revoked_at', null)
      await admin.from('merchant_security_events').insert({
        merchant_id: user.id, event_type: 'all_sessions_revoked', auth_session_id: sessionId,
        ip_address: clientIp(req), user_agent: req.headers.get('user-agent'),
      })
      try {
        await admin.auth.admin.signOut(token, 'global')
      } catch {
        // Database epoch and restrictive RLS still terminate access immediately.
      }
      return json({ ok: true })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (error) {
    if (error instanceof Response) return error
    return json({ error: safeError(error, 'Could not manage merchant sessions.') }, 500)
  }
})
