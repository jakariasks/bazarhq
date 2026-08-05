import { handleCors, json, parseBody, redirect } from '../_shared/cors.ts'
import { handleSslCallback } from '../_shared/sslcommerz-callback.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    const payload = await parseBody(req)
    const result = await handleSslCallback(payload, 'cancel')
    if ((req.headers.get('accept') || '').includes('application/json')) return json(result, result.httpStatus || 200)
    return redirect(result.redirect)
  } catch (error) {
    console.error('sslcommerz-cancel', error)
    return json({ ok: false, message: 'Payment callback could not be processed.' }, 500)
  }
})
