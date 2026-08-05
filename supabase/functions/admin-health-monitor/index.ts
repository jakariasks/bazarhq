import { handleCors, json } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

async function check(name: string, fn: () => Promise<any>) {
  const started = Date.now();
  try {
    await fn();
    return { service_name: name, status: 'operational', response_ms: Date.now() - started, message: 'OK' };
  } catch (err) {
    return { service_name: name, status: 'down', response_ms: Date.now() - started, message: err.message || String(err) };
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors;
  try {
    const supabase = createAdminClient();
    const results = await Promise.all([
      check('database', async () => {
        const { error } = await supabase.from('stores').select('id', { count: 'exact', head: true }).limit(1);
        if (error) throw error;
      }),
      check('auth', async () => {
        const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
        if (error) throw error;
      }),
      check('storage', async () => {
        const { error } = await supabase.storage.listBuckets();
        if (error) throw error;
      }),
      check('email_queue', async () => {
        const { error } = await supabase.from('email_notification_queue').select('id', { count: 'exact', head: true }).limit(1);
        if (error) throw error;
      }),
    ]);

    for (const r of results) {
      await supabase.rpc('record_system_health', {
        p_service_name: r.service_name,
        p_status: r.status,
        p_response_ms: r.response_ms,
        p_message: r.message,
      }).then(() => null);
    }

    return json({ ok: true, results });
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
});
