// Checkout — SRS C2 + C3 complete implementation
import { useEffect, useState, useCallback } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check, ChevronRight, Loader2, ShoppingBag, MapPin, CreditCard, ClipboardList,
  Phone, User, Home, Package, AlertCircle, ArrowLeft, CheckCircle2,
  Minus, Plus, Trash2, X, RefreshCw, Mail,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/integrations/supabase/client'
import {
  getCart, setCart, updateQty as cartUpdateQty, removeFromCart, clearCart,
  cartTotal, cartCount, generateOrderId, validateCartAgainstDB,
} from '@/lib/cart'

const BD_DISTRICTS = [
  'Bagerhat','Bandarban','Barguna','Barisal','Bhola','Bogura','Brahmanbaria',
  'Chandpur','Chapainawabganj','Chittagong','Chuadanga','Comilla',"Cox's Bazar",
  'Dhaka','Dinajpur','Faridpur','Feni','Gaibandha','Gazipur','Gopalganj',
  'Habiganj','Jamalpur','Jessore','Jhalkathi','Jhenaidah','Joypurhat',
  'Khagrachari','Khulna','Kishoreganj','Kurigram','Kushtia','Lakshmipur',
  'Lalmonirhat','Madaripur','Magura','Manikganj','Meherpur','Moulvibazar',
  'Munshiganj','Mymensingh','Naogaon','Narail','Narayanganj','Narsingdi',
  'Natore','Netrokona','Nilphamari','Noakhali','Pabna','Panchagarh',
  'Patuakhali','Pirojpur','Rajbari','Rajshahi','Rangamati','Rangpur',
  'Satkhira','Shariatpur','Sherpur','Sirajganj','Sunamganj','Sylhet',
  'Tangail','Thakurgaon',
]

const STEPS = [
  { id: 1, label: 'Delivery', icon: MapPin },
  { id: 2, label: 'Payment', icon: CreditCard },
  { id: 3, label: 'Review',  icon: ClipboardList },
]

const PAY_METHODS = [
  { id: 'bkash',  label: 'bKash',           emoji: '🔴', color: '#E2136E', desc: 'Pay via bKash mobile banking' },
  { id: 'nagad',  label: 'Nagad',            emoji: '🟠', color: '#F7941D', desc: 'Pay via Nagad mobile banking' },
  { id: 'rocket', label: 'Rocket (DBBL)',    emoji: '🟣', color: '#8B3FC8', desc: 'Pay via Dutch Bangla Rocket' },
  { id: 'cod',    label: 'Cash on Delivery', emoji: '💵', color: '#16A34A', desc: 'Pay in cash when you receive' },
]

function validatePhone(p) {
  const d = p.replace(/\D/g,'')
  if (d.length !== 11) return 'Must be 11 digits (e.g. 01712345678)'
  if (!/^01[3-9]/.test(d)) return 'Must start with 013–019'
  return null
}

export default function CheckoutPage() {
  const search = useSearch({ strict: false })
  const storeSubdomain = search?.store

  const [step, setStep] = useState(1)
  const [store, setStore] = useState(null)
  const [cart, setCartState] = useState([])
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [cartIssues, setCartIssues] = useState([])
  const [orderId, setOrderId] = useState(null)
  const [savedName, setSavedName] = useState('')
  const [savedPhone, setSavedPhone] = useState('')
  const [savedTotal, setSavedTotal] = useState(0)
  const [savedPayMethod, setSavedPayMethod] = useState('')

  // Delivery fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('') // SRS C3: optional email for confirmation
  const [address, setAddress] = useState('')
  const [district, setDistrict] = useState('')
  const [area, setArea] = useState('')
  const [note, setNote] = useState('')
  const [phoneError, setPhoneError] = useState('')

  // Payment fields
  const [payMethod, setPayMethod] = useState('')
  const [transactionId, setTransactionId] = useState('')

  // Load store + cart
  useEffect(() => {
    if (!storeSubdomain) { setLoading(false); return }
    supabase.from('stores').select('*').eq('subdomain', storeSubdomain).maybeSingle()
      .then(({ data }) => {
        setStore(data)
        if (data?.id) setCartState(getCart(data.id))
        setLoading(false)
      })
  }, [storeSubdomain])

  // SRS C2: validate cart vs DB when reaching step 3 (review)
  const validateCart = useCallback(async () => {
    if (!store?.id) return true
    setValidating(true)
    const { issues, cart: updatedCart } = await validateCartAgainstDB(store.id, supabase)
    setCartState(updatedCart)
    setValidating(false)

    if (issues.length > 0) {
      setCartIssues(issues)
      return false
    }
    setCartIssues([])
    return true
  }, [store?.id])

  const total = cartTotal(cart)
  const count = cartCount(cart)
  const symbol = store?.currency === 'USD' ? '$' : store?.currency === 'EUR' ? '€' : '৳'
  const brandColor = store?.brand_color || '#6366f1'

  const syncCart = (next) => { setCartState(next); if (store?.id) setCart(store.id, next) }

  const handleUpdateQty = (itemId, delta) => {
    const next = cartUpdateQty(store.id, itemId, delta)
    setCartState(next)
  }

  const handleRemove = (itemId) => {
    const next = removeFromCart(store.id, itemId)
    setCartState(next)
  }

  const validateStep1 = () => {
    if (!name.trim()) { toast.error('Please enter your full name'); return false }
    const pe = validatePhone(phone)
    if (pe) { setPhoneError(pe); return false }
    if (!address.trim()) { toast.error('Please enter your delivery address'); return false }
    if (!district) { toast.error('Please select your district'); return false }
    return true
  }

  const validateStep2 = () => {
    if (!payMethod) { toast.error('Please select a payment method'); return false }
    if (['bkash','nagad','rocket'].includes(payMethod) && !transactionId.trim()) {
      toast.error('Please enter your Transaction ID'); return false
    }
    return true
  }

  const next = async () => {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    // SRS C3: validate stock/price before review step
    if (step === 2) {
      const ok = await validateCart()
      if (!ok) {
        toast.error('Some items in your cart have changed. Please review before continuing.')
        return
      }
    }
    setStep(s => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const placeOrder = async () => {
    if (!store) return
    // Final stock check before placing
    const ok = await validateCart()
    if (!ok) { toast.error('Cart changed — please review and try again'); return }

    setPlacing(true)
    const oid = generateOrderId()
    const digits = phone.replace(/\D/g,'')

    const { data, error } = await supabase.from('orders').insert({
      order_id: oid,
      store_id: store.id,
      customer_name: name.trim(),
      customer_phone: digits,
      customer_email: email.trim() || null,   // SRS C3: optional email
      delivery_address: address.trim(),
      delivery_area: area.trim() || null,
      district,
      delivery_note: note.trim() || null,
      payment_method: payMethod,
      transaction_id: transactionId.trim() || null,
      payment_status: payMethod === 'cod' ? 'pending' : 'pending_verification',
      status: 'pending',
      subtotal: total,
      delivery_charge: 0,
      total,
      items: cart.map(i => ({
        product_id: i.id, title: i.title, price: i.price,
        qty: i.qty, image: i.image || null, category: i.category || null,
      })),
    }).select('id').single()

    if (error) {
      toast.error(error.message || 'Failed to place order. Please try again.')
      setPlacing(false)
      return
    }

    // Timeline entry
    await supabase.from('order_timeline').insert({
      order_id: data.id, status: 'pending', note: 'Order placed by customer',
    }).catch(() => {})

    // Decrement stock — SRS C4 real-time stock update
    for (const item of cart) {
      await supabase.from('products')
        .update({ stock: item.stock != null ? Math.max(0, item.stock - item.qty) : 0 })
        .eq('id', item.id).catch(() => {})
    }

    setSavedName(name)
    setSavedPhone(phone)
    setSavedTotal(total)
    setSavedPayMethod(payMethod)
    clearCart(store.id)
    setCartState([])
    setOrderId(oid)
    setPlacing(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── LOADING ──
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )

  // ── STORE NOT FOUND ──
  if (!store) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center p-8 bg-gradient-to-br from-slate-50 to-indigo-50">
      <AlertCircle className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Store not found</h2>
      <p className="text-sm text-muted-foreground">This checkout link is invalid or the store no longer exists.</p>
    </div>
  )

  // ── EMPTY CART (and not yet ordered) ──
  if (cart.length === 0 && !orderId) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center p-8 bg-gradient-to-br from-slate-50 to-indigo-50">
      <ShoppingBag className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Your cart is empty</h2>
      <p className="text-sm text-muted-foreground">Add products to your cart before checking out.</p>
      <Link to="/shop">
        <Button className="mt-2 text-white" style={{ background: brandColor }}>Browse products</Button>
      </Link>
    </div>
  )

  // ── ORDER SUCCESS ──
  if (orderId) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-green-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
          className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-100 shadow-lg">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6 text-center">
          <h1 className="text-3xl font-bold">Order Placed! 🎉</h1>
          <p className="mt-2 text-muted-foreground">Thank you, <strong>{savedName}</strong>! Your order has been received.</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="mt-6 rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Order ID</p>
              <p className="mt-0.5 font-mono text-lg font-bold">{orderId}</p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Pending</span>
          </div>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Total</span><span className="font-bold text-foreground">{symbol} {savedTotal.toLocaleString()}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Payment</span><span className="capitalize font-medium">{savedPayMethod === 'cod' ? 'Cash on Delivery' : savedPayMethod}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Phone</span><span>+880 {savedPhone}</span></div>
          </div>
          <div className="mt-4 space-y-2">
            {/* SRS C3: SMS confirmation notice */}
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
              📱 An SMS confirmation with your Order ID and tracking link will be sent to your phone shortly.
            </div>
            {/* SRS C3: Payment pending notice for mobile banking */}
            {['bkash','nagad','rocket'].includes(savedPayMethod) && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
                ⏳ Your order is <strong>Pending Payment Verification</strong>. The merchant will confirm after verifying your transaction.
              </div>
            )}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="mt-4 flex flex-col gap-2">
          <Link to={`/track?store=${storeSubdomain}&order=${orderId}&phone=${savedPhone.replace(/\D/g,'')}`}>
            <Button className="w-full text-white font-semibold" style={{ background: brandColor }}>Track my order</Button>
          </Link>
          <Link to="/shop">
            <Button variant="outline" className="w-full">Continue shopping</Button>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )

  // ── CHECKOUT FLOW ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/shop" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <img src={store.logo_url || '/logo.png'} alt={store.shop_name} className="h-7 w-7 rounded-lg object-contain" />
            <span className="hidden font-semibold text-sm sm:block">{store.shop_name}</span>
          </div>
          <p className="text-sm text-muted-foreground">{count} item{count !== 1 ? 's' : ''}</p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 lg:py-10">
        {/* Step indicators */}
        <div className="mb-8 flex items-center justify-center gap-0">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <button type="button"
                disabled={s.id >= step}
                onClick={() => s.id < step && setStep(s.id)}
                className={s.id < step ? 'cursor-pointer' : 'cursor-default'}>
                <div className={`flex items-center gap-2`}>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${
                    s.id < step ? 'bg-green-500 text-white'
                    : s.id === step ? 'text-white shadow-lg' : 'bg-muted text-muted-foreground'
                  }`} style={s.id === step ? { background: brandColor } : {}}>
                    {s.id < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                  </div>
                  <span className={`hidden text-sm font-medium sm:inline ${
                    s.id === step ? 'text-foreground' : s.id < step ? 'text-green-700' : 'text-muted-foreground'
                  }`}>{s.label}</span>
                </div>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`mx-3 h-px w-8 sm:w-16 transition-colors ${s.id < step ? 'bg-green-400' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        {/* SRS C2: Cart issues banner */}
        <AnimatePresence>
          {cartIssues.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Your cart has been updated</p>
                  <ul className="mt-1 space-y-1">
                    {cartIssues.map((issue, i) => (
                      <li key={i} className="text-xs text-amber-700">
                        {issue.type === 'outofstock' && `❌ "${issue.title}" is now out of stock — removed from cart`}
                        {issue.type === 'unavailable' && `❌ "${issue.title}" is no longer available — removed from cart`}
                        {issue.type === 'pricechange' && `💰 "${issue.title}" price changed: ${symbol} ${issue.oldPrice} → ${symbol} ${issue.newPrice}`}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => setCartIssues([])} className="mt-2 text-xs font-medium text-amber-800 hover:underline flex items-center gap-1">
                    <X className="h-3 w-3" /> Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
              className="rounded-2xl border border-border bg-white p-6 shadow-sm">

              {/* ──────────── STEP 1 — DELIVERY ──────────── */}
              {step === 1 && (
                <>
                  <h2 className="mb-5 flex items-center gap-2 text-xl font-bold">
                    <MapPin className="h-5 w-5" style={{ color: brandColor }} /> Delivery Information
                  </h2>
                  <div className="space-y-4">
                    <Field label="Full name" required>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input autoFocus autoComplete="off" className="pl-9" placeholder="Your full name"
                          value={name} onChange={e => setName(e.target.value)} />
                      </div>
                    </Field>
                    <Field label="Phone number" required hint="Receives SMS confirmation">
                      <div className={`flex overflow-hidden rounded-lg border bg-white transition-all focus-within:ring-2 ${
                        phoneError ? 'border-destructive focus-within:ring-destructive/30' : 'border-border focus-within:ring-ring'
                      }`}>
                        <div className="flex shrink-0 items-center gap-1.5 border-r border-border bg-muted px-3 text-sm font-medium">
                          <span>🇧🇩</span><span className="text-muted-foreground">+880</span>
                        </div>
                        <Input type="tel" inputMode="numeric" autoComplete="off" placeholder="01XXXXXXXXX"
                          value={phone}
                          onChange={e => { setPhone(e.target.value.replace(/\D/g,'').slice(0,11)); setPhoneError('') }}
                          className="border-0 focus-visible:ring-0" />
                      </div>
                      {phoneError && <p className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />{phoneError}</p>}
                    </Field>
                    {/* SRS C3: Optional email for confirmation */}
                    <Field label="Email" hint="Optional — for order confirmation email">
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input type="email" autoComplete="off" className="pl-9" placeholder="you@example.com"
                          value={email} onChange={e => setEmail(e.target.value)} />
                      </div>
                    </Field>
                    <Field label="Full delivery address" required>
                      <div className="relative">
                        <Home className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Textarea autoComplete="off" className="pl-9 min-h-[80px] resize-none"
                          placeholder="House no, road no, area / moholla" rows={3}
                          value={address} onChange={e => setAddress(e.target.value)} />
                      </div>
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="District" required>
                        <div className="relative">
                          <select value={district} onChange={e => setDistrict(e.target.value)}
                            className="h-10 w-full appearance-none rounded-lg border border-border bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                            <option value="">Select district</option>
                            {BD_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                          <ChevronRight className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-muted-foreground" />
                        </div>
                      </Field>
                      <Field label="Area / Thana" hint="Optional">
                        <Input autoComplete="off" placeholder="e.g. Gulshan, Dhanmondi"
                          value={area} onChange={e => setArea(e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Delivery note" hint="Optional">
                      <Input autoComplete="off" placeholder="Special instructions for delivery"
                        value={note} onChange={e => setNote(e.target.value)} />
                    </Field>
                  </div>
                </>
              )}

              {/* ──────────── STEP 2 — PAYMENT ──────────── */}
              {step === 2 && (
                <>
                  <h2 className="mb-5 flex items-center gap-2 text-xl font-bold">
                    <CreditCard className="h-5 w-5" style={{ color: brandColor }} /> Payment Method
                  </h2>
                  <div className="space-y-3">
                    {PAY_METHODS.map(m => (
                      <button key={m.id} type="button" onClick={() => setPayMethod(m.id)}
                        className={`w-full rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                          payMethod === m.id ? 'shadow-md' : 'border-border hover:border-primary/40'
                        }`}
                        style={payMethod === m.id ? { borderColor: brandColor, background: brandColor + '08' } : {}}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl"
                            style={{ background: m.color + '18' }}>{m.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{m.label}</p>
                            <p className="text-xs text-muted-foreground">{m.desc}</p>
                          </div>
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all"
                            style={payMethod === m.id ? { borderColor: brandColor, background: brandColor } : { borderColor: '#d1d5db' }}>
                            {payMethod === m.id && <Check className="h-3 w-3 text-white" />}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <AnimatePresence>
                    {['bkash','nagad','rocket'].includes(payMethod) && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
                          <p className="mb-2 text-sm font-semibold">How to pay with {PAY_METHODS.find(m => m.id === payMethod)?.label}:</p>
                          <ol className="mb-4 space-y-1 text-sm text-muted-foreground list-decimal pl-4">
                            <li>Open your {PAY_METHODS.find(m => m.id === payMethod)?.label} app</li>
                            <li>Go to <strong>Send Money</strong></li>
                            <li>Send <strong className="text-foreground">{symbol} {total.toLocaleString()}</strong> to the merchant's number</li>
                            <li>Copy the <strong>Transaction ID</strong> from your confirmation SMS</li>
                          </ol>
                          <Field label="Transaction ID" required>
                            <Input autoFocus autoComplete="off" value={transactionId}
                              onChange={e => setTransactionId(e.target.value)}
                              placeholder={payMethod === 'bkash' ? 'e.g. 8N6XY23F1A' : 'e.g. TXN1234567890'}
                              className="font-mono" />
                            <p className="mt-1 text-xs text-muted-foreground">
                              Order status will be <strong>Pending Verification</strong> until the merchant confirms.
                            </p>
                          </Field>
                        </div>
                      </motion.div>
                    )}
                    {payMethod === 'cod' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                          💵 Pay <strong>{symbol} {total.toLocaleString()}</strong> in cash when your order arrives. No payment needed now.
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

              {/* ──────────── STEP 3 — REVIEW ──────────── */}
              {step === 3 && (
                <>
                  <h2 className="mb-5 flex items-center gap-2 text-xl font-bold">
                    <ClipboardList className="h-5 w-5" style={{ color: brandColor }} /> Review Your Order
                  </h2>

                  {validating && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" /> Verifying stock & prices…
                    </div>
                  )}

                  <SummaryBlock title="Delivery" onEdit={() => setStep(1)}>
                    <SummaryRow icon={User}><span className="font-medium">{name}</span></SummaryRow>
                    <SummaryRow icon={Phone}>+880 {phone}</SummaryRow>
                    {email && <SummaryRow icon={Mail}>{email}</SummaryRow>}
                    <SummaryRow icon={MapPin}>{address}{area ? `, ${area}` : ''}, {district}</SummaryRow>
                    {note && <SummaryRow icon={Package}>{note}</SummaryRow>}
                  </SummaryBlock>

                  <SummaryBlock title="Payment" onEdit={() => setStep(2)}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-base">{PAY_METHODS.find(m => m.id === payMethod)?.emoji}</span>
                      <span className="font-medium">{PAY_METHODS.find(m => m.id === payMethod)?.label}</span>
                      {transactionId && <span className="ml-1 rounded bg-muted px-2 py-0.5 font-mono text-xs">{transactionId}</span>}
                    </div>
                  </SummaryBlock>

                  {/* Items — editable in review */}
                  <div className="mb-4 overflow-hidden rounded-xl border border-border">
                    <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
                      <h3 className="text-sm font-semibold">Items ({count})</h3>
                      <button onClick={() => setStep(1)} className="text-xs text-primary hover:underline">Edit delivery</button>
                    </div>
                    <div className="divide-y divide-border">
                      {cart.map(item => (
                        <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {item.image ? <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                              : <div className="flex h-full w-full items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{symbol} {item.price.toLocaleString()} each</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button onClick={() => handleUpdateQty(item.id, -1)}
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background transition hover:bg-muted">
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="min-w-[1.5rem] text-center text-sm font-semibold">{item.qty}</span>
                            <button onClick={() => handleUpdateQty(item.id, 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background transition hover:bg-muted">
                              <Plus className="h-3 w-3" />
                            </button>
                            <button onClick={() => handleRemove(item.id)}
                              className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="shrink-0 w-16 text-right text-sm font-bold">{symbol} {(item.price * item.qty).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{symbol} {total.toLocaleString()}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Delivery</span><span className="text-green-600 font-medium">Free</span></div>
                      <div className="flex justify-between border-t border-border pt-2 font-bold text-base">
                        <span>Total</span><span style={{ color: brandColor }}>{symbol} {total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* SRS C3: Return & Shipping policy links */}
                  <p className="text-xs text-muted-foreground">
                    By placing your order you agree to the merchant's{' '}
                    <a href="#" className="text-primary hover:underline">Return Policy</a> and{' '}
                    <a href="#" className="text-primary hover:underline">Shipping Policy</a>.
                  </p>
                </>
              )}

              {/* Navigation */}
              <div className="mt-6 flex items-center justify-between gap-3">
                {step > 1 ? (
                  <Button variant="outline" className="gap-2"
                    onClick={() => { setStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                ) : <div />}

                {step < 3 ? (
                  <Button onClick={next} disabled={validating} className="gap-2 px-8 text-white font-semibold"
                    style={{ background: brandColor }}>
                    {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Continue <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={placeOrder} disabled={placing || validating || cart.length === 0}
                    className="gap-2 px-8 text-white font-semibold h-11" style={{ background: brandColor }}>
                    {placing || validating
                      ? <><Loader2 className="h-4 w-4 animate-spin" />{placing ? 'Placing…' : 'Verifying…'}</>
                      : <><Check className="h-4 w-4" />Place Order</>}
                  </Button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* ── ORDER SUMMARY SIDEBAR ── */}
          <div className="h-fit rounded-2xl border border-border bg-white p-5 shadow-sm lg:sticky lg:top-20">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
              <img src={store.logo_url || '/logo.png'} alt={store.shop_name} className="h-8 w-8 rounded-lg object-contain" />
              <span className="font-bold">{store.shop_name}</span>
            </div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order Summary</p>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-2.5">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.image ? <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                      : <div className="flex h-full w-full items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>}
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-[10px] font-bold text-white">{item.qty}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm">{item.title}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{symbol} {(item.price * item.qty).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({count})</span><span>{symbol} {total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery</span><span className="font-medium text-green-600">Free</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span>Total</span><span style={{ color: brandColor }}>{symbol} {total.toLocaleString()}</span>
              </div>
            </div>
            <div className="mt-4 space-y-1.5 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-600" />Secure checkout</div>
              <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-600" />SMS order confirmation</div>
              <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-600" />Real-time order tracking</div>
              <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-green-600" />Free cancellation</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, hint, children }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function SummaryBlock({ title, onEdit, children }) {
  return (
    <div className="mb-3 rounded-xl border border-border bg-muted/20 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button onClick={onEdit} className="text-xs text-primary hover:underline">Edit</button>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function SummaryRow({ icon: Icon, children }) {
  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{children}</span>
    </div>
  )
}
