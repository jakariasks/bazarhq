import { useEffect, useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, CheckCircle2, Truck, MapPin, Check,
  Search, Phone, AlertCircle, Clock, Loader2,
  ShoppingBag, MessageCircle, ArrowLeft, Home,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/integrations/supabase/client'

const STATUS_STEPS = [
  { id: 'pending',    label: 'Order Placed',        icon: ShoppingBag,  desc: 'We received your order' },
  { id: 'confirmed',  label: 'Order Confirmed',      icon: CheckCircle2, desc: 'Merchant confirmed your order' },
  { id: 'shipped',    label: 'Shipped',              icon: Truck,        desc: 'Your order is on the way' },
  { id: 'delivered',  label: 'Delivered',            icon: Home,         desc: 'Order delivered successfully' },
]

const STATUS_ORDER = ['pending','confirmed','shipped','delivered']

function getStepIndex(status) {
  if (status === 'cancelled') return -1
  return STATUS_ORDER.indexOf(status)
}

function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleString('en-BD', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export default function TrackPage() {
  const search = useSearch({ strict: false })

  // Pre-fill from URL params (coming from order success page)
  const [storeSlug, setStoreSlug] = useState(search?.store || search?.shop || '')
  const [orderId, setOrderId] = useState(search?.order || search?.order_id || '')
  const [phone, setPhone] = useState(search?.phone || '')
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [store, setStore] = useState(null)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  // Auto-search if all params provided from URL
  useEffect(() => {
    if ((search?.order || search?.order_id) && search?.phone && (search?.store || search?.shop)) {
      handleSearch()
    }
  }, []) // eslint-disable-line

  const handleSearch = async () => {
    const oid = orderId.trim()
    const ph = phone.replace(/\D/g,'')
    if (!oid) { setError('Please enter your Order ID'); return }
    if (!ph || ph.length < 10) { setError('Please enter your phone number'); return }

    setLoading(true)
    setError('')
    setOrder(null)
    setSearched(true)

    // Find order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', oid)
      .maybeSingle()

    if (orderError || !orderData) {
      setLoading(false)
      setError('Order not found.')
      return
    }

    // Verify phone matches (last 10 digits)
    const storedPhone = (orderData.customer_phone || '').replace(/\D/g,'')
    const inputPhone = ph
    if (!storedPhone.endsWith(inputPhone.slice(-10)) && !inputPhone.endsWith(storedPhone.slice(-10))) {
      setLoading(false)
      setError('Order not found.')
      return
    }

    // Load timeline
    const { data: timelineData } = await supabase
      .from('order_timeline')
      .select('*')
      .eq('order_id', orderData.id)
      .order('created_at', { ascending: true })

    // Load store
    const { data: storeData } = await supabase
      .from('stores')
      .select('shop_name, logo_url, brand_color, phone, contact_email, whatsapp_number, subdomain')
      .eq('id', orderData.store_id)
      .maybeSingle()

    setOrder(orderData)
    setTimeline(timelineData ?? [])
    setStore(storeData)
    setLoading(false)
  }

  const brandColor = store?.brand_color || '#6366f1'
  const symbol = '৳'
  const currentStepIdx = order ? getStepIndex(order.status) : -1
  const isCancelled = order?.status === 'cancelled'
  const deliveredAt = timeline.find((entry) => entry.status === 'delivered')?.created_at || order?.updated_at || order?.created_at
  const latestTimelineAt = timeline.length ? timeline[timeline.length - 1]?.created_at : order?.updated_at || order?.created_at
  const isArchived = order?.status === 'delivered' && deliveredAt && (Date.now() - new Date(deliveredAt).getTime()) > 90 * 24 * 60 * 60 * 1000
  const noRecentUpdate = order && !['delivered', 'cancelled'].includes(order.status) && latestTimelineAt && (Date.now() - new Date(latestTimelineAt).getTime()) > 48 * 60 * 60 * 1000

  const items = Array.isArray(order?.items) ? order.items : []
  const total = order?.total ?? 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link to={storeSlug ? `/shop/${storeSlug}` : '/shop'} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Shop
          </Link>
          <div className="flex items-center gap-2">
            {store?.logo_url
              ? <img src={store.logo_url} alt={store.shop_name} className="h-7 w-7 rounded-lg object-cover" />
              : <img src="/logo.png" alt="BazarHQ" className="h-7 w-7 rounded-lg object-contain" />
            }
            <span className="font-semibold text-sm">{store?.shop_name || 'BazarHQ'}</span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">Track Your Order</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your Order ID and phone number to check status</p>
        </div>

        {/* Search form */}
        <div className="mb-6 rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order ID</Label>
              <Input
                value={orderId}
                onChange={e => setOrderId(e.target.value.toUpperCase())}
                placeholder="e.g. BHQ-20260612-ABCD"
                className="font-mono text-sm"
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone Number</Label>
              <div className="flex overflow-hidden rounded-lg border border-border focus-within:ring-2 focus-within:ring-ring bg-background">
                <div className="flex shrink-0 items-center border-r border-border bg-muted px-2.5 text-xs text-muted-foreground">
                  🇧🇩 +880
                </div>
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,11))}
                  placeholder="01XXXXXXXXX"
                  className="border-0 focus-visible:ring-0 text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={loading} className="h-10 w-full gap-2 text-white sm:w-auto px-5"
                style={{ background: brandColor }}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? 'Searching…' : 'Track'}
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Order results */}
        <AnimatePresence>
          {order && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
              className="space-y-4">

              {/* Status header */}
              <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Order ID</p>
                    <p className="mt-0.5 font-mono text-lg font-bold">{order.order_id}</p>
                  </div>
                  <div className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                    isCancelled ? 'bg-red-100 text-red-700'
                    : order.status === 'delivered' ? 'bg-green-100 text-green-700'
                    : order.status === 'shipped' ? 'bg-blue-100 text-blue-700'
                    : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isCancelled ? 'Cancelled' : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />
                    {formatDate(order.created_at)}
                  </div>
                  <div className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" />
                    {items.length} item{items.length !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    {symbol} {Number(total).toLocaleString()}
                  </div>
                </div>
              </div>

              {isArchived && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                    <div>
                      <p className="font-semibold">This order is archived</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Delivered orders older than 90 days no longer show live tracking updates. The order summary remains visible for reference.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {noRecentUpdate && !isArchived && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-semibold">No recent status change</p>
                      <p className="mt-1 text-xs text-amber-700">
                        There has been no status update for more than 48 hours. The latest confirmed status is still shown below.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline */}
              {!isCancelled && !isArchived ? (
                <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                  <h3 className="mb-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Order Progress</h3>
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-border" />
                    <div className="space-y-0">
                      {STATUS_STEPS.map((s, i) => {
                        const done = i <= currentStepIdx
                        const active = i === currentStepIdx
                        const timelineEntry = timeline.find(t => t.status === s.id)
                        return (
                          <div key={s.id} className="relative flex items-start gap-4 pb-6 last:pb-0">
                            <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                              done
                                ? active
                                  ? 'border-white shadow-lg'
                                  : 'border-green-500 bg-green-500'
                                : 'border-border bg-white'
                            }`} style={active ? { background: brandColor, borderColor: brandColor } : {}}>
                              {done && !active
                                ? <Check className="h-5 w-5 text-white" />
                                : <s.icon className={`h-5 w-5 ${done ? 'text-white' : 'text-muted-foreground'}`} />
                              }
                              {active && (
                                <span className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: brandColor }} />
                              )}
                            </div>
                            <div className={`pt-1.5 ${done ? '' : 'opacity-40'}`}>
                              <p className={`text-sm font-semibold ${active ? 'text-foreground' : done ? 'text-green-700' : 'text-muted-foreground'}`}>
                                {s.label}
                              </p>
                              <p className="text-xs text-muted-foreground">{s.desc}</p>
                              {timelineEntry?.created_at && (
                                <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(timelineEntry.created_at)}</p>
                              )}
                              {timelineEntry?.note && timelineEntry.note !== 'Order placed by customer' && (
                                <p className="mt-1 rounded-lg bg-muted px-2 py-1 text-xs text-foreground">{timelineEntry.note}</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : isCancelled ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-red-800">Order Cancelled</p>
                      {timeline.find(t => t.status === 'cancelled')?.note && (
                        <p className="text-sm text-red-600">Reason: {timeline.find(t => t.status === 'cancelled')?.note}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Order items */}
              <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-5 py-3">
                  <h3 className="text-sm font-semibold">Items Ordered</h3>
                </div>
                <div className="divide-y divide-border">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-5 py-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {item.image
                          ? <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                          : <div className="flex h-full w-full items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{symbol} {Number(item.price).toLocaleString()} × {item.qty}</p>
                      </div>
                      <p className="shrink-0 text-sm font-bold">{symbol} {(item.price * item.qty).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border bg-muted/20 px-5 py-3 space-y-1">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span><span>{symbol} {Number(order.subtotal || total).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Delivery</span><span className="text-green-600 font-medium">Free</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-bold">
                    <span>Total</span><span>{symbol} {Number(total).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Delivery info */}
              <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold">Delivery Details</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted"><Package className="h-3.5 w-3.5" /></div>
                    <span>{order.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted"><Phone className="h-3.5 w-3.5" /></div>
                    <span>+880 {order.customer_phone}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted"><MapPin className="h-3.5 w-3.5" /></div>
                    <span>{order.delivery_address}{order.delivery_area ? `, ${order.delivery_area}` : ''}, {order.district}</span>
                  </div>
                </div>
              </div>

              {/* Payment info */}
              <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold">Payment</h3>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div>
                    <span className="capitalize font-medium">{order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method}</span>
                    {order.transaction_id && (
                      <span className="ml-2 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                        Txn: {order.transaction_id}
                      </span>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    order.payment_status === 'paid' ? 'bg-green-100 text-green-700'
                    : order.payment_status === 'pending_verification' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-600'
                  }`}>
                    {order.payment_status === 'paid' ? 'Paid'
                      : order.payment_status === 'pending_verification' ? 'Pending Verification'
                      : 'Pending Collection'}
                  </span>
                </div>
              </div>

              {/* Contact shop */}
              {store && (store.phone || store.whatsapp_number || store.contact_email) && (
                <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold">Need help? Contact {store.shop_name}</h3>
                  <div className="flex flex-wrap gap-2">
                    {store.whatsapp_number && (
                      <a href={`https://wa.me/${store.whatsapp_number.replace(/\D/g,'')}`} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="gap-2">
                          <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
                        </Button>
                      </a>
                    )}
                    {store.phone && (
                      <a href={`tel:${store.phone}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Phone className="h-4 w-4" /> Call
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {searched && !loading && !order && !error && (
          <div className="mt-4 text-center text-sm text-muted-foreground">No results found.</div>
        )}
      </div>
    </div>
  )
}
