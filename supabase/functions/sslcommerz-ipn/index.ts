import { corsHeaders, json } from '../_shared/merchant-auth.ts'
import { handleSslCallback } from '../_shared/sslcommerz-callback.ts'
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const form = await req.formData().catch(() => new FormData())
  const payload = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]))
  const result = await handleSslCallback(payload, 'ipn')
  return json({ ok: result.ok, status: result.status }, result.httpStatus || 200)
})
