import { handleCors, json } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

function csvEscape(value: any) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return 'message\nNo data found';
  const headers = Object.keys(rows[0]);
  return [headers.join(','), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(','))].join('\n');
}
async function sendEmail(to: string, subject: string, body: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('NOTIFICATION_FROM_EMAIL') || 'BazarHQ <noreply@example.com>';
  if (!key || !to) return { skipped: true };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text: body }),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors;
  try {
    const supabase = createAdminClient();
    const { data: jobs, error } = await supabase
      .from('admin_report_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(5);
    if (error) throw error;

    const processed = [];
    for (const job of jobs || []) {
      await supabase.from('admin_report_jobs').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', job.id);
      try {
        let rows: Record<string, any>[] = [];
        if (job.report_type === 'merchants') {
          const { data } = await supabase.from('stores').select('id, shop_name, subdomain, account_status, storefront_published, created_at').limit(5000);
          rows = data || [];
        } else if (job.report_type === 'orders') {
          const { data } = await supabase.from('orders').select('*').gte('created_at', job.date_from || '1970-01-01').lte('created_at', job.date_to || new Date().toISOString()).limit(5000);
          rows = data || [];
        } else {
          const [{ data: stores }, { data: orders }, { data: events }] = await Promise.all([
            supabase.from('stores').select('id, shop_name, account_status, storefront_published, created_at').limit(5000),
            supabase.from('orders').select('id, status, payment_status, total_amount, created_at').limit(5000),
            supabase.from('analytics_events').select('id, event_type, store_id, created_at').limit(5000).then((r: any) => r).catch(() => ({ data: [] })),
          ]);
          rows = [
            { metric: 'stores', value: stores?.length || 0 },
            { metric: 'orders', value: orders?.length || 0 },
            { metric: 'analytics_events', value: events?.length || 0 },
            { metric: 'revenue', value: (orders || []).reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0) },
          ];
        }
        const csv = toCsv(rows);
        await supabase.from('admin_report_jobs').update({ status: 'completed', result_csv: csv, completed_at: new Date().toISOString() }).eq('id', job.id);
        if (job.recipient_email) {
          await sendEmail(job.recipient_email, `BazarHQ report: ${job.report_type}`, `Your report is ready.\n\n${csv.slice(0, 15000)}`);
          await supabase.from('admin_report_jobs').update({ status: 'emailed', emailed_at: new Date().toISOString() }).eq('id', job.id);
        }
        processed.push({ id: job.id, ok: true });
      } catch (err) {
        await supabase.from('admin_report_jobs').update({ status: 'failed', error_message: err.message || String(err), completed_at: new Date().toISOString() }).eq('id', job.id);
        processed.push({ id: job.id, ok: false, error: err.message || String(err) });
      }
    }
    return json({ ok: true, processed });
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
});
