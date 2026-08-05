import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, ShoppingBag, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthPageShell } from '@/components/auth-page-shell'
import { ResendVerificationCard } from '@/components/resend-verification-card'
import { useCustomerAuth } from '@/hooks/use-customer-auth'

function getRedirectTo() {
  const redirect = new URLSearchParams(window.location.search).get('redirect')
  return redirect?.startsWith('/') && !redirect.startsWith('//') ? redirect : '/customer/account'
}

function isEmailNotConfirmedError(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('email not confirmed') || message.includes('email_not_confirmed') || message.includes('verify your email')
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

export default function CustomerLoginPage() {
  const {
    customer,
    rawUser,
    loading: authLoading,
    activateCustomerRole,
    signIn,
    signInWithGoogle,
    signOut,
  } = useCustomerAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [verificationMode, setVerificationMode] = useState(false)

  const redirectTo = getRedirectTo()
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const verifiedNotice = params.get('verified') === '1'
  const signupSearch = redirectTo !== '/customer/account' ? { redirect: redirectTo } : {}

  useEffect(() => {
    if (!authLoading && customer) window.location.assign(redirectTo)
  }, [authLoading, customer, redirectTo])

  async function addCustomerToCurrentAccount() {
    setError('')
    setLoading(true)
    try {
      await activateCustomerRole({
        fullName: rawUser?.user_metadata?.full_name || rawUser?.user_metadata?.name,
        phone: rawUser?.user_metadata?.phone,
      })
      window.location.assign(redirectTo)
    } catch (activationError) {
      if (isEmailNotConfirmedError(activationError)) {
        setEmail(rawUser?.email || '')
        setVerificationMode(true)
      } else {
        setError(activationError?.message || 'Customer access could not be added.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn({ email, password })
      window.location.assign(redirectTo)
    } catch (loginError) {
      if (isEmailNotConfirmedError(loginError)) setVerificationMode(true)
      else setError(loginError.message || 'Login failed. Check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle(redirectTo)
    } catch (googleError) {
      setError(googleError.message || 'Google login failed. Please try again.')
      setGoogleLoading(false)
    }
  }

  if (authLoading) {
    return (
      <AuthPageShell audience="customer" title="Your BazarHQ account is loading." description="Checking your secure session and account access.">
        <div className="py-10 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-sky-600" /><p className="mt-4 text-sm text-slate-600">Checking your account...</p></div>
      </AuthPageShell>
    )
  }

  if (rawUser && !customer && !verificationMode) {
    return (
      <AuthPageShell
        audience="customer"
        eyebrow="One BazarHQ account"
        title="Shop with your existing merchant login."
        description="Add Customer access to the same email without changing your merchant store or dashboard."
        points={['Keep your merchant profile', 'Add order history and saved addresses', 'Switch roles without signing out']}
        backTo="/shop"
        backLabel="Browse stores"
      >
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><ShoppingBag className="h-8 w-8" /></div>
          <h1 className="mt-5 text-2xl font-black text-slate-950">Add Customer access</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600"><strong className="text-slate-900">{rawUser.email}</strong> is already signed in. Use this same account for shopping.</p>
          {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <Button className="mt-6 h-12 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={addCustomerToCurrentAccount} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingBag className="mr-2 h-4 w-4" />}Add Customer access</Button>
          <Button variant="outline" className="mt-3 h-12 w-full rounded-xl" onClick={() => window.location.assign('/merchant')}><Store className="mr-2 h-4 w-4" />Return to merchant dashboard</Button>
          <button type="button" className="mt-5 text-sm font-semibold text-slate-600 hover:text-slate-950" onClick={async () => { await signOut(); window.location.reload() }}>Use another email</button>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell
      audience="customer"
      eyebrow="BazarHQ Customer"
      title="Your orders, addresses, and stores in one place."
      description="Sign in with any BazarHQ account. Merchant accounts can add Customer access automatically."
      points={['One login for shopping and selling', 'Order history across all stores', 'Up to three saved delivery addresses']}
      backTo="/shop"
      backLabel="Browse stores"
    >
      {verificationMode ? (
        <ResendVerificationCard defaultEmail={email || rawUser?.email || ''} role="customer" redirectTo={redirectTo} onBack={() => setVerificationMode(false)} />
      ) : (
        <>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600"><ShoppingBag className="h-6 w-6" /></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">Customer account</p><h1 className="mt-1 text-3xl font-black tracking-[-0.035em] text-slate-950">Welcome back</h1><p className="mt-1 text-sm leading-6 text-slate-600">The same email can also run a merchant store.</p></div>
          </div>

          {verifiedNotice && <div className="mt-6 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status"><Mail className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>Email verified.</strong> Your account is ready.</div></div>}

          <Button type="button" variant="outline" className="mt-6 h-12 w-full gap-2 rounded-xl border-slate-200" onClick={handleGoogleLogin} disabled={googleLoading || loading}>{googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}Continue with Google</Button>
          <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200" /><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">or use email</span><div className="h-px flex-1 bg-slate-200" /></div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div><Label htmlFor="customer-email" className="text-slate-700">Email address</Label><div className="relative mt-1.5"><Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="customer-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required className="h-12 rounded-xl border-slate-200 pl-10" /></div></div>
            <div><div className="flex items-center justify-between"><Label htmlFor="customer-password" className="text-slate-700">Password</Label><Link to="/forgot-password" className="text-xs font-semibold text-sky-700 hover:underline">Forgot password?</Link></div><div className="relative mt-1.5"><LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="customer-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required className="h-12 rounded-xl border-slate-200 px-10" /><button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
            {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700" role="alert">{error}</div>}
            <Button type="submit" className="h-12 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800" disabled={loading || googleLoading || !email || !password}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing customer access...</> : 'Continue as customer'}</Button>
          </form>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-600">New to BazarHQ? <Link to="/customer/signup" search={signupSearch} className="font-bold text-sky-700 hover:underline">Create or add Customer access</Link></div>
          <p className="mt-4 text-center text-xs text-slate-500">Selling on BazarHQ? <Link to="/login" className="font-semibold text-slate-700 hover:underline">Merchant access</Link></p>
        </>
      )}
    </AuthPageShell>
  )
}
