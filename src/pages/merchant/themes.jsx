import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Check, Eye, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useQueryClient } from '@tanstack/react-query'
import { previewThemes, getTheme, themeCssVars, DEFAULT_THEME_ID } from '@/lib/preview-themes'
import { useCurrentStore } from '@/lib/use-current-store'

function ThemesPage() {
  const { user } = useAuth()
  const { store, isLoading } = useCurrentStore()
  const qc = useQueryClient()
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID)
  const [color, setColor] = useState('#6366f1')
  const [announceText, setAnnounceText] = useState('')
  const [announceOn, setAnnounceOn] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!store) return
    setThemeId(store.theme_id ?? DEFAULT_THEME_ID)
    setColor(store.brand_color ?? '#6366f1')
    setAnnounceText(store.announcement_text ?? '')
    setAnnounceOn(!!store.announcement_enabled)
  }, [store])

  const activeTheme = getTheme(themeId)

  const save = async () => {
    if (!store) return
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) { toast.error('Brand color must be a valid hex like #4F46E5'); return }
    setSaving(true)
    const { error } = await supabase.from('stores').update({ theme_id: themeId, brand_color: color, announcement_text: announceText.trim() || null, announcement_enabled: announceOn }).eq('id', store.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Theme saved')
    qc.invalidateQueries({ queryKey: ['stores', user?.id] })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Themes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pick a theme, brand color and announcement bar</p>
        </div>
        <Button onClick={save} disabled={saving || isLoading || !store} className="bg-gradient-primary">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save theme
        </Button>
      </div>

      {isLoading || !store ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-4 text-base font-semibold">Choose theme</h2>
              <div className="grid grid-cols-2 gap-3">
                {previewThemes.map((t) => (
                  <button key={t.id} onClick={() => setThemeId(t.id)} className={`relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all ${themeId === t.id ? 'border-primary shadow-glow' : 'border-border hover:border-primary/50'}`}>
                    <div className="mb-3 h-20 rounded-lg" style={{ background: `linear-gradient(135deg, ${t.swatch}, ${t.swatch}99)` }} />
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">Brand-ready palette</div>
                    {themeId === t.id && <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></div>}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-4 text-base font-semibold">Brand color</h2>
              <div className="flex items-center gap-3">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent" />
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono" maxLength={7} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Used in the storefront announcement bar and accents.</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-4 text-base font-semibold">Announcement bar</h2>
              <div className="mb-3 flex items-center justify-between">
                <Label>Show announcement</Label>
                <Switch checked={announceOn} onCheckedChange={setAnnounceOn} />
              </div>
              <Input value={announceText} onChange={(e) => setAnnounceText(e.target.value)} placeholder="Free delivery in Dhaka over ৳ 2000" maxLength={140} />
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="sticky top-24">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold">Live preview</h2>
                <Link to="/shop"><Button variant="outline" size="sm"><Eye className="mr-1.5 h-4 w-4" /> Open storefront</Button></Link>
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elegant" style={themeCssVars(activeTheme)}>
                <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
                  <div className="flex gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-red-400" /><div className="h-2.5 w-2.5 rounded-full bg-yellow-400" /><div className="h-2.5 w-2.5 rounded-full bg-green-400" /></div>
                  <div className="mx-auto rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">{store?.subdomain ? `${store.subdomain}.bazarhq.com` : 'your-shop.bazarhq.com'}</div>
                </div>
                {announceOn && announceText && (
                  <div className="px-4 py-2 text-center text-xs font-medium text-white" style={{ background: color }}>{announceText}</div>
                )}
                <div className="p-6">
                  <div className="rounded-xl p-8 text-white bg-gradient-primary">
                    <div className="text-xs uppercase tracking-wider opacity-80">Welcome</div>
                    <h3 className="mt-2 text-3xl font-semibold">{store?.shop_name || 'Your shop'}</h3>
                    <p className="mt-2 text-sm opacity-90">Theme & color update instantly across your storefront.</p>
                    <button className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-medium" style={{ color: activeTheme.swatch }}>Shop now</button>
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {[0,1,2].map((i) => (
                      <div key={i}><div className="aspect-square rounded-xl bg-muted" /><div className="mt-2 h-3 w-2/3 rounded bg-muted" /><div className="mt-1 h-3 w-1/3 rounded bg-muted" /></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ThemesPage
