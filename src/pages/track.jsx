import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  FileDown,
  FileText,
  Home,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Search,
  ShoppingBag,
  Store,
  Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/integrations/supabase/client'
import { downloadInvoicePdf, openInvoicePreview } from '@/lib/invoice'

const STATUS_STEPS = [
  { id: 'pending', label: 'Order Placed', icon: ShoppingBag, desc: 'We received your order' },
  { id: 'confirmed', label: 'Order Confirmed', icon: CheckCircle2, desc: 'Merchant confirmed your order' },
  { id: 'shipped', label: 'Shipped', icon: Truck, desc: 'Your order is on the way' },
  { id: 'delivered', label: 'Delivered', icon: Home, desc: 'Order delivered successfully' },
]

const STATUS_ORDER = STATUS_STEPS.map((step) => step.id)
const TRACKING_REFRESH_MS = 8_000
const NOT_FOUND_MESSAGE = 'Order not found.'

function getStepIndex(status) {
  if (status === 'cancelled') return -1
  return STATUS_ORDER.indexOf(String(status || '').toLowerCase())
}

function formatDate(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleString('en-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function normalizeStoreSlug(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''

  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw)
      const shopPathMatch = url.pathname.match(/\/shop\/([^/?#]+)/i)
      if (shopPathMatch?.[1]) return decodeURIComponent(shopPathMatch[1]).toLowerCase()

      const hostnameParts = url.hostname.split('.').filter(Boolean)
      if (hostnameParts.length > 2) return hostnameParts[0]
    }
  } catch {
    return ''
  }

  return raw
    .replace(/^\/?shop\//, '')
    .split(/[/?#]/)[0]
    .replace(/[^a-z0-9-]/g, '')
}

function normalizeBangladeshPhone(value) {
  let digits = String(value || '').replace(/\D/g, '')

  if (/^8801[3-9]\d{8}$/.test(digits)) digits = `0${digits.slice(3)}`
  else if (/^1[3-9]\d{8}$/.test(digits)) digits = `0${digits}`

  return /^01[3-9]\d{8}$/.test(digits) ? digits : ''
}

function safeBrandColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#6366f1'
}

function scrubPhoneFromAddressBar() {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('phone')) return

    url.searchParams.delete('phone')
    const nextUrl = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState(window.history.state, '', nextUrl)
  } catch {
    // Tracking still works if browser history APIs are unavailable.
  }
}

function paymentMethodLabel(method) {
  const normalized = String(method || '').toLowerCase()
  if (normalized === 'cod') return 'Cash on Delivery'
  if (normalized === 'ssl' || normalized === 'sslcommerz') return 'SSLCommerz'
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Not available'
}

function paymentStatusLabel(status) {
  const normalized = String(status || '').toLowerCase()
  if (['paid', 'collected'].includes(normalized)) return 'Paid'
  if (normalized === 'pending_verification') return 'Pending Verification'
  if (normalized === 'failed') return 'Payment Failed'
  if (normalized === 'cancelled') return 'Payment Cancelled'
  return 'Pending Collection'
}

function paymentStatusClass(status) {
  const normalized = String(status || '').toLowerCase()
  if (['paid', 'collected'].includes(normalized)) return 'bg-green-100 text-green-700'
  if (normalized === 'pending_verification') return 'bg-yellow-100 text-yellow-700'
  if (['failed', 'cancelled'].includes(normalized)) return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

export default function TrackPage() {
  const search = useSearch({ strict: false })
  const autoSearchStarted = useRef(false)
  const activeTrackingCredentials = useRef(null)

  const [storeSlug, setStoreSlug] = useState(search?.store || search?.shop || '')
  const [orderId, setOrderId] = useState(search?.order || search?.order_id || '')
  const [phone, setPhone] = useState(search?.phone || '')
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [store, setStore] = useState(null)
  const [trackingMeta, setTrackingMeta] = useState({
    archived: false,
    liveTrackingAvailable: false,
    deliveredAt: null,
    lastStatusAt: null,
    cancelReason: null,
  })
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const fetchTracking = useCallback(async ({ silent = false } = {}) => {
    const credentials = silent ? activeTrackingCredentials.current : null
    const normalizedSlug = credentials?.storeSlug || normalizeStoreSlug(storeSlug)
    const normalizedOrderId = credentials?.orderId || String(orderId || '').trim().toUpperCase()
    const normalizedPhone = credentials?.phone || normalizeBangladeshPhone(phone)

    if (!silent) scrubPhoneFromAddressBar()

    if (!normalizedSlug || !normalizedOrderId || !normalizedPhone) {
      if (!silent) {
        setSearched(true)
        setOrder(null)
        setTimeline([])
        setStore(null)
        setError(NOT_FOUND_MESSAGE)
      }
      return null
    }

    if (!silent) {
      activeTrackingCredentials.current = null
      setLoading(true)
      setError('')
      setOrder(null)
      setTimeline([])
      setStore(null)
      setSearched(true)
    }

    const { data, error: rpcError } = await supabase.rpc('get_public_order_tracking', {
      p_store_subdomain: normalizedSlug,
      p_order_id: normalizedOrderId,
      p_customer_phone: normalizedPhone,
    })

    if (rpcError) {
      if (!silent) {
        setError('Unable to check order status right now. Please try again.')
        setLoading(false)
      }
      return null
    }

    if (!data?.found || !data?.order) {
      if (!silent) {
        setError(NOT_FOUND_MESSAGE)
        setLoading(false)
      }
      return null
    }

    const nextTimeline = Array.isArray(data.timeline) ? data.timeline : []
    const nextMeta = {
      archived: Boolean(data.archived),
      liveTrackingAvailable: data.live_tracking_available !== false && !data.archived,
      deliveredAt: data.delivered_at || null,
      lastStatusAt: data.last_status_at || data.order.updated_at || data.order.created_at || null,
      cancelReason: data.cancel_reason || null,
    }

    activeTrackingCredentials.current = {
      storeSlug: normalizedSlug,
      orderId: normalizedOrderId,
      phone: normalizedPhone,
    }
    setStoreSlug(normalizedSlug)
    setOrderId(normalizedOrderId)
    setPhone(normalizedPhone)
    setOrder(data.order)
    setTimeline(nextTimeline)
    setStore(data.store || null)
    setTrackingMeta(nextMeta)
    setError('')
    if (!silent) setLoading(false)

    return data
  }, [orderId, phone, storeSlug])

  useEffect(() => {
    if (autoSearchStarted.current) return

    const hasCompleteSearchParams = Boolean(
      (search?.store || search?.shop)
      && (search?.order || search?.order_id)
      && search?.phone,
    )

    if (!hasCompleteSearchParams) return
    autoSearchStarted.current = true
    void fetchTracking()
  }, [fetchTracking, search])

  useEffect(() => {
    if (!order || trackingMeta.archived || !trackingMeta.liveTrackingAvailable) return undefined

    const interval = window.setInterval(() => {
      void fetchTracking({ silent: true })
    }, TRACKING_REFRESH_MS)

    return () => window.clearInterval(interval)
  }, [fetchTracking, order, trackingMeta.archived, trackingMeta.liveTrackingAvailable])

  const brandColor = safeBrandColor(store?.brand_color)
  const currentStepIdx = order ? getStepIndex(order.status) : -1
  const isCancelled = String(order?.status || '').toLowerCase() === 'cancelled'
  const isArchived = Boolean(trackingMeta.archived)
  const latestTimelineAt = trackingMeta.lastStatusAt
  const noRecentUpdate = Boolean(
    order
    && !isArchived
    && !['delivered', 'cancelled'].includes(String(order.status || '').toLowerCase())
    && latestTimelineAt
    && Date.now() - new Date(latestTimelineAt).getTime() > 48 * 60 * 60 * 1000,
  )

  const items = Array.isArray(order?.items) ? order.items : []
  const subtotal = Number(order?.subtotal ?? 0)
  const deliveryCharge = Number(order?.delivery_charge ?? 0)
  const discountAmount = Number(order?.discount_amount ?? 0)
  const total = Number(order?.total ?? 0)
  const symbol = '৳'
  const verifiedPhone = activeTrackingCredentials.current?.phone || normalizeBangladeshPhone(phone)
  const invoiceOrder = order ? {
    ...order,
    customer_phone: verifiedPhone || order.customer_phone_masked,
    cancellation_reason: trackingMeta.cancelReason || null,
  } : null
  const invoiceStore = store ? {
    ...store,
    storefront_url: store.subdomain && typeof window !== 'undefined'
      ? `${window.location.origin}/shop/${store.subdomain}`
      : store.website_url || '',
  } : null

  function handleViewInvoice() {
    if (!invoiceOrder || !invoiceStore) return
    openInvoicePreview(invoiceOrder, invoiceStore, {
      cancellationReason: trackingMeta.cancelReason,
      includePolicies: true,
    })
  }

  function handleDownloadInvoice() {
    if (!invoiceOrder || !invoiceStore) return
    downloadInvoicePdf(invoiceOrder, invoiceStore, {
      cancellationReason: trackingMeta.cancelReason,
      includePolicies: true,
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link
            to={storeSlug ? `/shop/${normalizeStoreSlug(storeSlug)}` : '/'}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Shop
          </Link>
          <div className="flex items-center gap-2">
            {store?.logo_url ? (
              <img src={store.logo_url} alt={store.shop_name || 'Shop'} className="h-7 w-7 rounded-lg object-cover" />
            ) : (
              <img src="/logo.png" alt="BazarHQ" className="h-7 w-7 rounded-lg object-contain" />
            )}
            <span className="font-semibold text-sm">{store?.shop_name || 'BazarHQ'}</span>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">Track Your Order</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the store slug, Order ID and registered phone number
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1.2fr_auto]">
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Store Slug</Label>
              <div className="relative">
                <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={storeSlug}
                  onChange={(event) => setStoreSlug(event.target.value.toLowerCase())}
                  placeholder="mrx-leather"
                  autoComplete="off"
                  className="pl-9 text-sm"
                  onKeyDown={(event) => event.key === 'Enter' && void fetchTracking()}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order ID</Label>
              <Input
                value={orderId}
                onChange={(event) => setOrderId(event.target.value.toUpperCase())}
                placeholder="e.g. BHQ-20260612-ABCD"
                autoComplete="off"
                className="font-mono text-sm"
                onKeyDown={(event) => event.key === 'Enter' && void fetchTracking()}
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registered Phone</Label>
              <div className="flex overflow-hidden rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-ring">
                <div className="flex shrink-0 items-center border-r border-border bg-muted px-2.5 text-xs text-muted-foreground">
                  🇧🇩
                </div>
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 13))}
                  placeholder="01XXXXXXXXX"
                  autoComplete="tel"
                  className="border-0 text-sm focus-visible:ring-0"
                  onKeyDown={(event) => event.key === 'Enter' && void fetchTracking()}
                />
              </div>
            </div>

            <div className="flex items-end sm:col-span-2 xl:col-span-1">
              <Button
                onClick={() => void fetchTracking()}
                disabled={loading}
                className="h-10 w-full gap-2 px-5 text-white xl:w-auto"
                style={{ background: brandColor }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? 'Searching…' : 'Track'}
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {order && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
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
                  }`}
                  >
                    {isCancelled ? 'Cancelled' : String(order.status || 'pending').replaceAll('_', ' ')}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> {formatDate(order.created_at)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" /> {items.length} item{items.length !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    {symbol} {total.toLocaleString()}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleViewInvoice}>
                    <FileText className="h-4 w-4" /> View Invoice
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2 text-white"
                    style={{ background: brandColor }}
                    onClick={handleDownloadInvoice}
                  >
                    <FileDown className="h-4 w-4" /> Download / Print PDF
                  </Button>
                </div>
              </section>

              {isArchived && (
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                    <div>
                      <p className="font-semibold">This order is archived</p>
                      <p className="mt-1 text-xs text-slate-600">
                        This order was delivered more than 90 days ago. Live tracking and timeline updates are no longer available.
                      </p>
                      {trackingMeta.deliveredAt && (
                        <p className="mt-2 text-xs font-medium text-slate-600">
                          Delivered: {formatDate(trackingMeta.deliveredAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {noRecentUpdate && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-semibold">No recent status change</p>
                      <p className="mt-1 text-xs text-amber-700">
                        There has been no status update for more than 48 hours. The latest confirmed status is still shown below.
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {!isCancelled && !isArchived ? (
                <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                  <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Order Progress</h2>
                  <div className="relative">
                    <div className="absolute bottom-5 left-5 top-5 w-0.5 bg-border" />
                    <div>
                      {STATUS_STEPS.map((step, index) => {
                        const done = index <= currentStepIdx
                        const active = index === currentStepIdx
                        const timelineEntry = timeline.find((entry) => entry.status === step.id)
                        const StepIcon = step.icon

                        return (
                          <div key={step.id} className="relative flex items-start gap-4 pb-6 last:pb-0">
                            <div
                              className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                                done
                                  ? active ? 'border-white shadow-lg' : 'border-green-500 bg-green-500'
                                  : 'border-border bg-white'
                              }`}
                              style={active ? { background: brandColor, borderColor: brandColor } : {}}
                            >
                              {done && !active ? (
                                <Check className="h-5 w-5 text-white" />
                              ) : (
                                <StepIcon className={`h-5 w-5 ${done ? 'text-white' : 'text-muted-foreground'}`} />
                              )}
                              {active && (
                                <span className="absolute inset-0 animate-ping rounded-full opacity-30" style={{ background: brandColor }} />
                              )}
                            </div>
                            <div className={`pt-1.5 ${done ? '' : 'opacity-40'}`}>
                              <p className={`text-sm font-semibold ${
                                active ? 'text-foreground' : done ? 'text-green-700' : 'text-muted-foreground'
                              }`}
                              >
                                {step.label}
                              </p>
                              <p className="text-xs text-muted-foreground">{step.desc}</p>
                              {timelineEntry?.created_at && (
                                <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(timelineEntry.created_at)}</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </section>
              ) : isCancelled ? (
                <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-red-800">Order Cancelled</p>
                      <p className="mt-1 text-sm text-red-700">
                        Reason: {trackingMeta.cancelReason || 'No cancellation reason was provided.'}
                      </p>
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
                <div className="border-b border-border bg-muted/30 px-5 py-3">
                  <h2 className="text-sm font-semibold">Items Ordered</h2>
                </div>
                <div className="divide-y divide-border">
                  {items.map((item, index) => {
                    const quantity = Number(item.qty ?? item.quantity ?? 1)
                    const price = Number(item.price ?? 0)
                    const lineTotal = Number(item.line_total ?? price * quantity)

                    return (
                      <div key={`${item.title || 'item'}-${index}`} className="flex items-center gap-3 px-5 py-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {item.image ? (
                            <img src={item.image} alt={item.title || 'Product'} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-medium">{item.title || 'Product'}</p>
                          {item.variant && <p className="text-xs text-muted-foreground">{item.variant}</p>}
                          <p className="text-xs text-muted-foreground">{symbol} {price.toLocaleString()} × {quantity}</p>
                        </div>
                        <p className="shrink-0 text-sm font-bold">{symbol} {lineTotal.toLocaleString()}</p>
                      </div>
                    )
                  })}
                </div>
                <div className="space-y-1 border-t border-border bg-muted/20 px-5 py-3">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span><span>{symbol} {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Delivery</span>
                    <span className={deliveryCharge === 0 ? 'font-medium text-green-600' : ''}>
                      {deliveryCharge === 0 ? 'Free' : `${symbol} ${deliveryCharge.toLocaleString()}`}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-700">
                      <span>Discount</span><span>− {symbol} {discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-2 font-bold">
                    <span>Total</span><span>{symbol} {total.toLocaleString()}</span>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">Delivery Details</h2>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                      <Package className="h-3.5 w-3.5" />
                    </div>
                    <span>{order.customer_name}</span>
                  </div>
                  {order.customer_phone_masked && (
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                        <Phone className="h-3.5 w-3.5" />
                      </div>
                      <span>{order.customer_phone_masked}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <MapPin className="h-3.5 w-3.5" />
                    </div>
                    <span>{order.delivery_address}{order.district ? `, ${order.district}` : ''}</span>
                  </div>
                  {order.delivery_note && (
                    <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs">Note: {order.delivery_note}</p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold">Payment</h2>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div>
                    <span className="font-medium">{paymentMethodLabel(order.payment_method)}</span>
                    {order.transaction_reference && (
                      <span className="ml-2 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                        Ref: {order.transaction_reference}
                      </span>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paymentStatusClass(order.payment_status)}`}>
                    {paymentStatusLabel(order.payment_status)}
                  </span>
                </div>
              </section>

              {store && (store.phone || store.whatsapp_number || store.contact_email) && (
                <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold">Need help? Contact {store.shop_name}</h2>
                  <div className="flex flex-wrap gap-2">
                    {store.whatsapp_number && (
                      <a href={`https://wa.me/${store.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
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
                    {store.contact_email && (
                      <a href={`mailto:${store.contact_email}`}>
                        <Button variant="outline" size="sm">Email</Button>
                      </a>
                    )}
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {searched && !loading && !order && !error && (
          <div className="mt-4 text-center text-sm text-muted-foreground">{NOT_FOUND_MESSAGE}</div>
        )}
      </main>
    </div>
  )
}
