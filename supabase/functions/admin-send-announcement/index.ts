import { handleCors, json, getClientIp } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { sha256 } from '../_shared/crypto.ts';

async function getAdminBySession(supabase: any, req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || req.headers.get('x-admin-session') || '';
  if (!token) return null;
  const hash = await sha256(token);
  const { data } = await supabase.from('admin_sessions').select('*, admin_users(*)').eq('token_hash', hash).is('revoked_at', null).gt('expires_at', new Date().toISOString()).gt('idle_expires_at', new Date().toISOString()).maybeSingle();
  return data?.admin_users ? data.admin_users : null;
}
Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors;
  try {
    const supabase = createAdminClient();
    const admin = await getAdminBySession(supabase, req);
    if (!admin) return json({ error: 'Unauthorized admin session.' }, 401);
    const { announcementId } = await req.json();
    if (!announcementId) return json({ error: 'announcementId is required.' }, 400);
    const { data, error } = await supabase.rpc('send_platform_announcement', { p_announcement_id: announcementId, p_admin_email: admin.email });
    if (error) throw error;
    return json({ ok: true, recipient_count: data });
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
});
