import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Globe,
  LayoutDashboard,
  Download,
  LockKeyhole,
  Mail,
  Menu,
  Package,
  ShieldCheck,
  QrCode,
  ShoppingBag,
  Sparkles,
  Smartphone,
  Store,
  Truck,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { getStorefrontUrl } from '@/lib/storefront-url'

const fadeUp = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-90px' },
  transition: { duration: 0.55, ease: 'easeOut' },
}

const stagger = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.06 } },
  viewport: { once: true, margin: '-90px' },
}

const item = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut' },
}

const fallbackMetrics = {
  stores: null,
  products: null,
  orders: null,
  revenue: null,
  liveShops: [],
}

const SUPPORT_EMAIL = 'info.softthinkers@gmail.com'
const APK_DOWNLOAD_URL = import.meta.env.VITE_BAZARHQ_APK_URL || '/downloads/bazarhq.apk'

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

function compactNumber(value, fallback = 'Live') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return fallback
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value))
}

function formatBDT(value) {
  if (!value) return '৳0'
  return `৳${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value))}`
}

async function fetchLandingMetrics() {
  const metrics = { ...fallbackMetrics }

  let storesResult = await supabase
    .from('stores')
    .select('id, shop_name, subdomain, business_category, logo_url, storefront_published, account_status, created_at', { count: 'exact' })
    .eq('storefront_published', true)
    .eq('account_status', 'active')
    .order('created_at', { ascending: false })
    .limit(4)

  if (storesResult.error) {
    storesResult = await supabase
      .from('stores')
      .select('id, shop_name, subdomain, business_category, logo_url, storefront_published, created_at', { count: 'exact' })
      .eq('storefront_published', true)
      .order('created_at', { ascending: false })
      .limit(4)
  }

  if (!storesResult.error) {
    metrics.stores = storesResult.count ?? storesResult.data?.length ?? null
    metrics.liveShops = storesResult.data || []
  }

  const productsResult = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')

  if (!productsResult.error) metrics.products = productsResult.count ?? null

  const ordersResult = await supabase
    .from('orders')
    .select('id, total_amount, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(250)

  if (!ordersResult.error) {
    metrics.orders = ordersResult.count ?? ordersResult.data?.length ?? null
    metrics.revenue = (ordersResult.data || []).reduce((sum, order) => sum + Number(order.total_amount || 0), 0)
  }

  return metrics
}

function useLandingMetrics() {
  return useQuery({
    queryKey: ['landing-metrics'],
    queryFn: fetchLandingMetrics,
    staleTime: 1000 * 60 * 3,
    refetchOnWindowFocus: false,
  })
}

function Landing() {
  const { data = fallbackMetrics } = useLandingMetrics()

  return (
    <div className="min-h-screen overflow-hidden bg-background">
      <Nav />
      <Hero metrics={data} />
      <LiveStores shops={data.liveShops} />
      <Features />
      <HowItWorks />
      <Payments />
      <Pricing />
      <FAQ />
      <CTA />
      <MobileAppDownload />
      <Footer />
    </div>
  )
}

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
      { label: 'Mobile app', href: '#mobile-app' },
]

function Nav() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  const closeMenu = () => setOpen(false)

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/78 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/72">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-18 items-center justify-between gap-4">
          <Logo size="md" />

          <nav className="hidden items-center rounded-full border border-slate-200/80 bg-white/75 px-2 py-1 shadow-sm md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-950"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">

            {user ? (
              <Link to="/merchant">
                <Button size="sm" className="rounded-full bg-gradient-primary px-5 text-primary-foreground shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="outline" size="sm" className="rounded-full border-slate-200 bg-white px-4 font-semibold shadow-sm">
                    Login
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm" className="rounded-full bg-gradient-primary px-5 text-primary-foreground shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:opacity-95">
                    Start free
                  </Button>
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 md:hidden"
            aria-label="Toggle navigation"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="pb-4 md:hidden">
            <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-elegant">
              <div className="grid gap-1">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={closeMenu}
                    className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {link.label}
                  </a>
                ))}

              </div>
              <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3">
                {user ? (
                  <Link to="/merchant" onClick={closeMenu}>
                    <Button className="w-full rounded-2xl bg-gradient-primary">Open dashboard</Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/login" onClick={closeMenu}>
                      <Button variant="outline" className="w-full rounded-2xl">Login</Button>
                    </Link>
                    <Link to="/signup" onClick={closeMenu}>
                      <Button className="w-full rounded-2xl bg-gradient-primary">Start free</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

function Hero({ metrics }) {
  const { user } = useAuth()
  const stats = useMemo(() => [
    { label: 'Live shops', value: compactNumber(metrics.stores, 'Ready'), icon: Store },
    { label: 'Published products', value: compactNumber(metrics.products, 'Products'), icon: Package },
    { label: 'Orders managed', value: compactNumber(metrics.orders, 'Orders'), icon: Truck },
  ], [metrics])

  return (
    <section className="relative bg-gradient-hero">
      <div className="absolute inset-0 bg-gradient-mesh opacity-80" />
      <div className="absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:py-24">
        <motion.div {...fadeUp} className="max-w-3xl">
          <Badge variant="secondary" className="mb-5 gap-2 rounded-full border border-primary/15 bg-card/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Built for Bangladesh
          </Badge>

          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Build a beautiful <span className="text-gradient">online shop</span> without code.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
            BazarHQ helps merchants launch a modern storefront, accept local payments, manage orders, and grow from one clean dashboard.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {user ? (
              <Link to="/merchant">
                <Button size="lg" className="w-full rounded-full bg-gradient-primary text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5 hover:opacity-95 sm:w-auto">
                  Open dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/signup">
                  <Button size="lg" className="w-full rounded-full bg-gradient-primary text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5 hover:opacity-95 sm:w-auto">
                    Start free <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="w-full rounded-full border-border bg-card/70 backdrop-blur sm:w-auto">
                    Login
                  </Button>
                </Link>
              </>
            )}
          </div>

          <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm backdrop-blur transition-transform hover:-translate-y-1 hover:shadow-elegant">
                <stat.icon className="mb-3 h-4 w-4 text-primary" />
                <div className="text-xl font-semibold text-foreground sm:text-2xl">{stat.value}</div>
                <div className="mt-1 text-[11px] font-medium text-muted-foreground sm:text-xs">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <HeroPreview metrics={metrics} />
      </div>
    </section>
  )
}

function HeroPreview({ metrics }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="relative"
    >
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-primary opacity-15 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card shadow-elegant">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-destructive/70" />
            <span className="h-3 w-3 rounded-full bg-warning/70" />
            <span className="h-3 w-3 rounded-full bg-success/70" />
          </div>
          <Badge variant="secondary" className="rounded-full">Merchant dashboard</Badge>
        </div>

        <div className="grid gap-4 p-5">
          <div className="grid grid-cols-3 gap-3">
            <PreviewMetric title="Revenue" value={formatBDT(metrics.revenue)} icon={BarChart3} />
            <PreviewMetric title="Orders" value={compactNumber(metrics.orders, '0')} icon={ShoppingBag} />
            <PreviewMetric title="Shops" value={compactNumber(metrics.stores, '0')} icon={Store} />
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Setup checklist</div>
                <div className="text-xs text-muted-foreground">Launch-ready workflow</div>
              </div>
              <Badge className="rounded-full bg-success/10 text-success hover:bg-success/10">4/4</Badge>
            </div>
            <div className="space-y-3">
              {['Create store', 'Add products', 'Enable payment', 'Publish storefront'].map((step) => (
                <div key={step} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2">
                  <Check className="h-4 w-4 rounded-full bg-success p-0.5 text-success-foreground" />
                  <span className="text-sm font-medium">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-secondary/10 p-4">
              <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Globe className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold">Professional storefront</div>
              <p className="mt-1 text-xs text-muted-foreground">Clean route, responsive layout, cart drawer.</p>
            </div>
            <div className="rounded-2xl border border-border bg-gradient-to-br from-success/10 to-accent/10 p-4">
              <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-2xl bg-success text-success-foreground">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold">Local checkout</div>
              <p className="mt-1 text-xs text-muted-foreground">COD, bKash, Nagad, Rocket, cards.</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function PreviewMetric({ title, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <Icon className="mb-4 h-4 w-4 text-primary" />
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{title}</div>
    </div>
  )
}

function LiveStores({ shops }) {
  if (!shops?.length) return null

  return (
    <section className="border-y border-border bg-card/55 py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Badge variant="secondary" className="mb-3 rounded-full">Live shops</Badge>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">Recently launched storefronts</h2>
          </div>
          <Link to="/signup" className="inline-flex items-center text-sm font-semibold text-primary hover:underline">
            Launch yours <ChevronRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div {...stagger} className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shops.map((shop) => (
            <motion.a
              key={shop.id}
              {...item}
              href={getStorefrontUrl(shop.subdomain, { absolute: false })}
              className="group rounded-3xl border border-border bg-background p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-elegant"
            >
              <div className="mb-8 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-primary text-lg font-semibold text-primary-foreground">
                  {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : (shop.shop_name || 'S').slice(0, 1)}
                </div>
                <Badge className="rounded-full bg-success/10 text-success hover:bg-success/10">Live</Badge>
              </div>
              <h3 className="font-semibold text-foreground group-hover:text-primary">{shop.shop_name || 'Online shop'}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{shop.business_category || 'Brand store'}</p>
              <p className="mt-4 truncate text-xs text-muted-foreground">/shop/{shop.subdomain}</p>
            </motion.a>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

const features = [
  { icon: Globe, title: 'Modern storefront', desc: 'A clean, mobile-first shop with hero banners, quick view, cart drawer, filters, and about page.' },
  { icon: CreditCard, title: 'Payment control', desc: 'Enable the methods you want. One active method is enough to publish and sell.' },
  { icon: Package, title: 'Product management', desc: 'Create products, categories, variants, images, prices, stock, and publish status.' },
  { icon: Truck, title: 'Order tracking', desc: 'Customers can track orders while merchants manage status timelines and fulfillment.' },
  { icon: Users, title: 'Customer accounts', desc: 'Customers can sign up, manage addresses, view orders, and checkout faster.' },
  { icon: ShieldCheck, title: 'Protected access', desc: 'Email and Google login, CAPTCHA support, role separation, and admin controls.' },
]

function Features() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4 rounded-full">Platform features</Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Everything needed to run a shop</h2>
          <p className="mt-4 text-muted-foreground">Storefront, checkout, products, orders, customers, payments, and analytics — in one place.</p>
        </motion.div>

        <motion.div {...stagger} className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <motion.div key={feature.title} {...item} className="group rounded-3xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-elegant">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow transition-transform group-hover:scale-105">
                <feature.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

const steps = [
  { title: 'Create your account', desc: 'Sign up with email or Google and open your merchant dashboard.', icon: LockKeyhole },
  { title: 'Build your store', desc: 'Choose a subdomain, add products, upload banners, and set payment methods.', icon: LayoutDashboard },
  { title: 'Start selling', desc: 'Publish your storefront and share your clean shop link with customers.', icon: ShoppingBag },
]

function HowItWorks() {
  return (
    <section id="how" className="bg-muted/35 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4 rounded-full">How it works</Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Launch in three simple steps</h2>
        </motion.div>

        <motion.div {...stagger} className="mt-14 grid gap-5 lg:grid-cols-3">
          {steps.map((step, index) => (
            <motion.div key={step.title} {...item} className="relative rounded-3xl border border-border bg-card p-7 shadow-sm">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="text-5xl font-semibold text-muted">0{index + 1}</span>
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function Payments() {
  const methods = ['Cash on Delivery', 'bKash', 'Nagad', 'Rocket', 'SSLCommerz']

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <motion.div {...fadeUp}>
          <Badge variant="secondary" className="mb-4 rounded-full">Payments</Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Flexible payment setup for local stores</h2>
          <p className="mt-4 leading-7 text-muted-foreground">
            Merchants can enable the methods they want. A store needs only one active payment method to publish.
          </p>
        </motion.div>

        <motion.div {...stagger} className="grid gap-4 sm:grid-cols-2">
          {methods.map((method, index) => (
            <motion.div key={method} {...item} className="flex items-center justify-between rounded-3xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-elegant">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
                  {index === 0 ? <Truck className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                </div>
                <span className="font-semibold">{method}</span>
              </div>
              <Badge className="rounded-full bg-success/10 text-success hover:bg-success/10">Ready</Badge>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

const plans = [
  {
    name: 'Starter',
    price: '৳0',
    desc: 'For launching your first shop',
    features: ['1 active store', 'Clean storefront link', 'Product and order dashboard', 'Basic payment setup'],
    cta: 'Start free',
  },
  {
    name: 'Growth',
    price: '৳99',
    desc: 'For growing brands',
    features: ['More customization', 'Advanced analytics', 'More marketing controls', 'Priority support'],
    cta: 'Upgrade later',
    popular: true,
  },
  {
    name: 'Pro',
    price: '৳499',
    desc: 'For scaling teams',
    features: ['Custom domain', 'API access', 'Team/admin controls', 'Dedicated support'],
    cta: 'Contact sales',
  },
]

function Pricing() {
  return (
    <section id="pricing" className="bg-muted/35 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4 rounded-full">Pricing</Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Start free, upgrade when ready</h2>
          <p className="mt-4 text-muted-foreground">The free plan is perfect for one merchant starting one store.</p>
        </motion.div>

        <motion.div {...stagger} className="mt-14 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <motion.div key={plan.name} {...item} className={`relative rounded-3xl border bg-card p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-elegant ${plan.popular ? 'border-primary shadow-glow' : 'border-border'}`}>
              {plan.popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary px-4">Popular</Badge>}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.desc}</p>
              <div className="mt-6 flex items-end gap-1">
                <span className="text-4xl font-semibold tracking-tight">{plan.price}</span>
                {plan.name !== 'Starter' && <span className="pb-1 text-sm text-muted-foreground">/month</span>}
              </div>
              <ul className="mt-7 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link to="/signup">
                <Button className={`mt-8 w-full rounded-full ${plan.popular ? 'bg-gradient-primary shadow-glow' : ''}`} variant={plan.popular ? 'default' : 'outline'}>
                  {plan.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

const faqs = [
  { q: 'Can I start without a custom domain?', a: 'Yes. Your shop works with a clean BazarHQ route like /shop/your-shop. Custom domains can be added later.' },
  { q: 'How many stores can a free merchant create?', a: 'The free version allows one merchant account to run one active store.' },
  { q: 'Which payment methods can I use?', a: 'Stores can enable Cash on Delivery and supported local payment methods such as bKash, Nagad, Rocket, and SSLCommerz.' },
  { q: 'Can customers create accounts?', a: 'Yes. Customers can sign up, save addresses, place orders, and track order history.' },
  { q: 'Does BazarHQ work on mobile?', a: 'Yes. Storefront, checkout, and dashboard screens are designed to be responsive.' },
  { q: 'Can I use my own domain?', a: 'Yes. Custom domains can be added to any store pro plan, not available in the free plan.' },
  { q: 'Is there a limit on products or orders?', a: 'No. Merchants can create as many products and manage as many orders as they want.' },
  { q: 'Can I upgrade my plan later?', a: 'Yes. Merchants can upgrade to a paid plan at any time from the dashboard.' },
  { q: 'Is there a trial period for paid plans?', a: 'No. Paid plans are billed monthly, and merchants can cancel anytime.' },
  { q: 'What support is available?', a: 'Email support is available for all merchants. Paid plans receive priority support.' },
  { q: 'Can I switch back to the free plan?', a: 'Yes. Merchants can downgrade to the free plan at any time, but custom domains will be removed.' },
  { q: 'Is BazarHQ secure?', a: 'Yes. BazarHQ uses HTTPS, secure authentication, and follows best practices for data protection.' },
  
]

function FAQ() {
  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center">
          <Badge variant="secondary" className="mb-4 rounded-full">FAQ</Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Common questions</h2>
        </motion.div>
        <Accordion type="single" collapsible className="mt-10 rounded-3xl border border-border bg-card px-5 shadow-sm">
          {faqs.map((faq, index) => (
            <AccordionItem key={faq.q} value={`item-${index}`} className="border-border">
              <AccordionTrigger className="text-left text-base font-semibold hover:no-underline">{faq.q}</AccordionTrigger>
              <AccordionContent className="leading-7 text-muted-foreground">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
      <motion.div {...fadeUp} className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-primary p-8 text-center text-primary-foreground shadow-glow sm:p-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.16),transparent_40%)]" />
        <div className="relative">
          <Zap className="mx-auto h-10 w-10" />
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">Ready to open your online shop?</h2>
          <p className="mx-auto mt-4 max-w-xl opacity-90">Create your account, build your store, and publish when you are ready.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/signup">
              <Button size="lg" variant="secondary" className="w-full rounded-full sm:w-auto">
                Start free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="w-full rounded-full border-white/40 bg-white/10 text-white hover:bg-white/20 sm:w-auto">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

function MobileAppDownload() {
  return (
    <section id="mobile-app" className="px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
      <motion.div
        {...fadeUp}
        className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-elegant lg:grid-cols-[1.15fr_0.85fr]"
      >
        <div className="relative p-8 sm:p-10 lg:p-12">
          <div className="absolute -left-20 top-10 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <Badge variant="secondary" className="mb-4 gap-2 rounded-full">
              <Smartphone className="h-3.5 w-3.5 text-primary" />
              Mobile app
            </Badge>
            <h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-5xl">
              Download the BazarHQ mobile APK
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Install the Android app to manage products, orders, customers, and storefront updates faster from your phone.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={APK_DOWNLOAD_URL} download>
                <Button size="lg" className="w-full rounded-full bg-gradient-primary shadow-glow sm:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Download APK
                </Button>
              </a>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=BazarHQ%20Support`}>
                <Button size="lg" variant="outline" className="w-full rounded-full sm:w-auto">
                  <Mail className="mr-2 h-4 w-4" />
                  Contact support
                </Button>
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center border-t border-border bg-gradient-to-br from-primary/8 via-background to-emerald-500/10 p-8 lg:border-l lg:border-t-0">
          <div className="rounded-[2rem] border border-border bg-white p-5 text-center shadow-elegant">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <QrCode className="h-5 w-5" />
            </div>
            <img
              src="/bazarhq-apk-qr.svg"
              alt="BazarHQ APK download QR code"
              className="mx-auto h-44 w-44 rounded-2xl border border-slate-200 bg-white p-2"
            />
            <p className="mt-4 text-sm font-semibold text-slate-950">Scan to download</p>
            <p className="mt-1 text-xs text-slate-500">Android APK link</p>
          </div>
        </div>
      </motion.div>
    </section>
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
    return (
      <span title={`${link.label} link not added yet`} aria-label={link.label} className="opacity-55">
        {icon}
      </span>
    )
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
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
      { label: 'Mobile app', href: '#mobile-app' },
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
      { label: 'Payments', href: '#features' },
      { label: 'Live shops', href: '#features' },
      { label: 'Dashboard', href: '/merchant' },
      { label: 'Support email', href: `mailto:${SUPPORT_EMAIL}?subject=BazarHQ%20Support` },
    ],
  },
]

function Footer() {
  const quickLinks = [
    { label: 'Download app', href: '#mobile-app' },
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
              A modern commerce platform for Bangladeshi merchants to launch storefronts, manage products, accept payments, and track orders from one clean dashboard.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Secure auth', 'Local payments', 'Mobile storefront'].map((label) => (
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
                <Mail className="h-4 w-4 text-primary" />
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
                {socialLinks.map((link) => (
                  <SocialButton key={link.label} link={link} />
                ))}
              </div>
            </div>
          </div>
        </div>
                <hr className="my-10 border-t border-border" />
        <div className="mt-30 flex flex-col gap-3 text-xs text-slate-500 sm:mt-20 lg:mt-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="leading-6">
            <p className="font-semibold text-slate-300">© 2026 BazarHQ. All rights reserved.</p>
            <p className="mt-1 max-w-xl">Designed and maintained by SoftThinkers (CSE-15 BRUR) for modern online commerce in Bangladesh.</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 font-medium text-slate-400 lg:justify-end">
            {quickLinks.map((link) => (
              <a key={link.label} href={link.href} className="transition-colors hover:text-white">
                {link.label}
              </a>
            ))}

          </div>
        </div>
      </div>
    </footer>
  )
}

export default Landing
