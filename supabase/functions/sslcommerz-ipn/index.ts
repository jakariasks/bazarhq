import { handleCors, json, parseBody } from '../_shared/cors.ts'
import { handleSslCallback } from '../_shared/sslcommerz-callback.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    const payload = await parseBody(req)
    const result = await handleSslCallback(payload, 'ipn')
    // Acknowledge a processed IPN even when the final state is failed/cancelled/pending.
    return json({ received: true, status: result.status }, result.httpStatus === 404 ? 404 : 200)
  } catch (error) {
    console.error('sslcommerz-ipn', error)
    return json({ received: false, message: 'IPN could not be processed.' }, 500)
  }
})
