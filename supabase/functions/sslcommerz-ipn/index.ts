import { handleCors, parseBody, json } from '../_shared/cors.ts';
import { handleSslCallback } from '../_shared/sslcommerz-callback.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors;
  const payload = await parseBody(req);
  const result = await handleSslCallback(payload, 'ipn', req.headers.get('origin') || '');
  return json(result, result.ok ? 200 : 400);
});
