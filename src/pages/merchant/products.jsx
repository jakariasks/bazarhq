import { Plus, Search, Upload, X, Package, Loader2, Trash2, Pencil, Image as ImageIcon } from 'lucide-react'
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

function ProductsPage() {
  const { store } = useCurrentStore()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('store_id', store.id).order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    } })

  const filtered = products.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()))
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
          <p className="mt-1 text-sm text-muted-foreground">Manage your inventory and storefront catalog</p>
        </div>
        <Button onClick={openNew} className="bg-gradient-primary shadow-glow"><Plus className="mr-1.5 h-4 w-4" /> Add product</Button>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">{[0,1,2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Package className="h-6 w-6 text-muted-foreground" /></div>
            <h3 className="mt-4 text-base font-semibold">{q ? 'No matches' : 'No products yet'}</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{q ? 'Try a different search term.' : 'Add your first product to start selling.'}</p>
            {!q && <Button onClick={openNew} className="mt-4 bg-gradient-primary shadow-glow"><Plus className="mr-1.5 h-4 w-4" /> Add product</Button>}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-4">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {p.images?.[0] ? <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-5 w-5" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-medium">{p.title}</div>
                    <Badge variant={p.status === 'published' ? 'default' : 'secondary'} className="capitalize">{p.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">৳ {Number(p.price).toLocaleString()} · Stock: {p.stock}</div>
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

      <ProductDialog open={open} onOpenChange={setOpen} product={editing} storeId={store?.id} />
    </div>
  )
}

function ProductDialog({ open, onOpenChange, product, storeId }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileInput = useRef(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [compareAt, setCompareAt] = useState('')
  const [stock, setStock] = useState('0')
  const [status, setStatus] = useState('draft')
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (product) {
      setTitle(product.title); setDescription(product.description ?? ''); setPrice(String(product.price))
      setCompareAt(product.compare_at_price != null ? String(product.compare_at_price) : '')
      setStock(String(product.stock)); setStatus(product.status); setImages(product.images ?? [])
    } else {
      setTitle(''); setDescription(''); setPrice(''); setCompareAt(''); setStock('0'); setStatus('draft'); setImages([])
    }
  }, [product, open])

  const upload = async (file) => {
    if (!user) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return }
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { toast.error('Use PNG, JPG or WEBP'); return }
    setUploading(true)
    const ext = file.name.split('.').pop() || 'png'
    const path = `${user.id}/products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('shop-branding').upload(path, file, { contentType: file.type })
    if (error) { toast.error(error.message); setUploading(false); return }
    const { data } = supabase.storage.from('shop-branding').getPublicUrl(path)
    setImages((arr) => [...arr, data.publicUrl])
    setUploading(false)
  }

  const save = async () => {
    if (!user || !storeId) return
    if (!title.trim() || title.length < 2) { toast.error('Title must be at least 2 characters'); return }
    const priceNum = Number(price || 0)
    const compareNum = compareAt ? Number(compareAt) : null
    const stockNum = parseInt(stock || '0', 10)
    if (isNaN(priceNum) || priceNum < 0) { toast.error('Invalid price'); return }
    setSaving(true)
    const payload = {
      owner_id: user.id, store_id: storeId,
      title: title.trim(),
      slug: slugify(title) + (product ? '' : `-${Date.now().toString(36).slice(-4)}`),
      description: description || null, price: priceNum,
      compare_at_price: compareNum, stock: stockNum, status, images }
    const res = product
      ? await supabase.from('products').update({ title: payload.title, description: payload.description, price: payload.price, compare_at_price: payload.compare_at_price, stock: payload.stock, status: payload.status, images: payload.images }).eq('id', product.id)
      : await supabase.from('products').insert(payload)
    setSaving(false)
    if (res.error) { toast.error(res.error.message); return }
    toast.success(product ? 'Product updated' : 'Product created')
    qc.invalidateQueries({ queryKey: ['products', storeId] })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{product ? 'Edit product' : 'Add new product'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product name" maxLength={120} /></div>
          <div className="grid gap-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} placeholder="Tell customers what makes it special…" /></div>
          <div className="grid gap-2">
            <Label>Images</Label>
            <div className="grid grid-cols-4 gap-3">
              {images.map((url, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-border">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => setImages((arr) => arr.filter((_, idx) => idx !== i))} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 shadow">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {images.length < 8 && (
                <button onClick={() => fileInput.current?.click()} disabled={uploading} className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Upload className="mb-1 h-5 w-5" /><span className="text-xs">Upload</span></>}
                </button>
              )}
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-2"><Label>Price (৳)</Label><Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <div className="grid gap-2"><Label>Compare at</Label><Input type="number" min={0} value={compareAt} onChange={(e) => setCompareAt(e.target.value)} /></div>
            <div className="grid gap-2"><Label>Stock</Label><Input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} /></div>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft (hidden)</SelectItem>
                <SelectItem value="published">Published (visible in storefront)</SelectItem>
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
