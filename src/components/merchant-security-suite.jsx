import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, KeyRound, Loader2, LogOut, Mail, Monitor, RefreshCw, Shield, ShieldCheck, Smartphone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  completeMfaRecovery,
  generateRecoveryCodes,
  getRecoveryStatus,
  heartbeatMerchantSession,
  listMerchantSessions,
  revokeAllMerchantSessions,
  revokeMerchantSession,
} from '@/lib/merchant-security-api'

function Card({ title, desc, icon: Icon, children, action }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
          <div><h3 className="font-semibold">{title}</h3>{desc && <p className="mt-1 text-sm leading-6 text-muted-foreground">{desc}</p>}</div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function verifiedTotp(data) {
  return [...(data?.totp || []), ...(data?.factors || [])]
    .find((factor) => factor.factor_type === 'totp' && factor.status === 'verified')
}

function formatSeen(value) {
  if (!value) return 'Unknown'
  return new Date(value).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' })
}

export function MerchantSecuritySuite({ user, onSignedOut }) {
  const isGoogleUser = user?.app_metadata?.provider === 'google'
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  const [factor, setFactor] = useState(null)
  const [mfaLoading, setMfaLoading] = useState(false)
  const [enrollData, setEnrollData] = useState(null)
  const [totpCode, setTotpCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [unusedCodes, setUnusedCodes] = useState(0)
  const [recoveryRequired, setRecoveryRequired] = useState(false)

  const [sessions, setSessions] = useState([])
  const [sessionLoading, setSessionLoading] = useState(false)

  const passwordValid = newPwd.length >= 8 && /\d/.test(newPwd)
  const passwordMatch = confirmPwd && newPwd === confirmPwd
  const currentSession = useMemo(() => sessions.find((session) => session.current), [sessions])

  const loadMfa = useCallback(async () => {
    try {
      const [{ data, error }, recovery] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        getRecoveryStatus().catch(() => ({ unusedCodes: 0, recoveryRequired: false })),
      ])
      if (error) throw error
      setFactor(verifiedTotp(data) || null)
      setUnusedCodes(Number(recovery?.unusedCodes || 0))
      setRecoveryRequired(Boolean(recovery?.recoveryRequired))
    } catch (error) {
      console.warn('MFA load failed:', error?.message)
    }
  }, [])

  const loadSessions = useCallback(async () => {
    setSessionLoading(true)
    try {
      await heartbeatMerchantSession()
      const data = await listMerchantSessions()
      setSessions(data?.sessions || [])
    } catch (error) {
      toast.error(error?.message || 'Could not load sessions.')
    } finally {
      setSessionLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMfa()
    loadSessions()
  }, [loadMfa, loadSessions, user?.id])

  async function changePassword() {
    if (isGoogleUser) return toast.error('Google accounts use Google password settings.')
    if (!passwordValid) return toast.error('Password must be at least 8 characters and contain a number.')
    if (!passwordMatch) return toast.error('Passwords do not match.')
    setPasswordLoading(true)
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPwd })
      if (verifyError) throw new Error('Current password is incorrect.')
      const { error } = await supabase.auth.updateUser({ password: newPwd })
      if (error) throw error
      await revokeAllMerchantSessions().catch(() => null)
      toast.success('Password changed. All active sessions were invalidated.')
      await supabase.auth.signOut({ scope: 'global' }).catch(() => supabase.auth.signOut())
      onSignedOut?.()
      window.location.href = '/login'
    } catch (error) {
      toast.error(error?.message || 'Could not update password.')
    } finally {
      setPasswordLoading(false)
    }
  }

  async function requestEmailChange() {
    const clean = newEmail.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(clean)) return toast.error('Enter a valid email address.')
    if (clean === user?.email?.toLowerCase()) return toast.error('This is already your current email.')
    setEmailLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: clean }, { emailRedirectTo: `${window.location.origin}/merchant/settings` })
      if (error) throw error
      await supabase.from('profiles').update({ pending_email: clean, email_change_requested_at: new Date().toISOString() }).eq('id', user.id)
      toast.success('Verification links sent. Confirm the new email to complete the change.')
      setNewEmail('')
    } catch (error) {
      toast.error(error?.message || 'Could not start email change.')
    } finally {
      setEmailLoading(false)
    }
  }

  async function startMfaEnroll() {
    setMfaLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'BazarHQ merchant account' })
      if (error) throw error
      setEnrollData(data)
    } catch (error) {
      toast.error(error?.message || 'Could not start 2FA setup.')
    } finally {
      setMfaLoading(false)
    }
  }

  async function showNewRecoveryCodes() {
    setMfaLoading(true)
    try {
      const { data: assurance, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (error) throw error
      if (assurance?.currentLevel !== 'aal2') throw new Error('Re-authenticate with your authenticator, then try again.')
      const data = await generateRecoveryCodes()
      setRecoveryCodes(data?.codes || [])
      setUnusedCodes(data?.codes?.length || 0)
      toast.success('New recovery codes generated. Previous unused codes were invalidated.')
    } catch (error) {
      toast.error(error?.message || 'Could not generate recovery codes.')
    } finally {
      setMfaLoading(false)
    }
  }

  async function verifyMfa() {
    if (!enrollData?.id || !/^\d{6}$/.test(totpCode)) return toast.error('Enter the 6-digit authenticator code.')
    setMfaLoading(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollData.id, code: totpCode })
      if (error) throw new Error('Invalid or expired authenticator code.')
      if (recoveryRequired) await completeMfaRecovery()
      const data = await generateRecoveryCodes()
      setRecoveryCodes(data?.codes || [])
      setUnusedCodes(data?.codes?.length || 0)
      setEnrollData(null)
      setTotpCode('')
      setRecoveryRequired(false)
      await loadMfa()
      toast.success('Two-factor authentication enabled.')
    } catch (error) {
      toast.error(error?.message || 'Invalid authenticator code.')
    } finally {
      setMfaLoading(false)
    }
  }

  async function disableMfa() {
    if (!factor) return
    setMfaLoading(true)
    try {
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assurance?.currentLevel !== 'aal2') throw new Error('Verify your authenticator at login before disabling 2FA.')
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
      if (error) throw error
      setFactor(null)
      setUnusedCodes(0)
      toast.success('Two-factor authentication disabled.')
    } catch (error) {
      toast.error(error?.message || 'Could not disable 2FA.')
    } finally {
      setMfaLoading(false)
    }
  }

  async function copyCodes() {
    await navigator.clipboard.writeText(recoveryCodes.join('\n'))
    toast.success('Recovery codes copied.')
  }

  async function revoke(session) {
    try {
      const data = await revokeMerchantSession(session.id)
      if (data?.revokedCurrent) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => supabase.auth.signOut())
        window.location.href = '/login'
        return
      }
      await loadSessions()
      toast.success('The device session was revoked immediately for merchant data access.')
    } catch (error) {
      toast.error(error?.message || 'Could not revoke session.')
    }
  }

  async function signOutEverywhere() {
    try { await revokeAllMerchantSessions() } catch { /* global sign-out below remains */ }
    await supabase.auth.signOut({ scope: 'global' }).catch(() => supabase.auth.signOut())
    window.location.href = '/login'
  }

  return (
    <div className="space-y-5">
      <Card title="Change password" desc="A successful password change invalidates every registered merchant session." icon={KeyRound}>
        {isGoogleUser ? (
          <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">This account uses Google sign-in. Change your password from your Google account.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Current password</Label><Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} className="mt-1 rounded-xl" /></div>
            <div><Label>New password</Label><Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="mt-1 rounded-xl" /><p className="mt-1 text-xs text-muted-foreground">Minimum 8 characters and 1 number.</p></div>
            <div><Label>Confirm password</Label><Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} className="mt-1 rounded-xl" /></div>
            <Button onClick={changePassword} disabled={passwordLoading || !currentPwd || !passwordValid || !passwordMatch} className="gap-2 rounded-xl sm:col-span-2 sm:w-fit">
              {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Update password
            </Button>
          </div>
        )}
      </Card>

      <Card title="Email change verification" desc="Your new email must be verified before it becomes active." icon={Mail}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new-email@example.com" className="rounded-xl" />
          <Button onClick={requestEmailChange} disabled={emailLoading || !newEmail.trim()} className="gap-2 rounded-xl whitespace-nowrap">
            {emailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send verification
          </Button>
        </div>
      </Card>

      <Card
        title="Two-factor authentication"
        desc="TOTP is required at merchant login after enrollment. Recovery codes are single-use and each regeneration invalidates all previous unused codes."
        icon={Shield}
        action={factor ? <Badge className="bg-success/10 text-success hover:bg-success/10">Enabled</Badge> : recoveryRequired ? <Badge className="bg-amber-500/10 text-amber-700">Re-enrollment required</Badge> : <Badge variant="secondary">Not enabled</Badge>}
      >
        {factor ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-medium">Authenticator is active</p><p className="mt-1 text-xs text-muted-foreground">{unusedCodes} unused recovery code{unusedCodes === 1 ? '' : 's'} remain.</p></div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={showNewRecoveryCodes} disabled={mfaLoading} className="gap-2"><RefreshCw className="h-4 w-4" /> Regenerate codes</Button>
                <Button variant="destructive" onClick={disableMfa} disabled={mfaLoading} className="gap-2"><Trash2 className="h-4 w-4" /> Disable 2FA</Button>
              </div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Lost the authenticator? Sign out, sign in with email/password, then choose <strong>Recovery code</strong> at the two-factor prompt. A used code is invalidated and you must enroll a new authenticator.</p>
          </div>
        ) : (
          <Button onClick={startMfaEnroll} disabled={mfaLoading} className="gap-2 rounded-xl">
            {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />} {recoveryRequired ? 'Enroll replacement authenticator' : 'Enable 2FA'}
          </Button>
        )}
      </Card>

      <Card title="Active sessions" desc="Sessions are registered from the Supabase JWT session ID and enriched with current device, browser, IP and activity time." icon={Monitor} action={<Button variant="outline" size="sm" onClick={loadSessions} disabled={sessionLoading} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>}>
        {currentSession && <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm"><strong>Current device:</strong> {currentSession.device_label || 'This device'}</div>}
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {sessionLoading && sessions.length === 0 ? (
            <div className="flex items-center justify-center p-6 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading sessions…</div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No registered sessions yet.</div>
          ) : sessions.map((session) => (
            <div key={session.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <Monitor className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-medium">{session.device_label || 'Unknown device'}</span>{session.current && <Badge variant="secondary">Current</Badge>}{session.revoked_at && <Badge variant="secondary" className="text-destructive">Revoked</Badge>}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">{[session.browser_name, session.os_name, session.ip_address].filter(Boolean).join(' · ') || 'Device details unavailable'}<br />Last active: {formatSeen(session.last_seen_at)}</div>
              </div>
              {!session.revoked_at && <Button variant="ghost" size="sm" onClick={() => revoke(session)} className="text-destructive">{session.current ? 'Sign out' : 'Revoke'}</Button>}
            </div>
          ))}
        </div>
        <Button variant="outline" onClick={signOutEverywhere} className="mt-4 gap-2 rounded-xl text-destructive"><LogOut className="h-4 w-4" /> Sign out everywhere</Button>
      </Card>

      <Dialog open={!!enrollData} onOpenChange={(open) => !open && setEnrollData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Set up authenticator app</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {enrollData?.totp?.qr_code && <img src={enrollData.totp.qr_code} alt="2FA QR code" className="mx-auto h-52 w-52 rounded-2xl border bg-white p-3" />}
            {enrollData?.totp?.secret && <div className="rounded-xl bg-muted/50 p-3 text-center font-mono text-xs break-all">{enrollData.totp.secret}</div>}
            <Input value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" className="rounded-xl text-center text-lg tracking-[0.35em]" />
            <Button onClick={verifyMfa} disabled={mfaLoading || totpCode.length !== 6} className="w-full rounded-xl">{mfaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verify and enable</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={recoveryCodes.length > 0} onOpenChange={(open) => !open && setRecoveryCodes([])}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Save your recovery codes</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">These single-use codes are shown only once. Store them offline.</p>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-3 font-mono text-sm">{recoveryCodes.map((code) => <div key={code}>{code}</div>)}</div>
          <Button onClick={copyCodes} className="gap-2 rounded-xl"><Copy className="h-4 w-4" /> Copy codes</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default MerchantSecuritySuite
