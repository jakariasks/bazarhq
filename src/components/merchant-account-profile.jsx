import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, Clock3, Loader2, Mail, Phone, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024

function normalizeBdPhone(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (/^01[3-9]\d{8}$/.test(digits)) return digits
  if (/^8801[3-9]\d{8}$/.test(digits)) return `0${digits.slice(3)}`
  return null
}

function dateTime(value) {
  if (!value) return ''
  try { return new Date(value).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' }) }
  catch { return '' }
}

export function MerchantAccountProfile({ user }) {
  const fileRef = useRef(null)
  const [profile, setProfile] = useState(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,email,full_name,phone,avatar_url,pending_email,email_change_requested_at,updated_at')
        .eq('id', user.id)
        .maybeSingle()
      if (error) throw error
      const row = data || {}
      setProfile(row)
      setFullName(row.full_name || user.user_metadata?.full_name || user.user_metadata?.name || '')
      setPhone(row.phone || user.user_metadata?.phone || '')
      setAvatarUrl(row.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || '')
    } catch (error) {
      toast.error(error?.message || 'Could not load account profile.')
    } finally {
      setLoading(false)
    }
  }, [user?.id, user?.user_metadata?.avatar_url, user?.user_metadata?.full_name, user?.user_metadata?.name, user?.user_metadata?.phone, user?.user_metadata?.picture])

  useEffect(() => { void load() }, [load])

  async function uploadAvatar(file) {
    if (!user?.id || !file) return
    if (!file.type?.startsWith('image/')) return toast.error('Choose an image file.')
    if (file.size > MAX_AVATAR_BYTES) return toast.error('Profile picture must be under 2 MB.')

    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg'
      const path = `${user.id}/profile/avatar-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('shop-branding')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('shop-branding').getPublicUrl(path)
      const url = data?.publicUrl || ''
      if (!url) throw new Error('Could not create profile picture URL.')
      setAvatarUrl(url)
      toast.success('Profile picture uploaded. Save profile to apply it.')
    } catch (error) {
      toast.error(error?.message || 'Could not upload profile picture.')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    const cleanName = fullName.trim()
    const cleanPhone = normalizeBdPhone(phone)
    if (!cleanName) return toast.error('Enter your full name.')
    if (cleanName.length > 120) return toast.error('Full name is too long.')
    if (phone.trim() && cleanPhone == null) return toast.error('Use a valid Bangladeshi mobile number, e.g. 017XXXXXXXX.')

    setSaving(true)
    try {
      const patch = {
        full_name: cleanName,
        phone: cleanPhone || null,
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      }
      const { error: profileError } = await supabase.from('profiles').update(patch).eq('id', user.id)
      if (profileError) throw profileError

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          ...(user.user_metadata || {}),
          full_name: cleanName,
          phone: cleanPhone || null,
          avatar_url: avatarUrl || null,
        },
      })
      if (authError) throw authError

      toast.success('Account profile updated.')
      await load()
    } catch (error) {
      toast.error(error?.message || 'Could not save account profile.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <section className="rounded-2xl border border-border bg-card p-6"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading account profile…</div></section>
  }

  const initial = (fullName || user?.email || '?').charAt(0).toUpperCase()
  const pendingMatchesCurrent = profile?.pending_email && profile.pending_email.toLowerCase() === user?.email?.toLowerCase()

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex items-center gap-4 lg:w-72 lg:flex-col lg:text-center">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border bg-muted text-3xl font-bold">
            {avatarUrl ? <img src={avatarUrl} alt="Merchant profile" className="h-full w-full object-cover" /> : initial}
            <button type="button" onClick={() => fileRef.current?.click()} className="absolute bottom-1 right-1 grid h-8 w-8 place-items-center rounded-full border bg-background shadow" title="Change profile picture">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
          </div>
          <input ref={fileRef} className="hidden" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && uploadAvatar(event.target.files[0])} />
          <div>
            <p className="font-semibold">{fullName || 'Merchant account'}</p>
            <p className="mt-1 text-xs text-muted-foreground">Profile picture maximum 2 MB</p>
          </div>
        </div>

        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Full name <span className="text-destructive">*</span></Label>
            <div className="relative mt-1"><UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} /></div>
          </div>
          <div>
            <Label>Phone</Label>
            <div className="relative mt-1"><Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="017XXXXXXXX" /></div>
          </div>
          <div className="sm:col-span-2">
            <Label>Current login email</Label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2.5 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{user?.email || profile?.email || '—'}</span><CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" /></div>
          </div>

          {profile?.pending_email && !pendingMatchesCurrent && (
            <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-start gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">Email change waiting for verification</p><p className="mt-1">Pending email: <strong>{profile.pending_email}</strong>{profile.email_change_requested_at ? ` · requested ${dateTime(profile.email_change_requested_at)}` : ''}</p><p className="mt-1 text-xs">The current email stays active until Supabase confirms the new address.</p></div></div>
            </div>
          )}

          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={save} disabled={saving || uploading}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save account profile</Button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default MerchantAccountProfile
