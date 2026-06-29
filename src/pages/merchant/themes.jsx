import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Loader2, Palette, Save, Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentStore } from '@/lib/use-current-store'
import {
  ANIMATION_OPTIONS,
  BACKGROUND_OPTIONS,
  BUTTON_OPTIONS,
  CARD_OPTIONS,
  DENSITY_OPTIONS,
  FONT_OPTIONS,
  HERO_OPTIONS,
  LAYOUT_OPTIONS,
  NAV_OPTIONS,
  RADIUS_OPTIONS,
  getStoreTheme,
  mergePlatformThemes,
  normalizeTheme,
  themePreviewStyle,
  themeToStorePatch,
} from '@/lib/theme-system'
import { buildStorefrontPath } from '@/lib/storefront-url'

function Field({ label, children }) {
  return <label className="space-y-2"><span className="text-xs font-bold text-slate-600">{label}</span>{children}</label>
}

function SelectField({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">
        {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </Field>
  )
}

function ColorInput({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-12 cursor-pointer rounded-xl border-0 bg-transparent p-0" />
        <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 border-0 bg-slate-50 font-mono text-sm focus-visible:ring-0" placeholder="#635bff" />
      </div>
    </Field>
  )
}

function ThemeCard({ theme, selected, onSelect }) {
  const normalized = normalizeTheme(theme)
  return (
    <button type="button" onClick={() => onSelect(normalized)} className={`group rounded-[1.35rem] border p-3 text-left transition duration-300 hover:-translate-y-1 hover:shadow-xl ${selected ? 'border-[var(--theme-primary)] bg-white shadow-lg shadow-slate-200' : 'border-slate-200 bg-white/80 hover:border-slate-300'}`} style={themePreviewStyle(normalized)}>
      <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-slate-100 p-3">
        <div className="absolute inset-0 opacity-90" style={{ background: `linear-gradient(135deg, ${normalized.primary_color}, ${normalized.accent_color})` }} />
        <div className="relative space-y-3">
          <div className="h-3 w-14 rounded-full bg-white/80" />
          <div className="h-16 rounded-2xl bg-white/20 ring-1 ring-white/35" />
          <div className={`grid gap-2 ${normalized.product_grid === 'four' ? 'grid-cols-4' : normalized.product_grid === 'two' ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {Array.from({ length: normalized.product_grid === 'four' ? 4 : normalized.product_grid === 'two' ? 2 : 3 }).map((_, idx) => <span key={idx} className="h-8 rounded-xl bg-white/45" />)}
          </div>
        </div>
        {selected && <span className="absolute right-2 top-2 rounded-full bg-white px-2 py-1 text-[10px] font-black text-[var(--theme-primary)] shadow-sm">Selected</span>}
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div><h3 className="text-sm font-black text-slate-950">{normalized.name}</h3><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{normalized.description}</p></div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{normalized.layout_preset}</span>
      </div>
    </button>
  )
}

function LivePreview({ store, draft }) {
  const shopName = store?.shop_name || 'Your shop'
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm" style={themePreviewStyle(draft)}>
      <div className={`flex items-center justify-between border-b border-slate-100 px-5 py-3 ${draft.nav_style === 'dark' ? 'bg-slate-950 text-white' : 'bg-white'}`}>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-rose-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-emerald-400" /></div>
        <span className="text-xs font-semibold opacity-70">{store?.subdomain || 'store'}.bazarhq.com</span>
      </div>
      <div className="p-5" style={{ fontFamily: 'var(--shop-font-family)', background: 'var(--shop-page-bg)' }}>
        <div className={`grid gap-4 ${draft.hero_style === 'centered' ? 'text-center' : 'md:grid-cols-[.8fr_1.2fr]'} overflow-hidden p-5 text-white`} style={{ borderRadius: 'var(--shop-radius)', background: `linear-gradient(135deg, ${draft.secondary_color}, ${draft.primary_color})` }}>
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-white/80">{draft.layout_preset}</p><h2 className="mt-2 text-3xl font-black tracking-tight">{shopName}</h2><p className="mt-2 max-w-md text-sm text-white/85">{store?.tagline || 'Discover quality products with a smooth checkout experience.'}</p><button type="button" className="mt-5 bg-white px-5 py-2 text-xs font-black" style={{ color: draft.primary_color, borderRadius: 'var(--shop-button-radius)' }}>Shop now</button></div>
          {draft.hero_style !== 'centered' && <div className="min-h-32 rounded-[var(--shop-card-radius)] bg-white/20 ring-1 ring-white/30" />}
        </div>
        <div className={`mt-5 grid gap-3 ${draft.product_grid === 'four' ? 'grid-cols-4' : draft.product_grid === 'two' ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {Array.from({ length: draft.product_grid === 'four' ? 4 : draft.product_grid === 'two' ? 2 : 3 }).map((_, item) => <div key={item} className="border border-slate-100 bg-white p-3 shadow-sm" style={{ borderRadius: 'var(--shop-card-radius)' }}><div className="h-20 rounded-xl" style={{ background: item === 0 ? `${draft.primary_color}22` : item === 1 ? `${draft.accent_color}22` : `${draft.secondary_color}22` }} /><div className="mt-3 h-2 w-3/4 rounded-full bg-slate-200" /><div className="mt-2 h-2 w-1/2 rounded-full" style={{ background: draft.primary_color }} /></div>)}
        </div>
      </div>
    </div>
  )
}

export default function ThemesPage() {
  const qc = useQueryClient()
  const { store, isLoading } = useCurrentStore()
  const [selected, setSelected] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  const platformThemes = useQuery({
    queryKey: ['platform-themes-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('platform_themes').select('*').eq('is_active', true).order('is_default', { ascending: false }).order('name', { ascending: true })
      if (error) { console.warn('Platform themes could not be loaded. Using built-in themes.', error.message); return [] }
      return data || []
    },
    staleTime: 30_000,
  })

  const themes = useMemo(() => mergePlatformThemes(platformThemes.data || []), [platformThemes.data])

  useEffect(() => {
    if (!store || !themes.length) return
    const current = getStoreTheme(store, themes)
    setSelected(current.slug)
    setDraft(current)
  }, [store, themes])

  function selectTheme(theme) {
    const normalized = normalizeTheme(theme)
    setSelected(normalized.slug)
    setDraft(normalized)
  }

  function patchDraft(partial) { setDraft((prev) => normalizeTheme({ ...prev, ...partial })) }

  async function saveTheme() {
    if (!store?.id || !draft) return
    setSaving(true)
    const patch = themeToStorePatch(draft)
    const { error } = await supabase.from('stores').update(patch).eq('id', store.id).eq('owner_id', store.owner_id)
    if (error) {
      setSaving(false)
      toast.error(error.message || 'Could not save theme')
      return
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['stores'] }),
      qc.invalidateQueries({ queryKey: ['current-store-id'] }),
      qc.invalidateQueries({ queryKey: ['shop-profile'] }),
      qc.invalidateQueries({ queryKey: ['publish-status'] }),
      qc.invalidateQueries({ queryKey: ['platform-themes-active'] }),
    ])
    try { localStorage.setItem(`bazarhq_theme_refresh_${store.subdomain}`, String(Date.now())) } catch {}
    setSaving(false)
    toast.success('Theme layout, font, and style applied to your live storefront')
  }

  if (isLoading) return <div className="p-8 text-sm text-slate-500">Loading theme settings...</div>
  if (!store) return <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center"><Palette className="mx-auto h-10 w-10 text-slate-300" /><h1 className="mt-4 text-2xl font-black">No active store found</h1><p className="mt-2 text-sm text-slate-500">Create a store first, then choose a storefront theme.</p></div>

  const openPath = buildStorefrontPath(store.subdomain)

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-indigo-600"><Wand2 className="h-4 w-4" /> Storefront design system</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Themes & Customisation</h1><p className="mt-1 text-sm text-slate-500">Themes now control layout, fonts, navbar, hero, cards, buttons, spacing and animations.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" className="rounded-2xl" asChild><a href={openPath} target="_blank" rel="noreferrer"><Eye className="mr-2 h-4 w-4" /> Open storefront</a></Button><Button className="rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={saveTheme} disabled={saving || !draft}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save changes</Button></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
        <section className="space-y-5 rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-black text-slate-950">Available themes</h2><p className="mt-1 text-xs text-slate-500">Super Admin-created active themes appear here automatically.</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">{themes.length} themes</span></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{themes.map((theme) => <ThemeCard key={theme.slug} theme={theme} selected={selected === theme.slug} onSelect={selectTheme} />)}</div>
        </section>

        <section className="space-y-5">
          <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-base font-black text-slate-950">Live preview</h2><p className="mt-1 text-xs text-slate-500">Preview updates before saving. Save to update the real storefront.</p></div>{draft && <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: draft.primary_color }}>{draft.name}</span>}</div>
            {draft && <LivePreview store={store} draft={draft} />}
          </div>

          {draft && (
            <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-500" /><div><h2 className="text-base font-black text-slate-950">Customize selected theme</h2><p className="text-xs text-slate-500">Color, typography, layout and component style are stored in this shop.</p></div></div>
              <div className="grid gap-4 md:grid-cols-3"><ColorInput label="Primary color" value={draft.primary_color} onChange={(value) => patchDraft({ primary_color: value })} /><ColorInput label="Secondary color" value={draft.secondary_color} onChange={(value) => patchDraft({ secondary_color: value })} /><ColorInput label="Accent color" value={draft.accent_color} onChange={(value) => patchDraft({ accent_color: value })} /></div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <SelectField label="Storefront layout" value={draft.layout_preset} onChange={(v) => patchDraft({ layout_preset: v })} options={LAYOUT_OPTIONS} />
                <SelectField label="Font style" value={draft.font_family} onChange={(v) => patchDraft({ font_family: v })} options={FONT_OPTIONS} />
                <SelectField label="Navbar style" value={draft.nav_style} onChange={(v) => patchDraft({ nav_style: v })} options={NAV_OPTIONS} />
                <SelectField label="Hero layout" value={draft.hero_style} onChange={(v) => patchDraft({ hero_style: v })} options={HERO_OPTIONS} />
                <SelectField label="Product card" value={draft.card_style} onChange={(v) => patchDraft({ card_style: v })} options={CARD_OPTIONS} />
                <SelectField label="Button style" value={draft.button_style} onChange={(v) => patchDraft({ button_style: v })} options={BUTTON_OPTIONS} />
                <SelectField label="Corner radius" value={draft.corner_radius} onChange={(v) => patchDraft({ corner_radius: v })} options={RADIUS_OPTIONS} />
                <SelectField label="Spacing density" value={draft.density} onChange={(v) => patchDraft({ density: v })} options={DENSITY_OPTIONS} />
                <SelectField label="Background" value={draft.background_style} onChange={(v) => patchDraft({ background_style: v })} options={BACKGROUND_OPTIONS} />
                <SelectField label="Animation" value={draft.animation_style} onChange={(v) => patchDraft({ animation_style: v })} options={ANIMATION_OPTIONS} />
                <SelectField label="Product grid" value={draft.product_grid} onChange={(v) => patchDraft({ product_grid: v })} options={[{ value: 'two', label: '2 columns' }, { value: 'three', label: '3 columns' }, { value: 'four', label: '4 columns' }]} />
              </div>
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">New platform theme presets are created from <strong>Super Admin → Themes</strong>. Merchants can still personalize the selected preset before applying it.</div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
