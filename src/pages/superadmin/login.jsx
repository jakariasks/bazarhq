import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, Eye, EyeOff, Lock, Shield } from 'lucide-react'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { AuthCaptcha, isCaptchaConfigured } from '@/components/auth-captcha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SuperAdminLoginPage() {
  const navigate = useNavigate()
  const { login, completeTOTPLogin, isLoggedIn, loading } = useAdminAuth()

  const [email, setEmail] = useState('admin@bazarhq.com')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [step, setStep] = useState('credentials')
  const [challengeToken, setChallengeToken] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const captchaEnabled = isCaptchaConfigured()

  useEffect(() => {
    if (!loading && isLoggedIn) navigate({ to: '/superadmin' })
  }, [loading, isLoggedIn, navigate])

  function resetCaptcha() {
    setCaptchaToken('')
    setCaptchaResetKey((value) => value + 1)
  }

  async function handleCredentials(event) {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Enter admin email and password.')
      return
    }

    if (captchaEnabled && !captchaToken) {
      setError('Complete the security check first.')
      return
    }

    setSubmitting(true)
    try {
      const result = await login(email, password, '', captchaToken)
      if (result.requiresTOTP) {
        setChallengeToken(result.challengeToken)
        setStep('totp')
        setTotpCode('')
        return
      }
      if (result.success) navigate({ to: '/superadmin' })
    } catch (err) {
      setError(err.message || 'Admin sign in failed.')
      resetCaptcha()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTOTP(event) {
    event.preventDefault()
    setError('')

    if (!challengeToken) {
      setStep('credentials')
      setError('Security challenge expired. Sign in again.')
      return
    }

    setSubmitting(true)
    try {
      const result = await completeTOTPLogin(challengeToken, totpCode)
      if (result.success) navigate({ to: '/superadmin' })
    } catch (err) {
      setError(err.message || '2FA verification failed.')
      setTotpCode('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <div className="w-full">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 shadow-lg shadow-violet-900/50">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold">BazarHQ Admin</h1>
            <p className="mt-1 text-sm text-slate-400">Secure operations portal</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
            {step === 'credentials' && (
              <form onSubmit={handleCredentials} className="space-y-4">
                <div>
                  <Label className="text-sm text-slate-300">Admin Email</Label>
                  <Input type="email" autoComplete="email" autoFocus required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:border-violet-500" placeholder="admin@bazarhq.com" />
                </div>

                <div>
                  <Label className="text-sm text-slate-300">Password</Label>
                  <div className="relative mt-1">
                    <Input type={showPw ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="border-slate-700 bg-slate-800 pr-10 text-white placeholder:text-slate-500 focus:border-violet-500" placeholder="••••••••" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-300" onClick={() => setShowPw((value) => !value)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-2 text-slate-900">
                  <AuthCaptcha resetKey={captchaResetKey} onVerify={(token) => { setCaptchaToken(token || ''); if (token) setError('') }} />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-700 bg-red-900/30 px-3 py-2.5 text-sm text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="w-full bg-violet-600 font-semibold text-white hover:bg-violet-500" disabled={submitting || (captchaEnabled && !captchaToken)}>
                  {submitting ? 'Verifying…' : 'Sign In'}
                </Button>
              </form>
            )}

            {step === 'totp' && (
              <form onSubmit={handleTOTP} className="space-y-4">
                <div className="mb-2 text-center">
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-violet-900/50">
                    <Lock className="h-5 w-5 text-violet-300" />
                  </div>
                  <h2 className="font-semibold text-white">Two-Factor Authentication</h2>
                  <p className="mt-1 text-sm text-slate-400">Enter your authenticator code.</p>
                </div>

                <div>
                  <Label className="text-sm text-slate-300">Authenticator Code</Label>
                  <Input type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} autoFocus required value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="mt-1 border-slate-700 bg-slate-800 text-center font-mono text-xl tracking-[0.5em] text-white placeholder:text-slate-600 focus:border-violet-500" placeholder="000000" />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-700 bg-red-900/30 px-3 py-2.5 text-sm text-red-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="w-full bg-violet-600 font-semibold text-white hover:bg-violet-500" disabled={submitting || totpCode.length < 6}>
                  {submitting ? 'Verifying…' : 'Verify & Continue'}
                </Button>

                <button type="button" className="w-full text-sm text-slate-500 transition hover:text-slate-300" onClick={() => { setStep('credentials'); setChallengeToken(''); setTotpCode(''); setError(''); resetCaptcha() }}>
                  ← Back to sign in
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
