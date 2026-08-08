import { clientIp, corsHeaders, json, requireUser, safeError } from '../_shared/merchant-auth.ts'

function registryError(stage: string, error: unknown) {
  console.error(`[merchant-session] ${stage} failed:`, error)
  return json({
    error: 'Session registry is temporarily unavailable.',
    code: 'SESSION_REGISTRY_UNAVAILABLE',
    retryable: true,
    stage,
  }, 503)
}

function cleanDevice(body: Record<string, unknown>, req: Request) {
  const metadata = (body.device && typeof body.device === 'object')
    ? body.device as Record<string, unknown>
    : {}

  return {
    device_label: String(metadata.label || 'Unknown device').slice(0, 160),
    browser_name: String(metadata.browser || '').slice(0, 80) || null,
    os_name: String(metadata.os || '').slice(0, 80) || null,
    device_type: String(metadata.deviceType || '').slice(0, 40) || null,
    user_agent: String(req.headers.get('user-agent') || metadata.userAgent || '').slice(0, 500) || null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const { admin, user, token, claims } = await requireUser(req)
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'heartbeat')
    const sessionId = String(claims.session_id || '').trim()

    if (action === 'health') {
      const { error } = await admin
        .from('merchant_active_sessions')
        .select('id')
        .limit(1)

      if (error) return registryError('health', error)

      return json({
        ok: true,
        registry: 'available',
        sessionIdAvailable: Boolean(sessionId),
      })
    }

    if (action === 'heartbeat') {
      // Supabase access tokens normally include session_id. Older/custom tokens may
      // not. A missing session_id must not invalidate an otherwise valid login.
      if (!sessionId) {
        return json({
          ok: true,
          tracked: false,
          code: 'SESSION_ID_UNAVAILABLE',
        })
      }

      const now = new Date().toISOString()
      const expiresAt = claims.exp
        ? new Date(Number(claims.exp) * 1000).toISOString()
        : null

      const device = cleanDevice(body, req)

      // Do NOT use upsert(onConflict: merchant_id,auth_session_id) here.
      // Older BazarHQ migrations created a PARTIAL unique index for that pair,
      // which PostgreSQL cannot infer from a plain ON CONFLICT column list.
      // Read -> update/insert works against both old and repaired schemas.
      const { data: existingRows, error: existingError } = await admin
        .from('merchant_active_sessions')
        .select('id,revoked_at')
        .eq('merchant_id', user.id)
        .eq('auth_session_id', sessionId)
        .order('last_seen_at', { ascending: false })
        .limit(1)

      if (existingError) return registryError('heartbeat.lookup', existingError)

      const existing = Array.isArray(existingRows) ? existingRows[0] || null : null

      if (existing?.revoked_at) {
        return json({
          error: 'Session revoked.',
          code: 'SESSION_REVOKED',
          retryable: false,
          revoked: true,
        }, 403)
      }

      const row = {
        merchant_id: user.id,
        auth_session_id: sessionId,
        session_fingerprint: sessionId,
        ...device,
        ip_address: clientIp(req),
        access_expires_at: expiresAt,
        last_seen_at: now,
        updated_at: now,
      }

      if (existing?.id) {
        const { error: updateError } = await admin
          .from('merchant_active_sessions')
          .update(row)
          .eq('id', existing.id)
          .eq('merchant_id', user.id)

        if (updateError) return registryError('heartbeat.update', updateError)
      } else {
        const { error: insertError } = await admin
          .from('merchant_active_sessions')
          .insert(row)

        if (insertError) {
          // A concurrent heartbeat can win the insert race. Retry as an update
          // before reporting a registry failure.
          const { data: racedRows, error: raceReadError } = await admin
            .from('merchant_active_sessions')
            .select('id,revoked_at')
            .eq('merchant_id', user.id)
            .eq('auth_session_id', sessionId)
            .order('last_seen_at', { ascending: false })
            .limit(1)

          if (raceReadError) return registryError('heartbeat.race_lookup', raceReadError)

          const raced = Array.isArray(racedRows) ? racedRows[0] || null : null

          if (raced?.revoked_at) {
            return json({
              error: 'Session revoked.',
              code: 'SESSION_REVOKED',
              retryable: false,
              revoked: true,
            }, 403)
          }

          if (!raced?.id) return registryError('heartbeat.insert', insertError)

          const { error: raceUpdateError } = await admin
            .from('merchant_active_sessions')
            .update(row)
            .eq('id', raced.id)
            .eq('merchant_id', user.id)

          if (raceUpdateError) return registryError('heartbeat.race_update', raceUpdateError)
        }
      }

      return json({ ok: true, tracked: true, sessionId })
    }

    if (!sessionId) {
      return json({
        error: 'This login session cannot be managed until it is refreshed.',
        code: 'SESSION_ID_UNAVAILABLE',
        retryable: true,
      }, 409)
    }

    if (action === 'list') {
      const { data, error } = await admin
        .from('merchant_active_sessions')
        .select('id,auth_session_id,device_label,browser_name,os_name,device_type,ip_address,country_code,last_seen_at,created_at,access_expires_at,revoked_at,revocation_reason')
        .eq('merchant_id', user.id)
        .order('last_seen_at', { ascending: false })
        .limit(50)

      if (error) return registryError('list', error)

      return json({
        sessions: (data || []).map((row) => ({
          ...row,
          current: row.auth_session_id === sessionId,
        })),
      })
    }

    if (action === 'revoke') {
      const targetId = String(body.sessionId || '').trim()
      if (!targetId) {
        return json({
          error: 'Session ID is required.',
          code: 'SESSION_ID_REQUIRED',
        }, 400)
      }

      const { data: targetRows, error: readError } = await admin
        .from('merchant_active_sessions')
        .select('id,auth_session_id,revoked_at')
        .eq('id', targetId)
        .eq('merchant_id', user.id)
        .limit(1)

      if (readError) return registryError('revoke.lookup', readError)

      const target = Array.isArray(targetRows) ? targetRows[0] || null : null
      if (!target) {
        return json({
          error: 'Session not found.',
          code: 'SESSION_NOT_FOUND',
        }, 404)
      }

      const now = new Date().toISOString()
      const isCurrent = target.auth_session_id === sessionId

      if (!target.revoked_at) {
        const { error: revokeError } = await admin
          .from('merchant_active_sessions')
          .update({
            revoked_at: now,
            revoked_by: user.id,
            revocation_reason: isCurrent
              ? 'Current device signed out'
              : 'Revoked remotely by merchant',
            updated_at: now,
          })
          .eq('id', target.id)
          .eq('merchant_id', user.id)

        if (revokeError) return registryError('revoke.update', revokeError)
      }

      const { error: eventError } = await admin
        .from('merchant_security_events')
        .insert({
          merchant_id: user.id,
          event_type: 'session_revoked',
          auth_session_id: sessionId,
          ip_address: clientIp(req),
          user_agent: req.headers.get('user-agent'),
          details: {
            target_session_id: target.auth_session_id,
            revoked_current: isCurrent,
          },
        })

      if (eventError) {
        // Revocation itself succeeded. Audit logging is best-effort here.
        console.error('[merchant-session] revoke audit failed:', eventError)
      }

      return json({ ok: true, revokedCurrent: isCurrent })
    }

    if (action === 'revoke_all') {
      const now = new Date().toISOString()

      const { error: profileError } = await admin
        .from('profiles')
        .update({
          session_revoked_before: now,
          updated_at: now,
        })
        .eq('id', user.id)

      if (profileError) return registryError('revoke_all.profile', profileError)

      const { error: sessionsError } = await admin
        .from('merchant_active_sessions')
        .update({
          revoked_at: now,
          revoked_by: user.id,
          revocation_reason: 'All sessions revoked',
          updated_at: now,
        })
        .eq('merchant_id', user.id)
        .is('revoked_at', null)

      if (sessionsError) return registryError('revoke_all.sessions', sessionsError)

      const { error: eventError } = await admin
        .from('merchant_security_events')
        .insert({
          merchant_id: user.id,
          event_type: 'all_sessions_revoked',
          auth_session_id: sessionId,
          ip_address: clientIp(req),
          user_agent: req.headers.get('user-agent'),
          details: {},
        })

      if (eventError) {
        console.error('[merchant-session] revoke-all audit failed:', eventError)
      }

      try {
        await admin.auth.admin.signOut(token, 'global')
      } catch (error) {
        // Database revocation remains authoritative for merchant data access.
        console.error('[merchant-session] Supabase global sign-out failed:', error)
      }

      return json({ ok: true })
    }

    return json({
      error: 'Unknown action.',
      code: 'UNKNOWN_ACTION',
    }, 400)
  } catch (error) {
    if (error instanceof Response) return error

    console.error('[merchant-session] unexpected error:', error)

    return json({
      error: safeError(error, 'Could not manage merchant sessions.'),
      code: 'SESSION_SERVICE_ERROR',
      retryable: true,
    }, 500)
  }
})
