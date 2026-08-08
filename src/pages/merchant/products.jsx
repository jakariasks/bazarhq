import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentStore } from '@/lib/use-current-store'
import { useAuth } from '@/hooks/use-auth'
import { buildVariantRows, normalizeVariantTypes, parseCsv, uniqueCatalogSlug, validateProductCsv, variantsForDatabase } from '@/lib/product-catalog-tools'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronsUpDown,
  Copy,
  Download,
  FileSpreadsheet,
  ImagePlus,
  Layers3,
  Loader2,
  Package2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

const DEFAULT_FORM = {
  id: null,
  title: '',
  slug: '',
  category: '',
  status: 'draft',
  description: '',
  price: '0',
  compare_at_price: '',
  stock: '0',
  lowStockThreshold: '5',
  sku: '',
  tagsInput: '',
  tags: [],
  image_url: '',
  images: [],
  hasVariants: false,
  variantTypes: [],
  variants: [],
  deliveryMode: 'store_default',
  deliveryCharge: '',
}

const STATUS_META = {
  draft: {
    label: 'Draft — hidden',
    chip: 'border-slate-200 bg-slate-100 text-slate-600',
  },
  active: {
    label: 'Active — visible',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  archived: {
    label: 'Archived',
    chip: 'border-amber-200 bg-amber-50 text-amber-700',
  },
}

const DELIVERY_OPTIONS = [
  { value: 'store_default', label: 'Use store default delivery charge' },
  { value: 'free', label: 'Free delivery for this product' },
  { value: 'custom', label: 'Use custom delivery charge' },
]

function numberValue(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function money(value) {
  return `৳${numberValue(value).toLocaleString('en-BD', { maximumFractionDigits: 2 })}`
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function normalizeTags(input) {
  if (Array.isArray(input)) return input.map((tag) => String(tag).trim()).filter(Boolean)
  return String(input || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function normalizeImages(images, imageUrl = '') {
  const list = []
  if (Array.isArray(images)) {
    images.forEach((item) => {
      if (typeof item === 'string' && item.trim()) list.push(item.trim())
      else if (item && typeof item.url === 'string' && item.url.trim()) list.push(item.url.trim())
    })
  }
  if (imageUrl && !list.includes(imageUrl)) list.unshift(imageUrl)
  return [...new Set(list)].slice(0, 6)
}

function productStatus(product) {
  const value = String(product?.status || '').trim().toLowerCase()
  if (value === 'active' || value === 'published') return 'active'
  if (value === 'archived') return 'archived'
  return 'draft'
}

function ProductStat({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900',
    indigo: 'border-indigo-200 bg-indigo-50/70 text-indigo-900',
    emerald: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50/80 text-amber-900',
  }
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${tones[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
    </div>
  )
}

function ProductListCard({ product, onEdit, onDuplicate, onDelete, duplicating }) {
  const images = normalizeImages(product?.images, product?.image_url)
  const hasDiscount = numberValue(product?.compare_at_price) > numberValue(product?.price)
  const productTone = productStatus(product)

  return (
    <motion.article
      layout
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18 }}
      className="group overflow-hidden rounded-[1.45rem] border border-slate-200 bg-white shadow-[0_18px_50px_-36px_rgba(15,23,42,.26)]"
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
        <div className="relative h-24 w-full overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 sm:h-24 sm:w-24 sm:min-w-24">
          {images[0] ? (
            <img
              src={images[0]}
              alt={product?.title || 'Product'}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <Package2 className="h-8 w-8" />
            </div>
          )}
          {hasDiscount && (
            <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-black text-rose-600 shadow-sm">
              -{Math.round((1 - numberValue(product.price) / numberValue(product.compare_at_price)) * 100)}%
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-black text-slate-950">{product?.title || 'Untitled product'}</h3>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${STATUS_META[productTone]?.chip || STATUS_META.draft.chip}`}>
                  {STATUS_META[productTone]?.label || 'Draft'}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                {product?.description || 'No description added yet.'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-slate-400" /> {product?.category || 'General'}
                </span>
                <span>SKU: {product?.sku || 'Not set'}</span>
                <span>{normalizeImages(product?.images, product?.image_url).length} image(s)</span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-2xl font-black tracking-tight text-slate-950">{money(product?.price)}</p>
              {numberValue(product?.compare_at_price) > numberValue(product?.price) ? (
                <p className="mt-1 text-xs font-semibold text-slate-400 line-through">{money(product?.compare_at_price)}</p>
              ) : null}
              <p className={`mt-2 text-xs font-black ${numberValue(product?.stock) > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {numberValue(product?.stock) > 0 ? `${numberValue(product?.stock)} in stock` : 'Out of stock'}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap gap-2">
              {normalizeTags(product?.tags).slice(0, 4).map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                  #{tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => onEdit(product)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
              <Button variant="outline" className="rounded-full" onClick={() => onDuplicate(product)} disabled={duplicating === product.id}>
                {duplicating === product.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />} Duplicate
              </Button>
              <Button variant="outline" className="rounded-full border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => onDelete(product)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  )
}


function VariantEditorSection({ form, setForm }) {
  const normalizedTypes = useMemo(() => normalizeVariantTypes(form.variantTypes), [form.variantTypes])
  const completeTypes = useMemo(() => normalizedTypes.filter((item) => item.name && item.values.length), [normalizedTypes])
  const variantRows = useMemo(
    () => buildVariantRows(completeTypes, form.variants, numberValue(form.price), numberValue(form.lowStockThreshold, 5)),
    [completeTypes, form.variants, form.price, form.lowStockThreshold],
  )
  const totalStock = variantRows.reduce((sum, item) => sum + Math.max(0, Math.round(numberValue(item.stock))), 0)

  function enableVariants(enabled) {
    setForm((current) => {
      if (!enabled) return { ...current, hasVariants: false, variantTypes: [], variants: [] }
      const nextTypes = current.variantTypes?.length
        ? current.variantTypes
        : [{ id: 'type-1', name: 'Size', valuesInput: 'Small, Medium, Large', values: ['Small', 'Medium', 'Large'] }]
      return {
        ...current,
        hasVariants: true,
        variantTypes: nextTypes,
        variants: buildVariantRows(nextTypes, current.variants, numberValue(current.price), numberValue(current.lowStockThreshold, 5)),
      }
    })
  }

  function updateVariantTypes(nextTypes) {
    setForm((current) => ({
      ...current,
      variantTypes: nextTypes,
      variants: buildVariantRows(nextTypes, current.variants, numberValue(current.price), numberValue(current.lowStockThreshold, 5)),
    }))
  }

  function updateType(index, key, value) {
    const next = normalizedTypes.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      if (key === 'valuesInput') {
        return {
          ...item,
          valuesInput: value,
          values: [...new Set(String(value).split(',').map((entry) => entry.trim()).filter(Boolean))],
        }
      }
      return { ...item, [key]: value }
    })
    updateVariantTypes(next)
  }

  function addType() {
    if (normalizedTypes.length >= 3) return toast.error('You can add up to 3 variant types per product')
    updateVariantTypes([
      ...normalizedTypes,
      { id: `type-${Date.now()}`, name: normalizedTypes.length ? 'Color' : 'Size', valuesInput: '', values: [] },
    ])
  }

  function removeType(index) {
    updateVariantTypes(normalizedTypes.filter((_, itemIndex) => itemIndex !== index))
  }

  function updateVariant(id, key, value) {
    setForm((current) => {
      const currentRows = buildVariantRows(current.variantTypes, current.variants, numberValue(current.price), numberValue(current.lowStockThreshold, 5))
      return {
        ...current,
        variants: currentRows.map((item) => item.id === id ? { ...item, [key]: value } : item),
      }
    })
  }

  return (
    <section className="rounded-[1.4rem] border border-violet-200 bg-gradient-to-br from-violet-50/70 via-white to-indigo-50/60 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-600 text-white"><Layers3 className="h-4 w-4" /></span>
            <div>
              <h3 className="text-base font-black text-slate-950">Product variants</h3>
              <p className="text-sm text-slate-500">Create Size, Color or other option combinations with their own stock and price adjustment.</p>
            </div>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm">
          <input
            type="checkbox"
            checked={Boolean(form.hasVariants)}
            onChange={(event) => enableVariants(event.target.checked)}
            className="h-4 w-4 accent-violet-600"
          />
          This product has variants
        </label>
      </div>

      {form.hasVariants ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-[1.25rem] border border-violet-100 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-900">Variant types & options</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Enter values separated by commas. Example: Small, Medium, Large.</p>
              </div>
              <Button type="button" variant="outline" className="rounded-full" onClick={addType} disabled={normalizedTypes.length >= 3}>
                <Plus className="mr-2 h-4 w-4" /> Add option type
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {normalizedTypes.map((type, index) => (
                <div key={type.id || index} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[.6fr_1.4fr_auto] md:items-end">
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-600">Type name</Label>
                    <Input value={type.name} onChange={(event) => updateType(index, 'name', event.target.value)} placeholder="Size" className="h-10 rounded-xl bg-white font-semibold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-600">Options</Label>
                    <Input value={type.valuesInput ?? type.values.join(', ')} onChange={(event) => updateType(index, 'valuesInput', event.target.value)} placeholder="Small, Medium, Large" className="h-10 rounded-xl bg-white font-semibold" />
                  </div>
                  <Button type="button" variant="outline" className="h-10 rounded-xl border-rose-200 text-rose-600" onClick={() => removeType(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {completeTypes.length && variantRows.length ? (
            <div className="overflow-hidden rounded-[1.25rem] border border-violet-100 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
                <div>
                  <p className="text-sm font-black text-slate-900">Generated combinations</p>
                  <p className="mt-1 text-xs text-slate-500">Stock is managed per combination. Final price = base price + adjustment.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">{variantRows.length} variants</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{totalStock} total stock</span>
                </div>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <div className="min-w-[940px]">
                  <div className="grid grid-cols-[1.45fr_.65fr_.72fr_.85fr_.8fr] gap-3 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    <span>Combination</span><span>Stock</span><span>Alert at ≤</span><span>Price adjustment</span><span>SKU</span>
                  </div>
                  {variantRows.map((variant) => {
                    const finalPrice = Math.max(0, numberValue(form.price) + numberValue(variant.price_adjustment))
                    return (
                      <div key={variant.id} className="grid grid-cols-[1.45fr_.65fr_.72fr_.85fr_.8fr] gap-3 border-t border-slate-100 px-4 py-3 md:items-center">
                        <div>
                          <p className="text-sm font-black text-slate-900">{variant.label}</p>
                          <p className={`mt-1 text-xs font-bold ${numberValue(variant.stock) > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{numberValue(variant.stock) > 0 ? `${variant.stock} available` : 'Unavailable'}</p>
                        </div>
                        <Input value={variant.stock} onChange={(event) => updateVariant(variant.id, 'stock', event.target.value)} inputMode="numeric" className="h-10 rounded-xl" />
                        <div>
                          <Input value={variant.low_stock_threshold ?? ''} onChange={(event) => updateVariant(variant.id, 'low_stock_threshold', event.target.value)} inputMode="numeric" placeholder={`Default ${Math.max(0, Math.round(numberValue(form.lowStockThreshold, 5)))}`} className="h-10 rounded-xl" />
                          <p className="mt-1 text-[10px] font-bold text-slate-400">Blank uses product default</p>
                        </div>
                        <div>
                          <Input value={variant.price_adjustment} onChange={(event) => updateVariant(variant.id, 'price_adjustment', event.target.value)} inputMode="decimal" className="h-10 rounded-xl" />
                          <p className="mt-1 text-[10px] font-bold text-slate-400">Final {money(finalPrice)}</p>
                        </div>
                        <Input value={variant.sku || ''} onChange={(event) => updateVariant(variant.id, 'sku', event.target.value.toUpperCase())} placeholder="Optional" className="h-10 rounded-xl" />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-violet-200 bg-white/70 px-4 py-6 text-center text-sm font-semibold text-slate-500">
              Add a type name and at least one comma-separated option to generate combinations.
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}

function BulkImportDialog({ open, onOpenChange, onImport, importing }) {
  const inputRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState({ records: [], errors: [] })

  async function chooseFile(file) {
    if (!file) return
    setFileName(file.name)
    try {
      const text = await file.text()
      setResult(validateProductCsv(parseCsv(text), { maxRows: 500 }))
    } catch (error) {
      setResult({ records: [], errors: [{ row: 'File', message: error?.message || 'Could not read CSV file.' }] })
    }
  }

  const ready = result.records.length > 0 && result.errors.length === 0

  return (
    <Dialog open={open} onOpenChange={(next) => !importing && onOpenChange(next)}>
      <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto rounded-[1.6rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-black"><FileSpreadsheet className="h-6 w-6 text-emerald-600" /> Bulk product import</DialogTitle>
          <p className="text-sm leading-6 text-slate-500">Import up to 500 products in one CSV. The file is fully validated before anything is inserted.</p>
        </DialogHeader>

        <div className="mt-3 grid gap-4 md:grid-cols-[1.2fr_.8fr]">
          <button type="button" onClick={() => inputRef.current?.click()} className="rounded-[1.35rem] border border-dashed border-emerald-300 bg-emerald-50/60 p-8 text-center transition hover:bg-emerald-50">
            <Upload className="mx-auto h-9 w-9 text-emerald-700" />
            <p className="mt-3 text-base font-black text-slate-900">{fileName || 'Choose CSV file'}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">Required columns: title, category, price. Max 500 rows.</p>
          </button>
          <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-black text-slate-900">Template & optional columns</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Required: title, description, category and price. Optional: compare_at_price, stock, low_stock_threshold, status, sku, tags, image_url, images, delivery_mode, delivery_dhaka, delivery_outside_dhaka. Advanced imports can also include JSON variant_types and variants columns.</p>
            <a href="/samples/product-import-template.csv" download className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:border-emerald-300 hover:text-emerald-700">
              <Download className="h-4 w-4" /> Download CSV template
            </a>
          </div>
        </div>
        <input ref={inputRef} hidden type="file" accept=".csv,text/csv" onChange={(event) => chooseFile(event.target.files?.[0])} />

        {fileName ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-400">Valid rows</p><p className="mt-2 text-2xl font-black text-emerald-700">{result.records.length}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-400">Errors</p><p className={`mt-2 text-2xl font-black ${result.errors.length ? 'text-rose-600' : 'text-slate-900'}`}>{result.errors.length}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-400">Import state</p><p className={`mt-2 text-sm font-black ${ready ? 'text-emerald-700' : 'text-amber-700'}`}>{ready ? 'Ready to import' : result.errors.length ? 'Fix CSV errors first' : 'Choose a valid file'}</p></div>
          </div>
        ) : null}

        {result.errors.length ? (
          <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center gap-2 font-black text-rose-800"><AlertCircle className="h-4 w-4" /> Import blocked — fix these rows</div>
            <div className="mt-3 max-h-52 space-y-2 overflow-auto">
              {result.errors.slice(0, 100).map((error, index) => <p key={`${error.row}-${index}`} className="rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-rose-700">Row {error.row}: {error.message}</p>)}
            </div>
          </div>
        ) : null}

        {result.records.length ? (
          <div className="overflow-hidden rounded-[1.25rem] border border-slate-200">
            <div className="grid grid-cols-[.4fr_1.6fr_1fr_.8fr_.7fr] bg-slate-950 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-white">
              <span>Row</span><span>Title</span><span>Category</span><span>Price</span><span>Stock</span>
            </div>
            <div className="max-h-64 overflow-auto">
              {result.records.slice(0, 30).map((record) => (
                <div key={record.row} className="grid grid-cols-[.4fr_1.6fr_1fr_.8fr_.7fr] border-t border-slate-100 px-4 py-3 text-xs font-semibold text-slate-700">
                  <span>{record.row}</span><span className="truncate font-black text-slate-900">{record.title}</span><span>{record.category}</span><span>{money(record.price)}</span><span>{record.stock}</span>
                </div>
              ))}
              {result.records.length > 30 ? <p className="border-t border-slate-100 px-4 py-3 text-center text-xs font-bold text-slate-400">+ {result.records.length - 30} more valid rows</p> : null}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)} disabled={importing}>Cancel</Button>
          <Button className="rounded-full bg-emerald-600 px-6 hover:bg-emerald-700" onClick={() => onImport(result.records)} disabled={!ready || importing}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />} Import {result.records.length || ''} product{result.records.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProductEditorDialog({ open, onOpenChange, form, setForm, onSave, saving, suggestedCategories, onUploadFiles }) {
  const inputRef = useRef(null)

  const images = useMemo(() => normalizeImages(form.images, form.image_url), [form.images, form.image_url])
  const price = numberValue(form.price)
  const compareAt = numberValue(form.compare_at_price)
  const previewVariantRows = useMemo(() => form.hasVariants ? buildVariantRows(form.variantTypes, form.variants, price) : [], [form.hasVariants, form.variantTypes, form.variants, price])
  const stock = form.hasVariants ? previewVariantRows.reduce((sum, item) => sum + Math.max(0, Math.round(numberValue(item.stock))), 0) : numberValue(form.stock)
  const discount = compareAt > price && price > 0 ? Math.round((1 - price / compareAt) * 100) : 0
  const canPublish = Boolean(form.title.trim() && form.description.trim() && form.category.trim() && price > 0 && images.length > 0)

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleTitleChange(event) {
    const value = event.target.value
    setForm((current) => ({
      ...current,
      title: value,
      slug: current.id || current.slug ? current.slug : slugify(value),
    }))
  }

  function handleTagKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ',') return
    event.preventDefault()
    const next = normalizeTags(form.tagsInput)
    if (!next.length) return
    setForm((current) => ({
      ...current,
      tags: [...new Set([...current.tags, ...next])].slice(0, 10),
      tagsInput: '',
    }))
  }

  function removeTag(tag) {
    setForm((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }))
  }

  function removeImage(url) {
    setForm((current) => {
      const nextImages = normalizeImages(current.images, current.image_url).filter((item) => item !== url)
      return {
        ...current,
        image_url: nextImages[0] || '',
        images: nextImages,
      }
    })
  }

  function setPrimaryImage(url) {
    setForm((current) => ({
      ...current,
      image_url: url,
      images: [url, ...normalizeImages(current.images, current.image_url).filter((item) => item !== url)],
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden rounded-[1.8rem] border-0 p-0 shadow-[0_40px_120px_-30px_rgba(15,23,42,.35)]">
        <div className="grid max-h-[92vh] grid-cols-1 overflow-hidden lg:grid-cols-[1.35fr_.8fr]">
          <div className="overflow-y-auto bg-white">
            <DialogHeader className="sticky top-0 z-20 border-b border-slate-200 bg-white/96 px-6 py-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-700">
                    <Sparkles className="h-3.5 w-3.5" /> Realtime product editor
                  </span>
                  <DialogTitle className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                    {form.id ? 'Edit product' : 'Add new product'}
                  </DialogTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    Update product information and preview the final storefront card instantly.
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-7 px-6 py-6">
              <section className="rounded-[1.4rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold text-slate-700">Title *</Label>
                    <Input
                      value={form.title}
                      onChange={handleTitleChange}
                      placeholder="Product name"
                      className="h-12 rounded-2xl border-slate-200 text-[15px] font-semibold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold text-slate-700">Slug</Label>
                    <Input
                      value={form.slug}
                      onChange={(event) => updateField('slug', slugify(event.target.value))}
                      placeholder="product-slug"
                      className="h-12 rounded-2xl border-slate-200 text-[15px] font-semibold"
                    />
                    <p className="text-[11px] font-medium text-slate-400">Realtime URL preview: /shop/your-shop/product/{form.slug || 'product-slug'}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold text-slate-700">Category</Label>
                    <Input
                      list="merchant-product-categories"
                      value={form.category}
                      onChange={(event) => updateField('category', event.target.value)}
                      placeholder="Choose or type category"
                      className="h-11 rounded-2xl border-slate-200 font-semibold"
                    />
                    <datalist id="merchant-product-categories">
                      {suggestedCategories.map((item) => <option key={item} value={item} />)}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold text-slate-700">Status</Label>
                    <select
                      value={form.status}
                      onChange={(event) => updateField('status', event.target.value)}
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-indigo-500"
                    >
                      <option value="draft">Draft — hidden</option>
                      <option value="active">Active — visible</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold text-slate-700">SKU</Label>
                    <Input
                      value={form.sku}
                      onChange={(event) => updateField('sku', event.target.value.toUpperCase())}
                      placeholder="SKU or item code"
                      className="h-11 rounded-2xl border-slate-200 font-semibold"
                    />
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <Label className="text-[13px] font-bold text-slate-700">Description <span className="text-rose-500">*</span></Label>
                  <Textarea
                    required
                    aria-required="true"
                    maxLength={600}
                    value={form.description}
                    onChange={(event) => updateField('description', event.target.value)}
                    placeholder="Describe your product, main highlights, material and usage..."
                    className="min-h-[116px] rounded-[1.2rem] border-slate-200 text-[15px] leading-6"
                  />
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                    <span>Short, benefit-led copy performs better in the storefront.</span>
                    <span>{form.description.length}/600</span>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-950">Images</h3>
                    <p className="text-sm text-slate-500">Max 6 images. Click any image to set it as the primary storefront image.</p>
                  </div>
                  <Button type="button" variant="outline" className="rounded-full" onClick={() => inputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" /> Upload image
                  </Button>
                  <input
                    ref={inputRef}
                    hidden
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => onUploadFiles(Array.from(event.target.files || []))}
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="flex aspect-square items-center justify-center rounded-[1.3rem] border border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-indigo-300 hover:bg-indigo-50"
                  >
                    <span className="text-center">
                      <ImagePlus className="mx-auto h-8 w-8" />
                      <span className="mt-3 block text-sm font-bold">Upload</span>
                    </span>
                  </button>

                  {images.map((url, index) => (
                    <div key={url} className="group relative overflow-hidden rounded-[1.3rem] border border-slate-200 bg-slate-50">
                      <button type="button" onClick={() => setPrimaryImage(url)} className="block aspect-square w-full overflow-hidden">
                        <img src={url} alt="Product" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      </button>
                      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${index === 0 ? 'bg-indigo-600 text-white' : 'bg-white/95 text-slate-700'}`}>
                          {index === 0 ? 'Primary' : `Image ${index + 1}`}
                        </span>
                        <button type="button" onClick={() => removeImage(url)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm transition hover:bg-rose-50 hover:text-rose-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5">
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold text-slate-700">Price (৳) *</Label>
                    <Input
                      value={form.price}
                      onChange={(event) => updateField('price', event.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="h-11 rounded-2xl border-slate-200 font-semibold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold text-slate-700">Compare at (৳)</Label>
                    <Input
                      value={form.compare_at_price}
                      onChange={(event) => updateField('compare_at_price', event.target.value)}
                      inputMode="decimal"
                      placeholder="Original"
                      className="h-11 rounded-2xl border-slate-200 font-semibold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold text-slate-700">{form.hasVariants ? 'Stock (from variants)' : 'Stock'}</Label>
                    <Input
                      value={form.hasVariants ? String(stock) : form.stock}
                      onChange={(event) => updateField('stock', event.target.value)}
                      inputMode="numeric"
                      placeholder="0"
                      disabled={form.hasVariants}
                      className="h-11 rounded-2xl border-slate-200 font-semibold disabled:bg-slate-100 disabled:text-slate-500"
                    />
                    {form.hasVariants ? <p className="text-[10px] font-semibold text-slate-400">Automatically calculated from all variant combinations.</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold text-slate-700">Low-stock alert at ≤</Label>
                    <Input
                      value={form.lowStockThreshold}
                      onChange={(event) => updateField('lowStockThreshold', event.target.value)}
                      inputMode="numeric"
                      min="0"
                      placeholder="5"
                      className="h-11 rounded-2xl border-slate-200 font-semibold"
                    />
                    <p className="text-[10px] font-semibold text-slate-400">0 means alert only when out of stock. Variants can override this value.</p>
                  </div>
                </div>

                <div className="mt-5 rounded-[1.2rem] border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-slate-700">
                    <span>Realtime pricing insight</span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700 shadow-sm">
                      {discount > 0 ? `${discount}% discount` : 'No discount'}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white/80 px-4 py-3 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Selling price</p>
                      <p className="mt-2 text-lg font-black text-slate-950">{money(price)}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 px-4 py-3 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Original price</p>
                      <p className="mt-2 text-lg font-black text-slate-950">{compareAt > 0 ? money(compareAt) : '—'}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 px-4 py-3 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Inventory</p>
                      <p className={`mt-2 text-lg font-black ${stock > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{stock > 0 ? `${stock} available` : 'Out of stock'}</p>
                    </div>
                  </div>
                </div>
              </section>

              <VariantEditorSection form={form} setForm={setForm} />

              <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5">
                <h3 className="text-base font-black text-slate-950">Product delivery charge</h3>
                <p className="mt-1 text-sm text-slate-500">Set free delivery or a custom delivery charge for this product. Custom charge overrides store default at checkout.</p>
                <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_.7fr]">
                  <select
                    value={form.deliveryMode}
                    onChange={(event) => updateField('deliveryMode', event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-indigo-500"
                  >
                    {DELIVERY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <Input
                    value={form.deliveryCharge}
                    onChange={(event) => updateField('deliveryCharge', event.target.value)}
                    inputMode="decimal"
                    disabled={form.deliveryMode !== 'custom'}
                    placeholder="Custom charge"
                    className="h-12 rounded-2xl border-slate-200 font-semibold disabled:opacity-50"
                  />
                </div>
              </section>

              <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5">
                <div className="space-y-2">
                  <Label className="text-[13px] font-bold text-slate-700">Tags (optional — for search & filtering)</Label>
                  <Input
                    value={form.tagsInput}
                    onChange={(event) => updateField('tagsInput', event.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Add tags (press Enter)..."
                    className="h-12 rounded-2xl border-slate-200 font-semibold"
                  />
                  <p className="text-[11px] font-medium text-slate-400">Examples: featured, skincare, bestselling, gift</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {form.tags.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => removeTag(tag)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                    >
                      #{tag}
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <DialogFooter className="sticky bottom-0 z-20 flex flex-col gap-3 border-t border-slate-200 bg-white/96 px-6 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                <CheckCircle2 className={`h-4 w-4 ${canPublish ? 'text-emerald-600' : 'text-slate-300'}`} />
                {canPublish ? 'Ready to publish' : 'Title, description, category, price and one image are required for publishing'}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" className="rounded-full bg-slate-950 px-6 hover:bg-indigo-600" onClick={onSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} {form.id ? 'Save changes' : 'Create product'}
                </Button>
              </div>
            </DialogFooter>
          </div>

          <aside className="hidden overflow-y-auto border-l border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50/60 p-6 lg:block">
            <div className="sticky top-0 space-y-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Live storefront preview</p>
                <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">See changes in realtime</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">This preview updates instantly as you edit the form on the left.</p>
              </div>

              <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_28px_70px_-40px_rgba(15,23,42,.3)]">
                <div className="relative aspect-square overflow-hidden bg-slate-100">
                  {images[0] ? (
                    <img src={images[0]} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-300">
                      <Package2 className="h-16 w-16" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
                    {discount > 0 ? <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-rose-600 shadow">-{discount}%</span> : <span />}
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] shadow-sm ${STATUS_META[productStatus(form)]?.chip || STATUS_META.draft.chip}`}>
                      {productStatus(form)}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    <span>{form.category || 'General'}</span>
                    <span>{stock > 0 ? `${stock} in stock` : 'Out of stock'}</span>
                  </div>
                  <h4 className="mt-2 text-[1.05rem] font-black leading-6 text-slate-950">{form.title || 'Your product title will appear here'}</h4>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{form.description || 'Your product description preview will update here as you type.'}</p>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-2xl font-black tracking-tight text-slate-950">{money(price)}</p>
                      {compareAt > price ? <p className="mt-1 text-xs font-semibold text-slate-400 line-through">{money(compareAt)}</p> : null}
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                      {stock > 0 ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="rounded-[1.3rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">SEO / URL</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">/{form.slug || 'product-slug'}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">Keep slug short and readable for cleaner product links.</p>
                </div>
                <div className="rounded-[1.3rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Search tags</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {form.tags.length ? form.tags.slice(0, 5).map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">#{tag}</span>
                    )) : <span className="text-xs font-medium text-slate-400">No tags yet</span>}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.3rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Publishing checklist</p>
                <div className="mt-4 space-y-3 text-sm font-semibold text-slate-700">
                  {[
                    { ok: Boolean(form.title.trim()), text: 'Product title added' },
                    { ok: Boolean(form.category.trim()), text: 'Category selected' },
                    { ok: price > 0, text: 'Valid selling price added' },
                    { ok: images.length > 0, text: 'At least one product image added' },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-3">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${item.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function MerchantProductsPage() {
  const { user } = useAuth()
  const { store, isLoading: storeLoading } = useCurrentStore()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editorOpen, setEditorOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [duplicating, setDuplicating] = useState(null)

  const channelRef = useRef(null)

  useEffect(() => {
    if (!store?.id) {
      const timer = window.setTimeout(() => setLoading(false), 0)
      return () => window.clearTimeout(timer)
    }
    loadProducts()
    subscribeRealtime()
    return () => unsubscribeRealtime()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id])

  function unsubscribeRealtime() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }

  function subscribeRealtime() {
    unsubscribeRealtime()
    if (!store?.id) return
    const channel = supabase
      .channel(`merchant-products-${store.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `store_id=eq.${store.id}` }, () => {
        loadProducts({ silent: true })
      })
      .subscribe()
    channelRef.current = channel
  }

  async function loadProducts({ silent = false } = {}) {
    if (!store?.id) return
    if (!silent) setLoading(true)

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', store.id)
      .order('updated_at', { ascending: false, nullsFirst: false })

    if (error) {
      toast.error(error.message || 'Could not load products')
      setProducts([])
    } else {
      setProducts((data || []).map((product) => ({
        ...product,
        images: normalizeImages(product.images, product.image_url),
        tags: normalizeTags(product.tags),
      })))
    }

    if (!silent) setLoading(false)
  }

  const filteredProducts = useMemo(() => {
    const search = query.trim().toLowerCase()
    return products.filter((product) => {
      const status = productStatus(product)
      const haystack = [product.title, product.category, product.sku, normalizeTags(product.tags).join(' ')].join(' ').toLowerCase()
      return (statusFilter === 'all' || status === statusFilter) && (!search || haystack.includes(search))
    })
  }, [products, query, statusFilter])

  const stats = useMemo(() => {
    const active = products.filter((item) => productStatus(item) === 'active').length
    const draft = products.filter((item) => productStatus(item) === 'draft').length
    const lowStock = products.filter((item) => numberValue(item.stock) > 0 && numberValue(item.stock) <= 5).length
    return { active, draft, lowStock }
  }, [products])

  const suggestedCategories = useMemo(() => {
    return [...new Set(products.map((item) => String(item.category || '').trim()).filter(Boolean))]
  }, [products])

  function openCreate() {
    setForm({ ...DEFAULT_FORM })
    setEditorOpen(true)
  }

  function openEdit(product) {
    setForm({
      id: product.id,
      title: product.title || '',
      slug: product.slug || slugify(product.title || ''),
      category: product.category || '',
      status: productStatus(product),
      description: product.description || '',
      price: String(product.price ?? '0'),
      compare_at_price: String(product.compare_at_price ?? ''),
      stock: String(product.stock ?? '0'),
      lowStockThreshold: String(product.low_stock_threshold ?? 5),
      sku: product.sku || '',
      tagsInput: '',
      tags: normalizeTags(product.tags),
      image_url: normalizeImages(product.images, product.image_url)[0] || '',
      images: normalizeImages(product.images, product.image_url),
      hasVariants: Boolean(product.has_variants && Array.isArray(product.variants) && product.variants.length),
      variantTypes: normalizeVariantTypes(Array.isArray(product.variant_types) ? product.variant_types : []),
      variants: buildVariantRows(Array.isArray(product.variant_types) ? product.variant_types : [], Array.isArray(product.variants) ? product.variants : [], numberValue(product.price), numberValue(product.low_stock_threshold, 5)),
      deliveryMode: product.delivery_charge_mode || 'store_default',
      deliveryCharge: String(product.delivery_charge_dhaka ?? product.delivery_charge_outside_dhaka ?? ''),
    })
    setEditorOpen(true)
  }

  async function uploadImages(files) {
    if (!files.length || !store?.id) return
    if (!user?.id) {
      toast.error('Your login session is not ready. Refresh the page and try again.')
      return
    }
    setUploading(true)
    try {
      const uploaded = []
      for (const file of files.slice(0, 6)) {
        const ext = String(file.name.split('.').pop() || 'jpg').toLowerCase()
        // Existing shop-branding RLS expects the authenticated user id as the
        // first folder segment: <auth.uid()>/<file-name>. Keep product images
        // isolated under products/<store-id>/ while preserving that contract.
        const path = `${user.id}/products/${store.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: uploadError } = await supabase.storage.from('shop-branding').upload(path, file, { upsert: false })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('shop-branding').getPublicUrl(path)
        if (data?.publicUrl) uploaded.push(data.publicUrl)
      }

      setForm((current) => {
        const next = [...normalizeImages(current.images, current.image_url), ...uploaded].slice(0, 6)
        return {
          ...current,
          image_url: current.image_url || next[0] || '',
          images: next,
        }
      })

      if (uploaded.length) toast.success(`${uploaded.length} image${uploaded.length > 1 ? 's' : ''} uploaded`)
    } catch (error) {
      const message = String(error?.message || '')
      toast.error(
        message.includes('row-level security')
          ? 'Image upload was blocked by Storage access rules. Sign out, sign in again, and retry.'
          : message || 'Could not upload image to the shop-branding bucket.'
      )
    } finally {
      setUploading(false)
    }
  }

  async function kickNotificationDelivery(reason = 'merchant_inventory_change') {
    if (!store?.id) return
    try {
      await supabase.functions.invoke('process-notification-queue', {
        body: { storeId: store.id, reason },
      })
    } catch {
      // Durable queues + cron retry remain the source of truth; UI save must not fail.
    }
  }

  async function saveProduct() {
    if (!store?.id) return
    if (!form.title.trim()) return toast.error('Enter product title')
    if (!form.description.trim()) return toast.error('Enter product description')
    if (!form.category.trim()) return toast.error('Choose a category')
    if (numberValue(form.price) <= 0) return toast.error('Enter a valid selling price')
    if (!Number.isInteger(numberValue(form.lowStockThreshold, NaN)) || numberValue(form.lowStockThreshold, NaN) < 0) return toast.error('Low-stock threshold must be a non-negative whole number')
    if (form.hasVariants) {
      const invalidThreshold = (form.variants || []).find((variant) => {
        if (variant.low_stock_threshold == null || String(variant.low_stock_threshold).trim() === '') return false
        const value = Number(variant.low_stock_threshold)
        return !Number.isInteger(value) || value < 0
      })
      if (invalidThreshold) return toast.error(`Low-stock threshold for ${invalidThreshold.label || 'a variant'} must be a non-negative whole number`)
    }

    setSaving(true)
    try {
      const imageList = normalizeImages(form.images, form.image_url)
      const variantData = form.hasVariants
        ? variantsForDatabase(form.variantTypes, form.variants, numberValue(form.price), numberValue(form.lowStockThreshold, 5))
        : { variantTypes: [], variants: [], totalStock: Math.max(0, Math.round(numberValue(form.stock, 0))) }

      if (form.hasVariants && (!variantData.variantTypes.length || !variantData.variants.length)) {
        throw new Error('Add at least one complete variant type and option before saving.')
      }

      const payload = {
        store_id: store.id,
        user_id: user?.id,
        title: form.title.trim(),
        slug: slugify(form.slug || form.title),
        category: form.category.trim(),
        status: form.status === 'active' ? 'published' : form.status === 'archived' ? 'archived' : 'draft',
        description: form.description.trim(),
        price: numberValue(form.price),
        compare_at_price: form.compare_at_price ? numberValue(form.compare_at_price) : null,
        stock: variantData.totalStock,
        low_stock_threshold: Math.max(0, Math.round(numberValue(form.lowStockThreshold, 5))),
        sku: form.sku.trim() || null,
        tags: form.tags,
        image_url: imageList[0] || null,
        images: imageList,
        has_variants: Boolean(form.hasVariants && variantData.variants.length),
        variant_types: variantData.variantTypes,
        variants: variantData.variants,
        delivery_charge_mode: form.deliveryMode || 'store_default',
        delivery_charge_dhaka: form.deliveryMode === 'custom' ? Math.max(0, numberValue(form.deliveryCharge, 0)) : null,
        delivery_charge_outside_dhaka: form.deliveryMode === 'custom' ? Math.max(0, numberValue(form.deliveryCharge, 0)) : null,
        updated_at: new Date().toISOString(),
      }

      let response
      if (form.id) {
        response = await supabase.from('products').update(payload).eq('id', form.id).select('*').single()
      } else {
        response = await supabase.from('products').insert({ ...payload, created_at: new Date().toISOString() }).select('*').single()
      }

      if (response.error) throw response.error

      void kickNotificationDelivery('product_inventory_change')
      toast.success(form.id ? 'Product updated successfully' : 'Product created successfully')
      setEditorOpen(false)
      await loadProducts({ silent: true })
    } catch (error) {
      toast.error(error.message || 'Could not save product')
    } finally {
      setSaving(false)
    }
  }

  async function duplicateProduct(product) {
    if (!store?.id || !product?.id) return
    setDuplicating(product.id)
    try {
      const existingSlugs = new Set(products.map((item) => String(item.slug || '').trim()).filter(Boolean))
      const slug = uniqueCatalogSlug(product.title || 'product', existingSlugs, 'copy')
      const variantTypes = Array.isArray(product.variant_types) ? product.variant_types : []
      const sourceVariants = Array.isArray(product.variants) ? product.variants : []
      const clonedVariants = sourceVariants.map((variant, index) => ({
        ...variant,
        id: `${variant.id || `variant-${index + 1}`}-copy-${Date.now().toString(36)}-${index + 1}`,
      }))

      const payload = {
        store_id: store.id,
        user_id: user?.id,
        title: `${product.title || 'Untitled product'} Copy`,
        slug,
        category: product.category || 'General',
        status: 'draft',
        description: product.description || '',
        price: numberValue(product.price),
        compare_at_price: product.compare_at_price ?? null,
        stock: Math.max(0, Math.round(numberValue(product.stock, 0))),
        low_stock_threshold: Math.max(0, Math.round(numberValue(product.low_stock_threshold, 5))),
        sku: null,
        tags: normalizeTags(product.tags),
        image_url: normalizeImages(product.images, product.image_url)[0] || null,
        images: normalizeImages(product.images, product.image_url),
        has_variants: Boolean(product.has_variants && clonedVariants.length),
        variant_types: variantTypes,
        variants: clonedVariants,
        delivery_charge_mode: product.delivery_charge_mode || 'store_default',
        delivery_charge_dhaka: product.delivery_charge_dhaka ?? null,
        delivery_charge_outside_dhaka: product.delivery_charge_outside_dhaka ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase.from('products').insert(payload).select('*').single()
      if (error) throw error

      void kickNotificationDelivery('product_duplicate')
      toast.success('Draft duplicate created')
      await loadProducts({ silent: true })
      if (data) openEdit({ ...data, status: 'draft' })
    } catch (error) {
      toast.error(error?.message || 'Could not duplicate product')
    } finally {
      setDuplicating(null)
    }
  }

  async function importProducts(records) {
    if (!store?.id || !records?.length) return
    if (records.length > 500) return toast.error('A single import can contain up to 500 products')

    setImporting(true)
    try {
      const existingSlugs = new Set(products.map((item) => String(item.slug || '').trim()).filter(Boolean))
      const now = new Date().toISOString()
      const payloads = records.map((record, index) => ({
        store_id: store.id,
        user_id: user?.id,
        title: record.title,
        slug: uniqueCatalogSlug(record.title, existingSlugs, index ? '' : ''),
        category: record.category,
        status: record.status,
        description: record.description || '',
        price: record.price,
        compare_at_price: record.compare_at_price,
        stock: record.stock,
        low_stock_threshold: record.low_stock_threshold,
        sku: record.sku,
        tags: record.tags,
        image_url: record.image_url,
        images: record.images,
        has_variants: record.has_variants,
        variant_types: record.variant_types,
        variants: record.variants,
        delivery_charge_mode: record.delivery_charge_mode || 'store_default',
        delivery_charge_dhaka: record.delivery_charge_dhaka,
        delivery_charge_outside_dhaka: record.delivery_charge_outside_dhaka,
        created_at: now,
        updated_at: now,
      }))

      const { data, error } = await supabase.from('products').insert(payloads).select('id')
      if (error) throw error

      void kickNotificationDelivery('bulk_product_import')
      toast.success(`${data?.length || payloads.length} products imported successfully`)
      setImportOpen(false)
      await loadProducts({ silent: true })
    } catch (error) {
      toast.error(error?.message || 'Bulk import failed. No products were imported.')
    } finally {
      setImporting(false)
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete “${product?.title || 'this product'}”?`)) return
    const { error } = await supabase.from('products').delete().eq('id', product.id)
    if (error) {
      toast.error(error.message || 'Could not delete product')
      return
    }
    toast.success('Product deleted')
    loadProducts({ silent: true })
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-gradient-to-br from-white via-[#f8faff] to-indigo-50/80 p-6 shadow-[0_28px_80px_-48px_rgba(15,23,42,.35)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white">
              <Sparkles className="h-3.5 w-3.5" /> Realtime catalog manager
            </span>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">Products</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500 sm:text-[15px]">
              Manage product information, images, prices and stock with a cleaner editor and live storefront preview.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="rounded-full px-5" onClick={() => loadProducts()} disabled={loading || storeLoading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronsUpDown className="mr-2 h-4 w-4" />} Refresh
            </Button>
            <Button variant="outline" className="rounded-full px-5" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Button className="rounded-full bg-slate-950 px-5 hover:bg-indigo-600" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add product
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ProductStat label="Total products" value={products.length} tone="slate" />
          <ProductStat label="Published" value={stats.active} tone="emerald" />
          <ProductStat label="Draft" value={stats.draft} tone="indigo" />
          <ProductStat label="Low stock" value={stats.lowStock} tone="amber" />
        </div>
      </section>

      <section className="rounded-[1.55rem] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_-42px_rgba(15,23,42,.22)] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, category, SKU or tags..." className="h-12 rounded-full border-slate-200 pl-11 pr-4 text-sm font-semibold" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              ['all', 'All'],
              ['active', 'Published'],
              ['draft', 'Draft'],
              ['archived', 'Archived'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded-full border px-4 py-2 text-sm font-black transition ${statusFilter === value ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {storeLoading || loading ? (
        <div className="grid gap-4">
          {[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-[1.45rem] border border-slate-200 bg-slate-100" />)}
        </div>
      ) : !store?.id ? (
        <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Select or create a merchant store first to manage products.
        </div>
      ) : filteredProducts.length ? (
        <div className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product) => (
              <ProductListCard key={product.id} product={product} onEdit={openEdit} onDuplicate={duplicateProduct} onDelete={deleteProduct} duplicating={duplicating} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-gradient-to-br from-white to-slate-50 px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <Package2 className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-950">No products yet</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">
            Add your first product to start selling. The new editor gives you a live preview, faster image handling and cleaner pricing controls.
          </p>
          <Button className="mt-6 rounded-full bg-slate-950 px-6 hover:bg-indigo-600" onClick={openCreate}>
            <ArrowUpRight className="mr-2 h-4 w-4" /> Add new product
          </Button>
        </div>
      )}

      {importOpen ? (
        <BulkImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImport={importProducts}
          importing={importing}
        />
      ) : null}

      <ProductEditorDialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!saving) setEditorOpen(open)
        }}
        form={form}
        setForm={setForm}
        saving={saving || uploading}
        onSave={saveProduct}
        suggestedCategories={suggestedCategories}
        onUploadFiles={uploadImages}
      />

      {uploading ? (
        <div className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" /> Uploading image...
        </div>
      ) : null}
    </motion.div>
  )
}
