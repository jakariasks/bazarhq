import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Calendar, Download, RefreshCw, TrendingUp } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { downloadCSV, formatDate, formatMoney, formatNumber, startOfDaysAgo, statusClass } from '@/lib/superadmin-utils'

function Card({ title, value, sub }) {
  return <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><p className="text-sm font-semibold text-slate-400">{title}</p><p className="mt-2 text-3xl font-black">{value}</p>{sub ? <p className="mt-2 text-xs text-slate-500">{sub}</p> : null}</div>
}

function groupByDay(rows, field = 'created_at') {
  const map = new Map()
  rows.forEach((row) => {
    const key = new Date(row[field]).toISOString().slice(0, 10)
    const current = map.get(key) || { date: key, orders: 0, revenue: 0, visitors: 0 }
    current.orders += row.order_id ? 1 : 0
    current.revenue += Number(row.total || 0)
    current.visitors += row.event_name ? 1 : 0
    map.set(key, current)
  })
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export default function SuperAdminAnalytics() {
  const [range, setRange] = useState('30')
  const [orders, setOrders] = useState([])
  const [stores, setStores] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const since = startOfDaysAgo(Number(range))
    const [ordersRes, storesRes, eventsRes] = await Promise.all([
      supabase.from('orders').select('id, order_id, store_id, total, status, payment_status, payment_method, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(2000),
      supabase.from('stores').select('id, shop_name, subdomain, account_status, storefront_published, created_at').limit(1000),
      supabase.from('analytics_events').select('event_name, store_id, product_id, session_id, created_at').gte('created_at', since).limit(5000),
    ])
    setOrders(ordersRes.data || [])
    setStores(storesRes.data || [])
    setEvents(eventsRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [range])

  const metrics = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== 'cancelled')
    const revenue = validOrders.reduce((sum, o) => sum + Number(o.total || 0), 0)
    const visitors = new Set(events.filter((e) => e.event_name === 'page_view').map((e) => e.session_id || `${e.store_id}-${e.created_at}`)).size
    const addToCart = events.filter((e) => e.event_name === 'add_to_cart').length
    const conversion = visitors ? ((orders.length / visitors) * 100).toFixed(1) : '0.0'
    return { revenue, orders: orders.length, visitors, addToCart, conversion, aov: validOrders.length ? revenue / validOrders.length : 0 }
  }, [orders, events])

  const statusRows = useMemo(() => {
    const map = new Map()
    orders.forEach((o) => map.set(o.status || 'pending', (map.get(o.status || 'pending') || 0) + 1))
    return [...map.entries()].map(([status, count]) => ({ status, count }))
  }, [orders])

  const paymentRows = useMemo(() => {
    const map = new Map()
    orders.forEach((o) => map.set(o.payment_method || 'unknown', (map.get(o.payment_method || 'unknown') || 0) + 1))
    return [...map.entries()].map(([method, count]) => ({ method, count }))
  }, [orders])

  const topStores = useMemo(() => {
    const map = new Map()
    orders.forEach((o) => {
      const row = map.get(o.store_id) || { store_id: o.store_id, orders: 0, revenue: 0 }
      row.orders += 1
      if (o.status !== 'cancelled') row.revenue += Number(o.total || 0)
      map.set(o.store_id, row)
    })
    return [...map.values()].map((row) => ({ ...row, store: stores.find((s) => s.id === row.store_id) })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  }, [orders, stores])

  const daily = useMemo(() => groupByDay(orders, 'created_at'), [orders])
  const maxRevenue = Math.max(...daily.map((d) => d.revenue), 1)

  function exportReport() {
    downloadCSV(`bazarhq-platform-analytics-${range}d.csv`, topStores.map((row) => ({
      shop: row.store?.shop_name || 'Unknown',
      subdomain: row.store?.subdomain || '',
      orders: row.orders,
      revenue: row.revenue,
      status: row.store?.account_status || 'active',
    })))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><p className="text-sm font-bold uppercase tracking-[0.24em] text-violet-300">Platform Analytics</p><h1 className="mt-2 text-3xl font-black">Analytics & Reports</h1><p className="mt-2 text-slate-400">Revenue, traffic, conversion, payment methods, and merchant performance.</p></div>
        <div className="flex flex-wrap gap-2">
          <select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white outline-none"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 365 days</option></select>
          <button onClick={load} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold"><RefreshCw className="inline h-4 w-4" /> Refresh</button>
          <button onClick={exportReport} className="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-bold"><Download className="inline h-4 w-4" /> Export CSV</button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card title="Revenue" value={formatMoney(metrics.revenue)} sub="Cancelled excluded" />
        <Card title="Orders" value={formatNumber(metrics.orders)} sub={`${range} day range`} />
        <Card title="Visitors" value={formatNumber(metrics.visitors)} sub="Unique sessions" />
        <Card title="Conversion" value={`${metrics.conversion}%`} sub="Orders / visitors" />
        <Card title="AOV" value={formatMoney(metrics.aov)} sub="Average order value" />
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-black">Revenue trend</h2><TrendingUp className="h-5 w-5 text-slate-500" /></div>
        <div className="flex h-64 items-end gap-2 overflow-x-auto rounded-2xl bg-black/20 p-4">
          {daily.length ? daily.map((d) => <div key={d.date} className="flex min-w-12 flex-1 flex-col items-center gap-2"><div title={`${d.date}: ${formatMoney(d.revenue)}`} className="w-full rounded-t-xl bg-violet-500 transition hover:bg-violet-400" style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 210)}px` }} /><span className="text-[10px] text-slate-500">{d.date.slice(5)}</span></div>) : <p className="text-slate-400">No revenue data for this range.</p>}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><h2 className="mb-4 text-lg font-black">Top merchants</h2><div className="overflow-hidden rounded-2xl border border-white/10"><table className="w-full text-left text-sm"><thead className="bg-white/[0.04] text-xs uppercase text-slate-500"><tr><th className="p-3">Merchant</th><th className="p-3">Orders</th><th className="p-3">Revenue</th><th className="p-3">Status</th></tr></thead><tbody className="divide-y divide-white/10">{topStores.map((row) => <tr key={row.store_id}><td className="p-3"><p className="font-bold">{row.store?.shop_name || 'Unknown'}</p><p className="text-xs text-slate-500">/{row.store?.subdomain}</p></td><td className="p-3">{row.orders}</td><td className="p-3">{formatMoney(row.revenue)}</td><td className="p-3"><span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusClass(row.store?.account_status || 'active')}`}>{row.store?.account_status || 'active'}</span></td></tr>)}</tbody></table></div></section>
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><h2 className="mb-4 text-lg font-black">Status & payment mix</h2><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2">{statusRows.map((r) => <div key={r.status} className="flex justify-between rounded-2xl bg-white/[0.04] px-4 py-3"><span className="capitalize text-slate-300">{r.status}</span><b>{r.count}</b></div>)}</div><div className="space-y-2">{paymentRows.map((r) => <div key={r.method} className="flex justify-between rounded-2xl bg-white/[0.04] px-4 py-3"><span className="capitalize text-slate-300">{r.method}</span><b>{r.count}</b></div>)}</div></div></section>
      </div>
    </div>
  )
}
