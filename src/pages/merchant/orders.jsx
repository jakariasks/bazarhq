import { Search, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
function OrdersPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Orders</h1><p className="mt-1 text-sm text-muted-foreground">Track and fulfil customer orders</p></div>
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search orders…" className="pl-9" /></div>
          <div className="flex gap-2 flex-wrap">{['All','Pending','Paid','Shipped','Delivered'].map((s, i) => <Button key={s} variant={i===0?'default':'outline'} size="sm">{s}</Button>)}</div>
        </div>
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><ShoppingCart className="h-6 w-6 text-muted-foreground" /></div>
          <h3 className="mt-4 text-base font-semibold">No orders yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">When customers place orders on your storefront, they'll show up here.</p>
        </div>
      </div>
    </div>
  )
}

export default OrdersPage
