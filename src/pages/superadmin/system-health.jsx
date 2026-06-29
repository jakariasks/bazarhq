import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Database, Mail, RefreshCw, Server, ShieldCheck, Smartphone, XCircle } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { formatDate, statusClass } from '@/lib/superadmin-utils'

const checks = [
  { key: 'database', label: 'Primary Database', icon: Database },
  { key: 'auth', label: 'Authentication', icon: ShieldCheck },
  { key: 'storage', label: 'Storage', icon: Server },
  { key: 'email', label: 'Email Queue', icon: Mail },
  { key: 'sms', label: 'SMS Queue', icon: Smartphone },
]

function HealthIcon({ status }) {
  if (status === 'healthy') return <CheckCircle2 className="h-5 w-5 text-emerald-300" />
  if (status === 'warning') return <AlertTriangle className="h-5 w-5 text-amber-300" />
  return <XCircle className="h-5 w-5 text-rose-300" />
}

export default function SuperAdminSystemHealth() {
  const [running, setRunning] = useState(false)
  const [health, setHealth] = useState([])
  const [incidents, setIncidents] = useState([])
  const [incident, setIncident] = useState({ service: 'web', status: 'warning', message: '' })

  async function loadHistory() {
    const [healthRes, incidentsRes] = await Promise.all([
      supabase.from('system_health_log').select('*').order('checked_at', { ascending: false }).limit(100),
      supabase.from('system_incidents').select('*').order('created_at', { ascending: false }).limit(30),
    ])
    setHealth(healthRes.data || [])
    setIncidents(incidentsRes.data || [])
  }

  useEffect(() => { loadHistory() }, [])

  async function runChecks() {
    setRunning(true)
    const results = []

    async function timed(service, fn) {
      const started = performance.now()
      try {
        const result = await fn()
        results.push({ service, status: result.status || 'healthy', response_ms: Math.round(performance.now() - started), message: result.message || 'Operational', metadata: result.metadata || {} })
      } catch (error) {
        results.push({ service, status: 'down', response_ms: Math.round(performance.now() - started), message: error.message || 'Check failed', metadata: {} })
      }
    }

    await timed('database', async () => {
      const { error, count } = await supabase.from('stores').select('id', { count: 'exact', head: true })
      if (error) throw error
      return { message: `Database reachable. ${count || 0} stores indexed.` }
    })

    await timed('auth', async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      return { message: data?.session ? 'Auth client online. Admin session active.' : 'Auth client online.' }
    })

    await timed('storage', async () => {
      const { error } = await supabase.storage.from('shop-branding').list('', { limit: 1 })
      if (error && !String(error.message).toLowerCase().includes('permission')) throw error
      return { status: error ? 'warning' : 'healthy', message: error ? 'Storage reachable but list permission is restricted.' : 'Storage bucket reachable.' }
    })

    await timed('email', async () => {
      const { error, count } = await supabase.from('email_notification_queue').select('id', { count: 'exact', head: true }).in('status', ['pending', 'failed'])
      if (error) return { status: 'warning', message: 'Email queue table not configured yet.' }
      return { status: count > 20 ? 'warning' : 'healthy', message: `${count || 0} pending/failed email notifications.` }
    })

    await timed('sms', async () => {
      const { error, count } = await supabase.from('sms_notification_queue').select('id', { count: 'exact', head: true }).in('status', ['pending', 'failed'])
      if (error) return { status: 'warning', message: 'SMS queue table not configured yet.' }
      return { status: count > 20 ? 'warning' : 'healthy', message: `${count || 0} pending/failed SMS notifications.` }
    })

    if (results.length) await supabase.from('system_health_log').insert(results)
    await loadHistory()
    setRunning(false)
  }

  async function createIncident(e) {
    e.preventDefault()
    if (!incident.message.trim()) return
    await supabase.from('system_incidents').insert({ ...incident, status: incident.status, message: incident.message.trim() })
    setIncident({ service: 'web', status: 'warning', message: '' })
    await loadHistory()
  }

  async function resolveIncident(id) {
    await supabase.from('system_incidents').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id)
    await loadHistory()
  }

  const latestByService = useMemo(() => {
    const map = new Map()
    health.forEach((h) => { if (!map.has(h.service)) map.set(h.service, h) })
    return map
  }, [health])

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-bold uppercase tracking-[0.24em] text-violet-300">Operations</p><h1 className="mt-2 text-3xl font-black">System Health</h1><p className="mt-2 text-slate-400">Monitor database, auth, storage, email/SMS queues, and incident status.</p></div>
        <button onClick={runChecks} disabled={running} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} /> Run health checks</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {checks.map((check) => {
          const row = latestByService.get(check.key)
          const Icon = check.icon
          const status = row?.status || 'warning'
          return (
            <div key={check.key} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-4 flex items-center justify-between"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10"><Icon className="h-5 w-5 text-violet-200" /></div><HealthIcon status={status} /></div>
              <p className="font-black">{check.label}</p>
              <p className="mt-2 text-sm text-slate-400">{row?.message || 'No check run yet.'}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{row?.response_ms ? `${row.response_ms}ms` : '—'}</span><span>{formatDate(row?.checked_at)}</span></div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-4 text-lg font-black">Create incident</h2>
          <form onSubmit={createIncident} className="space-y-3">
            <select value={incident.service} onChange={(e) => setIncident((v) => ({ ...v, service: e.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"><option value="web">Web frontend</option><option value="database">Database</option><option value="storage">Storage</option><option value="email">Email</option><option value="sms">SMS</option><option value="payments">Payments</option></select>
            <select value={incident.status} onChange={(e) => setIncident((v) => ({ ...v, status: e.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"><option value="warning">Warning</option><option value="down">Down</option><option value="resolved">Resolved</option></select>
            <textarea value={incident.message} onChange={(e) => setIncident((v) => ({ ...v, message: e.target.value }))} placeholder="Incident summary..." rows={4} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none" />
            <button className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold">Save incident</button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="mb-4 text-lg font-black">Incident log</h2>
          <div className="space-y-3">
            {incidents.length ? incidents.map((row) => <div key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold capitalize">{row.service}</p><p className="mt-1 text-sm text-slate-400">{row.message}</p><p className="mt-2 text-xs text-slate-500">{formatDate(row.created_at)}</p></div><span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusClass(row.status)}`}>{row.status}</span></div>{row.status !== 'resolved' ? <button onClick={() => resolveIncident(row.id)} className="mt-3 rounded-xl border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-200">Mark resolved</button> : null}</div>) : <p className="text-sm text-slate-400">No incidents recorded.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
