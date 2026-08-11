import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ShoppingCart, Package, Truck, CheckCircle2,
  XCircle, Clock, Eye, Loader2, Phone,
  MapPin, CreditCard, AlertCircle, X, Check, FileDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentStore } from '@/lib/use-current-store'
import { downloadInvoicePdf } from '@/lib/invoice'

const STATUS_CONFIG = {
  pending:    { label: 'Pending',    color: 'bg-amber-100 text-amber-800',   icon: Clock,        next: 'confirmed' },
  confirmed:  { label: 'Confirmed',  color: 'bg-blue-100 text-blue-800',     icon: Check,        next: 'shipped' },
  shipped:    { label: 'Shipped',    color: 'bg-indigo-100 text-indigo-800', icon: Truck,        next: 'delivered' },
  delivered:  { label: 'Delivered',  color: 'bg-green-100 text-green-800',   icon: CheckCircle2, next: null },
  cancelled:  { label: 'Cancelled',  color: 'bg-red-100 text-red-800',       icon: XCircle,      next: null },
}

const NEXT_LABEL = {
  confirmed: 'Confirm Order',
  shipped:   'Mark as Shipped',
  delivered: 'Mark as Delivered',
}

const PAY_STATUS = {
  pending:              { label: 'Pending',      color: 'bg-gray-100 text-gray-700' },
  pending_verification: { label: 'Unverified',   color: 'bg-yellow-100 text-yellow-700' },
  paid:                 { label: 'Paid',          color: 'bg-green-100 text-green-700' },
  collected:            { label: 'Collected',     color: 'bg-green-100 text-green-700' },
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-BD', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export default function OrdersPage() {
  const { store } = useCurrentStore()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [sortBy, setSortBy] = useState('newest')
  const [cancelReason, setCancelReason] = useState('')
  const [updatingOrderId, setUpdatingOrderId] = useState(null)

  const { data: orders = [], isLoading, error: ordersError } = useQuery({
    queryKey: ['orders', store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const filtered = useMemo(() => {
    let list = orders.filter(o => {
      const matchStatus = filterStatus === 'all' || o.status === filterStatus
      const matchQ = !q || o.order_id?.toLowerCase().includes(q.toLowerCase()) ||
        o.customer_name?.toLowerCase().includes(q.toLowerCase()) ||
        o.customer_phone?.includes(q)
      return matchStatus && matchQ
    })
    switch (sortBy) {
      case 'oldest': list = [...list].sort((a,b) => new Date(a.created_at)-new Date(b.created_at)); break
      case 'total-desc': list = [...list].sort((a,b) => Number(b.total)-Number(a.total)); break
      case 'total-asc': list = [...list].sort((a,b) => Number(a.total)-Number(b.total)); break
      default: break // newest — already sorted
    }
    return list
  }, [orders, filterStatus, q, sortBy])

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {})

  const invalidateOrderData = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['orders', store?.id] }),
      qc.invalidateQueries({ queryKey: ['order-stats', store?.id] }),
      qc.invalidateQueries({ queryKey: ['recent-orders', store?.id] }),
      qc.invalidateQueries({ queryKey: ['merchant-analytics-v3', store?.id] }),
      qc.invalidateQueries({ queryKey: ['merchant-customers-orders', store?.id] }),
    ])
  }

  const appendTimeline = async ({ orderId, status, note }) => {
    const { error } = await supabase
      .from('order_timeline')
      .insert({ order_id: orderId, status, note })
    if (error) toast.warning('Order updated, but the timeline entry could not be saved.')
  }

  const updateStatus = async (order, newStatus) => {
    if (!store?.id || updatingOrderId === order.id) return
    setUpdatingOrderId(order.id)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id)
        .eq('store_id', store.id)
      if (error) throw error

      await appendTimeline({ orderId: order.id, status: newStatus, note: `Order ${newStatus}` })
      toast.success(`Order marked as ${newStatus}`)
      await invalidateOrderData()
      if (selectedOrder?.id === order.id) setSelectedOrder(prev => ({ ...prev, status: newStatus }))
    } catch (error) {
      toast.error(error.message || 'Could not update the order')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const cancelOrder = async () => {
    if (!selectedOrder || !store?.id || updatingOrderId === selectedOrder.id) return
    if (selectedOrder.status === 'delivered') { toast.error('Delivered orders cannot be cancelled'); return }
    if (!cancelReason.trim()) { toast.error('Please provide a cancellation reason'); return }

    setUpdatingOrderId(selectedOrder.id)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', selectedOrder.id)
        .eq('store_id', store.id)
      if (error) throw error

      await appendTimeline({ orderId: selectedOrder.id, status: 'cancelled', note: cancelReason.trim() })
      toast.success('Order cancelled')
      await invalidateOrderData()
      setCancelOpen(false)
      setCancelReason('')
      setSelectedOrder(prev => prev ? ({ ...prev, status: 'cancelled', cancellation_reason: cancelReason.trim() }) : prev)
    } catch (error) {
      toast.error(error.message || 'Could not cancel the order')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const updatePaymentStatus = async (order, payStatus) => {
    if (!store?.id || updatingOrderId === order.id) return
    setUpdatingOrderId(order.id)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: payStatus })
        .eq('id', order.id)
        .eq('store_id', store.id)
      if (error) throw error

      toast.success(`Payment marked as ${payStatus}`)
      await invalidateOrderData()
      if (selectedOrder?.id === order.id) setSelectedOrder(prev => ({ ...prev, payment_status: payStatus }))
    } catch (error) {
      toast.error(error.message || 'Could not update payment status')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const openDetail = (order) => { setSelectedOrder(order); setDetailOpen(true) }

  const downloadInvoice = (order) => {
    downloadInvoicePdf(order, store, {
      cancellationReason: order.cancellation_reason || order.cancel_reason || '',
    })
  }

  if (!store) return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <ShoppingCart className="h-10 w-10 text-muted-foreground" />
      <h3 className="mt-4 font-semibold">No store selected</h3>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {orders.length} total · {statusCounts['pending'] || 0} pending action
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'All', count: orders.length },
          { id: 'pending', label: 'Pending', count: statusCounts['pending'] || 0 },
          { id: 'confirmed', label: 'Confirmed', count: statusCounts['confirmed'] || 0 },
          { id: 'shipped', label: 'Shipped', count: statusCounts['shipped'] || 0 },
          { id: 'delivered', label: 'Delivered', count: statusCounts['delivered'] || 0 },
          { id: 'cancelled', label: 'Cancelled', count: statusCounts['cancelled'] || 0 },
        ].map(tab => (
          <button key={tab.id} onClick={() => setFilterStatus(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              filterStatus === tab.id ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
            }`}>
            {tab.label}
            {tab.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filterStatus === tab.id ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by order ID, name or phone…" value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="total-desc">Total: High to Low</option>
              <option value="total-asc">Total: Low to High</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">{[0,1,2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : ordersError ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <AlertCircle className="h-9 w-9 text-destructive" />
            <h3 className="mt-3 font-semibold">Orders could not be loaded</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{ordersError.message || 'Please refresh and try again.'}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-semibold">{q || filterStatus !== 'all' ? 'No orders match' : 'No orders yet'}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{q || filterStatus !== 'all' ? 'Try clearing filters.' : 'Orders will appear here once customers shop.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(order => {
              const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
              const pc = PAY_STATUS[order.payment_status] || PAY_STATUS.pending
              const items = Array.isArray(order.items) ? order.items : []
              return (
                <motion.div key={order.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold">{order.order_id}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${sc.color}`}>
                        <sc.icon className="h-3 w-3" />{sc.label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${pc.color}`}>{pc.label}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{order.customer_name}</span>
                      <span>{order.customer_phone}</span>
                      <span>{formatDate(order.created_at)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {items.length} item{items.length !== 1 ? 's' : ''} · ৳ {Number(order.total).toLocaleString()} · {order.payment_method?.toUpperCase()}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {sc.next && (
                      <Button size="sm" disabled={updatingOrderId === order.id} onClick={() => updateStatus(order, sc.next)}
                        className="gap-1.5 bg-gradient-primary text-xs text-primary-foreground">
                        {updatingOrderId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        {NEXT_LABEL[sc.next]}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openDetail(order)} className="gap-1.5 text-xs">
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          {selectedOrder && (() => {
            const o = selectedOrder
            const sc = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending
            const items = Array.isArray(o.items) ? o.items : []
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <DialogTitle className="font-mono">{o.order_id}</DialogTitle>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sc.color}`}>{sc.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Placed {formatDate(o.created_at)}</p>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {/* Actions */}
                  {o.status !== 'cancelled' && o.status !== 'delivered' && (
                    <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/30 p-3">
                      {sc.next && (
                        <Button size="sm" disabled={updatingOrderId === o.id} onClick={() => updateStatus(o, sc.next)}
                          className="gap-1.5 bg-gradient-primary text-primary-foreground">
                          {updatingOrderId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          {NEXT_LABEL[sc.next]}
                        </Button>
                      )}
                      {o.payment_method === 'cod' && o.payment_status !== 'collected' && (
                        <Button size="sm" variant="outline" disabled={updatingOrderId === o.id} onClick={() => updatePaymentStatus(o, 'collected')} className="gap-1.5">
                          <CreditCard className="h-3.5 w-3.5" /> Mark Payment Collected
                        </Button>
                      )}
                      {['bkash','nagad','rocket'].includes(o.payment_method) && o.payment_status === 'pending_verification' && (
                        <Button size="sm" variant="outline" disabled={updatingOrderId === o.id} onClick={() => updatePaymentStatus(o, 'paid')} className="gap-1.5 text-green-700 border-green-300">
                          <Check className="h-3.5 w-3.5" /> Verify Payment
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="ml-auto gap-1.5 text-destructive" onClick={() => { setDetailOpen(false); setCancelOpen(true) }}>
                        <XCircle className="h-3.5 w-3.5" /> Cancel Order
                      </Button>
                    </div>
                  )}

                  {/* Customer */}
                  <Section title="Customer & Delivery">
                    <Row icon={Package}><span className="font-medium">{o.customer_name}</span></Row>
                    <Row icon={Phone}>{o.customer_phone}</Row>
                    <Row icon={MapPin}>{o.delivery_address}{o.delivery_area ? `, ${o.delivery_area}` : ''}, {o.district}</Row>
                    {o.delivery_note && <Row icon={AlertCircle}>{o.delivery_note}</Row>}
                  </Section>

                  {/* Payment */}
                  <Section title="Payment">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="capitalize font-medium">{o.payment_method === 'cod' ? 'Cash on Delivery' : o.payment_method}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PAY_STATUS[o.payment_status]?.color || 'bg-gray-100 text-gray-700'}`}>
                        {PAY_STATUS[o.payment_status]?.label || o.payment_status}
                      </span>
                      {o.transaction_id && <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">Txn: {o.transaction_id}</span>}
                    </div>
                  </Section>

                  {/* Items */}
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="border-b border-border bg-muted/30 px-4 py-2.5">
                      <h3 className="text-sm font-semibold">Items ({items.length})</h3>
                    </div>
                    <div className="divide-y divide-border">
                      {items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 px-4 py-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {item.image ? <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                              : <div className="flex h-full w-full items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">৳ {Number(item.price).toLocaleString()} × {item.qty}</p>
                          </div>
                          <p className="text-sm font-bold">৳ {(item.price * item.qty).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-1">
                      <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span>৳ {Number(o.subtotal || o.total).toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm text-muted-foreground"><span>Delivery</span><span>৳ {Number(o.delivery_charge ?? o.shipping_charge ?? 0).toLocaleString()}</span></div>
                      {Number(o.discount_amount ?? o.coupon_discount ?? 0) > 0 && <div className="flex justify-between text-sm text-green-700"><span>Discount</span><span>− ৳ {Number(o.discount_amount ?? o.coupon_discount ?? 0).toLocaleString()}</span></div>}
                      <div className="flex justify-between font-bold border-t border-border pt-2"><span>Total</span><span>৳ {Number(o.total).toLocaleString()}</span></div>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => downloadInvoice(selectedOrder)} className="gap-2">
                    <FileDown className="h-4 w-4"/> Download Invoice
                  </Button>
                  <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="mb-4 text-sm text-muted-foreground">
              Please provide a reason for cancellation. The customer will be notified.
            </p>
            <div className="grid gap-2">
              <Label>Cancellation reason <span className="text-destructive">*</span></Label>
              <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                placeholder="e.g. Out of stock, Customer requested, Payment not verified…"
                rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelOpen(false); setCancelReason('') }}>Go back</Button>
            <Button variant="destructive" onClick={cancelOrder} disabled={updatingOrderId === selectedOrder?.id || !cancelReason.trim()}>
              {updatingOrderId === selectedOrder?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ icon: Icon, children }) {
  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
