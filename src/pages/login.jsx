import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck, Store } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthPageShell } from '@/components/auth-page-shell'
import { ResendVerificationCard } from '@/components/resend-verification-card'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { validateRealEmail } from '@/lib/email-validation'
import {
  MERCHANT_OAUTH_INTENT_KEY,
  ROLE_CUSTOMER,
  ROLE_MERCHANT,
  clearAllRoleIntents,
  getUserRole,
  safeInternalPath,
  setStoredIntent,
} from '@/lib/auth-roles'

function isEmailNotConfirmedError(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('email not confirmed') || message.includes('email_not_confirmed')
}

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
  const { error } = await supabase.from('profiles').upsert({
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

  if (role === ROLE_CUSTOMER) throw new Error('This email belongs to a customer account. Use customer sign in instead.')
  if (role === ROLE_MERCHANT) {
    await ensureMerchantProfile(user)
    return
  }

  if (!await hasMerchantRecord(user?.id)) throw new Error('No merchant account was found for this email address.')

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
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 0 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const { user, wrongRole, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [verificationMode, setVerificationMode] = useState(false)
  const [preparingMerchantLogin, setPreparingMerchantLogin] = useState(false)
  const [roleSwitchError, setRoleSwitchError] = useState('')
  const roleSwitchStartedRef = useRef(false)

  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const redirectTo = useMemo(() => safeInternalPath(params.get('redirect'), '/merchant'), [params])
  const verifiedNotice = params.get('verified') === '1'

  useEffect(() => {
    if (user) {
      navigate({ to: redirectTo, replace: true })
      return
    }

    if (authLoading || !wrongRole || roleSwitchStartedRef.current) return
    roleSwitchStartedRef.current = true
    setPreparingMerchantLogin(true)
    clearAllRoleIntents()

    supabase.auth.signOut({ scope: 'local' }).then(({ error }) => {
      if (error && error.name !== 'AuthSessionMissingError') {
        roleSwitchStartedRef.current = false
        setRoleSwitchError(error.message || 'Could not close the active customer session.')
      }
    }).catch((error) => {
      roleSwitchStartedRef.current = false
      setRoleSwitchError(error?.message || 'Could not close the active customer session.')
    }).finally(() => setPreparingMerchantLogin(false))
  }, [user, wrongRole, authLoading, navigate, redirectTo])

  const emailCheck = useMemo(() => validateRealEmail(email), [email])
  const formReady = emailCheck.ok && password.length > 0

  async function submitEmail(event) {
    event.preventDefault()
    if (!emailCheck.ok) {
      toast.error(emailCheck.message)
      return
    }

    setLoading(true)
    setRoleSwitchError('')
    clearAllRoleIntents()

    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
    if (signOutError && signOutError.name !== 'AuthSessionMissingError') {
      setLoading(false)
      toast.error('Could not clear the previous browser session. Please retry.')
      return
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailCheck.email,
      password,
    })

    if (error) {
      setLoading(false)
      if (isEmailNotConfirmedError(error)) {
        setVerificationMode(true)
        return
      }
      toast.error(error.message || 'Email or password is incorrect.')
      return
    }

    try {
      await assertMerchantAccount(data.user)
      navigate({ to: redirectTo, replace: true })
    } catch (error) {
      await supabase.auth.signOut({ scope: 'local' })
      toast.error(error.message || 'This account cannot access the merchant dashboard.')
    } finally {
      setLoading(false)
    }
  }

  async function signInWithGoogle() {
    setGoogleLoading(true)
    await supabase.auth.signOut({ scope: 'local' })
    clearAllRoleIntents()
    setStoredIntent(MERCHANT_OAUTH_INTENT_KEY, { redirectTo })

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${redirectTo}`,
        queryParams: { prompt: 'select_account' },
      },
    })

    if (error) {
      clearAllRoleIntents()
      toast.error(error.message)
      setGoogleLoading(false)
    }
  }

  if (authLoading || preparingMerchantLogin) {
    return (
      <AuthPageShell
        title="Run your store with confidence."
        description="Secure merchant access for products, orders, payments, analytics, and storefront operations."
      >
        <div className="py-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Preparing merchant sign in</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {wrongRole ? 'Closing the active customer session in this browser.' : 'Checking your secure session.'}
          </p>
          <Loader2 className="mx-auto mt-6 h-6 w-6 animate-spin text-emerald-600" />
        </div>
      </AuthPageShell>
    )
  }

  if (roleSwitchError) {
    return (
      <AuthPageShell title="Run your store with confidence." description="Secure merchant access for your BazarHQ business.">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Could not switch accounts</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{roleSwitchError}</p>
          <Button className="mt-6 h-11 w-full rounded-xl" onClick={() => window.location.reload()}>Retry</Button>
          <Button variant="outline" className="mt-3 h-11 w-full rounded-xl" onClick={() => navigate({ to: '/shop' })}>Go to storefront</Button>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell
      title="Run your business from one calm workspace."
      description="Manage products, orders, customers, analytics, payments, and your live storefront securely."
      points={['Role-protected merchant dashboard', 'Optional authenticator-based 2FA', 'Session and device security controls']}
    >
      {verificationMode ? (
        <ResendVerificationCard
          defaultEmail={email}
          role="merchant"
          redirectTo={redirectTo}
          onBack={() => setVerificationMode(false)}
        />
      ) : (
        <>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Merchant portal</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.035em] text-slate-950">Welcome back</h1>
              <p className="mt-1 text-sm leading-6 text-slate-600">Sign in to continue to your BazarHQ dashboard.</p>
            </div>
          </div>

          {verifiedNotice && (
            <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
              <Mail className="mt-0.5 h-5 w-5 shrink-0" />
              <div><strong>Email verified.</strong> You can now sign in to your merchant account.</div>
            </div>
          )}

          <Button type="button" variant="outline" className="mt-6 h-12 w-full gap-2 rounded-xl border-slate-200" onClick={signInWithGoogle} disabled={googleLoading || loading}>
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">or use email</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={submitEmail} className="space-y-4">
            <div>
              <Label htmlFor="merchant-email" className="text-slate-700">Email address</Label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="merchant-email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required className="h-12 rounded-xl border-slate-200 bg-white pl-10" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="merchant-password" className="text-slate-700">Password</Label>
                <Link to="/forgot-password" className="text-xs font-semibold text-emerald-700 hover:underline">Forgot password?</Link>
              </div>
              <div className="relative mt-1.5">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="merchant-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required className="h-12 rounded-xl border-slate-200 bg-white px-10" />
                <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="h-12 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800" disabled={!formReady || loading || googleLoading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in securely...</> : 'Sign in to dashboard'}
            </Button>
          </form>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-600">
            New to BazarHQ?{' '}
            <Link to="/signup" className="font-bold text-emerald-700 hover:underline">Create a merchant account</Link>
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            Shopping instead? <Link to="/customer/login" className="font-semibold text-slate-700 hover:underline">Customer sign in</Link>
          </p>
        </>
      )}
    </AuthPageShell>
  )
}
