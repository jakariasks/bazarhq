import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { assertCronAuthorized } from '../_shared/cron-auth.ts'

const headers = { 'Content-Type': 'application/json' }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  try { assertCronAuthorized(req) } catch (error) {
    const caught = error as Error & { status?: number }
    return new Response(JSON.stringify({ ok: false, error: caught.message }), { status: caught.status || 401, headers })
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { count: dueBefore } = await supabase.from('stores').select('id', { count: 'exact', head: true })
    .eq('account_status', 'deleted').is('permanently_deleted_at', null).lte('deletion_scheduled_at', new Date().toISOString())
  const { data, error } = await supabase.rpc('cleanup_deleted_stores_older_than_30_days')
  if (error) return new Response(JSON.stringify({ ok: false, error: error.message, dueBefore: dueBefore || 0 }), { status: 500, headers })
  const { count: dueAfter } = await supabase.from('stores').select('id', { count: 'exact', head: true })
    .eq('account_status', 'deleted').is('permanently_deleted_at', null).lte('deletion_scheduled_at', new Date().toISOString())
  return new Response(JSON.stringify({ ok: true, dueBefore: dueBefore || 0, cleaned: Number(data || 0), dueAfter: dueAfter || 0, checkedAt: new Date().toISOString() }), { headers })
})
