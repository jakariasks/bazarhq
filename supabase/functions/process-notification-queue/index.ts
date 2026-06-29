import { handleCors, json } from '../_shared/cors.ts';
import { processNotificationQueue } from '../_shared/notifications.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit || 25), 100);
    const storeId = body.store_id || undefined;
    const result = await processNotificationQueue(limit, storeId);
    return json({ ok: true, result });
  } catch (err) {
    return json({ ok: false, error: err.message || String(err) }, 500);
  }
});
