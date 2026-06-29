import { useEffect, useMemo, useState } from 'react'
import { Download, Filter, Search, ShieldCheck } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { downloadCSV, formatDate, statusClass } from '@/lib/superadmin-utils'

export default function SuperAdminAuditLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('all')
  const [target, setTarget] = useState('all')
  const [selected, setSelected] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(500)
    setLogs(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const actions = useMemo(() => ['all', ...new Set(logs.map((l) => l.action).filter(Boolean))], [logs])
  const targets = useMemo(() => ['all', ...new Set(logs.map((l) => l.target_type).filter(Boolean))], [logs])

  const filtered = useMemo(() => logs.filter((log) => {
    const text = `${log.action || ''} ${log.admin_email || ''} ${log.target_type || ''} ${log.target_id || ''} ${JSON.stringify(log.details || {})}`.toLowerCase()
    return (!query || text.includes(query.toLowerCase())) && (action === 'all' || log.action === action) && (target === 'all' || log.target_type === target)
  }), [logs, query, action, target])

  function exportLogs() {
    downloadCSV('bazarhq-admin-audit-log.csv', filtered.map((log) => ({
      action: log.action,
      admin_email: log.admin_email,
      admin_id: log.admin_id,
      target_type: log.target_type,
      target_id: log.target_id,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      created_at: log.created_at,
      details: JSON.stringify(log.details || {}),
    })))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[0.24em] text-violet-300">Security</p><h1 className="mt-2 text-3xl font-black">Audit Log</h1><p className="mt-2 text-slate-400">Trace admin login, platform actions, merchant changes, content approvals, and announcements.</p></div><button onClick={exportLogs} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold"><Download className="inline h-4 w-4" /> Export CSV</button></div>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_240px_240px]">
          <label className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search action, admin, target, details..." className="w-full rounded-2xl border border-white/10 bg-slate-950 py-3 pl-11 pr-4 text-sm text-white outline-none" /></label>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"><option value="all">All actions</option>{actions.filter((x) => x !== 'all').map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"><option value="all">All targets</option>{targets.filter((x) => x !== 'all').map((x) => <option key={x} value={x}>{x}</option>)}</select>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">{filtered.length} audit records</h2><Filter className="h-5 w-5 text-slate-500" /></div>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-xs uppercase text-slate-500"><tr><th className="p-3">Action</th><th className="p-3">Admin</th><th className="p-3">Target</th><th className="p-3">IP</th><th className="p-3">Time</th><th className="p-3">Details</th></tr></thead>
            <tbody className="divide-y divide-white/10">
              {loading ? <tr><td colSpan="6" className="p-8 text-center text-slate-400">Loading audit logs...</td></tr> : filtered.map((log) => <tr key={log.id} className="hover:bg-white/[0.03]"><td className="p-3"><span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusClass(log.action?.includes('fail') ? 'error' : 'active')}`}>{log.action || 'action'}</span></td><td className="p-3"><p className="font-semibold">{log.admin_email || 'Admin'}</p><p className="text-xs text-slate-500">{log.admin_id || '—'}</p></td><td className="p-3"><p>{log.target_type || 'platform'}</p><p className="max-w-40 truncate text-xs text-slate-500">{log.target_id || '—'}</p></td><td className="p-3 text-slate-400">{log.ip_address || '—'}</td><td className="p-3 text-slate-400">{formatDate(log.created_at)}</td><td className="p-3"><button onClick={() => setSelected(log)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold">View</button></td></tr>)}
              {!loading && !filtered.length ? <tr><td colSpan="6" className="p-8 text-center text-slate-400"><ShieldCheck className="mx-auto mb-3 h-8 w-8" /> No audit logs match your filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl"><div className="mb-4 flex items-start justify-between"><div><h3 className="text-xl font-black">Audit detail</h3><p className="text-sm text-slate-400">{formatDate(selected.created_at)}</p></div><button onClick={() => setSelected(null)} className="rounded-full border border-white/10 px-3 py-1 text-sm">Close</button></div><pre className="overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-slate-200">{JSON.stringify(selected, null, 2)}</pre></div></div> : null}
    </div>
  )
}
