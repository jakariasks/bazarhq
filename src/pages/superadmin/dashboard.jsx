import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, BarChart3, CreditCard, RefreshCw, ShieldCheck, ShoppingBag, Store, Users } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { formatDate, formatMoney, formatNumber, startOfDaysAgo, statusClass } from '@/lib/superadmin-utils'

function StatCard({ label, value, icon: Icon, sub, tone = 'violet' }) {
  const tones = {
    violet: 'from-violet-500/20 to-fuchsia-500/10 text-violet-200 border-violet-400/20',
    emerald: 'from-emerald-500/20 to-teal-500/10 text-emerald-200 border-emerald-400/20',
    amber: 'from-amber-500/20 to-orange-500/10 text-amber-200 border-amber-400/20',
    sky: 'from-sky-500/20 to-cyan-500/10 text-sky-200 border-sky-400/20',
  }
  return (
    <div className={`rounded-3xl border bg-gradient-to-br p-5 ${tones[tone] || tones.violet}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black text-white">{value}</p>
          {sub ? <p className="mt-2 text-xs text-slate-400">{sub}</p> : null}
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10"><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  )
}

function Section({ title, children, action }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stores, setStores] = useState([])
  const [orders, setOrders] = useState([])
  const [events, setEvents] = useState([])
  const [health, setHealth] = useState([])
  const [logs, setLogs] = useState([])

  async function load() {
    setRefreshing(true)
    const since = startOfDaysAgo(30)
    const [storesRes, ordersRes, eventsRes, healthRes, logsRes] = await Promise.all([
      supabase.from('stores').select('id, shop_name, subdomain, business_category, account_status, storefront_published, created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('orders').select('id, store_id, order_id, total, status, payment_status, payment_method, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
      supabase.from('analytics_events').select('event_name, store_id, created_at').gte('created_at', since).limit(1000),
      supabase.from('system_health_log').select('service, status, response_ms, message, checked_at').order('checked_at', { ascending: false }).limit(8),
      supabase.from('admin_audit_log').select('action, admin_email, target_type, created_at, details').order('created_at', { ascending: false }).limit(8),
    ])
    setStores(storesRes.data || [])
    setOrders(ordersRes.data || [])
    setEvents(eventsRes.data || [])
    setHealth(healthRes.data || [])
    setLogs(logsRes.data || [])
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  const stats = useMemo(() => {
    const activeStores = stores.filter((s) => !['deleted', 'suspended'].includes(String(s.account_status || '').toLowerCase()))
    const liveStores = activeStores.filter((s) => s.storefront_published)
    const revenue = orders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total || 0), 0)
    const pending = orders.filter((o) => o.status === 'pending').length
    const visitors = new Set(events.filter((e) => e.event_name === 'page_view').map((e, i) => `${e.store_id}-${i}`)).size
    return { activeStores: activeStores.length, liveStores: liveStores.length, revenue, pending, visitors, orders: orders.length }
  }, [stores, orders, events])

  const orderStatus = useMemo(() => {
    const map = new Map()
    orders.forEach((o) => map.set(o.status || 'pending', (map.get(o.status || 'pending') || 0) + 1))
    return [...map.entries()].map(([name, value]) => ({ name, value }))
  }, [orders])

  const healthSummary = health.slice(0, 5)

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-slate-400">Loading platform dashboard...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-violet-300">Super Admin</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Platform Dashboard</h1>
          <p className="mt-2 text-slate-400">Real-time operational overview for stores, orders, revenue, health, and audit activity.</p>
        </div>
        <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold text-slate-200 hover:bg-white/10">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active merchants" value={formatNumber(stats.activeStores)} sub={`${stats.liveStores} live storefronts`} icon={Store} tone="violet" />
        <StatCard label="30-day orders" value={formatNumber(stats.orders)} sub={`${stats.pending} pending`} icon={ShoppingBag} tone="sky" />
        <StatCard label="30-day revenue" value={formatMoney(stats.revenue)} sub="Cancelled orders excluded" icon={CreditCard} tone="emerald" />
        <StatCard label="Tracked visits" value={formatNumber(stats.visitors)} sub="From analytics_events" icon={Users} tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Section title="Order status mix" action={<BarChart3 className="h-5 w-5 text-slate-500" />}>
          <div className="space-y-3">
            {orderStatus.length ? orderStatus.map((item) => {
              const max = Math.max(...orderStatus.map((x) => x.value), 1)
              return (
                <div key={item.name}>
                  <div className="mb-1 flex items-center justify-between text-sm"><span className="capitalize text-slate-300">{item.name}</span><span className="font-bold">{item.value}</span></div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(8, (item.value / max) * 100)}%` }} /></div>
                </div>
              )
            }) : <p className="text-sm text-slate-400">No order data yet.</p>}
          </div>
        </Section>

        <Section title="System health" action={<Activity className="h-5 w-5 text-slate-500" />}>
          <div className="space-y-3">
            {healthSummary.length ? healthSummary.map((item, index) => (
              <div key={`${item.service}-${index}`} className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3">
                <div>
                  <p className="font-semibold capitalize">{item.service}</p>
                  <p className="text-xs text-slate-500">{formatDate(item.checked_at)} · {item.response_ms || 0}ms</p>
                </div>
                <span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusClass(item.status)}`}>{item.status}</span>
              </div>
            )) : (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                <AlertTriangle className="mb-2 h-5 w-5" /> No health log yet. Open System Health and run checks.
              </div>
            )}
          </div>
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Recent stores">
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-3">Shop</th><th className="p-3">Status</th><th className="p-3">Created</th></tr></thead>
              <tbody className="divide-y divide-white/10">
                {stores.slice(0, 6).map((s) => <tr key={s.id}><td className="p-3"><p className="font-semibold">{s.shop_name}</p><p className="text-xs text-slate-500">/{s.subdomain}</p></td><td className="p-3"><span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusClass(s.account_status || 'active')}`}>{s.account_status || 'active'}</span></td><td className="p-3 text-slate-400">{formatDate(s.created_at)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Audit activity" action={<ShieldCheck className="h-5 w-5 text-slate-500" />}>
          <div className="space-y-3">
            {logs.length ? logs.map((log, index) => (
              <div key={index} className="rounded-2xl bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3"><p className="font-semibold">{log.action}</p><span className="text-xs text-slate-500">{formatDate(log.created_at)}</span></div>
                <p className="mt-1 text-xs text-slate-400">{log.admin_email || 'Admin'} · {log.target_type || 'platform'}</p>
              </div>
            )) : <p className="text-sm text-slate-400">No audit activity yet.</p>}
          </div>
        </Section>
      </div>
    </div>
  )
}
