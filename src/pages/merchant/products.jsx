import { createFileRoute } from '@tanstack/react-router'
import { Plus, Search, X, Package, Loader2, Trash2, Pencil, Image as ImageIcon, Tag } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useCurrentStore } from '@/lib/use-current-store'
import { slugify } from '@/lib/utils'
import { getCategoriesForType } from '@/lib/shop-categories'

function ProductsPage() {
  const { store } = useCurrentStore()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('store_id', store.id).order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  // Store categories for filter bar
  const storeCategories = store?.categories ?? []

  const filtered = products.filter((p) => {
    const matchQ = p.title.toLowerCase().includes(q.toLowerCase())
    const matchCat = filterCat === 'all' || p.category === filterCat
    return matchQ && matchCat
  })

  const openNew = () => { setEditing(null); setOpen(true) }
  const openEdit = (p) => { setEditing(p); setOpen(true) }

  const remove = async (p) => {
    if (!confirm(`Delete "${p.title}"?`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) { toast.error(error.message); return }
    toast.success('Product deleted')
    qc.invalidateQueries({ queryKey: ['products', store?.id] })
  }

  if (!store) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Package className="h-6 w-6 text-muted-foreground" /></div>
        <h3 className="mt-4 text-base font-semibold">No store selected</h3>
        <p className="mt-1 text-sm text-muted-foreground">Create a store first to add products.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} product{products.length !== 1 ? 's' : ''} · {products.filter(p => p.status === 'published').length} published
          </p>
        </div>
        <Button onClick={openNew} className="bg-gradient-primary shadow-glow">
          <Plus className="mr-1.5 h-4 w-4" /> Add product
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {/* Search + filter bar */}
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          {storeCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              <button
                onClick={() => setFilterCat('all')}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-all ${filterCat === 'all' ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}
              >All</button>
              {storeCategories.map((c) => (
                <button key={c} onClick={() => setFilterCat(filterCat === c ? 'all' : c)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-all ${filterCat === c ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">{[0,1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Package className="h-6 w-6 text-muted-foreground" /></div>
            <h3 className="mt-4 text-base font-semibold">{q || filterCat !== 'all' ? 'No matches' : 'No products yet'}</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{q || filterCat !== 'all' ? 'Try a different search or filter.' : 'Add your first product to start selling.'}</p>
            {!q && filterCat === 'all' && <Button onClick={openNew} className="mt-4 bg-gradient-primary shadow-glow"><Plus className="mr-1.5 h-4 w-4" /> Add product</Button>}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/30">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {p.images?.[0]
                    ? <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />
                    : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-5 w-5" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{p.title}</span>
                    <Badge variant={p.status === 'published' ? 'default' : 'secondary'} className="capitalize text-[10px]">{p.status}</Badge>
                    {p.category && (
                      <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                        <Tag className="h-2.5 w-2.5" />{p.category}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    ৳ {Number(p.price).toLocaleString()} · Stock: {p.stock}
                    {p.compare_at_price && Number(p.compare_at_price) > Number(p.price) && (
                      <span className="ml-1.5 text-success">Sale</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProductDialog open={open} onOpenChange={setOpen} product={editing} store={store} />
    </div>
  )
}

// ── Product Dialog ──
function ProductDialog({ open, onOpenChange, product, store }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileInput = useRef(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [compareAt, setCompareAt] = useState('')
  const [stock, setStock] = useState('0')
  const [status, setStatus] = useState('draft')
  const [category, setCategory] = useState('')
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Categories available for this store
  const storeCategories = store?.categories ?? []
  const shopType = store?.business_category ?? ''
  // Merge store's selected categories + all categories for this shop type as fallback
  const allCats = storeCategories.length > 0
    ? storeCategories
    : getCategoriesForType(shopType)

  useEffect(() => {
    if (!open) return
    if (product) {
      setTitle(product.title ?? '')
      setDescription(product.description ?? '')
      setPrice(String(product.price ?? ''))
      setCompareAt(product.compare_at_price != null ? String(product.compare_at_price) : '')
      setStock(String(product.stock ?? 0))
      setStatus(product.status ?? 'draft')
      setCategory(product.category ?? '')
      setImages(product.images ?? [])
    } else {
      setTitle(''); setDescription(''); setPrice(''); setCompareAt('')
      setStock('0'); setStatus('draft'); setCategory(''); setImages([])
    }
  }, [product, open])

  const upload = async (file) => {
    if (!user) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return }
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { toast.error('Use PNG, JPG or WEBP'); return }
    setUploading(true)
    const ext = file.name.split('.').pop() || 'png'
    const path = `${user.id}/products/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`
    const { error } = await supabase.storage.from('shop-branding').upload(path, file, { contentType: file.type })
    if (error) { toast.error(error.message); setUploading(false); return }
    const { data } = supabase.storage.from('shop-branding').getPublicUrl(path)
    setImages((arr) => [...arr, data.publicUrl])
    setUploading(false)
  }

  const save = async () => {
    if (!user || !store) return
    if (!title.trim() || title.length < 2) { toast.error('Title must be at least 2 characters'); return }
    const priceNum = Number(price || 0)
    const compareNum = compareAt ? Number(compareAt) : null
    const stockNum = parseInt(stock || '0', 10)
    if (isNaN(priceNum) || priceNum < 0) { toast.error('Invalid price'); return }
    setSaving(true)
    const payload = {
      title: title.trim(),
      description: description || null,
      price: priceNum,
      compare_at_price: compareNum,
      stock: stockNum,
      status,
      category: category || null,
      images,
    }
    const res = product
      ? await supabase.from('products').update(payload).eq('id', product.id)
      : await supabase.from('products').insert({
          ...payload,
          owner_id: user.id,
          store_id: store.id,
          slug: slugify(title) + `-${Date.now().toString(36).slice(-4)}`,
        })
    setSaving(false)
    if (res.error) { toast.error(res.error.message); return }
    toast.success(product ? 'Product updated' : 'Product created')
    qc.invalidateQueries({ queryKey: ['products', store.id] })
    qc.invalidateQueries({ queryKey: ['product-count', store.id] })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit product' : 'Add new product'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Title */}
          <div className="grid gap-2">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product name" maxLength={120} autoFocus />
          </div>

          {/* Category */}
          <div className="grid gap-2">
            <Label>Category</Label>
            {allCats.length > 0 ? (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— No category —</SelectItem>
                  {allCats.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Men, Electronics, Skincare…" />
            )}
            {allCats.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Based on your store type: <span className="font-medium">{shopType || 'Other'}</span>.
                You can add more categories in <span className="text-primary">Settings</span>.
              </p>
            )}
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} placeholder="Tell customers what makes this product special…" />
          </div>

          {/* Images */}
          <div className="grid gap-2">
            <Label>Images <span className="text-xs text-muted-foreground">(up to 8)</span></Label>
            <div className="grid grid-cols-4 gap-3">
              {images.map((url, i) => (
                <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-border">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => setImages((arr) => arr.filter((_, idx) => idx !== i))}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 shadow opacity-0 transition-opacity group-hover:opacity-100">
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">Main</span>}
                </div>
              ))}
              {images.length < 8 && (
                <button onClick={() => fileInput.current?.click()} disabled={uploading}
                  className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                  {uploading
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <><ImageIcon className="mb-1 h-5 w-5" /><span className="text-xs">Upload</span></>}
                </button>
              )}
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </div>
          </div>

          {/* Price / Compare / Stock */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Price (৳) <span className="text-destructive">*</span></Label>
              <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="grid gap-2">
              <Label>Compare at (৳)</Label>
              <Input type="number" min={0} step="0.01" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} placeholder="Original price" />
            </div>
            <div className="grid gap-2">
              <Label>Stock</Label>
              <Input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>
          {compareAt && Number(compareAt) > 0 && Number(price) < Number(compareAt) && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
              ✓ Sale badge will show — {Math.round((1 - Number(price)/Number(compareAt))*100)}% off
            </p>
          )}

          {/* Status */}
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft — hidden from storefront</SelectItem>
                <SelectItem value="published">Published — visible in storefront</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {product ? 'Save changes' : 'Create product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ProductsPage
