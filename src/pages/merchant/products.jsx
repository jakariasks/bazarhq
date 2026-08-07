import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentStore } from '@/lib/use-current-store'
import { useAuth } from '@/hooks/use-auth'
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
  ImagePlus,
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
  sku: '',
  tagsInput: '',
  tags: [],
  image_url: '',
  images: [],
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

function ProductListCard({ product, onEdit, onDelete }) {
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

function ProductEditorDialog({ open, onOpenChange, form, setForm, onSave, saving, suggestedCategories, onUploadFiles }) {
  const inputRef = useRef(null)

  const images = useMemo(() => normalizeImages(form.images, form.image_url), [form.images, form.image_url])
  const price = numberValue(form.price)
  const compareAt = numberValue(form.compare_at_price)
  const stock = numberValue(form.stock)
  const discount = compareAt > price && price > 0 ? Math.round((1 - price / compareAt) * 100) : 0
  const canPublish = Boolean(form.title.trim() && form.category.trim() && price > 0 && images.length > 0)

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
                  <Label className="text-[13px] font-bold text-slate-700">Description</Label>
                  <Textarea
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
                <div className="grid gap-5 md:grid-cols-3">
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
                    <Label className="text-[13px] font-bold text-slate-700">Stock</Label>
                    <Input
                      value={form.stock}
                      onChange={(event) => updateField('stock', event.target.value)}
                      inputMode="numeric"
                      placeholder="0"
                      className="h-11 rounded-2xl border-slate-200 font-semibold"
                    />
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
                {canPublish ? 'Ready to publish' : 'Title, category, price and one image are required for publishing'}
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
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const channelRef = useRef(null)

  useEffect(() => {
    if (!store?.id) {
      setLoading(false)
      return
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
      sku: product.sku || '',
      tagsInput: '',
      tags: normalizeTags(product.tags),
      image_url: normalizeImages(product.images, product.image_url)[0] || '',
      images: normalizeImages(product.images, product.image_url),
      deliveryMode: 'store_default',
      deliveryCharge: '',
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

  async function saveProduct() {
    if (!store?.id) return
    if (!form.title.trim()) return toast.error('Enter product title')
    if (!form.category.trim()) return toast.error('Choose a category')
    if (numberValue(form.price) <= 0) return toast.error('Enter a valid selling price')

    setSaving(true)
    try {
      const imageList = normalizeImages(form.images, form.image_url)
      const payload = {
        store_id: store.id,
        user_id: user?.id,
        title: form.title.trim(),
        slug: slugify(form.slug || form.title),
        category: form.category.trim(),
        status: form.status === 'active' ? 'active' : form.status === 'archived' ? 'archived' : 'draft',
        description: form.description.trim(),
        price: numberValue(form.price),
        compare_at_price: form.compare_at_price ? numberValue(form.compare_at_price) : null,
        stock: Math.max(0, Math.round(numberValue(form.stock, 0))),
        sku: form.sku.trim() || null,
        tags: form.tags,
        image_url: imageList[0] || null,
        images: imageList,
        updated_at: new Date().toISOString(),
      }

      let response
      if (form.id) {
        response = await supabase.from('products').update(payload).eq('id', form.id).select('*').single()
      } else {
        response = await supabase.from('products').insert({ ...payload, created_at: new Date().toISOString() }).select('*').single()
      }

      if (response.error) throw response.error

      toast.success(form.id ? 'Product updated successfully' : 'Product created successfully')
      setEditorOpen(false)
      await loadProducts({ silent: true })
    } catch (error) {
      toast.error(error.message || 'Could not save product')
    } finally {
      setSaving(false)
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
              <ProductListCard key={product.id} product={product} onEdit={openEdit} onDelete={deleteProduct} />
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
