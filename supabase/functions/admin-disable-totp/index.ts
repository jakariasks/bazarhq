import { handleCors, json, getClientIp } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { sha256, verifyTotp } from '../_shared/crypto.ts';

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

async function recoveryOk(supabase: any, admin: any, code: string) {
  const clean = String(code || '').trim().replace(/\s+/g, '').toUpperCase();
  if (!clean) return false;
  const hash = await sha256(clean);
  const hashes = Array.isArray(admin.totp_recovery_hashes) ? admin.totp_recovery_hashes : [];
  if (!hashes.includes(hash)) return false;
  await supabase.from('admin_users').update({ totp_recovery_hashes: hashes.filter((h: string) => h !== hash) }).eq('id', admin.id);
  return true;
}

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors;
  try {
    const supabase = createAdminClient();
    const auth = await getAdminBySession(supabase, req);
    if (!auth) return json({ error: 'Unauthorized admin session.' }, 401);
    const body = await req.json().catch(() => ({}));
    const code = String(body.code || '');
    const recoveryCode = String(body.recoveryCode || '');
    const valid = recoveryCode ? await recoveryOk(supabase, auth.admin, recoveryCode) : await verifyTotp(code, auth.admin.totp_secret || '');
    if (!valid) return json({ error: 'Invalid 2FA or recovery code.' }, 401);

    await supabase.from('admin_users').update({
      totp_enabled: false,
      totp_secret: null,
      totp_recovery_hashes: [],
      updated_at: new Date().toISOString(),
    }).eq('id', auth.admin.id);

    await supabase.rpc('write_admin_audit', {
      p_admin_id: auth.admin.id,
      p_admin_email: auth.admin.email,
      p_action: 'admin.totp_disabled',
      p_target_type: 'admin_user',
      p_target_id: auth.admin.id,
      p_details: {},
      p_ip_address: getClientIp(req),
      p_user_agent: req.headers.get('user-agent') || '',
    }).then(() => null);

    return json({ ok: true });
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
});
