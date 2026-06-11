import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowRight, Check, ShoppingBag, CreditCard, Smartphone, BarChart3, Package, Truck, Sparkles, Zap, Globe, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/use-auth'

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-80px' }, transition: { duration: 0.6, ease: 'easeOut' } }

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <Features />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  )
}

function Nav() {
  const { user } = useAuth()
  return (
    <header className="sticky top-0 z-50 glass border-b border-border/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo size="md" />
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</a>
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</a>
          <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/merchant"><Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">Go to Dashboard</Button></Link>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sign in</Button></Link>
              <Link to="/signup"><Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">Start Free</Button></Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function Hero() {
  const { user } = useAuth()
  return (
    <section className="relative overflow-hidden bg-gradient-hero">
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-32">
        <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-6 gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium shadow-sm">
            <Sparkles className="h-3 w-3 text-accent" />
            New • Built for Bangladesh 🇧🇩
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Launch Your <span className="text-gradient">Online Shop</span> in Minutes
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            BazarHQ gives Bangladeshi merchants everything to sell online — beautiful storefronts, bKash & Nagad, mobile-first checkout, and real-time analytics. No code required.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {user ? (
              <Link to="/merchant"><Button size="lg" className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 sm:w-auto">Open my dashboard <ArrowRight className="ml-1.5 h-4 w-4" /></Button></Link>
            ) : (
              <>
                <Link to="/signup"><Button size="lg" className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 sm:w-auto">Start Free <ArrowRight className="ml-1.5 h-4 w-4" /></Button></Link>
                <Link to="/login"><Button size="lg" variant="outline" className="w-full rounded-full sm:w-auto">Sign in</Button></Link>
              </>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No credit card required • Free forever plan</p>
        </motion.div>
      </div>
    </section>
  )
}

const features = [
  { icon: Globe, title: 'Multi-tenant Shops', desc: 'Each merchant gets a custom subdomain like yourshop.bazarhq.com — provisioned in seconds.' },
  { icon: CreditCard, title: 'Local Payments', desc: 'bKash, Nagad, SSLCommerz, and Cash on Delivery — all integrated out of the box.' },
  { icon: Smartphone, title: 'Mobile-first Storefronts', desc: 'Lightning-fast, beautiful storefronts that convert on every device.' },
  { icon: BarChart3, title: 'Real-time Analytics', desc: 'Track revenue, visitors, conversion, and top products with elegant dashboards.' },
  { icon: Package, title: 'Product Management', desc: 'Variants, categories, bulk upload, low-stock alerts — manage thousands of SKUs effortlessly.' },
  { icon: Truck, title: 'Order Management', desc: 'Streamlined fulfillment with status timelines, invoices, and courier integration.' },
]

function Features() {
  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4 rounded-full">Everything you need</Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">A complete commerce OS</h2>
          <p className="mt-4 text-muted-foreground">From storefront to checkout to analytics — purpose-built for Bangladesh.</p>
        </motion.div>
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div key={f.title} {...fadeUp} transition={{ duration: 0.6, delay: i * 0.05 }} className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-elegant">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const plans = [
  { name: 'Starter', price: '৳ 0', desc: 'For testing the waters', features: ['1 storefront', '50 products', 'COD only', 'BazarHQ branding'], cta: 'Start Free' },
  { name: 'Growth', price: '৳ 1,499', desc: 'For growing brands', features: ['Custom subdomain', 'Unlimited products', 'All payment methods', 'Analytics & themes', 'Remove branding'], cta: 'Start 14-day trial', popular: true },
  { name: 'Pro', price: '৳ 3,999', desc: 'For scaling businesses', features: ['Everything in Growth', 'Priority support', 'Advanced analytics', 'API access', 'Custom domain'], cta: 'Talk to sales' },
]

function Pricing() {
  return (
    <section id="pricing" className="py-24 sm:py-32 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-4 rounded-full">Pricing</Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Simple, transparent pricing</h2>
          <p className="mt-4 text-muted-foreground">Start free. Upgrade when you grow. Cancel anytime.</p>
        </motion.div>
        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((p, i) => (
            <motion.div key={p.name} {...fadeUp} transition={{ duration: 0.6, delay: i * 0.05 }}
              className={`relative rounded-2xl border bg-card p-8 ${p.popular ? 'border-primary shadow-glow' : 'border-border'}`}>
              {p.popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-primary">Most Popular</Badge>}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="text-sm text-muted-foreground">{p.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-semibold">{p.price}</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <ul className="mt-6 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 text-success" /> {f}</li>
                ))}
              </ul>
              <Link to="/signup">
                <Button className={`mt-8 w-full ${p.popular ? 'bg-gradient-primary shadow-glow' : ''}`} variant={p.popular ? 'default' : 'outline'}>{p.cta}</Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const faqs = [
  { q: 'How long does it take to launch a shop?', a: 'Under 10 minutes. Pick a subdomain, choose a theme, add products and connect bKash — you\'re live.' },
  { q: 'Which payment methods are supported?', a: 'bKash, Nagad, Rocket, SSLCommerz (cards) and Cash on Delivery — all out of the box.' },
  { q: 'Do I need a domain name?', a: 'No. You get a free yourshop.bazarhq.com subdomain. Custom domains are available on Pro.' },
  { q: 'Can I customise the storefront design?', a: 'Yes — choose from professional themes, change colors, fonts, banners and announcement bars instantly.' },
  { q: 'Is there a transaction fee?', a: 'No platform transaction fees. You only pay your payment gateway\'s standard rate.' },
]

function FAQ() {
  return (
    <section id="faq" className="py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center">
          <Badge variant="secondary" className="mb-4 rounded-full">FAQ</Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Questions, answered</h2>
        </motion.div>
        <Accordion type="single" collapsible className="mt-12">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-border">
              <AccordionTrigger className="text-left text-base font-medium hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="px-4 pb-24 sm:px-6 lg:px-8">
      <motion.div {...fadeUp} className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-primary p-10 text-center text-primary-foreground shadow-glow sm:p-16">
        <div className="relative">
          <Zap className="mx-auto h-10 w-10" />
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">Ready to launch your shop?</h2>
          <p className="mx-auto mt-4 max-w-xl opacity-90">Build your storefront, accept local payments, and grow with BazarHQ.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/signup"><Button size="lg" variant="secondary" className="w-full sm:w-auto">Start Free Today <ArrowRight className="ml-1.5 h-4 w-4" /></Button></Link>
            <Link to="/login"><Button size="lg" variant="outline" className="w-full border-white/40 bg-white/10 text-white hover:bg-white/20 sm:w-auto">Sign in</Button></Link>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo size="sm" />
            <p className="mt-3 text-sm text-muted-foreground">Commerce infrastructure for Bangladesh.</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Shield className="h-3.5 w-3.5" /> SOC2 • PCI-DSS ready</div>
          </div>
          {[
            { t: 'Product', l: ['Features', 'Pricing', 'Themes', 'Integrations'] },
            { t: 'Company', l: ['About', 'Blog', 'Careers', 'Contact'] },
            { t: 'Legal', l: ['Privacy', 'Terms', 'Security', 'Refunds'] },
          ].map((c) => (
            <div key={c.t}>
              <div className="mb-3 text-sm font-medium">{c.t}</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {c.l.map((x) => <li key={x}><a href="#" className="hover:text-foreground">{x}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">© 2026 BazarHQ. Made in Dhaka 🇧🇩</p>
          <p className="text-xs text-muted-foreground">All systems operational</p>
        </div>
      </div>
    </footer>
  )
}

export default Landing
