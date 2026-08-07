import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Images, Scale, ShoppingBag, Star, Store } from 'lucide-react'
import { normalizeProductImages } from '@/components/product-image-gallery'

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function money(value, currency = 'BDT') {
  const amount = toNumber(value).toLocaleString('en-BD', { maximumFractionDigits: 2 })
  return currency === 'BDT' ? `৳${amount}` : `${currency} ${amount}`
}

function productRouteValue(product) {
  return String(product?.slug || product?.id || '')
}

export default function MarketplaceProductCard({
  product,
  comparison = false,
  onCompare = null,
  isCompared = false,
  storeSlug: storeSlugOverride = null,
  shopName: shopNameOverride = null,
  currency = 'BDT',
  onAddToCart = null,
  addToCartLabel = 'Add to cart',
  addToCartDisabled = false,
  statusMessage = '',
  statusTone = 'neutral',
  showViewDetails = true,
  className = '',
}) {
  const images = useMemo(
    () => normalizeProductImages(product?.images, product?.image_url),
    [product?.images, product?.image_url],
  )

  const firstImage = images[0] || null
  const secondImage = images[1] || firstImage
  const price = toNumber(product?.price, 0)
  const compareAt = toNumber(product?.compare_at_price, 0)
  const rating = toNumber(product?.average_rating, 0)
  const sold = toNumber(product?.sold_quantity, 0)
  const compareCount = toNumber(product?.comparison_count, 1)
  const bestPrice = toNumber(product?.best_price, price)
  const highestPrice = toNumber(product?.highest_price, price)
  const saving = Math.max(0, highestPrice - bestPrice)
  const outOfStock = toNumber(product?.stock, 0) <= 0
  const discount = compareAt > price && price > 0 ? Math.round((1 - price / compareAt) * 100) : 0
  const storeSlug = product?.store_slug || product?.subdomain || storeSlugOverride
  const shopName = product?.shop_name || shopNameOverride || 'BazarHQ shop'
  const productId = productRouteValue(product)

  function handleCompare(event) {
    event.preventDefault()
    event.stopPropagation()
    onCompare?.(product)
  }

  function handleAdd(event) {
    event.preventDefault()
    event.stopPropagation()
    onAddToCart?.(product)
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.38, ease: 'easeOut' }}
      className={`group flex h-full min-h-[330px] flex-col overflow-hidden rounded-[1.2rem] border border-slate-200/90 bg-white font-sans antialiased shadow-[0_16px_42px_-28px_rgba(15,23,42,.22)] transition-all duration-500 ease-out hover:-translate-y-2 hover:scale-[1.015] hover:border-indigo-200 hover:shadow-[0_30px_72px_-32px_rgba(79,70,229,.28)] focus-within:-translate-y-1.5 focus-within:scale-[1.01] focus-within:border-indigo-200 focus-within:shadow-[0_26px_64px_-32px_rgba(79,70,229,.24)] ${className}`}
    >
      <Link
        to="/shop/$storeSlug/product/$productId"
        params={{ storeSlug, productId }}
        className="group/image relative block aspect-[4/3] shrink-0 overflow-hidden bg-[#f3f5f8]"
      >
        {firstImage ? (
          <>
            <img
              src={firstImage}
              alt={product?.title || 'Product'}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-[900ms] ease-out group-hover/image:scale-[1.18] group-hover/image:brightness-[1.03] ${images.length > 1 ? 'group-hover/image:opacity-0' : ''} ${outOfStock ? 'grayscale opacity-65' : ''}`}
              loading="lazy"
            />
            {images.length > 1 && (
              <img
                src={secondImage}
                alt=""
                className={`absolute inset-0 h-full w-full scale-[1.03] object-cover opacity-0 transition-all duration-[900ms] ease-out group-hover/image:scale-[1.18] group-hover/image:opacity-100 ${outOfStock ? 'grayscale' : ''}`}
                loading="lazy"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <ShoppingBag className="h-12 w-12" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-slate-950/14 to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {discount > 0 && (
              <span className="rounded-full border border-white/80 bg-white/95 px-2.5 py-1 text-[10px] font-black text-rose-600 shadow-sm backdrop-blur">
                -{discount}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {images.length > 1 && (
              <span className="inline-flex h-7 items-center gap-1 rounded-full border border-white/80 bg-white/95 px-2 text-[10px] font-bold text-slate-700 shadow-sm backdrop-blur">
                <Images className="h-3.5 w-3.5" /> {images.length}
              </span>
            )}
            {onCompare && (
              <button
                type="button"
                onClick={handleCompare}
                aria-label={isCompared ? 'Remove from comparison' : 'Add to comparison'}
                title={isCompared ? 'Remove from comparison' : 'Compare product'}
                className={`flex h-7 w-7 items-center justify-center rounded-full border shadow-sm backdrop-blur transition ${isCompared ? 'border-slate-950 bg-slate-950 text-white' : 'border-white/80 bg-white/95 text-slate-700 hover:border-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
              >
                {isCompared ? <Check className="h-3.5 w-3.5" /> : <Scale className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>
      </Link>

{/* // ..............................card edit ................................. */}

      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        <div className="flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-[0.11em] text-slate-500 sm:text-[11px]">
          <span className="truncate">{product?.category || 'General'}</span>
          {rating > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 normal-case tracking-normal text-slate-600">
              <Star className="h-3.5 w-3.5 fill-current text-amber-400" /> {rating.toFixed(1)}
            </span>
          )}
        </div>

        <Link to="/shop/$storeSlug/product/$productId" params={{ storeSlug, productId }} className="mt-1 block">
          <h3 className="line-clamp-2 min-h-[2.2rem] text-[14px] font-extrabold leading-[1.15rem] tracking-[-0.01em] text-purple-700  transition-colors hover:text-indigo-700 sm:text-[15px] sm:leading-[1.2rem]">
            
            {product?.title || 'Product'}
          </h3>
        </Link>

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <p className="shrink-0 text-[1.02rem] font-black leading-none tracking-[-0.025em] text-green-700 sm:text-[1.03rem]">
              {money(price, currency)}
            </p>
            {compareAt > price && (
              <p className="truncate text-[10px] font-semibold text-red-400 line-through sm:text-[13px]">
                {money(compareAt, currency)}
              </p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black sm:text-[10px] ${outOfStock ? 'bg-rose-50 text-rose-500' : sold > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {outOfStock ? 'Out of stock' : sold > 0 ? `${sold.toLocaleString('en-BD')} sold` : 'New'}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-slate-600 sm:text-[11px]">
            <Store className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
            <span className="truncate">{shopName}</span>
          </span>
          {comparison && compareCount > 1 && (
            <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-black text-indigo-700 sm:text-[10px]">
              {compareCount} shops
            </span>
          )}
        </div>

        {comparison && saving > 0 && (
          <p className="mt-1.5 text-[10px] font-bold text-emerald-700">Save up to {money(saving, currency)}</p>
        )}

        {statusMessage && (
          <p className={`mt-2 rounded-lg px-2.5 py-2 text-[10px] font-bold ${statusTone === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>
            {statusMessage}
          </p>
        )}

        <div className={`mt-auto grid gap-2 pt-2.5 ${showViewDetails && onAddToCart ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {showViewDetails && (
            <Link
              to="/shop/$storeSlug/product/$productId"
              params={{ storeSlug, productId }}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-700 transition duration-300 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 sm:text-[12px]"
            >
              View details <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}

          {onAddToCart && (
            <button
              type="button"
              disabled={addToCartDisabled}
              onClick={handleAdd}
              className="h-9 w-full rounded-xl bg-slate-950 px-3 text-[11px] font-black text-white transition duration-300 hover:-translate-y-0.5 hover:bg-indigo-600 hover:shadow-[0_12px_28px_-18px_rgba(79,70,229,.9)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:hover:translate-y-0 sm:text-[12px]"
            >
              {addToCartLabel}
            </button>
          )}
        </div>
      </div>
    </motion.article>
  )
}
