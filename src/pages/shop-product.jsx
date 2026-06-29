import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, Minus, Package, Plus, ShieldCheck, ShoppingCart, Star, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { addToCart, getCartTotals } from '@/lib/cart'
import { getThemeCssVars } from '@/lib/theme-system'
import { trackStoreEvent } from '@/lib/analytics-tracker'

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function money(value, currency = 'BDT') {
  return `${currency} ${toNumber(value).toLocaleString('en-BD')}`
}

function getImage(product) {
  if (Array.isArray(product?.images) && product.images.length > 0) return product.images[0]
  if (product?.image_url) return product.image_url
  return null
}

function getImages(product) {
  const images = Array.isArray(product?.images) ? product.images.filter(Boolean) : []
  const image = getImage(product)
  return images.length ? images : image ? [image] : []
}

function parseArrayValue(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return []
}

function getVariantId(variant) {
  if (!variant) return null
  return variant.id || variant.combo || variant.label || (variant.options ? JSON.stringify(variant.options) : null)
}

function getVariantLabel(variant) {
  if (!variant) return null
  if (variant.combo) return variant.combo
  if (variant.label) return variant.label
  if (variant.options) return Object.entries(variant.options).map(([key, value]) => `${key}: ${value}`).join(', ')
  return getVariantId(variant)
}

function normalizeVariants(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : parseArrayValue(product?.variants)
  return variants
    .filter((variant) => variant && typeof variant === 'object')
    .map((variant, index) => ({
      ...variant,
      id: getVariantId(variant) || `variant-${index}`,
      label: getVariantLabel(variant) || `Variant ${index + 1}`,
      price: variant.price === '' || variant.price == null ? product.price : variant.price,
      stock: toNumber(variant.stock, 0),
    }))
}

function getDiscount(product) {
  const price = toNumber(product?.price, 0)
  const compareAt = toNumber(product?.compare_at_price, 0)
  if (!price || compareAt <= price) return 0
  return Math.round((1 - price / compareAt) * 100)
}


function getProductDeliveryLabel(product, store) {
  const mode = product?.delivery_charge_mode || 'store_default'
  if (mode === 'free') return 'Free delivery for this product'
  if (mode === 'custom') {
    const dhaka = toNumber(product?.delivery_charge_dhaka, 0)
    const outside = toNumber(product?.delivery_charge_outside_dhaka, 0)
    return `Delivery: Dhaka ${money(dhaka, store?.currency || 'BDT')} · Outside ${money(outside, store?.currency || 'BDT')}`
  }
  const dhaka = toNumber(store?.delivery_charge_dhaka, 60)
  const outside = toNumber(store?.delivery_charge_outside_dhaka, 120)
  return `Delivery: Dhaka ${money(dhaka, store?.currency || 'BDT')} · Outside ${money(outside, store?.currency || 'BDT')}`
}

function ProductSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl animate-pulse space-y-6">
        <div className="h-12 rounded-2xl bg-white" />
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="aspect-square rounded-[2rem] bg-white" />
          <div className="h-[520px] rounded-[2rem] bg-white" />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ title, message }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8 text-center">
      <Package className="h-12 w-12 text-slate-300" />
      <h1 className="mt-4 text-2xl font-black text-slate-950">{title}</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{message}</p>
      <Link to="/" className="mt-6 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">Go home</Link>
    </div>
  )
}

export default function ShopProductPage() {
  const navigate = useNavigate()
  const params = useParams({ strict: false })
  const storeSlug = params?.storeSlug
  const productId = params?.productId
  const [status, setStatus] = useState('loading')
  const [store, setStore] = useState(null)
  const [product, setProduct] = useState(null)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [qty, setQty] = useState(1)
  const [message, setMessage] = useState('')
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    let mounted = true
    async function loadProduct() {
      setStatus('loading')
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .eq('subdomain', storeSlug)
        .maybeSingle()
      if (!mounted) return
      if (storeError || !storeData || storeData.account_status !== 'active' || !storeData.storefront_published) {
        setStatus('not-found')
        return
      }
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeData.id)
        .eq('status', 'published')
        .or(`id.eq.${productId},slug.eq.${productId}`)
        .maybeSingle()
      if (!mounted) return
      if (productError || !productData) {
        setStatus('not-found')
        return
      }
      setStore(storeData)
      setProduct(productData)
      setStatus('ok')
      const variants = normalizeVariants(productData)
      if (variants.length) setSelectedVariantId(variants.find(v => v.stock > 0)?.id || variants[0].id)
      trackStoreEvent({ storeSlug, storeId: storeData.id, eventType: 'product_view', productId: productData.id, metadata: { title: productData.title } })
    }
    loadProduct()
    return () => { mounted = false }
  }, [storeSlug, productId])

  useEffect(() => {
    if (!store?.id) return
    setCartCount(getCartTotals(store.id).itemCount)
  }, [store?.id])

  const variants = useMemo(() => product ? normalizeVariants(product) : [], [product])
  const selectedVariant = variants.find(item => item.id === selectedVariantId) || null
  const images = getImages(product)
  const currency = store?.currency || 'BDT'
  const price = toNumber(selectedVariant?.price ?? product?.price, 0)
  const stock = toNumber(selectedVariant?.stock ?? product?.stock, 0)
  const lowStock = stock > 0 && stock <= 5
  const outOfStock = stock <= 0
  const discount = getDiscount(product)
  const vars = getThemeCssVars(store)
  const deliveryLabel = getProductDeliveryLabel(product, store)

  function addSelectedToCart() {
    if (!store?.id || !product) return
    setMessage('')
    if (outOfStock) {
      setMessage('This product is out of stock.')
      return
    }
    const cartProduct = {
      ...product,
      images,
      price,
    }
    const result = addToCart(store.id, cartProduct, selectedVariant, qty)
    if (!result.success) {
      setMessage(result.message)
      return
    }
    setCartCount(getCartTotals(store.id).itemCount)
    setMessage('Added to cart successfully.')
    trackStoreEvent({ storeSlug, storeId: store.id, eventType: 'add_to_cart', productId: product.id, metadata: { qty, variant: selectedVariant?.label } })
  }

  if (status === 'loading') return <ProductSkeleton />
  if (status !== 'ok') return <EmptyState title="Product not found" message="This product is unavailable, unpublished, or the shop is offline." />

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950" style={vars}>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/shop/$storeSlug" params={{ storeSlug }} className="inline-flex items-center gap-3 font-black">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--shop-primary)] text-white"><ShoppingCart className="h-5 w-5" /></span>
            <span>{store.shop_name}</span>
          </Link>
          <Button variant="outline" className="rounded-full" onClick={() => navigate({ to: '/checkout', search: { store: storeSlug } })}>
            Cart ({cartCount})
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <button onClick={() => navigate({ to: '/shop/$storeSlug', params: { storeSlug } })} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[var(--shop-primary)]">
          <ArrowLeft className="h-4 w-4" /> Back to shop
        </button>

        <section className="grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
              {images[selectedImage] ? (
                <img src={images[selectedImage]} alt={product.title} className="aspect-square w-full object-contain p-6" />
              ) : (
                <div className="flex aspect-square items-center justify-center text-slate-300"><Package className="h-20 w-20" /></div>
              )}
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-5 gap-3">
                {images.slice(0, 5).map((image, index) => (
                  <button key={image} onClick={() => setSelectedImage(index)} className={`overflow-hidden rounded-2xl border bg-white p-1 transition ${selectedImage === index ? 'border-[var(--shop-primary)] ring-2 ring-[var(--shop-primary)]/20' : 'border-slate-200 hover:border-[var(--shop-primary)]'}`}>
                    <img src={image} alt="" className="aspect-square w-full rounded-xl object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{product.category || 'General'}</span>
              {discount > 0 && <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-black text-white">-{discount}%</span>}
              <div className="ml-auto flex items-center gap-1 text-amber-400">{[0,1,2,3,4].map(i => <Star key={i} className="h-4 w-4 fill-current" />)}<span className="ml-1 text-xs font-bold text-slate-500">4.8</span></div>
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">{product.title}</h1>
            <div className="mt-4 flex items-end gap-3">
              <p className="text-3xl font-black text-[var(--shop-primary)]">{money(price, currency)}</p>
              {toNumber(product.compare_at_price, 0) > price && <p className="pb-1 text-sm font-semibold text-slate-400 line-through">{money(product.compare_at_price, currency)}</p>}
            </div>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600">
              <Truck className="h-4 w-4 text-[var(--shop-primary)]" /> {deliveryLabel}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
              {product.description || 'No description added yet.'}
            </div>

            {variants.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 text-sm font-bold">Choose option</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {variants.map(variant => (
                    <button key={variant.id} onClick={() => { setSelectedVariantId(variant.id); setQty(1) }} disabled={variant.stock <= 0} className={`rounded-2xl border p-3 text-left text-sm transition ${selectedVariantId === variant.id ? 'border-[var(--shop-primary)] bg-[var(--shop-primary)]/5' : 'border-slate-200 hover:border-[var(--shop-primary)]'} ${variant.stock <= 0 ? 'cursor-not-allowed opacity-50' : ''}`}>
                      <span className="font-bold">{variant.label}</span>
                      <span className="mt-1 block text-xs text-slate-500">{variant.stock <= 0 ? 'Out of stock' : `${variant.stock} available`}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-1">
                <button className="rounded-xl p-2 hover:bg-slate-100" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="h-4 w-4" /></button>
                <span className="w-12 text-center text-sm font-black">{qty}</span>
                <button className="rounded-xl p-2 hover:bg-slate-100" onClick={() => setQty(Math.min(stock || 1, qty + 1))}><Plus className="h-4 w-4" /></button>
              </div>
              <Button className="h-12 flex-1 rounded-2xl bg-[var(--shop-primary)] text-white hover:opacity-90" disabled={outOfStock} onClick={addSelectedToCart}>
                <ShoppingCart className="mr-2 h-4 w-4" /> {outOfStock ? 'Out of stock' : 'Add to cart'}
              </Button>
            </div>

            <p className={`mt-3 text-sm font-semibold ${outOfStock ? 'text-rose-600' : lowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
              {outOfStock ? 'Out of stock' : lowStock ? `Only ${stock} left in stock` : 'In stock'}
            </p>
            {message && <p className="mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p>}

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[['Secure checkout', ShieldCheck], ['Fast delivery', Truck], ['Verified order', CheckCircle2]].map(([label, Icon]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs font-bold text-slate-600">
                  <Icon className="mx-auto mb-2 h-5 w-5 text-[var(--shop-primary)]" /> {label}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
