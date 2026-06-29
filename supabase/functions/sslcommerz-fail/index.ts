import { handleCors, parseBody, redirect, json } from '../_shared/cors.ts';
import { handleSslCallback } from '../_shared/sslcommerz-callback.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors;
  const payload = await parseBody(req);
  const result = await handleSslCallback(payload, 'fail', req.headers.get('origin') || '');
  if (req.headers.get('accept')?.includes('application/json')) return json(result, 400);
  return redirect(result.redirect);
});
