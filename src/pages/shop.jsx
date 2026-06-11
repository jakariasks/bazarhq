import { Link, useNavigate } from '@tanstack/react-router'
import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingBag, Package, Mail, Phone, MapPin, MessageCircle,
  X, Plus, Minus, Trash2, Pencil, Search, SlidersHorizontal,
  ChevronDown, Star, ArrowRight, Heart, Grid3X3, List,
  Globe, ExternalLink, ArrowUp,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useCurrentStore } from '@/lib/use-current-store'
import { getTheme, themeCssVars } from '@/lib/preview-themes'

export default function ShopPage() {
  const { user } = useAuth()
  const { store } = useCurrentStore()
  const [cartOpen, setCartOpen] = useState(false)
  const [cartItems, setCartItems] = useState([])
  const [searchQ, setSearchQ] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortBy, setSortBy] = useState('newest')
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const [filterOpen, setFilterOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const searchRef = useRef(null)

  const { data: profile } = useQuery({
    queryKey: ['shop-profile', store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { data } = await supabase.from('stores').select('*').eq('id', store.id).maybeSingle()
      return data
    },
  })

  const { data: allProducts = [] } = useQuery({
    queryKey: ['shop-products', store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*')
        .eq('store_id', store.id).eq('status', 'published')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  // Scroll to top button
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isOwner = user?.id === store?.owner_id
  const theme = getTheme(profile?.theme_id)
  const brandColor = profile?.brand_color || theme.swatch
  const symbol = profile?.currency === 'USD' ? '$' : profile?.currency === 'EUR' ? '€' : '৳'

  // Derive categories from products
  const categories = useMemo(() => {
    const cats = [...new Set(allProducts.map(p => p.category).filter(Boolean))]
    return ['All', ...cats]
  }, [allProducts])

  // Filter + sort
  const products = useMemo(() => {
    let list = [...allProducts]
    if (searchQ.trim()) list = list.filter(p => p.title.toLowerCase().includes(searchQ.toLowerCase()) || (p.description || '').toLowerCase().includes(searchQ.toLowerCase()))
    if (activeCategory !== 'All') list = list.filter(p => p.category === activeCategory)
    if (priceRange.min !== '') list = list.filter(p => Number(p.price) >= Number(priceRange.min))
    if (priceRange.max !== '') list = list.filter(p => Number(p.price) <= Number(priceRange.max))
    switch (sortBy) {
      case 'price-asc': list.sort((a, b) => Number(a.price) - Number(b.price)); break
      case 'price-desc': list.sort((a, b) => Number(b.price) - Number(a.price)); break
      case 'name': list.sort((a, b) => a.title.localeCompare(b.title)); break
      default: break // newest — already sorted by created_at
    }
    return list
  }, [allProducts, searchQ, activeCategory, sortBy, priceRange])

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0)
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0)

  const addToCart = (item) => {
    setCartItems(prev => {
      const ex = prev.find(i => i.id === item.id)
      if (ex) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...item, qty: 1 }]
    })
    setCartOpen(true)
  }
  const updateQty = (id, delta) => setCartItems(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0))
  const removeItem = (id) => setCartItems(prev => prev.filter(i => i.id !== id))

  const clearFilters = () => { setSearchQ(''); setActiveCategory('All'); setSortBy('newest'); setPriceRange({ min: '', max: '' }) }
  const hasFilters = searchQ || activeCategory !== 'All' || sortBy !== 'newest' || priceRange.min || priceRange.max

  if (!store) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center p-8">
      <Package className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">No store found</h2>
      <Link to="/merchant"><Button className="bg-gradient-primary shadow-glow">Go to Dashboard</Button></Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-background" style={themeCssVars(theme)}>

      {/* Announcement bar */}
      <AnimatePresence>
        {profile?.announcement_enabled && profile?.announcement_text && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden text-center text-sm font-medium text-white py-2 px-4" style={{ background: brandColor }}>
            {profile.announcement_text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {profile?.logo_url
              ? <img src={profile.logo_url} alt={profile.shop_name} className="h-9 w-9 rounded-xl object-cover" />
              : <img src="/logo.png" alt="BazarHQ" className="h-9 w-9 rounded-xl object-contain" />
            }
            <div>
              <div className="font-bold text-lg leading-tight">{profile?.shop_name || 'My Shop'}</div>
              {profile?.tagline && <div className="hidden text-xs text-muted-foreground sm:block">{profile.tagline}</div>}
            </div>
          </div>

          {/* Desktop search */}
          <div className="relative mx-4 hidden max-w-sm flex-1 md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input ref={searchRef} value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Search products…" className="h-9 pl-9 pr-4 rounded-full bg-muted border-0 focus-visible:ring-2" />
            {searchQ && (
              <button onClick={() => setSearchQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isOwner && (
              <Link to="/merchant">
                <Button size="sm" variant="outline" className="hidden sm:inline-flex gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Edit store
                </Button>
              </Link>
            )}
            <motion.button whileTap={{ scale: 0.92 }} onClick={() => setCartOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-sm transition hover:shadow-md">
              <ShoppingBag className="h-5 w-5" />
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span key="badge" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow"
                    style={{ background: brandColor }}>
                    {cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </header>

      {/* ── HERO BANNER ── */}
      <section className="relative overflow-hidden">
        {profile?.banner_url ? (
          <div className="relative h-64 sm:h-80 lg:h-96">
            <img src={profile.banner_url} alt="Shop banner" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6 sm:p-10 text-white">
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="text-3xl font-bold sm:text-5xl drop-shadow">{profile?.shop_name}</motion.h1>
              {profile?.description && (
                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="mt-2 max-w-md text-sm opacity-90 drop-shadow">{profile.description}</motion.p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-56 sm:h-72 items-end p-6 sm:p-10"
            style={{ background: `linear-gradient(135deg, ${brandColor}dd, ${brandColor}88)` }}>
            <div className="text-white">
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="text-3xl font-bold sm:text-5xl">{profile?.shop_name || 'My Shop'}</motion.h1>
              {profile?.description && (
                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="mt-2 max-w-md text-sm opacity-90">{profile.description}</motion.p>
              )}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="mt-4 flex items-center gap-2">
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
                  {allProducts.length} Products
                </span>
                {profile?.city && (
                  <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
                    <MapPin className="h-3 w-3" />{profile.city}
                  </span>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </section>

      {/* ── MAIN CONTENT ── */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Mobile search */}
        <div className="relative mb-4 md:hidden">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Search products…" className="pl-9 pr-4 rounded-full bg-muted border-0" />
          {searchQ && (
            <button onClick={() => setSearchQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Category tabs */}
        {categories.length > 1 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map(cat => (
              <motion.button key={cat} whileTap={{ scale: 0.95 }} onClick={() => setActiveCategory(cat)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                  activeCategory === cat
                    ? 'border-transparent text-white shadow-md'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40'
                }`}
                style={activeCategory === cat ? { background: brandColor } : {}}>
                {cat}
              </motion.button>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{products.length}</span> product{products.length !== 1 ? 's' : ''}
              {hasFilters && ' found'}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/20 transition-colors">
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Filter button */}
            <button onClick={() => setFilterOpen(v => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-all ${filterOpen ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filter
            </button>
            {/* Sort */}
            <div className="relative">
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="h-8 appearance-none rounded-lg border border-border bg-card pl-3 pr-7 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option value="newest">Newest</option>
                <option value="price-asc">Price: Low → High</option>
                <option value="price-desc">Price: High → Low</option>
                <option value="name">Name A–Z</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
            {/* View toggle */}
            <div className="flex overflow-hidden rounded-lg border border-border">
              {[{ v: 'grid', Icon: Grid3X3 }, { v: 'list', Icon: List }].map(({ v, Icon }) => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`flex h-8 w-8 items-center justify-center transition-colors ${viewMode === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter panel */}
        <AnimatePresence>
          {filterOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="mb-6 rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Min price (৳)</label>
                    <Input type="number" min={0} value={priceRange.min} onChange={e => setPriceRange(p => ({ ...p, min: e.target.value }))}
                      placeholder="0" className="h-8 w-28 text-sm" />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Max price (৳)</label>
                    <Input type="number" min={0} value={priceRange.max} onChange={e => setPriceRange(p => ({ ...p, max: e.target.value }))}
                      placeholder="Any" className="h-8 w-28 text-sm" />
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setPriceRange({ min: '', max: '' })}>Reset price</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Products grid / list */}
        {products.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"><Package className="h-7 w-7 text-muted-foreground" /></div>
            <h3 className="mt-4 text-lg font-semibold">{hasFilters ? 'No products match your search' : 'No products yet'}</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">{hasFilters ? 'Try clearing your filters.' : 'Products will appear here once published.'}</p>
            {hasFilters && <Button variant="outline" className="mt-4" onClick={clearFilters}>Clear all filters</Button>}
            {!hasFilters && isOwner && <Link to="/merchant/products" className="mt-4"><Button className="bg-gradient-primary shadow-glow">Add products</Button></Link>}
          </motion.div>
        ) : viewMode === 'grid' ? (
          <motion.div layout className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {products.map((p, i) => (
                <ProductCard key={p.id} p={p} i={i} symbol={symbol} brandColor={brandColor} isOwner={isOwner} onAdd={addToCart} />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {products.map((p, i) => (
                <ProductRow key={p.id} p={p} i={i} symbol={symbol} brandColor={brandColor} isOwner={isOwner} onAdd={addToCart} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      {(profile?.contact_email || profile?.phone || profile?.city || profile?.whatsapp_number) && (
        <footer className="mt-12 border-t border-border">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  {profile?.logo_url
                    ? <img src={profile.logo_url} alt={profile.shop_name} className="h-8 w-8 rounded-lg object-cover" />
                    : <img src="/logo.png" alt="BazarHQ" className="h-8 w-8 rounded-lg object-contain" />
                  }
                  <span className="font-bold">{profile?.shop_name}</span>
                </div>
                {profile?.description && <p className="text-sm text-muted-foreground line-clamp-3">{profile.description}</p>}
              </div>
              <div>
                <h4 className="mb-3 text-sm font-semibold">Contact</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {profile?.contact_email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0" />{profile.contact_email}</div>}
                  {profile?.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" />{profile.phone}</div>}
                  {(profile?.city || profile?.address) && <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{[profile.address, profile.city].filter(Boolean).join(', ')}</div>}
                </div>
              </div>
              <div>
                <h4 className="mb-3 text-sm font-semibold">Follow us</h4>
                <div className="flex gap-3">
                  {profile?.facebook_handle && (
                    <a href={`https://facebook.com/${profile.facebook_handle}`} target="_blank" rel="noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition hover:bg-primary hover:text-primary-foreground">
                      <span className="text-xs font-bold">f</span>
                    </a>
                  )}
                  {profile?.instagram_handle && (
                    <a href={`https://instagram.com/${profile.instagram_handle}`} target="_blank" rel="noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition hover:bg-primary hover:text-primary-foreground">
                      <span className="text-xs font-bold">in</span>
                    </a>
                  )}
                  {profile?.whatsapp_number && (
                    <a href={`https://wa.me/${profile.whatsapp_number.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition hover:bg-green-500 hover:text-white">
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
              <div>
                <h4 className="mb-3 text-sm font-semibold">Powered by</h4>
                <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <img src="/logo.png" alt="BazarHQ" className="h-6 w-6 rounded object-contain" />
                  BazarHQ
                </Link>
              </div>
            </div>
            <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} {profile?.shop_name}. All rights reserved.
            </div>
          </div>
        </footer>
      )}

      {/* ── CART DRAWER ── */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)} />
            <motion.div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background shadow-2xl"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}>
              {/* Cart header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold">Your Cart</h2>
                  <p className="text-xs text-muted-foreground">{cartCount} item{cartCount !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setCartOpen(false)} className="rounded-lg p-2 transition hover:bg-muted"><X className="h-5 w-5" /></button>
              </div>
              {/* Cart items */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {cartItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <ShoppingBag className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <p className="mt-4 text-sm font-medium">Your cart is empty</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => setCartOpen(false)}>Continue shopping</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {cartItems.map((item) => (
                        <motion.div key={item.id} layout initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24, height: 0 }}
                          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {item.image
                              ? <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                              : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Package className="h-5 w-5" /></div>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
                            <p className="text-sm font-semibold text-primary">{symbol} {Number(item.price).toLocaleString()}</p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <button onClick={() => updateQty(item.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-md border transition hover:bg-muted"><Minus className="h-3 w-3" /></button>
                              <span className="min-w-[1.5rem] text-center text-sm font-semibold">{item.qty}</span>
                              <button onClick={() => updateQty(item.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-md border transition hover:bg-muted"><Plus className="h-3 w-3" /></button>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{symbol} {(item.price * item.qty).toLocaleString()}</p>
                            <button onClick={() => removeItem(item.id)} className="mt-2 text-muted-foreground transition hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
              {/* Cart footer */}
              {cartItems.length > 0 && (
                <div className="border-t border-border bg-card px-5 py-4">
                  <div className="mb-3 space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{symbol} {cartTotal.toLocaleString()}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>Calculated at checkout</span></div>
                    <div className="flex justify-between border-t border-border pt-1.5 font-bold text-base"><span>Total</span><span>{symbol} {cartTotal.toLocaleString()}</span></div>
                  </div>
                  <Button className="w-full text-white font-semibold text-base h-11" style={{ background: brandColor }}>
                    Checkout <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <button onClick={() => setCartOpen(false)} className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Continue shopping
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Scroll to top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full shadow-lg text-white transition hover:opacity-90"
            style={{ background: brandColor }}>
            <ArrowUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Product Card (Grid view) ──
function ProductCard({ p, i, symbol, brandColor, isOwner, onAdd }) {
  const [liked, setLiked] = useState(false)
  const outOfStock = (p.stock ?? 0) <= 0
  const onSale = p.compare_at_price && Number(p.compare_at_price) > Number(p.price)
  const discount = onSale ? Math.round((1 - Number(p.price) / Number(p.compare_at_price)) * 100) : 0

  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">

      {/* Image */}
      <div className="relative overflow-hidden aspect-square bg-muted">
        {p.images?.[0]
          ? <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Package className="h-10 w-10" /></div>
        }
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 transition-all duration-300 group-hover:bg-black/10" />

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {onSale && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow" style={{ background: brandColor }}>-{discount}%</span>}
          {outOfStock && <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">Sold out</span>}
        </div>

        {/* Wishlist */}
        <motion.button whileTap={{ scale: 0.8 }} onClick={() => setLiked(v => !v)}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110">
          <Heart className={`h-4 w-4 transition-colors ${liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
        </motion.button>

        {/* Quick add */}
        {!outOfStock && (
          <motion.button whileTap={{ scale: 0.95 }}
            onClick={() => onAdd({ id: p.id, title: p.title, price: Number(p.price), image: p.images?.[0] })}
            className="absolute bottom-0 left-0 right-0 translate-y-full py-2.5 text-sm font-semibold text-white transition-all duration-300 group-hover:translate-y-0"
            style={{ background: brandColor }}>
            Add to cart
          </motion.button>
        )}

        {/* Owner edit */}
        {isOwner && (
          <Link to="/merchant/products" className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[11px] font-medium shadow opacity-0 transition group-hover:opacity-100">
            <Pencil className="h-3 w-3" /> Edit
          </Link>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        {p.category && <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{p.category}</p>}
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{p.title}</h3>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <span className="text-base font-bold">{symbol} {Number(p.price).toLocaleString()}</span>
            {onSale && <span className="ml-1.5 text-xs text-muted-foreground line-through">{symbol} {Number(p.compare_at_price).toLocaleString()}</span>}
          </div>
          {outOfStock && <span className="text-xs text-muted-foreground">Out of stock</span>}
        </div>
      </div>
    </motion.div>
  )
}

// ── Product Row (List view) ──
function ProductRow({ p, i, symbol, brandColor, isOwner, onAdd }) {
  const outOfStock = (p.stock ?? 0) <= 0
  const onSale = p.compare_at_price && Number(p.compare_at_price) > Number(p.price)
  const discount = onSale ? Math.round((1 - Number(p.price) / Number(p.compare_at_price)) * 100) : 0

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.2) }}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
        {p.images?.[0]
          ? <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          : <div className="flex h-full w-full items-center justify-center"><Package className="h-6 w-6 text-muted-foreground" /></div>}
        {onSale && <span className="absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ background: brandColor }}>-{discount}%</span>}
      </div>
      <div className="min-w-0 flex-1">
        {p.category && <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{p.category}</p>}
        <h3 className="font-semibold text-sm sm:text-base">{p.title}</h3>
        {p.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{p.description}</p>}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="font-bold text-base">{symbol} {Number(p.price).toLocaleString()}</span>
          {onSale && <span className="text-xs text-muted-foreground line-through">{symbol} {Number(p.compare_at_price).toLocaleString()}</span>}
        </div>
      </div>
      <div className="shrink-0">
        {outOfStock
          ? <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Out of stock</span>
          : <motion.button whileTap={{ scale: 0.93 }}
              onClick={() => onAdd({ id: p.id, title: p.title, price: Number(p.price), image: p.images?.[0] })}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 active:scale-95"
              style={{ background: brandColor }}>
              Add to cart
            </motion.button>}
      </div>
    </motion.div>
  )
}
