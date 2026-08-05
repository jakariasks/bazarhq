import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FileText, Save, Send, ShieldCheck } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { formatDate, statusClass } from '@/lib/superadmin-utils'

const contentTypes = [
  { key: 'terms', label: 'Terms of Service' },
  { key: 'privacy', label: 'Privacy Policy' },
  { key: 'faq', label: 'FAQ' },
  { key: 'merchant_policy', label: 'Merchant Policy' },
  { key: 'customer_policy', label: 'Customer Policy' },
]

export default function SuperAdminContent() {
  const { admin, writeAuditLog } = useAdminAuth()
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState('terms')
  const [form, setForm] = useState({ title: '', body: '', status: 'draft', effective_at: '' })
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('platform_content').select('*').order('updated_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const current = useMemo(() => rows.find((r) => r.content_type === selected) || null, [rows, selected])

  useEffect(() => {
    setForm({
      title: current?.title || contentTypes.find((c) => c.key === selected)?.label || '',
      body: current?.body || '',
      status: current?.status || 'draft',
      effective_at: current?.effective_at ? new Date(current.effective_at).toISOString().slice(0, 16) : '',
    })
  }, [current, selected])

  async function save(status = form.status) {
    if (!form.title.trim() || !form.body.trim()) return alert('Title and body are required.')
    const payload = {
      content_type: selected,
      title: form.title.trim(),
      body: form.body.trim(),
      status,
      effective_at: form.effective_at ? new Date(form.effective_at).toISOString() : null,
      updated_at: new Date().toISOString(),
      submitted_by: status === 'pending_approval' ? admin?.email : current?.submitted_by || null,
      approved_by: status === 'approved' || status === 'published' ? admin?.email : current?.approved_by || null,
      published_at: status === 'published' ? new Date().toISOString() : current?.published_at || null,
      version: current?.version || 1,
    }
    if (current?.id) await supabase.from('platform_content').update(payload).eq('id', current.id)
    else await supabase.from('platform_content').insert(payload)
    await writeAuditLog?.(`content.${status}`, { content_type: selected, title: payload.title }, 'platform_content', current?.id)
    await load()
  }

  async function workflow(action) {
    if (!current?.id) {
      await save('draft')
      alert('Saved draft first. Click the workflow action again.')
      return
    }
    const { error } = await supabase.rpc(
      action === 'submit' ? 'submit_platform_content' : action === 'approve' ? 'approve_platform_content' : 'publish_platform_content',
      { p_content_id: current.id, p_admin_email: admin?.email || null }
    )
    if (error) return alert(error.message)
    await writeAuditLog?.(`content.${action}`, { content_type: selected }, 'platform_content', current.id)
    await load()
  }

  async function publish() {
    if (!confirm('Publish this approved content publicly?')) return
    await workflow('publish')
  }

  return (
    <div className="space-y-6">
      <div><p className="text-sm font-bold uppercase tracking-[0.24em] text-violet-300">Governance</p><h1 className="mt-2 text-3xl font-black">Content & Policy Management</h1><p className="mt-2 text-slate-400">Manage platform terms, privacy, FAQs, and policies with draft, approval, and publish workflow.</p></div>

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <div className="space-y-2">
            {contentTypes.map((item) => {
              const row = rows.find((r) => r.content_type === item.key)
              return <button key={item.key} onClick={() => setSelected(item.key)} className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${selected === item.key ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-white/5'}`}><span>{item.label}</span>{row ? <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] ${statusClass(row.status)}`}>{row.status}</span> : <span className="mt-2 block text-[10px] text-slate-500">Not created</span>}</button>
            })}
          </div>
        </aside>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-xl font-black">{contentTypes.find((c) => c.key === selected)?.label}</h2><p className="mt-1 text-sm text-slate-400">Last updated: {formatDate(current?.updated_at)} · Version {current?.version || 1}</p></div><span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusClass(current?.status || 'draft')}`}>{current?.status || 'draft'}</span></div>

          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-300">Title<input value={form.title} onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" /></label>
            <label className="block text-sm font-semibold text-slate-300">Body / policy text<textarea value={form.body} onChange={(e) => setForm((v) => ({ ...v, body: e.target.value }))} rows={16} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" /></label>
            <label className="block text-sm font-semibold text-slate-300">Effective date<input type="datetime-local" value={form.effective_at} onChange={(e) => setForm((v) => ({ ...v, effective_at: e.target.value }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" /></label>
            <div className="grid gap-3 sm:grid-cols-4"><button onClick={() => save('draft')} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold"><Save className="inline h-4 w-4" /> Save draft</button><button onClick={() => workflow('submit')} className="rounded-2xl border border-amber-500/30 px-4 py-3 text-sm font-bold text-amber-200"><Send className="inline h-4 w-4" /> Submit</button><button onClick={() => workflow('approve')} className="rounded-2xl border border-emerald-500/30 px-4 py-3 text-sm font-bold text-emerald-200"><ShieldCheck className="inline h-4 w-4" /> Approve</button><button onClick={publish} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold"><CheckCircle2 className="inline h-4 w-4" /> Publish</button></div>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-black"><FileText className="h-5 w-5" /> Published content summary</h2><div className="overflow-hidden rounded-2xl border border-white/10"><table className="w-full text-left text-sm"><thead className="bg-white/[0.04] text-xs uppercase text-slate-500"><tr><th className="p-3">Type</th><th className="p-3">Title</th><th className="p-3">Status</th><th className="p-3">Effective</th></tr></thead><tbody className="divide-y divide-white/10">{rows.map((row) => <tr key={row.id}><td className="p-3">{row.content_type}</td><td className="p-3 font-semibold">{row.title}</td><td className="p-3"><span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusClass(row.status)}`}>{row.status}</span></td><td className="p-3 text-slate-400">{formatDate(row.effective_at)}</td></tr>)}</tbody></table></div></section>
    </div>
  )
}
