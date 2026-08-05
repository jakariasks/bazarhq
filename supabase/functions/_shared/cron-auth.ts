export function assertCronAuthorized(req: Request) {
  const expected = Deno.env.get('CRON_SECRET')?.trim()
  if (!expected) throw new Error('CRON_SECRET is not configured.')
  const header = req.headers.get('x-cron-secret')?.trim()
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (header !== expected && bearer !== expected) {
    const error = new Error('Unauthorized cron request.')
    ;(error as Error & { status?: number }).status = 401
    throw error
  }
}
