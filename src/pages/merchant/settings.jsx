import { useEffect, useRef, useState } from 'react'
import { Loader2, Image as ImageIcon, Globe, MessageCircle, Upload } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useCurrentStore } from '@/lib/use-current-store'
import { useQueryClient } from '@tanstack/react-query'
import { MerchantSecuritySuite } from '@/components/merchant-security-suite'
import { MerchantNotificationPreferences } from '@/components/merchant-notification-preferences'
import { MerchantLifecycleCard } from '@/components/merchant-lifecycle-card'
import { MerchantAccountProfile } from '@/components/merchant-account-profile'

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

function toNonNegativeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

const EMPTY = {
  shop_name:'', business_category:'', tagline:'', description:'',
  contact_email:'', phone:'', whatsapp_number:'', website_url:'',
  address:'', city:'', currency:'BDT', brand_color:'#6366f1',
  facebook_handle:'', instagram_handle:'',
  hero_title:'', hero_subtitle:'', hero_banner_urls:['','','',''],
  about_title:'', about_image_url:'', about_mission:'',
  offer_enabled:true, offer_badge:'', offer_title:'', offer_subtitle:'', offer_button_text:'', offer_image_url:'',
  delivery_charge_dhaka: 60, delivery_charge_outside_dhaka: 120, free_delivery_min_amount: 0,
  return_policy: 'Return or exchange requests must be discussed with the merchant within 3 days of delivery. Items should be unused and in original condition unless they arrived damaged or incorrect.',
  shipping_policy: 'Delivery time and charge depend on destination, courier availability, and product type. Customers will see the final delivery charge before placing the order.',
  payment_policy: 'Cash on Delivery remains pending until collection. Mobile banking payments require a valid transaction ID and remain pending until merchant verification.',
}

const MAX_STORE_IMAGE_BYTES = 2 * 1024 * 1024

function storeForm(store, user) {
  if (!store) return EMPTY
  return {
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
    delivery_charge_dhaka: store.delivery_charge_dhaka ?? 60,
    delivery_charge_outside_dhaka: store.delivery_charge_outside_dhaka ?? 120,
    free_delivery_min_amount: store.free_delivery_min_amount ?? 0,
    return_policy: store.return_policy || EMPTY.return_policy,
    shipping_policy: store.shipping_policy || EMPTY.shipping_policy,
    payment_policy: store.payment_policy || EMPTY.payment_policy,
  }
}

function validateStoreImage(file) {
  if (!file) return 'Choose an image file.'
  if (!String(file.type || '').startsWith('image/')) return 'Only image files are supported.'
  if (file.size > MAX_STORE_IMAGE_BYTES) return 'Image must be under 2 MB.'
  return ''
}

function validOptionalUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return true
  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}



export default function SettingsPage() {
  const { user } = useAuth()
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



  useEffect(() => {
    if (storeLoading) return
    if (store) {
      setForm(storeForm(store, user))
      setLogoUrl(store.logo_url ?? null)
      setBannerUrl(store.banner_url ?? null)
    } else {
      setForm(EMPTY)
      setLogoUrl(null)
      setBannerUrl(null)
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
    const validationError = validateStoreImage(file)
    if (validationError) { toast.error(validationError); return }
    const uploadKey = index == null ? target : `${target}-${index}`
    setUploading(uploadKey)
    const ext = String(file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'png'
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
    const validationError = validateStoreImage(file)
    if (validationError) { toast.error(validationError); return }
    setUploading(kind)
    const ext = String(file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'png'
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('shop-branding').upload(path, file, { upsert: true, contentType: file.type })
    if (upErr) { toast.error(upErr.message); setUploading(null); return }
    const { data: pub } = supabase.storage.from('shop-branding').getPublicUrl(path)
    const patch = kind === 'logo' ? { logo_url: pub.publicUrl } : { banner_url: pub.publicUrl }
    const { error: saveError } = await supabase.from('stores').update(patch).eq('id', store.id)
    if (saveError) {
      setUploading(null)
      toast.error(`Image uploaded, but the store could not be updated: ${saveError.message}`)
      return
    }
    if (kind === 'logo') setLogoUrl(pub.publicUrl)
    else setBannerUrl(pub.publicUrl)
    setUploading(null)
    qc.invalidateQueries({ queryKey: ['stores', user.id] })
    toast.success(`${kind === 'logo' ? 'Logo' : 'Banner'} updated`)
  }

  const saveProfile = async () => {
    if (!store) return
    if (!form.shop_name.trim() || form.shop_name.trim().length < 2) { toast.error('Shop name is too short'); return }
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) { toast.error('Enter a valid contact email.'); return }
    if (!validOptionalUrl(form.website_url)) { toast.error('Website URL must start with http:// or https://.'); return }
    const imageUrls = [...padHeroUrls(form.hero_banner_urls), form.offer_image_url, form.about_image_url].filter(Boolean)
    if (imageUrls.some((url) => !validOptionalUrl(url))) { toast.error('Storefront image URLs must use http:// or https://.'); return }
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
      delivery_charge_dhaka: toNonNegativeNumber(form.delivery_charge_dhaka, 60),
      delivery_charge_outside_dhaka: toNonNegativeNumber(form.delivery_charge_outside_dhaka, 120),
      free_delivery_min_amount: toNonNegativeNumber(form.free_delivery_min_amount, 0),
      return_policy: form.return_policy || EMPTY.return_policy,
      shipping_policy: form.shipping_policy || EMPTY.shipping_policy,
      payment_policy: form.payment_policy || EMPTY.payment_policy,
    }).eq('id', store.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    qc.invalidateQueries({ queryKey: ['stores', user.id] })
    toast.success('Store profile saved ✓')
  }

  const discardChanges = () => {
    if (!store) return
    setForm(storeForm(store, user))
    setLogoUrl(store.logo_url ?? null)
    setBannerUrl(store.banner_url ?? null)
    toast.info('Unsaved store changes discarded.')
  }

  const initial = (form.shop_name || user?.email || '?').charAt(0).toUpperCase()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your store, merchant profile, security and account lifecycle</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="profile">Store Profile</TabsTrigger>
          <TabsTrigger value="account-profile">My Profile</TabsTrigger>
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

              <Sec title="Delivery charges">
                <Field label="Inside Dhaka delivery charge">
                  <Input
                    type="number"
                    min="0"
                    value={form.delivery_charge_dhaka}
                    onChange={e=>set('delivery_charge_dhaka', e.target.value)}
                    placeholder="60"
                  />
                </Field>
                <Field label="Outside Dhaka delivery charge">
                  <Input
                    type="number"
                    min="0"
                    value={form.delivery_charge_outside_dhaka}
                    onChange={e=>set('delivery_charge_outside_dhaka', e.target.value)}
                    placeholder="120"
                  />
                </Field>
                <Field label="Free delivery minimum" hint="Optional" className="sm:col-span-2">
                  <Input
                    type="number"
                    min="0"
                    value={form.free_delivery_min_amount}
                    onChange={e=>set('free_delivery_min_amount', e.target.value)}
                    placeholder="0"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Set 0 to disable free delivery. Example: 2000 means orders from BDT 2,000 get free delivery.</p>
                </Field>
              </Sec>

              <Sec title="Store policies">
                <Field label="Return policy" className="sm:col-span-2" hint={`${form.return_policy?.length || 0}/700`}>
                  <Textarea
                    value={form.return_policy || ''}
                    onChange={e=>set('return_policy', e.target.value)}
                    rows={4}
                    maxLength={700}
                    placeholder="Write your return or exchange policy"
                  />
                </Field>
                <Field label="Shipping policy" className="sm:col-span-2" hint={`${form.shipping_policy?.length || 0}/700`}>
                  <Textarea
                    value={form.shipping_policy || ''}
                    onChange={e=>set('shipping_policy', e.target.value)}
                    rows={4}
                    maxLength={700}
                    placeholder="Write your delivery time, courier, and delivery charge policy"
                  />
                </Field>
                <Field label="Payment policy" className="sm:col-span-2" hint={`${form.payment_policy?.length || 0}/700`}>
                  <Textarea
                    value={form.payment_policy || ''}
                    onChange={e=>set('payment_policy', e.target.value)}
                    rows={4}
                    maxLength={700}
                    placeholder="Write your COD, mobile banking, and online payment policy"
                  />
                </Field>
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
                <Button variant="ghost" onClick={discardChanges} disabled={saving}>Discard</Button>
                <Button onClick={saveProfile} disabled={saving} className="bg-gradient-primary px-8">
                  {saving&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save changes
                </Button>
              </div>
            </>
          )}
        </TabsContent>



        {/* ── MERCHANT ACCOUNT PROFILE ── */}
        <TabsContent value="account-profile" className="mt-6">
          <MerchantAccountProfile user={user} />
        </TabsContent>

        {/* ── SECURITY TAB ── */}
        <TabsContent value="security" className="mt-6">
          <MerchantSecuritySuite user={user} />
        </TabsContent>

        {/* ── NOTIFICATIONS TAB ── */}
        <TabsContent value="notifications" className="mt-6">
          <MerchantNotificationPreferences />
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

          <MerchantLifecycleCard />
        </TabsContent>
      </Tabs>

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
