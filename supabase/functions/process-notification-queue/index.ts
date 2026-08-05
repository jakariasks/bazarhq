import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { assertCronAuthorized } from '../_shared/cron-auth.ts'

const jsonHeaders = { 'Content-Type': 'application/json' }
const nowIso = () => new Date().toISOString()
const safeText = (value: unknown, max = 500) => String(value || '').replace(/[\r\n\t]+/g, ' ').slice(0, max)
const maskEmail = (value: string) => {
  const [local = '', domain = ''] = value.split('@')
  return domain ? `${local.slice(0, 2)}***@${domain}` : 'masked'
}
const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 4 ? `*******${digits.slice(-4)}` : 'masked'
}
const retryAt = (attempt: number) => new Date(Date.now() + Math.min(360, 2 ** Math.max(0, attempt - 1)) * 60_000).toISOString()

async function logAttempt(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  await supabase.from('notification_delivery_logs').insert(payload)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: jsonHeaders })
  try {
    assertCronAuthorized(req)
  } catch (error) {
    const caught = error as Error & { status?: number }
    return new Response(JSON.stringify({ ok: false, error: safeText(caught.message) }), { status: caught.status || 401, headers: jsonHeaders })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim()
  const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL')?.trim() || 'BazarHQ <noreply@bazarhq.com>'
  const smsUrl = Deno.env.get('SMS_GATEWAY_URL')?.trim()
  const smsToken = Deno.env.get('SMS_GATEWAY_TOKEN')?.trim()
  const smsFrom = Deno.env.get('SMS_FROM')?.trim() || 'BazarHQ'
  const summary = { emailSent: 0, emailRetried: 0, emailFailed: 0, smsSent: 0, smsRetried: 0, smsFailed: 0, fallbackEmails: 0 }

  // Recover jobs left in processing when a previous invocation timed out.
  const staleCutoff = new Date(Date.now() - 10 * 60_000).toISOString()
  await Promise.all([
    supabase.from('email_notification_queue').update({ status: 'retry', next_attempt_at: nowIso(), error_message: 'Recovered after an interrupted delivery attempt.', updated_at: nowIso() }).eq('status', 'processing').lt('updated_at', staleCutoff),
    supabase.from('sms_notification_queue').update({ status: 'retry', next_attempt_at: nowIso(), error_message: 'Recovered after an interrupted delivery attempt.', updated_at: nowIso() }).eq('status', 'processing').lt('updated_at', staleCutoff),
  ])

  const { data: emails, error: emailLoadError } = await supabase
    .from('email_notification_queue').select('*')
    .in('status', ['pending', 'retry']).lte('next_attempt_at', nowIso())
    .order('created_at', { ascending: true }).limit(25)
  if (emailLoadError) return new Response(JSON.stringify({ ok: false, error: safeText(emailLoadError.message) }), { status: 500, headers: jsonHeaders })

  for (const job of emails || []) {
    const originalStatus = job.status
    const { data: claimed } = await supabase.from('email_notification_queue')
      .update({ status: 'processing', updated_at: nowIso() }).eq('id', job.id).eq('status', originalStatus).select('id').maybeSingle()
    if (!claimed) continue
    const recipient = String(job.recipient_email || job.to_email || '').trim()
    const attempt = Number(job.attempts || 0) + 1
    const maxAttempts = Number(job.max_attempts || 5)
    try {
      if (!recipient || !/^\S+@\S+\.\S+$/.test(recipient)) throw new Error('A valid email recipient is required.')
      if (!resendKey) throw new Error('Email provider is not configured.')
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromEmail, to: [recipient], subject: job.subject || 'BazarHQ notification', html: job.html || undefined, text: job.body || '' }),
      })
      const providerPayload = await response.json().catch(async () => ({ message: safeText(await response.text()) }))
      if (!response.ok) throw new Error(providerPayload?.message || `Email provider returned ${response.status}.`)
      await supabase.from('email_notification_queue').update({ status: 'sent', attempts: attempt, sent_at: nowIso(), error_message: null, provider_response: providerPayload, updated_at: nowIso() }).eq('id', job.id)
      await logAttempt(supabase, { store_id: job.store_id, queue_type: 'email', queue_id: job.id, notification_type: job.notification_type, recipient_masked: maskEmail(recipient), status: 'sent', attempt, provider: 'resend' })
      summary.emailSent++
    } catch (error) {
      const finalFailure = attempt >= maxAttempts
      const message = safeText(error?.message || error)
      await supabase.from('email_notification_queue').update({ status: finalFailure ? 'failed' : 'retry', attempts: attempt, next_attempt_at: retryAt(attempt), error_message: message, updated_at: nowIso() }).eq('id', job.id)
      await logAttempt(supabase, { store_id: job.store_id, queue_type: 'email', queue_id: job.id, notification_type: job.notification_type, recipient_masked: maskEmail(recipient), status: finalFailure ? 'failed' : 'retry', attempt, provider: 'resend', error_message: message })
      if (finalFailure) summary.emailFailed++; else summary.emailRetried++
    }
  }

  const { data: smsJobs, error: smsLoadError } = await supabase
    .from('sms_notification_queue').select('*')
    .in('status', ['pending', 'retry']).lte('next_attempt_at', nowIso())
    .order('created_at', { ascending: true }).limit(25)
  if (smsLoadError) return new Response(JSON.stringify({ ok: false, error: safeText(smsLoadError.message), ...summary }), { status: 500, headers: jsonHeaders })

  for (const job of smsJobs || []) {
    const originalStatus = job.status
    const { data: claimed } = await supabase.from('sms_notification_queue')
      .update({ status: 'processing', updated_at: nowIso() }).eq('id', job.id).eq('status', originalStatus).select('id').maybeSingle()
    if (!claimed) continue
    const recipient = String(job.recipient_phone || job.to_phone || '').replace(/\D/g, '')
    const attempt = Number(job.attempts || 0) + 1
    const maxAttempts = Number(job.max_attempts || 5)
    try {
      if (!/^(?:880)?01[3-9][0-9]{8}$/.test(recipient)) throw new Error('A valid Bangladesh SMS recipient is required.')
      if (!smsUrl) throw new Error('SMS provider is not configured.')
      const response = await fetch(smsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(smsToken ? { Authorization: `Bearer ${smsToken}` } : {}) },
        body: JSON.stringify({ to: recipient, message: job.message || '', from: smsFrom }),
      })
      const responseText = safeText(await response.text(), 1000)
      if (!response.ok) throw new Error(`SMS provider returned ${response.status}: ${responseText}`)
      await supabase.from('sms_notification_queue').update({ status: 'sent', attempts: attempt, sent_at: nowIso(), error_message: null, provider_response: { accepted: true }, updated_at: nowIso() }).eq('id', job.id)
      await logAttempt(supabase, { store_id: job.store_id, queue_type: 'sms', queue_id: job.id, notification_type: job.notification_type, recipient_masked: maskPhone(recipient), status: 'sent', attempt, provider: 'configured_sms_gateway' })
      summary.smsSent++
    } catch (error) {
      const finalFailure = attempt >= maxAttempts
      const message = safeText(error?.message || error)
      const patch: Record<string, unknown> = { status: finalFailure ? 'failed' : 'retry', attempts: attempt, next_attempt_at: retryAt(attempt), error_message: message, updated_at: nowIso() }
      if (finalFailure && job.fallback_email && !job.fallback_queued_at) patch.fallback_queued_at = nowIso()
      await supabase.from('sms_notification_queue').update(patch).eq('id', job.id)
      await logAttempt(supabase, { store_id: job.store_id, queue_type: 'sms', queue_id: job.id, notification_type: job.notification_type, recipient_masked: maskPhone(recipient), status: finalFailure ? 'failed' : 'retry', attempt, provider: 'configured_sms_gateway', error_message: message })
      if (finalFailure) {
        summary.smsFailed++
        const fallbackEmail = String(job.fallback_email || '').trim()
        if (fallbackEmail && !job.fallback_queued_at && /^\S+@\S+\.\S+$/.test(fallbackEmail)) {
          const { error: fallbackError } = await supabase.from('email_notification_queue').insert({
            store_id: job.store_id, recipient_email: fallbackEmail,
            subject: 'BazarHQ notification (SMS fallback)', body: job.message || 'A BazarHQ notification could not be delivered by SMS.',
            notification_type: `${job.notification_type || 'notification'}_sms_fallback`, fallback_from_sms_id: job.id,
            max_attempts: maxAttempts,
          })
          if (!fallbackError) summary.fallbackEmails++
        }
      } else summary.smsRetried++
    }
  }

  return new Response(JSON.stringify({ ok: true, ...summary }), { headers: jsonHeaders })
})
