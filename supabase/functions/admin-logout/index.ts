import { handleCors, json, getClientIp } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { sha256 } from '../_shared/crypto.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors;
  try {
    const token = req.headers.get('x-admin-session') || '';
    if (!token) return json({ ok: true });
    const supabase = createAdminClient();
    const tokenHash = await sha256(token);
    const { data: session } = await supabase.from('admin_sessions').select('*, admin_users(email)').eq('token_hash', tokenHash).maybeSingle();
    await supabase.from('admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash', tokenHash);
    if (session?.admin_id) {
      await supabase.from('admin_audit_log').insert({ admin_id: session.admin_id, admin_email: session.admin_users?.email, action: 'logout', details: {}, ip_address: getClientIp(req) }).then(() => null);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
});
