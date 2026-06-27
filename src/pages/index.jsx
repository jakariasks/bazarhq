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
  LockKeyhole,
  Menu,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
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
      <Footer />
    </div>
  )
}

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
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
            <Link to="/track">
              <Button variant="ghost" size="sm" className="rounded-full px-4 font-semibold text-slate-600 hover:text-slate-950">
                Track order
              </Button>
            </Link>
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
                <Link to="/track" onClick={closeMenu} className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Track order
                </Link>
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

const footerGroups = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
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
      { label: 'Support', href: 'mailto:support@bazarhq.com' },
    ],
  },
]

function Footer() {
  return (
    <footer className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_32%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1.8fr]">
          <div>
            <Logo size="lg" className="text-white" />
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">
              A modern commerce platform for Bangladeshi merchants to launch storefronts, manage products, accept payments, and track orders from one clean dashboard.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Secure auth', 'Local payments', 'Mobile storefront'].map((label) => (
                <span key={label} className="rounded-full border border-white/10 bg-white/7 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur">
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
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
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">© 2026 BazarHQ. Built for modern online commerce in Bangladesh.</p>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.8)]" />
              Platform online
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:block" />
            <a href="/superadmin/login" className="transition-colors hover:text-white">Admin</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Landing
