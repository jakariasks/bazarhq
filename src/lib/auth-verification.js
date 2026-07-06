import { supabase } from '@/integrations/supabase/client'

export async function resendVerificationEmail(email, redirectTo = '/merchant') {
  const clean = String(email || '').trim().toLowerCase()
  if (!clean) throw new Error('Enter your email first.')

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: clean,
    options: { emailRedirectTo: `${window.location.origin}${redirectTo}` },
  })

  if (error) throw error
  return true
}

export function isEmailNotConfirmedError(error) {
  const text = `${error?.message || ''} ${error?.name || ''}`.toLowerCase()
  return text.includes('email not confirmed') || text.includes('not confirmed') || text.includes('confirm')
}
