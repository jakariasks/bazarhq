import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { assertCronAuthorized } from '../_shared/cron-auth.ts'

const headers = { 'Content-Type': 'application/json; charset=utf-8' }
const safe = (value: unknown) => String(value || '').replace(/[\r\n\t]+/g, ' ').slice(0, 500)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return new Response(JSON.stringify({ ok: false, error: 'Method not allowed.' }), { status: 405, headers })

  try {
    assertCronAuthorized(req)
  } catch (error) {
    const caught = error as Error & { status?: number }
    return new Response(JSON.stringify({ ok: false, error: safe(caught.message) }), { status: caught.status || 401, headers })
  }

  const url = Deno.env.get('SUPABASE_URL') || ''
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const cronSecret = Deno.env.get('CRON_SECRET')?.trim() || ''
  if (!url || !serviceRole || !cronSecret) {
    return new Response(JSON.stringify({ ok: false, error: 'Reminder worker configuration is incomplete.' }), { status: 500, headers })
  }

  const supabase = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await supabase.rpc('create_pending_order_reminders')
  if (error) return new Response(JSON.stringify({ ok: false, error: safe(error.message) }), { status: 500, headers })

  // Deliver newly queued reminders now; the every-minute processor cron remains
  // the durable retry/fallback path if a provider is temporarily unavailable.
  let delivery: unknown = null
  try {
    const response = await fetch(`${url}/functions/v1/process-notification-queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret },
      body: JSON.stringify({ reason: 'pending_48h_reminder' }),
    })
    delivery = await response.json().catch(() => ({ status: response.status }))
  } catch (deliveryError) {
    delivery = { ok: false, error: safe((deliveryError as Error)?.message || deliveryError) }
  }

  return new Response(JSON.stringify({ ok: true, remindersCreated: Number(data || 0), delivery }), { headers })
})
