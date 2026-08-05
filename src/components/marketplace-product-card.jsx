import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, BadgeCheck, Images, Scale, ShoppingBag, Star, TrendingUp } from 'lucide-react'
import { normalizeProductImages } from '@/components/product-image-gallery'

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function money(value) {
  return `৳${toNumber(value).toLocaleString('en-BD', { maximumFractionDigits: 2 })}`
}

function productRouteValue(product) {
  return String(product?.slug || product?.id || '')
}

export default function MarketplaceProductCard({ product, rank = null, comparison = false }) {
  const images = useMemo(
    () => normalizeProductImages(product?.images, product?.image_url),
    [product?.images, product?.image_url],
  )
  const firstImage = images[0] || null
  const secondImage = images[1] || firstImage
  const rating = toNumber(product?.average_rating, 0)
  const ratingCount = toNumber(product?.rating_count, 0)
  const sold = toNumber(product?.sold_quantity, 0)
  const compareCount = toNumber(product?.comparison_count, 1)
  const price = toNumber(product?.price, 0)
  const bestPrice = toNumber(product?.best_price, price)
  const highestPrice = toNumber(product?.highest_price, price)
  const compareAt = toNumber(product?.compare_at_price, 0)
  const saving = Math.max(0, highestPrice - bestPrice)
  const outOfStock = toNumber(product?.stock, 0) <= 0
  const storeSlug = product?.store_slug
  const hrefParams = { storeSlug, productId: productRouteValue(product) }

  return (
    <article className="group relative overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-white shadow-[0_12px_45px_-28px_rgba(15,23,42,.35)] transition duration-500 hover:-translate-y-1.5 hover:border-indigo-200 hover:shadow-[0_24px_70px_-35px_rgba(79,70,229,.42)]">
      <Link to="/shop/$storeSlug/product/$productId" params={hrefParams} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
          {firstImage ? (
            <>
              <img
                src={firstImage}
                alt={product?.title || 'Product'}
                className={`absolute inset-0 h-full w-full object-cover transition duration-700 ${images.length > 1 ? 'group-hover:opacity-0 group-hover:scale-105' : 'group-hover:scale-110'} ${outOfStock ? 'grayscale opacity-60' : ''}`}
                loading="lazy"
              />
              {images.length > 1 && (
                <img
                  src={secondImage}
                  alt=""
                  className={`absolute inset-0 h-full w-full scale-105 object-cover opacity-0 transition duration-700 group-hover:scale-100 group-hover:opacity-100 ${outOfStock ? 'grayscale' : ''}`}
                  loading="lazy"
                />
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-300">
              <ShoppingBag className="h-14 w-14" />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/75 to-transparent opacity-80" />

          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {rank && (
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white shadow-lg">
                #{rank} ranked
              </span>
            )}
            {comparison && compareCount > 1 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-black text-white shadow-lg">
                <Scale className="h-3.5 w-3.5" /> {compareCount} shops
              </span>
            )}
          </div>

          {images.length > 1 && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm backdrop-blur">
              <Images className="h-3.5 w-3.5" /> {images.length}
            </span>
          )}

          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 text-white">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white/75">{product?.category || 'General'}</p>
              <p className="mt-0.5 truncate text-sm font-black">{product?.shop_name || 'BazarHQ shop'}</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 transition group-hover:rotate-12 group-hover:scale-105">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 min-h-[2.8rem] text-[15px] font-black leading-snug text-slate-950 transition group-hover:text-indigo-600">
              {product?.title || 'Product'}
            </h3>
            {rating > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                <Star className="h-3.5 w-3.5 fill-current" /> {rating.toFixed(1)}
              </span>
            )}
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xl font-black text-slate-950">{money(price)}</p>
              {compareAt > price && <p className="text-xs font-semibold text-slate-400 line-through">{money(compareAt)}</p>}
            </div>
            <div className="text-right text-xs text-slate-500">
              {sold > 0 ? (
                <p className="inline-flex items-center gap-1 font-bold text-emerald-600"><TrendingUp className="h-3.5 w-3.5" /> {sold.toLocaleString('en-BD')} sold</p>
              ) : (
                <p className="font-semibold">New listing</p>
              )}
              {ratingCount > 0 && <p className="mt-1">{ratingCount} review{ratingCount === 1 ? '' : 's'}</p>}
            </div>
          </div>

          {compareCount > 1 && (
            <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5 text-xs text-indigo-800">
              <div className="flex items-center justify-between gap-2 font-bold">
                <span className="inline-flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" /> Best from {money(bestPrice)}</span>
                {saving > 0 && <span>Save up to {money(saving)}</span>}
              </div>
            </div>
          )}
        </div>
      </Link>
    </article>
  )
}
