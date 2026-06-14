import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Check, Eye, Loader2, Type, Layout, FileText, Megaphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useQueryClient } from '@tanstack/react-query'
import { previewThemes, getTheme, themeCssVars, DEFAULT_THEME_ID } from '@/lib/preview-themes'
import { useCurrentStore } from '@/lib/use-current-store'

// SRS M3: min 3 font options
const FONTS = [
  { id: 'inter',    name: 'Inter',      sample: 'Modern & clean', css: '"Inter", sans-serif' },
  { id: 'poppins',  name: 'Poppins',    sample: 'Friendly & round', css: '"Poppins", sans-serif' },
  { id: 'lora',     name: 'Lora',       sample: 'Elegant & serif', css: '"Lora", serif' },
  { id: 'roboto',   name: 'Roboto',     sample: 'Professional', css: '"Roboto", sans-serif' },
  { id: 'nunito',   name: 'Nunito',     sample: 'Warm & approachable', css: '"Nunito", sans-serif' },
]

export default function ThemesPage() {
  const { user } = useAuth()
  const { store, isLoading } = useCurrentStore()
  const qc = useQueryClient()

  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID)
  const [color, setColor] = useState('#6366f1')
  const [fontId, setFontId] = useState('inter')
  const [saving, setSaving] = useState(false)

  // Section toggles — SRS M3
  const [showHero, setShowHero] = useState(true)
  const [showFeatured, setShowFeatured] = useState(true)
  const [showAbout, setShowAbout] = useState(false)
  const [showAnnouncement, setShowAnnouncement] = useState(false)
  const [announceText, setAnnounceText] = useState('')
  const [tagline, setTagline] = useState('')

  // Policies — SRS M3
  const [returnPolicy, setReturnPolicy] = useState('')
  const [shippingPolicy, setShippingPolicy] = useState('')

  // About section — SRS M3
  const [aboutText, setAboutText] = useState('')

  useEffect(() => {
    if (!store) return
    setThemeId(store.theme_id ?? DEFAULT_THEME_ID)
    setColor(store.brand_color ?? '#6366f1')
    setFontId(store.font_id ?? 'inter')
    setShowHero(store.show_hero ?? true)
    setShowFeatured(store.show_featured ?? true)
    setShowAbout(store.show_about ?? false)
    setShowAnnouncement(store.announcement_enabled ?? false)
    setAnnounceText(store.announcement_text ?? '')
    setTagline(store.tagline ?? '')
    setReturnPolicy(store.return_policy ?? '')
    setShippingPolicy(store.shipping_policy ?? '')
    setAboutText(store.about_text ?? '')
  }, [store])

  const activeTheme = getTheme(themeId)
  const activeFont = FONTS.find(f => f.id === fontId) ?? FONTS[0]

  const save = async () => {
    if (!store) return
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) { toast.error('Invalid color — use hex like #4F46E5'); return }
    setSaving(true)
    const { error } = await supabase.from('stores').update({
      theme_id: themeId, brand_color: color, font_id: fontId,
      show_hero: showHero, show_featured: showFeatured, show_about: showAbout,
      announcement_enabled: showAnnouncement,
      announcement_text: announceText.trim() || null,
      tagline: tagline.slice(0, 100) || null,
      return_policy: returnPolicy.trim() || null,
      shipping_policy: shippingPolicy.trim() || null,
      about_text: aboutText.trim() || null,
    }).eq('id', store.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Theme saved ✓')
    qc.invalidateQueries({ queryKey: ['stores', user?.id] })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Themes & Customisation</h1>
          <p className="mt-1 text-sm text-muted-foreground">Design your storefront — no code needed</p>
        </div>
        <Button onClick={save} disabled={saving || isLoading || !store} className="bg-gradient-primary">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
        </Button>
      </div>

      {isLoading || !store ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <Tabs defaultValue="design">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="sections">Sections</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="policies">Policies</TabsTrigger>
          </TabsList>

          {/* ── DESIGN TAB ── */}
          <TabsContent value="design" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-5 lg:col-span-1">
                {/* Theme picker */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="mb-4 text-base font-semibold">Theme</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {previewThemes.map((t) => (
                      <button key={t.id} onClick={() => setThemeId(t.id)}
                        className={`relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all ${themeId === t.id ? 'border-primary shadow-glow' : 'border-border hover:border-primary/50'}`}>
                        <div className="mb-2 h-14 rounded-lg" style={{ background: `linear-gradient(135deg, ${t.swatch}, ${t.swatch}99)` }} />
                        <div className="text-xs font-semibold">{t.name}</div>
                        {themeId === t.id && <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></div>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brand color */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="mb-4 text-base font-semibold">Brand color</h2>
                  <div className="flex items-center gap-3">
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent" />
                    <Input value={color} onChange={e => setColor(e.target.value)} className="font-mono" maxLength={7} />
                  </div>
                </div>

                {/* Font selector — SRS M3 */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="mb-4 text-base font-semibold"><Type className="inline mr-1.5 h-4 w-4" />Font style</h2>
                  <div className="space-y-2">
                    {FONTS.map(f => (
                      <button key={f.id} onClick={() => setFontId(f.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all ${fontId === f.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                        <div>
                          <p className="text-sm font-semibold" style={{ fontFamily: f.css }}>{f.name}</p>
                          <p className="text-xs text-muted-foreground">{f.sample}</p>
                        </div>
                        {fontId === f.id && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live preview */}
              <div className="lg:col-span-2">
                <div className="sticky top-24">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold">Live preview</h2>
                    <Link to="/shop"><Button variant="outline" size="sm"><Eye className="mr-1.5 h-4 w-4" /> Open storefront</Button></Link>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elegant" style={themeCssVars(activeTheme)}>
                    <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
                      <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-red-400" /><div className="h-2.5 w-2.5 rounded-full bg-yellow-400" /><div className="h-2.5 w-2.5 rounded-full bg-green-400" /></div>
                      <div className="mx-auto rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">{store?.subdomain || 'your-shop'}.bazarhq.com</div>
                    </div>
                    {showAnnouncement && announceText && (
                      <div className="px-4 py-2 text-center text-xs font-medium text-white" style={{ background: color }}>{announceText}</div>
                    )}
                    <div className="p-5" style={{ fontFamily: activeFont.css }}>
                      {showHero && (
                        <div className="mb-4 rounded-xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}>
                          <p className="text-xs uppercase tracking-wider opacity-80">Welcome to</p>
                          <h3 className="mt-1 text-2xl font-bold">{store?.shop_name || 'Your shop'}</h3>
                          {tagline && <p className="mt-1 text-sm opacity-90">{tagline}</p>}
                          <button className="mt-3 rounded-full bg-white px-4 py-1.5 text-xs font-semibold" style={{ color }}>Shop now</button>
                        </div>
                      )}
                      {showFeatured && (
                        <div className="mb-4">
                          <p className="mb-2 text-sm font-semibold">Featured Products</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[0,1,2].map(i => <div key={i}><div className="aspect-square rounded-lg bg-muted" /><div className="mt-1 h-2.5 w-2/3 rounded bg-muted" /><div className="mt-1 h-2.5 w-1/3 rounded bg-muted" /></div>)}
                          </div>
                        </div>
                      )}
                      {showAbout && aboutText && (
                        <div className="mb-4 rounded-xl border border-border p-3">
                          <p className="text-xs font-semibold mb-1">About us</p>
                          <p className="text-xs text-muted-foreground line-clamp-3">{aboutText}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── SECTIONS TAB — SRS M3 ── */}
          <TabsContent value="sections" className="mt-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-1 text-base font-semibold"><Layout className="inline mr-1.5 h-4 w-4" />Homepage sections</h2>
              <p className="mb-5 text-sm text-muted-foreground">Toggle sections on/off. Changes reflect on your storefront within 5 seconds.</p>
              <div className="space-y-1 divide-y divide-border">
                {[
                  { label: 'Hero banner', desc: 'Full-width welcome banner at the top', checked: showHero, onChange: setShowHero },
                  { label: 'Featured products', desc: 'Showcase selected products on the homepage', checked: showFeatured, onChange: setShowFeatured },
                  { label: 'About us section', desc: 'Tell your brand story', checked: showAbout, onChange: setShowAbout },
                  { label: 'Announcement bar', desc: 'Show a banner message (e.g. free delivery)', checked: showAnnouncement, onChange: setShowAnnouncement },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between gap-4 py-4">
                    <div>
                      <p className="text-sm font-medium">{s.label}</p>
                      <p className="text-xs text-muted-foreground">{s.desc}</p>
                    </div>
                    <Switch checked={s.checked} onCheckedChange={s.onChange} />
                  </div>
                ))}
              </div>
              {showAnnouncement && (
                <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
                  <Label className="mb-2 block text-sm font-medium">Announcement text <span className="text-muted-foreground font-normal text-xs">({announceText.length}/140)</span></Label>
                  <Input value={announceText} onChange={e => setAnnounceText(e.target.value.slice(0,140))} placeholder="Free delivery in Dhaka over ৳ 2000 🎉" />
                </div>
              )}
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-1 text-base font-semibold">Shop tagline</h2>
              <p className="mb-3 text-sm text-muted-foreground">Shows under your shop name (max 100 characters)</p>
              <Input value={tagline} onChange={e => setTagline(e.target.value.slice(0,100))} placeholder="Premium leather goods, handcrafted in Dhaka" maxLength={100} />
              <p className="mt-1 text-xs text-muted-foreground">{tagline.length}/100</p>
            </div>
          </TabsContent>

          {/* ── CONTENT TAB ── */}
          <TabsContent value="content" className="mt-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-1 text-base font-semibold">About us</h2>
              <p className="mb-3 text-sm text-muted-foreground">Tell your brand story. Shown in the About section on your storefront.</p>
              <Textarea value={aboutText} onChange={e => setAboutText(e.target.value)} rows={6}
                placeholder="We started in 2018 making premium leather goods by hand in Dhaka. Every product is crafted with care and built to last…" maxLength={1000} />
              <p className="mt-1 text-xs text-muted-foreground">{aboutText.length}/1000</p>
            </div>
          </TabsContent>

          {/* ── POLICIES TAB — SRS M3 ── */}
          <TabsContent value="policies" className="mt-4 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-1 flex items-center gap-2 text-base font-semibold"><FileText className="h-4 w-4" />Return policy</h2>
              <p className="mb-3 text-sm text-muted-foreground">Displayed on product pages and at checkout. Be clear about returns & exchanges.</p>
              <Textarea value={returnPolicy} onChange={e => setReturnPolicy(e.target.value)} rows={6}
                placeholder="Items can be returned within 7 days of delivery if unused and in original packaging. To initiate a return, contact us via WhatsApp…" maxLength={2000} />
              <p className="mt-1 text-xs text-muted-foreground">{returnPolicy.length}/2000</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-1 flex items-center gap-2 text-base font-semibold"><FileText className="h-4 w-4" />Shipping policy</h2>
              <p className="mb-3 text-sm text-muted-foreground">Let customers know your delivery timelines and areas.</p>
              <Textarea value={shippingPolicy} onChange={e => setShippingPolicy(e.target.value)} rows={6}
                placeholder="We deliver across Bangladesh. Dhaka: 1-2 days. Outside Dhaka: 3-5 days. Free delivery on orders above ৳ 2000…" maxLength={2000} />
              <p className="mt-1 text-xs text-muted-foreground">{shippingPolicy.length}/2000</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
              <Megaphone className="mb-1 inline h-4 w-4 mr-1" />
              These policies appear as links on your checkout page under "Review Order". Keep them clear and honest.
            </div>
          </TabsContent>
        </Tabs>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !store} className="bg-gradient-primary shadow-glow px-8">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save all changes
        </Button>
      </div>
    </div>
  )
}
