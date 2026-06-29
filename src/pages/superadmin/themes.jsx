import { useEffect, useMemo, useState } from 'react'
import { Check, Palette, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { formatDate, statusClass } from '@/lib/superadmin-utils'
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
  normalizeTheme,
  themePreviewStyle,
  themeToPlatformPayload,
} from '@/lib/theme-system'

const blankTheme = normalizeTheme({
  name: '',
  slug: '',
  description: '',
  primary_color: '#635bff',
  secondary_color: '#312e81',
  accent_color: '#8b5cf6',
  layout_preset: 'modern-brand',
  font_family: 'inter',
  nav_style: 'glass',
  hero_style: 'banner-right',
  card_style: 'soft',
  button_style: 'pill',
  corner_radius: 'extra',
  density: 'comfortable',
  background_style: 'gradient',
  animation_style: 'smooth',
  product_grid: 'three',
  is_active: true,
  is_default: false,
})

function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function TextInput({ label, children }) {
  return <label className="block text-sm font-semibold text-slate-300">{label}{children}</label>
}

function SelectField({ label, value, onChange, options }) {
  return (
    <TextInput label={label}>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none">
        {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </TextInput>
  )
}

function ThemeMiniPreview({ theme }) {
  const normalized = normalizeTheme(theme)
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10" style={themePreviewStyle(normalized)}>
      <div className={`${normalized.nav_style === 'dark' ? 'bg-slate-950' : 'bg-white/90'} flex items-center justify-between px-4 py-3`}>
        <div className="flex items-center gap-2"><span className="h-7 w-7 rounded-xl bg-[var(--shop-primary)]" /><span className="h-2 w-20 rounded-full bg-slate-300/70" /></div>
        <span className="h-2 w-12 rounded-full bg-slate-300/70" />
      </div>
      <div className="p-4" style={{ background: 'var(--shop-page-bg)', fontFamily: 'var(--shop-font-family)' }}>
        <div className={`grid gap-3 ${normalized.hero_style === 'centered' ? 'text-center' : 'grid-cols-[.8fr_1.2fr]'} rounded-[var(--shop-radius)] p-4 text-white`} style={{ background: 'var(--shop-gradient)' }}>
          <div><p className="text-[10px] font-black uppercase tracking-widest opacity-80">{normalized.layout_preset}</p><p className="mt-2 text-xl font-black">{normalized.name || 'Theme name'}</p><button className="mt-3 bg-white px-4 py-2 text-xs font-black" style={{ color: normalized.primary_color, borderRadius: 'var(--shop-button-radius)' }}>Shop</button></div>
          {normalized.hero_style !== 'centered' && <div className="rounded-[var(--shop-card-radius)] bg-white/20" />}
        </div>
        <div className={`mt-4 grid gap-2 ${normalized.product_grid === 'four' ? 'grid-cols-4' : normalized.product_grid === 'two' ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {Array.from({ length: normalized.product_grid === 'four' ? 4 : normalized.product_grid === 'two' ? 2 : 3 }).map((_, idx) => <span key={idx} className="h-16 bg-white/90 shadow-sm" style={{ borderRadius: 'var(--shop-card-radius)' }} />)}
        </div>
      </div>
    </div>
  )
}

export default function SuperAdminThemes() {
  const [themes, setThemes] = useState([])
  const [stores, setStores] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankTheme)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [themeRes, storeRes] = await Promise.all([
      supabase.from('platform_themes').select('*').order('is_default', { ascending: false }).order('created_at', { ascending: true }),
      supabase.from('stores').select('id, theme_id'),
    ])
    setThemes(themeRes.data || [])
    setStores(storeRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const usage = useMemo(() => {
    const map = new Map()
    stores.forEach((s) => map.set(s.theme_id || 'emerald', (map.get(s.theme_id || 'emerald') || 0) + 1))
    return map
  }, [stores])

  function updateForm(partial) { setForm((value) => normalizeTheme({ ...value, ...partial })) }

  function editTheme(theme) {
    setEditing(theme?.id || null)
    setForm(theme ? normalizeTheme(theme) : blankTheme)
  }

  async function saveTheme(e) {
    e.preventDefault()
    const normalized = normalizeTheme({ ...form, slug: slugify(form.slug || form.name) })
    if (!normalized.name || !normalized.slug) return alert('Theme name is required')
    const payload = themeToPlatformPayload(normalized)
    if (payload.is_default) await supabase.from('platform_themes').update({ is_default: false }).neq('id', editing || '00000000-0000-0000-0000-000000000000')
    const res = editing
      ? await supabase.from('platform_themes').update(payload).eq('id', editing)
      : await supabase.from('platform_themes').insert(payload)
    if (res.error) return alert(res.error.message)
    setEditing(null)
    setForm(blankTheme)
    await load()
  }

  async function setDefault(theme) {
    await supabase.from('platform_themes').update({ is_default: false })
    await supabase.from('platform_themes').update({ is_default: true, is_active: true }).eq('id', theme.id)
    await load()
  }

  async function toggleActive(theme) {
    if (theme.is_default && theme.is_active) return alert('Default theme must remain active.')
    await supabase.from('platform_themes').update({ is_active: !theme.is_active, updated_at: new Date().toISOString() }).eq('id', theme.id)
    await load()
  }

  async function deleteTheme(theme) {
    if (theme.is_default) return alert('Default theme cannot be deleted.')
    if ((usage.get(theme.slug) || 0) > 0 || (usage.get(theme.id) || 0) > 0) return alert('This theme is used by merchants. Deactivate it instead of deleting.')
    if (!confirm(`Delete theme ${theme.name}?`)) return
    await supabase.from('platform_themes').delete().eq('id', theme.id)
    await load()
  }

  const normalizedForm = normalizeTheme(form)

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-bold uppercase tracking-[0.24em] text-violet-300">Design system</p><h1 className="mt-2 text-3xl font-black">Theme Management</h1><p className="mt-2 text-slate-400">Create full storefront themes: layout, fonts, cards, hero, navbar, buttons and animation presets.</p></div>
        <button onClick={() => editTheme(null)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold"><Plus className="h-4 w-4" /> New theme</button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="grid gap-4 md:grid-cols-2">
          {loading ? <p className="text-slate-400">Loading themes...</p> : themes.map((theme) => {
            const normalized = normalizeTheme(theme)
            const count = (usage.get(normalized.slug) || 0) + (usage.get(theme.id) || 0)
            return (
              <div key={theme.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <ThemeMiniPreview theme={normalized} />
                <div className="mt-5 flex items-start justify-between gap-4"><div><p className="font-black">{normalized.name}</p><p className="mt-1 text-sm text-slate-400">{normalized.description || 'No description.'}</p></div><span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusClass(normalized.is_active ? 'active' : 'disabled')}`}>{normalized.is_active ? 'Active' : 'Disabled'}</span></div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400"><span>{count} stores using</span><span>·</span><span>{formatDate(theme.updated_at || theme.created_at)}</span><span>·</span><span>{normalized.layout_preset}</span><span>·</span><span>{normalized.font_family}</span>{normalized.is_default ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-200">Default</span> : null}</div>
                <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => editTheme(theme)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold">Edit</button><button onClick={() => setDefault(theme)} className="rounded-xl border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-200"><Check className="inline h-3 w-3" /> Default</button><button onClick={() => toggleActive(theme)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold">{normalized.is_active ? 'Deactivate' : 'Activate'}</button><button onClick={() => deleteTheme(theme)} className="rounded-xl border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-200"><Trash2 className="inline h-3 w-3" /> Delete</button></div>
              </div>
            )
          })}
        </section>

        <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-4 text-lg font-black">{editing ? 'Edit theme' : 'Create theme'}</h2>
          <form onSubmit={saveTheme} className="space-y-4">
            <TextInput label="Name"><input value={form.name || ''} onChange={(e) => updateForm({ name: e.target.value })} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" /></TextInput>
            <TextInput label="Slug"><input value={form.slug || ''} onChange={(e) => updateForm({ slug: e.target.value })} placeholder="auto-generated" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" /></TextInput>
            <TextInput label="Description"><textarea value={form.description || ''} onChange={(e) => updateForm({ description: e.target.value })} rows={3} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" /></TextInput>
            <div className="grid grid-cols-3 gap-3">{['primary_color', 'secondary_color', 'accent_color'].map((key) => <label key={key} className="text-xs font-semibold capitalize text-slate-400">{key.replace('_color', '')}<input type="color" value={form[key] || '#635bff'} onChange={(e) => updateForm({ [key]: e.target.value })} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-transparent" /></label>)}</div>
            <div className="grid gap-3 md:grid-cols-2">
              <SelectField label="Layout" value={normalizedForm.layout_preset} onChange={(v) => updateForm({ layout_preset: v })} options={LAYOUT_OPTIONS} />
              <SelectField label="Font" value={normalizedForm.font_family} onChange={(v) => updateForm({ font_family: v })} options={FONT_OPTIONS} />
              <SelectField label="Navbar" value={normalizedForm.nav_style} onChange={(v) => updateForm({ nav_style: v })} options={NAV_OPTIONS} />
              <SelectField label="Hero" value={normalizedForm.hero_style} onChange={(v) => updateForm({ hero_style: v })} options={HERO_OPTIONS} />
              <SelectField label="Cards" value={normalizedForm.card_style} onChange={(v) => updateForm({ card_style: v })} options={CARD_OPTIONS} />
              <SelectField label="Buttons" value={normalizedForm.button_style} onChange={(v) => updateForm({ button_style: v })} options={BUTTON_OPTIONS} />
              <SelectField label="Radius" value={normalizedForm.corner_radius} onChange={(v) => updateForm({ corner_radius: v })} options={RADIUS_OPTIONS} />
              <SelectField label="Density" value={normalizedForm.density} onChange={(v) => updateForm({ density: v })} options={DENSITY_OPTIONS} />
              <SelectField label="Background" value={normalizedForm.background_style} onChange={(v) => updateForm({ background_style: v })} options={BACKGROUND_OPTIONS} />
              <SelectField label="Animation" value={normalizedForm.animation_style} onChange={(v) => updateForm({ animation_style: v })} options={ANIMATION_OPTIONS} />
              <SelectField label="Product grid" value={normalizedForm.product_grid} onChange={(v) => updateForm({ product_grid: v })} options={[{ value: 'two', label: '2 columns' }, { value: 'three', label: '3 columns' }, { value: 'four', label: '4 columns' }]} />
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 p-3 text-sm"><input type="checkbox" checked={!!form.is_active} onChange={(e) => updateForm({ is_active: e.target.checked })} /> Active theme</label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 p-3 text-sm"><input type="checkbox" checked={!!form.is_default} onChange={(e) => updateForm({ is_default: e.target.checked })} /> Set as default</label>
            <ThemeMiniPreview theme={normalizedForm} />
            <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold"><Save className="h-4 w-4" /> Save theme</button>
            <button type="button" onClick={() => { setEditing(null); setForm(blankTheme) }} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold"><RefreshCw className="h-4 w-4" /> Reset</button>
          </form>
        </aside>
      </div>
    </div>
  )
}
