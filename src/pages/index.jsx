import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  ChevronRight,
  Download,
  ExternalLink,
  Home,
  LogIn,
  Mail,
  Menu,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import MarketplaceProductCard from '@/components/marketplace-product-card'
import { fetchMarketplaceHome } from '@/lib/marketplace-api'
import { useAuth } from '@/hooks/use-auth'

const APK_DOWNLOAD_URL = import.meta.env.VITE_BAZARHQ_APK_URL || '/downloads/bazarhq.apk'

const SUPPORT_EMAIL = 'info.softthinkers@gmail.com'

function GithubBrandIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49v-1.86c-2.78.62-3.37-1.22-3.37-1.22-.45-1.2-1.12-1.52-1.12-1.52-.92-.64.07-.63.07-.63 1.02.08 1.55 1.08 1.55 1.08.9 1.58 2.36 1.12 2.94.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.04-2.75-.1-.26-.45-1.31.1-2.71 0 0 .85-.28 2.78 1.05A9.4 9.4 0 0 1 12 6.98c.86 0 1.72.12 2.53.34 1.92-1.33 2.77-1.05 2.77-1.05.56 1.4.21 2.45.11 2.71.65.72 1.04 1.63 1.04 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9v2.78c0 .27.18.59.69.49A10.1 10.1 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  )
}

function FacebookBrandIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.19 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.5-3.91 3.77-3.91 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22C18.34 21.25 22 17.08 22 12.06Z" />
    </svg>
  )
}

function LinkedinBrandIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20.45 20.45h-3.56v-5.58c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.68H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.26 2.37 4.26 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.23 0H1.77C.8 0 0 .77 0 1.72v20.56C0 23.23.8 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.2 0 22.23 0Z" />
    </svg>
  )
}

function InstagramBrandIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
  )
}

function XBrandIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M18.9 2.75h3.1l-6.77 7.75 7.96 10.75h-6.24l-4.89-6.53-5.6 6.53H3.35l7.24-8.43L2.96 2.75h6.4l4.42 5.96 5.12-5.96Zm-1.09 16.6h1.72L8.42 4.56H6.57l11.24 14.8Z" />
    </svg>
  )
}

function MailBrandIcon(props) {
  return <Mail aria-hidden="true" {...props} />
}

const socialLinks = [
  { label: 'GitHub', href: import.meta.env.VITE_GITHUB_URL || 'https://github.com/jakariasks', Icon: GithubBrandIcon },
  { label: 'Facebook', href: import.meta.env.VITE_FACEBOOK_PAGE_URL || 'https://www.facebook.com/jakaria.sks', Icon: FacebookBrandIcon },
  { label: 'LinkedIn', href: import.meta.env.VITE_LINKEDIN_URL || 'https://www.linkedin.com/in/jakaria-sks/', Icon: LinkedinBrandIcon },
  { label: 'Instagram', href: import.meta.env.VITE_INSTAGRAM_URL || '#', Icon: InstagramBrandIcon },
  { label: 'X', href: import.meta.env.VITE_X_URL || '#', Icon: XBrandIcon },
  { label: 'Email', href: `mailto:${SUPPORT_EMAIL}`, Icon: MailBrandIcon },
]

const fadeUp = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.55, ease: 'easeOut' },
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function compact(value) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(number(value))
}


function MarketplaceNav() {
  const [open, setOpen] = useState(false)
  const { rawUser, isMerchant, hasCustomerRole, loading } = useAuth()

  const customerPath = hasCustomerRole ? '/customer/account' : rawUser ? '/customer/signup' : '/customer/login'
  const merchantPath = isMerchant ? '/merchant' : '/login'

  return (
    <>
      <div className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex min-h-10 max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-center text-xs font-semibold leading-5 sm:justify-between sm:px-6 sm:text-left sm:text-[13px] lg:px-8">
          <p className="min-w-0 text-slate-100">A multi-store marketplace built for buyers and independent sellers in Bangladesh.</p>
          <a href={APK_DOWNLOAD_URL} className="inline-flex shrink-0 items-center gap-1.5 font-bold text-white transition-colors duration-200 hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download BazarHQ App
          </a>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="BazarHQ marketplace home"><Logo size="md" /></Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#top-shops" className="rounded-sm transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200">Top shops</a>
            <a href="#top-products" className="rounded-sm transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200">Top products</a>
            <a href="#compare" className="rounded-sm transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200">Compare</a>
            <a href="#marketplace" className="rounded-sm transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200">Marketplace</a>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link to="/track"><Button variant="ghost" size="sm" className="rounded-full font-bold">Track order</Button></Link>
            <Link to={customerPath}>
              <Button variant="outline" size="sm" className="rounded-full border-slate-200 px-4 font-bold">
                {loading ? 'Account' : hasCustomerRole ? 'Buyer account' : 'Customer login'}
              </Button>
            </Link>
            <Link to={merchantPath}>
              <Button size="sm" className="rounded-full bg-slate-950 px-5 font-bold text-white hover:bg-slate-800">
                {isMerchant ? 'Seller dashboard' : 'Merchant login'}
              </Button>
            </Link>
          </div>

          <button type="button" className="rounded-full border border-slate-200 p-2 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 md:hidden" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-slate-200 bg-white p-4 md:hidden">
            <div className="mx-auto grid max-w-7xl gap-1">
              {[['Top shops', '#top-shops'], ['Top products', '#top-products'], ['Compare', '#compare'], ['Marketplace', '#marketplace']].map(([label, href]) => (
                <a key={href} href={href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">{label}</a>
              ))}
              <Link to="/track" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">Track order</Link>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link to={customerPath} onClick={() => setOpen(false)}><Button variant="outline" className="w-full rounded-xl">Customer</Button></Link>
                <Link to={merchantPath} onClick={() => setOpen(false)}><Button className="w-full rounded-xl bg-slate-950">Merchant</Button></Link>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  )
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.025em] text-slate-950 sm:text-3xl lg:text-[2.35rem]">{title}</h2>
        {description && <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">{description}</p>}
      </div>
      {action}
    </div>
  )
}

function ShopCard({ shop }) {
  const rating = number(shop.average_rating)
  const sold = number(shop.sold_quantity || shop.order_count)

  return (
    <Link
      to="/shop/$storeSlug"
      params={{ storeSlug: shop.subdomain }}
      className="group relative flex h-full min-h-[150px] flex-col overflow-hidden rounded-[1rem] border border-slate-200 bg-white p-2.5 shadow-[0_12px_30px_-24px_rgba(15,23,42,.4)] transition-colors duration-300 hover:border-slate-300 hover:shadow-[0_18px_42px_-26px_rgba(15,23,42,.35)] sm:min-h-[230px] sm:rounded-[1.15rem] sm:p-4"
    >
      <span className="absolute right-2 top-2 rounded-full border border-slate-200 bg-white/95 px-1.5 py-0.5 text-[8px] font-black text-slate-600 shadow-sm backdrop-blur sm:right-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[10px]">
        #{number(shop.rank) || '—'}
      </span>

      <div className="flex min-w-0 flex-col items-center text-center sm:items-start sm:text-left">
        {shop.logo_url ? (
          <img src={shop.logo_url} alt={shop.shop_name} className="h-9 w-9 rounded-xl border border-slate-200 object-cover shadow-sm sm:h-12 sm:w-12" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white sm:h-12 sm:w-12 sm:text-base">
            {String(shop.shop_name || 'S').charAt(0)}
          </span>
        )}
        <p className="mt-2 line-clamp-2 w-full text-[11px] font-black leading-4 text-slate-950 sm:mt-3 sm:truncate sm:text-[15px]">{shop.shop_name}</p>
        <p className="mt-0.5 hidden w-full truncate text-[11px] font-semibold text-slate-400 sm:block">{shop.business_category || 'Marketplace shop'}</p>
      </div>

      <p className="mt-3 hidden line-clamp-2 min-h-10 text-sm leading-6 text-slate-500 sm:block">{shop.tagline || 'Independent products from a verified BazarHQ storefront.'}</p>

      <div className="mt-auto grid grid-cols-2 gap-1 border-t border-slate-100 pt-2 text-center sm:grid-cols-3 sm:gap-2 sm:pt-4">
        <div><p className="text-[11px] font-black text-slate-950 sm:text-sm">{compact(shop.product_count)}</p><p className="mt-0.5 text-[7px] font-bold uppercase tracking-wide text-slate-400 sm:text-[9px]">Products</p></div>
        <div className="hidden sm:block"><p className="text-sm font-black text-slate-950">{compact(sold)}</p><p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">Sold</p></div>
        <div><p className="inline-flex items-center gap-0.5 text-[11px] font-black text-slate-950 sm:gap-1 sm:text-sm"><Star className="h-2.5 w-2.5 fill-current text-amber-400 sm:h-3 sm:w-3" /> {rating ? rating.toFixed(1) : 'New'}</p><p className="mt-0.5 text-[7px] font-bold uppercase tracking-wide text-slate-400 sm:text-[9px]">Rating</p></div>
      </div>

      <div className="mt-2 flex items-center justify-center text-[9px] font-black text-slate-700 sm:mt-4 sm:justify-between sm:text-xs">
        <span className="hidden sm:inline">Visit storefront</span><ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      </div>
    </Link>
  )
}

function LoadingGrid({ count = 5, className = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' }) {
  return (
    <div className={`grid gap-3 sm:gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-[1.15rem] bg-slate-100" />)}
    </div>
  )
}


const CATEGORY_GROUPS = [
  { id: 'fashion', label: 'Fashion & Style', Icon: ShoppingBag, keywords: ['fashion', 'clothing', 'jewelry', 'jewellery', 'shoe', 'bag', 'watch', 'belt', 'wallet', 'handmade', 'boutique'] },
  { id: 'electronics', label: 'Electronics', Icon: Smartphone, keywords: ['electronic', 'computer', 'laptop', 'mobile', 'phone', 'gadget', 'accessories', 'camera', 'audio'] },
  { id: 'beauty', label: 'Beauty & Care', Icon: Sparkles, keywords: ['beauty', 'skin', 'hair', 'cosmetic', 'makeup', 'personal care', 'perfume'] },
  { id: 'home', label: 'Home & Living', Icon: Home, keywords: ['home', 'decor', 'furniture', 'kitchen', 'candle', 'crochet', 'knitting', 'garden'] },
  { id: 'food', label: 'Food & Grocery', Icon: Store, keywords: ['food', 'grocery', 'snack', 'drink', 'honey', 'organic'] },
  { id: 'general', label: 'More Categories', Icon: Menu, keywords: [] },
]

function categoryGroupFor(name) {
  const value = String(name || '').toLowerCase()
  return CATEGORY_GROUPS.find((group) => group.id !== 'general' && group.keywords.some((keyword) => value.includes(keyword))) || CATEGORY_GROUPS[CATEGORY_GROUPS.length - 1]
}

function HeroMarketplaceVisual({ products = [], loading = false }) {
  const reduceMotion = useReducedMotion()
  const uniqueProducts = []
  const seen = new Set()

  for (const product of products) {
    if (!product?.id || seen.has(product.id)) continue
    seen.add(product.id)
    uniqueProducts.push(product)
    if (uniqueProducts.length === 4) break
  }

  // Desktop positions intentionally keep only a small amount of visual overlap.
  // The cards remain layered without hiding product information from each other.
  const positions = [
    'lg:left-0 lg:top-10 lg:-rotate-[1.5deg]',
    'lg:right-0 lg:top-0 lg:rotate-[1.5deg]',
    'lg:left-8 lg:bottom-0 lg:rotate-[1deg]',
    'lg:right-4 lg:bottom-8 lg:-rotate-[1deg]',
  ]

  return (
    <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[2rem] lg:min-h-[440px] lg:max-w-none lg:overflow-visible" aria-label="Featured marketplace products">
      <div className="pointer-events-none absolute inset-x-10 top-12 hidden h-72 rounded-full bg-gradient-to-br from-indigo-300/25 via-violet-200/16 to-cyan-200/28 blur-3xl lg:block" aria-hidden="true" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 hidden h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/35 shadow-[0_30px_90px_-58px_rgba(79,70,229,.55)] backdrop-blur-sm lg:block" aria-hidden="true" />

      <div className="relative grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:block lg:min-h-[440px]">
        {loading && uniqueProducts.length === 0 ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={`h-[188px] animate-pulse rounded-2xl border border-white/90 bg-white/80 shadow-sm lg:absolute lg:z-10 lg:w-[194px] ${positions[index]}`} />
          ))
        ) : uniqueProducts.length > 0 ? uniqueProducts.map((product, index) => {
          const image = Array.isArray(product.images) ? product.images[0] : product.image_url
          const rating = number(product.average_rating)
          const shopVerified = Boolean(product.shop_verified || product.is_verified || product.store_verified)
          const storeSlug = product.store_slug || product.subdomain
          const productId = String(product.slug || product.id || '')
          const defaultLayer = ['z-10', 'z-20', 'z-30', 'z-40'][index] || 'z-10'

          return (
            <motion.article
              key={product.id}
              initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
              animate={reduceMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: [0, -4, 0], scale: 1 }}
              transition={reduceMotion ? { duration: 0 } : {
                opacity: { duration: 0.42, delay: 0.1 + index * 0.08, ease: 'easeOut' },
                scale: { duration: 0.42, delay: 0.1 + index * 0.08, ease: 'easeOut' },
                y: { duration: 6.4 + index * 0.55, delay: 0.65 + index * 0.16, repeat: Infinity, ease: 'easeInOut' },
              }}
              whileHover={reduceMotion ? { zIndex: 100 } : {
                y: -6,
                scale: 1.05,
                zIndex: 100,
                boxShadow: '0 34px 82px -34px rgba(79,70,229,.46)',
                transition: { duration: 0.24, ease: 'easeOut' },
              }}
              style={{ transformOrigin: 'center' }}
              className={`group relative min-w-0 overflow-hidden rounded-2xl border border-white/95 bg-white/95 p-2.5 shadow-[0_22px_58px_-34px_rgba(15,23,42,.42)] backdrop-blur will-change-transform transition-[border-color,box-shadow,opacity] duration-300 hover:border-indigo-300 hover:shadow-[0_30px_72px_-36px_rgba(79,70,229,.34)] focus-within:border-indigo-400 focus-within:shadow-[0_34px_82px_-34px_rgba(79,70,229,.46)] motion-reduce:transform-none motion-reduce:transition-none lg:absolute lg:w-[194px] ${defaultLayer} focus-within:z-[100] ${positions[index]}`}
            >
              {storeSlug && productId && (
                <Link
                  to="/shop/$storeSlug/product/$productId"
                  params={{ storeSlug, productId }}
                  aria-label={`View ${product.title || 'marketplace product'} from ${product.shop_name || 'BazarHQ shop'}`}
                  className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200/90"
                />
              )}
              <div className="aspect-[4/3] overflow-hidden rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-2">
                {image ? (
                  <img src={image} alt={product.title || 'Marketplace product'} className="h-full w-full object-contain object-center transition-transform duration-500 ease-out group-hover:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 text-slate-300"><ShoppingBag className="h-8 w-8" /></div>
                )}
              </div>
              <div className="px-0.5 pb-0.5 pt-2.5">
                <p className="line-clamp-1 text-[11px] font-black leading-4 text-slate-950 sm:text-xs">{product.title || 'Marketplace product'}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-[12px] font-black tabular-nums text-indigo-700">৳{number(product.price).toLocaleString('en-BD')}</p>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-slate-600"><Star className="h-3 w-3 fill-current text-amber-400" />{rating ? rating.toFixed(1) : 'New'}</span>
                </div>
                <p className="mt-1.5 flex min-w-0 items-center gap-1 truncate text-[9px] font-bold text-slate-500">
                  {shopVerified && <BadgeCheck className="h-3 w-3 shrink-0 text-indigo-600" />}
                  <span className="truncate">{product.shop_name || 'BazarHQ shop'}</span>
                </p>
              </div>
            </motion.article>
          )
        }) : (
          <div className="col-span-2 rounded-2xl border border-dashed border-indigo-200 bg-white/70 px-5 py-8 text-center sm:col-span-4 lg:absolute lg:inset-x-8 lg:top-28">
            <ShoppingBag className="mx-auto h-7 w-7 text-indigo-400" />
            <p className="mt-3 text-sm font-black text-slate-800">Published marketplace products will appear here.</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">This visual uses the existing live marketplace catalog—no fake products or prices.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function MobileBottomNav({ customerPath, compareCount, onHome, onCategories, onCompare }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[70] border-t border-slate-200 bg-white/96 px-2 pb-[max(.45rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-14px_34px_-24px_rgba(15,23,42,.35)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        <button type="button" onClick={onHome} className="flex flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-bold text-slate-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"><Home className="h-5 w-5" />Home</button>
        <button type="button" onClick={onCategories} className="flex flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-bold text-slate-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"><Store className="h-5 w-5" />Categories</button>
        <button type="button" onClick={onCompare} className="relative flex flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-bold text-slate-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"><Scale className="h-5 w-5" />Compare{compareCount > 0 && <span className="absolute right-[22%] top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-950 px-1 text-[8px] font-black text-white">{compareCount}</span>}</button>
        <Link to="/track" className="flex flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-bold text-slate-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"><ShoppingBag className="h-5 w-5" />Orders</Link>
        <Link to={customerPath} className="flex flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-bold text-slate-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"><Users className="h-5 w-5" />Account</Link>
      </div>
    </nav>
  )
}

function CompareTray({ items, notice, onRemove, onClear, onOpen }) {
  if (!items.length) return null
  return (
    <div className="fixed inset-x-3 bottom-20 z-[65] mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white/96 p-3 shadow-[0_22px_70px_-30px_rgba(15,23,42,.45)] backdrop-blur-xl md:bottom-6 md:p-4">
      <div className="flex items-center gap-3">
        <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white sm:flex"><Scale className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-slate-950">Selected for comparison ({items.length}/4)</p>
          <div className="mt-1 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => onRemove(item)} className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:border-rose-200 hover:text-rose-600">{item.title} ×</button>
            ))}
          </div>
          {notice && <p className="mt-1 text-[10px] font-semibold text-amber-700">{notice}</p>}
        </div>
        <button type="button" onClick={onClear} className="hidden text-xs font-bold text-slate-500 hover:text-slate-950 sm:block">Clear</button>
        <Button type="button" onClick={onOpen} className="h-10 shrink-0 rounded-xl bg-slate-950 px-4 text-xs font-black text-white hover:bg-slate-800">Review</Button>
      </div>
    </div>
  )
}

function SocialButton({ link }) {
  const isPlaceholder = link.href === '#'
  const Icon = link.Icon
  const icon = (
    <span className="group/social flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/8 text-slate-200 shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:border-white/25 hover:bg-white/14 hover:text-white hover:shadow-[0_16px_34px_rgba(15,23,42,0.32)]">
      <Icon className="h-5 w-5 transition-transform duration-200 group-hover/social:scale-110" />
    </span>
  )

  if (isPlaceholder) {
    return <span title={`${link.label} link not added yet`} aria-label={link.label} className="opacity-55">{icon}</span>
  }

  return (
    <a
      href={link.href}
      target={link.href.startsWith('mailto:') ? undefined : '_blank'}
      rel={link.href.startsWith('mailto:') ? undefined : 'noreferrer'}
      aria-label={link.label}
      title={link.label}
      className="inline-flex"
    >
      {icon}
    </a>
  )
}

const footerGroups = [
  {
    title: 'Marketplace',
    links: [
      { label: 'Explore products', href: '#marketplace' },
      { label: 'Top shops', href: '#top-shops' },
      { label: 'Top products', href: '#top-products' },
      { label: 'Compare prices', href: '#compare' },
      { label: 'Mobile app', href: APK_DOWNLOAD_URL },
    ],
  },
  {
    title: 'Access',
    links: [
      { label: 'Merchant login', href: '/login' },
      { label: 'Create merchant account', href: '/signup' },
      { label: 'Customer login', href: '/customer/login' },
      { label: 'Track order', href: '/track' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'Start selling', href: '/signup' },
      { label: 'Buyer account', href: '/customer/account' },
      { label: 'Seller dashboard', href: '/merchant' },
      { label: 'Support email', href: `mailto:${SUPPORT_EMAIL}?subject=BazarHQ%20Support` },
    ],
  },
]

function Footer() {
  const quickLinks = [
    { label: 'Download app', href: APK_DOWNLOAD_URL },
    { label: 'Support', href: `mailto:${SUPPORT_EMAIL}?subject=BazarHQ%20Support` },
    { label: 'Contact', href: `mailto:${SUPPORT_EMAIL}?subject=BazarHQ%20Support` },
    { label: '.', href: '/superadmin/login' },
  ]

  return (
    <footer className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_34%)]" />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 sm:pb-12 sm:pt-20 lg:px-8 lg:pb-14 lg:pt-24">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_2fr] lg:items-start">
          <div>
            <Logo size="lg" className="text-white" />
            <p className="mt-6 max-w-md text-sm leading-7 text-slate-300">
              A modern Bangladesh-focused marketplace where customers discover and compare products, while merchants launch storefronts, accept local payments, and manage orders from one platform.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Secure accounts', 'Local payments', 'Multi-store marketplace'].map((label) => (
                <span key={label} className="rounded-full border border-white/10 bg-white/7 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur">
                  {label}
                </span>
              ))}
            </div>

            <div className="mt-8">
              <p className="text-sm font-semibold text-white">Connect with us</p>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=BazarHQ%20Support`}
                className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-200 transition-colors hover:text-white"
              >
                <Mail className="h-4 w-4 text-indigo-400" />
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>

          <div className="space-y-10">
            <div className="grid gap-8 sm:grid-cols-3 lg:pt-1">
              {footerGroups.map((group) => (
                <div key={group.title}>
                  <div className="mb-4 text-sm font-semibold text-white">{group.title}</div>
                  <ul className="space-y-3 text-sm text-slate-400">
                    {group.links.map((link) => (
                      <li key={link.label}>
                        <a href={link.href} className="group inline-flex items-center gap-1.5 transition-colors hover:text-white">
                          {link.label}
                          {link.href.startsWith('http') || link.href.startsWith('mailto:') ? (
                            <ExternalLink className="h-3 w-3 opacity-60 transition-transform group-hover:translate-x-0.5" />
                          ) : null}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="pt-1">
              <p className="mb-4 text-sm font-semibold text-white">Follow BazarHQ</p>
              <div className="flex flex-wrap gap-3">
                {socialLinks.map((link) => <SocialButton key={link.label} link={link} />)}
              </div>
            </div>
          </div>
        </div>

        <hr className="my-10 border-white/10" />
        <div className="flex flex-col gap-3 text-xs text-slate-500 lg:flex-row lg:items-end lg:justify-between">
          <div className="leading-6">
            <p className="font-semibold text-slate-300">© {new Date().getFullYear()} BazarHQ. All rights reserved.</p>
            <p className="mt-1 max-w-xl">Designed and maintained by SoftThinkers (CSE-15 BRUR) for modern online commerce in Bangladesh.</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 font-medium text-slate-400 lg:justify-end">
            {quickLinks.map((link) => (
              <a key={link.label} href={link.href} className="transition-colors hover:text-white">{link.label}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default function MarketplaceLandingPage() {
  const reduceMotion = useReducedMotion()
  const [draftSearch, setDraftSearch] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [activeCategoryGroup, setActiveCategoryGroup] = useState('')
  const [compareItems, setCompareItems] = useState([])
  const [compareNotice, setCompareNotice] = useState('')
  const [resultsPulse, setResultsPulse] = useState(false)
  const [showMoreTopProducts, setShowMoreTopProducts] = useState(false)

  const marketplaceQuery = useQuery({
    queryKey: ['marketplace-home', search, category],
    queryFn: () => fetchMarketplaceHome({ search, category, limit: 30 }),
    staleTime: 1000 * 60 * 2,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
    refetchInterval: compareItems.length ? 15000 : false,
    refetchIntervalInBackground: false,
  })

  const data = marketplaceQuery.data || {
    metrics: { shops: 0, products: 0, orders: 0, categories: 0 },
    categories: [], top_shops: [], top_products: [], products: [], comparisons: [],
  }

  const { rawUser, isMerchant, hasCustomerRole } = useAuth()
  const customerAccessPath = hasCustomerRole ? '/customer/account' : rawUser ? '/customer/signup' : '/customer/login'
  const merchantAccessPath = isMerchant ? '/merchant' : '/login'

  const categoryGroups = useMemo(() => {
    const grouped = new Map(CATEGORY_GROUPS.map((group) => [group.id, { ...group, items: [] }]))
    for (const item of data.categories || []) {
      const name = typeof item === 'string' ? item : item?.name
      if (!name) continue
      const group = categoryGroupFor(name)
      grouped.get(group.id).items.push({ name, count: number(item?.count) })
    }
    return CATEGORY_GROUPS.map((group) => grouped.get(group.id))
  }, [data.categories])

  const activeGroup = categoryGroups.find((group) => group.id === activeCategoryGroup) || null

  const liveProducts = useMemo(() => {
    const map = new Map()
    for (const product of [...(data.products || []), ...(data.top_products || []), ...(data.comparisons || [])]) {
      if (product?.id) map.set(product.id, product)
    }
    return map
  }, [data.products, data.top_products, data.comparisons])

  useEffect(() => {
    if (!compareItems.length || !liveProducts.size) return
    setCompareItems((current) => current.map((item) => liveProducts.get(item.id) || item))
  }, [liveProducts])

  function smoothTo(id, offset = 84) {
    window.setTimeout(() => {
      const element = document.getElementById(id)
      if (!element) return
      const top = element.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' })
      if (id === 'marketplace') {
        setResultsPulse(true)
        window.setTimeout(() => setResultsPulse(false), 850)
      }
    }, 120)
  }

  function submitSearch(event) {
    event?.preventDefault()
    setSearch(draftSearch.trim())
    smoothTo('marketplace')
  }

  function toggleCategoryGroup(groupId) {
    setActiveCategoryGroup((current) => current === groupId ? '' : groupId)
  }

  function selectSubcategory(name) {
    setCategory((current) => current === name ? '' : name)
    smoothTo('marketplace')
  }

  function toggleCompare(product) {
    setCompareNotice('')
    setCompareItems((current) => {
      const exists = current.some((item) => item.id === product.id)
      if (exists) return current.filter((item) => item.id !== product.id)
      if (current.length >= 4) {
        setCompareNotice('You can compare up to four products at a time.')
        return current
      }
      return [...current, liveProducts.get(product.id) || product]
    })
  }

  function isCompared(product) {
    return compareItems.some((item) => item.id === product.id)
  }

  const compareProps = (product) => ({
    onCompare: toggleCompare,
    isCompared: isCompared(product),
  })

  const lowestComparePrice = compareItems.length ? Math.min(...compareItems.map((item) => number(item.price)).filter((value) => value > 0)) : 0
  const highestCompareRating = compareItems.length ? Math.max(...compareItems.map((item) => number(item.average_rating))) : 0
  const compareUpdatedAt = marketplaceQuery.dataUpdatedAt ? new Date(marketplaceQuery.dataUpdatedAt) : null
  const sectionReveal = reduceMotion ? { initial: false, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0 } } : fadeUp

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 text-slate-950 md:pb-0">
      <MarketplaceNav />

      <main>
        <section className="relative overflow-hidden border-b border-indigo-100 bg-[#f6f7ff]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(99,102,241,.20),transparent_28%),radial-gradient(circle_at_92%_12%,rgba(6,182,212,.14),transparent_25%),linear-gradient(115deg,#f8f7ff_0%,#f4f8ff_48%,#effcff_100%)]" />
          <div className="absolute -left-28 bottom-[-10rem] h-72 w-72 rounded-full bg-indigo-300/18 blur-3xl" />
          <div className="absolute -right-20 top-[-8rem] h-72 w-72 rounded-full bg-cyan-300/18 blur-3xl" />

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.55, ease: 'easeOut' }}
            className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12"
          >
            <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(390px,.85fr)] lg:gap-8 xl:gap-10">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/76 px-4 py-2 text-[10px] font-black uppercase tracking-[0.19em] text-indigo-700 shadow-sm backdrop-blur sm:text-[11px]">
                  <Sparkles className="h-3.5 w-3.5" /> Bangladesh multi-store marketplace
                </p>

                <h1 className="mt-5 max-w-4xl text-[2.55rem] font-black leading-[.99] tracking-[-0.055em] text-slate-950 sm:text-[3.45rem] lg:text-[4rem] xl:text-[4.45rem]">
                  Discover <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">better products</span> from trusted shops.
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base lg:text-[17px]">
                  Search, compare, and shop from trusted independent stores across Bangladesh—all in one marketplace.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Link
                    to={customerAccessPath}
                    aria-label="Open buyer account"
                    className="group flex min-h-[68px] items-center justify-between rounded-2xl border border-indigo-600 bg-indigo-600 px-4 py-3.5 text-white shadow-[0_18px_44px_-26px_rgba(79,70,229,.58)] transition-[transform,background-color,border-color,box-shadow] duration-[250ms] ease-out hover:-translate-y-0.5 hover:border-indigo-700 hover:bg-indigo-700 hover:shadow-[0_24px_52px_-26px_rgba(67,56,202,.68)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 motion-reduce:transform-none motion-reduce:transition-none sm:px-5"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/14 text-white transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"><Users className="h-5 w-5" /></span>
                      <span className="min-w-0"><span className="block text-sm font-black text-white">Open buyer account</span><span className="mt-0.5 block truncate text-xs font-semibold text-indigo-100">Browse, order and track purchases</span></span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-indigo-100 transition-transform group-hover:translate-x-1 motion-reduce:transform-none" />
                  </Link>

                  <Link
                    to={merchantAccessPath}
                    aria-label="Open seller dashboard"
                    className="group flex min-h-[68px] items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-950 shadow-[0_14px_34px_-28px_rgba(15,23,42,.3)] transition-[transform,background-color,border-color,box-shadow] duration-[250ms] ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-[0_20px_44px_-28px_rgba(15,23,42,.38)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 motion-reduce:transform-none motion-reduce:transition-none sm:px-5"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 transition-[transform,background-color,border-color] duration-[250ms] group-hover:scale-[1.03] group-hover:border-slate-300 group-hover:bg-white motion-reduce:transform-none motion-reduce:transition-none"><Store className="h-5 w-5" /></span>
                      <span className="min-w-0"><span className="block text-sm font-black text-slate-950">Open seller dashboard</span><span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">Create and manage your storefront</span></span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-[transform,color] duration-[250ms] group-hover:translate-x-1 group-hover:text-slate-700 motion-reduce:transform-none" />
                  </Link>
                </div>

                <form onSubmit={submitSearch} role="search" className="mt-4 rounded-[1.35rem] border border-white/95 bg-white/90 p-2 shadow-[0_24px_65px_-42px_rgba(15,23,42,.38)] backdrop-blur sm:p-2.5">
                  <div className="flex items-center gap-2">
                    <label className="relative min-w-0 flex-1">
                      <span className="sr-only">Search marketplace</span>
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-5 sm:h-5 sm:w-5" />
                      <input
                        value={draftSearch}
                        onChange={(event) => setDraftSearch(event.target.value)}
                        placeholder="Search products, categories, or shops"
                        aria-label="Search products, categories, or shops"
                        className="h-12 w-full min-w-0 rounded-[1rem] border border-transparent bg-slate-50/90 pl-10 pr-3 text-[12px] font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-200 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 sm:h-[54px] sm:rounded-2xl sm:pl-12 sm:pr-4 sm:text-sm"
                      />
                    </label>
                    <Button type="submit" className="group h-12 shrink-0 rounded-[1rem] bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-xs font-black text-white shadow-[0_16px_34px_-18px_rgba(79,70,229,.65)] transition-all duration-300 hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700 hover:shadow-[0_20px_42px_-20px_rgba(79,70,229,.72)] active:translate-y-0 focus-visible:ring-4 focus-visible:ring-indigo-200 motion-reduce:transform-none motion-reduce:transition-none sm:h-[54px] sm:rounded-2xl sm:px-7 sm:text-sm">
                      <span className="sm:hidden">Search</span>
                      <span className="hidden sm:inline">Search marketplace</span>
                      <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none sm:ml-2" />
                    </Button>
                  </div>
                </form>
              </div>

              <div className="min-w-0 lg:pl-2">
                <HeroMarketplaceVisual products={[...(data.top_products || []), ...(data.products || [])]} loading={marketplaceQuery.isLoading} />
              </div>
            </div>

            <div id="category-explorer" className="mt-5 scroll-mt-24 sm:mt-6">
              <nav aria-label="Marketplace categories" className="flex gap-x-5 gap-y-1 overflow-x-auto whitespace-nowrap border-b border-indigo-100/80 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:overflow-visible sm:whitespace-normal lg:grid-cols-6">
                {categoryGroups.map((group) => {
                  const Icon = group.Icon
                  const active = activeCategoryGroup === group.id
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => toggleCategoryGroup(group.id)}
                      aria-pressed={active}
                      className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 border-b-2 px-1 py-2 text-[10px] font-black outline-none transition-[color,border-color,transform] duration-200 focus-visible:rounded-sm focus-visible:ring-4 focus-visible:ring-indigo-100 motion-reduce:transform-none motion-reduce:transition-none sm:min-h-11 sm:text-xs ${active ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:border-indigo-200 hover:text-indigo-700'}`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {group.label}
                    </button>
                  )
                })}
              </nav>

              <AnimatePresence initial={false}>
                {activeGroup && (
                  <motion.div
                    key={activeGroup.id}
                    initial={reduceMotion ? false : { opacity: 0, height: 0, y: -3 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -3 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-x-4 gap-y-1 overflow-x-auto pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
                      <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.12em] text-slate-400 sm:text-[10px]">{activeGroup.label}</span>
                      {activeGroup.items.length ? activeGroup.items.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => selectSubcategory(item.name)}
                          aria-pressed={category === item.name}
                          className={`shrink-0 border-b px-0.5 py-1.5 text-[10px] font-bold outline-none transition-colors duration-200 focus-visible:rounded-sm focus-visible:ring-4 focus-visible:ring-indigo-100 sm:text-[11px] ${category === item.name ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-indigo-700'}`}
                        >
                          {item.name}{item.count ? ` · ${item.count}` : ''}
                        </button>
                      )) : <p className="py-1.5 text-xs font-semibold text-slate-500">No published subcategories are available in this group yet.</p>}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold leading-5 text-slate-500 sm:justify-start sm:text-xs">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden="true" />
                <span><span className="font-black text-indigo-700">Newly launched</span> · Growing every day with new shops and products.</span>
              </p>
            </div>
          </motion.div>
        </section>

        <section id="top-shops" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
          <motion.div {...sectionReveal}>
            <SectionHeading eyebrow="Trusted sellers" title="Top shops" description="Independent storefronts ranked from marketplace activity, product quality and verified customer feedback." action={<a href="#marketplace" className="group inline-flex items-center gap-2 rounded-sm text-sm font-black text-slate-700 transition hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">Browse products <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" /></a>} />
            <div className="mt-5">
              {marketplaceQuery.isLoading && !data.top_shops.length ? (
                <div className="grid auto-cols-[44%] grid-flow-col grid-rows-1 gap-2 overflow-x-auto pb-3 [scrollbar-width:thin] sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-3 sm:overflow-visible md:grid-cols-4 xl:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-56 animate-pulse rounded-[1.15rem] bg-slate-100" />)}
                </div>
              ) : data.top_shops.length ? (
                <div className="grid auto-cols-[44%] grid-flow-col grid-rows-1 gap-2 overflow-x-auto pb-3 [scrollbar-width:thin] sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-3 sm:overflow-visible md:grid-cols-4 xl:grid-cols-5">
                  {data.top_shops.slice(0, 10).map((shop) => <ShopCard key={shop.id} shop={shop} />)}
                </div>
              ) : !marketplaceQuery.error && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-6 text-center">
                  <Store className="mx-auto h-6 w-6 text-slate-300" />
                  <p className="mt-2 text-sm font-black text-slate-800">Top shops will appear as marketplace activity grows.</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Published storefronts remain available through the marketplace catalog.</p>
                </div>
              )}
            </div>
          </motion.div>
        </section>

        <section id="top-products" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
            <motion.div {...sectionReveal}>
              <SectionHeading eyebrow="Marketplace ranking" title="Top products" description="Popular products ranked from real sales, product views and approved customer reviews." action={!marketplaceQuery.isLoading && data.top_products.length > 0 ? <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-black text-slate-600"><Trophy className="h-3.5 w-3.5" /> Live ranking</span> : null} />
              <div className="mt-5">
                {marketplaceQuery.isLoading && !data.top_products.length ? <LoadingGrid count={5} /> : data.top_products.length ? (
                  <>
                    <motion.div layout className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {data.top_products
                        .slice(0, showMoreTopProducts ? Math.min(data.top_products.length, 20) : 5)
                        .map((product) => (
                          <MarketplaceProductCard key={product.id} product={product} {...compareProps(product)} />
                        ))}
                    </motion.div>

                    {data.top_products.length > 5 && (
                      <div className="mt-6 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setShowMoreTopProducts((current) => !current)}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 motion-reduce:transform-none motion-reduce:transition-none"
                          aria-expanded={showMoreTopProducts}
                        >
                          {showMoreTopProducts ? 'Show fewer products' : `More top products (${Math.min(data.top_products.length - 5, 15)})`}
                          <ChevronRight className={`h-4 w-4 transition-transform duration-300 motion-reduce:transform-none ${showMoreTopProducts ? '-rotate-90' : 'rotate-90'}`} />
                        </button>
                      </div>
                    )}
                  </>
                ) : !marketplaceQuery.error && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-center">
                    <Trophy className="mx-auto h-6 w-6 text-slate-300" />
                    <p className="mt-2 text-sm font-black text-slate-800">Ranked products will appear once enough activity is available.</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">You can still browse every published product in the marketplace below.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        <section id="compare" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-8 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
          <motion.div {...sectionReveal}>
            <SectionHeading
              eyebrow="Live comparison"
              title="Compare current product data"
              description="Select up to four products. Prices, stock and ratings refresh automatically every 15 seconds while comparison is active."
              action={compareItems.length > 0 ? (
                <button type="button" onClick={() => marketplaceQuery.refetch()} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">
                  <RefreshCw className={`h-3.5 w-3.5 ${marketplaceQuery.isFetching ? 'animate-spin' : ''}`} /> Refresh now
                </button>
              ) : null}
            />

            {compareItems.length > 0 ? (
              <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_24px_70px_-44px_rgba(15,23,42,.44)]">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-950">Real-time comparison ({compareItems.length}/4)</p>
                    <p className="mt-1 text-xs text-slate-500">Last synced {compareUpdatedAt ? compareUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'just now'} · auto refresh every 15 seconds</p>
                  </div>
                  <button type="button" onClick={() => setCompareItems([])} className="rounded-sm text-xs font-bold text-slate-500 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100">Clear comparison</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        <th className="w-40 px-5 py-4">Compare field</th>
                        {compareItems.map((product) => (
                          <th key={`head-${product.id}`} className="min-w-[190px] px-4 py-4 align-top">
                            <div className="flex items-start gap-3">
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">{(Array.isArray(product.images) ? product.images[0] : product.image_url) ? <img src={Array.isArray(product.images) ? product.images[0] : product.image_url} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="m-3 h-6 w-6 text-slate-300" />}</div>
                              <div className="min-w-0 flex-1"><p className="line-clamp-2 normal-case tracking-normal text-xs font-black text-slate-950">{product.title}</p><p className="mt-1 truncate normal-case tracking-normal text-[10px] font-semibold text-slate-500">{product.shop_name || 'BazarHQ shop'}</p></div>
                              <button type="button" onClick={() => toggleCompare(product)} className="rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100" aria-label="Remove product"><X className="h-4 w-4" /></button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr><th className="px-5 py-4 text-xs font-black text-slate-500">Current price</th>{compareItems.map((product) => <td key={`price-${product.id}`} className={`px-4 py-4 text-base font-black ${number(product.price) === lowestComparePrice ? 'bg-emerald-50 text-emerald-700' : 'text-slate-950'}`}>৳{number(product.price).toLocaleString('en-BD')}</td>)}</tr>
                      <tr><th className="px-5 py-4 text-xs font-black text-slate-500">Rating</th>{compareItems.map((product) => <td key={`rating-${product.id}`} className={`px-4 py-4 font-bold ${number(product.average_rating) === highestCompareRating && highestCompareRating > 0 ? 'bg-amber-50 text-amber-700' : 'text-slate-700'}`}><span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-current text-amber-400" /> {number(product.average_rating) ? number(product.average_rating).toFixed(1) : 'New'}</span></td>)}</tr>
                      <tr><th className="px-5 py-4 text-xs font-black text-slate-500">Availability</th>{compareItems.map((product) => <td key={`stock-${product.id}`} className="px-4 py-4 font-bold text-slate-700">{number(product.stock) > 0 ? `${number(product.stock)} in stock` : 'Out of stock'}</td>)}</tr>
                      <tr><th className="px-5 py-4 text-xs font-black text-slate-500">Sold</th>{compareItems.map((product) => <td key={`sold-${product.id}`} className="px-4 py-4 font-bold text-slate-700">{number(product.sold_quantity).toLocaleString('en-BD')}</td>)}</tr>
                      <tr><th className="px-5 py-4 text-xs font-black text-slate-500">Category</th>{compareItems.map((product) => <td key={`category-${product.id}`} className="px-4 py-4 font-semibold text-slate-600">{product.category || 'General'}</td>)}</tr>
                      <tr><th className="px-5 py-4 text-xs font-black text-slate-500">Open product</th>{compareItems.map((product) => <td key={`link-${product.id}`} className="px-4 py-4"><Link to="/shop/$storeSlug/product/$productId" params={{ storeSlug: product.store_slug || product.subdomain, productId: String(product.slug || product.id) }} className="inline-flex items-center gap-1 rounded-sm text-xs font-black text-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">View details <ChevronRight className="h-3.5 w-3.5" /></Link></td>)}</tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/35 px-4 py-3.5 text-xs font-semibold leading-5 text-slate-600 sm:text-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm"><Scale className="h-4 w-4" /></span>
                <p>Select the scale icon on any product card to compare live price, stock and rating data.</p>
              </div>
            )}

            {data.comparisons.length > 0 && (
              <div className="mt-7">
                <div className="mb-4"><p className="text-sm font-black text-slate-950">Automatic cross-shop matches</p><p className="mt-1 text-xs text-slate-500">Products with current marketplace price alternatives.</p></div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {data.comparisons.slice(0, 10).map((product) => <MarketplaceProductCard key={`compare-${product.id}`} product={product} comparison {...compareProps(product)} />)}
                </div>
              </div>
            )}
          </motion.div>
        </section>

        <section id="marketplace" className={`scroll-mt-28 border-y border-slate-200 bg-white transition-shadow duration-700 ${resultsPulse ? 'shadow-[inset_0_0_0_3px_rgba(99,102,241,.14)]' : ''}`}>
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
            <SectionHeading eyebrow="All marketplace products" title={search || category ? 'Search results' : 'Explore the marketplace'} description={search || category ? `Showing products${search ? ` matching “${search}”` : ''}${category ? ` in ${category}` : ''}.` : 'Browse active products from every published BazarHQ storefront.'} action={(search || category) && <Button variant="outline" className="rounded-full" onClick={() => { setDraftSearch(''); setSearch(''); setCategory('') }}>Clear search</Button>} />
            {marketplaceQuery.error && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{marketplaceQuery.error.message}</div>}
            <div className="mt-5">
              {marketplaceQuery.isFetching && !data.products.length ? <LoadingGrid count={10} /> : data.products.length ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {data.products.map((product) => <MarketplaceProductCard key={`market-${product.id}`} product={product} comparison {...compareProps(product)} />)}
                </div>
              ) : !marketplaceQuery.error && (
                <div className="rounded-[1.15rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center sm:py-10"><Search className="mx-auto h-9 w-9 text-slate-300" /><h3 className="mt-4 text-lg font-black">No matching products</h3><p className="mt-2 text-sm text-slate-500">Try another keyword or clear the selected category.</p></div>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
          <motion.div {...sectionReveal} className="grid overflow-hidden rounded-[1.4rem] border border-slate-200 bg-[#eef2f7] lg:grid-cols-[1.15fr_.85fr]">
            <div className="p-6 sm:p-8 lg:p-10"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">One verified account</p><h2 className="mt-3 max-w-xl text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">Buy from any shop. Build your own storefront.</h2><p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">Use one BazarHQ identity for customer purchases and merchant operations, while keeping orders and store management clearly organized.</p><div className="mt-5 flex flex-wrap gap-3"><Link to={customerAccessPath}><Button className="h-11 rounded-full bg-slate-950 px-5 font-bold text-white hover:bg-slate-800"><ShoppingBag className="mr-2 h-4 w-4" /> {hasCustomerRole ? 'Open buyer account' : 'Create buyer access'}</Button></Link><Link to="/signup"><Button variant="outline" className="h-11 rounded-full border-slate-300 bg-transparent px-5 font-bold"><Store className="mr-2 h-4 w-4" /> Open a shop</Button></Link></div></div>
            <div className="grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 lg:border-l lg:border-t-0">{[[Users, 'One identity', 'Customer and merchant access under one verified account.'], [BarChart3, 'Real rankings', 'Marketplace visibility shaped by real activity.'], [BadgeCheck, 'Published shops', 'Only active storefronts appear publicly.'], [ShieldCheck, 'Private data', 'Credentials and merchant revenue remain protected.']].map(([Icon, title, text]) => <div key={title} className="bg-[#f8fafc] p-5 sm:p-6"><Icon className="h-5 w-5 text-slate-700" /><h3 className="mt-4 text-sm font-black text-slate-950">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{text}</p></div>)}</div>
          </motion.div>
        </section>
      </main>

      <Footer />
      <CompareTray items={compareItems} notice={compareNotice} onRemove={toggleCompare} onClear={() => setCompareItems([])} onOpen={() => smoothTo('compare')} />
      <MobileBottomNav customerPath={customerAccessPath} compareCount={compareItems.length} onHome={() => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })} onCategories={() => smoothTo('category-explorer')} onCompare={() => smoothTo('compare')} />
    </div>
  )
}
