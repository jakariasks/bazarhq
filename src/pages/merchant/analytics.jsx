import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  TrendingUp, ShoppingCart, Package, Users,
  Download, Calendar, BarChart3, ArrowUpRight, ArrowDownRight, Eye, Percent,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentStore } from '@/lib/use-current-store'
import { toast } from 'sonner'

const PAY_COLORS = { bkash:'#E2136E', nagad:'#F7941D', rocket:'#8B3FC8', cod:'#16A34A', ssl:'#2563EB' }
const STATUS_COLORS = { pending:'#F59E0B', confirmed:'#3B82F6', shipped:'#6366F1', delivered:'#10B981', cancelled:'#EF4444' }

function dateRange(days) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days + 1)
  start.setHours(0,0,0,0)
  return { start, end }
}

function fmtDate(iso, short=false) {
  const d = new Date(iso)
  return short
    ? d.toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })
    : d.toLocaleDateString('en-BD', { day:'numeric', month:'short', year:'numeric' })
}

export default function AnalyticsPage() {
  const { store } = useCurrentStore()
  const [period, setPeriod] = useState('30')

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['analytics-orders', store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { data } = await supabase.from('orders').select('*').eq('store_id', store.id)
      return data ?? []
    },
    staleTime: 1000 * 60 * 5,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['analytics-products', store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id,title,price,stock,status,images').eq('store_id', store.id)
      return data ?? []
    },
  })

  const { data: events = [] } = useQuery({
    queryKey: ['analytics-events', store?.id, period],
    enabled: !!store,
    queryFn: async () => {
      const { start } = dateRange(parseInt(period, 10))
      const { data, error } = await supabase
        .from('analytics_events')
        .select('event_type, session_id, created_at, product_id')
        .eq('store_id', store.id)
        .gte('created_at', start.toISOString())
      if (error) return []
      return data ?? []
    },
    staleTime: 1000 * 60 * 3,
  })

  const days = parseInt(period, 10)
  const { start } = dateRange(days)

  // Filter orders by period
  const periodOrders = useMemo(() =>
    orders.filter(o => new Date(o.created_at) >= start && o.status !== 'cancelled'),
    [orders, start]
  )

  // Revenue
  const revenue = periodOrders.reduce((s, o) => s + Number(o.total || 0), 0)
  const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - days)
  const prevOrders = orders.filter(o => {
    const d = new Date(o.created_at)
    return d >= prevStart && d < start && o.status !== 'cancelled'
  })
  const prevRevenue = prevOrders.reduce((s, o) => s + Number(o.total || 0), 0)
  const revenueChange = prevRevenue === 0 ? null : Math.round(((revenue - prevRevenue) / prevRevenue) * 100)

  const avgOrderValue = periodOrders.length ? Math.round(revenue / periodOrders.length) : 0
  const uniqueVisitors = new Set(events.map(event => event.session_id).filter(Boolean)).size
  const productViews = events.filter(event => event.event_type === 'product_view').length
  const conversionRate = uniqueVisitors ? Math.round((periodOrders.length / uniqueVisitors) * 1000) / 10 : 0

  // 30-day daily revenue chart
  const dailyRevenue = useMemo(() => {
    const map = {}
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i)
      const key = d.toDateString()
      map[key] = { date: fmtDate(d.toISOString(), true), revenue: 0, orders: 0 }
    }
    for (const o of periodOrders) {
      const key = new Date(o.created_at).toDateString()
      if (map[key]) { map[key].revenue += Number(o.total||0); map[key].orders++ }
    }
    return Object.values(map)
  }, [periodOrders, days, start])

  // Orders by status
  const statusData = useMemo(() => {
    const map = {}
    for (const o of orders.filter(o => new Date(o.created_at) >= start)) {
      map[o.status] = (map[o.status] || 0) + 1
    }
    return Object.entries(map).map(([name, value]) => ({ name: name.charAt(0).toUpperCase()+name.slice(1), value, color: STATUS_COLORS[name] || '#94A3B8' }))
  }, [orders, start])

  // Revenue by payment method
  const paymentData = useMemo(() => {
    const map = {}
    for (const o of periodOrders) {
      const m = o.payment_method || 'other'
      map[m] = (map[m] || 0) + Number(o.total || 0)
    }
    return Object.entries(map).map(([name, value]) => ({ name: name.toUpperCase(), value, color: PAY_COLORS[name] || '#94A3B8' }))
  }, [periodOrders])

  // Top selling products by revenue
  const topProducts = useMemo(() => {
    const map = {}
    for (const o of periodOrders) {
      const items = Array.isArray(o.items) ? o.items : []
      for (const item of items) {
        if (!map[item.product_id]) map[item.product_id] = { id: item.product_id, title: item.title, image: item.image, units: 0, revenue: 0 }
        map[item.product_id].units += item.qty
        map[item.product_id].revenue += item.price * item.qty
      }
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
  }, [periodOrders])

  // Low / out of stock
  const lowStock = products.filter(p => p.status === 'published' && (p.stock ?? 0) <= 5 && (p.stock ?? 0) > 0)
  const outOfStock = products.filter(p => p.status === 'published' && (p.stock ?? 0) <= 0)

  // CSV Export — SRS M7
  const exportCSV = () => {
    if (!orders.length) { toast.error('No orders to export'); return }
    const header = ['Order ID','Date','Customer','Phone','Status','Payment Method','Payment Status','Total','District']
    const rows = orders.filter(o => new Date(o.created_at) >= start).map(o => [
      o.order_id, new Date(o.created_at).toLocaleDateString('en-BD'),
      `"${o.customer_name}"`, o.customer_phone,
      o.status, o.payment_method, o.payment_status, o.total, o.district,
    ])
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${store?.shop_name || 'orders'}-analytics-${period}d.csv`
    a.click(); URL.revokeObjectURL(url)
    toast.success(`Exported ${rows.length} orders`)
  }

  const symbol = '৳'

  if (!store) return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <BarChart3 className="h-10 w-10 text-muted-foreground" />
      <h3 className="mt-4 font-semibold">No store selected</h3>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track revenue, orders and product performance</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36 gap-2"><Calendar className="h-4 w-4"/><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="h-4 w-4"/>Export CSV</Button>
        </div>
      </div>

      {/* Empty state */}
      {!isLoading && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-24 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No data yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Once customers start placing orders, your analytics will appear here.</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{[0,1,2,3,4,5].map(i=><Skeleton key={i} className="h-28 rounded-2xl"/>)}</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              {[
                { label: 'Revenue', value: `${symbol} ${revenue.toLocaleString()}`, change: revenueChange, icon: TrendingUp, color: 'from-violet-500 to-purple-600' },
                { label: 'Orders', value: periodOrders.length, sub: `${orders.filter(o=>o.status==='pending').length} pending`, icon: ShoppingCart, color: 'from-blue-500 to-cyan-600' },
                { label: 'Avg Order Value', value: `${symbol} ${avgOrderValue.toLocaleString()}`, icon: Package, color: 'from-emerald-500 to-teal-600' },
                { label: 'Products', value: products.filter(p=>p.status==='published').length, sub: `${products.length} total`, icon: Users, color: 'from-amber-500 to-orange-600' },
                { label: 'Visitors', value: uniqueVisitors, sub: `${productViews} product views`, icon: Eye, color: 'from-fuchsia-500 to-pink-600' },
                { label: 'Conversion', value: `${conversionRate}%`, sub: 'orders / visitors', icon: Percent, color: 'from-sky-500 to-blue-600' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} shadow-sm`}>
                      <s.icon className="h-4 w-4 text-white"/>
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  {s.change != null && (
                    <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${s.change>=0?'text-success':'text-destructive'}`}>
                      {s.change>=0?<ArrowUpRight className="h-3 w-3"/>:<ArrowDownRight className="h-3 w-3"/>}
                      {Math.abs(s.change)}% vs previous period
                    </p>
                  )}
                  {s.sub && <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Revenue trend chart */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-4 font-semibold">Revenue trend — last {period} days</h3>
            {isLoading ? <Skeleton className="h-56 w-full rounded-xl"/> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                    interval={days<=7?0:days<=30?4:days<=90?13:30}/>
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v=>`৳${v>=1000?Math.round(v/1000)+'k':v}`}/>
                  <Tooltip formatter={(v)=>[`৳ ${Number(v).toLocaleString()}`, 'Revenue']} labelStyle={{ fontSize: 12 }}/>
                  <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }}/>
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Order status chart */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-4 font-semibold">Orders by status</h3>
              {isLoading ? <Skeleton className="h-48 rounded-xl"/> : statusData.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">No order data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {statusData.map((entry,i) => <Cell key={i} fill={entry.color}/>)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]}/>
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{fontSize:12}}>{v}</span>}/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Revenue by payment method */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="mb-4 font-semibold">Revenue by payment method</h3>
              {isLoading ? <Skeleton className="h-48 rounded-xl"/> : paymentData.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">No payment data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={paymentData} margin={{ top:5, right:10, left:0, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="name" tick={{ fontSize:11 }} tickLine={false} axisLine={false}/>
                    <YAxis tick={{ fontSize:11 }} tickLine={false} axisLine={false} tickFormatter={v=>`৳${v>=1000?Math.round(v/1000)+'k':v}`}/>
                    <Tooltip formatter={v=>[`৳ ${Number(v).toLocaleString()}`, 'Revenue']}/>
                    <Bar dataKey="value" radius={[6,6,0,0]}>
                      {paymentData.map((entry,i) => <Cell key={i} fill={entry.color}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top products */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h3 className="font-semibold">Top selling products</h3>
              <p className="text-xs text-muted-foreground">By revenue — last {period} days</p>
            </div>
            {isLoading ? (
              <div className="space-y-3 p-5">{[0,1,2].map(i=><Skeleton key={i} className="h-12 rounded-xl"/>)}</div>
            ) : topProducts.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">No sales data for this period</div>
            ) : (
              <div className="divide-y divide-border">
                {topProducts.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">#{i+1}</span>
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.image ? <img src={p.image} alt={p.title} className="h-full w-full object-cover"/> : <div className="flex h-full w-full items-center justify-center"><Package className="h-4 w-4 text-muted-foreground"/></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.units} unit{p.units!==1?'s':''} sold</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold">৳ {Math.round(p.revenue).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stock alerts */}
          {(lowStock.length > 0 || outOfStock.length > 0) && (
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border bg-amber-50 px-5 py-3">
                <h3 className="text-sm font-semibold text-amber-800">⚠️ Stock alerts — action needed</h3>
              </div>
              {outOfStock.length > 0 && (
                <div className="border-b border-border px-5 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-600">Out of stock ({outOfStock.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {outOfStock.map(p => <span key={p.id} className="rounded-full bg-red-100 px-2.5 py-1 text-xs text-red-700">{p.title}</span>)}
                  </div>
                </div>
              )}
              {lowStock.length > 0 && (
                <div className="px-5 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600">Low stock (≤5 units)</p>
                  <div className="flex flex-wrap gap-2">
                    {lowStock.map(p => <span key={p.id} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-700">{p.title} ({p.stock})</span>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
