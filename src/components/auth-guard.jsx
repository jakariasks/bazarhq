// src/components/auth-guard.jsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { Loader2, Mail, RefreshCw, ShieldCheck, Store } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { MerchantMfaGate } from '@/components/merchant-mfa-gate'
import { clearAllRoleIntents, safeInternalPath } from '@/lib/auth-roles'

function merchantLoginUrl(pathname) {
  const redirect = safeInternalPath(pathname, '/merchant')
  return `/login?redirect=${encodeURIComponent(redirect)}&switched=customer`
}

function FullPageLoader({ title = 'Opening merchant sign-in', description = 'Please wait a moment.' }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-mesh p-4">
      <div className="pointer-events-none absolute -left-24 top-12 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-8 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative w-full max-w-md rounded-3xl border border-border/80 bg-card/95 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Store className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-primary" />
      </div>
    </div>
  )
}

export function AuthGuard({ children }) {
  const { user, loading, emailVerified, wrongRole, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [switchError, setSwitchError] = useState('')
  const switchingRef = useRef(false)

  const switchCustomerToMerchantLogin = useCallback(async () => {
    if (switchingRef.current) return
    switchingRef.current = true
    setSwitchError('')

    try {
      clearAllRoleIntents()

      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error && error.name !== 'AuthSessionMissingError') throw error

      window.location.replace(merchantLoginUrl(location.pathname))
    } catch (error) {
      switchingRef.current = false
      setSwitchError(error?.message || 'The current customer session could not be cleared.')
    }
  }, [location.pathname])

  useEffect(() => {
    if (!loading && !user && !wrongRole) {
      navigate({ to: '/login', search: { redirect: location.pathname }, replace: true })
    }
  }, [loading, user, wrongRole, navigate, location.pathname])

  useEffect(() => {
    if (!loading && wrongRole) {
      switchCustomerToMerchantLogin()
    }
  }, [loading, wrongRole, switchCustomerToMerchantLogin])

  if (loading) {
    return <FullPageLoader title="Checking your account" description="BazarHQ is confirming the current login session." />
  }

  if (wrongRole) {
    if (!switchError) {
      return (
        <FullPageLoader
          title="Switching to merchant sign-in"
          description="A customer session was active in this browser. It is being closed safely before merchant login opens."
        />
      )
    }

    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-mesh p-4">
        <div className="relative w-full max-w-md rounded-3xl border border-border/80 bg-card/95 p-8 text-center shadow-2xl backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold">Account switch paused</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{switchError}</p>
          <Button className="mt-6 w-full" onClick={switchCustomerToMerchantLogin}>
            Retry merchant sign-in
          </Button>
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={() => navigate({ to: '/shop' })}
          >
            Return to storefront
          </Button>
        </div>
      </div>
    )
  }

  if (!user) return null

  if (!emailVerified) {
    const handleResend = async () => {
      setResending(true)
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: { emailRedirectTo: `${window.location.origin}/merchant` },
      })
      setResending(false)

      if (error) {
        toast.error(error.message)
        return
      }

      setResent(true)
      toast.success('Verification email sent!')
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-mesh p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-elegant">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Verify your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a verification link to <strong className="text-foreground">{user.email}</strong>.
            <br />Please verify before accessing your dashboard.
          </p>
          {resent ? (
            <p className="mt-4 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
              ✓ Verification email sent. Check your inbox.
            </p>
          ) : (
            <Button onClick={handleResend} disabled={resending} variant="outline" className="mt-6 gap-2">
              {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Resend verification email
            </Button>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-4 block w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Already verified? Refresh this page
          </button>
          <button
            onClick={async () => {
              await signOut()
              navigate({ to: '/login' })
            }}
            className="mt-3 block w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Sign out and use a different account
          </button>
        </div>
      </div>
    )
  }

  return <MerchantMfaGate user={user}>{children}</MerchantMfaGate>
}
