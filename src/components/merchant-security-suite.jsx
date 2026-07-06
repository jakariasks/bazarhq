import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, KeyRound, Loader2, LogOut, Mail, Monitor, Shield, ShieldCheck, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { generateRecoveryCodes, listMerchantSessions, revokeTrackedSession, saveRecoveryCodes, trackMerchantSession } from '@/lib/merchant-security-api'

function Card({ title, desc, icon: Icon, children, action }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            {desc && <p className="mt-1 text-sm leading-6 text-muted-foreground">{desc}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function MerchantSecuritySuite({ user, onSignedOut }) {
  const isGoogleUser = user?.app_metadata?.provider === 'google'
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  const [factors, setFactors] = useState([])
  const [mfaLoading, setMfaLoading] = useState(false)
  const [enrollData, setEnrollData] = useState(null)
  const [totpCode, setTotpCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState([])

  const [sessions, setSessions] = useState([])
  const [sessionLoading, setSessionLoading] = useState(false)

  const passwordValid = newPwd.length >= 8 && /\d/.test(newPwd)
  const passwordMatch = confirmPwd && newPwd === confirmPwd
  const verifiedTotp = useMemo(() => factors.find((factor) => factor.factor_type === 'totp' && factor.status === 'verified'), [factors])

  const loadMfa = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      setFactors([...(data?.totp || []), ...(data?.phone || [])])
    } catch (error) {
      console.warn('MFA load failed:', error.message)
    }
  }

  const loadSessions = async () => {
    if (!user?.id) return
    setSessionLoading(true)
    try {
      await trackMerchantSession(user)
      setSessions(await listMerchantSessions(user.id))
    } catch (error) {
      toast.error(error?.message || 'Could not load sessions.')
    } finally {
      setSessionLoading(false)
    }
  }

  useEffect(() => {
    loadMfa()
    loadSessions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const changePassword = async () => {
    if (isGoogleUser) return toast.error('Google accounts use Google password settings.')
    if (!passwordValid) return toast.error('Password must be at least 8 characters and contain a number.')
    if (!passwordMatch) return toast.error('Passwords do not match.')

    setPasswordLoading(true)
    try {
      // Verify current password first so accidental changes are blocked.
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPwd })
      if (verifyError) throw new Error('Current password is incorrect.')

      const { error } = await supabase.auth.updateUser({ password: newPwd })
      if (error) throw error

      toast.success('Password changed. All sessions are being terminated.')
      await supabase.auth.signOut({ scope: 'global' }).catch(() => supabase.auth.signOut())
      onSignedOut?.()
      window.location.href = '/login'
    } catch (error) {
      toast.error(error?.message || 'Could not update password.')
    } finally {
      setPasswordLoading(false)
    }
  }

  const requestEmailChange = async () => {
    const clean = newEmail.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(clean)) return toast.error('Enter a valid email address.')
    if (clean === user?.email?.toLowerCase()) return toast.error('This is already your current email.')

    setEmailLoading(true)
    try {
      const { error } = await supabase.auth.updateUser(
        { email: clean },
        { emailRedirectTo: `${window.location.origin}/merchant/settings` },
      )
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

  const startMfaEnroll = async () => {
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

  const verifyMfa = async () => {
    const factorId = enrollData?.id
    if (!factorId || totpCode.trim().length !== 6) return toast.error('Enter the 6-digit authenticator code.')
    setMfaLoading(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: totpCode.trim() })
      if (error) throw error
      const codes = generateRecoveryCodes(10)
      await saveRecoveryCodes(user.id, codes)
      setRecoveryCodes(codes)
      setEnrollData(null)
      setTotpCode('')
      await loadMfa()
      toast.success('Two-factor authentication enabled.')
    } catch (error) {
      toast.error(error?.message || 'Invalid code.')
    } finally {
      setMfaLoading(false)
    }
  }

  const disableMfa = async () => {
    if (!verifiedTotp) return
    setMfaLoading(true)
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedTotp.id })
      if (error) throw error
      await supabase.from('merchant_mfa_recovery_codes').update({ used_at: new Date().toISOString() }).eq('merchant_id', user.id).is('used_at', null)
      await loadMfa()
      toast.success('Two-factor authentication disabled.')
    } catch (error) {
      toast.error(error?.message || 'Could not disable 2FA.')
    } finally {
      setMfaLoading(false)
    }
  }

  const copyCodes = async () => {
    await navigator.clipboard.writeText(recoveryCodes.join('\n'))
    toast.success('Recovery codes copied.')
  }

  const revoke = async (session) => {
    try {
      await revokeTrackedSession(session.id)
      await loadSessions()
      toast.success('Session marked as revoked.')
    } catch (error) {
      toast.error(error?.message || 'Could not revoke session.')
    }
  }

  const signOutEverywhere = async () => {
    await supabase.auth.signOut({ scope: 'global' }).catch(() => supabase.auth.signOut())
    window.location.href = '/login'
  }

  return (
    <div className="space-y-5">
      <Card title="Change password" desc="Changing your password signs out all other sessions." icon={KeyRound}>
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
        desc="Use Google Authenticator, Authy, Microsoft Authenticator, or any TOTP app. Save recovery codes after setup."
        icon={Shield}
        action={verifiedTotp ? <Badge className="bg-success/10 text-success hover:bg-success/10">Enabled</Badge> : <Badge variant="secondary">Not enabled</Badge>}
      >
        {verifiedTotp ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">2FA is active for this merchant account.</div>
            <Button variant="destructive" onClick={disableMfa} disabled={mfaLoading} className="gap-2 rounded-xl"><Trash2 className="h-4 w-4" /> Disable 2FA</Button>
          </div>
        ) : (
          <Button onClick={startMfaEnroll} disabled={mfaLoading} className="gap-2 rounded-xl">
            {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />} Enable 2FA
          </Button>
        )}
      </Card>

      <Card title="Active sessions" desc="Known devices that recently used this merchant dashboard." icon={Monitor} action={<Button variant="outline" size="sm" onClick={loadSessions} disabled={sessionLoading}>Refresh</Button>}>
        <div className="divide-y divide-border rounded-2xl border border-border">
          {sessions.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No tracked sessions yet.</div>
          ) : sessions.map((session) => (
            <div key={session.id} className="flex items-center gap-3 p-4">
              <Monitor className="h-5 w-5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{session.device_label || 'Unknown device'}</div>
                <div className="text-xs text-muted-foreground">Last seen {new Date(session.last_seen_at).toLocaleString()}</div>
              </div>
              {session.revoked_at ? <Badge variant="secondary">Revoked</Badge> : <Button variant="ghost" size="sm" onClick={() => revoke(session)} className="text-destructive">Revoke</Button>}
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
            <Button onClick={verifyMfa} disabled={mfaLoading || totpCode.length !== 6} className="w-full rounded-xl">Verify and enable</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={recoveryCodes.length > 0} onOpenChange={(open) => !open && setRecoveryCodes([])}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Save your recovery codes</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Store these codes safely. They are shown only once.</p>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-3 font-mono text-sm">
            {recoveryCodes.map((code) => <div key={code}>{code}</div>)}
          </div>
          <Button onClick={copyCodes} className="gap-2 rounded-xl"><Copy className="h-4 w-4" /> Copy codes</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default MerchantSecuritySuite
