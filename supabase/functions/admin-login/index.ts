import { handleCors, json, getClientIp } from '../_shared/cors.ts';
import { createAdminClient, createAnonClient } from '../_shared/supabaseAdmin.ts';
import { ipAllowed } from '../_shared/ip.ts';
import { randomToken, sha256, verifyTotp } from '../_shared/crypto.ts';

const MAX_FAILED = 3;
const LOCKOUT_MINUTES = 30;
const SESSION_HOURS = 8;

async function createSession(supabase: any, admin: any, ip: string, userAgent: string) {
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  const idleExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

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
  }).eq('id', admin.id);

  await supabase.from('admin_audit_log').insert({
    admin_id: admin.id,
    admin_email: admin.email,
    action: 'login.success',
    details: { ip },
    ip_address: ip,
  }).then(() => null);

  return { token, expires_at: expiresAt, idle_expires_at: idleExpiresAt };
}

async function failAttempt(supabase: any, admin: any, ip: string, reason: string) {
  const count = Number(admin.failed_attempts || 0) + 1;
  const update: Record<string, unknown> = { failed_attempts: count };
  if (count >= MAX_FAILED) {
    update.failed_attempts = 0;
    update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
  }
  await supabase.from('admin_users').update(update).eq('id', admin.id);
  await supabase.from('admin_audit_log').insert({
    admin_id: admin.id,
    admin_email: admin.email,
    action: 'login.failed',
    details: { reason, ip },
    ip_address: ip,
  }).then(() => null);
  if (update.locked_until) {
    await supabase.from('email_notification_queue').insert({
      recipient_email: admin.email,
      subject: 'BazarHQ admin account locked',
      body: `Your admin account was locked for ${LOCKOUT_MINUTES} minutes after repeated failed login attempts from ${ip}.`,
    }).then(() => null);
  }
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
    const challengeToken = String(body.challengeToken || '');
    const ip = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || '';

    if (challengeToken) {
      const tokenHash = await sha256(challengeToken);
      const { data: challenge } = await supabase
        .from('admin_login_challenges')
        .select('*, admin_users(*)')
        .eq('challenge_token_hash', tokenHash)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (!challenge?.admin_users) return json({ error: 'TOTP challenge expired. Sign in again.' }, 401);
      const admin = challenge.admin_users;
      if (!ipAllowed(ip, admin.allowed_ips)) return json({ error: 'This IP address is not allowed for superadmin access.' }, 403);
      if (!await verifyTotp(totpCode, admin.totp_secret || '')) return json({ error: 'Invalid 2FA code.' }, 401);
      await supabase.from('admin_login_challenges').update({ used_at: new Date().toISOString() }).eq('id', challenge.id);
      const session = await createSession(supabase, admin, ip, userAgent);
      return json({ ok: true, admin: { id: admin.id, email: admin.email, role: admin.role }, session });
    }

    if (!email || !password) return json({ error: 'Email and password are required.' }, 400);

    const { data: admin } = await supabase
      .from('admin_users')
      .select('id, email, role, is_active, totp_enabled, totp_secret, failed_attempts, locked_until, allowed_ips')
      .ilike('email', email)
      .maybeSingle();
    if (!admin || admin.is_active === false) return json({ error: 'Invalid admin email or password.' }, 401);

    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      return json({ error: 'Admin account is temporarily locked.' }, 423);
    }
    if (!ipAllowed(ip, admin.allowed_ips)) {
      await failAttempt(supabase, admin, ip, 'ip_not_allowed');
      return json({ error: 'This IP address is not allowed for superadmin access.' }, 403);
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
      await failAttempt(supabase, admin, ip, 'bad_password');
      return json({ error: 'Invalid admin email or password.' }, 401);
    }

    if (admin.totp_enabled) {
      if (!admin.totp_secret) return json({ error: '2FA is enabled but no TOTP secret is configured for this admin.' }, 500);
      const challengeToken = randomToken(24);
      await supabase.from('admin_login_challenges').insert({
        admin_id: admin.id,
        challenge_token_hash: await sha256(challengeToken),
        ip_address: ip,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      return json({ ok: true, requiresTOTP: true, challengeToken });
    }

    const session = await createSession(supabase, admin, ip, userAgent);
    return json({ ok: true, admin: { id: admin.id, email: admin.email, role: admin.role }, session });
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
});
