import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Download,
  Menu,
  PackageSearch,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Store,
  TrendingUp,
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

function money(value) {
  return `৳${number(value).toLocaleString('en-BD', { maximumFractionDigits: 2 })}`
}

function MarketplaceNav() {
  const [open, setOpen] = useState(false)
  const { rawUser, isMerchant, hasCustomerRole, loading } = useAuth()

  const buyerPath = hasCustomerRole ? '/customer/account' : rawUser ? '/customer/signup' : '/customer/login'
  const sellerPath = isMerchant ? '/merchant' : '/signup'

  const links = [
    ['Marketplace', '#marketplace'],
    ['Top shops', '#top-shops'],
    ['Top products', '#top-products'],
    ['Compare prices', '#compare'],
  ]

  return (
    <>
      <div className="border-b border-emerald-200/70 bg-emerald-50 text-emerald-950">
        <div className="mx-auto flex min-h-10 max-w-7xl items-center justify-between gap-4 px-4 py-2 text-xs font-semibold sm:px-6 lg:px-8">
          <p className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-emerald-600" />
            Shop faster with the BazarHQ Android app.
          </p>
          <a
            href={APK_DOWNLOAD_URL}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 font-black text-white transition hover:-translate-y-0.5 hover:bg-emerald-700"
          >
            <Download className="h-3.5 w-3.5" /> Download APK
          </a>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-slate-200/75 bg-white/88 backdrop-blur-2xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="BazarHQ marketplace home"><Logo size="md" /></Link>

          <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-slate-50/80 p-1 lg:flex">
            {links.map(([label, href]) => (
              <a key={href} href={href} className="rounded-full px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-slate-950 hover:shadow-sm">
                {label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link to="/track">
              <Button variant="ghost" size="sm" className="rounded-full font-bold">Track order</Button>
            </Link>
            <Link to={buyerPath}>
              <Button variant="outline" size="sm" className="rounded-full border-slate-200 bg-white px-4 font-bold">
                {loading ? 'Account' : hasCustomerRole ? 'My purchases' : 'Shop as buyer'}
              </Button>
            </Link>
            <Link to={sellerPath}>
              <Button size="sm" className="rounded-full bg-slate-950 px-5 font-black text-white hover:bg-indigo-600">
                {isMerchant ? 'Seller dashboard' : 'Start selling'}
              </Button>
            </Link>
          </div>

          <button type="button" className="rounded-xl border border-slate-200 p-2 md:hidden" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-slate-200 bg-white p-4 md:hidden">
            <div className="mx-auto grid max-w-7xl gap-2">
              {links.map(([label, href]) => (
                <a key={href} href={href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">{label}</a>
              ))}
              <Link to="/track" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Track order</Link>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link to={buyerPath} onClick={() => setOpen(false)}><Button variant="outline" className="w-full rounded-xl">Buy</Button></Link>
                <Link to={sellerPath} onClick={() => setOpen(false)}><Button className="w-full rounded-xl bg-slate-950">Sell</Button></Link>
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
        <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">{title}</h2>
        {description && <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">{description}</p>}
      </div>
      {action}
    </div>
  )
}

function ShopCard({ shop }) {
  const rank = number(shop.rank)
  const rating = number(shop.average_rating)
  const orders = number(shop.order_count)
  const sold = number(shop.sold_quantity)

  return (
    <Link
      to="/shop/$storeSlug"
      params={{ storeSlug: shop.subdomain }}
      className="group relative overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,.45)] transition duration-500 hover:-translate-y-1.5 hover:border-indigo-200 hover:shadow-[0_30px_70px_-40px_rgba(79,70,229,.55)]"
    >
      <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[5rem] bg-gradient-to-br from-indigo-50 to-cyan-50 transition group-hover:scale-110" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {shop.logo_url ? (
            <img src={shop.logo_url} alt={shop.shop_name} className="h-14 w-14 shrink-0 rounded-2xl border border-slate-200 object-cover shadow-sm" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-white">{String(shop.shop_name || 'S').charAt(0)}</span>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-slate-950">{shop.shop_name}</p>
            <p className="truncate text-xs font-semibold text-slate-500">{shop.business_category || 'Marketplace shop'}</p>
          </div>
        </div>
        <span className="relative inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-slate-950 px-2 text-xs font-black text-white">#{rank || '—'}</span>
      </div>

      <p className="relative mt-4 line-clamp-2 min-h-10 text-sm leading-6 text-slate-600">{shop.tagline || 'Discover products from a verified BazarHQ seller.'}</p>

      <div className="relative mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-slate-50 p-3 text-center">
          <p className="text-base font-black text-slate-950">{compact(shop.product_count)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Products</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 text-center">
          <p className="text-base font-black text-slate-950">{compact(sold || orders)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Sold</p>
        </div>
        <div className="rounded-2xl bg-amber-50 p-3 text-center">
          <p className="inline-flex items-center gap-1 text-base font-black text-amber-700"><Star className="h-3.5 w-3.5 fill-current" /> {rating ? rating.toFixed(1) : 'New'}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-500">Rating</p>
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-between text-sm font-black text-indigo-600">
        Visit shop <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </div>
    </Link>
  )
}

function LoadingGrid({ count = 4 }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => <div key={index} className="h-96 animate-pulse rounded-[1.6rem] bg-slate-100" />)}
    </div>
  )
}

export default function MarketplaceLandingPage() {
  const [draftSearch, setDraftSearch] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  const marketplaceQuery = useQuery({
    queryKey: ['marketplace-home', search, category],
    queryFn: () => fetchMarketplaceHome({ search, category, limit: 12 }),
    staleTime: 1000 * 60 * 3,
    placeholderData: (previous) => previous,
    refetchOnWindowFocus: false,
  })

  const data = marketplaceQuery.data || {
    metrics: { shops: 0, products: 0, orders: 0, categories: 0 },
    categories: [], top_shops: [], top_products: [], products: [], comparisons: [],
  }

  const featuredComparison = data.comparisons?.[0] || data.top_products?.find((item) => number(item.comparison_count) > 1)
  const categoryNames = useMemo(() => data.categories.map((item) => item.name).filter(Boolean), [data.categories])

  function submitSearch(event) {
    event?.preventDefault()
    setSearch(draftSearch.trim())
    requestAnimationFrame(() => document.getElementById('marketplace')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function selectCategory(value) {
    setCategory((current) => current === value ? '' : value)
    requestAnimationFrame(() => document.getElementById('marketplace')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <MarketplaceNav />

      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(99,102,241,.16),transparent_32%),radial-gradient(circle_at_88%_20%,rgba(34,211,238,.14),transparent_28%),linear-gradient(180deg,#fff,#f8fafc)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-8 lg:py-24">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-indigo-700">
                <Sparkles className="h-4 w-4" /> Bangladesh multi-store marketplace
              </span>
              <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.04] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-7xl">
                Buy from many shops. <span className="bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-transparent">Sell from your own.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Find ranked products, discover trusted sellers, compare the same item across shops, and manage buyer and seller access with one BazarHQ account.
              </p>

              <form onSubmit={submitSearch} className="mt-8 flex max-w-2xl flex-col gap-3 rounded-[1.4rem] border border-slate-200 bg-white p-2 shadow-[0_22px_70px_-32px_rgba(79,70,229,.45)] sm:flex-row">
                <label className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={draftSearch}
                    onChange={(event) => setDraftSearch(event.target.value)}
                    placeholder="Search products, categories, or shops..."
                    className="h-13 w-full rounded-2xl bg-slate-50 pl-12 pr-4 text-sm font-semibold outline-none ring-indigo-100 transition focus:bg-white focus:ring-4"
                  />
                </label>
                <Button type="submit" className="h-13 rounded-2xl bg-slate-950 px-7 font-black text-white hover:bg-indigo-600">
                  Search marketplace <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>

              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={() => selectCategory('')} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${!category ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'}`}>All categories</button>
                {categoryNames.slice(0, 7).map((name) => (
                  <button key={name} onClick={() => selectCategory(name)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${category === name ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'}`}>{name}</button>
                ))}
              </div>

              <div className="mt-9 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [Store, data.metrics.shops, 'Live shops'],
                  [ShoppingBag, data.metrics.products, 'Products'],
                  [CheckCircle2, data.metrics.orders, 'Orders'],
                  [Boxes, data.metrics.categories, 'Categories'],
                ].map(([Icon, value, label]) => (
                  <div key={label} className="rounded-2xl border border-slate-200/80 bg-white/75 p-4 backdrop-blur">
                    <Icon className="h-4 w-4 text-indigo-600" />
                    <p className="mt-3 text-xl font-black">{marketplaceQuery.isLoading ? '—' : compact(value)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="relative">
              <div className="absolute -inset-8 rounded-full bg-gradient-to-br from-indigo-200/45 to-cyan-200/45 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2.2rem] border border-white/80 bg-slate-950 p-5 text-white shadow-[0_38px_100px_-42px_rgba(15,23,42,.85)] sm:p-7">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Smart shopping</p>
                    <h2 className="mt-2 text-2xl font-black">Compare before you buy</h2>
                  </div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><PackageSearch className="h-6 w-6" /></span>
                </div>

                {featuredComparison ? (
                  <div className="mt-7 rounded-[1.7rem] bg-white p-4 text-slate-950">
                    <div className="flex gap-4">
                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                        {(featuredComparison.images?.[0] || featuredComparison.image_url) ? <img src={featuredComparison.images?.[0] || featuredComparison.image_url} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="m-7 h-10 w-10 text-slate-300" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 font-black">{featuredComparison.title}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">Compared across {number(featuredComparison.comparison_count)} shops</p>
                        <div className="mt-3 flex items-end justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-slate-400">Best marketplace price</p>
                            <p className="text-xl font-black text-emerald-600">{money(featuredComparison.best_price)}</p>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">Save {money(featuredComparison.saving || number(featuredComparison.highest_price) - number(featuredComparison.best_price))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-7 rounded-[1.7rem] border border-white/10 bg-white/5 p-6 text-sm leading-7 text-slate-300">As merchants list matching products, BazarHQ automatically groups them so buyers can compare prices across shops.</div>
                )}

                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><ShieldCheck className="h-5 w-5 text-cyan-300" /><p className="mt-3 font-black">Verified storefronts</p><p className="mt-1 text-xs leading-5 text-slate-400">Only active, published shops appear.</p></div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><TrendingUp className="h-5 w-5 text-emerald-300" /><p className="mt-3 font-black">Data-driven ranks</p><p className="mt-1 text-xs leading-5 text-slate-400">Sales, reviews and views shape ranking.</p></div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="top-shops" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <motion.div {...fadeUp}>
            <SectionHeading eyebrow="Marketplace leaders" title="Top selling shops" description="Ranked from real marketplace activity, product performance, customer reviews and unique visitors—without exposing merchant financial data." action={<a href="#marketplace" className="inline-flex items-center gap-2 text-sm font-black text-indigo-600">Explore products <ChevronRight className="h-4 w-4" /></a>} />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {marketplaceQuery.isLoading && !data.top_shops.length
                ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-[1.7rem] bg-slate-100" />)
                : data.top_shops.map((shop) => <ShopCard key={shop.id} shop={shop} />)}
            </div>
            {!marketplaceQuery.isLoading && !data.top_shops.length && <div className="mt-8 rounded-[1.7rem] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Published shops will appear here after marketplace data is available.</div>}
          </motion.div>
        </section>

        <section id="top-products" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <motion.div {...fadeUp}>
              <SectionHeading eyebrow="Popular now" title="Top ranking products" description="Products rise through actual sold quantity, order activity, product views and approved customer ratings." action={<span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-black text-amber-700"><Trophy className="h-4 w-4" /> Live marketplace ranking</span>} />
              <div className="mt-8">
                {marketplaceQuery.isLoading && !data.top_products.length ? <LoadingGrid /> : (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {data.top_products.slice(0, 8).map((product) => <MarketplaceProductCard key={product.id} product={product} rank={product.rank} />)}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        <section id="compare" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <motion.div {...fadeUp}>
            <SectionHeading eyebrow="Price intelligence" title="Compare the same product across shops" description="BazarHQ matches products using SKU when available, normalized titles and category similarity, then surfaces the lowest current price." />
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {data.comparisons.map((product) => <MarketplaceProductCard key={`compare-${product.id}`} product={product} comparison />)}
            </div>
            {!marketplaceQuery.isLoading && !data.comparisons.length && <div className="mt-8 rounded-[1.7rem] border border-dashed border-indigo-200 bg-indigo-50/50 p-10 text-center"><PackageSearch className="mx-auto h-9 w-9 text-indigo-400" /><p className="mt-4 font-black text-slate-900">No cross-shop comparison yet</p><p className="mt-2 text-sm text-slate-500">This section activates automatically when matching products are published by two or more shops.</p></div>}
          </motion.div>
        </section>

        <section id="marketplace" className="scroll-mt-28 border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <SectionHeading eyebrow="All shops, one marketplace" title={search || category ? 'Marketplace search results' : 'Explore products from every shop'} description={search || category ? `Showing products${search ? ` matching “${search}”` : ''}${category ? ` in ${category}` : ''}.` : 'Browse active products from independent BazarHQ shops. Every card opens the merchant storefront for checkout.'} action={(search || category) && <Button variant="outline" className="rounded-full" onClick={() => { setDraftSearch(''); setSearch(''); setCategory('') }}>Clear search</Button>} />

            {marketplaceQuery.error && (
              <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">{marketplaceQuery.error.message}</div>
            )}

            <div className="mt-8">
              {marketplaceQuery.isFetching && !data.products.length ? <LoadingGrid count={8} /> : data.products.length ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {data.products.map((product) => <MarketplaceProductCard key={`market-${product.id}`} product={product} comparison />)}
                </div>
              ) : !marketplaceQuery.error && (
                <div className="rounded-[1.8rem] border border-dashed border-slate-300 bg-slate-50 p-12 text-center"><Search className="mx-auto h-10 w-10 text-slate-300" /><h3 className="mt-4 text-lg font-black">No matching products</h3><p className="mt-2 text-sm text-slate-500">Try another keyword or clear the selected category.</p></div>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <motion.div {...fadeUp} className="overflow-hidden rounded-[2.2rem] bg-slate-950 text-white shadow-[0_35px_100px_-45px_rgba(15,23,42,.85)]">
            <div className="grid lg:grid-cols-[1.05fr_.95fr]">
              <div className="p-7 sm:p-10 lg:p-14">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300"><Zap className="h-4 w-4" /> One account, two opportunities</span>
                <h2 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">Buy as a customer and grow as a seller.</h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">Use the same verified email to shop from any merchant and create your own storefront. Your customer orders and seller business stay organized under separate role access.</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/customer/signup"><Button className="h-12 rounded-full bg-white px-6 font-black text-slate-950 hover:bg-cyan-100"><ShoppingBag className="mr-2 h-4 w-4" /> Create buyer access</Button></Link>
                  <Link to="/signup"><Button variant="outline" className="h-12 rounded-full border-white/20 bg-white/5 px-6 font-black text-white hover:bg-white/10"><Store className="mr-2 h-4 w-4" /> Open a shop</Button></Link>
                </div>
              </div>
              <div className="grid gap-3 border-t border-white/10 bg-white/[.04] p-7 sm:grid-cols-2 sm:p-10 lg:border-l lg:border-t-0">
                {[
                  [Users, 'One verified identity', 'Switch between customer and merchant access without duplicate accounts.'],
                  [BarChart3, 'Marketplace discovery', 'Ranking and search help customers discover products beyond one storefront.'],
                  [BadgeCheck, 'Published shops only', 'Suspended, draft or unpublished stores never appear in marketplace results.'],
                  [ShieldCheck, 'Private by design', 'Public ranking APIs exclude credentials, customer details and merchant revenue.'],
                ].map(([Icon, title, text]) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5"><Icon className="h-5 w-5 text-cyan-300" /><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-400">{text}</p></div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_.8fr_.8fr] lg:px-8">
          <div><Logo size="md" /><p className="mt-4 max-w-md text-sm leading-7 text-slate-500">A Bangladesh-focused marketplace where independent shops sell and customers compare, discover and buy.</p></div>
          <div><p className="font-black">Marketplace</p><div className="mt-4 space-y-2 text-sm font-semibold text-slate-500"><a href="#top-shops" className="block hover:text-indigo-600">Top shops</a><a href="#top-products" className="block hover:text-indigo-600">Top products</a><a href="#compare" className="block hover:text-indigo-600">Compare prices</a><Link to="/track" className="block hover:text-indigo-600">Track order</Link></div></div>
          <div><p className="font-black">Get BazarHQ</p><a href={APK_DOWNLOAD_URL} className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700"><Download className="h-4 w-4" /> Download APK</a><p className="mt-3 text-xs leading-5 text-slate-400">Set VITE_BAZARHQ_APK_URL to your hosted APK file.</p></div>
        </div>
        <div className="border-t border-slate-200 py-5 text-center text-xs font-semibold text-slate-400">© {new Date().getFullYear()} BazarHQ. Marketplace commerce for Bangladesh.</div>
      </footer>
    </div>
  )
}
