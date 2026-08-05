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
  ExternalLink,
  Mail,
  Menu,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Store,
  TrendingDown,
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
      className="group relative overflow-hidden rounded-[1.45rem] border border-slate-200 bg-white p-4 shadow-[0_16px_45px_-34px_rgba(15,23,42,.32)] transition duration-500 hover:-translate-y-1.5 hover:border-indigo-200 hover:shadow-[0_26px_60px_-36px_rgba(79,70,229,.35)]"
    >
      <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-[4rem] bg-gradient-to-br from-indigo-50 to-cyan-50 transition group-hover:scale-110" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {shop.logo_url ? (
            <img src={shop.logo_url} alt={shop.shop_name} className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 object-cover shadow-sm" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-base font-black text-white">{String(shop.shop_name || 'S').charAt(0)}</span>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-black text-slate-950">{shop.shop_name}</p>
            <p className="truncate text-[11px] font-semibold text-slate-500">{shop.business_category || 'Marketplace shop'}</p>
          </div>
        </div>
        <span className="relative inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-slate-950 px-2 text-[11px] font-black text-white">#{rank || '—'}</span>
      </div>

      <p className="relative mt-3 line-clamp-2 min-h-10 text-sm leading-6 text-slate-600">{shop.tagline || 'Discover products from a verified BazarHQ seller.'}</p>

      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-slate-50 p-2.5 text-center">
          <p className="text-sm font-black text-slate-950">{compact(shop.product_count)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Products</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-2.5 text-center">
          <p className="text-sm font-black text-slate-950">{compact(sold || orders)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Sold</p>
        </div>
        <div className="rounded-2xl bg-amber-50 p-2.5 text-center">
          <p className="inline-flex items-center gap-1 text-sm font-black text-amber-700"><Star className="h-3.5 w-3.5 fill-current" /> {rating ? rating.toFixed(1) : 'New'}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-500">Rating</p>
        </div>
      </div>

      <div className="relative mt-4 flex items-center justify-between text-sm font-black text-indigo-600">
        Visit shop <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </div>
    </Link>
  )
}

function LoadingGrid({ count = 4, className = 'sm:grid-cols-2 lg:grid-cols-4' }) {
  return (
    <div className={`grid gap-5 ${className}`}>
      {Array.from({ length: count }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-[1.6rem] bg-slate-100" />)}
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
  const [draftSearch, setDraftSearch] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  const marketplaceQuery = useQuery({
    queryKey: ['marketplace-home', search, category],
    queryFn: () => fetchMarketplaceHome({ search, category, limit: 18 }),
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

  const heroHighlights = [
    { icon: ShieldCheck, title: 'Trusted shops', text: 'Only active, published stores appear in the marketplace.' },
    { icon: TrendingDown, title: 'Price comparison', text: 'See better prices across shops when matching products exist.' },
    { icon: Trophy, title: 'Top ranked products', text: 'Ranked using sales, views and approved customer ratings.' },
    { icon: Store, title: 'Sell with one account', text: 'Create your own store and manage buyer + seller access together.' },
  ]

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950">
      <MarketplaceNav />

      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(99,102,241,.14),transparent_26%),radial-gradient(circle_at_82%_18%,rgba(34,211,238,.10),transparent_24%),linear-gradient(180deg,#fff,#f8fafc)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
            <div className="grid gap-8 lg:grid-cols-[1.12fr_.88fr] lg:items-center">
              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
                <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-indigo-700 sm:text-xs">
                  <Sparkles className="h-4 w-4" /> Bangladesh multi-store marketplace
                </span>
                <h1 className="mt-5 max-w-3xl text-[2.35rem] font-black leading-[1.02] tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-[4.15rem]">
                  Buy from many shops. <span className="bg-gradient-to-r from-indigo-600 to-cyan-500 bg-clip-text text-transparent">Sell from your own.</span>
                </h1>
                <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600 sm:text-base">
                  Discover trusted shops, compare prices, find top products across the marketplace, and sell from your own storefront with one BazarHQ account.
                </p>

                <form onSubmit={submitSearch} className="mt-6 flex max-w-2xl flex-col gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-2 shadow-[0_18px_50px_-34px_rgba(79,70,229,.35)] sm:flex-row">
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

                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => selectCategory('')} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${!category ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'}`}>All categories</button>
                  {categoryNames.slice(0, 6).map((name) => (
                    <button key={name} onClick={() => selectCategory(name)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${category === name ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'}`}>{name}</button>
                  ))}
                </div>

                <div className="mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    [Store, data.metrics.shops, 'Live shops'],
                    [ShoppingBag, data.metrics.products, 'Products'],
                    [CheckCircle2, data.metrics.orders, 'Orders'],
                    [Boxes, data.metrics.categories, 'Categories'],
                  ].map(([Icon, value, label]) => (
                    <div key={label} className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 backdrop-blur">
                      <Icon className="h-4 w-4 text-indigo-600" />
                      <p className="mt-2 text-lg font-black">{marketplaceQuery.isLoading ? '—' : compact(value)}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08 }} className="relative">
                <div className="absolute -left-6 top-8 h-28 w-28 rounded-full bg-indigo-100/70 blur-3xl" />
                <div className="absolute -right-4 bottom-0 h-24 w-24 rounded-full bg-cyan-100/70 blur-3xl" />
                <div className="relative rounded-[2rem] border border-slate-200 bg-white/88 p-4 shadow-[0_28px_80px_-42px_rgba(15,23,42,.28)] backdrop-blur sm:p-5">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Marketplace benefits</p>
                      <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">A cleaner way to shop and sell</h2>
                    </div>
                    {featuredComparison ? (
                      <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-right">
                        <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Best price from</p>
                        <p className="mt-1 text-base font-black text-emerald-700">{money(featuredComparison.best_price)}</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-indigo-50 px-3 py-2 text-right">
                        <p className="text-[10px] font-black uppercase tracking-wide text-indigo-700">Marketplace ready</p>
                        <p className="mt-1 text-base font-black text-indigo-700">Browse & compare</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {heroHighlights.map(({ icon: Icon, title, text }) => (
                      <div key={title} className="rounded-[1.35rem] border border-slate-200 bg-slate-50/85 p-4 transition hover:border-indigo-200 hover:bg-white">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                          <Icon className="h-4.5 w-4.5 text-indigo-600" />
                        </div>
                        <h3 className="mt-3 text-sm font-black text-slate-950">{title}</h3>
                        <p className="mt-1.5 text-xs leading-6 text-slate-500">{text}</p>
                      </div>
                    ))}
                  </div>

                  {featuredComparison && (
                    <div className="mt-4 rounded-[1.45rem] border border-slate-200 bg-white p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                          {(featuredComparison.images?.[0] || featuredComparison.image_url) ? <img src={featuredComparison.images?.[0] || featuredComparison.image_url} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="m-4 h-8 w-8 text-slate-300" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-black text-slate-950">{featuredComparison.title}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">Compared across {number(featuredComparison.comparison_count)} shops</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">Best price {money(featuredComparison.best_price)}</span>
                            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">Save {money(featuredComparison.saving || number(featuredComparison.highest_price) - number(featuredComparison.best_price))}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="top-shops" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <motion.div {...fadeUp}>
            <SectionHeading eyebrow="Marketplace leaders" title="Top selling shops" description="Ranked from real marketplace activity, product performance, customer reviews and unique visitors—without exposing merchant financial data." action={<a href="#marketplace" className="inline-flex items-center gap-2 text-sm font-black text-indigo-600">Explore products <ChevronRight className="h-4 w-4" /></a>} />
            <div className="mt-8 grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {marketplaceQuery.isLoading && !data.top_shops.length
                ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-[1.7rem] bg-slate-100" />)
                : data.top_shops.slice(0, 5).map((shop) => <ShopCard key={shop.id} shop={shop} />)}
            </div>
            {!marketplaceQuery.isLoading && !data.top_shops.length && <div className="mt-8 rounded-[1.7rem] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Published shops will appear here after marketplace data is available.</div>}
          </motion.div>
        </section>

        <section id="top-products" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <motion.div {...fadeUp}>
              <SectionHeading eyebrow="Popular now" title="Top ranking products" description="Products rise through actual sold quantity, order activity, product views and approved customer ratings." action={<span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-black text-amber-700"><Trophy className="h-4 w-4" /> Live marketplace ranking</span>} />
              <div className="mt-8">
                {marketplaceQuery.isLoading && !data.top_products.length ? <LoadingGrid count={6} className="grid-cols-2 lg:grid-cols-4 xl:grid-cols-6" /> : (
                  <div className="grid gap-5 grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                    {data.top_products.slice(0, 12).map((product) => <MarketplaceProductCard key={product.id} product={product} rank={product.rank} />)}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        <section id="compare" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <motion.div {...fadeUp}>
            <SectionHeading eyebrow="Price intelligence" title="Compare the same product across shops" description="BazarHQ matches products using SKU when available, normalized titles and category similarity, then surfaces the lowest current price." />
            <div className="mt-8 grid gap-5 grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
              {data.comparisons.map((product) => <MarketplaceProductCard key={`compare-${product.id}`} product={product} comparison />)}
            </div>
            {!marketplaceQuery.isLoading && !data.comparisons.length && <div className="mt-8 rounded-[1.7rem] border border-dashed border-indigo-200 bg-indigo-50/50 p-10 text-center"><Search className="mx-auto h-9 w-9 text-indigo-400" /><p className="mt-4 font-black text-slate-900">No cross-shop comparison yet</p><p className="mt-2 text-sm text-slate-500">This section activates automatically when matching products are published by two or more shops.</p></div>}
          </motion.div>
        </section>

        <section id="marketplace" className="scroll-mt-28 border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <SectionHeading eyebrow="All shops, one marketplace" title={search || category ? 'Marketplace search results' : 'Explore products from every shop'} description={search || category ? `Showing products${search ? ` matching “${search}”` : ''}${category ? ` in ${category}` : ''}.` : 'Browse active products from independent BazarHQ shops. Every card opens the merchant storefront for checkout.'} action={(search || category) && <Button variant="outline" className="rounded-full" onClick={() => { setDraftSearch(''); setSearch(''); setCategory('') }}>Clear search</Button>} />

            {marketplaceQuery.error && (
              <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">{marketplaceQuery.error.message}</div>
            )}

            <div className="mt-8">
              {marketplaceQuery.isFetching && !data.products.length ? <LoadingGrid count={12} className="grid-cols-2 lg:grid-cols-4 xl:grid-cols-6" /> : data.products.length ? (
                <div className="grid gap-5 grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
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

      <Footer />
    </div>
  )
}