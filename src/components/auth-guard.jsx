import { useEffect } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { Loader2, Mail, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'

export function AuthGuard({ children }) {
  const { user, loading, emailVerified } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: '/login', search: { redirect: location.pathname } })
    }
  }, [loading, user])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) return null

  // SRS M1: block dashboard if email not verified
  if (!emailVerified) {
    const handleResend = async () => {
      setResending(true)
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: { emailRedirectTo: `${window.location.origin}/merchant` },
      })
      setResending(false)
      if (error) { toast.error(error.message); return }
      setResent(true)
      toast.success('Verification email sent!')
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-mesh p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Verify your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a verification link to{' '}
            <strong className="text-foreground">{user.email}</strong>.
            <br />Please verify before accessing your dashboard.
          </p>
          {resent ? (
            <p className="mt-4 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
              ✓ Verification email sent! Check your inbox.
            </p>
          ) : (
            <Button onClick={handleResend} disabled={resending} variant="outline" className="mt-6 gap-2">
              {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Resend verification email
            </Button>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Already verified?{' '}
            <button onClick={() => window.location.reload()} className="text-primary hover:underline">
              Click here to refresh
            </button>
          </p>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: '/login' }) }}
            className="mt-3 block w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Sign out and use a different account
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
