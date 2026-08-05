import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { Loader2, Mail, RefreshCw, ShieldCheck, Store } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { MerchantMfaGate } from '@/components/merchant-mfa-gate'

function FullPageLoader({ title = 'Checking your account', description = 'BazarHQ is confirming your secure session.' }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-mesh p-4">
      <div className="pointer-events-none absolute -left-24 top-12 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-8 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative w-full max-w-md rounded-3xl border border-border/80 bg-card/95 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-primary" />
      </div>
    </div>
  )
}

export function AuthGuard({ children }) {
  const {
    user,
    rawUser,
    loading,
    roleError,
    emailVerified,
    wrongRole,
    activateMerchantRole,
    signOut,
  } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [activating, setActivating] = useState(false)
  const [activationError, setActivationError] = useState('')

  useEffect(() => {
    if (!loading && !rawUser) {
      navigate({ to: '/login', search: { redirect: location.pathname }, replace: true })
    }
  }, [loading, rawUser, navigate, location.pathname])

  if (loading) return <FullPageLoader />
  if (!rawUser) return null

  if (roleError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-mesh p-4">
        <div className="w-full max-w-md rounded-3xl border border-red-200 bg-card p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold">Account access could not be loaded</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{roleError}</p>
          <Button className="mt-6 w-full" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  if (!emailVerified) {
    const handleResend = async () => {
      setResending(true)
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: rawUser.email,
        options: { emailRedirectTo: `${window.location.origin}/login?verified=1&redirect=${encodeURIComponent(location.pathname)}` },
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
            We sent a verification link to <strong className="text-foreground">{rawUser.email}</strong>.
            <br />Verify it before accessing the merchant dashboard.
          </p>
          {resent ? (
            <p className="mt-4 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">✓ Verification email sent. Check your inbox.</p>
          ) : (
            <Button onClick={handleResend} disabled={resending} variant="outline" className="mt-6 gap-2">
              {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Resend verification email
            </Button>
          )}
          <button onClick={() => window.location.reload()} className="mt-4 block w-full text-center text-xs text-muted-foreground hover:text-foreground">
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


  if (wrongRole) {
    async function enableMerchantAccess() {
      setActivating(true)
      setActivationError('')
      try {
        await activateMerchantRole({
          fullName: rawUser.user_metadata?.full_name || rawUser.user_metadata?.name,
          phone: rawUser.user_metadata?.phone,
        })
        toast.success('Merchant access added to your BazarHQ account.')
      } catch (error) {
        setActivationError(error?.message || 'Merchant access could not be added.')
      } finally {
        setActivating(false)
      }
    }

    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-mesh p-4">
        <div className="relative w-full max-w-md rounded-3xl border border-border/80 bg-card/95 p-8 text-center shadow-2xl backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Store className="h-8 w-8" />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">One account, multiple roles</p>
          <h1 className="mt-2 text-2xl font-semibold">Add merchant access</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            <strong className="text-foreground">{rawUser.email}</strong> is already signed in. Add Merchant access to this same account without losing Customer orders, addresses, or checkout data.
          </p>
          {activationError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{activationError}</p>}
          <Button className="mt-6 w-full" onClick={enableMerchantAccess} disabled={activating}>
            {activating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Store className="mr-2 h-4 w-4" />}
            Add merchant access
          </Button>
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={async () => {
              await signOut()
              navigate({ to: '/login', search: { redirect: location.pathname }, replace: true })
            }}
          >
            Use a different account
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => navigate({ to: '/customer/account' })}>
            Continue as customer
          </Button>
        </div>
      </div>
    )
  }


  if (!user) return null

  return <MerchantMfaGate user={user}>{children}</MerchantMfaGate>
}
