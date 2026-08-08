import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { assertCronAuthorized } from '../_shared/cron-auth.ts'

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-cron-secret, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405)

  try {
    assertCronAuthorized(req)
  } catch (error) {
    const caught = error as Error & { status?: number }
    return json({ ok: false, error: caught.message }, caught.status || 401)
  }

  const url = Deno.env.get('SUPABASE_URL') || ''
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!url || !serviceRole) return json({ ok: false, error: 'Cleanup service configuration is incomplete.' }, 500)

  const started = Date.now()
  const supabase = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const now = new Date().toISOString()

  const { count: dueBefore, error: beforeError } = await supabase
    .from('stores')
    .select('id', { count: 'exact', head: true })
    .eq('account_status', 'deleted')
    .is('permanently_deleted_at', null)
    .lte('deletion_scheduled_at', now)
  if (beforeError) return json({ ok: false, error: beforeError.message, stage: 'count_before' }, 500)

  const { data: cleanedData, error: cleanupError } = await supabase.rpc('cleanup_deleted_stores_older_than_30_days')
  if (cleanupError) return json({ ok: false, error: cleanupError.message, dueBefore: dueBefore || 0, stage: 'cleanup_rpc' }, 500)

  const { count: dueAfter, error: afterError } = await supabase
    .from('stores')
    .select('id', { count: 'exact', head: true })
    .eq('account_status', 'deleted')
    .is('permanently_deleted_at', null)
    .lte('deletion_scheduled_at', new Date().toISOString())
  if (afterError) return json({ ok: false, error: afterError.message, stage: 'count_after' }, 500)

  const cleaned = Number(cleanedData || 0)
  const remaining = Number(dueAfter || 0)
  const ok = remaining === 0

  return json({
    ok,
    dueBefore: Number(dueBefore || 0),
    cleaned,
    dueAfter: remaining,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    message: ok
      ? `Cleanup complete. ${cleaned} due store${cleaned === 1 ? '' : 's'} processed.`
      : `${remaining} due store${remaining === 1 ? '' : 's'} remain after cleanup.`,
  }, ok ? 200 : 500)
})
