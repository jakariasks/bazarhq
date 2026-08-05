import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, Mail, Phone, ShoppingBag, UserRound, XCircle } from 'lucide-react'
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

function Rule({ ok, children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-emerald-700' : 'text-slate-400'}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {children}
    </span>
  )
}

export default function CustomerSignupPage() {
  const { signUp, signInWithGoogle } = useCustomerAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [verificationMode, setVerificationMode] = useState(false)

  const redirectTo = getRedirectTo()
  const loginSearch = redirectTo !== '/customer/account' ? { redirect: redirectTo } : {}
  const passwordHasLength = password.length >= 8
  const passwordHasNumber = /\d/.test(password)
  const passwordsMatch = password.length > 0 && password === confirmPassword
  const phoneIsValid = !phone || /^01[3-9]\d{8}$/.test(phone)
  const formReady = fullName.trim().length >= 2 && email.trim() && passwordHasLength && passwordHasNumber && passwordsMatch && phoneIsValid

  async function handleSignup(event) {
    event.preventDefault()
    if (!formReady) {
      setError('Complete all required fields and password rules.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const data = await signUp({ email, password, fullName, phone, redirectTo })
      if (data.user?.identities && data.user.identities.length === 0) {
        setError('This email is already registered. Sign in or reset your password.')
        return
      }
      if (data.session) {
        window.location.assign(redirectTo)
        return
      }
      setVerificationMode(true)
    } catch (signupError) {
      const message = String(signupError.message || '')
      setError(message.toLowerCase().includes('already')
        ? 'This email is already registered. Sign in or reset your password.'
        : message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignup() {
    setError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle(redirectTo)
    } catch (googleError) {
      setError(googleError.message || 'Google registration failed. Please try again.')
      setGoogleLoading(false)
    }
  }

  return (
    <AuthPageShell
      audience="customer"
      eyebrow="BazarHQ Customer"
      title="Create one account for every BazarHQ store."
      description="Save delivery addresses, complete checkout faster, and keep your order history together."
      points={['One account across every store', 'Protected authenticated checkout', 'Secure order history and tracking']}
      backTo="/shop"
      backLabel="Browse stores"
    >
      {verificationMode ? (
        <ResendVerificationCard
          defaultEmail={email}
          role="customer"
          redirectTo={redirectTo}
          onBack={() => setVerificationMode(false)}
        />
      ) : (
        <>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">Customer registration</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.035em] text-slate-950">Create your account</h1>
              <p className="mt-1 text-sm leading-6 text-slate-600">Your cart and prepared checkout will remain available.</p>
            </div>
          </div>

          <Button type="button" variant="outline" className="mt-6 h-12 w-full gap-2 rounded-xl border-slate-200" onClick={handleGoogleSignup} disabled={googleLoading || loading}>
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">or use email</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <Label htmlFor="customer-name" className="text-slate-700">Full name</Label>
              <div className="relative mt-1.5">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="customer-name" autoComplete="name" placeholder="Your full name" value={fullName} onChange={(event) => setFullName(event.target.value)} required className="h-12 rounded-xl border-slate-200 pl-10" />
              </div>
            </div>

            <div>
              <Label htmlFor="customer-phone" className="text-slate-700">Phone number <span className="font-normal text-slate-400">(optional)</span></Label>
              <div className="relative mt-1.5">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="customer-phone" type="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\s/g, ''))} className="h-12 rounded-xl border-slate-200 pl-10" />
              </div>
              {!phoneIsValid && <p className="mt-1.5 text-xs font-medium text-red-600">Enter a valid Bangladesh mobile number.</p>}
            </div>

            <div>
              <Label htmlFor="customer-signup-email" className="text-slate-700">Email address</Label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="customer-signup-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required className="h-12 rounded-xl border-slate-200 pl-10" />
              </div>
            </div>

            <div>
              <Label htmlFor="customer-signup-password" className="text-slate-700">Password</Label>
              <div className="relative mt-1.5">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="customer-signup-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Create a strong password" value={password} onChange={(event) => setPassword(event.target.value)} required className="h-12 rounded-xl border-slate-200 px-10" />
                <button type="button" className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                  <Rule ok={passwordHasLength}>8+ characters</Rule>
                  <Rule ok={passwordHasNumber}>At least one number</Rule>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="customer-confirm-password" className="text-slate-700">Confirm password</Label>
              <Input id="customer-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Repeat your password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required className="mt-1.5 h-12 rounded-xl border-slate-200" />
              {confirmPassword && <div className="mt-2"><Rule ok={passwordsMatch}>Passwords match</Rule></div>}
            </div>

            {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700" role="alert">{error}</div>}

            <Button type="submit" className="h-12 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800" disabled={!formReady || loading || googleLoading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</> : 'Create customer account'}
            </Button>
          </form>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/customer/login" search={loginSearch} className="font-bold text-sky-700 hover:underline">Sign in</Link>
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            Want to sell? <Link to="/signup" className="font-semibold text-slate-700 hover:underline">Create a merchant account</Link>
          </p>
        </>
      )}
    </AuthPageShell>
  )
}
