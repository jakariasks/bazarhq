import { createAdminClient } from './supabaseAdmin.ts'

export async function requireUser(req: Request) {
  const authorization = req.headers.get('authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new Error('AUTH_REQUIRED')

  const admin = createAdminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new Error('AUTH_REQUIRED')
  return data.user
}
