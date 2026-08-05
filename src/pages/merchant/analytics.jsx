import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, ShoppingCart, Package, Users, Download, Calendar, BarChart3, Eye, Percent, Home, Tags, Clock3, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentStore } from '@/lib/use-current-store'
import { toast } from 'sonner'

const PAY_COLORS = { bkash:'#E2136E', nagad:'#F7941D', rocket:'#8B3FC8', cod:'#16A34A', ssl:'#2563EB', other:'#94A3B8' }
const STATUS_COLORS = { pending:'#F59E0B', confirmed:'#3B82F6', processing:'#0EA5E9', shipped:'#6366F1', delivered:'#10B981', cancelled:'#EF4444', unknown:'#94A3B8' }

function isoDate(date) { return date.toISOString().slice(0, 10) }
function presetRange(days) {
  const end = new Date(); end.setHours(23,59,59,999)
  const start = new Date(); start.setDate(start.getDate() - days + 1); start.setHours(0,0,0,0)
  return { start: isoDate(start), end: isoDate(end) }
}
function toBounds(startText, endText) {
  const start = new Date(`${startText}T00:00:00`)
  const end = new Date(`${endText}T23:59:59.999`)
  return { start, end: new Date(end.getTime() + 1) }
}
function currency(value) { return `৳ ${Number(value || 0).toLocaleString('en-BD', { maximumFractionDigits: 2 })}` }
function percent(n, d) { return d ? Math.round((n / d) * 1000) / 10 : 0 }

function Kpi({ label, value, sub, icon: Icon, gradient }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white ${gradient}`}><Icon className="h-4 w-4" /></div><p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p>{sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}</div>
}

export default function AnalyticsPage() {
  const { store } = useCurrentStore()
  const initial = presetRange(30)
  const [preset, setPreset] = useState('30')
  const [startDate, setStartDate] = useState(initial.start)
  const [endDate, setEndDate] = useState(initial.end)
  const [exporting, setExporting] = useState(false)
  const bounds = useMemo(() => toBounds(startDate, endDate), [startDate, endDate])

  const { data: response, isLoading, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['merchant-analytics-v2', store?.id, startDate, endDate],
    enabled: !!store?.id && !!startDate && !!endDate,
    queryFn: async () => {
      const started = performance.now()
      const { data, error: rpcError } = await supabase.rpc('get_merchant_analytics', {
        p_store_id: store.id,
        p_start: bounds.start.toISOString(),
        p_end: bounds.end.toISOString(),
      })
      if (rpcError) throw rpcError
      return { payload: data || {}, loadMs: Math.round(performance.now() - started) }
    },
    staleTime: 120_000,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['analytics-product-stock', store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data, error: productError } = await supabase.from('products').select('id,title,stock,status').eq('store_id', store.id)
      if (productError) throw productError
      return data || []
    },
  })

  const analytics = response?.payload || {}
  const summary = analytics.summary || {}
  const daily = analytics.daily || []
  const statusData = (analytics.orders_by_status || []).map((item) => ({ name: String(item.status || 'unknown'), value: Number(item.count || 0), color: STATUS_COLORS[item.status] || STATUS_COLORS.unknown }))
  const paymentData = (analytics.revenue_by_payment || []).map((item) => ({ name: String(item.method || 'other').toUpperCase(), value: Number(item.revenue || 0), color: PAY_COLORS[item.method] || PAY_COLORS.other }))
  const popularPages = analytics.popular_pages || []
  const viewedProducts = analytics.top_viewed_products || []
  const conversion = percent(Number(summary.valid_orders || 0), Number(summary.unique_visitors || 0))
  const lowStock = products.filter((p) => p.status === 'published' && Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 5)
  const outOfStock = products.filter((p) => p.status === 'published' && Number(p.stock || 0) <= 0)
  const hasData = Number(summary.orders || 0) > 0 || Number(summary.unique_visitors || 0) > 0 || Number(summary.product_views || 0) > 0

  function applyPreset(value) {
    setPreset(value)
    if (value === 'custom') return
    const range = presetRange(Number(value))
    setStartDate(range.start); setEndDate(range.end)
  }

  async function exportCSV() {
    if (!store?.id) return
    setExporting(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('Merchant login required.')
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merchant-analytics-export`
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: store.id, start: bounds.start.toISOString(), end: bounds.end.toISOString() }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Could not export analytics.')
      }
      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition') || ''
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || 'bazarhq-analytics.csv'
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a'); anchor.href = href; anchor.download = filename; anchor.click(); URL.revokeObjectURL(href)
      toast.success(`Exported ${response.headers.get('x-row-count') || 0} orders.`)
    } catch (exportError) { toast.error(exportError.message) }
    finally { setExporting(false) }
  }

  if (!store) return <div className="flex min-h-[40vh] flex-col items-center justify-center text-center"><BarChart3 className="h-10 w-10 text-muted-foreground" /><h3 className="mt-4 font-semibold">No store selected</h3></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analytics</h1><p className="mt-1 text-sm text-muted-foreground">Server-aggregated revenue, unique sessions, page popularity and product interest.</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <div><label className="mb-1 block text-xs text-muted-foreground">Range</label><Select value={preset} onValueChange={applyPreset}><SelectTrigger className="w-40"><Calendar className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem><SelectItem value="365">Last 12 months</SelectItem><SelectItem value="custom">Custom range</SelectItem></SelectContent></Select></div>
          <div><label className="mb-1 block text-xs text-muted-foreground">Start date</label><Input type="date" value={startDate} max={endDate} onChange={(e) => { setPreset('custom'); setStartDate(e.target.value) }} /></div>
          <div><label className="mb-1 block text-xs text-muted-foreground">End date</label><Input type="date" value={endDate} min={startDate} max={isoDate(new Date())} onChange={(e) => { setPreset('custom'); setEndDate(e.target.value) }} /></div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>Refresh</Button>
          <Button variant="outline" onClick={exportCSV} disabled={exporting} className="gap-2">{exporting ? <Clock3 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Export CSV</Button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error.message}</div>}

      {isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi label="Revenue" value={currency(summary.revenue)} sub="Cancelled orders excluded" icon={TrendingUp} gradient="from-violet-500 to-purple-600" />
        <Kpi label="Orders" value={Number(summary.orders || 0)} sub={`${Number(summary.cancelled_orders || 0)} cancelled`} icon={ShoppingCart} gradient="from-blue-500 to-cyan-600" />
        <Kpi label="Avg order value" value={currency(summary.average_order_value)} icon={Package} gradient="from-emerald-500 to-teal-600" />
        <Kpi label="Unique visitors" value={Number(summary.unique_visitors || 0)} sub="Distinct storefront session IDs" icon={Users} gradient="from-fuchsia-500 to-pink-600" />
        <Kpi label="Product views" value={Number(summary.product_views || 0)} sub={`${viewedProducts.length} ranked products`} icon={Eye} gradient="from-amber-500 to-orange-600" />
        <Kpi label="Conversion" value={`${conversion}%`} sub="Valid orders / unique visitors" icon={Percent} gradient="from-sky-500 to-blue-600" />
      </div>}

      {!isLoading && !hasData ? <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-20 text-center"><BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">No analytics in this date range</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Publish the storefront, share its link, and add products. Page views, category visits and orders will appear here after customers interact with the shop.</p></div> : <>
        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <section className="rounded-2xl border border-border bg-card p-5"><div className="mb-4"><h2 className="font-semibold">Revenue and orders</h2><p className="text-xs text-muted-foreground">Daily values within the selected range</p></div><div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={daily}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('en-BD', { month:'short', day:'numeric' })} minTickGap={30} /><YAxis /><Tooltip formatter={(value, name) => name === 'revenue' ? currency(value) : value} /><Line type="monotone" dataKey="revenue" stroke="#6366F1" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="orders" stroke="#10B981" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div></section>
          <section className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Order status</h2><div className="h-80"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={2}>{statusData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="flex flex-wrap gap-2">{statusData.map((item) => <span key={item.name} className="rounded-full border px-2 py-1 text-xs"><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}: {item.value}</span>)}</div></section>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Revenue by payment method</h2><div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={paymentData} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="name" width={85} /><Tooltip formatter={(value) => currency(value)} /><Bar dataKey="value" radius={[0,8,8,0]}>{paymentData.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer></div></section>
          <section className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Storefront traffic</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Kpi label="Homepage visitors" value={Number(summary.homepage_visitors || 0)} icon={Home} gradient="from-slate-600 to-slate-800" /><Kpi label="Category visitors" value={Number(summary.category_visitors || 0)} icon={Tags} gradient="from-indigo-500 to-violet-600" /></div><div className="mt-4 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground"><Clock3 className="mr-1 inline h-3.5 w-3.5" />Aggregated in {response?.loadMs || 0} ms · Updated {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—'}</div></section>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Popular pages</h2><div className="mt-4 divide-y divide-border">{popularPages.length ? popularPages.slice(0,10).map((page, index) => <div key={`${page.path}-${index}`} className="flex items-center gap-3 py-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">{index+1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{page.path || '/'}</p><p className="text-xs text-muted-foreground">{Number(page.unique_visitors || 0)} unique visitors</p></div><span className="text-sm font-semibold">{Number(page.views || 0)} views</span></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No page views in this range.</p>}</div></section>
          <section className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Most viewed products</h2><div className="mt-4 divide-y divide-border">{viewedProducts.length ? viewedProducts.slice(0,10).map((product, index) => <div key={product.product_id || index} className="flex items-center gap-3 py-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">{index+1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{product.title || 'Product'}</p><p className="text-xs text-muted-foreground">{Number(product.unique_viewers || 0)} unique viewers</p></div><span className="text-sm font-semibold">{Number(product.views || 0)} views</span></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No product views in this range.</p>}</div></section>
        </div>

        {(lowStock.length > 0 || outOfStock.length > 0) && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900"><h2 className="font-semibold">Inventory attention</h2><p className="mt-1 text-sm">{lowStock.length} low-stock product{lowStock.length === 1 ? '' : 's'} and {outOfStock.length} out-of-stock product{outOfStock.length === 1 ? '' : 's'}.</p><a href="/merchant/products" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline">Review products <ExternalLink className="h-3.5 w-3.5" /></a></section>}
      </>}
    </div>
  )
}
