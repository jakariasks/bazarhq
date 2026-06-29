import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  Mail,
  Users,
  Phone,
  MapPin,
  ShoppingBag,
  BadgeDollarSign,
  CalendarDays,
  Eye,
  FileDown,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentStore } from '@/lib/use-current-store'

function money(value) {
  return `৳ ${Number(value || 0).toLocaleString('en-BD')}`
}

function dateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function dateOnly(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function normalizeStatus(status) {
  return String(status || 'pending').replace(/_/g, ' ')
}

function getOrderTotal(order) {
  return Number(order.total ?? order.total_amount ?? order.grand_total ?? 0)
}

function getCustomerKey(order) {
  if (order.customer_id) return `id:${order.customer_id}`
  if (order.customer_email) return `email:${String(order.customer_email).trim().toLowerCase()}`
  if (order.customer_phone) return `phone:${String(order.customer_phone).trim()}`
  return `order:${order.id || order.order_id}`
}

function getItemsCount(order) {
  const items = Array.isArray(order.items) ? order.items : []
  return items.reduce((sum, item) => sum + Number(item.qty || item.quantity || 1), 0)
}

function statusClass(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'delivered') return 'bg-emerald-100 text-emerald-700'
  if (s === 'cancelled') return 'bg-red-100 text-red-700'
  if (s === 'shipped') return 'bg-indigo-100 text-indigo-700'
  if (s === 'confirmed') return 'bg-blue-100 text-blue-700'
  return 'bg-amber-100 text-amber-700'
}

function csvEscape(value) {
  const str = String(value ?? '')
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function exportCustomers(customers, shopName) {
  const rows = [
    ['Name', 'Email', 'Phone', 'District', 'Orders', 'Total Spent', 'Last Order', 'Last Status'],
    ...customers.map((c) => [
      c.name,
      c.email,
      c.phone,
      c.district,
      c.ordersCount,
      c.totalSpent,
      c.lastOrderAt,
      c.lastStatus,
    ]),
  ]

  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(shopName || 'bazarhq').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-customers.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function buildCustomersFromOrders(orders) {
  const map = new Map()

  for (const order of orders || []) {
    const key = getCustomerKey(order)
    const previous = map.get(key)
    const total = getOrderTotal(order)
    const created = order.created_at || order.inserted_at

    const base = previous || {
      key,
      customerId: order.customer_id || null,
      name: order.customer_name || 'Unknown customer',
      email: order.customer_email || '',
      phone: order.customer_phone || '',
      district: order.district || order.delivery_area || '',
      address: order.delivery_address || '',
      ordersCount: 0,
      totalSpent: 0,
      itemsCount: 0,
      lastOrderAt: created,
      lastStatus: order.status || 'pending',
      firstOrderAt: created,
      orders: [],
    }

    base.name = base.name || order.customer_name || 'Unknown customer'
    base.email = base.email || order.customer_email || ''
    base.phone = base.phone || order.customer_phone || ''
    base.district = base.district || order.district || order.delivery_area || ''
    base.address = base.address || order.delivery_address || ''
    base.ordersCount += 1
    base.totalSpent += total
    base.itemsCount += getItemsCount(order)
    base.orders.push(order)

    if (created && (!base.lastOrderAt || new Date(created) > new Date(base.lastOrderAt))) {
      base.lastOrderAt = created
      base.lastStatus = order.status || 'pending'
    }
    if (created && (!base.firstOrderAt || new Date(created) < new Date(base.firstOrderAt))) {
      base.firstOrderAt = created
    }

    map.set(key, base)
  }

  return [...map.values()].sort((a, b) => new Date(b.lastOrderAt || 0) - new Date(a.lastOrderAt || 0))
}

export default function CustomersPage() {
  const { store, isLoading: storeLoading } = useCurrentStore()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['merchant-customers-orders', store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
  })

  const customers = useMemo(() => buildCustomersFromOrders(orders), [orders])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return customers
    return customers.filter((c) =>
      c.name?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term) ||
      c.phone?.includes(term) ||
      c.district?.toLowerCase().includes(term)
    )
  }, [customers, q])

  const stats = useMemo(() => ({
    totalCustomers: customers.length,
    totalOrders: orders.length,
    totalRevenue: customers.reduce((sum, c) => sum + Number(c.totalSpent || 0), 0),
    repeatCustomers: customers.filter((c) => c.ordersCount > 1).length,
  }), [customers, orders.length])

  if (storeLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!store) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <Users className="h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-semibold">No active store found</h2>
        <p className="mt-1 text-sm text-muted-foreground">Create or select a store to view customer information.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customers are generated automatically from orders placed in this store.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => exportCustomers(filtered, store.shop_name)}
          disabled={!filtered.length}
          className="gap-2"
        >
          <FileDown className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total customers</p>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold">{stats.totalCustomers}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Customer orders</p>
            <ShoppingBag className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold">{stats.totalOrders}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Customer revenue</p>
            <BadgeDollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold">{money(stats.totalRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Repeat customers</p>
            <CalendarDays className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold">{stats.repeatCustomers}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, email, phone, or district…"
              className="pl-9"
            />
          </div>
        </div>

        {error ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold">Could not load customers</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {error.message}. Make sure the merchant can read orders for this store.
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center px-6 py-16">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-base font-semibold">No customers found</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {orders.length ? 'Try another search term.' : 'Customer information will appear here after a customer places an order.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((customer) => (
              <div key={customer.key} className="flex flex-col gap-4 p-4 transition-colors hover:bg-muted/40 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">
                    {(customer.name || customer.email || customer.phone || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{customer.name || 'Unknown customer'}</h3>
                      {customer.ordersCount > 1 && <Badge variant="secondary">Repeat</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {customer.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {customer.email}</span>}
                      {customer.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {customer.phone}</span>}
                      {customer.district && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {customer.district}</span>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-sm lg:w-[360px]">
                  <div className="rounded-xl bg-muted/60 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Orders</p>
                    <p className="font-semibold">{customer.ordersCount}</p>
                  </div>
                  <div className="rounded-xl bg-muted/60 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Spent</p>
                    <p className="font-semibold">{money(customer.totalSpent)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/60 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Last</p>
                    <p className="font-semibold">{dateOnly(customer.lastOrderAt)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 lg:justify-end">
                  <Badge className={statusClass(customer.lastStatus)}>{normalizeStatus(customer.lastStatus)}</Badge>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelected(customer)}>
                    <Eye className="h-4 w-4" /> View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Customer details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-base font-bold text-primary-foreground">
                    {(selected.name || selected.email || selected.phone || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold">{selected.name || 'Unknown customer'}</h3>
                    <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {selected.email || 'No email saved'}</p>
                      <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {selected.phone || 'No phone saved'}</p>
                      <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {selected.district || 'No district saved'}</p>
                      <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> First order: {dateOnly(selected.firstOrderAt)}</p>
                    </div>
                    {selected.address && <p className="mt-2 text-sm text-muted-foreground">Address: {selected.address}</p>}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">Total orders</p>
                  <p className="mt-1 text-xl font-bold">{selected.ordersCount}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">Total spent</p>
                  <p className="mt-1 text-xl font-bold">{money(selected.totalSpent)}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">Items bought</p>
                  <p className="mt-1 text-xl font-bold">{selected.itemsCount}</p>
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-sm font-semibold">Order history</h4>
                <div className="max-h-[320px] overflow-auto rounded-xl border border-border">
                  <div className="divide-y divide-border">
                    {selected.orders.map((order) => (
                      <div key={order.id || order.order_id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-mono text-sm font-semibold">{order.order_id || order.id}</p>
                          <p className="text-xs text-muted-foreground">{dateTime(order.created_at)} · {getItemsCount(order)} item(s)</p>
                        </div>
                        <div className="flex items-center gap-2 sm:justify-end">
                          <Badge className={statusClass(order.status)}>{normalizeStatus(order.status)}</Badge>
                          <span className="text-sm font-semibold">{money(getOrderTotal(order))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
