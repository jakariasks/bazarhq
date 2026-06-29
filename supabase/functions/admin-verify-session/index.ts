import { handleCors, json, getClientIp } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { sha256 } from '../_shared/crypto.ts';
import { ipAllowed } from '../_shared/ip.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors;
  try {
    const token = req.headers.get('x-admin-session') || '';
    if (!token) return json({ error: 'Missing admin session.' }, 401);
    const tokenHash = await sha256(token);
    const ip = getClientIp(req);
    const supabase = createAdminClient();

    const { data: session } = await supabase
      .from('admin_sessions')
      .select('*, admin_users(id,email,role,is_active,allowed_ips)')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .gt('idle_expires_at', new Date().toISOString())
      .maybeSingle();

    if (!session?.admin_users || session.admin_users.is_active === false) return json({ error: 'Admin session expired.' }, 401);
    if (!ipAllowed(ip, session.admin_users.allowed_ips)) return json({ error: 'IP address no longer allowed.' }, 403);

    const idleExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await supabase.from('admin_sessions').update({ idle_expires_at: idleExpiresAt, last_seen_at: new Date().toISOString() }).eq('id', session.id);

    return json({ ok: true, admin: { id: session.admin_users.id, email: session.admin_users.email, role: session.admin_users.role }, session: { expires_at: session.expires_at, idle_expires_at: idleExpiresAt } });
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
});
