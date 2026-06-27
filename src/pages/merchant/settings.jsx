import { useEffect, useRef, useState } from 'react'
import {
  Shield, Smartphone, Bell, Monitor, LogOut, Upload,
  Loader2, Image as ImageIcon, Globe, MessageCircle,
  Palette, Eye, EyeOff, Trash2, AlertTriangle, Key,
  Check, X, RefreshCw,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useCurrentStore } from '@/lib/use-current-store'
import { useQueryClient } from '@tanstack/react-query'

const CATEGORIES = ['Fashion & Apparel','Electronics','Grocery & Food','Beauty & Personal Care','Home & Living','Books & Stationery','Handmade & Crafts','Sports & Outdoors','Other']
const CURRENCIES = [{ v:'BDT', l:'BDT — Bangladeshi Taka' },{ v:'USD', l:'USD — US Dollar' },{ v:'EUR', l:'EUR — Euro' }]

function normalizeUrlList(value) {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean).slice(0, 4)
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(v => String(v || '').trim()).filter(Boolean).slice(0, 4)
    } catch {
      return value.split(',').map(v => v.trim()).filter(Boolean).slice(0, 4)
    }
  }
  return []
}

function padHeroUrls(value) {
  const list = normalizeUrlList(value)
  while (list.length < 4) list.push('')
  return list.slice(0, 4)
}

const EMPTY = {
  shop_name:'', business_category:'', tagline:'', description:'',
  contact_email:'', phone:'', whatsapp_number:'', website_url:'',
  address:'', city:'', currency:'BDT', brand_color:'#6366f1',
  facebook_handle:'', instagram_handle:'',
  hero_title:'', hero_subtitle:'', hero_banner_urls:['','','',''],
  about_title:'', about_image_url:'', about_mission:'',
  offer_enabled:true, offer_badge:'', offer_title:'', offer_subtitle:'', offer_button_text:'', offer_image_url:'',
}

const NOTIF_DEFAULTS = {
  new_order: true, low_stock: true, order_status: true,
  weekly_report: false, marketing: false,
  channel: 'email', // 'email' | 'sms' | 'both'
}

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { store, isLoading: storeLoading } = useCurrentStore()
  const qc = useQueryClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [logoUrl, setLogoUrl] = useState(null)
  const [bannerUrl, setBannerUrl] = useState(null)
  const [uploading, setUploading] = useState(null)
  const logoInput = useRef(null)
  const bannerInput = useRef(null)

  // Security
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd, setShowPwd] = useState({})
  const [pwdLoading, setPwdLoading] = useState(false)
  const isGoogleUser = user?.app_metadata?.provider === 'google'

  // Notification prefs
  const [notif, setNotif] = useState(NOTIF_DEFAULTS)
  const [notifSaving, setNotifSaving] = useState(false)

  // Account deletion
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deleting, setDeleting] = useState(false)
  const DELETE_PHRASE = 'DELETE MY ACCOUNT'

  useEffect(() => {
    if (storeLoading) return
    if (store) {
      setForm({
        shop_name: store.shop_name ?? '',
        business_category: store.business_category ?? '',
        tagline: store.tagline ?? '',
        description: store.description ?? '',
        contact_email: store.contact_email ?? user?.email ?? '',
        phone: store.phone ?? '',
        whatsapp_number: store.whatsapp_number ?? '',
        website_url: store.website_url ?? '',
        address: store.address ?? '',
        city: store.city ?? '',
        currency: store.currency ?? 'BDT',
        brand_color: store.brand_color ?? '#6366f1',
        facebook_handle: store.facebook_handle ?? '',
        instagram_handle: store.instagram_handle ?? '',
        hero_title: store.hero_title ?? '',
        hero_subtitle: store.hero_subtitle ?? '',
        hero_banner_urls: padHeroUrls(store.hero_banner_urls ?? store.banner_urls ?? store.banner_images ?? store.hero_images),
        about_title: store.about_title ?? '',
        about_image_url: store.about_image_url ?? '',
        about_mission: store.about_mission ?? '',
        offer_enabled: store.offer_enabled ?? true,
        offer_badge: store.offer_badge ?? '',
        offer_title: store.offer_title ?? '',
        offer_subtitle: store.offer_subtitle ?? '',
        offer_button_text: store.offer_button_text ?? '',
        offer_image_url: store.offer_image_url ?? '',
      })
      setLogoUrl(store.logo_url ?? null)
      setBannerUrl(store.banner_url ?? null)
      // Load notification prefs from store
      if (store.notification_prefs) {
        setNotif({ ...NOTIF_DEFAULTS, ...store.notification_prefs })
      }
    }
    setLoading(false)
  }, [store, storeLoading, user])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const updateHeroUrl = (index, value) => {
    setForm(f => {
      const next = padHeroUrls(f.hero_banner_urls)
      next[index] = value
      return { ...f, hero_banner_urls: next }
    })
  }

  const uploadCustomImage = async (file, target, index = null) => {
    if (!user || !store || !file) return
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be under 3 MB'); return }
    const uploadKey = index == null ? target : `${target}-${index}`
    setUploading(uploadKey)
    const ext = file.name.split('.').pop() || 'png'
    const path = `${user.id}/${target}-${index ?? 'single'}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('shop-branding').upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { toast.error(upErr.message); setUploading(null); return }
    const { data: pub } = supabase.storage.from('shop-branding').getPublicUrl(path)
    const url = pub.publicUrl
    if (target === 'hero') updateHeroUrl(index, url)
    if (target === 'about') set('about_image_url', url)
    if (target === 'offer') set('offer_image_url', url)
    setUploading(null)
    toast.success('Image uploaded. Click Save changes to publish it.')
  }

  const uploadImage = async (file, kind) => {
    if (!user || !store) return
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be under 3 MB'); return }
    setUploading(kind)
    const ext = file.name.split('.').pop() || 'png'
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('shop-branding').upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { toast.error(upErr.message); setUploading(null); return }
    const { data: pub } = supabase.storage.from('shop-branding').getPublicUrl(path)
    const patch = kind === 'logo' ? { logo_url: pub.publicUrl } : { banner_url: pub.publicUrl }
    await supabase.from('stores').update(patch).eq('id', store.id)
    if (kind === 'logo') setLogoUrl(pub.publicUrl)
    else setBannerUrl(pub.publicUrl)
    setUploading(null)
    qc.invalidateQueries({ queryKey: ['stores', user.id] })
    toast.success(`${kind === 'logo' ? 'Logo' : 'Banner'} updated`)
  }

  const saveProfile = async () => {
    if (!store) return
    if (!form.shop_name.trim() || form.shop_name.trim().length < 2) { toast.error('Shop name is too short'); return }
    setSaving(true)
    const { error } = await supabase.from('stores').update({
      shop_name: form.shop_name.trim(),
      business_category: form.business_category || null,
      tagline: form.tagline || null,
      description: form.description || null,
      contact_email: form.contact_email || null,
      phone: form.phone || null,
      whatsapp_number: form.whatsapp_number || null,
      website_url: form.website_url || null,
      address: form.address || null,
      city: form.city || null,
      currency: form.currency,
      brand_color: form.brand_color,
      facebook_handle: form.facebook_handle || null,
      instagram_handle: form.instagram_handle || null,
      hero_title: form.hero_title || null,
      hero_subtitle: form.hero_subtitle || null,
      hero_banner_urls: normalizeUrlList(form.hero_banner_urls),
      about_title: form.about_title || null,
      about_image_url: form.about_image_url || null,
      about_mission: form.about_mission || null,
      offer_enabled: form.offer_enabled !== false,
      offer_badge: form.offer_badge || null,
      offer_title: form.offer_title || null,
      offer_subtitle: form.offer_subtitle || null,
      offer_button_text: form.offer_button_text || null,
      offer_image_url: form.offer_image_url || null,
    }).eq('id', store.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    qc.invalidateQueries({ queryKey: ['stores', user.id] })
    toast.success('Store profile saved ✓')
  }

  // SRS M8: real password change
  const changePassword = async () => {
    if (!newPwd || newPwd.length < 8) { toast.error('New password must be at least 8 characters'); return }
    if (newPwd !== confirmPwd) { toast.error('Passwords do not match'); return }
    if (!currentPwd) { toast.error('Enter your current password first'); return }
    setPwdLoading(true)
    // Re-auth first
    const { error: reAuthErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPwd })
    if (reAuthErr) { toast.error('Current password is incorrect'); setPwdLoading(false); return }
    const { error } = await supabase.auth.updateUser({ password: newPwd })
    setPwdLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success('Password updated. All other sessions have been signed out.')
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
  }

  // SRS M8: notification prefs save
  const saveNotifPrefs = async () => {
    if (!store) return
    setNotifSaving(true)
    const { error } = await supabase.from('stores').update({ notification_prefs: notif }).eq('id', store.id)
    setNotifSaving(false)
    if (error) { toast.error(error.message); return }
    qc.invalidateQueries({ queryKey: ['stores', user?.id] })
    toast.success('Notification preferences saved')
  }

  // SRS M8: account / shop deletion request
  const deleteAccount = async () => {
    if (deletePhrase !== DELETE_PHRASE) {
      toast.error('Please type the confirmation phrase exactly')
      return
    }

    if (!store?.id) {
      toast.error('No active store found to delete')
      return
    }

    setDeleting(true)

    try {
      // Preferred path: SECURITY DEFINER RPC. This works even when normal store updates
      // are blocked by RLS, but it still verifies auth.uid() = store.owner_id inside SQL.
      const { error: rpcError } = await supabase.rpc('merchant_delete_store', {
        p_store_id: store.id,
      })

      // Fallback for projects where the SQL migration has not been run yet.
      if (rpcError) {
        const missingFunction = /merchant_delete_store|function .* does not exist|Could not find the function/i.test(rpcError.message || '')

        if (!missingFunction) {
          throw rpcError
        }

        const { error: fallbackError } = await supabase
          .from('stores')
          .update({
            account_status: 'deleted',
            storefront_published: false,
            deleted_at: new Date().toISOString(),
            suspended_reason: 'Deleted by merchant from account settings.',
          })
          .eq('id', store.id)
          .eq('owner_id', user.id)

        if (fallbackError) throw fallbackError
      }

      await qc.invalidateQueries({ queryKey: ['stores', user?.id] })
      await qc.invalidateQueries({ queryKey: ['storeLimit'] })
      setDeleteOpen(false)
      setDeletePhrase('')
      toast.success('Your store has been deleted and unpublished.')

      // Keep the user out of a deleted merchant dashboard state.
      await signOut()
      window.location.href = '/'
    } catch (error) {
      console.error('Store deletion failed:', error)
      toast.error(error?.message || 'Could not delete your store. Please try again.')
      setDeleting(false)
    }
  }

  const initial = (form.shop_name || user?.email || '?').charAt(0).toUpperCase()
  const pwdMatch = confirmPwd.length > 0 && newPwd === confirmPwd
  const pwdMismatch = confirmPwd.length > 0 && newPwd !== confirmPwd

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your store profile, security and preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="profile">Store Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="danger">Account</TabsTrigger>
        </TabsList>

        {/* ── PROFILE TAB ── */}
        <TabsContent value="profile" className="mt-6 space-y-6">
          {loading ? (
            <div className="space-y-6"><Skeleton className="h-48 w-full rounded-2xl"/><Skeleton className="h-72 w-full rounded-2xl"/></div>
          ) : (
            <>
              {/* Banner + Logo */}
              <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="relative h-36 w-full bg-gradient-to-br from-muted to-muted/40 sm:h-44">
                  {bannerUrl && <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover"/>}
                  <button onClick={() => bannerInput.current?.click()}
                    className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-lg bg-background/85 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur hover:bg-background">
                    {uploading==='banner' ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <ImageIcon className="h-3.5 w-3.5"/>}
                    {bannerUrl ? 'Change banner' : 'Add banner'}
                  </button>
                  <input ref={bannerInput} type="file" accept="image/*" className="hidden" onChange={e=>e.target.files?.[0]&&uploadImage(e.target.files[0],'banner')}/>
                </div>
                <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end">
                  <div className="-mt-16 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-gradient-primary text-3xl font-bold text-primary-foreground shadow-glow">
                    {logoUrl ? <img src={logoUrl} alt="Logo" className="h-full w-full object-cover"/> : initial}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{form.shop_name || 'Your shop'}</h3>
                    <p className="text-sm text-muted-foreground">{form.tagline || 'Add a tagline below'}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={()=>logoInput.current?.click()} disabled={uploading==='logo'}>
                    {uploading==='logo' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
                    {logoUrl ? 'Change logo' : 'Upload logo'}
                  </Button>
                  <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={e=>e.target.files?.[0]&&uploadImage(e.target.files[0],'logo')}/>
                </div>
              </section>

              <Sec title="Business details">
                <Field label="Shop name" required><Input value={form.shop_name} onChange={e=>set('shop_name',e.target.value)} maxLength={80}/></Field>
                <Field label="Business category">
                  <Select value={form.business_category||undefined} onValueChange={v=>set('business_category',v)}>
                    <SelectTrigger><SelectValue placeholder="Choose a category"/></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Tagline" hint={`${form.tagline?.length||0}/100`} className="sm:col-span-2">
                  <Input value={form.tagline||''} onChange={e=>set('tagline',e.target.value)} placeholder="Premium leather, handcrafted in Dhaka" maxLength={100}/>
                </Field>
                <Field label="About your shop" hint={`${form.description?.length||0}/600`} className="sm:col-span-2">
                  <Textarea value={form.description||''} onChange={e=>set('description',e.target.value)} rows={4} maxLength={600} placeholder="Tell customers what makes your shop unique…"/>
                </Field>
                <Field label="Currency">
                  <Select value={form.currency} onValueChange={v=>set('currency',v)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c=><SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="City"><Input value={form.city} onChange={e=>set('city',e.target.value)} placeholder="Dhaka"/></Field>
              </Sec>

              <Sec title="Storefront hero & slideshow">
                <Field label="Hero title" className="sm:col-span-2">
                  <Input value={form.hero_title||''} onChange={e=>set('hero_title',e.target.value)} placeholder="Clean shopping, trusted checkout" maxLength={120}/>
                </Field>
                <Field label="Hero subtitle" className="sm:col-span-2">
                  <Textarea value={form.hero_subtitle||''} onChange={e=>set('hero_subtitle',e.target.value)} rows={2} maxLength={220} placeholder="Short message for the storefront hero area"/>
                </Field>
                <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                  {padHeroUrls(form.hero_banner_urls).map((url, index)=>(
                    <div key={index} className="rounded-xl border border-border p-3">
                      <Label className="text-sm">Hero banner image {index + 1}</Label>
                      <Input className="mt-2" value={url} onChange={e=>updateHeroUrl(index,e.target.value)} placeholder="https://..."/>
                      {url && <img src={url} alt={`Hero banner ${index + 1}`} className="mt-3 h-24 w-full rounded-lg object-cover"/>}
                      <Input className="mt-3" type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&uploadCustomImage(e.target.files[0],'hero',index)} disabled={uploading===`hero-${index}`}/>
                      <p className="mt-1 text-xs text-muted-foreground">Use at least 2 images. Maximum 4 images will show.</p>
                    </div>
                  ))}
                </div>
              </Sec>

              <Sec title="Store offer section">
                <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-border p-4">
                  <div>
                    <Label className="text-sm font-medium">Show offer section</Label>
                    <p className="text-xs text-muted-foreground">This appears below the full product collection.</p>
                  </div>
                  <Switch checked={form.offer_enabled !== false} onCheckedChange={v=>set('offer_enabled',v)}/>
                </div>
                <Field label="Offer badge"><Input value={form.offer_badge||''} onChange={e=>set('offer_badge',e.target.value)} placeholder="Limited offer" maxLength={40}/></Field>
                <Field label="Offer button text"><Input value={form.offer_button_text||''} onChange={e=>set('offer_button_text',e.target.value)} placeholder="Shop products" maxLength={40}/></Field>
                <Field label="Offer title" className="sm:col-span-2"><Input value={form.offer_title||''} onChange={e=>set('offer_title',e.target.value)} placeholder="Special deal for smart shoppers" maxLength={120}/></Field>
                <Field label="Offer subtitle" className="sm:col-span-2"><Textarea value={form.offer_subtitle||''} onChange={e=>set('offer_subtitle',e.target.value)} rows={3} maxLength={260} placeholder="Write the offer message customers will see."/></Field>
                <Field label="Offer image URL" className="sm:col-span-2">
                  <Input value={form.offer_image_url||''} onChange={e=>set('offer_image_url',e.target.value)} placeholder="https://..."/>
                  {form.offer_image_url && <img src={form.offer_image_url} alt="Offer preview" className="mt-3 h-36 w-full rounded-xl object-cover"/>}
                  <Input className="mt-3" type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&uploadCustomImage(e.target.files[0],'offer')} disabled={uploading==='offer'}/>
                </Field>
              </Sec>

              <Sec title="About page content">
                <Field label="About page title" className="sm:col-span-2"><Input value={form.about_title||''} onChange={e=>set('about_title',e.target.value)} placeholder="About our shop" maxLength={120}/></Field>
                <Field label="About page image URL" className="sm:col-span-2">
                  <Input value={form.about_image_url||''} onChange={e=>set('about_image_url',e.target.value)} placeholder="https://..."/>
                  {form.about_image_url && <img src={form.about_image_url} alt="About preview" className="mt-3 h-40 w-full rounded-xl object-cover"/>}
                  <Input className="mt-3" type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&uploadCustomImage(e.target.files[0],'about')} disabled={uploading==='about'}/>
                </Field>
                <Field label="About mission / story" className="sm:col-span-2"><Textarea value={form.about_mission||''} onChange={e=>set('about_mission',e.target.value)} rows={4} maxLength={700} placeholder="Tell customers about your mission, story, and service promise."/></Field>
              </Sec>

              <Sec title="Contact info">
                <Field label="Contact email"><Input type="email" value={form.contact_email} onChange={e=>set('contact_email',e.target.value)} placeholder="shop@example.com"/></Field>
                <Field label="Phone"><Input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+880 17XX-XXXXXX"/></Field>
                <Field label="WhatsApp">
                  <div className="relative"><MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
                    <Input className="pl-9" value={form.whatsapp_number} onChange={e=>set('whatsapp_number',e.target.value)} placeholder="+880 17XX-XXXXXX"/></div>
                </Field>
                <Field label="Website">
                  <div className="relative"><Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
                    <Input className="pl-9" value={form.website_url} onChange={e=>set('website_url',e.target.value)} placeholder="https://example.com"/></div>
                </Field>
                <Field label="Address" className="sm:col-span-2"><Textarea value={form.address} onChange={e=>set('address',e.target.value)} rows={2} maxLength={255} placeholder="Street, area, postcode"/></Field>
              </Sec>

              <Sec title="Social media">
                <Field label="Facebook">
                  <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">f</span>
                    <Input className="pl-7" value={form.facebook_handle} onChange={e=>set('facebook_handle',e.target.value)} placeholder="yourpage"/></div>
                </Field>
                <Field label="Instagram">
                  <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">@</span>
                    <Input className="pl-7" value={form.instagram_handle} onChange={e=>set('instagram_handle',e.target.value)} placeholder="yourhandle"/></div>
                </Field>
              </Sec>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={()=>window.location.reload()} disabled={saving}>Discard</Button>
                <Button onClick={saveProfile} disabled={saving} className="bg-gradient-primary px-8">
                  {saving&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save changes
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── SECURITY TAB ── */}
        <TabsContent value="security" className="mt-6 space-y-5">
          {/* Password change — SRS M8 */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Key className="h-5 w-5 text-primary"/></div>
              <div><h3 className="text-base font-semibold">Change password</h3><p className="text-sm text-muted-foreground">Update your login password</p></div>
            </div>
            {isGoogleUser ? (
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                Your account uses Google Sign-in. To change your password, visit your Google account settings.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Current password" className="sm:col-span-2">
                  <div className="relative">
                    <Input type={showPwd.current?'text':'password'} value={currentPwd} onChange={e=>setCurrentPwd(e.target.value)} className="pr-10" autoComplete="current-password"/>
                    <button type="button" onClick={()=>setShowPwd(s=>({...s,current:!s.current}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                      {showPwd.current?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}
                    </button>
                  </div>
                </Field>
                <Field label="New password">
                  <div className="relative">
                    <Input type={showPwd.new?'text':'password'} value={newPwd} onChange={e=>setNewPwd(e.target.value)} className="pr-10" minLength={8} autoComplete="new-password"/>
                    <button type="button" onClick={()=>setShowPwd(s=>({...s,new:!s.new}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                      {showPwd.new?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
                </Field>
                <Field label="Confirm new password">
                  <div className="relative">
                    <Input type={showPwd.confirm?'text':'password'} value={confirmPwd} onChange={e=>setConfirmPwd(e.target.value)}
                      className={`pr-10 transition-colors ${pwdMismatch?'border-destructive':pwdMatch?'border-success':''}`} autoComplete="new-password"/>
                    <button type="button" onClick={()=>setShowPwd(s=>({...s,confirm:!s.confirm}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                      {showPwd.confirm?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}
                    </button>
                  </div>
                  {confirmPwd.length>0&&(
                    <p className={`flex items-center gap-1 text-xs ${pwdMatch?'text-success':'text-destructive'}`}>
                      {pwdMatch?<Check className="h-3 w-3"/>:<X className="h-3 w-3"/>}
                      {pwdMatch?'Passwords match':'Passwords do not match'}
                    </p>
                  )}
                </Field>
                <div className="sm:col-span-2">
                  <Button onClick={changePassword} disabled={pwdLoading||!currentPwd||!newPwd||pwdMismatch} className="gap-2">
                    {pwdLoading?<Loader2 className="h-4 w-4 animate-spin"/>:<Shield className="h-4 w-4"/>}Update password
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 2FA — SRS M8 */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10"><Shield className="h-5 w-5 text-success"/></div>
                <div>
                  <h3 className="text-base font-semibold">Two-factor authentication</h3>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security using Google Authenticator or Authy (TOTP/RFC 6238)</p>
                  <Badge variant="secondary" className="mt-2 text-muted-foreground text-xs">Not configured — coming soon</Badge>
                </div>
              </div>
              <Switch disabled/>
            </div>
          </div>

          {/* Sessions — SRS M8 */}
          <div className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border p-5">
              <h3 className="text-base font-semibold">Active sessions</h3>
              <p className="text-sm text-muted-foreground">Devices currently signed into your account</p>
            </div>
            <div className="divide-y divide-border">
              {[
                { d:'This device', l:'Current session', t:'Active now', current:true, i:Monitor },
              ].map(s=>(
                <div key={s.d} className="flex items-center gap-4 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted"><s.i className="h-5 w-5"/></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><span className="text-sm font-medium">{s.d}</span>{s.current&&<Badge variant="secondary" className="text-success text-[10px]">Current</Badge>}</div>
                    <div className="text-xs text-muted-foreground">{s.l} · {s.t}</div>
                  </div>
                  {!s.current&&<Button variant="ghost" size="sm" className="text-destructive"><LogOut className="mr-1 h-4 w-4"/>Revoke</Button>}
                </div>
              ))}
            </div>
            <div className="border-t border-border px-5 py-3">
              <Button variant="outline" size="sm" className="gap-2 text-destructive"
                onClick={async()=>{await signOut();window.location.href='/login'}}>
                <LogOut className="h-4 w-4"/>Sign out of all devices
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── NOTIFICATIONS TAB — SRS M8 ── */}
        <TabsContent value="notifications" className="mt-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-1 text-base font-semibold">Notification channel</h3>
            <p className="mb-4 text-sm text-muted-foreground">How would you like to receive notifications?</p>
            <div className="mb-6 grid grid-cols-3 gap-2">
              {['email','sms','both'].map(ch=>(
                <button key={ch} onClick={()=>setNotif(n=>({...n,channel:ch}))}
                  className={`rounded-xl border-2 py-3 text-sm font-medium capitalize transition-all ${notif.channel===ch?'border-primary bg-primary/5 text-primary':'border-border text-muted-foreground hover:border-primary/40'}`}>
                  {ch==='both'?'Email & SMS':ch.toUpperCase()}
                </button>
              ))}
            </div>

            <h3 className="mb-1 text-base font-semibold">Notification types</h3>
            <p className="mb-4 text-sm text-muted-foreground">Choose which events trigger a notification.</p>
            <div className="space-y-0 divide-y divide-border">
              {[
                { key:'new_order',      icon:Bell,        label:'New orders',         desc:'When a customer places an order' },
                { key:'low_stock',      icon:AlertTriangle,label:'Low stock alerts',  desc:'When product stock drops below threshold' },
                { key:'order_status',   icon:RefreshCw,   label:'Order status updates',desc:'When order status changes (shipped, delivered)' },
                { key:'weekly_report',  icon:Monitor,     label:'Weekly report',       desc:'Performance summary every Monday' },
                { key:'marketing',      icon:Smartphone,  label:'Tips & updates',      desc:'BazarHQ platform news and growth tips' },
              ].map(n=>(
                <div key={n.key} className="flex items-center justify-between gap-4 py-4">
                  <div className="flex gap-3">
                    <n.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"/>
                    <div><div className="text-sm font-medium">{n.label}</div><div className="text-xs text-muted-foreground">{n.desc}</div></div>
                  </div>
                  <Switch checked={notif[n.key]??true} onCheckedChange={v=>setNotif(prev=>({...prev,[n.key]:v}))}/>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Button onClick={saveNotifPrefs} disabled={notifSaving} className="bg-gradient-primary gap-2">
                {notifSaving&&<Loader2 className="h-4 w-4 animate-spin"/>}Save preferences
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── DANGER / ACCOUNT TAB — SRS M8 ── */}
        <TabsContent value="danger" className="mt-6 space-y-5">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-1 text-base font-semibold">Account information</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
                <span className="text-muted-foreground">Signup method</span>
                <span className="font-medium capitalize">{user?.app_metadata?.provider || 'email'}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
                <span className="text-muted-foreground">Account created</span>
                <span className="font-medium">{user?.created_at ? new Date(user.created_at).toLocaleDateString('en-BD', {day:'numeric',month:'long',year:'numeric'}) : '—'}</span>
              </div>
            </div>
          </div>

          {/* SRS M8: Account deletion */}
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10"><Trash2 className="h-5 w-5 text-destructive"/></div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-destructive">Delete store</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your shop will be unpublished immediately and marked as deleted. Customers will not be able to open the storefront. Products, orders history, and settings can be permanently removed later by admin cleanup. <strong>This cannot be undone from the merchant dashboard.</strong>
                </p>
                <Button variant="destructive" size="sm" className="mt-4 gap-2" onClick={()=>setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4"/>Delete my store
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-destructive">Delete store permanently</DialogTitle></DialogHeader>
          <div className="py-2 space-y-4">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertTriangle className="mb-2 h-5 w-5"/>
              <p>This will <strong>immediately unpublish</strong> your shop and mark it as deleted. Customers will not be able to browse or place orders from this store.</p>
            </div>
            <div className="grid gap-2">
              <Label>Type <strong>{DELETE_PHRASE}</strong> to confirm</Label>
              <Input value={deletePhrase} onChange={e=>setDeletePhrase(e.target.value)} placeholder={DELETE_PHRASE} className="font-mono"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>{setDeleteOpen(false);setDeletePhrase('')}}>Cancel</Button>
            <Button variant="destructive" onClick={deleteAccount} disabled={deleting||deletePhrase!==DELETE_PHRASE}>
              {deleting?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Trash2 className="mr-2 h-4 w-4"/>}
              Delete store
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Sec({ title, children }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <header className="mb-5"><h3 className="text-base font-semibold">{title}</h3></header>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}
function Field({ label, hint, required, className, children }) {
  return (
    <div className={`grid gap-1.5 ${className||''}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}{required&&<span className="ml-0.5 text-destructive">*</span>}</Label>
        {hint&&<span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
