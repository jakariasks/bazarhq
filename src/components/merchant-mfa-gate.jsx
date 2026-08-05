import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Copy, KeyRound, Loader2, LockKeyhole, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  completeMfaRecovery,
  generateRecoveryCodes,
  getRecoveryStatus,
  heartbeatMerchantSession,
  isMerchantAuthMissing,
  isMerchantSessionRevoked,
  recoverMfaWithCode,
} from '@/lib/merchant-security-api'

const HEARTBEAT_INTERVAL_MS = 120_000
const FAILURE_WARNING_THRESHOLD = 3
const SECURITY_CHECK_TIMEOUT_MS = 12_000
const HEARTBEAT_STARTUP_TIMEOUT_MS = 5_000

function withTimeout(promise, timeoutMs, message) {
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      const error = new Error(message)
      error.code = 'SECURITY_CHECK_TIMEOUT'
      reject(error)
    }, timeoutMs)
  })

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId))
}

function verifiedTotp(data) {
  return [...(data?.totp || []), ...(data?.factors || [])]
    .find((factor) => factor.factor_type === 'totp' && factor.status === 'verified')
}

function GateCard({ children }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-mesh px-4 py-10">
      <div className="pointer-events-none absolute -left-24 top-12 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-8 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative w-full max-w-md rounded-3xl border border-border/80 bg-card/95 p-7 shadow-2xl backdrop-blur sm:p-8">{children}</div>
    </div>
  )
}

const LOADING_STEPS = [
  { key: 'signin', label: 'Confirming your sign-in' },
  { key: 'security', label: 'Checking account security' },
  { key: 'dashboard', label: 'Preparing your dashboard' },
]

function SecureLoginLoading({ stage, slow }) {
  const activeIndex = Math.max(0, LOADING_STEPS.findIndex((item) => item.key === stage))

  return (
    <GateCard>
      <div role="status" aria-live="polite" className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
          <LockKeyhole className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Signing you in securely</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">BazarHQ is verifying your merchant session and security settings before opening the dashboard.</p>

        <div className="mt-7 space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4 text-left">
          {LOADING_STEPS.map((item, index) => {
            const complete = index < activeIndex
            const active = index === activeIndex
            return (
              <div key={item.key} className="flex items-center gap-3">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${complete ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : active ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}>
                  {complete ? <CheckCircle2 className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs font-semibold">{index + 1}</span>}
                </div>
                <span className={`text-sm ${active ? 'font-medium text-foreground' : complete ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</span>
              </div>
            )
          })}
        </div>

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-primary transition-all duration-500" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">This usually takes only a few seconds.</p>

        {slow && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-left text-xs leading-5 text-amber-900">
            This is taking a little longer than usual. A slow network or a cold-starting security function can cause a short delay. Your account is still safe.
          </div>
        )}
      </div>
    </GateCard>
  )
}

export function MerchantMfaGate({ user, children }) {
  const [loading, setLoading] = useState(true)
  const [loadingStage, setLoadingStage] = useState('signin')
  const [slowLoading, setSlowLoading] = useState(false)
  const [mode, setMode] = useState('totp')
  const [factor, setFactor] = useState(null)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [recoveryRequired, setRecoveryRequired] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [securityError, setSecurityError] = useState('')
  const [enrollData, setEnrollData] = useState(null)
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [codesSaved, setCodesSaved] = useState(false)
  const redirectingRef = useRef(false)
  const heartbeatFailuresRef = useRef(0)
  const heartbeatWarningShownRef = useRef(false)

  const cleanCode = useMemo(() => code.replace(/\s/g, '').toUpperCase(), [code])

  const redirectToLogin = useCallback(async () => {
    if (redirectingRef.current) return
    redirectingRef.current = true
    await supabase.auth.signOut({ scope: 'local' }).catch(() => supabase.auth.signOut().catch(() => null))
    window.location.replace('/login')
  }, [])

  const localSessionExists = useCallback(async () => {
    const { data } = await supabase.auth.getSession().catch(() => ({ data: null }))
    return Boolean(data?.session)
  }, [])

  const shouldEndSession = useCallback(async (error) => {
    if (isMerchantSessionRevoked(error)) return true
    if (!isMerchantAuthMissing(error)) return false
    return !(await localSessionExists())
  }, [localSessionExists])

  const inspect = useCallback(async () => {
    setLoading(true)
    setAllowed(false)
    setSecurityError('')
    setLoadingStage('signin')
    setSlowLoading(false)

    const stageSecurityTimer = window.setTimeout(() => setLoadingStage('security'), 700)
    const stageDashboardTimer = window.setTimeout(() => setLoadingStage('dashboard'), 2_100)
    const slowTimer = window.setTimeout(() => setSlowLoading(true), 4_500)

    try {
      const securityChecks = withTimeout(
        Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors(),
          getRecoveryStatus(),
        ]),
        SECURITY_CHECK_TIMEOUT_MS,
        'The merchant security check timed out. Please retry.',
      )

      // Session registration is useful but non-blocking. Running it in parallel
      // removes an unnecessary second wait after MFA checks finish.
      const heartbeatCheck = withTimeout(
        heartbeatMerchantSession({ force: true }),
        HEARTBEAT_STARTUP_TIMEOUT_MS,
        'Merchant session registration timed out.',
      ).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error }))

      const [securityResult, heartbeatResult] = await Promise.all([securityChecks, heartbeatCheck])
      const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }, recovery] = securityResult

      if (assuranceError) throw assuranceError
      if (factorsError) throw factorsError

      const totp = verifiedTotp(factors)
      setFactor(totp || null)
      setRecoveryRequired(Boolean(recovery?.recoveryRequired))

      if (totp && assurance?.currentLevel !== 'aal2') {
        setAllowed(false)
        setMode('totp')
        return
      }
      if (!totp && recovery?.recoveryRequired) {
        setAllowed(false)
        setMode('reenroll')
        return
      }

      if (heartbeatResult.error) {
        if (await shouldEndSession(heartbeatResult.error)) {
          await redirectToLogin()
          return
        }
        console.warn('Merchant session heartbeat is temporarily unavailable:', heartbeatResult.error?.message)
      } else {
        if (heartbeatResult.data?.revoked) {
          await redirectToLogin()
          return
        }
        heartbeatFailuresRef.current = 0
        heartbeatWarningShownRef.current = false
      }

      setLoadingStage('dashboard')
      setAllowed(true)
    } catch (error) {
      if (await shouldEndSession(error)) {
        await redirectToLogin()
        return
      }
      setAllowed(false)
      setSecurityError(error?.message || 'Account security could not be verified right now.')
    } finally {
      window.clearTimeout(stageSecurityTimer)
      window.clearTimeout(stageDashboardTimer)
      window.clearTimeout(slowTimer)
      setLoading(false)
    }
  }, [redirectToLogin, shouldEndSession])

  useEffect(() => { inspect() }, [inspect, user?.id])

  useEffect(() => {
    if (!allowed) return undefined

    let cancelled = false
    let timerId = null

    const schedule = () => {
      if (cancelled) return
      timerId = window.setTimeout(runHeartbeat, HEARTBEAT_INTERVAL_MS)
    }

    const runHeartbeat = async () => {
      if (cancelled) return
      if (document.visibilityState === 'hidden' || navigator.onLine === false) {
        schedule()
        return
      }

      try {
        const data = await heartbeatMerchantSession()
        if (data?.revoked) throw Object.assign(new Error('Session revoked'), { code: 'SESSION_REVOKED' })
        heartbeatFailuresRef.current = 0
        heartbeatWarningShownRef.current = false
      } catch (error) {
        if (await shouldEndSession(error)) {
          await redirectToLogin()
          return
        }

        heartbeatFailuresRef.current += 1
        console.warn('Merchant heartbeat failed without ending the local session:', error?.message)

        if (
          heartbeatFailuresRef.current >= FAILURE_WARNING_THRESHOLD &&
          !heartbeatWarningShownRef.current
        ) {
          heartbeatWarningShownRef.current = true
          toast.warning('Session status could not be refreshed. You are still signed in; BazarHQ will retry automatically.')
        }
      } finally {
        schedule()
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') heartbeatMerchantSession().catch(() => null)
    }
    const onOnline = () => heartbeatMerchantSession({ force: true }).catch(() => null)

    schedule()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)

    return () => {
      cancelled = true
      if (timerId) window.clearTimeout(timerId)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [allowed, redirectToLogin, shouldEndSession])

  async function verifyTotp() {
    if (!factor || !/^\d{6}$/.test(cleanCode)) return toast.error('Enter the 6-digit authenticator code.')
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: cleanCode })
      if (error) throw new Error('Invalid or expired authenticator code.')
      setCode('')
      await inspect()
      toast.success('Two-factor verification complete.')
    } catch (error) {
      toast.error(error?.message || 'Invalid authenticator code.')
    } finally {
      setSubmitting(false)
    }
  }

  async function useRecoveryCode() {
    if (!/^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(cleanCode)) return toast.error('Enter a recovery code such as ABCDE-23456.')
    setSubmitting(true)
    try {
      const data = await recoverMfaWithCode(cleanCode)
      toast.success(data?.message || 'Authenticator reset. Sign in again.')
      await redirectToLogin()
    } catch (error) {
      toast.error(error?.message || 'Invalid or already used recovery code.')
    } finally {
      setSubmitting(false)
    }
  }

  async function startReplacementEnrollment() {
    setSubmitting(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'BazarHQ replacement authenticator' })
      if (error) throw error
      setEnrollData(data)
      setCode('')
    } catch (error) {
      toast.error(error?.message || 'Could not start authenticator enrollment.')
    } finally {
      setSubmitting(false)
    }
  }

  async function verifyReplacementEnrollment() {
    if (!enrollData?.id || !/^\d{6}$/.test(cleanCode)) return toast.error('Enter the 6-digit authenticator code.')
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollData.id, code: cleanCode })
      if (error) throw new Error('Invalid or expired authenticator code.')
      await completeMfaRecovery()
      const generated = await generateRecoveryCodes()
      setRecoveryCodes(generated?.codes || [])
      setCodesSaved(false)
      setRecoveryRequired(false)
      setCode('')
      toast.success('Replacement authenticator verified. Save the new recovery codes.')
    } catch (error) {
      toast.error(error?.message || 'Could not verify the replacement authenticator.')
    } finally {
      setSubmitting(false)
    }
  }

  async function copyRecoveryCodes() {
    await navigator.clipboard.writeText(recoveryCodes.join('\n'))
    toast.success('Recovery codes copied.')
  }

  async function finishRecovery() {
    if (!codesSaved) return toast.error('Confirm that you saved the recovery codes.')
    setEnrollData(null)
    setRecoveryCodes([])
    await inspect()
  }

  if (loading) return <SecureLoginLoading stage={loadingStage} slow={slowLoading} />
  if (allowed) return <>{children}</>

  if (securityError) {
    return (
      <GateCard>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700"><AlertTriangle className="h-7 w-7" /></div>
        <h1 className="mt-5 text-center text-2xl font-semibold">Security check temporarily unavailable</h1>
        <p className="mt-2 text-center text-sm leading-6 text-muted-foreground">{securityError}</p>
        <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">Your account was not signed out. Retry after checking your internet connection.</p>
        <Button className="mt-6 w-full gap-2" onClick={inspect}><RefreshCw className="h-4 w-4" />Retry security check</Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={redirectToLogin}>Sign out</Button>
      </GateCard>
    )
  }

  if (mode === 'reenroll' || (!factor && recoveryRequired)) {
    return (
      <GateCard>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600"><RefreshCw className="h-7 w-7" /></div>
        <h1 className="mt-5 text-center text-2xl font-semibold">Set up a new authenticator</h1>
        <p className="mt-2 text-center text-sm leading-6 text-muted-foreground">A recovery code removed the previous factor. Complete replacement enrollment here before merchant data becomes available again.</p>

        {!enrollData ? (
          <Button className="mt-6 w-full gap-2" disabled={submitting} onClick={startReplacementEnrollment}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />} Start replacement setup
          </Button>
        ) : recoveryCodes.length === 0 ? (
          <div className="mt-6 space-y-4">
            {enrollData?.totp?.qr_code && <img src={enrollData.totp.qr_code} alt="Replacement authenticator QR code" className="mx-auto h-52 w-52 rounded-2xl border bg-white p-3" />}
            {enrollData?.totp?.secret && <div className="rounded-xl bg-muted/50 p-3 text-center font-mono text-xs break-all">{enrollData.totp.secret}</div>}
            <div className="grid gap-2"><Label>6-digit authenticator code</Label><Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" className="h-12 text-center font-mono text-lg tracking-[0.25em]" /></div>
            <Button className="w-full" disabled={submitting || cleanCode.length !== 6} onClick={verifyReplacementEnrollment}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verify replacement authenticator</Button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">These single-use recovery codes are shown only once. Store them offline.</div>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-3 font-mono text-sm">{recoveryCodes.map((item) => <div key={item}>{item}</div>)}</div>
            <Button variant="outline" className="w-full gap-2" onClick={copyRecoveryCodes}><Copy className="h-4 w-4" />Copy codes</Button>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={codesSaved} onChange={(event) => setCodesSaved(event.target.checked)} />I saved these recovery codes securely.</label>
            <Button className="w-full" disabled={!codesSaved} onClick={finishRecovery}>Continue to dashboard</Button>
          </div>
        )}
        <Button variant="ghost" className="mt-2 w-full" onClick={redirectToLogin}>Sign out</Button>
      </GateCard>
    )
  }

  return (
    <GateCard>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="h-7 w-7" /></div>
      <h1 className="mt-5 text-center text-2xl font-semibold">Two-factor verification</h1>
      <p className="mt-2 text-center text-sm leading-6 text-muted-foreground">Enter the current code from your authenticator app to continue to the merchant dashboard.</p>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
        <button className={`rounded-lg px-3 py-2 text-sm font-medium ${mode === 'totp' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`} onClick={() => { setMode('totp'); setCode('') }}>Authenticator</button>
        <button className={`rounded-lg px-3 py-2 text-sm font-medium ${mode === 'recovery' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`} onClick={() => { setMode('recovery'); setCode('') }}>Recovery code</button>
      </div>

      <div className="mt-5 grid gap-2">
        <Label>{mode === 'totp' ? '6-digit code' : 'Recovery code'}</Label>
        <Input autoFocus value={code} inputMode={mode === 'totp' ? 'numeric' : 'text'} maxLength={mode === 'totp' ? 6 : 11} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') mode === 'totp' ? verifyTotp() : useRecoveryCode() }} placeholder={mode === 'totp' ? '000000' : 'ABCDE-23456'} className="h-12 text-center font-mono text-lg tracking-[0.25em]" />
      </div>

      <Button className="mt-4 w-full gap-2" disabled={submitting} onClick={mode === 'totp' ? verifyTotp : useRecoveryCode}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'totp' ? <ShieldCheck className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
        {mode === 'totp' ? 'Verify and continue' : 'Reset authenticator'}
      </Button>
      <Button variant="ghost" className="mt-2 w-full" onClick={redirectToLogin}>Sign out</Button>
    </GateCard>
  )
}