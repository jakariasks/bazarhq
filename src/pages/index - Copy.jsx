import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
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
      <div className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex min-h-9 max-w-7xl items-center justify-between gap-4 px-4 py-2 text-[11px] font-semibold sm:px-6 lg:px-8">
          <p className="truncate text-slate-300">A multi-store marketplace built for buyers and independent sellers in Bangladesh.</p>
          <a href={APK_DOWNLOAD_URL} className="inline-flex shrink-0 items-center gap-1.5 text-white transition hover:text-slate-200">
            <Download className="h-3.5 w-3.5" /> Download app
          </a>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="BazarHQ marketplace home"><Logo size="md" /></Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#top-shops" className="transition hover:text-slate-950">Top shops</a>
            <a href="#top-products" className="transition hover:text-slate-950">Top products</a>
            <a href="#compare" className="transition hover:text-slate-950">Compare</a>
            <a href="#marketplace" className="transition hover:text-slate-950">All products</a>
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

          <button type="button" className="rounded-full border border-slate-200 p-2 md:hidden" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-slate-200 bg-white p-4 md:hidden">
            <div className="mx-auto grid max-w-7xl gap-1">
              {[['Top shops', '#top-shops'], ['Top products', '#top-products'], ['Compare', '#compare'], ['All products', '#marketplace']].map(([label, href]) => (
                <a key={href} href={href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">{label}</a>
              ))}
              <Link to="/track" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Track order</Link>
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
  { id: 'fashion', label: 'Fashion & Style', keywords: ['fashion', 'clothing', 'jewelry', 'jewellery', 'shoe', 'bag', 'watch', 'belt', 'wallet', 'handmade', 'boutique'] },
  { id: 'electronics', label: 'Electronics', keywords: ['electronic', 'computer', 'laptop', 'mobile', 'phone', 'gadget', 'accessories', 'camera', 'audio'] },
  { id: 'beauty', label: 'Beauty & Care', keywords: ['beauty', 'skin', 'hair', 'cosmetic', 'makeup', 'personal care', 'perfume'] },
  { id: 'home', label: 'Home & Living', keywords: ['home', 'decor', 'furniture', 'kitchen', 'candle', 'crochet', 'knitting', 'garden'] },
  { id: 'food', label: 'Food & Grocery', keywords: ['food', 'grocery', 'snack', 'drink', 'honey', 'organic'] },
  { id: 'general', label: 'More Categories', keywords: [] },
]

function categoryGroupFor(name) {
  const value = String(name || '').toLowerCase()
  return CATEGORY_GROUPS.find((group) => group.id !== 'general' && group.keywords.some((keyword) => value.includes(keyword))) || CATEGORY_GROUPS[CATEGORY_GROUPS.length - 1]
}

function MobileBottomNav({ customerPath, compareCount, onHome, onCategories, onCompare }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[70] border-t border-slate-200 bg-white/96 px-2 pb-[max(.45rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-14px_34px_-24px_rgba(15,23,42,.35)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        <button type="button" onClick={onHome} className="flex flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-bold text-slate-600"><Home className="h-5 w-5" />Home</button>
        <button type="button" onClick={onCategories} className="flex flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-bold text-slate-600"><Store className="h-5 w-5" />Categories</button>
        <button type="button" onClick={onCompare} className="relative flex flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-bold text-slate-600"><Scale className="h-5 w-5" />Compare{compareCount > 0 && <span className="absolute right-[22%] top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-950 px-1 text-[8px] font-black text-white">{compareCount}</span>}</button>
        <Link to="/track" className="flex flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-bold text-slate-600"><ShoppingBag className="h-5 w-5" />Orders</Link>
        <Link to={customerPath} className="flex flex-col items-center gap-1 rounded-xl py-1 text-[10px] font-bold text-slate-600"><Users className="h-5 w-5" />Account</Link>
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
  const customerAccessPath = hasCustomerRole ? '/customer/account' : '/customer/login'
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
      window.scrollTo({ top, behavior: 'smooth' })
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

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 text-slate-950 md:pb-0">
      <MarketplaceNav />

      <main>
        <section className="relative overflow-hidden border-b border-indigo-100 bg-[#f6f7ff]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(99,102,241,.22),transparent_28%),radial-gradient(circle_at_92%_12%,rgba(6,182,212,.17),transparent_26%),linear-gradient(115deg,#f8f7ff_0%,#f4f8ff_48%,#effcff_100%)]" />
          <div className="absolute -left-28 bottom-[-10rem] h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl" />
          <div className="absolute -right-20 top-[-8rem] h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14"
          >
            <div className="max-w-5xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/70 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-700 shadow-sm backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" /> Bangladesh multi-store marketplace
              </p>

              <h1 className="mt-5 max-w-5xl font-black leading-[.98] tracking-[-0.058em] text-slate-950 text-[2.7rem] sm:text-[3.7rem] lg:text-[4.65rem]">
                Discover <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">better products</span> from independent shops.
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base lg:text-lg">
                Search trusted storefronts, compare current prices and buy with confidence—or launch and manage your own BazarHQ shop.
              </p>
            </div>

            <div className="mt-6 grid max-w-5xl gap-3 sm:grid-cols-2">
              <Link to={customerAccessPath} className="group flex min-h-14 items-center justify-between rounded-2xl border border-white/90 bg-white/82 px-5 py-3.5 shadow-[0_18px_45px_-32px_rgba(79,70,229,.42)] backdrop-blur transition hover:border-indigo-200 hover:shadow-[0_24px_58px_-34px_rgba(79,70,229,.32)]">
                <span className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Users className="h-5 w-5" /></span><span><span className="block text-sm font-black text-slate-950">{hasCustomerRole ? 'Open buyer account' : 'Customer login'}</span><span className="mt-0.5 block text-xs font-semibold text-slate-500">Browse, order and track purchases</span></span></span>
                <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1" />
              </Link>
              <Link to={merchantAccessPath} className="group flex min-h-14 items-center justify-between rounded-2xl border border-slate-950 bg-slate-950 px-5 py-3.5 text-white shadow-[0_20px_50px_-30px_rgba(15,23,42,.7)] transition hover:bg-indigo-700">
                <span className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10"><Store className="h-5 w-5" /></span><span><span className="block text-sm font-black">{isMerchant ? 'Open seller dashboard' : 'Merchant login'}</span><span className="mt-0.5 block text-xs font-semibold text-slate-300">Create and manage your storefront</span></span></span>
                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1" />
              </Link>
            </div>

            <form onSubmit={submitSearch} className="mt-4 max-w-5xl rounded-[1.35rem] border border-white/90 bg-white/88 p-2 shadow-[0_24px_65px_-42px_rgba(15,23,42,.38)] backdrop-blur sm:p-2.5">
              <div className="flex items-center gap-2">
                <label className="relative min-w-0 flex-1">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-5 sm:h-5 sm:w-5" />
                  <input
                    value={draftSearch}
                    onChange={(event) => setDraftSearch(event.target.value)}
                    placeholder="Search products, categories, or shops"
                    className="h-12 w-full min-w-0 rounded-[1rem] bg-slate-50/90 pl-10 pr-3 text-[12px] font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 sm:h-13 sm:rounded-2xl sm:pl-12 sm:pr-4 sm:text-sm"
                  />
                </label>
                <Button type="submit" className="h-12 shrink-0 rounded-[1rem] bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-xs font-black text-white shadow-[0_16px_34px_-18px_rgba(79,70,229,.65)] hover:from-indigo-700 hover:to-violet-700 sm:h-13 sm:rounded-2xl sm:px-8 sm:text-sm">
                  <span className="sm:hidden">Search</span>
                  <span className="hidden sm:inline">Search marketplace</span>
                  <ArrowRight className="ml-1.5 h-4 w-4 sm:ml-2" />
                </Button>
              </div>
            </form>

            <div id="category-explorer" className="mt-4 max-w-7xl scroll-mt-24 rounded-[1.35rem] border border-white/90 bg-white/76 p-2.5 shadow-[0_20px_55px_-40px_rgba(15,23,42,.34)] backdrop-blur sm:mt-5 sm:p-4">
              <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:overflow-visible sm:whitespace-normal sm:pb-0 lg:grid-cols-6">
                {categoryGroups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggleCategoryGroup(group.id)}
                    className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black transition sm:min-h-11 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs ${activeCategoryGroup === group.id ? 'border-indigo-600 bg-indigo-600 text-white shadow-[0_10px_24px_-14px_rgba(79,70,229,.8)]' : 'border-slate-200 bg-white/90 text-slate-700 hover:border-indigo-300 hover:text-indigo-700'}`}
                  >
                    {group.label}
                  </button>
                ))}
              </div>

              {activeGroup && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.28 }} className="overflow-hidden">
                  <div className="mt-2.5 flex gap-2 overflow-x-auto border-t border-slate-200/80 pt-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-3 sm:flex-wrap sm:overflow-visible sm:pt-3">
                    {activeGroup.items.length ? activeGroup.items.map((item) => (
                      <button key={item.name} type="button" onClick={() => selectSubcategory(item.name)} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold transition sm:text-[11px] ${category === item.name ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'}`}>
                        {item.name}{item.count ? ` · ${item.count}` : ''}
                      </button>
                    )) : <p className="px-1 py-2 text-xs font-semibold text-slate-500">No published subcategories are available in this group yet.</p>}
                  </div>
                </motion.div>
              )}
            </div>

            <div className="mt-4 max-w-5xl overflow-hidden rounded-[1.15rem] border border-white/90 bg-white/62 px-1 py-2 shadow-[0_18px_45px_-34px_rgba(15,23,42,.28)] backdrop-blur sm:mt-5 sm:px-2 sm:py-2.5">
              <div className="grid grid-cols-4 divide-x divide-slate-200/80">
                {[[data.metrics.shops, 'Shops', 'Active shops'], [data.metrics.products, 'Products', 'Products'], [data.metrics.orders, 'Orders', 'Orders completed'], [data.metrics.categories, 'Categories', 'Categories']].map(([value, mobileLabel, desktopLabel]) => (
                  <div key={desktopLabel} className="min-w-0 px-1.5 py-1 text-center sm:px-4 sm:py-1.5">
                    <p className="text-base font-black tracking-tight text-slate-950 sm:text-xl">{marketplaceQuery.isLoading ? '—' : compact(value)}</p>
                    <p className="mt-0.5 truncate text-[8px] font-black uppercase tracking-[0.08em] text-slate-500 sm:mt-1 sm:text-[10px] sm:tracking-[0.12em]">
                      <span className="sm:hidden">{mobileLabel}</span>
                      <span className="hidden sm:inline">{desktopLabel}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        <section id="top-shops" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <motion.div {...fadeUp}>
            <SectionHeading eyebrow="Trusted sellers" title="Top shops" description="Independent storefronts ranked from marketplace activity, product quality and verified customer feedback." action={<a href="#marketplace" className="inline-flex items-center gap-2 text-sm font-black text-slate-700">Browse products <ChevronRight className="h-4 w-4" /></a>} />
            <div className="mt-7 grid auto-cols-[calc((100%-1rem)/3)] grid-flow-col grid-rows-1 gap-2 overflow-x-auto pb-3 [scrollbar-width:thin] sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-3 sm:overflow-visible md:grid-cols-4 xl:grid-cols-5">
              {marketplaceQuery.isLoading && !data.top_shops.length
                ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-56 animate-pulse rounded-[1.15rem] bg-slate-100" />)
                : data.top_shops.slice(0, 10).map((shop) => <ShopCard key={shop.id} shop={shop} />)}
            </div>
          </motion.div>
        </section>

        <section id="top-products" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <motion.div {...fadeUp}>
              <SectionHeading eyebrow="Marketplace ranking" title="Top products" description="Popular products ranked from real sales, product views and approved customer reviews." action={<span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-black text-slate-600"><Trophy className="h-3.5 w-3.5" /> Live ranking</span>} />
              <div className="mt-7">
                {marketplaceQuery.isLoading && !data.top_products.length ? <LoadingGrid count={5} /> : (
                  <>
                    <motion.div layout className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {data.top_products
                        .slice(0, showMoreTopProducts ? Math.min(data.top_products.length, 20) : 5)
                        .map((product) => (
                          <MarketplaceProductCard key={product.id} product={product} {...compareProps(product)} />
                        ))}
                    </motion.div>

                    {data.top_products.length > 5 && (
                      <div className="mt-8 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setShowMoreTopProducts((current) => !current)}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-700 hover:shadow-md"
                          aria-expanded={showMoreTopProducts}
                        >
                          {showMoreTopProducts ? 'Show fewer products' : `More top products (${Math.min(data.top_products.length - 5, 15)})`}
                          <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${showMoreTopProducts ? '-rotate-90' : 'rotate-90'}`} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        <section id="compare" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <motion.div {...fadeUp}>
            <SectionHeading
              eyebrow="Live comparison"
              title="Compare current product data"
              description="Select up to four products. Prices, stock and ratings refresh automatically every 15 seconds while comparison is active."
              action={compareItems.length > 0 ? (
                <button type="button" onClick={() => marketplaceQuery.refetch()} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700">
                  <RefreshCw className={`h-3.5 w-3.5 ${marketplaceQuery.isFetching ? 'animate-spin' : ''}`} /> Refresh now
                </button>
              ) : null}
            />

            {compareItems.length > 0 ? (
              <div className="mt-7 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_24px_70px_-44px_rgba(15,23,42,.44)]">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-950">Real-time comparison ({compareItems.length}/4)</p>
                    <p className="mt-1 text-xs text-slate-500">Last synced {compareUpdatedAt ? compareUpdatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'just now'} · auto refresh every 15 seconds</p>
                  </div>
                  <button type="button" onClick={() => setCompareItems([])} className="text-xs font-bold text-slate-500 hover:text-rose-600">Clear comparison</button>
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
                              <button type="button" onClick={() => toggleCompare(product)} className="rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove product"><X className="h-4 w-4" /></button>
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
                      <tr><th className="px-5 py-4 text-xs font-black text-slate-500">Open product</th>{compareItems.map((product) => <td key={`link-${product.id}`} className="px-4 py-4"><Link to="/shop/$storeSlug/product/$productId" params={{ storeSlug: product.store_slug || product.subdomain, productId: String(product.slug || product.id) }} className="inline-flex items-center gap-1 text-xs font-black text-indigo-700">View details <ChevronRight className="h-3.5 w-3.5" /></Link></td>)}</tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="mt-7 flex items-center gap-4 rounded-[1.25rem] border border-dashed border-indigo-200 bg-indigo-50/40 px-5 py-5 text-sm text-slate-600">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm"><Scale className="h-5 w-5" /></span>
                <p>Use the small scale icon on any product card to add it to the live comparison table.</p>
              </div>
            )}

            {data.comparisons.length > 0 && (
              <div className="mt-9">
                <div className="mb-5"><p className="text-sm font-black text-slate-950">Automatic cross-shop matches</p><p className="mt-1 text-xs text-slate-500">Products with current marketplace price alternatives.</p></div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {data.comparisons.slice(0, 10).map((product) => <MarketplaceProductCard key={`compare-${product.id}`} product={product} comparison {...compareProps(product)} />)}
                </div>
              </div>
            )}
          </motion.div>
        </section>

        <section id="marketplace" className={`scroll-mt-28 border-y border-slate-200 bg-white transition-shadow duration-700 ${resultsPulse ? 'shadow-[inset_0_0_0_3px_rgba(99,102,241,.14)]' : ''}`}>
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
            <SectionHeading eyebrow="All marketplace products" title={search || category ? 'Search results' : 'Explore the marketplace'} description={search || category ? `Showing products${search ? ` matching “${search}”` : ''}${category ? ` in ${category}` : ''}.` : 'Browse active products from every published BazarHQ storefront.'} action={(search || category) && <Button variant="outline" className="rounded-full" onClick={() => { setDraftSearch(''); setSearch(''); setCategory('') }}>Clear search</Button>} />
            {marketplaceQuery.error && <div className="mt-7 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{marketplaceQuery.error.message}</div>}
            <div className="mt-7">
              {marketplaceQuery.isFetching && !data.products.length ? <LoadingGrid count={10} /> : data.products.length ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {data.products.map((product) => <MarketplaceProductCard key={`market-${product.id}`} product={product} comparison {...compareProps(product)} />)}
                </div>
              ) : !marketplaceQuery.error && (
                <div className="rounded-[1.15rem] border border-dashed border-slate-300 bg-slate-50 p-12 text-center"><Search className="mx-auto h-9 w-9 text-slate-300" /><h3 className="mt-4 text-lg font-black">No matching products</h3><p className="mt-2 text-sm text-slate-500">Try another keyword or clear the selected category.</p></div>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <motion.div {...fadeUp} className="grid overflow-hidden rounded-[1.4rem] border border-slate-200 bg-[#eef2f7] lg:grid-cols-[1.15fr_.85fr]">
            <div className="p-7 sm:p-10 lg:p-12"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">One verified account</p><h2 className="mt-3 max-w-xl text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">Buy from any shop. Build your own storefront.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">Use one BazarHQ identity for customer purchases and merchant operations, while keeping orders and store management clearly organized.</p><div className="mt-7 flex flex-wrap gap-3"><Link to="/customer/signup"><Button className="h-11 rounded-full bg-slate-950 px-5 font-bold text-white hover:bg-slate-800"><ShoppingBag className="mr-2 h-4 w-4" /> Create buyer access</Button></Link><Link to="/signup"><Button variant="outline" className="h-11 rounded-full border-slate-300 bg-transparent px-5 font-bold"><Store className="mr-2 h-4 w-4" /> Open a shop</Button></Link></div></div>
            <div className="grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 lg:border-l lg:border-t-0">{[[Users, 'One identity', 'Customer and merchant access under one verified account.'], [BarChart3, 'Real rankings', 'Marketplace visibility shaped by real activity.'], [BadgeCheck, 'Published shops', 'Only active storefronts appear publicly.'], [ShieldCheck, 'Private data', 'Credentials and merchant revenue remain protected.']].map(([Icon, title, text]) => <div key={title} className="bg-[#f8fafc] p-5 sm:p-6"><Icon className="h-5 w-5 text-slate-700" /><h3 className="mt-4 text-sm font-black text-slate-950">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{text}</p></div>)}</div>
          </motion.div>
        </section>
      </main>

      <Footer />
      <CompareTray items={compareItems} notice={compareNotice} onRemove={toggleCompare} onClear={() => setCompareItems([])} onOpen={() => smoothTo('compare')} />
      <MobileBottomNav customerPath={customerAccessPath} compareCount={compareItems.length} onHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })} onCategories={() => smoothTo('category-explorer')} onCompare={() => smoothTo('compare')} />
    </div>
  )
}
