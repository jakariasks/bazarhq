import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, ChevronRight, MessageSquare, Minus, Package, Plus, Scale, ShieldCheck, ShoppingCart, Star, Store, Tag, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { addToCart, getCartTotals } from '@/lib/cart'
import { getTheme, themeCssVars } from '@/lib/preview-themes'
import { trackStoreEvent } from '@/lib/analytics-tracker'
import { useCustomerAuth } from '@/hooks/use-customer-auth'
import ProductImageGallery from '@/components/product-image-gallery'
import MarketplaceProductCard from '@/components/marketplace-product-card'
import { fetchMarketplaceProductRecommendations } from '@/lib/marketplace-api'

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

function normalizeTagList(value) {
  return parseArrayValue(value)
    .map((item) => typeof item === 'string' ? item.trim() : String(item?.name || item?.label || '').trim())
    .filter(Boolean)
}

function buildReviewStats(rows) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const row of rows) {
    const rating = Math.min(5, Math.max(1, Number(row?.rating || 0)))
    if (distribution[rating] != null) distribution[rating] += 1
  }
  const count = rows.length
  const avg = count ? rows.reduce((sum, row) => sum + Number(row.rating || 0), 0) / count : 0
  return { avg, count, distribution }
}

function RelatedProductCard({ storeSlug, product, primary, currency = 'BDT' }) {
  const routeProductId = String(product.slug || product.id)
  const image = getImage(product)
  const price = toNumber(product.price, 0)
  const compareAt = toNumber(product.compare_at_price, 0)
  const discount = getDiscount(product)
  return (
    <Link
      to="/shop/$storeSlug/product/$productId"
      params={{ storeSlug, productId: routeProductId }}
      className="group overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[var(--shop-primary)]/20 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-50">
        {image ? (
          <img src={image} alt={getProductTitle(product)} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300"><Package className="h-10 w-10" /></div>
        )}
        {discount > 0 && <span className="absolute left-3 top-3 rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-black text-white">-{discount}%</span>}
      </div>
      <div className="space-y-2 p-4">
        <p className="line-clamp-2 min-h-[2.6rem] text-sm font-black leading-snug text-slate-900 group-hover:text-[var(--shop-primary)]">{getProductTitle(product)}</p>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-base font-black text-[var(--shop-primary)]">{money(price, currency)}</p>
            {compareAt > price && <p className="text-xs font-semibold text-slate-400 line-through">{money(compareAt, currency)}</p>}
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">View <ChevronRight className="h-3.5 w-3.5" /></span>
        </div>
      </div>
    </Link>
  )
}


function slugifyProductText(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getProductTitle(product) {
  return product?.title || product?.name || product?.product_name || 'Product'
}

function productMatchesRoute(product, routeValue) {
  const value = String(routeValue || '').trim().toLowerCase()
  if (!value || !product) return false

  const id = String(product.id || '').toLowerCase()
  const slug = String(product.slug || '').toLowerCase()
  const sku = String(product.sku || '').toLowerCase()
  const titleSlug = slugifyProductText(getProductTitle(product))
  const idPrefix = id ? id.slice(0, 4) : ''
  const generatedSlug = idPrefix ? `${titleSlug}-${idPrefix}` : titleSlug

  return (
    value === id ||
    value === slug ||
    value === sku ||
    value === titleSlug ||
    value === generatedSlug ||
    Boolean(titleSlug && value.startsWith(`${titleSlug}-`))
  )
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
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [qty, setQty] = useState(1)
  const [message, setMessage] = useState('')
  const [cartCount, setCartCount] = useState(0)
  const { customer, isLoggedIn } = useCustomerAuth()
  const [reviews, setReviews] = useState([])
  const [reviewStats, setReviewStats] = useState({ avg: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } })
  const [relatedProducts, setRelatedProducts] = useState([])
  const [canReview, setCanReview] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewMessage, setReviewMessage] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  const recommendationQuery = useQuery({
    queryKey: ['marketplace-product-recommendations', product?.id],
    queryFn: () => fetchMarketplaceProductRecommendations(product.id, 12),
    enabled: Boolean(product?.id),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  })

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
      // Product links in older storefront builds could be real IDs, saved slugs,
      // or generated URL slugs like "computer-262q". Querying only id/slug makes
      // those generated URLs fail. So we load the store's published products and
      // resolve the route value safely on the client side.
      const { data: productRows, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeData.id)
        .eq('status', 'published')

      if (!mounted) return

      if (productError) {
        console.warn('[shop-product] product lookup failed:', productError.message)
        setStatus('not-found')
        return
      }

      const productData = (productRows || []).find((row) => productMatchesRoute(row, productId))

      if (!productData) {
        setStatus('not-found')
        return
      }

      const related = (productRows || [])
        .filter((row) => row.id !== productData.id)
        .sort((a, b) => {
          const sameCategoryA = String(a.category || '').toLowerCase() === String(productData.category || '').toLowerCase() ? 1 : 0
          const sameCategoryB = String(b.category || '').toLowerCase() === String(productData.category || '').toLowerCase() ? 1 : 0
          const featuredA = a.is_featured ? 1 : 0
          const featuredB = b.is_featured ? 1 : 0
          return (sameCategoryB - sameCategoryA) || (featuredB - featuredA) || (toNumber(b.created_at ? new Date(b.created_at).getTime() : 0) - toNumber(a.created_at ? new Date(a.created_at).getTime() : 0))
        })
        .slice(0, 8)

      setStore(storeData)
      setProduct(productData)
      setRelatedProducts(related)
      setStatus('ok')
      const variants = normalizeVariants(productData)
      if (variants.length) setSelectedVariantId(variants.find(v => v.stock > 0)?.id || variants[0].id)
      trackStoreEvent({ storeSlug, storeId: storeData.id, eventType: 'product_view', productId: productData.id, metadata: { title: getProductTitle(productData) } })
    }
    loadProduct()
    return () => { mounted = false }
  }, [storeSlug, productId])

  useEffect(() => {
    if (!store?.id) return
    setCartCount(getCartTotals(store.id).itemCount)
  }, [store?.id])

  useEffect(() => {
    if (!product?.id) return
    let mounted = true
    async function loadReviews() {
      const { data } = await supabase
        .from('product_reviews')
        .select('id, rating, comment, customer_name, created_at')
        .eq('product_id', product.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
      if (!mounted) return
      const rows = data || []
      setReviews(rows)
      setReviewStats(buildReviewStats(rows))
    }
    loadReviews()
    return () => { mounted = false }
  }, [product?.id])

  useEffect(() => {
    if (!isLoggedIn || !store?.id || !product?.id) {
      setCanReview(false)
      return
    }
    supabase.rpc('customer_can_review_product', { p_store_id: store.id, p_product_id: product.id })
      .then(({ data }) => setCanReview(Boolean(data)))
  }, [isLoggedIn, store?.id, product?.id])

  async function submitReview() {
    setReviewMessage('')
    if (!isLoggedIn || !customer) {
      setReviewMessage('Please login as a customer to write a review.')
      return
    }
    if (!canReview) {
      setReviewMessage('Only verified customers who ordered this product can review it.')
      return
    }
    const comment = reviewComment.trim()
    if (comment.length < 5) {
      setReviewMessage('Write a short review before submitting.')
      return
    }
    setSubmittingReview(true)
    const { error } = await supabase.rpc('submit_product_review', {
      p_store_id: store.id,
      p_product_id: product.id,
      p_rating: Number(reviewRating),
      p_comment: comment,
    })
    setSubmittingReview(false)
    if (error) {
      setReviewMessage(error.message || 'Review could not be submitted.')
      return
    }
    setReviewMessage('Thanks! Your review has been submitted.')
    setReviewComment('')
    const { data } = await supabase
      .from('product_reviews')
      .select('id, rating, comment, customer_name, created_at')
      .eq('product_id', product.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
    const rows = data || []
    setReviews(rows)
    setReviewStats(buildReviewStats(rows))
  }


  const variants = useMemo(() => product ? normalizeVariants(product) : [], [product])
  const selectedVariant = variants.find(item => item.id === selectedVariantId) || null
  const images = getImages(product)
  const currency = store?.currency || 'BDT'
  const price = toNumber(selectedVariant?.price ?? product?.price, 0)
  const stock = toNumber(selectedVariant?.stock ?? product?.stock, 0)
  const lowStock = stock > 0 && stock <= 5
  const outOfStock = stock <= 0
  const discount = getDiscount(product)
  const tagList = normalizeTagList(product?.tags)
  const theme = getTheme(store?.theme_id)
  const primary = store?.brand_color || theme.swatch || '#4f46e5'
  const vars = { ...themeCssVars(theme), '--shop-primary': primary }

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
          <ProductImageGallery
            images={images}
            fallbackImage={product.image_url}
            alt={getProductTitle(product)}
          />

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{product.category || 'General'}</span>
              {discount > 0 && <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-black text-white">-{discount}%</span>}
              <div className="ml-auto flex items-center gap-1 text-amber-400">{[0,1,2,3,4].map(i => <Star key={i} className={`h-4 w-4 ${i < Math.round(reviewStats.avg || 0) ? 'fill-current' : ''}`} />)}<span className="ml-1 text-xs font-bold text-slate-500">{reviewStats.count ? reviewStats.avg.toFixed(1) : 'New'}</span></div>
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">{getProductTitle(product)}</h1>
            <div className="mt-4 flex items-end gap-3">
              <p className="text-3xl font-black text-[var(--shop-primary)]">{money(price, currency)}</p>
              {toNumber(product.compare_at_price, 0) > price && <p className="pb-1 text-sm font-semibold text-slate-400 line-through">{money(product.compare_at_price, currency)}</p>}
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

            <div className="mt-8 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-[var(--shop-primary)]" />
                <h3 className="text-sm font-black text-slate-950">More product information</h3>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Category</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">{product.category || 'General'}</p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">SKU</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">{product.sku || 'Not provided'}</p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Availability</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">{outOfStock ? 'Out of stock' : `${stock} available now`}</p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Store</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">{store.shop_name}</p>
                </div>
              </div>
              {tagList.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Tags</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tagList.slice(0, 10).map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {relatedProducts.length > 0 && (
          <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-indigo-700">
                  <Store className="h-3.5 w-3.5" /> More from this shop
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-tight">Related products from {store.shop_name}</h2>
                <p className="mt-2 text-sm text-slate-500">Explore more products from the same seller before you checkout.</p>
              </div>
              <Link to="/shop/$storeSlug" params={{ storeSlug }} className="inline-flex items-center gap-2 text-sm font-black text-[var(--shop-primary)]">Visit store <ChevronRight className="h-4 w-4" /></Link>
            </div>
            <div className="mt-6 grid gap-5 grid-cols-2 lg:grid-cols-4">
              {relatedProducts.slice(0, 8).map((item) => (
                <RelatedProductCard key={`store-related-${item.id}`} storeSlug={storeSlug} product={item} primary={primary} currency={currency} />
              ))}
            </div>
          </section>
        )}

        {(recommendationQuery.data?.same_product?.length > 0 || recommendationQuery.data?.recommended?.length > 0) && (
          <section className="mt-8 space-y-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
            {recommendationQuery.data?.same_product?.length > 0 && (
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-indigo-700">
                      <Scale className="h-3.5 w-3.5" /> Cross-shop price comparison
                    </p>
                    <h2 className="mt-3 text-2xl font-black tracking-tight">Same product from other shops</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Compared across {recommendationQuery.data.comparison?.shop_count || recommendationQuery.data.same_product.length + 1} shops.
                      {Number(recommendationQuery.data.comparison?.saving || 0) > 0
                        ? ` Potential saving: ${money(recommendationQuery.data.comparison.saving, currency)}.`
                        : ' Prices are currently close.'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-right">
                    <p className="text-xs font-bold text-emerald-700">Best marketplace price</p>
                    <p className="mt-1 text-xl font-black text-emerald-700">{money(recommendationQuery.data.comparison?.best_price, currency)}</p>
                  </div>
                </div>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {recommendationQuery.data.same_product.slice(0, 6).map((item) => (
                    <MarketplaceProductCard key={`same-${item.id}`} product={{ ...item, comparison_count: recommendationQuery.data.comparison?.shop_count, best_price: recommendationQuery.data.comparison?.best_price, highest_price: recommendationQuery.data.comparison?.highest_price }} comparison />
                  ))}
                </div>
              </div>
            )}

            {recommendationQuery.data?.recommended?.length > 0 && (
              <div className="border-t border-slate-200 pt-8">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
                    <Store className="h-3.5 w-3.5" /> Marketplace recommendations
                  </p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight">Similar products you may like</h2>
                  <p className="mt-2 text-sm text-slate-500">Relevant products from other active BazarHQ shops.</p>
                </div>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {recommendationQuery.data.recommended.slice(0, 8).map((item) => (
                    <MarketplaceProductCard key={`recommended-${item.id}`} product={item} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                <MessageSquare className="h-3.5 w-3.5" /> Customer reviews
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-tight">Reviews & ratings</h2>
              <p className="mt-1 text-sm text-slate-500">
                {reviewStats.count ? `${reviewStats.avg.toFixed(1)} average from ${reviewStats.count} review${reviewStats.count > 1 ? 's' : ''}` : 'No reviews yet.'}
              </p>
            </div>
            <div className="flex items-center gap-1 text-amber-400">
              {[0,1,2,3,4].map(i => <Star key={i} className={`h-5 w-5 ${i < Math.round(reviewStats.avg || 0) ? 'fill-current' : ''}`} />)}
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">Average rating</p>
                    <p className="mt-1 text-3xl font-black text-[var(--shop-primary)]">{reviewStats.count ? reviewStats.avg.toFixed(1) : '0.0'}</p>
                  </div>
                  <div className="text-right text-xs font-semibold text-slate-500">
                    <p>{reviewStats.count} review{reviewStats.count === 1 ? '' : 's'}</p>
                    <p>Verified customer feedback</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {[5,4,3,2,1].map((value) => {
                    const count = reviewStats.distribution?.[value] || 0
                    const width = reviewStats.count ? `${(count / reviewStats.count) * 100}%` : '0%'
                    return (
                      <div key={value} className="grid grid-cols-[32px_1fr_36px] items-center gap-2 text-xs font-bold text-slate-500">
                        <span>{value}★</span>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-[var(--shop-primary)]" style={{ width }} />
                        </div>
                        <span className="text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-bold">Write a review</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Only verified customers who ordered this product can submit a review.</p>
              <div className="mt-4 flex gap-1 text-amber-400">
                {[1,2,3,4,5].map(value => (
                  <button key={value} type="button" onClick={() => setReviewRating(value)} className="transition hover:scale-110">
                    <Star className={`h-6 w-6 ${value <= reviewRating ? 'fill-current' : ''}`} />
                  </button>
                ))}
              </div>
              <textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                rows={4}
                placeholder="Share your experience with this product..."
                className="mt-4 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[var(--shop-primary)]"
              />
              <Button className="mt-3 w-full rounded-2xl bg-[var(--shop-primary)] text-white" onClick={submitReview} disabled={submittingReview}>
                {submittingReview ? 'Submitting...' : 'Submit review'}
              </Button>
              {reviewMessage && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600">{reviewMessage}</p>}
              </div>
            </div>

            <div className="space-y-3">
              {reviews.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No customer review has been added yet.</div>
              ) : reviews.map((review) => (
                <article key={review.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">{review.customer_name || 'Verified customer'}</p>
                      <p className="text-xs text-slate-400">{new Date(review.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-0.5 text-amber-400">
                      {[0,1,2,3,4].map(i => <Star key={i} className={`h-4 w-4 ${i < Number(review.rating || 0) ? 'fill-current' : ''}`} />)}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{review.comment}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
