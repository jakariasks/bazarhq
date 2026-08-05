import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, KeyRound, Loader2, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
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
  recoverMfaWithCode,
} from '@/lib/merchant-security-api'

function verifiedTotp(data) {
  return [...(data?.totp || []), ...(data?.factors || [])]
    .find((factor) => factor.factor_type === 'totp' && factor.status === 'verified')
}

function GateCard({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-mesh p-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-elegant sm:p-8">{children}</div>
    </div>
  )
}

export function MerchantMfaGate({ user, children }) {
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('totp')
  const [factor, setFactor] = useState(null)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [recoveryRequired, setRecoveryRequired] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [enrollData, setEnrollData] = useState(null)
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [codesSaved, setCodesSaved] = useState(false)

  const cleanCode = useMemo(() => code.replace(/\s/g, '').toUpperCase(), [code])

  const inspect = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }, recovery] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
        getRecoveryStatus().catch(() => ({ recoveryRequired: false })),
      ])
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

      await heartbeatMerchantSession().catch((error) => {
        if (/revoked/i.test(error.message)) throw error
      })
      setAllowed(true)
    } catch (error) {
      if (/revoked|unauthorized/i.test(error?.message || '')) {
        await supabase.auth.signOut().catch(() => null)
        window.location.href = '/login'
        return
      }
      toast.error(error?.message || 'Could not verify account security.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { inspect() }, [inspect, user?.id])

  useEffect(() => {
    if (!allowed) return undefined
    const timer = window.setInterval(() => {
      heartbeatMerchantSession().then((data) => {
        if (data?.revoked) throw new Error('Session revoked')
      }).catch(async () => {
        await supabase.auth.signOut().catch(() => null)
        window.location.href = '/login'
      })
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [allowed])

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
      await supabase.auth.signOut({ scope: 'local' }).catch(() => supabase.auth.signOut())
      window.location.href = '/login'
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

  if (loading) return <GateCard><div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></GateCard>
  if (allowed) return <>{children}</>

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
        <Button variant="ghost" className="mt-2 w-full" onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}>Sign out</Button>
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
      <Button variant="ghost" className="mt-2 w-full" onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}>Sign out</Button>
    </GateCard>
  )
}
