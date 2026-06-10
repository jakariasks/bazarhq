import { Link } from '@tanstack/react-router'
import { Package, ShoppingCart, Users, BarChart3, ArrowRight, TrendingUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PublishCard } from '@/components/publish-card'
import { useCurrentStore } from '@/lib/use-current-store'
import { supabase } from '@/integrations/supabase/client'

function DashboardPage() {
  const { store, isLoading } = useCurrentStore()

  const { data: productCount = 0 } = useQuery({
    queryKey: ['product-count', store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('store_id', store.id)
      return count ?? 0
    } })

  const stats = [
    { label: 'Revenue', value: '৳ 0', change: 'No orders yet', icon: TrendingUp },
    { label: 'Orders', value: '0', change: 'No orders yet', icon: ShoppingCart },
    { label: 'Products', value: String(productCount), change: `${productCount} in catalog`, icon: Package },
    { label: 'Customers', value: '0', change: 'No customers yet', icon: Users },
  ]

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-60 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0,1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    )
  }

  if (!store) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Package className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">No store yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">Create your first store to get started.</p>
        <Link to="/onboarding"><Button className="mt-6 bg-gradient-primary shadow-glow">Create a store <ArrowRight className="ml-1.5 h-4 w-4" /></Button></Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Welcome back{store.shop_name ? `, ${store.shop_name}` : ''}! 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here's what's happening with your store today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{s.label}</div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
                <s.icon className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-semibold">{s.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{s.change}</div>
          </div>
        ))}
      </div>

      <PublishCard />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Quick actions</h3>
          </div>
          <div className="grid gap-2">
            <Link to="/merchant/products">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Package className="h-4 w-4" /> Add a product
              </Button>
            </Link>
            <Link to="/merchant/themes">
              <Button variant="outline" className="w-full justify-start gap-3">
                <BarChart3 className="h-4 w-4" /> Customise theme
              </Button>
            </Link>
            <Link to="/merchant/settings">
              <Button variant="outline" className="w-full justify-start gap-3">
                <Users className="h-4 w-4" /> Complete store profile
              </Button>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 font-semibold">Recent orders</h3>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <ShoppingCart className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No orders yet. Share your storefront to get started.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
