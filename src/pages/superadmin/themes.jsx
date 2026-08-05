import { useEffect, useMemo, useState } from 'react'
import { Check, Palette, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { formatDate, statusClass } from '@/lib/superadmin-utils'

const blankTheme = { name: '', slug: '', description: '', primary_color: '#635bff', secondary_color: '#10b981', accent_color: '#f97316', is_active: true, is_default: false }

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

  function editTheme(theme) {
    setEditing(theme?.id || null)
    setForm(theme ? { ...theme } : blankTheme)
  }

  async function saveTheme(e) {
    e.preventDefault()
    const payload = { ...form, slug: (form.slug || form.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), updated_at: new Date().toISOString() }
    if (!payload.name || !payload.slug) return alert('Theme name is required')
    if (payload.is_default) await supabase.from('platform_themes').update({ is_default: false }).neq('id', editing || '00000000-0000-0000-0000-000000000000')
    if (editing) await supabase.from('platform_themes').update(payload).eq('id', editing)
    else await supabase.from('platform_themes').insert(payload)
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-bold uppercase tracking-[0.24em] text-violet-300">Design system</p><h1 className="mt-2 text-3xl font-black">Theme Management</h1><p className="mt-2 text-slate-400">Create, preview, activate, and protect storefront themes used by merchants.</p></div>
        <button onClick={() => editTheme(null)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold"><Plus className="h-4 w-4" /> New theme</button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className="grid gap-4 md:grid-cols-2">
          {loading ? <p className="text-slate-400">Loading themes...</p> : themes.map((theme) => {
            const count = (usage.get(theme.slug) || 0) + (usage.get(theme.id) || 0)
            return (
              <div key={theme.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-5 h-32 overflow-hidden rounded-3xl border border-white/10" style={{ background: `linear-gradient(135deg, ${theme.primary_color}, ${theme.secondary_color})` }}>
                  <div className="flex h-full items-end justify-between bg-black/20 p-4"><div><p className="text-xl font-black">{theme.name}</p><p className="text-xs text-white/70">{theme.slug}</p></div><Palette className="h-6 w-6" /></div>
                </div>
                <div className="flex items-start justify-between gap-4"><div><p className="font-black">{theme.name}</p><p className="mt-1 text-sm text-slate-400">{theme.description || 'No description.'}</p></div><span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusClass(theme.is_active ? 'active' : 'disabled')}`}>{theme.is_active ? 'Active' : 'Disabled'}</span></div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400"><span>{count} stores using</span><span>·</span><span>{formatDate(theme.updated_at || theme.created_at)}</span>{theme.is_default ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-200">Default</span> : null}</div>
                <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => editTheme(theme)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold">Edit</button><button onClick={() => setDefault(theme)} className="rounded-xl border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-200"><Check className="inline h-3 w-3" /> Default</button><button onClick={() => toggleActive(theme)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold">{theme.is_active ? 'Deactivate' : 'Activate'}</button><button onClick={() => deleteTheme(theme)} className="rounded-xl border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-200"><Trash2 className="inline h-3 w-3" /> Delete</button></div>
              </div>
            )
          })}
        </section>

        <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-4 text-lg font-black">{editing ? 'Edit theme' : 'Create theme'}</h2>
          <form onSubmit={saveTheme} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-300">Name<input value={form.name || ''} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" /></label>
            <label className="block text-sm font-semibold text-slate-300">Slug<input value={form.slug || ''} onChange={(e) => setForm((v) => ({ ...v, slug: e.target.value }))} placeholder="auto-generated" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" /></label>
            <label className="block text-sm font-semibold text-slate-300">Description<textarea value={form.description || ''} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} rows={3} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" /></label>
            <div className="grid grid-cols-3 gap-3">{['primary_color', 'secondary_color', 'accent_color'].map((key) => <label key={key} className="text-xs font-semibold capitalize text-slate-400">{key.replace('_color', '')}<input type="color" value={form[key] || '#635bff'} onChange={(e) => setForm((v) => ({ ...v, [key]: e.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-transparent" /></label>)}</div>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 p-3 text-sm"><input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm((v) => ({ ...v, is_active: e.target.checked }))} /> Active theme</label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 p-3 text-sm"><input type="checkbox" checked={!!form.is_default} onChange={(e) => setForm((v) => ({ ...v, is_default: e.target.checked }))} /> Set as default</label>
            <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold"><Save className="h-4 w-4" /> Save theme</button>
            <button type="button" onClick={() => { setEditing(null); setForm(blankTheme) }} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold"><RefreshCw className="h-4 w-4" /> Reset</button>
          </form>
        </aside>
      </div>
    </div>
  )
}
