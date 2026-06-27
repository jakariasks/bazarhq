import { Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Store } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/logo'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { AuthCaptcha } from '@/components/auth-captcha'
import { validateRealEmail } from '@/lib/email-validation'
import {
  MERCHANT_OAUTH_INTENT_KEY,
  ROLE_CUSTOMER,
  ROLE_MERCHANT,
  clearAllRoleIntents,
  getUserRole,
  setStoredIntent,
} from '@/lib/auth-roles'

async function hasMerchantRecord(userId) {
  if (!userId) return false

  const [{ data: profile }, { data: store }] = await Promise.all([
    supabase.from('profiles').select('id').eq('id', userId).maybeSingle(),
    supabase.from('stores').select('id').eq('owner_id', userId).limit(1).maybeSingle(),
  ])

  return !!profile || !!store
}

async function ensureMerchantProfile(user) {
  if (!user?.id || !user?.email) return

  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0]

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email.toLowerCase(),
      full_name: fullName,
      plan_tier: 'free',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

  if (error) console.warn('Profile upsert failed:', error.message)
}

async function assertMerchantAccount(user) {
  const role = getUserRole(user)

  if (role === ROLE_CUSTOMER) {
    throw new Error('This email is registered as a customer account.')
  }

  if (role === ROLE_MERCHANT) {
    await ensureMerchantProfile(user)
    return
  }

  const hasRecord = await hasMerchantRecord(user?.id)
  if (!hasRecord) {
    throw new Error('No merchant account found for this email.')
  }

  await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      role: ROLE_MERCHANT,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Merchant',
      signup_method: user.user_metadata?.signup_method || 'email',
    },
  })

  await ensureMerchantProfile(user)
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  )
}

function AuthShell({ children }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.12),transparent_35%),linear-gradient(180deg,#f8fafc_0%,#ffffff_48%,#f6f8fb_100%)] p-4">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        {children}
      </motion.div>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    if (user) navigate({ to: '/merchant' })
  }, [user, navigate])

  const emailCheck = useMemo(() => validateRealEmail(email), [email])

  const resetCaptcha = useCallback(() => {
    setCaptchaToken('')
    setCaptchaResetKey((value) => value + 1)
  }, [])

  const submitEmail = async (event) => {
    event.preventDefault()

    if (!emailCheck.ok) {
      toast.error(emailCheck.message)
      return
    }

    if (!captchaToken) {
      toast.error('Complete the robot check.')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailCheck.email,
      password,
      options: { captchaToken },
    })

    if (error) {
      setLoading(false)
      resetCaptcha()
      toast.error(error.message)
      return
    }

    try {
      await assertMerchantAccount(data.user)
    } catch (err) {
      await supabase.auth.signOut()
      setLoading(false)
      resetCaptcha()
      toast.error(err.message || 'This account cannot access merchant dashboard.')
      return
    }

    setLoading(false)
    navigate({ to: '/merchant' })
  }

  const signInWithGoogle = async () => {
    setGoogleLoading(true)
    await supabase.auth.signOut()
    clearAllRoleIntents()
    setStoredIntent(MERCHANT_OAUTH_INTENT_KEY, { redirectTo: '/merchant' })

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/merchant`,
        queryParams: { prompt: 'select_account' },
      },
    })

    if (error) {
      clearAllRoleIntents()
      toast.error(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="mb-6 flex justify-center">
        <Logo size="lg" />
      </div>

      <div className="rounded-[2rem] border border-border/80 bg-card/95 p-6 text-card-foreground shadow-xl shadow-slate-200/70 backdrop-blur sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Store className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Merchant dashboard</p>
        </div>

        <Button type="button" variant="outline" className="h-11 w-full gap-2 rounded-xl" onClick={signInWithGoogle} disabled={googleLoading || loading}>
          {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </Button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submitEmail} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-1 h-11 rounded-xl" />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot?</Link>
            </div>
            <div className="relative mt-1">
              <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required className="h-11 rounded-xl pr-10" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <AuthCaptcha key={captchaResetKey} resetKey={captchaResetKey} onVerify={setCaptchaToken} />

          <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading || googleLoading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here?{' '}
          <Link to="/signup" className="font-semibold text-primary hover:underline">Create account</Link>
        </p>
      </div>
    </AuthShell>
  )
}
