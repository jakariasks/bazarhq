import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Loader2, MailCheck, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { safeInternalPath } from '@/lib/auth-roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const RESEND_COOLDOWN_SECONDS = 60

function verificationRedirect(role, redirectTo) {
  const safeRedirect = safeInternalPath(
    redirectTo,
    role === 'customer' ? '/customer/account' : '/onboarding',
  )
  const loginPath = role === 'customer' ? '/customer/login' : '/login'
  return `${window.location.origin}${loginPath}?verified=1&redirect=${encodeURIComponent(safeRedirect)}`
}

export function ResendVerificationCard({
  defaultEmail = '',
  compact = false,
  role = 'merchant',
  redirectTo,
  onBack,
}) {
  const [email, setEmail] = useState(defaultEmail)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => setEmail(defaultEmail), [defaultEmail])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email])
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)

  async function resend() {
    if (!validEmail) {
      toast.error('Enter the email address used to create your account.')
      return
    }

    setSending(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: {
        emailRedirectTo: verificationRedirect(role, redirectTo),
      },
    })
    setSending(false)

    if (error) {
      toast.error(error.message || 'Could not resend the verification email.')
      return
    }

    setSent(true)
    setCooldown(RESEND_COOLDOWN_SECONDS)
    toast.success('A new verification email has been sent.')
  }

  return (
    <div className={compact ? 'rounded-2xl border border-amber-200 bg-amber-50/80 p-4' : 'text-center'}>
      <div className={compact ? 'flex items-start gap-3' : ''}>
        <div className={compact
          ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700'
          : 'mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600'}
        >
          {sent ? <CheckCircle2 className={compact ? 'h-5 w-5' : 'h-8 w-8'} /> : <MailCheck className={compact ? 'h-5 w-5' : 'h-8 w-8'} />}
        </div>

        <div className={compact ? 'min-w-0 flex-1' : ''}>
          <h2 className={compact ? 'font-semibold text-slate-900' : 'mt-5 text-2xl font-bold tracking-tight text-slate-950'}>
            {sent ? 'Verification email sent' : 'Check your inbox'}
          </h2>
          <p className={compact ? 'mt-1 text-sm leading-6 text-slate-600' : 'mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600'}>
            We sent an activation link to <strong className="font-semibold text-slate-900">{normalizedEmail || 'your email'}</strong>.
            Open the link, then return to sign in.
          </p>
        </div>
      </div>

      {!compact && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
          <div className="flex gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800">The link may take a minute to arrive</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Check your Spam or Promotions folder. Verification links are single-use.</p>
            </div>
          </div>
        </div>
      )}

      <div className={compact ? 'mt-4' : 'mt-6'}>
        <Label htmlFor={`verification-email-${role}`} className="sr-only">Email address</Label>
        <Input
          id={`verification-email-${role}`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setSent(false)
          }}
          placeholder="you@example.com"
          className="h-11 rounded-xl border-slate-200 bg-white"
        />
      </div>

      <div className={compact ? 'mt-3 flex flex-col gap-2 sm:flex-row' : 'mt-4 grid gap-3'}>
        <Button
          type="button"
          className="h-11 rounded-xl"
          onClick={resend}
          disabled={sending || cooldown > 0 || !validEmail}
        >
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
        </Button>

        {onBack && (
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onBack}>
            Back to sign in
          </Button>
        )}
      </div>
    </div>
  )
}
