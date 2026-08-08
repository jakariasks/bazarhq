import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DeliveryError, sendEmailNotification, sendSmsNotification } from '../_shared/notification-providers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}

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
const retryAt = (attempt: number) => new Date(Date.now() + Math.min(15, 2 ** Math.max(0, attempt - 1)) * 60_000).toISOString()
const latencyMs = (createdAt: string | null | undefined) => Math.max(0, Date.now() - (Date.parse(createdAt || '') || Date.now()))

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function hasCronAccess(req: Request) {
  const expected = Deno.env.get('CRON_SECRET')?.trim() || ''
  if (!expected) return false
  const header = req.headers.get('x-cron-secret')?.trim() || ''
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || ''
  return header === expected || bearer === expected
}

async function authorizeKick(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  storeId: string,
) {
  if (hasCronAccess(req)) return { mode: 'cron' as const }

  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || ''
  if (!jwt) return null

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  const user = userData?.user
  if (userError || !user?.id || !storeId) return null

  const { data: store } = await supabase.from('stores').select('id,owner_id').eq('id', storeId).maybeSingle()
  if (store?.owner_id === user.id) return { mode: 'merchant' as const, userId: user.id }

  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString()
  const { data: recentOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('store_id', storeId)
    .eq('customer_id', user.id)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return recentOrder ? { mode: 'customer' as const, userId: user.id } : null
}

async function logAttempt(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const { error } = await supabase.from('notification_delivery_logs').insert(payload)
  if (error) console.error('notification_delivery_logs insert failed:', error)
}

async function queueFallbackEmail(
  supabase: ReturnType<typeof createClient>,
  job: Record<string, any>,
  maxAttempts: number,
) {
  const fallbackEmail = String(job.fallback_email || '').trim()
  if (!fallbackEmail || !/^\S+@\S+\.\S+$/.test(fallbackEmail)) return false

  const { data: existing } = await supabase
    .from('email_notification_queue')
    .select('id')
    .eq('fallback_from_sms_id', job.id)
    .limit(1)
    .maybeSingle()
  if (existing) return false

  const { error } = await supabase.from('email_notification_queue').insert({
    store_id: job.store_id,
    recipient_email: fallbackEmail,
    subject: 'BazarHQ notification (SMS fallback)',
    body: job.message || 'A BazarHQ notification could not be delivered by SMS.',
    notification_type: `${job.notification_type || 'notification'}_sms_fallback`,
    fallback_from_sms_id: job.id,
    max_attempts: maxAttempts,
    priority: 1,
  })
  if (error) {
    console.error('Fallback email queue failed:', error)
    return false
  }

  await supabase.from('sms_notification_queue').update({ fallback_queued_at: nowIso(), updated_at: nowIso() }).eq('id', job.id)
  return true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405)

  const url = Deno.env.get('SUPABASE_URL') || ''
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!url || !serviceRole) return json({ ok: false, error: 'Notification worker configuration is incomplete.' }, 500)

  const supabase = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
  const body = await req.json().catch(() => ({}))
  const storeId = String(body?.storeId || body?.store_id || '').trim()
  const access = await authorizeKick(req, supabase, storeId)
  if (!access) return json({ ok: false, error: 'Unauthorized notification processor request.' }, 401)

  const scopedStoreId = access.mode === 'cron' ? (storeId || null) : storeId
  const summary = {
    mode: access.mode,
    smsSent: 0,
    smsRetried: 0,
    smsFailed: 0,
    emailSent: 0,
    emailRetried: 0,
    emailFailed: 0,
    fallbackEmails: 0,
  }

  // Recover jobs abandoned by a previous invocation.
  const staleCutoff = new Date(Date.now() - 10 * 60_000).toISOString()
  for (const table of ['sms_notification_queue', 'email_notification_queue']) {
    let query = supabase.from(table).update({
      status: 'retry',
      next_attempt_at: nowIso(),
      error_message: 'Recovered after an interrupted delivery attempt.',
      updated_at: nowIso(),
    }).eq('status', 'processing').lt('updated_at', staleCutoff)
    if (scopedStoreId) query = query.eq('store_id', scopedStoreId)
    await query
  }

  // SMS first: permanent failures can enqueue an email fallback that is then
  // delivered in the SAME invocation.
  let smsQuery = supabase.from('sms_notification_queue').select('*')
    .in('status', ['pending', 'retry']).lte('next_attempt_at', nowIso())
    .order('priority', { ascending: true }).order('created_at', { ascending: true }).limit(30)
  if (scopedStoreId) smsQuery = smsQuery.eq('store_id', scopedStoreId)
  const { data: smsJobs, error: smsLoadError } = await smsQuery
  if (smsLoadError) return json({ ok: false, error: safeText(smsLoadError.message), ...summary }, 500)

  for (const job of smsJobs || []) {
    const originalStatus = job.status
    const { data: claimed } = await supabase.from('sms_notification_queue')
      .update({ status: 'processing', last_attempt_at: nowIso(), updated_at: nowIso() })
      .eq('id', job.id).eq('status', originalStatus).select('id').maybeSingle()
    if (!claimed) continue

    const recipient = String(job.recipient_phone || job.to_phone || '').replace(/\D/g, '')
    const attempt = Number(job.attempts || 0) + 1
    const maxAttempts = Math.max(1, Number(job.max_attempts || 5))

    try {
      const result = await sendSmsNotification({ to: recipient, message: String(job.message || '') })
      const sentAt = nowIso()
      await supabase.from('sms_notification_queue').update({
        status: 'sent', attempts: attempt, sent_at: sentAt, delivered_at: sentAt,
        error_message: null, provider_response: result.providerResponse, updated_at: sentAt,
      }).eq('id', job.id)
      await logAttempt(supabase, {
        store_id: job.store_id, queue_type: 'sms', queue_id: job.id,
        notification_type: job.notification_type, recipient_masked: maskPhone(recipient),
        status: 'sent', attempt, provider: result.provider,
        provider_status: result.providerStatus, provider_message_id: result.providerMessageId,
        latency_ms: latencyMs(job.created_at), fallback_used: false,
      })
      summary.smsSent++
    } catch (error) {
      const deliveryError = error instanceof DeliveryError ? error : new DeliveryError(safeText((error as Error)?.message || error))
      const finalFailure = !deliveryError.retryable || attempt >= maxAttempts
      const message = safeText(deliveryError.message)
      const fallbackQueued = finalFailure && !job.fallback_queued_at
        ? await queueFallbackEmail(supabase, job, maxAttempts)
        : false

      await supabase.from('sms_notification_queue').update({
        status: finalFailure ? 'failed' : 'retry',
        attempts: attempt,
        next_attempt_at: finalFailure ? job.next_attempt_at : retryAt(attempt),
        error_message: message,
        updated_at: nowIso(),
        ...(fallbackQueued ? { fallback_queued_at: nowIso() } : {}),
      }).eq('id', job.id)

      await logAttempt(supabase, {
        store_id: job.store_id, queue_type: 'sms', queue_id: job.id,
        notification_type: job.notification_type, recipient_masked: maskPhone(recipient),
        status: finalFailure ? 'failed' : 'retry', attempt,
        provider: deliveryError.provider || 'sms_gateway', provider_status: deliveryError.status,
        error_message: message, latency_ms: latencyMs(job.created_at), fallback_used: fallbackQueued,
      })

      if (fallbackQueued) summary.fallbackEmails++
      if (finalFailure) summary.smsFailed++; else summary.smsRetried++
    }
  }

  let emailQuery = supabase.from('email_notification_queue').select('*')
    .in('status', ['pending', 'retry']).lte('next_attempt_at', nowIso())
    .order('priority', { ascending: true }).order('created_at', { ascending: true }).limit(40)
  if (scopedStoreId) emailQuery = emailQuery.eq('store_id', scopedStoreId)
  const { data: emails, error: emailLoadError } = await emailQuery
  if (emailLoadError) return json({ ok: false, error: safeText(emailLoadError.message), ...summary }, 500)

  for (const job of emails || []) {
    const originalStatus = job.status
    const { data: claimed } = await supabase.from('email_notification_queue')
      .update({ status: 'processing', last_attempt_at: nowIso(), updated_at: nowIso() })
      .eq('id', job.id).eq('status', originalStatus).select('id').maybeSingle()
    if (!claimed) continue

    const recipient = String(job.recipient_email || job.to_email || '').trim()
    const attempt = Number(job.attempts || 0) + 1
    const maxAttempts = Math.max(1, Number(job.max_attempts || 5))

    try {
      const result = await sendEmailNotification({
        to: recipient,
        subject: String(job.subject || 'BazarHQ notification'),
        text: String(job.body || ''),
        html: job.html || null,
      })
      const sentAt = nowIso()
      await supabase.from('email_notification_queue').update({
        status: 'sent', attempts: attempt, sent_at: sentAt, delivered_at: sentAt,
        error_message: null, provider_response: result.providerResponse, updated_at: sentAt,
      }).eq('id', job.id)
      await logAttempt(supabase, {
        store_id: job.store_id, queue_type: 'email', queue_id: job.id,
        notification_type: job.notification_type, recipient_masked: maskEmail(recipient),
        status: 'sent', attempt, provider: result.provider,
        provider_status: result.providerStatus, provider_message_id: result.providerMessageId,
        latency_ms: latencyMs(job.created_at), fallback_used: Boolean(job.fallback_from_sms_id),
      })
      summary.emailSent++
    } catch (error) {
      const deliveryError = error instanceof DeliveryError ? error : new DeliveryError(safeText((error as Error)?.message || error))
      const finalFailure = !deliveryError.retryable || attempt >= maxAttempts
      const message = safeText(deliveryError.message)
      await supabase.from('email_notification_queue').update({
        status: finalFailure ? 'failed' : 'retry', attempts: attempt,
        next_attempt_at: finalFailure ? job.next_attempt_at : retryAt(attempt),
        error_message: message, updated_at: nowIso(),
      }).eq('id', job.id)
      await logAttempt(supabase, {
        store_id: job.store_id, queue_type: 'email', queue_id: job.id,
        notification_type: job.notification_type, recipient_masked: maskEmail(recipient),
        status: finalFailure ? 'failed' : 'retry', attempt,
        provider: deliveryError.provider || 'resend', provider_status: deliveryError.status,
        error_message: message, latency_ms: latencyMs(job.created_at),
        fallback_used: Boolean(job.fallback_from_sms_id),
      })
      if (finalFailure) summary.emailFailed++; else summary.emailRetried++
    }
  }

  return json({ ok: true, ...summary })
})
