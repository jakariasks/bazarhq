import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, Mail, Play, RefreshCw } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAdminAuth } from '@/hooks/use-admin-auth'

function downloadCsv(name, csv) {
  const blob = new Blob([csv || ''], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export default function SuperAdminReports() {
  const { admin, writeAuditLog } = useAdminAuth()
  const [jobs, setJobs] = useState([])
  const [form, setForm] = useState({ report_type: 'platform_analytics', date_from: '', date_to: '', recipient_email: admin?.email || '' })
  const [loading, setLoading] = useState(false)

  async function load() {
    const { data } = await supabase.from('admin_report_jobs').select('*').order('created_at', { ascending: false }).limit(100)
    setJobs(data || [])
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setForm((v) => ({ ...v, recipient_email: v.recipient_email || admin?.email || '' })) }, [admin?.email])

  async function requestReport(e) {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.rpc('request_admin_report', {
      p_report_type: form.report_type,
      p_date_from: form.date_from || null,
      p_date_to: form.date_to || null,
      p_recipient_email: form.recipient_email || admin?.email || null,
      p_admin_id: admin?.id || null,
      p_admin_email: admin?.email || null,
    })
    setLoading(false)
    if (error) return alert(error.message)
    await writeAuditLog?.('report.requested', form, 'admin_report_job', data)
    await load()
  }

  async function runWorker() {
    setLoading(true)
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-report-worker`
      const res = await fetch(url, { method: 'POST', headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Report worker failed')
      await load()
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-violet-300">Background Reporting</p>
          <h1 className="mt-2 text-3xl font-black">Reports by Email</h1>
          <p className="mt-2 text-slate-400">Queue large reports, process them in the background, download CSV, and email them to admins.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold"><RefreshCw className="inline h-4 w-4" /> Refresh</button>
          <button onClick={runWorker} disabled={loading} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold disabled:opacity-50"><Play className="inline h-4 w-4" /> Run worker</button>
        </div>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <form onSubmit={requestReport} className="grid gap-4 md:grid-cols-5">
          <label className="text-sm font-semibold text-slate-300">Report type<select value={form.report_type} onChange={(e) => setForm((v) => ({ ...v, report_type: e.target.value }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none"><option value="platform_analytics">Platform analytics</option><option value="orders">Orders</option><option value="merchants">Merchants</option></select></label>
          <label className="text-sm font-semibold text-slate-300">From<input type="date" value={form.date_from} onChange={(e) => setForm((v) => ({ ...v, date_from: e.target.value }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" /></label>
          <label className="text-sm font-semibold text-slate-300">To<input type="date" value={form.date_to} onChange={(e) => setForm((v) => ({ ...v, date_to: e.target.value }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" /></label>
          <label className="text-sm font-semibold text-slate-300">Email<input type="email" value={form.recipient_email} onChange={(e) => setForm((v) => ({ ...v, recipient_email: e.target.value }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" /></label>
          <div className="flex items-end"><button disabled={loading} className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold disabled:opacity-50"><FileSpreadsheet className="inline h-4 w-4" /> Queue report</button></div>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase text-slate-500"><tr><th className="p-3">Report</th><th className="p-3">Status</th><th className="p-3">Date range</th><th className="p-3">Recipient</th><th className="p-3">Created</th><th className="p-3">Actions</th></tr></thead>
          <tbody className="divide-y divide-white/10">
            {jobs.map((job) => <tr key={job.id}><td className="p-3 font-bold">{job.report_type}</td><td className="p-3"><span className="rounded-full border border-white/10 px-2 py-1 text-xs font-bold capitalize">{job.status}</span>{job.error_message ? <p className="mt-1 text-xs text-rose-300">{job.error_message}</p> : null}</td><td className="p-3 text-slate-400">{job.date_from || '—'} → {job.date_to || '—'}</td><td className="p-3 text-slate-400">{job.recipient_email || '—'}</td><td className="p-3 text-slate-400">{new Date(job.created_at).toLocaleString()}</td><td className="p-3"><div className="flex gap-2"><button disabled={!job.result_csv} onClick={() => downloadCsv(`bazarhq-${job.report_type}-${job.id}.csv`, job.result_csv)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold disabled:opacity-40"><Download className="inline h-3 w-3" /> CSV</button><span className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-400"><Mail className="inline h-3 w-3" /> {job.emailed_at ? 'Emailed' : 'Email pending'}</span></div></td></tr>)}
            {!jobs.length ? <tr><td colSpan="6" className="p-8 text-center text-slate-400">No report jobs yet.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </div>
  )
}
