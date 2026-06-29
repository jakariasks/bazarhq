import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Megaphone, Plus, Send, Trash2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { downloadCSV, formatDate, statusClass } from '@/lib/superadmin-utils'
import { useAdminAuth } from '@/hooks/use-admin-auth'

const blank = { title: '', body: '', audience: 'all_merchants', priority: 'normal', status: 'draft', scheduled_at: '' }

export default function SuperAdminAnnouncements() {
  const { admin, writeAuditLog } = useAdminAuth()
  const [announcements, setAnnouncements] = useState([])
  const [stores, setStores] = useState([])
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [annRes, storeRes] = await Promise.all([
      supabase.from('platform_announcements').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('stores').select('id, shop_name, account_status').not('account_status', 'eq', 'deleted').limit(2000),
    ])
    setAnnouncements(annRes.data || [])
    setStores(storeRes.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const recipientCount = useMemo(() => stores.filter((s) => !['deleted', 'suspended'].includes(String(s.account_status || '').toLowerCase())).length, [stores])

  function edit(row) {
    setEditing(row.id)
    setForm({ ...row, scheduled_at: row.scheduled_at ? new Date(row.scheduled_at).toISOString().slice(0, 16) : '' })
  }

  async function save(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.body.trim()) return alert('Title and message are required.')
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      audience: form.audience,
      priority: form.priority,
      status: form.scheduled_at ? 'scheduled' : form.status || 'draft',
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      recipient_count: recipientCount,
      updated_at: new Date().toISOString(),
      created_by: admin?.email || null,
    }
    if (editing) await supabase.from('platform_announcements').update(payload).eq('id', editing)
    else await supabase.from('platform_announcements').insert(payload)
    await writeAuditLog?.(editing ? 'announcement.updated' : 'announcement.created', payload, 'announcement', editing)
    setForm(blank)
    setEditing(null)
    await load()
  }

  async function sendNow(row) {
    if (!confirm(`Send announcement to ${recipientCount} merchants? Sent announcements cannot be recalled.`)) return
    const { error } = await supabase.rpc('send_platform_announcement', { p_announcement_id: row.id })
    if (error) return alert(error.message)
    await writeAuditLog?.('announcement.sent', { title: row.title, recipientCount }, 'announcement', row.id)
    await load()
  }

  async function cancel(row) {
    await supabase.from('platform_announcements').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', row.id)
    await writeAuditLog?.('announcement.cancelled', { title: row.title }, 'announcement', row.id)
    await load()
  }

  async function remove(row) {
    if (row.status === 'sent') return alert('Sent announcements cannot be deleted.')
    if (!confirm('Delete this announcement?')) return
    await supabase.from('platform_announcements').delete().eq('id', row.id)
    await load()
  }

  function exportCSV() {
    downloadCSV('bazarhq-announcements.csv', announcements.map((a) => ({ title: a.title, status: a.status, priority: a.priority, audience: a.audience, recipients: a.recipient_count, created_at: a.created_at, sent_at: a.sent_at })))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[0.24em] text-violet-300">Merchant Communication</p><h1 className="mt-2 text-3xl font-black">Announcements</h1><p className="mt-2 text-slate-400">Create, schedule, send, and audit platform notices for merchants.</p></div><button onClick={exportCSV} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold">Export CSV</button></div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black"><Plus className="h-5 w-5" /> {editing ? 'Edit announcement' : 'New announcement'}</h2>
          <form onSubmit={save} className="space-y-4">
            <input value={form.title || ''} onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))} placeholder="Announcement title" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" />
            <textarea value={form.body || ''} onChange={(e) => setForm((v) => ({ ...v, body: e.target.value }))} rows={6} placeholder="Write a clear announcement..." className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" />
            <div className="grid gap-3 sm:grid-cols-2"><select value={form.audience || 'all_merchants'} onChange={(e) => setForm((v) => ({ ...v, audience: e.target.value }))} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"><option value="all_merchants">All merchants</option><option value="active_merchants">Active merchants</option><option value="live_stores">Live stores</option></select><select value={form.priority || 'normal'} onChange={(e) => setForm((v) => ({ ...v, priority: e.target.value }))} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"><option value="normal">Normal</option><option value="important">Important</option><option value="critical">Critical</option></select></div>
            <label className="block text-sm font-semibold text-slate-300">Schedule time<input type="datetime-local" value={form.scheduled_at || ''} onChange={(e) => setForm((v) => ({ ...v, scheduled_at: e.target.value }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" /></label>
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4 text-sm text-violet-100"><CalendarClock className="mb-2 h-5 w-5" /> Estimated recipients: <b>{recipientCount}</b></div>
            <button className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold">Save announcement</button>
            {editing ? <button type="button" onClick={() => { setEditing(null); setForm(blank) }} className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold">Cancel edit</button> : null}
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-4 text-lg font-black">Announcement history</h2>
          <div className="space-y-3">
            {loading ? <p className="text-slate-400">Loading...</p> : announcements.map((row) => <div key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black">{row.title}</p><span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusClass(row.status)}`}>{row.status}</span><span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusClass(row.priority === 'critical' ? 'error' : row.priority === 'important' ? 'warning' : 'active')}`}>{row.priority}</span></div><p className="mt-2 text-sm text-slate-400">{row.body}</p><p className="mt-3 text-xs text-slate-500">Recipients: {row.recipient_count || recipientCount} · Created {formatDate(row.created_at)} {row.sent_at ? `· Sent ${formatDate(row.sent_at)}` : ''}</p></div><div className="flex shrink-0 flex-wrap gap-2"><button onClick={() => edit(row)} disabled={row.status === 'sent'} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold disabled:opacity-40">Edit</button><button onClick={() => sendNow(row)} disabled={row.status === 'sent' || row.status === 'cancelled'} className="rounded-xl border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-200 disabled:opacity-40"><Send className="inline h-3 w-3" /> Send</button><button onClick={() => cancel(row)} disabled={row.status === 'sent' || row.status === 'cancelled'} className="rounded-xl border border-amber-500/30 px-3 py-2 text-xs font-bold text-amber-200 disabled:opacity-40">Cancel</button><button onClick={() => remove(row)} className="rounded-xl border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-200"><Trash2 className="inline h-3 w-3" /></button></div></div></div>) }
            {!loading && !announcements.length ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-400"><Megaphone className="mx-auto mb-3 h-8 w-8" /> No announcements yet.</div> : null}
          </div>
        </section>
      </div>
    </div>
  )
}
