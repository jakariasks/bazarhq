import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ShoppingBag, ArrowRight, ArrowLeft, Loader2, X, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { previewThemes } from '@/lib/preview-themes'
import { AuthGuard } from '@/components/auth-guard'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/integrations/supabase/client'

const RESERVED = new Set(['www','api','app','admin','dashboard','shop','store','checkout','help','support','blog','docs','mail','email','status','about','login','signup','auth','static','assets','cdn','bazarhq'])
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,32)

function validateSubdomain(raw) {
  const slug = raw.toLowerCase().trim()
  if (!slug) return { ok: false, message: 'Subdomain is required.' }
  if (!/^[a-z0-9-]+$/.test(slug)) return { ok: false, message: 'Only lowercase letters, numbers, hyphens.' }
  if (slug.length < 3) return { ok: false, message: 'Must be at least 3 characters.' }
  if (slug.length > 32) return { ok: false, message: 'Must be 32 characters or fewer.' }
  if (/^[-0-9]/.test(slug)) return { ok: false, message: 'Must start with a letter.' }
  if (/-$/.test(slug)) return { ok: false, message: 'Cannot end with a hyphen.' }
  if (/--/.test(slug)) return { ok: false, message: 'No consecutive hyphens.' }
  if (RESERVED.has(slug)) return { ok: false, message: 'This subdomain is reserved.' }
  return { ok: true, slug }
}

const SHOP_TYPES = ['Fashion & Apparel','Electronics','Grocery & Food','Beauty & Personal Care','Home & Living','Books & Stationery','Handmade & Crafts','Sports & Outdoors','Other']
const SUGGESTED_CATS = ['Men','Women','Kids','Shoes','Accessories','Bags','Jewelry','Ethnic Wear','Electronics','Furniture','Skincare','Toys']

const STEPS = [
  { n: 1, label: 'Shop name' },
  { n: 2, label: 'Subdomain' },
  { n: 3, label: 'What you sell' },
  { n: 4, label: 'Theme' },
  { n: 5, label: 'Launch' },
]

function CreateStorePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [step, setStep] = useState(1)
  const [shopName, setShopName] = useState('')
  const [sub, setSub] = useState('')
  const [touched, setTouched] = useState(false)
  const [subStatus, setSubStatus] = useState({ kind: 'idle' })
  const [shopType, setShopType] = useState('')
  const [categories, setCategories] = useState([])
  const [catInput, setCatInput] = useState('')
  const [theme, setTheme] = useState(previewThemes[0].id)
  const [launching, setLaunching] = useState(false)
  const debounceRef = useRef(null)
  const reqIdRef = useRef(0)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!sub) { setSubStatus({ kind: 'idle' }); return }
    const v = validateSubdomain(sub)
    if (!v.ok) { setSubStatus({ kind: 'error', message: v.message }); return }
    setSubStatus({ kind: 'checking' })
    const myReq = ++reqIdRef.current
    debounceRef.current = setTimeout(async () => {
      const { data, error } = await supabase.from('stores').select('id').eq('subdomain', v.slug).maybeSingle()
      if (myReq !== reqIdRef.current) return
      if (error) { setSubStatus({ kind: 'error', message: "Couldn't check." }); return }
      if (data) { setSubStatus({ kind: 'error', message: 'This subdomain is taken.' }); return }
      setSubStatus({ kind: 'ok' })
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [sub])

  const onSubInput = (raw) => { setTouched(true); setSub(raw.toLowerCase().replace(/\s+/g,'-').slice(0,32)) }
  const addCategory = (cat) => { const c = cat.trim(); if (!c || categories.includes(c)) return; setCategories([...categories, c]); setCatInput('') }
  const removeCategory = (cat) => setCategories(categories.filter((c) => c !== cat))
  const toggleSuggested = (cat) => { if (categories.includes(cat)) removeCategory(cat); else addCategory(cat) }

  const canNext = () => {
    if (step === 1) return shopName.trim().length >= 2
    if (step === 2) return subStatus.kind === 'ok'
    if (step === 3) return !!shopType
    return true
  }

  const next = () => {
    if (step === 2 && subStatus.kind !== 'ok') { setTouched(true); return }
    if (!canNext()) return
    setStep(step + 1)
  }

  const launch = async () => {
    if (!user) return
    setLaunching(true)
    const { data, error } = await supabase.from('stores').insert({
      owner_id: user.id,
      shop_name: shopName.trim(),
      subdomain: sub,
      theme_id: theme,
      business_category: shopType,
      categories: categories,
    }).select('id').single()
    if (error || !data) { setLaunching(false); toast.error(error?.message ?? 'Failed'); return }
    await supabase.from('profiles').update({ current_store_id: data.id }).eq('id', user.id)
    await qc.invalidateQueries()
    setLaunching(false)
    toast.success('Store created! 🎉')
    navigate({ to: '/merchant' })
  }

  const showSubError = touched && subStatus.kind === 'error'
  const showSubOk = subStatus.kind === 'ok'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 p-4">
      <div className="mx-auto max-w-2xl">

        <div className="flex items-center justify-between py-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <ShoppingBag className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">BazarHQ</span>
          </Link>
          <Link to="/merchant" className="text-sm text-muted-foreground hover:text-foreground">Cancel</Link>
        </div>

        {/* Steps */}
        <div className="mb-8 flex items-center justify-center">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                s.n < step ? 'bg-primary text-primary-foreground shadow-glow'
                : s.n === step ? 'bg-primary text-primary-foreground shadow-glow ring-4 ring-primary/20'
                : 'border border-border bg-white text-muted-foreground'
              }`}>
                {s.n < step ? <Check className="h-4 w-4" /> : s.n}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-10 sm:w-16 transition-all duration-500 ${s.n < step ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.22 }}
            className="rounded-2xl bg-white p-7 shadow-elegant sm:p-10"
          >

            {step === 1 && (
              <>
                <h1 className="text-2xl font-bold">Name your new store</h1>
                <p className="mt-1 text-sm text-muted-foreground">You can change this anytime.</p>
                <div className="mt-6 grid gap-2">
                  <Label>Shop name</Label>
                  <Input autoFocus value={shopName} onChange={(e) => { setShopName(e.target.value); if (!touched) setSub(slugify(e.target.value)) }} placeholder="My Awesome Shop" maxLength={80} className="h-11 text-base" />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="text-2xl font-bold">Pick a subdomain</h1>
                <p className="mt-1 text-sm text-muted-foreground">Your shop will live at this URL.</p>
                <div className="mt-6 grid gap-2">
                  <Label>Subdomain</Label>
                  <div className={`flex overflow-hidden rounded-lg border bg-white transition-all focus-within:ring-2 ${showSubError ? 'border-destructive focus-within:ring-destructive/30' : showSubOk ? 'border-success focus-within:ring-success/30' : 'border-border focus-within:ring-ring'}`}>
                    <Input autoFocus value={sub} onChange={(e) => onSubInput(e.target.value)} onBlur={() => setTouched(true)} autoComplete="off" spellCheck={false} placeholder="my-shop" className="h-11 border-0 text-base focus-visible:ring-0" />
                    <div className="flex shrink-0 items-center gap-2 border-l border-border bg-muted px-3 text-sm text-muted-foreground">
                      .bazarhq.com
                      <span className="flex h-5 w-5 items-center justify-center">
                        {subStatus.kind === 'checking' && <Loader2 className="h-4 w-4 animate-spin" />}
                        {showSubOk && <Check className="h-4 w-4 text-success" />}
                        {showSubError && <X className="h-4 w-4 text-destructive" />}
                      </span>
                    </div>
                  </div>
                  <div className="min-h-[1.25rem] text-xs" aria-live="polite">
                    <AnimatePresence mode="wait">
                      {showSubOk && <motion.span key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 font-medium text-success"><Check className="h-3 w-3" /> Available — <span className="underline">{sub}.bazarhq.com</span></motion.span>}
                      {showSubError && <motion.span key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3 w-3" /> {subStatus.message}</motion.span>}
                    </AnimatePresence>
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h1 className="text-2xl font-bold">What do you sell?</h1>
                <p className="mt-1 text-sm text-muted-foreground">Pick your shop type and the categories you carry.</p>
                <div className="mt-6">
                  <Label className="mb-3 block">Shop type</Label>
                  <div className="flex flex-wrap gap-2">
                    {SHOP_TYPES.map((t) => (
                      <button key={t} type="button" onClick={() => setShopType(t)} className={`rounded-lg border px-3 py-1.5 text-sm transition-all ${shopType === t ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border bg-white text-foreground hover:border-primary/50'}`}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="mt-6">
                  <Label className="mb-3 block">Categories <span className="font-normal text-muted-foreground">({categories.length} selected)</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_CATS.map((c) => (
                      <button key={c} type="button" onClick={() => toggleSuggested(c)} className={`rounded-full border px-3 py-1 text-xs transition-all ${categories.includes(c) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-muted-foreground hover:border-primary/50'}`}>
                        {categories.includes(c) && '✓ '}{c}
                      </button>
                    ))}
                  </div>
                  {categories.filter((c) => !SUGGESTED_CATS.includes(c)).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {categories.filter((c) => !SUGGESTED_CATS.includes(c)).map((c) => (
                        <span key={c} className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          {c}<button type="button" onClick={() => removeCategory(c)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Input value={catInput} onChange={(e) => setCatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(catInput) } }} placeholder="Add another category..." className="flex-1" />
                    <Button type="button" variant="outline" onClick={() => addCategory(catInput)} disabled={!catInput.trim()}>Add</Button>
                  </div>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <h1 className="text-2xl font-bold">Pick a starter theme</h1>
                <p className="mt-1 text-sm text-muted-foreground">You can customise everything later.</p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  {previewThemes.map((t) => (
                    <button key={t.id} type="button" onClick={() => setTheme(t.id)} className={`relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all ${theme === t.id ? 'border-primary shadow-glow' : 'border-border hover:border-primary/50'}`}>
                      <div className="mb-3 h-24 rounded-lg" style={{ background: `linear-gradient(135deg, ${t.swatch}, ${t.swatch}88)` }} />
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-muted-foreground">Brand-ready palette</div>
                      {theme === t.id && <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></div>}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 5 && (
              <div className="flex flex-col items-center py-6 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-glow">
                  <Check className="h-10 w-10 text-primary-foreground" />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <h1 className="mt-6 text-2xl font-bold">Ready to launch! 🎉</h1>
                  <p className="mt-2 text-sm text-muted-foreground">Your new store will live at <strong className="text-foreground">{sub}.bazarhq.com</strong></p>
                  {shopType && (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{shopType}</span>
                      {categories.slice(0, 4).map((c) => <span key={c} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{c}</span>)}
                      {categories.length > 4 && <span className="text-xs text-muted-foreground">+{categories.length - 4} more</span>}
                    </div>
                  )}
                </motion.div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between">
              {step > 1 && step < 5 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Button>
              ) : <div />}
              {step < 5 ? (
                <Button onClick={next} disabled={!canNext()} className="bg-gradient-primary px-6 shadow-glow">
                  Continue <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={launch} disabled={launching} className="bg-gradient-primary px-8 shadow-glow">
                  {launching ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : <>Create store <ArrowRight className="ml-1.5 h-4 w-4" /></>}
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function WrappedCreateStorePage() {
  return <AuthGuard><CreateStorePage /></AuthGuard>
}

export default WrappedCreateStorePage
