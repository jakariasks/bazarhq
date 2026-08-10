import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, ChevronRight, MessageSquare, Minus, Package, Plus, Scale, Send, ShieldCheck, ShoppingCart, Star, Store, Tag, Truck, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { addToCart, getCartTotals, reconcileCartWithProducts } from '@/lib/cart'
import { getStoreTheme, getThemeCssVars, themeDataAttributes } from '@/lib/theme-system'
import { trackStoreEvent } from '@/lib/analytics-tracker'
import { useCustomerAuth } from '@/hooks/use-customer-auth'
import ProductImageGallery, { normalizeProductImages } from '@/components/product-image-gallery'
import MarketplaceProductCard from '@/components/marketplace-product-card'
import { fetchMarketplaceProductRecommendations } from '@/lib/marketplace-api'
import ProductVariantSelector from '@/components/product-variant-selector'
import {
  buildCartVariant,
  findSelectedVariant,
  getVariantGroups,
  getProductCommerceSummary,
  getVariantLowStockThreshold,
} from '@/lib/product-variants'

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function money(value, currency = 'BDT') {
  const amount = toNumber(value).toLocaleString('en-BD')
  return String(currency || 'BDT').toUpperCase() === 'BDT' ? `৳${amount}` : `${currency} ${amount}`
}

function getImages(product) {
  return normalizeProductImages(product?.images, product?.image_url)
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

function isFeaturedProduct(product) {
  const tags = normalizeTagList(product?.tags).map((tag) => tag.toLowerCase())
  return Boolean(product?.is_featured || product?.featured || tags.includes('featured'))
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

function RelatedProductCard({ storeSlug, product, currency = 'BDT' }) {
  const targetStoreSlug = product.store_slug || product.subdomain || storeSlug
  return (
    <MarketplaceProductCard
      product={{ ...product, store_slug: targetStoreSlug }}
      storeSlug={targetStoreSlug}
      shopName={product.shop_name}
      currency={currency}
      className="h-full"
      themeAware
    />
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

function productMatchesExactRoute(product, routeValue) {
  const value = String(routeValue || '').trim().toLowerCase()
  if (!value || !product) return false
  return [product.id, product.slug, product.sku]
    .filter(Boolean)
    .some((candidate) => String(candidate).trim().toLowerCase() === value)
}

function productMatchesLegacyRoute(product, routeValue) {
  const value = String(routeValue || '').trim().toLowerCase()
  if (!value || !product) return false

  const id = String(product.id || '').toLowerCase()
  const titleSlug = slugifyProductText(getProductTitle(product))
  const idPrefix = id ? id.slice(0, 4) : ''
  const generatedSlug = idPrefix ? `${titleSlug}-${idPrefix}` : titleSlug

  return (
    value === titleSlug ||
    value === generatedSlug ||
    Boolean(titleSlug && value.startsWith(`${titleSlug}-`))
  )
}

function getDiscount(price, compareAtPrice) {
  const currentPrice = toNumber(price, 0)
  const compareAt = toNumber(compareAtPrice, 0)
  if (!currentPrice || compareAt <= currentPrice) return 0
  return Math.round((1 - currentPrice / compareAt) * 100)
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

function EmptyState({ title, message, backTo = '/', backLabel = 'Go home' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8 text-center">
      <Package className="h-12 w-12 text-slate-300" />
      <h1 className="mt-4 text-2xl font-black text-slate-950">{title}</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{message}</p>
      <Link to={backTo} className="mt-6 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">{backLabel}</Link>
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
  const [selectedOptions, setSelectedOptions] = useState({})
  const [qty, setQty] = useState(1)
  const [message, setMessage] = useState('')
  const [cartCount, setCartCount] = useState(0)
  const { customer, isLoggedIn } = useCustomerAuth()
  const [reviews, setReviews] = useState([])
  const [reviewStats, setReviewStats] = useState({ avg: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } })
  const [relatedProducts, setRelatedProducts] = useState([])
  const [storeHasOffers, setStoreHasOffers] = useState(false)
  const [storeProductRailLabel, setStoreProductRailLabel] = useState('')
  const [canReview, setCanReview] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewMessage, setReviewMessage] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewFilter, setReviewFilter] = useState('all')
  const [hasExistingReview, setHasExistingReview] = useState(false)
  const [reviewAccessLoading, setReviewAccessLoading] = useState(false)
  const [reviewAccessError, setReviewAccessError] = useState('')
  const [reviewLoadError, setReviewLoadError] = useState('')
  const [comments, setComments] = useState([])
  const [commentDraft, setCommentDraft] = useState('')
  const [commentMessage, setCommentMessage] = useState('')
  const [commentLoadError, setCommentLoadError] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

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
      if (storeError || !storeData) {
        setStatus('not-found')
        return
      }

      setStore(storeData)
      if (storeData.account_status === 'suspended') { setStatus('suspended'); return }
      if (storeData.account_status === 'deleted') { setStatus('deleted'); return }
      if (!storeData.storefront_published) { setStatus('unpublished'); return }
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
        setStatus('catalog-error')
        return
      }

      const productData = (productRows || []).find((row) => productMatchesExactRoute(row, productId))
        || (productRows || []).find((row) => productMatchesLegacyRoute(row, productId))

      if (!productData) {
        setStatus('not-found')
        return
      }

      const rows = productRows || []
      const hasConfiguredOffer = storeData.offer_enabled !== false && Boolean(
        String(storeData.offer_title || '').trim() ||
        String(storeData.offer_subtitle || '').trim() ||
        String(storeData.offer_image_url || '').trim() ||
        rows.some((row) => {
          const summary = getProductCommerceSummary(row)
          const compareAt = toNumber(row.compare_at_price, 0)
          return summary.price > 0 && compareAt > summary.price
        })
      )

      const hasExplicitFeatured = rows.some(isFeaturedProduct)
      const productRailLabel = hasExplicitFeatured ? 'Featured' : rows.length > 6 ? 'New arrivals' : ''

      const related = rows
        .filter((row) => row.id !== productData.id)
        .sort((a, b) => {
          const sameCategoryA = String(a.category || '').toLowerCase() === String(productData.category || '').toLowerCase() ? 1 : 0
          const sameCategoryB = String(b.category || '').toLowerCase() === String(productData.category || '').toLowerCase() ? 1 : 0
          const featuredA = a.is_featured ? 1 : 0
          const featuredB = b.is_featured ? 1 : 0
          return (sameCategoryB - sameCategoryA) || (featuredB - featuredA) || (toNumber(b.created_at ? new Date(b.created_at).getTime() : 0) - toNumber(a.created_at ? new Date(a.created_at).getTime() : 0))
        })
        .slice(0, 8)

      reconcileCartWithProducts(storeData.id, productRows || [])
      setStore(storeData)
      setProduct(productData)
      setRelatedProducts(related)
      setStoreHasOffers(hasConfiguredOffer)
      setStoreProductRailLabel(productRailLabel)
      setCartCount(getCartTotals(storeData.id).itemCount)
      setStatus('ok')
      setSelectedOptions({})
      trackStoreEvent({ storeSlug, storeId: storeData.id, eventType: 'product_view', productId: productData.id, metadata: { title: getProductTitle(productData) } })
    }
    loadProduct()
    return () => { mounted = false }
  }, [storeSlug, productId])

  useEffect(() => {
    if (!store?.id) return
    setCartCount(getCartTotals(store.id).itemCount)
  }, [store?.id])

  async function refreshReviews(targetProductId = product?.id) {
    if (!targetProductId) return
    setReviewLoadError('')

    let result = await supabase
      .from('product_reviews')
      .select('id, rating, comment, customer_name, created_at, updated_at, merchant_reply, merchant_replied_at')
      .eq('product_id', targetProductId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })

    // Backward compatible read: reviews still render when the merchant-reply
    // columns have not been deployed yet.
    if (result.error && /merchant_reply|merchant_replied_at|column .* does not exist/i.test(String(result.error.message || ''))) {
      result = await supabase
        .from('product_reviews')
        .select('id, rating, comment, customer_name, created_at, updated_at')
        .eq('product_id', targetProductId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
      if (!result.error) {
        result.data = (result.data || []).map((row) => ({ ...row, merchant_reply: null, merchant_replied_at: null }))
      }
    }

    if (result.error) {
      setReviewLoadError(result.error.message || 'Reviews could not be loaded right now.')
      return
    }

    const rows = result.data || []
    setReviews(rows)
    setReviewStats(buildReviewStats(rows))
  }

  async function refreshComments(targetProductId = product?.id) {
    if (!targetProductId) return
    setCommentLoadError('')
    const { data, error } = await supabase
      .from('product_comments')
      .select('id, comment, customer_name, created_at, updated_at, merchant_reply, merchant_replied_at')
      .eq('product_id', targetProductId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })

    if (error) {
      setComments([])
      setCommentLoadError(
        /product_comments|relation .* does not exist/i.test(String(error.message || ''))
          ? 'Questions & comments need the latest product feedback database migration.'
          : (error.message || 'Questions & comments could not be loaded right now.'),
      )
      return
    }
    setComments(data || [])
  }

  useEffect(() => {
    if (!product?.id) return undefined
    setReviews([])
    setReviewStats({ avg: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } })
    setReviewFilter('all')
    void refreshReviews(product.id)
    const channel = supabase
      .channel(`storefront-product-reviews-${product.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_reviews', filter: `product_id=eq.${product.id}` }, () => {
        void refreshReviews(product.id)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [product?.id])

  useEffect(() => {
    if (!product?.id) return undefined
    setComments([])
    setCommentDraft('')
    setCommentMessage('')
    void refreshComments(product.id)
    const channel = supabase
      .channel(`storefront-product-comments-${product.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_comments', filter: `product_id=eq.${product.id}` }, () => {
        void refreshComments(product.id)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [product?.id])

  useEffect(() => {
    if (!isLoggedIn || !store?.id || !product?.id) {
      setCanReview(false)
      setReviewAccessLoading(false)
      setReviewAccessError('')
      return
    }

    let cancelled = false
    setReviewAccessLoading(true)
    setReviewAccessError('')
    supabase.rpc('customer_can_review_product', { p_store_id: store.id, p_product_id: product.id })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setCanReview(false)
          setReviewAccessError(error.message || 'Could not verify your purchase history.')
        } else {
          setCanReview(Boolean(data))
        }
      })
      .finally(() => {
        if (!cancelled) setReviewAccessLoading(false)
      })

    return () => { cancelled = true }
  }, [isLoggedIn, store?.id, product?.id])

  useEffect(() => {
    if (!isLoggedIn || !product?.id) {
      setHasExistingReview(false)
      setReviewRating(5)
      setReviewComment('')
      return
    }

    let cancelled = false
    setHasExistingReview(false)
    setReviewRating(5)
    setReviewComment('')
    supabase.rpc('get_my_product_review', { p_product_id: product.id }).then(({ data, error }) => {
      if (cancelled || error) return
      if (!data) {
        setHasExistingReview(false)
        return
      }
      setHasExistingReview(true)
      setReviewRating(Number(data.rating || 5))
      setReviewComment(String(data.comment || ''))
    })
    return () => { cancelled = true }
  }, [isLoggedIn, product?.id])

  async function submitReview() {
    setReviewMessage('')
    if (!isLoggedIn || !customer) {
      setReviewMessage('Please login as a customer to write a review.')
      return
    }
    if (!canReview) {
      setReviewMessage('Only customers who ordered this product can review it.')
      return
    }
    const comment = reviewComment.trim()
    if (comment.length < 5) {
      setReviewMessage('Write at least 5 characters about your experience.')
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
    setReviewMessage(hasExistingReview ? 'Your review has been updated.' : 'Thanks! Your review has been published.')
    setHasExistingReview(true)
    await refreshReviews(product.id)
  }

  async function submitComment() {
    setCommentMessage('')
    if (!isLoggedIn || !customer) {
      setCommentMessage('Please login as a customer to post a question or comment.')
      return
    }
    const comment = commentDraft.trim()
    if (comment.length < 3) {
      setCommentMessage('Write at least 3 characters before posting.')
      return
    }

    setSubmittingComment(true)
    const { error } = await supabase.rpc('submit_product_comment', {
      p_store_id: store.id,
      p_product_id: product.id,
      p_comment: comment,
    })
    setSubmittingComment(false)

    if (error) {
      setCommentMessage(
        /submit_product_comment|function .* does not exist/i.test(String(error.message || ''))
          ? 'Comments need the latest product feedback database migration.'
          : (error.message || 'Your comment could not be posted.'),
      )
      return
    }

    setCommentDraft('')
    setCommentMessage('Posted successfully. The merchant can reply here publicly.')
    await refreshComments(product.id)
  }


  const commerce = useMemo(
    () => product ? getProductCommerceSummary(product) : getProductCommerceSummary(null),
    [product],
  )
  const variants = commerce.variants
  const variantGroups = useMemo(
    () => product ? getVariantGroups(product, variants) : [],
    [product, variants],
  )
  const selectedVariant = useMemo(
    () => findSelectedVariant(variants, selectedOptions, variantGroups),
    [variants, selectedOptions, variantGroups],
  )
  const images = getImages(product)
  const currency = store?.currency || 'BDT'
  const requiresVariant = commerce.hasVariants
  const selectionIncomplete = requiresVariant && !selectedVariant
  const totalVariantStock = commerce.stock
  const price = toNumber(selectedVariant?.price ?? commerce.price, 0)
  const stock = requiresVariant
    ? toNumber(selectedVariant?.stock ?? commerce.stock, 0)
    : commerce.stock
  const lowStockThreshold = getVariantLowStockThreshold(product, selectedVariant)
  const lowStock = !selectionIncomplete && stock > 0 && stock <= lowStockThreshold
  const overallOutOfStock = !commerce.inStock
  const outOfStock = overallOutOfStock || Boolean(selectedVariant && !selectedVariant.available)
  const compareAtPrice = toNumber(product?.compare_at_price, 0)
  const discount = getDiscount(price, compareAtPrice)
  const tagList = normalizeTagList(product?.tags)
  const activeTheme = getStoreTheme(store)
  const vars = getThemeCssVars(store)
  const themeAttrs = themeDataAttributes(activeTheme)
  // Route paths must be safe during the initial loading render. At this point
  // `product` and even `storeSlug` can still be null/undefined while Supabase is
  // resolving the storefront and product.
  const safeStoreSlug = typeof storeSlug === 'string' ? storeSlug.trim() : ''
  const shopHomePath = safeStoreSlug ? `/shop/${encodeURIComponent(safeStoreSlug)}` : '/'
  const productRouteValue = product?.slug || product?.id || ''
  const currentProductPath = productRouteValue
    ? `${shopHomePath}/product/${encodeURIComponent(String(productRouteValue))}`
    : shopHomePath
  const aboutPath = safeStoreSlug ? `${shopHomePath}/about` : '/'
  const visibleReviews = useMemo(() => {
    if (reviewFilter === 'all') return reviews
    const target = Number(reviewFilter)
    return reviews.filter((review) => Number(review.rating) === target)
  }, [reviews, reviewFilter])

  function addSelectedToCart() {
    if (!store?.id || !product) return

    setMessage('')

    if (requiresVariant && !selectedVariant) {
      const missing = variantGroups
        .filter((group) => !selectedOptions[group.name])
        .map((group) => group.name)

      setMessage(
        missing.length
          ? `Please select ${missing.join(' and ')} before adding this product.`
          : 'Please select an available product variant.',
      )
      return
    }

    if (outOfStock) {
      setMessage(
        selectedVariant
          ? 'The selected variant is out of stock.'
          : 'This product is out of stock.',
      )
      return
    }

    const cartProduct = {
      ...product,
      images,
      price,
    }

    const cartVariant = selectedVariant
      ? buildCartVariant(product, selectedVariant)
      : null

    const result = addToCart(store.id, cartProduct, cartVariant, qty)

    if (!result.success) {
      setMessage(result.message)
      return
    }

    setCartCount(getCartTotals(store.id).itemCount)
    setMessage('Added to cart successfully.')

    trackStoreEvent({
      storeSlug,
      storeId: store.id,
      eventType: 'add_to_cart',
      productId: product.id,
      metadata: {
        qty,
        variant_id: cartVariant?.id || null,
        variant: cartVariant?.label || null,
        variant_options: cartVariant?.options || null,
      },
    })
  }

  if (status === 'loading') return <ProductSkeleton />
  if (status === 'suspended') return <EmptyState title="Shop temporarily unavailable" message="This storefront is currently suspended and cannot accept customer visits." />
  if (status === 'deleted') return <EmptyState title="Shop unavailable" message="This storefront is no longer available." />
  if (status === 'unpublished') return <EmptyState title="Shop currently unavailable" message="The merchant has temporarily unpublished this storefront. Please check again later." />
  if (status === 'catalog-error') return <EmptyState title="Products could not be loaded" message="The shop is online, but its product catalog could not be loaded right now. Please refresh and try again." backTo={shopHomePath} backLabel="Back to shop" />
  if (status !== 'ok') return <EmptyState title="Product not found" message="This product is unavailable or no longer published in this shop." backTo={store ? shopHomePath : '/'} backLabel={store ? 'Back to shop' : 'Go to marketplace'} />

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="min-h-screen scroll-smooth bg-[var(--shop-page-bg)] text-[var(--shop-text)]" style={vars} {...themeAttrs}>
      <style>{`
        [data-theme-font] { font-family: var(--shop-font-family); }
        [data-theme-bg="dark"] .shop-product-surface { background: var(--shop-surface) !important; color: var(--shop-text) !important; border-color: color-mix(in srgb, var(--shop-text) 12%, transparent) !important; }
        [data-theme-bg="dark"] .shop-product-surface .bg-white { background: color-mix(in srgb, var(--shop-surface) 94%, white 6%) !important; }
        [data-theme-bg="dark"] .shop-product-surface .bg-slate-50, [data-theme-bg="dark"] .shop-product-surface .bg-slate-100 { background: color-mix(in srgb, var(--shop-surface) 88%, var(--shop-text) 12%) !important; }
        [data-theme-bg="dark"] .shop-product-surface .text-slate-950, [data-theme-bg="dark"] .shop-product-surface .text-slate-900, [data-theme-bg="dark"] .shop-product-surface .text-slate-800 { color: var(--shop-text) !important; }
        [data-theme-bg="dark"] .shop-product-surface .text-slate-700, [data-theme-bg="dark"] .shop-product-surface .text-slate-600, [data-theme-bg="dark"] .shop-product-surface .text-slate-500 { color: color-mix(in srgb, var(--shop-text) 72%, transparent) !important; }
        .shop-product-shell { width: 100%; max-width: 80rem !important; }
        .shop-product-header { background: color-mix(in srgb, var(--shop-surface) 90%, transparent); border-color: var(--shop-primary-soft); }
        .shop-product-header-text { color: var(--shop-text); }
        .shop-product-surface { box-shadow: 0 18px 55px -38px rgba(15,23,42,.28); }
        .shop-review-card, .shop-comment-card { transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease; }
        .shop-review-card:hover, .shop-comment-card:hover { transform: translateY(-2px); border-color: var(--shop-primary-ring); box-shadow: 0 16px 40px -30px rgba(15,23,42,.25); }
        @media (prefers-reduced-motion: reduce) { .shop-review-card, .shop-review-card:hover, .shop-comment-card, .shop-comment-card:hover { transform: none !important; transition: none !important; } }
      `}</style>
      <header className="shop-product-header sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="shop-product-shell mx-auto flex h-16 w-full items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/shop/$storeSlug" params={{ storeSlug }} className="flex min-w-0 items-center gap-3">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.shop_name} className="h-10 w-10 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--shop-primary)] text-base font-black text-white">
                {String(store.shop_name || 'S').charAt(0).toUpperCase()}
              </span>
            )}
            <span className="shop-product-header-text truncate text-lg font-black tracking-tight">{store.shop_name}</span>
          </Link>

          <nav className="ml-5 hidden items-center gap-5 text-sm font-semibold text-slate-600 lg:flex">
            {storeProductRailLabel && <a href={`${shopHomePath}#featured`} className="transition hover:text-[var(--shop-primary)]">{storeProductRailLabel}</a>}
            <a href={`${shopHomePath}#products`} className="transition hover:text-[var(--shop-primary)]">Products</a>
            {storeHasOffers && <a href={`${shopHomePath}#offers`} className="transition hover:text-[var(--shop-primary)]">Offers</a>}
            <a href={aboutPath} className="transition hover:text-[var(--shop-primary)]">About</a>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate({
                to: isLoggedIn ? '/customer/account' : '/customer/login',
                search: isLoggedIn ? {} : { redirect: currentProductPath },
              })}
              className="hidden items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-[var(--shop-primary)] hover:text-[var(--shop-primary)] sm:inline-flex"
            >
              <User className="mr-2 h-4 w-4" /> {isLoggedIn ? 'My account' : 'Login'}
            </button>
            <button
              type="button"
              onClick={() => navigate({
                to: isLoggedIn ? '/customer/account' : '/customer/login',
                search: isLoggedIn ? {} : { redirect: currentProductPath },
              })}
              className="rounded-full p-2.5 text-slate-700 transition hover:bg-slate-100 sm:hidden"
              aria-label="Customer account"
            >
              <User className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="relative rounded-full bg-slate-100 p-2.5 text-slate-800 transition hover:bg-[var(--shop-primary)]/10 hover:text-[var(--shop-primary)]"
              onClick={() => navigate({ to: '/checkout', search: { store: storeSlug } })}
              aria-label="Go to checkout"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--shop-primary)] px-1 text-[10px] font-black text-white">{cartCount > 99 ? '99+' : cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="shop-main w-full py-7">
        <div className="shop-product-shell mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
          <Link to="/shop/$storeSlug" params={{ storeSlug }} className="inline-flex items-center gap-2 hover:text-[var(--shop-primary)]">
            <ArrowLeft className="h-4 w-4" /> {store.shop_name}
          </Link>
          <ChevronRight className="h-4 w-4 text-slate-300" />
          <span className="truncate text-slate-700">{getProductTitle(product)}</span>
        </div>

        <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,.9fr)] lg:gap-8">
          <ProductImageGallery
            images={images}
            fallbackImage={product.image_url}
            alt={getProductTitle(product)}
            objectFit={activeTheme.image_fit === 'cover' ? 'cover' : 'contain'}
            aspectRatio={activeTheme.image_ratio}
          />

          <div className="shop-product-surface rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{product.category || 'General'}</span>
              {discount > 0 && <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-black text-white">-{discount}%</span>}
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2 text-xs font-bold">
                <a href="#reviews" className="inline-flex items-center gap-1 text-amber-400 transition hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
                  {[0,1,2,3,4].map(i => <Star key={i} className={`h-4 w-4 ${i < Math.round(reviewStats.avg || 0) ? 'fill-current' : ''}`} />)}
                  <span className="ml-1 text-slate-500">{reviewStats.count ? `${reviewStats.avg.toFixed(1)} (${reviewStats.count})` : 'No reviews'}</span>
                </a>
                <span className="text-slate-300">•</span>
                <a href="#questions" className="inline-flex items-center gap-1 text-slate-500 transition hover:text-[var(--shop-primary)]"><MessageSquare className="h-3.5 w-3.5" /> {comments.length} comment{comments.length === 1 ? '' : 's'}</a>
              </div>
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">{getProductTitle(product)}</h1>
            <div className="mt-4">
              <div className="flex items-end gap-3">
                <p className="text-3xl font-black text-[var(--shop-primary)]">
                  {selectionIncomplete && commerce.hasPriceRange ? 'From ' : ''}
                  {money(price, currency)}
                </p>
                {compareAtPrice > price && (
                  <p className="pb-1 text-sm font-semibold text-slate-400 line-through">
                    {money(compareAtPrice, currency)}
                  </p>
                )}
              </div>
              {selectedVariant && toNumber(selectedVariant.price_adjustment, 0) !== 0 && (
                <p className="mt-1 text-xs font-bold text-slate-500">
                  Variant price adjustment: {toNumber(selectedVariant.price_adjustment, 0) > 0 ? '+' : ''}
                  {money(selectedVariant.price_adjustment, currency)}
                </p>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
              {product.description || 'No description added yet.'}
            </div>

            {variants.length > 0 && (
              <ProductVariantSelector
                product={product}
                variants={variants}
                selection={selectedOptions}
                onChange={(nextSelection) => {
                  setSelectedOptions(nextSelection)
                  setQty(1)
                  setMessage('')
                }}
              />
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  className="rounded-xl p-2 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  disabled={selectionIncomplete || outOfStock}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-sm font-black">{qty}</span>
                <button
                  type="button"
                  className="rounded-xl p-2 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setQty(Math.min(stock || 1, qty + 1))}
                  disabled={selectionIncomplete || outOfStock || qty >= stock}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <Button
                className="h-12 flex-1 rounded-2xl bg-[var(--shop-primary)] text-white hover:opacity-90 disabled:bg-slate-300"
                disabled={overallOutOfStock || selectionIncomplete || outOfStock}
                onClick={addSelectedToCart}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {overallOutOfStock
                  ? 'Out of stock'
                  : selectionIncomplete
                    ? 'Select options'
                    : outOfStock
                      ? 'Selected option unavailable'
                      : 'Add to cart'}
              </Button>
            </div>

            <p
              className={`mt-3 text-sm font-semibold ${
                overallOutOfStock || outOfStock
                  ? 'text-rose-600'
                  : selectionIncomplete
                    ? 'text-slate-500'
                    : lowStock
                      ? 'text-amber-600'
                      : 'text-emerald-600'
              }`}
            >
              {overallOutOfStock
                ? 'Out of stock'
                : selectionIncomplete
                  ? 'Select all options to see the exact price and stock.'
                  : outOfStock
                    ? 'Selected option is out of stock'
                    : lowStock
                      ? `Only ${stock} left in stock`
                      : `${stock} in stock`}
            </p>
            {message && <p className="mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p>}

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[['Secure checkout', ShieldCheck], ['Delivery at checkout', Truck], ['Order tracking', CheckCircle2]].map(([label, Icon]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-xs font-bold text-slate-600">
                  <Icon className="mx-auto mb-2 h-5 w-5 text-[var(--shop-primary)]" /> {label}
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[1rem] border border-slate-200 bg-slate-50 p-5">
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
                  <p className="mt-2 text-sm font-bold text-slate-900">{selectedVariant?.sku || product.sku || 'Not provided'}</p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Availability</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">{overallOutOfStock ? 'Out of stock' : selectionIncomplete ? `${totalVariantStock} total across variants` : `${stock} available now`}</p>
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
          <section className="shop-product-surface mt-8 rounded-[1.25rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
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
                <RelatedProductCard key={`store-related-${item.id}`} storeSlug={storeSlug} product={item} currency={currency} />
              ))}
            </div>
          </section>
        )}

        {(recommendationQuery.data?.same_product?.length > 0 || recommendationQuery.data?.recommended?.length > 0) && (
          <section className="shop-product-surface mt-8 space-y-8 rounded-[1.25rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
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
                  {Number(recommendationQuery.data.comparison?.best_price || 0) > 0 && (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-right">
                      <p className="text-xs font-bold text-emerald-700">Best marketplace price</p>
                      <p className="mt-1 text-xl font-black text-emerald-700">{money(recommendationQuery.data.comparison.best_price, currency)}</p>
                    </div>
                  )}
                </div>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {recommendationQuery.data.same_product.slice(0, 6).map((item) => (
                    <RelatedProductCard key={`same-${item.id}`} storeSlug={item.store_slug || item.subdomain || storeSlug} product={item} currency={currency} />
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
                    <RelatedProductCard key={`recommended-${item.id}`} storeSlug={item.store_slug || item.subdomain || storeSlug} product={item} currency={currency} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <section id="reviews" className="shop-product-surface mt-7 scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--shop-primary)]"><Star className="h-3.5 w-3.5 fill-current" /> Verified product reviews</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">Reviews & ratings</h2>
              <p className="mt-1 text-sm text-slate-500">{reviewStats.count ? `${reviewStats.avg.toFixed(1)} average from ${reviewStats.count} verified review${reviewStats.count > 1 ? 's' : ''}` : 'Be the first verified buyer to review this product.'}</p>
            </div>
            {reviewStats.count > 0 && <div className="flex items-center gap-1 text-amber-400" aria-label={`${reviewStats.avg.toFixed(1)} out of 5 stars`}>{[0,1,2,3,4].map(i => <Star key={i} className={`h-5 w-5 ${i < Math.round(reviewStats.avg || 0) ? 'fill-current' : ''}`} />)}</div>}
          </div>

          {reviewLoadError && <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{reviewLoadError}</p>}

          <div className="mt-6 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Average rating</p><p className="mt-1 text-4xl font-black text-[var(--shop-primary)]">{reviewStats.count ? reviewStats.avg.toFixed(1) : '—'}</p></div>
                  <p className="pb-1 text-right text-xs font-semibold leading-5 text-slate-500">{reviewStats.count}<br />verified review{reviewStats.count === 1 ? '' : 's'}</p>
                </div>
                <div className="mt-4 space-y-2">
                  {[5,4,3,2,1].map((value) => {
                    const count = reviewStats.distribution?.[value] || 0
                    const width = reviewStats.count ? `${(count / reviewStats.count) * 100}%` : '0%'
                    return <button key={value} type="button" onClick={() => setReviewFilter(String(value))} className="grid w-full grid-cols-[30px_1fr_28px] items-center gap-2 rounded-lg py-0.5 text-xs font-bold text-slate-500 transition hover:text-[var(--shop-primary)]"><span>{value}★</span><span className="h-1.5 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-[var(--shop-primary)]" style={{ width }} /></span><span className="text-right">{count}</span></button>
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-black text-slate-900">Want to review it?</p>
                {!isLoggedIn ? <><p className="mt-1 text-xs leading-5 text-slate-500">Login with your buyer account. Reviews unlock after you order this product.</p><button type="button" onClick={() => navigate({ to: '/customer/login', search: { redirect: window.location.pathname } })} className="mt-3 inline-flex rounded-full bg-[var(--shop-primary)] px-4 py-2 text-xs font-black text-white transition hover:opacity-90">Login to review</button></> : reviewAccessLoading ? <p className="mt-2 text-xs font-semibold text-slate-500">Checking your purchase history…</p> : reviewAccessError ? <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold leading-5 text-rose-700">{reviewAccessError}</p> : canReview ? <p className="mt-1 text-xs leading-5 text-emerald-700">Verified purchase found. You can {hasExistingReview ? 'update your' : 'publish a'} review.</p> : <><p className="mt-1 text-xs leading-5 text-slate-500">Only customers who ordered this product can publish a star review.</p><button type="button" onClick={() => navigate({ to: '/customer/account' })} className="mt-3 text-xs font-black text-[var(--shop-primary)] hover:underline">View my orders</button></>}
              </div>
            </aside>

            <div className="min-w-0 space-y-4">
              {canReview && <div className="rounded-2xl border border-[var(--shop-primary-ring)] bg-[var(--shop-primary-soft)] p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black text-slate-900">{hasExistingReview ? 'Update your review' : 'Write a verified review'}</h3><p className="mt-1 text-xs text-slate-500">Rate the product and share what future buyers should know.</p></div><div className="flex gap-1 text-amber-400">{[1,2,3,4,5].map(value => <button key={value} type="button" aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`} aria-pressed={value === reviewRating} onClick={() => setReviewRating(value)} className="rounded-md p-0.5 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"><Star className={`h-6 w-6 ${value <= reviewRating ? 'fill-current' : ''}`} /></button>)}</div></div>
                <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} rows={3} placeholder="Share your experience with this product…" maxLength={1200} className="mt-4 w-full resize-y rounded-2xl border border-white/70 bg-white p-3 text-sm leading-6 outline-none transition focus:border-[var(--shop-primary)] focus:ring-4 focus:ring-[var(--shop-primary-soft)]" />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-[11px] font-semibold text-slate-400">{reviewComment.length}/1200</span><Button className="rounded-full bg-[var(--shop-primary)] px-5 text-white hover:opacity-90" onClick={submitReview} disabled={submittingReview}>{submittingReview ? 'Saving…' : hasExistingReview ? 'Update review' : 'Publish review'}</Button></div>
                {reviewMessage && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600">{reviewMessage}</p>}
              </div>}

              {reviews.length > 0 && <div className="flex flex-wrap items-center gap-2">{['all', '5', '4', '3', '2', '1'].map((value) => <button key={value} type="button" onClick={() => setReviewFilter(value)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${reviewFilter === value ? 'border-[var(--shop-primary)] bg-[var(--shop-primary-soft)] text-[var(--shop-primary)]' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>{value === 'all' ? 'All reviews' : `${value} star`}</button>)}</div>}

              {reviews.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center"><Star className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-700">No reviews yet</p><p className="mt-1 text-xs text-slate-500">Verified buyer feedback will appear here.</p></div> : visibleReviews.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No {reviewFilter}-star reviews yet.</div> : visibleReviews.map((review) => <article key={review.id} className="shop-review-card rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-slate-900">{review.customer_name || 'Verified customer'}</p><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Verified purchase</span></div><p className="mt-1 text-xs text-slate-400">{new Date(review.updated_at || review.created_at).toLocaleDateString()}</p></div><div className="flex gap-0.5 text-amber-400" aria-label={`${review.rating} out of 5 stars`}>{[0,1,2,3,4].map(i => <Star key={i} className={`h-4 w-4 ${i < Number(review.rating || 0) ? 'fill-current' : ''}`} />)}</div></div>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{review.comment}</p>
                {review.merchant_reply && <div className="mt-4 rounded-2xl border border-[var(--shop-primary-ring)] bg-[var(--shop-primary-soft)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black text-[var(--shop-primary)]">Reply from {store.shop_name}</p>{review.merchant_replied_at && <span className="text-[10px] font-semibold text-slate-400">{new Date(review.merchant_replied_at).toLocaleDateString()}</span>}</div><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{review.merchant_reply}</p></div>}
              </article>)}
            </div>
          </div>
        </section>

        <section id="questions" className="shop-product-surface mt-7 scroll-mt-24 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--shop-primary)]"><MessageSquare className="h-3.5 w-3.5" /> Product conversation</p><h2 className="mt-2 text-2xl font-black tracking-tight">Questions & comments</h2><p className="mt-1 text-sm text-slate-500">Ask the merchant about size, material, delivery, compatibility, care, or anything else about this product.</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{comments.length} comment{comments.length === 1 ? '' : 's'}</span></div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"><h3 className="font-black text-slate-900">Ask or comment</h3><p className="mt-1 text-xs leading-5 text-slate-500">No purchase is required. A buyer account is required to keep the conversation accountable.</p>
              {isLoggedIn ? <><textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} rows={4} maxLength={1200} placeholder="Example: Is this available in another color?" className="mt-4 w-full resize-y rounded-2xl border border-slate-200 bg-white p-3 text-sm leading-6 outline-none transition focus:border-[var(--shop-primary)] focus:ring-4 focus:ring-[var(--shop-primary-soft)]" /><div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] font-semibold text-slate-400">{commentDraft.length}/1200</span><Button className="rounded-full bg-slate-950 px-5 text-white hover:bg-[var(--shop-primary)]" onClick={submitComment} disabled={submittingComment || commentDraft.trim().length < 3}><Send className="mr-2 h-3.5 w-3.5" /> {submittingComment ? 'Posting…' : 'Post'}</Button></div></> : <button type="button" onClick={() => navigate({ to: '/customer/login', search: { redirect: window.location.pathname } })} className="mt-4 inline-flex rounded-full bg-[var(--shop-primary)] px-4 py-2 text-xs font-black text-white transition hover:opacity-90">Login to ask a question</button>}
              {commentMessage && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-600">{commentMessage}</p>}{commentLoadError && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold leading-5 text-rose-700">{commentLoadError}</p>}
            </div>

            <div className="min-w-0 space-y-3">{comments.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center"><MessageSquare className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-700">No questions or comments yet</p><p className="mt-1 text-xs text-slate-500">Start the first product conversation.</p></div> : comments.map((item) => <article key={item.id} className="shop-comment-card rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-black text-slate-900">{item.customer_name || 'Customer'}</p><p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString()}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Customer comment</span></div><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{item.comment}</p>{item.merchant_reply && <div className="mt-4 rounded-2xl border border-[var(--shop-primary-ring)] bg-[var(--shop-primary-soft)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black text-[var(--shop-primary)]">Reply from {store.shop_name}</p>{item.merchant_replied_at && <span className="text-[10px] font-semibold text-slate-400">{new Date(item.merchant_replied_at).toLocaleDateString()}</span>}</div><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{item.merchant_reply}</p></div>}</article>)}</div>
          </div>
        </section>
        </div>
      </main>

      <footer className="mt-10 border-t border-slate-200 bg-white">
        <div className="shop-product-shell mx-auto grid w-full gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              {store.logo_url ? (
                <img src={store.logo_url} alt={store.shop_name} className="h-11 w-11 rounded-xl object-cover" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--shop-primary)] font-black text-white">{String(store.shop_name || 'S').charAt(0).toUpperCase()}</span>
              )}
              <p className="text-lg font-black">{store.shop_name}</p>
            </div>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-600">{store.about_text || store.description || store.tagline || 'Browse products from this BazarHQ storefront.'}</p>
          </div>
          <div>
            <p className="font-black">Shop links</p>
            <div className="mt-4 space-y-2 text-sm font-semibold text-slate-500">
              {storeProductRailLabel && <a href={`${shopHomePath}#featured`} className="block hover:text-[var(--shop-primary)]">{storeProductRailLabel}</a>}
              <a href={`${shopHomePath}#products`} className="block hover:text-[var(--shop-primary)]">All products</a>
              <a href={aboutPath} className="block hover:text-[var(--shop-primary)]">About the shop</a>
              <Link to="/track" search={{ store: storeSlug }} className="block hover:text-[var(--shop-primary)]">Track order</Link>
            </div>
          </div>
          <div>
            <p className="font-black">Contact</p>
            <div className="mt-4 space-y-2 text-sm text-slate-500">
              {store.contact_email && <a className="block hover:text-[var(--shop-primary)]" href={`mailto:${store.contact_email}`}>{store.contact_email}</a>}
              {(store.contact_phone || store.phone) && <a className="block hover:text-[var(--shop-primary)]" href={`tel:${store.contact_phone || store.phone}`}>{store.contact_phone || store.phone}</a>}
              {store.address && <p>{store.address}</p>}
              {!store.contact_email && !(store.contact_phone || store.phone) && !store.address && <p>Contact details will appear after merchant setup.</p>}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 py-4 text-center text-xs font-semibold text-slate-500">Powered by <strong>BazarHQ</strong></div>
      </footer>
    </motion.div>
  )
}
