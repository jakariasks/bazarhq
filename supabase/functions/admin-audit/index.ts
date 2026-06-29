import { handleCors, json, getClientIp } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { sha256 } from '../_shared/crypto.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors;
  try {
    const token = req.headers.get('x-admin-session') || '';
    if (!token) return json({ error: 'Missing admin session.' }, 401);
    const body = await req.json().catch(() => ({}));
    const supabase = createAdminClient();
    const { data: session } = await supabase
      .from('admin_sessions')
      .select('*, admin_users(email)')
      .eq('token_hash', await sha256(token))
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .gt('idle_expires_at', new Date().toISOString())
      .maybeSingle();
    if (!session) return json({ error: 'Admin session expired.' }, 401);
    await supabase.from('admin_audit_log').insert({
      admin_id: session.admin_id,
      admin_email: session.admin_users?.email,
      action: body.action || 'admin.action',
      target_type: body.target_type || null,
      target_id: body.target_id ? String(body.target_id) : null,
      details: body.details || {},
      ip_address: getClientIp(req),
    });
    return json({ ok: true });
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
});
