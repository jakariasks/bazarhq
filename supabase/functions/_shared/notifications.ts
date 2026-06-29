import { createAdminClient } from './supabaseAdmin.ts';

export async function processNotificationQueue(limit = 25, storeId?: string) {
  const supabase = createAdminClient();
  const results: Record<string, unknown[]> = { email: [], sms: [] };

  const emailFrom = Deno.env.get('NOTIFICATION_FROM_EMAIL') || 'BazarHQ <noreply@bazarhq.com>';
  const resendKey = Deno.env.get('RESEND_API_KEY') || '';

  let emailQuery = supabase
    .from('email_notification_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (storeId) emailQuery = emailQuery.eq('store_id', storeId);

  const { data: emails } = await emailQuery;
  for (const email of emails || []) {
    try {
      if (!resendKey) throw new Error('RESEND_API_KEY is not configured.');
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: emailFrom,
          to: [email.recipient_email],
          subject: email.subject,
          text: email.body,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Resend email failed.');
      await supabase.from('email_notification_queue').update({ status: 'sent', provider_response: payload, sent_at: new Date().toISOString() }).eq('id', email.id);
      results.email.push({ id: email.id, status: 'sent' });
    } catch (err) {
      await supabase.from('email_notification_queue').update({ status: 'failed', last_error: err.message || String(err), attempts: (email.attempts || 0) + 1 }).eq('id', email.id);
      results.email.push({ id: email.id, status: 'failed', error: err.message || String(err) });
    }
  }

  const smsUrl = Deno.env.get('SMS_GATEWAY_URL') || '';
  const smsToken = Deno.env.get('SMS_GATEWAY_TOKEN') || '';
  const smsFrom = Deno.env.get('SMS_FROM') || 'BazarHQ';

  let smsQuery = supabase
    .from('sms_notification_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (storeId) smsQuery = smsQuery.eq('store_id', storeId);

  const { data: smsRows } = await smsQuery;
  for (const sms of smsRows || []) {
    try {
      if (!smsUrl) throw new Error('SMS_GATEWAY_URL is not configured.');
      const response = await fetch(smsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(smsToken ? { Authorization: `Bearer ${smsToken}` } : {}),
        },
        body: JSON.stringify({ to: sms.recipient_phone, message: sms.message, from: smsFrom }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text || 'SMS gateway failed.');
      await supabase.from('sms_notification_queue').update({ status: 'sent', provider_response: { response: text }, sent_at: new Date().toISOString() }).eq('id', sms.id);
      results.sms.push({ id: sms.id, status: 'sent' });
    } catch (err) {
      await supabase.from('sms_notification_queue').update({ status: 'failed', last_error: err.message || String(err), attempts: (sms.attempts || 0) + 1 }).eq('id', sms.id);
      results.sms.push({ id: sms.id, status: 'failed', error: err.message || String(err) });
    }
  }

  return results;
}
