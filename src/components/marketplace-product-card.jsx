import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Check, Images, Scale, ShoppingBag, Star } from 'lucide-react'
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
      className={`group flex h-full flex-col overflow-hidden font-sans antialiased rounded-[1.15rem] border border-slate-200/90 bg-white shadow-[0_16px_42px_-30px_rgba(15,23,42,.32)] transition-[transform,border-color,box-shadow] duration-500 ease-out hover:-translate-y-1.5 hover:border-indigo-200 hover:shadow-[0_30px_72px_-34px_rgba(79,70,229,.34)] focus-within:-translate-y-1 focus-within:border-indigo-200 focus-within:shadow-[0_26px_64px_-34px_rgba(79,70,229,.28)] ${className}`}
    >
      <Link
        to="/shop/$storeSlug/product/$productId"
        params={{ storeSlug, productId }}
        className="group/image relative block aspect-square overflow-hidden bg-[#f2f4f7]"
      >
        {firstImage ? (
          <>
            <img
              src={firstImage}
              alt={product?.title || 'Product'}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-[850ms] ease-out group-hover/image:scale-[1.28] group-hover/image:brightness-[1.02] ${images.length > 1 ? 'group-hover/image:opacity-0' : ''} ${outOfStock ? 'grayscale opacity-60' : ''}`}
              loading="lazy"
            />
            {images.length > 1 && (
              <img
                src={secondImage}
                alt=""
                className={`absolute inset-0 h-full w-full scale-[1.04] object-cover opacity-0 transition-all duration-[850ms] ease-out group-hover/image:scale-[1.28] group-hover/image:opacity-100 ${outOfStock ? 'grayscale' : ''}`}
                loading="lazy"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300"><ShoppingBag className="h-12 w-12" /></div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-slate-950/18 to-transparent" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-wrap gap-1.5">
            {discount > 0 && (
              <span className="rounded-full border border-white/70 bg-white/92 px-2.5 py-1 text-[10px] font-black text-rose-600 shadow-sm backdrop-blur sm:text-[11px]">
                -{discount}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {images.length > 1 && (
              <span className="inline-flex h-8 items-center gap-1 rounded-full border border-white/70 bg-white/92 px-2 text-[10px] font-bold text-slate-700 shadow-sm backdrop-blur">
                <Images className="h-3.5 w-3.5" /> {images.length}
              </span>
            )}
            {onCompare && (
              <button
                type="button"
                onClick={handleCompare}
                aria-label={isCompared ? 'Remove from comparison' : 'Add to comparison'}
                title={isCompared ? 'Remove from comparison' : 'Compare product'}
                className={`flex h-8 w-8 items-center justify-center rounded-full border shadow-sm backdrop-blur transition ${isCompared ? 'border-slate-950 bg-slate-950 text-white' : 'border-white/70 bg-white/92 text-slate-700 hover:border-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
              >
                {isCompared ? <Check className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500 sm:text-xs">
          <span className="truncate">{product?.category || 'General'}</span>
          {rating > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 normal-case tracking-normal text-slate-600">
              <Star className="h-3.5 w-3.5 fill-current text-amber-400" /> {rating.toFixed(1)}
            </span>
          )}
        </div>

        <Link to="/shop/$storeSlug/product/$productId" params={{ storeSlug, productId }} className="mt-1.5 block">
          <h3 className="line-clamp-2 min-h-[2.7rem] text-[15px] font-extrabold leading-[1.32rem] tracking-[-0.01em] text-slate-950 transition-colors hover:text-indigo-700 sm:text-base sm:leading-[1.42rem]">
            {product?.title || 'Product'}
          </h3>
        </Link>

        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[1.25rem] font-black leading-none tracking-[-0.025em] text-slate-950 sm:text-[1.35rem]">{money(price, currency)}</p>
            {compareAt > price && <p className="mt-1.5 text-[10px] font-semibold text-slate-400 line-through sm:text-xs">{money(compareAt, currency)}</p>}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black sm:text-[11px] ${outOfStock ? 'bg-rose-50 text-rose-600' : sold > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {outOfStock ? 'Out of stock' : sold > 0 ? `${sold.toLocaleString('en-BD')} sold` : 'New'}
          </span>
        </div>

        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] font-semibold text-slate-600 sm:text-xs">
            <span className="truncate">{shopName}</span>
            {comparison && compareCount > 1 ? (
              <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700 sm:text-[11px]">
                {compareCount} shops · from {money(bestPrice, currency)}
              </span>
            ) : (
              <Link
                to="/shop/$storeSlug/product/$productId"
                params={{ storeSlug, productId }}
                className="pointer-events-none inline-flex translate-y-1 items-center gap-1 whitespace-nowrap font-black text-indigo-700 opacity-0 transition-all duration-300 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100"
                aria-label={`View details for ${product?.title || 'product'}`}
              >
                View details
                <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
          {comparison && saving > 0 && (
            <p className="mt-2 text-[11px] font-bold text-emerald-700">Save up to {money(saving, currency)}</p>
          )}
          {statusMessage && <p className={`mb-2 rounded-lg px-2.5 py-2 text-[11px] font-bold ${statusTone === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>{statusMessage}</p>}
          {onAddToCart && (
            <button
              type="button"
              disabled={addToCartDisabled}
              onClick={handleAdd}
              className="mt-3 h-10 w-full rounded-xl bg-slate-950 px-4 text-[13px] font-black text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {addToCartLabel}
            </button>
          )}
        </div>
      </div>
    </motion.article>
  )
}
