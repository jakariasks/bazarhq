import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Package, Mail, Phone, MapPin, MessageCircle, X, Plus, Minus, Trash2, Pencil } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useCurrentStore } from '@/lib/use-current-store'
import { getTheme, themeCssVars } from '@/lib/preview-themes'

function ShopPage() {
  const { user } = useAuth()
  const { store } = useCurrentStore()
  const [cartOpen, setCartOpen] = useState(false)
  const [cartItems, setCartItems] = useState([])

  const { data: profile } = useQuery({
    queryKey: ['shop-profile', store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { data } = await supabase.from('stores').select('*').eq('id', store.id).maybeSingle()
      return data
    } })

  const { data: products = [] } = useQuery({
    queryKey: ['shop-products', store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('store_id', store.id).eq('status', 'published').order('created_at', { ascending: false })
      return data ?? []
    } })

  const isOwner = user?.id === store?.owner_id
  const theme = getTheme(profile?.theme_id)
  const brandColor = profile?.brand_color || theme.swatch
  const symbol = profile?.currency === 'USD' ? '$' : profile?.currency === 'EUR' ? '€' : '৳'
  const cartTotal = cartItems.reduce((sum, i) => sum + i.price * i.qty, 0)

  const addToCart = (item) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (existing) return prev.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...item, qty: 1 }]
    })
    setCartOpen(true)
  }

  const updateQty = (id, delta) => {
    setCartItems((prev) => prev.map((i) => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter((i) => i.qty > 0))
  }

  const removeFromCart = (id) => setCartItems((prev) => prev.filter((i) => i.id !== id))

  if (!store) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center text-center p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"><Package className="h-7 w-7 text-muted-foreground" /></div>
        <h2 className="mt-4 text-xl font-semibold">No store found</h2>
        <p className="mt-2 text-sm text-muted-foreground">Create a store first to see the storefront.</p>
        <Link to="/merchant"><Button className="mt-4 bg-gradient-primary shadow-glow">Go to Dashboard</Button></Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background" style={themeCssVars(theme)}>
      {/* Announcement bar */}
      {profile?.announcement_enabled && profile?.announcement_text && (
        <div className="px-4 py-2 text-center text-xs font-medium text-white" style={{ background: brandColor }}>
          {profile.announcement_text}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {profile?.logo_url ? (
              <img src={profile.logo_url} alt={profile.shop_name} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: brandColor }}>
                {(profile?.shop_name || 'S').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="font-semibold">{profile?.shop_name || 'My Shop'}</div>
              {profile?.tagline && <div className="text-xs text-muted-foreground">{profile.tagline}</div>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isOwner && (
              <Link to="/merchant"><Button size="sm" variant="outline"><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit store</Button></Link>
            )}
            <button onClick={() => setCartOpen(true)} className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card transition hover:bg-muted">
              <ShoppingBag className="h-5 w-5" />
              {cartItems.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: brandColor }}>
                  {cartItems.reduce((s, i) => s + i.qty, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero banner */}
      <section className="relative overflow-hidden" style={{ minHeight: 240 }}>
        {profile?.banner_url ? (
          <img src={profile.banner_url} alt="Shop banner" className="h-60 w-full object-cover sm:h-80" />
        ) : (
          <div className="flex h-60 w-full items-end p-8 sm:h-80" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}99)` }}>
            <div className="text-white">
              <h1 className="text-3xl font-bold sm:text-5xl">{profile?.shop_name || 'My Shop'}</h1>
              {profile?.description && <p className="mt-2 max-w-md opacity-90">{profile.description}</p>}
            </div>
          </div>
        )}
      </section>

      {/* Products */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-2xl font-semibold">All Products</h2>
        {products.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No products published yet</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Add products in your dashboard and set their status to "Published".</p>
            {isOwner && <Link to="/merchant/products" className="mt-5"><Button className="bg-gradient-primary shadow-glow">Add products</Button></Link>}
          </motion.div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => {
              const stock = p.stock ?? 0
              const discount = p.compare_at_price && Number(p.compare_at_price) > Number(p.price)
              return (
                <div key={p.id} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-elegant">
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Package className="h-8 w-8" /></div>
                    )}
                    {discount && <Badge className="absolute left-2 top-2" style={{ background: brandColor }}>Sale</Badge>}
                    {stock <= 0 && <Badge variant="secondary" className="absolute right-2 top-2">Out of stock</Badge>}
                    {isOwner && (
                      <Link to="/merchant/products" className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-background/90 px-2 py-1 text-[11px] font-medium shadow-sm backdrop-blur opacity-0 transition group-hover:opacity-100 hover:bg-background">
                        <Pencil className="h-3 w-3" /> Edit
                      </Link>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="line-clamp-1 font-medium">{p.title}</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-base font-semibold">{symbol} {Number(p.price).toLocaleString()}</span>
                      {discount && <span className="text-xs text-muted-foreground line-through">{symbol} {Number(p.compare_at_price).toLocaleString()}</span>}
                    </div>
                    <Button
                      size="sm"
                      className="mt-3 w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-50"
                      onClick={() => addToCart({ id: p.id, title: p.title, price: Number(p.price), image: p.images?.[0] })}
                      disabled={stock <= 0}
                    >
                      {stock <= 0 ? 'Out of stock' : 'Add to cart'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Contact */}
      {(profile?.contact_email || profile?.phone || profile?.city) && (
        <section className="border-t border-border bg-muted/20">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8">
            {profile?.contact_email && <div className="flex items-center gap-3"><Mail className="h-5 w-5 text-muted-foreground" /><span className="text-sm">{profile.contact_email}</span></div>}
            {profile?.phone && <div className="flex items-center gap-3"><Phone className="h-5 w-5 text-muted-foreground" /><span className="text-sm">{profile.phone}</span></div>}
            {(profile?.city || profile?.address) && <div className="flex items-center gap-3"><MapPin className="h-5 w-5 text-muted-foreground" /><span className="text-sm">{[profile.address, profile.city].filter(Boolean).join(', ')}</span></div>}
          </div>
        </section>
      )}

      {/* Social / footer */}
      <footer className="border-t border-border bg-muted/30 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground">Powered by <Link to="/" className="font-medium text-foreground">BazarHQ</Link></p>
          <div className="flex gap-3">
            {profile?.facebook_handle && <a href={`https://facebook.com/${profile.facebook_handle}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground text-sm font-semibold">FB</a>}
            {profile?.instagram_handle && <a href={`https://instagram.com/${profile.instagram_handle}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground text-sm font-semibold">IG</a>}
            {profile?.whatsapp_number && <a href={`https://wa.me/${profile.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><MessageCircle className="h-5 w-5" /></a>}
          </div>
        </div>
      </footer>

      {/* Cart Drawer */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)} />
            <motion.div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background shadow-2xl" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 280 }}>
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-lg font-semibold">Your Cart</h2>
                <button type="button" onClick={() => setCartOpen(false)} className="rounded-lg p-2 transition hover:bg-muted"><X className="h-5 w-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {cartItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted"><ShoppingBag className="h-7 w-7 text-muted-foreground" /></div>
                    <p className="mt-4 text-sm font-medium text-muted-foreground">Your cart is empty</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => setCartOpen(false)}>Continue shopping</Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {cartItems.map((item, idx) => (
                      <motion.div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.06 }}>
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {item.image ? <img src={item.image} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Package className="h-5 w-5" /></div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
                          <p className="mt-0.5 text-sm font-semibold">{symbol} {Number(item.price).toLocaleString()}</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <button type="button" onClick={() => updateQty(item.id, -1)} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background transition hover:bg-muted"><Minus className="h-3.5 w-3.5" /></button>
                            <span className="min-w-[1.5rem] text-center text-sm font-medium">{item.qty}</span>
                            <button type="button" onClick={() => updateQty(item.id, 1)} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background transition hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeFromCart(item.id)} className="shrink-0 rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
              {cartItems.length > 0 && (
                <div className="border-t border-border px-5 py-4">
                  <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Subtotal</span><span className="text-lg font-semibold">{symbol} {Number(cartTotal).toLocaleString()}</span></div>
                  <Button className="mt-4 w-full bg-gradient-primary shadow-glow" size="lg" asChild><Link to="/checkout">Checkout</Link></Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ShopPage
