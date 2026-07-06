import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL') || 'BazarHQ <noreply@example.com>'
  const smsUrl = Deno.env.get('SMS_GATEWAY_URL')
  const smsToken = Deno.env.get('SMS_GATEWAY_TOKEN')

  let emailSent = 0, emailFailed = 0, smsSent = 0, smsFailed = 0

  const { data: emails } = await supabase.from('email_notification_queue').select('*').eq('status', 'pending').lt('attempts', 5).order('created_at').limit(25)
  for (const job of emails || []) {
    try {
      if (!resendKey) throw new Error('RESEND_API_KEY is not configured')
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromEmail, to: job.to_email, subject: job.subject, html: job.html || job.text_body || '' }),
      })
      if (!res.ok) throw new Error(await res.text())
      await supabase.from('email_notification_queue').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', job.id)
      emailSent++
    } catch (error) {
      await supabase.from('email_notification_queue').update({ attempts: (job.attempts || 0) + 1, status: 'pending', last_error: String(error?.message || error) }).eq('id', job.id)
      emailFailed++
    }
  }

  const { data: smsJobs } = await supabase.from('sms_notification_queue').select('*').eq('status', 'pending').lt('attempts', 5).order('created_at').limit(25)
  for (const job of smsJobs || []) {
    try {
      if (!smsUrl) throw new Error('SMS_GATEWAY_URL is not configured')
      const res = await fetch(smsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(smsToken ? { Authorization: `Bearer ${smsToken}` } : {}) },
        body: JSON.stringify({ to: job.to_phone, message: job.message, from: Deno.env.get('SMS_FROM') || 'BazarHQ' }),
      })
      if (!res.ok) throw new Error(await res.text())
      await supabase.from('sms_notification_queue').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', job.id)
      smsSent++
    } catch (error) {
      await supabase.from('sms_notification_queue').update({ attempts: (job.attempts || 0) + 1, status: 'pending', last_error: String(error?.message || error) }).eq('id', job.id)
      smsFailed++
    }
  }

  return corsResponse({ ok: true, emailSent, emailFailed, smsSent, smsFailed })
})
