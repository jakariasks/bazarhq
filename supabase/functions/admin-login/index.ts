import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCors, json, getClientIp } from '../_shared/cors.ts'
import { ipAllowed } from '../_shared/ip.ts'
import { randomToken, sha256, verifyTotp } from '../_shared/crypto.ts'

const MAX_FAILED = 3
const LOCKOUT_MINUTES = 30
const SESSION_HOURS = 8
const IDLE_MINUTES = 30

function makeClients() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return {
      error: json({
        error: 'Super Admin service configuration is incomplete.',
        code: 'ADMIN_SERVER_CONFIG_MISSING',
        stage: 'environment',
      }, 500),
    }
  }

  const options = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }

  return {
    admin: createClient(supabaseUrl, serviceRoleKey, options),
    anon: createClient(supabaseUrl, anonKey, options),
  }
}

async function loadGlobalIpAllowlist(supabase: any) {
  const { data, error } = await supabase
    .from('admin_ip_allowlist')
    .select('ip_value')
    .eq('is_active', true)

  if (error) {
    // The global allowlist is an additional control. Older/staged databases may
    // not have the canonical table yet. Do not lock every Super Admin out
    // because that optional table is unavailable; fall back to the per-admin
    // allowed_ips list stored on admin_users.
    console.error('admin_ip_allowlist lookup failed; using per-admin IP policy:', error)
    return {
      available: false,
      values: [] as string[],
    }
  }

  return {
    available: true,
    values: Array.isArray(data)
      ? data.map((row: any) => String(row?.ip_value || '').trim()).filter(Boolean)
      : [],
  }
}

function normalizedIpValues(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function passesAdminIpPolicy(
  ip: string,
  globalAllowlist: { available: boolean; values: string[] },
  adminAllowedIps: unknown,
) {
  const globalValues = globalAllowlist.available
    ? normalizedIpValues(globalAllowlist.values)
    : []
  const adminValues = normalizedIpValues(adminAllowedIps)

  const hasGlobalPolicy = globalValues.length > 0
  const hasAdminPolicy = adminValues.length > 0

  // No configured restriction means IP filtering is disabled.
  if (!hasGlobalPolicy && !hasAdminPolicy) return true

  // Canonical BazarHQ behavior: when either policy is configured, the request
  // may match the global allowlist OR this specific admin's allowlist.
  return (
    (hasGlobalPolicy && ipAllowed(ip, globalValues))
    || (hasAdminPolicy && ipAllowed(ip, adminValues))
  )
}

function normalizeAdminRecord(row: any) {
  if (!row || typeof row !== 'object') return null

  return {
    ...row,
    role: String(row.role || 'full_access'),
    is_active: row.is_active !== false,
    allowed_ips: normalizedIpValues(row.allowed_ips),
    totp_enabled: row.totp_enabled === true,
    totp_secret: row.totp_secret || null,
    totp_recovery_hashes: Array.isArray(row.totp_recovery_hashes)
      ? row.totp_recovery_hashes
      : [],
    failed_attempts: Number(row.failed_attempts || 0),
    locked_until: row.locked_until || null,
  }
}

async function bestEffortAudit(
  supabase: any,
  admin: any,
  action: string,
  ip: string,
  userAgent: string,
  details: Record<string, unknown> = {},
) {
  try {
    const { error } = await supabase.rpc('write_admin_audit', {
      p_admin_id: admin?.id || null,
      p_admin_email: admin?.email || null,
      p_action: action,
      p_target_type: 'admin_user',
      p_target_id: admin?.id || null,
      p_details: details,
      p_ip_address: ip,
      p_user_agent: userAgent,
    })

    if (error) console.error('Admin audit write failed:', error)
  } catch (error) {
    console.error('Admin audit exception:', error)
  }
}

async function bestEffortFailedLoginAlert(
  supabase: any,
  admin: any,
  ip: string,
  reason: string,
) {
  try {
    const { error } = await supabase.rpc('queue_admin_alert', {
      p_subject: 'BazarHQ Super Admin failed login alert',
      p_body: `Failed super admin login for ${admin?.email || 'unknown'} from ${ip}. Reason: ${reason}`,
      p_kind: 'failed_login',
    })

    if (error) console.error('Admin failed-login alert queue failed:', error)
  } catch (error) {
    console.error('Admin failed-login alert exception:', error)
  }
}

async function registerFailedAttempt(
  supabase: any,
  admin: any,
  ip: string,
  userAgent: string,
  reason: string,
) {
  const nextCount = Number(admin?.failed_attempts || 0) + 1
  const update: Record<string, unknown> = {
    failed_attempts: nextCount,
    updated_at: new Date().toISOString(),
  }

  let locked = false

  if (nextCount >= MAX_FAILED) {
    update.failed_attempts = 0
    update.locked_until = new Date(
      Date.now() + LOCKOUT_MINUTES * 60 * 1000,
    ).toISOString()
    locked = true
  }

  try {
    const { error } = await supabase
      .from('admin_users')
      .update(update)
      .eq('id', admin.id)

    if (error) console.error('Failed-attempt update failed:', error)
  } catch (error) {
    console.error('Failed-attempt update exception:', error)
  }

  await bestEffortAudit(
    supabase,
    admin,
    'login.failed',
    ip,
    userAgent,
    { reason, locked },
  )

  await bestEffortFailedLoginAlert(
    supabase,
    admin,
    ip,
    locked ? 'account_locked' : reason,
  )

  return { locked }
}

async function createAdminSession(
  supabase: any,
  admin: any,
  ip: string,
  userAgent: string,
) {
  const token = randomToken(32)
  const tokenHash = await sha256(token)
  const now = Date.now()
  const expiresAt = new Date(
    now + SESSION_HOURS * 60 * 60 * 1000,
  ).toISOString()
  const idleExpiresAt = new Date(
    now + IDLE_MINUTES * 60 * 1000,
  ).toISOString()

  const { error: insertError } = await supabase
    .from('admin_sessions')
    .insert({
      admin_id: admin.id,
      token_hash: tokenHash,
      ip_address: ip,
      user_agent: userAgent,
      expires_at: expiresAt,
      idle_expires_at: idleExpiresAt,
    })

  if (insertError) {
    console.error('Admin session insert failed:', insertError)
    return {
      error: json({
        error: 'Admin credentials were accepted, but the secure session could not be created.',
        code: 'ADMIN_SESSION_CREATE_FAILED',
        stage: 'session_insert',
      }, 503),
    }
  }

  try {
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({
        failed_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
        last_login_ip: ip,
        updated_at: new Date().toISOString(),
      })
      .eq('id', admin.id)

    if (updateError) console.error('Admin last-login update failed:', updateError)
  } catch (error) {
    console.error('Admin last-login update exception:', error)
  }

  await bestEffortAudit(
    supabase,
    admin,
    'login.success',
    ip,
    userAgent,
    { ip },
  )

  return {
    session: {
      token,
      expires_at: expiresAt,
      idle_expires_at: idleExpiresAt,
    },
  }
}

async function consumeRecoveryCode(
  supabase: any,
  admin: any,
  rawCode: string,
) {
  const clean = String(rawCode || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()

  if (!clean) return false

  const codeHash = await sha256(clean)
  const hashes = Array.isArray(admin?.totp_recovery_hashes)
    ? admin.totp_recovery_hashes
    : []

  if (!hashes.includes(codeHash)) return false

  const nextHashes = hashes.filter((hash: string) => hash !== codeHash)

  const { error } = await supabase
    .from('admin_users')
    .update({
      totp_recovery_hashes: nextHashes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', admin.id)

  if (error) {
    console.error('Recovery-code consumption failed:', error)
    return false
  }

  return true
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return json({
      error: 'Method not allowed.',
      code: 'METHOD_NOT_ALLOWED',
    }, 405)
  }

  let stage = 'start'

  try {
    stage = 'environment'
    const clients = makeClients()
    if ('error' in clients) return clients.error

    const adminClient = clients.admin!
    const anonClient = clients.anon!

    stage = 'request_body'
    const body = await req.json().catch(() => ({}))

    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const totpCode = String(body.totpCode || '')
    const recoveryCode = String(body.recoveryCode || '')
    const challengeToken = String(body.challengeToken || '')

    const ip = getClientIp(req)
    const userAgent = req.headers.get('user-agent') || ''

    stage = 'global_ip_allowlist'
    const globalIpAllowlist = await loadGlobalIpAllowlist(adminClient)

    // -----------------------------------------------------------------------
    // TOTP/recovery challenge completion
    // -----------------------------------------------------------------------
    if (challengeToken) {
      stage = 'challenge_hash'
      const challengeHash = await sha256(challengeToken)

      stage = 'challenge_lookup'
      const { data: challenge, error: challengeError } = await adminClient
        .from('admin_login_challenges')
        .select('id, admin_id, used_at, expires_at')
        .eq('challenge_token_hash', challengeHash)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (challengeError) {
        console.error('Admin challenge lookup failed:', challengeError)
        return json({
          error: '2FA challenge could not be verified.',
          code: 'ADMIN_CHALLENGE_LOOKUP_FAILED',
          stage: 'challenge_lookup',
        }, 503)
      }

      if (!challenge?.admin_id) {
        return json({
          error: '2FA challenge expired. Sign in again.',
          code: 'ADMIN_CHALLENGE_EXPIRED',
        }, 401)
      }

      stage = 'challenge_admin_lookup'
      const { data: challengeAdminRows, error: challengeAdminError } =
        await adminClient
          .from('admin_users')
          .select('*')
          .eq('id', challenge.admin_id)
          .limit(1)

      const challengeAdminRow = Array.isArray(challengeAdminRows)
        ? challengeAdminRows[0] || null
        : null

      if (challengeAdminError) {
        console.error('Admin challenge user lookup failed:', challengeAdminError)
        return json({
          error: 'Admin account could not be loaded for 2FA.',
          code: 'ADMIN_CHALLENGE_USER_LOOKUP_FAILED',
          stage: 'challenge_admin_lookup',
        }, 503)
      }

      const challengeAdmin = normalizeAdminRecord(challengeAdminRow)

      if (!challengeAdmin || challengeAdmin.is_active === false) {
        return json({
          error: 'Admin account is unavailable.',
          code: 'ADMIN_ACCOUNT_UNAVAILABLE',
        }, 401)
      }

      if (!passesAdminIpPolicy(ip, globalIpAllowlist, challengeAdmin.allowed_ips)) {
        await bestEffortFailedLoginAlert(
          adminClient,
          challengeAdmin,
          ip,
          'admin_ip_not_allowed',
        )

        return json({
          error: 'This IP address is not allowed for this admin.',
          code: 'ADMIN_IP_NOT_ALLOWED',
        }, 403)
      }

      stage = 'totp_verify'
      const secondFactorValid = recoveryCode
        ? await consumeRecoveryCode(
            adminClient,
            challengeAdmin,
            recoveryCode,
          )
        : await verifyTotp(
            totpCode,
            challengeAdmin.totp_secret || '',
          )

      if (!secondFactorValid) {
        await registerFailedAttempt(
          adminClient,
          challengeAdmin,
          ip,
          userAgent,
          recoveryCode ? 'bad_recovery_code' : 'bad_totp',
        )

        return json({
          error: 'Invalid 2FA or recovery code.',
          code: 'ADMIN_2FA_INVALID',
        }, 401)
      }

      stage = 'challenge_consume'
      const { error: consumeError } = await adminClient
        .from('admin_login_challenges')
        .update({ used_at: new Date().toISOString() })
        .eq('id', challenge.id)

      if (consumeError) {
        console.error('Admin challenge consume failed:', consumeError)
        return json({
          error: '2FA was verified, but the challenge could not be completed.',
          code: 'ADMIN_CHALLENGE_CONSUME_FAILED',
          stage: 'challenge_consume',
        }, 503)
      }

      stage = 'session_create_after_2fa'
      const created = await createAdminSession(
        adminClient,
        challengeAdmin,
        ip,
        userAgent,
      )

      if (created.error) return created.error

      return json({
        ok: true,
        admin: {
          id: challengeAdmin.id,
          email: challengeAdmin.email,
          role: challengeAdmin.role,
        },
        session: created.session,
      })
    }

    // -----------------------------------------------------------------------
    // Email/password authentication
    // -----------------------------------------------------------------------
    if (!email || !password) {
      return json({
        error: 'Email and password are required.',
        code: 'ADMIN_CREDENTIALS_REQUIRED',
      }, 400)
    }

    stage = 'admin_user_lookup'
    const { data: adminRows, error: adminError } = await adminClient
      .from('admin_users')
      .select('*')
      .ilike('email', email)
      .order('created_at', { ascending: true, nullsFirst: true })
      .limit(1)

    const adminRow = Array.isArray(adminRows)
      ? adminRows[0] || null
      : null

    if (adminError) {
      console.error('Admin user lookup failed:', adminError)
      return json({
        error: 'Super Admin account lookup failed. Check the current admin database migration.',
        code: 'ADMIN_USER_LOOKUP_FAILED',
        stage: 'admin_user_lookup',
      }, 503)
    }

    const admin = normalizeAdminRecord(adminRow)

    if (!admin) {
      return json({
        error: 'Super Admin record is missing. Run the Super Admin core repair SQL once.',
        code: 'ADMIN_RECORD_MISSING',
        stage: 'admin_user_lookup',
      }, 503)
    }

    if (admin.is_active === false) {
      return json({
        error: 'This Super Admin account is disabled.',
        code: 'ADMIN_ACCOUNT_DISABLED',
      }, 403)
    }

    if (
      admin.locked_until
      && new Date(admin.locked_until) > new Date()
    ) {
      return json({
        error: 'Admin account is temporarily locked.',
        code: 'ADMIN_ACCOUNT_LOCKED',
      }, 423)
    }

    if (!passesAdminIpPolicy(ip, globalIpAllowlist, admin.allowed_ips)) {
      await registerFailedAttempt(
        adminClient,
        admin,
        ip,
        userAgent,
        'admin_ip_not_allowed',
      )

      return json({
        error: 'This IP address is not allowed for this admin.',
        code: 'ADMIN_IP_NOT_ALLOWED',
      }, 403)
    }

    // hCaptcha intentionally removed.
    stage = 'password_auth'
    const { error: authError } = await anonClient.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      await registerFailedAttempt(
        adminClient,
        admin,
        ip,
        userAgent,
        'bad_password',
      )

      return json({
        error: 'Invalid admin email or password.',
        code: 'ADMIN_CREDENTIALS_INVALID',
      }, 401)
    }

    // No signOut() call is required: this server-side anon client has
    // persistSession=false and is discarded when the request completes.

    if (admin.totp_enabled) {
      if (!admin.totp_secret) {
        console.error('Admin TOTP enabled but secret is missing.')
        return json({
          error: '2FA is enabled but the admin TOTP configuration is incomplete.',
          code: 'ADMIN_TOTP_CONFIG_INVALID',
          stage: 'totp_configuration',
        }, 500)
      }

      stage = 'challenge_create'
      const nextChallenge = randomToken(24)
      const challengeHash = await sha256(nextChallenge)

      const { error: challengeCreateError } = await adminClient
        .from('admin_login_challenges')
        .insert({
          admin_id: admin.id,
          challenge_token_hash: challengeHash,
          ip_address: ip,
          user_agent: userAgent,
          expires_at: new Date(
            Date.now() + 5 * 60 * 1000,
          ).toISOString(),
        })

      if (challengeCreateError) {
        console.error(
          'Admin login challenge creation failed:',
          challengeCreateError,
        )

        return json({
          error: 'Password was accepted, but the 2FA challenge could not be created.',
          code: 'ADMIN_CHALLENGE_CREATE_FAILED',
          stage: 'challenge_create',
        }, 503)
      }

      return json({
        ok: true,
        requiresTOTP: true,
        challengeToken: nextChallenge,
      })
    }

    stage = 'session_create'
    const created = await createAdminSession(
      adminClient,
      admin,
      ip,
      userAgent,
    )

    if (created.error) return created.error

    return json({
      ok: true,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
      session: created.session,
    })
  } catch (error) {
    console.error(`admin-login unexpected failure at stage=${stage}:`, error)

    return json({
      error: `Admin login failed during ${stage}.`,
      code: 'ADMIN_LOGIN_UNEXPECTED',
      stage,
    }, 500)
  }
})
