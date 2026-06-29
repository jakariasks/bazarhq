import { Plus, Search, X, Package, Loader2, Trash2, Pencil, Image as ImageIcon, Tag, Copy, Download, AlertTriangle, ChevronDown, ChevronUp, Upload, Truck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useCurrentStore } from '@/lib/use-current-store'
import { slugify } from '@/lib/utils'
import { getCategoriesForType } from '@/lib/shop-categories'

function normalizeDeliveryMode(value) {
  return ['store_default', 'free', 'custom'].includes(value) ? value : 'store_default'
}

function productDeliveryLabel(product) {
  const mode = normalizeDeliveryMode(product?.delivery_charge_mode)
  if (mode === 'free') return 'Free delivery'
  if (mode === 'custom') {
    const inside = Number(product?.delivery_charge_dhaka ?? 0)
    const outside = Number(product?.delivery_charge_outside_dhaka ?? 0)
    return `Delivery: Dhaka ৳${inside.toLocaleString()} / Outside ৳${outside.toLocaleString()}`
  }
  return 'Store default delivery'
}


export default function ProductsPage() {
  const { store } = useCurrentStore()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [lowStockThreshold, setLowStockThreshold] = useState(5)
  const csvInputRef = useRef(null)
  const [importing, setImporting] = useState(false)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('store_id', store.id).order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const storeCategories = store?.categories ?? []
  const lowStockProducts = products.filter(p => p.status === 'published' && (p.stock ?? 0) <= lowStockThreshold && (p.stock ?? 0) > 0)
  const outOfStock = products.filter(p => p.status === 'published' && (p.stock ?? 0) <= 0)

  const filtered = products.filter(p => {
    const matchQ = p.title.toLowerCase().includes(q.toLowerCase())
    const matchCat = filterCat === 'all' || p.category === filterCat
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    return matchQ && matchCat && matchStatus
  })

  const openNew = () => { setEditing(null); setOpen(true) }
  const openEdit = p => { setEditing(p); setOpen(true) }

  const duplicate = async p => {
    if (!store) return
    const { user } = await supabase.auth.getUser()
    const { error } = await supabase.from('products').insert({
      ...p, id: undefined, created_at: undefined, updated_at: undefined,
      title: `${p.title} (Copy)`, status: 'draft',
      slug: slugify(p.title + '-copy') + `-${Date.now().toString(36).slice(-4)}`,
      owner_id: user.data.user?.id, store_id: store.id,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Product duplicated as Draft')
    qc.invalidateQueries({ queryKey: ['products', store?.id] })
  }

  const remove = async p => {
    const hasOrders = false // check via orders table if needed
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) { toast.error(error.message); return }
    toast.success('Product deleted')
    qc.invalidateQueries({ queryKey: ['products', store?.id] })
  }

  const parseCSV = (text) => {
    const rows = []
    let current = ''
    let row = []
    let inQuotes = false
    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const next = text[i + 1]
      if (char === '"' && inQuotes && next === '"') { current += '"'; i++; continue }
      if (char === '"') { inQuotes = !inQuotes; continue }
      if (char === ',' && !inQuotes) { row.push(current.trim()); current = ''; continue }
      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i++
        row.push(current.trim())
        if (row.some(Boolean)) rows.push(row)
        row = []; current = ''
        continue
      }
      current += char
    }
    row.push(current.trim())
    if (row.some(Boolean)) rows.push(row)
    return rows
  }

  const importCSV = async (file) => {
    if (!file || !store) return
    if (!file.name.toLowerCase().endsWith('.csv')) { toast.error('Please upload a CSV file'); return }
    setImporting(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id
      if (!userId) throw new Error('You must be signed in')

      const text = await file.text()
      const rows = parseCSV(text)
      if (rows.length < 2) throw new Error('CSV needs a header row and at least one product row')

      const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'))
      const findIndex = (...names) => names.map(n => headers.indexOf(n)).find(i => i >= 0) ?? -1
      const idx = {
        title: findIndex('title', 'name', 'product_name'),
        category: findIndex('category'),
        price: findIndex('price', 'base_price'),
        compare: findIndex('compare_at', 'compare_at_price', 'old_price'),
        stock: findIndex('stock', 'quantity', 'qty'),
        status: findIndex('status'),
        description: findIndex('description', 'details'),
        image: findIndex('image', 'image_url', 'thumbnail'),
        tags: findIndex('tags'),
        deliveryMode: findIndex('delivery_mode', 'delivery_charge_mode', 'delivery'),
        deliveryDhaka: findIndex('delivery_dhaka', 'delivery_charge_dhaka', 'dhaka_delivery'),
        deliveryOutside: findIndex('delivery_outside_dhaka', 'delivery_charge_outside_dhaka', 'outside_dhaka_delivery'),
      }
      if (idx.title < 0 || idx.price < 0) throw new Error('Required columns: title and price')

      const errors = []
      const productsToInsert = []
      rows.slice(1).forEach((row, i) => {
        const line = i + 2
        const title = row[idx.title]?.trim()
        const price = Number(row[idx.price])
        const stock = idx.stock >= 0 ? Number(row[idx.stock] || 0) : 0
        if (!title) { errors.push(`Line ${line}: title missing`); return }
        if (!Number.isFinite(price) || price < 0) { errors.push(`Line ${line}: invalid price`); return }
        if (!Number.isFinite(stock) || stock < 0) { errors.push(`Line ${line}: invalid stock`); return }
        const image = idx.image >= 0 && row[idx.image] ? row[idx.image].trim() : ''
        const status = idx.status >= 0 && ['draft','published','archived'].includes((row[idx.status] || '').toLowerCase()) ? row[idx.status].toLowerCase() : 'draft'
        const deliveryMode = idx.deliveryMode >= 0 ? normalizeDeliveryMode((row[idx.deliveryMode] || '').toLowerCase().trim()) : 'store_default'
        const deliveryDhaka = idx.deliveryDhaka >= 0 && row[idx.deliveryDhaka] ? Number(row[idx.deliveryDhaka]) : null
        const deliveryOutside = idx.deliveryOutside >= 0 && row[idx.deliveryOutside] ? Number(row[idx.deliveryOutside]) : null
        if (deliveryMode === 'custom') {
          if (!Number.isFinite(deliveryDhaka) || deliveryDhaka < 0) { errors.push(`Line ${line}: invalid Dhaka delivery charge`); return }
          if (!Number.isFinite(deliveryOutside) || deliveryOutside < 0) { errors.push(`Line ${line}: invalid outside Dhaka delivery charge`); return }
        }
        productsToInsert.push({
          owner_id: userId,
          store_id: store.id,
          title,
          slug: slugify(title) + `-${Date.now().toString(36)}-${i}`,
          category: idx.category >= 0 ? row[idx.category] || null : null,
          description: idx.description >= 0 ? row[idx.description] || null : null,
          price,
          compare_at_price: idx.compare >= 0 && row[idx.compare] ? Number(row[idx.compare]) : null,
          stock,
          status,
          images: image ? [image] : [],
          tags: idx.tags >= 0 && row[idx.tags] ? row[idx.tags].split('|').map(t => t.trim()).filter(Boolean) : null,
          delivery_charge_mode: deliveryMode,
          delivery_charge_dhaka: deliveryMode === 'custom' ? deliveryDhaka : null,
          delivery_charge_outside_dhaka: deliveryMode === 'custom' ? deliveryOutside : null,
        })
      })

      if (errors.length) {
        toast.error(`CSV has ${errors.length} problem(s). First: ${errors[0]}`)
        setImporting(false)
        return
      }
      if (!productsToInsert.length) throw new Error('No valid products found')
      if (productsToInsert.length > 500) throw new Error('Maximum 500 products per CSV import')

      const { error } = await supabase.from('products').insert(productsToInsert)
      if (error) throw error
      toast.success(`Imported ${productsToInsert.length} product${productsToInsert.length === 1 ? '' : 's'}`)
      qc.invalidateQueries({ queryKey: ['products', store.id] })
      qc.invalidateQueries({ queryKey: ['product-count', store.id] })
    } catch (error) {
      toast.error(error.message || 'CSV import failed')
    } finally {
      setImporting(false)
      if (csvInputRef.current) csvInputRef.current.value = ''
    }
  }

  // CSV Export — SRS M4
  const exportCSV = () => {
    if (!products.length) { toast.error('No products to export'); return }
    const headers = ['Title','Category','Price','Compare At','Stock','Status','Delivery Mode','Dhaka Delivery','Outside Dhaka Delivery','Description']
    const rows = products.map(p => [
      `"${(p.title||'').replace(/"/g,'""')}"`,
      `"${p.category||''}"`,
      p.price, p.compare_at_price||'',
      p.stock, p.status,
      p.delivery_charge_mode || 'store_default',
      p.delivery_charge_dhaka ?? '',
      p.delivery_charge_outside_dhaka ?? '',
      `"${(p.description||'').replace(/"/g,'""').replace(/\n/g,' ')}"`,
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${store?.shop_name || 'products'}-export.csv`
    a.click(); URL.revokeObjectURL(url)
    toast.success(`Exported ${products.length} products`)
  }

  if (!store) return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <Package className="h-10 w-10 text-muted-foreground" />
      <h3 className="mt-4 font-semibold">No store selected</h3>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} products · {products.filter(p=>p.status==='published').length} published
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => importCSV(event.target.files?.[0])} />
          <Button variant="outline" onClick={() => csvInputRef.current?.click()} disabled={importing} className="gap-2">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import CSV
          </Button>
          <Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="h-4 w-4" />Export CSV</Button>
          <Button onClick={openNew} className="bg-gradient-primary shadow-glow gap-2"><Plus className="h-4 w-4" />Add product</Button>
        </div>
      </div>

      {/* Low stock alerts — SRS M4 */}
      <AnimatePresence>
        {(lowStockProducts.length > 0 || outOfStock.length > 0) && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">Stock alerts</p>
                {outOfStock.length > 0 && (
                  <p className="text-xs text-amber-700 mt-0.5">❌ Out of stock: {outOfStock.map(p=>p.title).join(', ')}</p>
                )}
                {lowStockProducts.length > 0 && (
                  <p className="text-xs text-amber-700 mt-0.5">⚠️ Low stock (≤{lowStockThreshold}): {lowStockProducts.map(p=>`${p.title} (${p.stock})`).join(', ')}</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-amber-700">
                <Label className="text-xs">Threshold:</Label>
                <Input type="number" min={1} max={50} value={lowStockThreshold} onChange={e=>setLowStockThreshold(Number(e.target.value))}
                  className="h-7 w-16 text-xs bg-white" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {/* Search + filters */}
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search products…" value={q} onChange={e=>setQ(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Category filter bar */}
        {storeCategories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2">
            {['all', ...storeCategories].map(c => (
              <button key={c} onClick={() => setFilterCat(c)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-all ${filterCat === c ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                {c === 'all' ? 'All categories' : c}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3 p-4">{[0,1,2].map(i=><Skeleton key={i} className="h-16 rounded-xl"/>)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-semibold">{q||filterCat!=='all'||filterStatus!=='all' ? 'No matches' : 'No products yet'}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{q||filterCat!=='all' ? 'Try clearing filters.' : 'Add your first product to start selling.'}</p>
            {!q && filterCat==='all' && <Button onClick={openNew} className="mt-4 bg-gradient-primary shadow-glow"><Plus className="mr-1.5 h-4 w-4"/>Add product</Button>}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(p => (
              <div key={p.id} className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/20">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {p.images?.[0]
                    ? <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover"/>
                    : <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageIcon className="h-5 w-5"/></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{p.title}</span>
                    <Badge variant={p.status==='published'?'default':'secondary'} className="capitalize text-[10px]">{p.status}</Badge>
                    {p.category && <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"><Tag className="h-2.5 w-2.5"/>{p.category}</span>}
                    {(p.stock??0) <= 0 && p.status==='published' && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">Out of stock</span>}
                    {(p.stock??0) > 0 && (p.stock??0) <= lowStockThreshold && p.status==='published' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">Low stock</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    ৳ {Number(p.price).toLocaleString()}
                    {p.compare_at_price && <span className="ml-1 line-through text-muted-foreground/60">৳ {Number(p.compare_at_price).toLocaleString()}</span>}
                    {' · '}Stock: {p.stock ?? 0}
                    {Array.isArray(p.variants) && p.variants.length > 0 && <span className="ml-1">· {p.variants.length} variant{p.variants.length!==1?'s':''}</span>}
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Truck className="h-3 w-3" /> {productDeliveryLabel(p)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Edit"><Pencil className="h-4 w-4"/></Button>
                  <Button variant="ghost" size="icon" onClick={() => duplicate(p)} title="Duplicate"><Copy className="h-4 w-4"/></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(p)} title="Delete"><Trash2 className="h-4 w-4 text-destructive"/></Button>
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

// ── PRODUCT DIALOG with Variants ──
function ProductDialog({ open, onOpenChange, product, store }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileInput = useRef(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [compareAt, setCompareAt] = useState('')
  const [stock, setStock] = useState('0')
  const [deliveryMode, setDeliveryMode] = useState('store_default')
  const [deliveryDhaka, setDeliveryDhaka] = useState('')
  const [deliveryOutside, setDeliveryOutside] = useState('')
  const [status, setStatus] = useState('draft')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [images, setImages] = useState([])
  const [primaryImg, setPrimaryImg] = useState(0) // SRS M4: designate primary thumbnail
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  // SRS M4: Product variants
  const [hasVariants, setHasVariants] = useState(false)
  const [variantTypes, setVariantTypes] = useState([]) // [{name:'Size', values:['S','M','L']}]
  const [variants, setVariants] = useState([]) // [{combo:'S/Red', price:'', stock:'0'}]
  const [newVTypeName, setNewVTypeName] = useState('')
  const [newVTypeValues, setNewVTypeValues] = useState('')

  const storeCategories = store?.categories ?? []
  const allCats = storeCategories.length > 0 ? storeCategories : getCategoriesForType(store?.business_category || '')

  useEffect(() => {
    if (!open) return
    if (product) {
      setTitle(product.title ?? '')
      setDescription(product.description ?? '')
      setPrice(String(product.price ?? ''))
      setCompareAt(product.compare_at_price != null ? String(product.compare_at_price) : '')
      setStock(String(product.stock ?? 0))
      setDeliveryMode(normalizeDeliveryMode(product.delivery_charge_mode))
      setDeliveryDhaka(product.delivery_charge_dhaka != null ? String(product.delivery_charge_dhaka) : '')
      setDeliveryOutside(product.delivery_charge_outside_dhaka != null ? String(product.delivery_charge_outside_dhaka) : '')
      setStatus(product.status ?? 'draft')
      setCategory(product.category ?? '')
      setTags(product.tags ?? [])
      setImages(product.images ?? [])
      setPrimaryImg(0)
      const vts = product.variant_types ?? []
      const vs = product.variants ?? []
      setVariantTypes(vts)
      setVariants(vs)
      setHasVariants(vts.length > 0)
    } else {
      setTitle(''); setDescription(''); setPrice(''); setCompareAt('')
      setStock('0'); setDeliveryMode('store_default'); setDeliveryDhaka(''); setDeliveryOutside(''); setStatus('draft'); setCategory(''); setTags([])
      setImages([]); setPrimaryImg(0); setVariantTypes([]); setVariants([]); setHasVariants(false)
    }
  }, [product, open])

  // Generate variant combinations when variant types change
  const generateCombos = (types) => {
    if (!types.length) return []
    const combos = types.reduce((acc, t) => {
      if (!acc.length) return t.values.map(v => v)
      return acc.flatMap(a => t.values.map(v => `${a} / ${v}`))
    }, [])
    return combos.map(combo => {
      const existing = variants.find(v => v.combo === combo)
      return existing || { combo, price: '', stock: '0' }
    })
  }

  const addVariantType = () => {
    const name = newVTypeName.trim()
    const vals = newVTypeValues.split(',').map(v => v.trim()).filter(Boolean)
    if (!name || !vals.length) { toast.error('Enter type name and values'); return }
    if (variantTypes.find(t => t.name === name)) { toast.error('Variant type already exists'); return }
    const newTypes = [...variantTypes, { name, values: vals }]
    setVariantTypes(newTypes)
    setVariants(generateCombos(newTypes))
    setNewVTypeName(''); setNewVTypeValues('')
  }

  const removeVariantType = (name) => {
    const newTypes = variantTypes.filter(t => t.name !== name)
    setVariantTypes(newTypes)
    setVariants(generateCombos(newTypes))
  }

  const updateVariant = (combo, field, value) => {
    setVariants(prev => prev.map(v => v.combo === combo ? { ...v, [field]: value } : v))
  }

  const upload = async file => {
    if (!user) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return }
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { toast.error('Use PNG, JPG or WEBP'); return }
    setUploading(true)
    const ext = file.name.split('.').pop() || 'png'
    const path = `${user.id}/products/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`
    const { error } = await supabase.storage.from('shop-branding').upload(path, file, { contentType: file.type })
    if (error) { toast.error(error.message); setUploading(false); return }
    const { data } = supabase.storage.from('shop-branding').getPublicUrl(path)
    setImages(arr => [...arr, data.publicUrl])
    setUploading(false)
  }

  // Reorder images so primary is first
  const getOrderedImages = () => {
    if (!images.length) return images
    const ordered = [...images]
    const [primary] = ordered.splice(primaryImg, 1)
    return [primary, ...ordered]
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (!t || tags.includes(t)) return
    setTags([...tags, t]); setTagInput('')
  }

  const save = async () => {
    if (!user || !store) return
    if (!title.trim() || title.length < 2) { toast.error('Title must be at least 2 characters'); return }
    const priceNum = Number(price || 0)
    if (isNaN(priceNum) || priceNum < 0) { toast.error('Invalid price'); return }
    const compareNum = compareAt ? Number(compareAt) : null
    const deliveryDhakaNum = deliveryDhaka === '' ? null : Number(deliveryDhaka)
    const deliveryOutsideNum = deliveryOutside === '' ? null : Number(deliveryOutside)
    if (deliveryMode === 'custom') {
      if (!Number.isFinite(deliveryDhakaNum) || deliveryDhakaNum < 0) { toast.error('Enter a valid Dhaka delivery charge'); return }
      if (!Number.isFinite(deliveryOutsideNum) || deliveryOutsideNum < 0) { toast.error('Enter a valid outside Dhaka delivery charge'); return }
    }
    const stockNum = hasVariants ? variants.reduce((s, v) => s + parseInt(v.stock||0, 10), 0) : parseInt(stock||'0', 10)
    setSaving(true)

    const orderedImages = getOrderedImages()
    const payload = {
      title: title.trim(),
      description: description || null,
      price: priceNum,
      compare_at_price: compareNum,
      stock: stockNum,
      status,
      category: category || null,
      tags: tags.length ? tags : null,
      images: orderedImages,
      has_variants: hasVariants,
      variant_types: hasVariants ? variantTypes : [],
      variants: hasVariants ? variants : [],
      delivery_charge_mode: deliveryMode,
      delivery_charge_dhaka: deliveryMode === 'custom' ? deliveryDhakaNum : null,
      delivery_charge_outside_dhaka: deliveryMode === 'custom' ? deliveryOutsideNum : null,
    }

    const res = product
      ? await supabase.from('products').update(payload).eq('id', product.id)
      : await supabase.from('products').insert({
          ...payload, owner_id: user.id, store_id: store.id,
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

        <div className="grid gap-5 py-2">
          {/* Title */}
          <div className="grid gap-2">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Product name" maxLength={120} autoFocus />
          </div>

          {/* Category + Status */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Category</Label>
              {allCats.length > 0 ? (
                <Select
                  value={category || '__none__'}
                  onValueChange={value => setCategory(value === '__none__' ? '' : value)}
                >
                  <SelectTrigger><SelectValue placeholder="Select category"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {allCats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={category} onChange={e=>setCategory(e.target.value)} placeholder="e.g. Men, Electronics…"/>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft — hidden</SelectItem>
                  <SelectItem value="published">Published — live</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} maxLength={2000} placeholder="Describe your product…"/>
          </div>

          {/* Images — SRS M4: 1-6, set primary thumbnail */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Images <span className="text-xs text-muted-foreground">(max 6) — click to set as primary</span></Label>
              {images.length > 0 && <span className="text-xs text-muted-foreground">⭐ = primary thumbnail</span>}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {images.map((url, i) => (
                <div key={i} className={`group relative aspect-square overflow-hidden rounded-xl border-2 cursor-pointer transition-all ${i===primaryImg?'border-primary shadow-glow':'border-border hover:border-primary/50'}`}
                  onClick={()=>setPrimaryImg(i)}>
                  <img src={url} alt="" className="h-full w-full object-cover"/>
                  {i===primaryImg && <div className="absolute left-1 top-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-white">⭐ Primary</div>}
                  <button onClick={e=>{e.stopPropagation();setImages(arr=>arr.filter((_,idx)=>idx!==i));if(primaryImg>=images.length-1)setPrimaryImg(0)}}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 shadow opacity-0 group-hover:opacity-100">
                    <X className="h-3 w-3"/>
                  </button>
                </div>
              ))}
              {images.length < 6 && (
                <button onClick={()=>fileInput.current?.click()} disabled={uploading}
                  className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                  {uploading?<Loader2 className="h-5 w-5 animate-spin"/>:<><ImageIcon className="mb-1 h-5 w-5"/><span className="text-xs">Upload</span></>}
                </button>
              )}
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={e=>e.target.files?.[0]&&upload(e.target.files[0])}/>
            </div>
          </div>

          {/* Price / Compare / Stock */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label>Price (৳) <span className="text-destructive">*</span></Label>
              <Input type="number" min={0} step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="0.00"/>
            </div>
            <div className="grid gap-2">
              <Label>Compare at (৳)</Label>
              <Input type="number" min={0} step="0.01" value={compareAt} onChange={e=>setCompareAt(e.target.value)} placeholder="Original"/>
            </div>
            {!hasVariants && (
              <div className="grid gap-2">
                <Label>Stock</Label>
                <Input type="number" min={0} value={stock} onChange={e=>setStock(e.target.value)}/>
              </div>
            )}
          </div>

          {/* Delivery charge per product */}
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-3 flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <Label className="text-sm font-semibold">Product delivery charge</Label>
                <p className="mt-1 text-xs text-muted-foreground">Set free delivery or a custom delivery charge for this product. Custom charge overrides store default at checkout.</p>
              </div>
            </div>
            <Select value={deliveryMode} onValueChange={setDeliveryMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="store_default">Use store default delivery charge</SelectItem>
                <SelectItem value="free">Free delivery for this product</SelectItem>
                <SelectItem value="custom">Custom delivery charge for this product</SelectItem>
              </SelectContent>
            </Select>
            {deliveryMode === 'custom' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Inside Dhaka (৳)</Label>
                  <Input type="number" min={0} step="1" value={deliveryDhaka} onChange={e=>setDeliveryDhaka(e.target.value)} placeholder="e.g. 60" />
                </div>
                <div className="grid gap-2">
                  <Label>Outside Dhaka (৳)</Label>
                  <Input type="number" min={0} step="1" value={deliveryOutside} onChange={e=>setDeliveryOutside(e.target.value)} placeholder="e.g. 120" />
                </div>
              </div>
            )}
          </div>
          {compareAt && Number(compareAt)>Number(price) && (
            <p className="rounded-lg bg-success/10 px-3 py-1.5 text-xs text-success">
              ✓ Sale badge will show — {Math.round((1-Number(price)/Number(compareAt))*100)}% off
            </p>
          )}

          {/* Tags — SRS M4 */}
          <div className="grid gap-2">
            <Label>Tags <span className="text-xs text-muted-foreground">(optional — for search & filtering)</span></Label>
            <div className="flex flex-wrap gap-2 rounded-xl border border-border p-2 min-h-[2.5rem]">
              {tags.map(t=>(
                <span key={t} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                  {t}<button type="button" onClick={()=>setTags(tags.filter(x=>x!==t))} className="hover:text-destructive"><X className="h-3 w-3"/></button>
                </span>
              ))}
              <input value={tagInput} onChange={e=>setTagInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();addTag()}}}
                placeholder={tags.length?'':'Add tags (press Enter)…'} className="flex-1 min-w-24 bg-transparent text-xs outline-none placeholder:text-muted-foreground"/>
            </div>
          </div>

          {/* SRS M4: Product Variants */}
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <Label className="text-sm font-semibold">Product variants</Label>
                <p className="text-xs text-muted-foreground">Size, Color, etc. — each with own stock & price</p>
              </div>
              <Switch checked={hasVariants} onCheckedChange={v=>{setHasVariants(v);if(!v){setVariantTypes([]);setVariants([])}}}/>
            </div>

            {hasVariants && (
              <div className="space-y-4">
                {/* Add variant type */}
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add variant type</p>
                  <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                    <Input value={newVTypeName} onChange={e=>setNewVTypeName(e.target.value)} placeholder="Type (e.g. Size)"/>
                    <Input value={newVTypeValues} onChange={e=>setNewVTypeValues(e.target.value)} placeholder="Values: S, M, L, XL"/>
                    <Button type="button" onClick={addVariantType} size="sm" variant="outline"><Plus className="h-4 w-4"/></Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Separate values with commas</p>
                </div>

                {/* Existing variant types */}
                {variantTypes.map(t => (
                  <div key={t.name} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="flex-1">
                      <span className="text-sm font-medium">{t.name}:</span>
                      <span className="ml-2 text-sm text-muted-foreground">{t.values.join(', ')}</span>
                    </div>
                    <button onClick={()=>removeVariantType(t.name)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4"/></button>
                  </div>
                ))}

                {/* Variant combinations table */}
                {variants.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Set price & stock per variant</p>
                    <div className="overflow-hidden rounded-xl border border-border">
                      <div className="grid grid-cols-[1fr_100px_80px] border-b border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground">
                        <span>Variant</span><span>Price (৳)</span><span>Stock</span>
                      </div>
                      <div className="divide-y divide-border max-h-60 overflow-y-auto">
                        {variants.map(v => (
                          <div key={v.combo} className="grid grid-cols-[1fr_100px_80px] items-center gap-2 px-3 py-2">
                            <span className="text-sm font-medium">{v.combo}</span>
                            <Input type="number" min={0} step="0.01" value={v.price} onChange={e=>updateVariant(v.combo,'price',e.target.value)}
                              placeholder={price||'0'} className="h-8 text-xs"/>
                            <Input type="number" min={0} value={v.stock} onChange={e=>updateVariant(v.combo,'stock',e.target.value)}
                              className="h-8 text-xs"/>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Total stock: {variants.reduce((s,v)=>s+parseInt(v.stock||0,10),0)} units</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={()=>onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-gradient-primary">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            {product ? 'Save changes' : 'Create product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
