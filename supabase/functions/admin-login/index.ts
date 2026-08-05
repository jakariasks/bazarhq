import { handleCors, json, getClientIp } from '../_shared/cors.ts';
import { createAdminClient, createAnonClient } from '../_shared/supabaseAdmin.ts';
import { ipAllowed } from '../_shared/ip.ts';
import { randomToken, sha256, verifyTotp } from '../_shared/crypto.ts';

const MAX_FAILED = 3;
const LOCKOUT_MINUTES = 30;
const SESSION_HOURS = 8;
const IDLE_MINUTES = 30;

async function globalIpAllowed(supabase: any, ip: string) {
  const { data, error } = await supabase
    .from('admin_ip_allowlist')
    .select('ip_value')
    .eq('is_active', true);
  if (error || !Array.isArray(data) || data.length === 0) return true;
  return ipAllowed(ip, data.map((r: any) => r.ip_value));
}

async function createSession(supabase: any, admin: any, ip: string, userAgent: string) {
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  const idleExpiresAt = new Date(Date.now() + IDLE_MINUTES * 60 * 1000).toISOString();

  const { error } = await supabase.from('admin_sessions').insert({
    admin_id: admin.id,
    token_hash: tokenHash,
    ip_address: ip,
    user_agent: userAgent,
    expires_at: expiresAt,
    idle_expires_at: idleExpiresAt,
  });
  if (error) throw error;

  await supabase.from('admin_users').update({
    failed_attempts: 0,
    locked_until: null,
    last_login_at: new Date().toISOString(),
    last_login_ip: ip,
    updated_at: new Date().toISOString(),
  }).eq('id', admin.id);

  await supabase.rpc('write_admin_audit', {
    p_admin_id: admin.id,
    p_admin_email: admin.email,
    p_action: 'login.success',
    p_target_type: 'admin_user',
    p_target_id: admin.id,
    p_details: { ip },
    p_ip_address: ip,
    p_user_agent: userAgent,
  }).then(() => null);

  return { token, expires_at: expiresAt, idle_expires_at: idleExpiresAt };
}

async function queueFailedLoginAlert(supabase: any, admin: any, ip: string, reason: string) {
  await supabase.rpc('queue_admin_alert', {
    p_subject: 'BazarHQ Super Admin failed login alert',
    p_body: `Failed super admin login for ${admin?.email || 'unknown'} from ${ip}. Reason: ${reason}`,
    p_kind: 'failed_login',
  }).then(() => null);
}

async function failAttempt(supabase: any, admin: any, ip: string, userAgent: string, reason: string) {
  const count = Number(admin.failed_attempts || 0) + 1;
  const update: Record<string, unknown> = { failed_attempts: count, updated_at: new Date().toISOString() };
  let locked = false;
  if (count >= MAX_FAILED) {
    update.failed_attempts = 0;
    update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
    locked = true;
  }

  await supabase.from('admin_users').update(update).eq('id', admin.id);
  await supabase.rpc('write_admin_audit', {
    p_admin_id: admin.id,
    p_admin_email: admin.email,
    p_action: 'login.failed',
    p_target_type: 'admin_user',
    p_target_id: admin.id,
    p_details: { reason, ip, locked },
    p_ip_address: ip,
    p_user_agent: userAgent,
  }).then(() => null);

  await queueFailedLoginAlert(supabase, admin, ip, locked ? 'account_locked' : reason);
}

async function verifyRecoveryCode(supabase: any, admin: any, code: string) {
  const clean = String(code || '').trim().replace(/\s+/g, '').toUpperCase();
  if (!clean) return false;
  const codeHash = await sha256(clean);
  const hashes = Array.isArray(admin.totp_recovery_hashes) ? admin.totp_recovery_hashes : [];
  if (!hashes.includes(codeHash)) return false;
  const next = hashes.filter((h: string) => h !== codeHash);
  await supabase.from('admin_users').update({ totp_recovery_hashes: next, updated_at: new Date().toISOString() }).eq('id', admin.id);
  return true;
}

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors;
  try {
    const supabase = createAdminClient();
    const anon = createAnonClient();
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const captchaToken = String(body.captchaToken || '');
    const totpCode = String(body.totpCode || '');
    const recoveryCode = String(body.recoveryCode || '');
    const challengeToken = String(body.challengeToken || '');
    const ip = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || '';

    if (!await globalIpAllowed(supabase, ip)) {
      await supabase.rpc('queue_admin_alert', {
        p_subject: 'BazarHQ blocked Super Admin IP',
        p_body: `Blocked super admin request from ${ip}.`,
        p_kind: 'failed_login',
      }).then(() => null);
      return json({ error: 'This IP address is not allowed for superadmin access.' }, 403);
    }

    if (challengeToken) {
      const tokenHash = await sha256(challengeToken);
      const { data: challenge } = await supabase
        .from('admin_login_challenges')
        .select('*, admin_users(*)')
        .eq('challenge_token_hash', tokenHash)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!challenge?.admin_users) return json({ error: '2FA challenge expired. Sign in again.' }, 401);
      const admin = challenge.admin_users;
      if (!ipAllowed(ip, admin.allowed_ips)) return json({ error: 'This IP address is not allowed for this admin.' }, 403);

      const ok = recoveryCode
        ? await verifyRecoveryCode(supabase, admin, recoveryCode)
        : await verifyTotp(totpCode, admin.totp_secret || '');
      if (!ok) {
        await failAttempt(supabase, admin, ip, userAgent, recoveryCode ? 'bad_recovery_code' : 'bad_totp');
        return json({ error: 'Invalid 2FA or recovery code.' }, 401);
      }

      await supabase.from('admin_login_challenges').update({ used_at: new Date().toISOString() }).eq('id', challenge.id);
      const session = await createSession(supabase, admin, ip, userAgent);
      return json({ ok: true, admin: { id: admin.id, email: admin.email, role: admin.role }, session });
    }

    if (!email || !password) return json({ error: 'Email and password are required.' }, 400);

    const { data: admin } = await supabase
      .from('admin_users')
      .select('id, email, role, is_active, totp_enabled, totp_secret, totp_recovery_hashes, failed_attempts, locked_until, allowed_ips')
      .ilike('email', email)
      .maybeSingle();

    if (!admin || admin.is_active === false) return json({ error: 'Invalid admin email or password.' }, 401);
    if (admin.locked_until && new Date(admin.locked_until) > new Date()) return json({ error: 'Admin account is temporarily locked.' }, 423);
    if (!ipAllowed(ip, admin.allowed_ips)) {
      await failAttempt(supabase, admin, ip, userAgent, 'admin_ip_not_allowed');
      return json({ error: 'This IP address is not allowed for this admin.' }, 403);
    }

    const credentials: any = { email, password };
    if (captchaToken) credentials.options = { captchaToken };
    const { error: authError } = await anon.auth.signInWithPassword(credentials);
    await anon.auth.signOut().catch(() => null);

    if (authError) {
      const msg = String(authError.message || '').toLowerCase();
      if (msg.includes('captcha') || msg.includes('invalid-input-response') || msg.includes('request disallowed')) {
        return json({ error: 'Security check failed. Complete hCaptcha and try again.' }, 400);
      }
      await failAttempt(supabase, admin, ip, userAgent, 'bad_password');
      return json({ error: 'Invalid admin email or password.' }, 401);
    }

    if (admin.totp_enabled) {
      if (!admin.totp_secret) return json({ error: '2FA is enabled but no TOTP secret is configured.' }, 500);
      const nextChallenge = randomToken(24);
      await supabase.from('admin_login_challenges').insert({
        admin_id: admin.id,
        challenge_token_hash: await sha256(nextChallenge),
        ip_address: ip,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      return json({ ok: true, requiresTOTP: true, challengeToken: nextChallenge });
    }

    const session = await createSession(supabase, admin, ip, userAgent);
    return json({ ok: true, admin: { id: admin.id, email: admin.email, role: admin.role }, session });
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
});
