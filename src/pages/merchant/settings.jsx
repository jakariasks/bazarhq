import { useEffect, useRef, useState } from 'react'
import { Shield, Smartphone, Bell, Monitor, LogOut, Upload, Loader2, Image as ImageIcon, Globe, MessageCircle, Palette } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useCurrentStore } from '@/lib/use-current-store'
import { useQueryClient } from '@tanstack/react-query'

const CATEGORIES = ['Fashion & Apparel','Electronics','Home & Living','Beauty & Personal Care','Food & Grocery','Handicrafts','Books & Stationery','Sports & Outdoors','Other']
const CURRENCIES = [{ v: 'BDT', l: 'BDT — Bangladeshi Taka' },{ v: 'USD', l: 'USD — US Dollar' },{ v: 'EUR', l: 'EUR — Euro' },{ v: 'INR', l: 'INR — Indian Rupee' }]

const EMPTY = { shop_name: '', business_category: '', tagline: '', description: '', contact_email: '', phone: '', whatsapp_number: '', website_url: '', address: '', city: '', currency: 'BDT', brand_color: '#6366f1', facebook_handle: '', instagram_handle: '' }

function SettingsPage() {
  const { user } = useAuth()
  const { store, isLoading: storeLoading } = useCurrentStore()
  const qc = useQueryClient()
  const [twoFA, setTwoFA] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [logoUrl, setLogoUrl] = useState(null)
  const [bannerUrl, setBannerUrl] = useState(null)
  const [uploading, setUploading] = useState(null)
  const logoInput = useRef(null)
  const bannerInput = useRef(null)

  useEffect(() => {
    if (storeLoading) return
    if (store) {
      setForm({
        shop_name: store.shop_name ?? '', business_category: store.business_category ?? '', tagline: store.tagline ?? '',
        description: store.description ?? '', contact_email: store.contact_email ?? user?.email ?? '', phone: store.phone ?? '',
        whatsapp_number: store.whatsapp_number ?? '', website_url: store.website_url ?? '', address: store.address ?? '',
        city: store.city ?? '', currency: store.currency ?? 'BDT', brand_color: store.brand_color ?? '#6366f1',
        facebook_handle: store.facebook_handle ?? '', instagram_handle: store.instagram_handle ?? '' })
      setLogoUrl(store.logo_url ?? null)
      setBannerUrl(store.banner_url ?? null)
    }
    setLoading(false)
  }, [store, storeLoading, user])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const uploadImage = async (file, kind) => {
    if (!user || !store) return
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be under 3 MB'); return }
    setUploading(kind)
    const ext = file.name.split('.').pop() || 'png'
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('shop-branding').upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { toast.error(upErr.message); setUploading(null); return }
    const { data: pub } = supabase.storage.from('shop-branding').getPublicUrl(path)
    const url = pub.publicUrl
    const patch = kind === 'logo' ? { logo_url: url } : { banner_url: url }
    const { error: dbErr } = await supabase.from('stores').update(patch).eq('id', store.id)
    if (dbErr) { toast.error(dbErr.message); setUploading(null); return }
    if (kind === 'logo') setLogoUrl(url); else setBannerUrl(url)
    setUploading(null)
    qc.invalidateQueries({ queryKey: ['stores', user.id] })
    toast.success(`${kind === 'logo' ? 'Logo' : 'Banner'} updated`)
  }

  const save = async () => {
    if (!user || !store) return
    if (!form.shop_name.trim() || form.shop_name.trim().length < 2) { toast.error('Shop name is too short'); return }
    setSaving(true)
    const payload = {
      shop_name: form.shop_name.trim(), business_category: form.business_category || null,
      tagline: form.tagline || null, description: form.description || null,
      contact_email: form.contact_email || null, phone: form.phone || null,
      whatsapp_number: form.whatsapp_number || null, website_url: form.website_url || null,
      address: form.address || null, city: form.city || null, currency: form.currency,
      brand_color: form.brand_color, facebook_handle: form.facebook_handle || null,
      instagram_handle: form.instagram_handle || null }
    const { error } = await supabase.from('stores').update(payload).eq('id', store.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    qc.invalidateQueries({ queryKey: ['stores', user.id] })
    toast.success('Store saved')
  }

  const initial = (form.shop_name || user?.email || '?').charAt(0).toUpperCase()

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1><p className="mt-1 text-sm text-muted-foreground">Manage your shop profile, security and preferences</p></div>
      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6 space-y-6">
          {loading ? (
            <div className="space-y-6"><Skeleton className="h-48 w-full rounded-2xl" /><Skeleton className="h-72 w-full rounded-2xl" /></div>
          ) : (
            <>
              <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="relative h-36 w-full bg-gradient-to-br from-muted to-muted/40 sm:h-44">
                  {bannerUrl && <img src={bannerUrl} alt="Shop banner" className="h-full w-full object-cover" />}
                  <button type="button" onClick={() => bannerInput.current?.click()} className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-lg bg-background/85 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur hover:bg-background">
                    {uploading === 'banner' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                    {bannerUrl ? 'Change banner' : 'Add banner'}
                  </button>
                  <input ref={bannerInput} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'banner')} />
                </div>
                <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:gap-6">
                  <div className="-mt-16 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-gradient-primary text-3xl font-semibold text-primary-foreground shadow-glow">
                    {logoUrl ? <img src={logoUrl} alt="Shop logo" className="h-full w-full object-cover" /> : initial}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{form.shop_name || 'Your shop'}</h3>
                    <p className="text-sm text-muted-foreground">{form.tagline || 'Add a tagline to describe your shop'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => logoInput.current?.click()} disabled={uploading === 'logo'}>
                      {uploading === 'logo' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      {logoUrl ? 'Change logo' : 'Upload logo'}
                    </Button>
                    <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], 'logo')} />
                  </div>
                </div>
              </section>

              <Sec title="Business details" desc="Information shown on your storefront and invoices">
                <Field label="Shop name" required><Input value={form.shop_name} onChange={(e) => set('shop_name', e.target.value)} maxLength={80} /></Field>
                <Field label="Business category">
                  <Select value={form.business_category || undefined} onValueChange={(v) => set('business_category', v)}>
                    <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Tagline" hint={`${form.tagline?.length ?? 0}/120`} className="sm:col-span-2">
                  <Input value={form.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} placeholder="Premium leather, handcrafted in Dhaka" maxLength={120} />
                </Field>
                <Field label="About your shop" hint={`${form.description?.length ?? 0}/600`} className="sm:col-span-2">
                  <Textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} rows={4} maxLength={600} placeholder="Tell customers what makes your shop unique…" />
                </Field>
                <Field label="Currency">
                  <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="City"><Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Dhaka" maxLength={80} /></Field>
              </Sec>

              <Sec title="Contact info" desc="How customers and BazarHQ can reach you">
                <Field label="Contact email"><Input type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} placeholder="shop@example.com" /></Field>
                <Field label="Phone"><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+880 17XX-XXXXXX" /></Field>
                <Field label="WhatsApp">
                  <div className="relative"><MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={form.whatsapp_number} onChange={(e) => set('whatsapp_number', e.target.value)} placeholder="+880 17XX-XXXXXX" /></div>
                </Field>
                <Field label="Website">
                  <div className="relative"><Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={form.website_url} onChange={(e) => set('website_url', e.target.value)} placeholder="https://example.com" /></div>
                </Field>
                <Field label="Address" className="sm:col-span-2"><Textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} maxLength={255} placeholder="Street, area, postcode" /></Field>
              </Sec>

              <Sec title="Branding" desc="Your colors and social presence">
                <Field label="Brand color">
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.brand_color} onChange={(e) => set('brand_color', e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent" />
                    <div className="relative flex-1"><Palette className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9 font-mono" value={form.brand_color} onChange={(e) => set('brand_color', e.target.value)} maxLength={7} /></div>
                  </div>
                </Field>
                <div />
                <Field label="Facebook">
                  <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">f</span><Input className="pl-9" value={form.facebook_handle} onChange={(e) => set('facebook_handle', e.target.value)} placeholder="rahimsleather" /></div>
                </Field>
                <Field label="Instagram">
                  <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">@</span><Input className="pl-9" value={form.instagram_handle} onChange={(e) => set('instagram_handle', e.target.value)} placeholder="rahimsleather" /></div>
                </Field>
              </Sec>

              <div className="sticky bottom-4 z-10 flex justify-end gap-2 rounded-2xl border border-border bg-background/85 p-3 shadow-sm backdrop-blur">
                <Button variant="ghost" onClick={() => window.location.reload()} disabled={saving}>Discard</Button>
                <Button onClick={save} disabled={saving} className="bg-gradient-primary">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="security" className="mt-6 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-base font-semibold">Password</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2"><Label>Current password</Label><Input type="password" /></div>
              <div className="grid gap-2"><Label>New password</Label><Input type="password" /></div>
            </div>
            <Button className="mt-4">Update password</Button>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success"><Shield className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-base font-semibold">Two-factor authentication</h3>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security via SMS or authenticator app</p>
                  {twoFA && <Badge variant="secondary" className="mt-2 text-success">Enabled via SMS</Badge>}
                </div>
              </div>
              <Switch checked={twoFA} onCheckedChange={setTwoFA} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-4 text-base font-semibold">Notification preferences</h3>
            <div className="space-y-1">
              {[
                { t: 'New orders', d: 'Get notified when someone places an order' },
                { t: 'Low stock alerts', d: 'When product stock drops below threshold' },
                { t: 'Customer messages', d: 'When a customer sends an inquiry' },
                { t: 'Weekly reports', d: 'Summary of your shop performance every Monday' },
                { t: 'Marketing tips', d: 'BazarHQ insights & growth tips' },
              ].map((n, i) => (
                <div key={n.t} className="flex items-center justify-between gap-4 border-b border-border py-4 last:border-0">
                  <div className="flex gap-3">
                    <Bell className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div><div className="text-sm font-medium">{n.t}</div><div className="text-xs text-muted-foreground">{n.d}</div></div>
                  </div>
                  <Switch defaultChecked={i < 3} />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="mt-6">
          <div className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border p-5"><h3 className="text-base font-semibold">Active sessions</h3><p className="text-sm text-muted-foreground">Devices currently signed in to your account</p></div>
            <div className="divide-y divide-border">
              {[
                { d: 'MacBook Pro', l: 'Dhaka, Bangladesh', t: 'Active now', current: true, i: Monitor },
                { d: 'iPhone 15', l: 'Dhaka, Bangladesh', t: '2 hours ago', i: Smartphone },
                { d: 'Chrome on Windows', l: 'Chittagong, BD', t: 'Yesterday', i: Monitor },
              ].map((s) => (
                <div key={s.d} className="flex items-center gap-4 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted"><s.i className="h-5 w-5" /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><div className="text-sm font-medium">{s.d}</div>{s.current && <Badge variant="secondary" className="text-success">Current</Badge>}</div>
                    <div className="text-xs text-muted-foreground">{s.l} • {s.t}</div>
                  </div>
                  {!s.current && <Button variant="ghost" size="sm" className="text-destructive"><LogOut className="mr-1 h-4 w-4" /> Revoke</Button>}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Sec({ title, desc, children }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <header className="mb-5"><h3 className="text-base font-semibold">{title}</h3>{desc && <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>}</header>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Field({ label, hint, required, className, children }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export default SettingsPage
