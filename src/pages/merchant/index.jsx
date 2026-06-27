import { Link } from '@tanstack/react-router'
import { Package, ShoppingCart, Users, TrendingUp, ArrowRight, Check, ChevronRight, Bell, Zap } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PublishCard } from '@/components/publish-card'
import { useCurrentStore } from '@/lib/use-current-store'
import { supabase } from '@/integrations/supabase/client'
import { motion } from 'framer-motion'

export default function DashboardPage() {
  const { store, isLoading } = useCurrentStore()

  const { data: productCount = 0 } = useQuery({
    queryKey: ['product-count', store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('store_id', store.id)
      return count ?? 0
    },
  })

  const { data: orderStats } = useQuery({
    queryKey: ['order-stats', store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('status, total, created_at')
        .eq('store_id', store.id)
      const all = data ?? []
      const today = new Date().toDateString()
      const revenue = all.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total || 0), 0)
      const todayOrders = all.filter(o => new Date(o.created_at).toDateString() === today).length
      const pending = all.filter(o => o.status === 'pending').length
      return { total: all.length, revenue, todayOrders, pending }
    },
  })

  const { data: activePaymentCount = 0 } = useQuery({
    queryKey: ['dashboard-payment-count', store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('payment_configs')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .eq('enabled', true)

      if (error) return 0
      return count ?? 0
    },
  })

  // SRS M2: Onboarding checklist
  const onboardingSteps = [
    { id: 'store', label: 'Create your store', done: !!store, link: '/onboarding', desc: 'Your shop is created' },
    { id: 'theme', label: 'Customise your theme', done: !!(store?.theme_id && store?.brand_color), link: '/merchant/themes', desc: 'Pick colors & theme' },
    { id: 'product', label: 'Add your first product', done: productCount > 0, link: '/merchant/products', desc: 'Add at least 1 product' },
    { id: 'payment', label: 'Configure payments', done: activePaymentCount > 0, link: '/merchant/payments', desc: 'Enable at least 1 method' },
    { id: 'publish', label: 'Publish your storefront', done: !!store?.storefront_published, link: '/merchant', desc: 'Go live to customers' },
  ]
  const completedSteps = onboardingSteps.filter(s => s.done).length
  const progressPct = Math.round((completedSteps / onboardingSteps.length) * 100)
  const allDone = completedSteps === onboardingSteps.length

  const stats = [
    { label: 'Total Revenue', value: `৳ ${Number(orderStats?.revenue || 0).toLocaleString()}`, sub: 'All time', icon: TrendingUp, color: 'from-violet-500 to-purple-600' },
    { label: 'Total Orders', value: String(orderStats?.total || 0), sub: `${orderStats?.pending || 0} pending`, icon: ShoppingCart, color: 'from-blue-500 to-cyan-600' },
    { label: 'Products', value: String(productCount), sub: 'In catalog', icon: Package, color: 'from-emerald-500 to-teal-600' },
    { label: "Today's Orders", value: String(orderStats?.todayOrders || 0), sub: 'New today', icon: Zap, color: 'from-amber-500 to-orange-600' },
  ]

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-60 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0,1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      <Skeleton className="h-44 rounded-2xl" />
    </div>
  )

  if (!store) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"><Package className="h-7 w-7 text-muted-foreground" /></div>
      <h2 className="mt-4 text-xl font-semibold">No store yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">Create your first store to get started.</p>
      <Link to="/onboarding"><Button className="mt-6 bg-gradient-primary shadow-glow">Create a store <ArrowRight className="ml-1.5 h-4 w-4" /></Button></Link>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Welcome back, {store.shop_name}! 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here's what's happening with your store today.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{s.label}</div>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} shadow-sm`}>
                <s.icon className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold">{s.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Pending orders alert */}
      {(orderStats?.pending || 0) > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <Bell className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              You have {orderStats.pending} pending order{orderStats.pending !== 1 ? 's' : ''} waiting
            </p>
            <p className="text-xs text-amber-600">Review and confirm them to keep customers happy.</p>
          </div>
          <Link to="/merchant/orders">
            <Button size="sm" className="shrink-0 bg-amber-600 text-white hover:bg-amber-700">View orders <ChevronRight className="ml-1 h-3.5 w-3.5" /></Button>
          </Link>
        </motion.div>
      )}

      {/* SRS M2: Onboarding checklist */}
      {!allDone && (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Setup checklist</h3>
              <span className="text-sm text-muted-foreground">{completedSteps}/{onboardingSteps.length} completed</span>
            </div>
            {/* Progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <motion.div className="h-full rounded-full bg-gradient-primary"
                initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{progressPct}% complete — finish setup to go live</p>
          </div>
          <div className="divide-y divide-border">
            {onboardingSteps.map((s, i) => (
              <Link key={s.id} to={s.done ? '#' : s.link}
                className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${s.done ? 'cursor-default' : 'hover:bg-muted/30'}`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  s.done ? 'border-success bg-success text-white' : 'border-border bg-background text-muted-foreground'
                }`}>
                  {s.done ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${s.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
                {!s.done && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </Link>
            ))}
          </div>
        </div>
      )}

      <PublishCard />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 font-semibold">Quick actions</h3>
          <div className="grid gap-2">
            {[
              { to: '/merchant/products', icon: Package, label: 'Add a product' },
              { to: '/merchant/themes', icon: TrendingUp, label: 'Customise theme' },
              { to: '/merchant/settings', icon: Users, label: 'Complete store profile' },
              { to: '/merchant/payments', icon: ShoppingCart, label: 'Setup payments' },
            ].map(a => (
              <Link key={a.to} to={a.to}>
                <Button variant="outline" className="w-full justify-start gap-3 text-sm">
                  <a.icon className="h-4 w-4" /> {a.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Recent orders</h3>
            <Link to="/merchant/orders" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <RecentOrders storeId={store?.id} />
        </div>
      </div>
    </div>
  )
}

function RecentOrders({ storeId }) {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['recent-orders', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data } = await supabase.from('orders').select('order_id,customer_name,total,status,created_at')
        .eq('store_id', storeId).order('created_at', { ascending: false }).limit(5)
      return data ?? []
    },
  })

  const STATUS_COLOR = {
    pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-blue-100 text-blue-700',
    shipped: 'bg-indigo-100 text-indigo-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }

  if (isLoading) return <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
  if (!orders.length) return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <ShoppingCart className="h-7 w-7 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">No orders yet.</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {orders.map(o => (
        <div key={o.order_id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs font-semibold text-muted-foreground">{o.order_id}</p>
            <p className="text-sm font-medium truncate">{o.customer_name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">৳ {Number(o.total).toLocaleString()}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[o.status] || 'bg-gray-100 text-gray-700'}`}>
              {o.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
