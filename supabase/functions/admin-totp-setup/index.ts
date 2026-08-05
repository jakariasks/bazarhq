import { handleCors, json, getClientIp } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { randomToken, sha256, verifyTotp } from '../_shared/crypto.ts';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function randomBase32(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}
function recoveryCode() {
  return `${randomToken(4)}-${randomToken(4)}`.toUpperCase();
}
async function getAdminBySession(supabase: any, req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || req.headers.get('x-admin-session') || '';
  if (!token) return null;
  const hash = await sha256(token);
  const { data } = await supabase
    .from('admin_sessions')
    .select('*, admin_users(*)')
    .eq('token_hash', hash)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .gt('idle_expires_at', new Date().toISOString())
    .maybeSingle();
  return data?.admin_users ? { session: data, admin: data.admin_users } : null;
}

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors;
  try {
    const supabase = createAdminClient();
    const auth = await getAdminBySession(supabase, req);
    if (!auth) return json({ error: 'Unauthorized admin session.' }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'start');
    const ip = getClientIp(req);

    if (action === 'start') {
      const secret = randomBase32(32);
      const issuer = encodeURIComponent('BazarHQ');
      const account = encodeURIComponent(auth.admin.email || 'admin');
      const otpauth_url = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
      await supabase.from('admin_login_challenges').insert({
        admin_id: auth.admin.id,
        challenge_token_hash: await sha256(`totp-setup:${secret}`),
        ip_address: ip,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      return json({ ok: true, secret, otpauth_url });
    }

    if (action === 'confirm') {
      const secret = String(body.secret || '').replace(/\s+/g, '').toUpperCase();
      const code = String(body.code || '');
      if (!secret || !await verifyTotp(code, secret)) return json({ error: 'Invalid authenticator code.' }, 400);

      const codes = Array.from({ length: 10 }, () => recoveryCode());
      const hashes = await Promise.all(codes.map((c) => sha256(c.replace(/\s+/g, '').toUpperCase())));
      const { error } = await supabase.from('admin_users').update({
        totp_enabled: true,
        totp_secret: secret,
        totp_recovery_hashes: hashes,
        updated_at: new Date().toISOString(),
      }).eq('id', auth.admin.id);
      if (error) throw error;

      await supabase.rpc('write_admin_audit', {
        p_admin_id: auth.admin.id,
        p_admin_email: auth.admin.email,
        p_action: 'admin.totp_enabled',
        p_target_type: 'admin_user',
        p_target_id: auth.admin.id,
        p_details: { recovery_codes_generated: codes.length },
        p_ip_address: ip,
        p_user_agent: req.headers.get('user-agent') || '',
      }).then(() => null);

      return json({ ok: true, recovery_codes: codes });
    }

    return json({ error: 'Unsupported action.' }, 400);
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
});
