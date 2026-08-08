import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  Loader2,
  Monitor,
  Palette,
  RefreshCcw,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Tablet,
  WandSparkles,
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentStore } from '@/lib/use-current-store'
import {
  applyStoreThemeToDocument,
  broadcastStoreThemeUpdate,
} from '@/lib/theme-system'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DEFAULT_THEME = {
  primary_color: '#4f46e5',
  secondary_color: '#10b981',
  accent_color: '#d624f9',
  surface_color: '#ffffff',
  background_color: '#f8fafc',
  text_color: '#0f172a',
  layout_preset: 'modern-brand',
  font_family: 'poppins',
  nav_style: 'minimal',
  hero_style: 'split',
  card_style: 'shadow',
  button_style: 'pill',
  corner_radius: 'extra',
  density: 'comfortable',
  background_style: 'gradient',
  animation_style: 'smooth',
  product_grid: 'three',
  content_width: 'standard',
  hero_height: 'standard',
  hero_alignment: 'left',
  image_ratio: 'square',
  image_fit: 'cover',
  shadow_strength: 'medium',
  card_hover: 'lift',
  heading_style: 'normal',
}

const VIEWPORTS = {
  desktop: { label: 'Desktop', width: 1440, icon: Monitor },
  tablet: { label: 'Tablet', width: 900, icon: Tablet },
  mobile: { label: 'Mobile', width: 390, icon: Smartphone },
}

const CONTROL_OPTIONS = {
  layout_preset: [
    ['modern-brand', 'Modern brand'],
    ['marketplace', 'Marketplace'],
    ['boutique', 'Boutique'],
    ['minimal', 'Minimal'],
    ['tech', 'Tech'],
    ['editorial', 'Editorial'],
    ['catalog', 'Catalog wide'],
    ['luxury', 'Luxury'],
  ],
  font_family: [
    ['inter', 'Inter'],
    ['plus-jakarta', 'Plus Jakarta'],
    ['poppins', 'Poppins'],
    ['manrope', 'Manrope'],
    ['playfair', 'Playfair'],
    ['system', 'System UI'],
    ['georgia', 'Georgia Serif'],
    ['arial', 'Arial'],
    ['verdana', 'Verdana'],
    ['trebuchet', 'Trebuchet'],
    ['times', 'Times New Roman'],
    ['courier', 'Courier Mono'],
    ['rounded', 'Rounded UI'],
  ],
  nav_style: [
    ['glass', 'Glass'],
    ['minimal', 'Minimal'],
    ['solid', 'Solid'],
    ['dark', 'Dark'],
    ['floating', 'Floating'],
    ['accent', 'Accent line'],
  ],
  hero_style: [
    ['banner-right', 'Banner right'],
    ['split', 'Split'],
    ['editorial', 'Editorial'],
    ['compact', 'Compact'],
    ['centered', 'Centered'],
    ['full-bleed', 'Full bleed'],
    ['minimal', 'Minimal text'],
  ],
  card_style: [
    ['soft', 'Soft'],
    ['shadow', 'Shadow'],
    ['glass', 'Glass'],
    ['bordered', 'Bordered'],
    ['flat', 'Flat'],
    ['elevated', 'Elevated'],
    ['gradient', 'Gradient'],
  ],
  button_style: [
    ['pill', 'Pill'],
    ['rounded', 'Rounded'],
    ['soft', 'Soft'],
    ['square', 'Square'],
    ['outline', 'Outline'],
    ['gradient', 'Gradient'],
  ],
  corner_radius: [
    ['extra', 'Extra round'],
    ['large', 'Large'],
    ['medium', 'Medium'],
    ['small', 'Small'],
    ['sharp', 'Sharp'],
  ],
  density: [
    ['compact', 'Compact'],
    ['comfortable', 'Comfortable'],
    ['spacious', 'Spacious'],
    ['airy', 'Airy'],
  ],
  background_style: [
    ['gradient', 'Gradient'],
    ['clean', 'Clean'],
    ['soft', 'Soft'],
    ['warm', 'Warm'],
    ['cool', 'Cool'],
    ['contrast', 'Contrast'],
    ['dark', 'Dark'],
  ],
  animation_style: [
    ['none', 'None'],
    ['minimal', 'Minimal'],
    ['smooth', 'Smooth'],
    ['premium', 'Premium'],
    ['playful', 'Playful'],
  ],
  product_grid: [
    ['two', '2 columns'],
    ['three', '3 columns'],
    ['four', '4 columns'],
    ['five', '5 columns'],
    ['six', '6 columns'],
  ],
  content_width: [
    ['narrow', 'Narrow'],
    ['standard', 'Standard'],
    ['wide', 'Wide'],
    ['full', 'Full width'],
  ],
  hero_height: [
    ['short', 'Short'],
    ['standard', 'Standard'],
    ['tall', 'Tall'],
    ['cinematic', 'Cinematic'],
  ],
  hero_alignment: [
    ['left', 'Left'],
    ['center', 'Center'],
    ['right', 'Right'],
  ],
  image_ratio: [
    ['square', 'Square 1:1'],
    ['portrait', 'Portrait 4:5'],
    ['landscape', 'Landscape 4:3'],
    ['wide', 'Wide 16:9'],
  ],
  image_fit: [
    ['cover', 'Cover'],
    ['contain', 'Contain'],
  ],
  shadow_strength: [
    ['none', 'No shadow'],
    ['soft', 'Soft'],
    ['medium', 'Medium'],
    ['strong', 'Strong'],
  ],
  card_hover: [
    ['none', 'None'],
    ['lift', 'Lift'],
    ['zoom', 'Zoom'],
    ['glow', 'Glow'],
  ],
  heading_style: [
    ['normal', 'Normal'],
    ['editorial', 'Editorial'],
    ['uppercase', 'Uppercase'],
    ['spaced', 'Spaced caps'],
  ],
}


function objectValue(value) {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

function safeHex(value, fallback) {
  const text = String(value || '').trim()
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback
}

function hexToRgba(hex, alpha) {
  const clean = safeHex(hex, '#4f46e5').slice(1)
  const n = Number.parseInt(clean, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function normalizeTheme(theme, overrides = {}) {
  const row = theme || {}
  const config = objectValue(row.config)
  const overrideConfig = objectValue(overrides)

  const pick = (key, fallback) => (
    overrideConfig[key] ??
    row[key] ??
    config[key] ??
    fallback
  )

  return {
    primary_color: safeHex(pick('primary_color', DEFAULT_THEME.primary_color), DEFAULT_THEME.primary_color),
    secondary_color: safeHex(pick('secondary_color', DEFAULT_THEME.secondary_color), DEFAULT_THEME.secondary_color),
    accent_color: safeHex(pick('accent_color', DEFAULT_THEME.accent_color), DEFAULT_THEME.accent_color),
    surface_color: safeHex(pick('surface_color', DEFAULT_THEME.surface_color), DEFAULT_THEME.surface_color),
    background_color: safeHex(pick('background_color', DEFAULT_THEME.background_color), DEFAULT_THEME.background_color),
    text_color: safeHex(pick('text_color', DEFAULT_THEME.text_color), DEFAULT_THEME.text_color),
    layout_preset: String(pick('layout_preset', DEFAULT_THEME.layout_preset)),
    font_family: String(pick('font_family', DEFAULT_THEME.font_family)),
    nav_style: String(pick('nav_style', DEFAULT_THEME.nav_style)),
    hero_style: String(pick('hero_style', DEFAULT_THEME.hero_style)),
    card_style: String(pick('card_style', DEFAULT_THEME.card_style)),
    button_style: String(pick('button_style', DEFAULT_THEME.button_style)),
    corner_radius: String(pick('corner_radius', DEFAULT_THEME.corner_radius)),
    density: String(pick('density', DEFAULT_THEME.density)),
    background_style: String(pick('background_style', DEFAULT_THEME.background_style)),
    animation_style: String(pick('animation_style', DEFAULT_THEME.animation_style)),
    product_grid: String(pick('product_grid', DEFAULT_THEME.product_grid)),
    content_width: String(pick('content_width', DEFAULT_THEME.content_width)),
    hero_height: String(pick('hero_height', DEFAULT_THEME.hero_height)),
    hero_alignment: String(pick('hero_alignment', DEFAULT_THEME.hero_alignment)),
    image_ratio: String(pick('image_ratio', DEFAULT_THEME.image_ratio)),
    image_fit: String(pick('image_fit', DEFAULT_THEME.image_fit)),
    shadow_strength: String(pick('shadow_strength', DEFAULT_THEME.shadow_strength)),
    card_hover: String(pick('card_hover', DEFAULT_THEME.card_hover)),
    heading_style: String(pick('heading_style', DEFAULT_THEME.heading_style)),
  }
}

function serializeDraft(slug, draft) {
  return JSON.stringify({ slug: slug || '', ...draft })
}

function themeLabel(theme) {
  return theme?.name || theme?.theme_name || theme?.slug || 'Theme'
}

function ThemeMiniature({ theme, selected }) {
  const config = normalizeTheme(theme)
  const radius = config.corner_radius === 'sharp'
    ? '4px'
    : config.corner_radius === 'small'
      ? '8px'
      : config.corner_radius === 'medium'
        ? '12px'
        : '18px'

  return (
    <div
      className="relative h-[126px] overflow-hidden border"
      style={{
        borderRadius: radius,
        borderColor: selected ? config.primary_color : '#e2e8f0',
        background: `linear-gradient(145deg, ${config.background_color}, ${hexToRgba(config.primary_color, 0.12)})`,
      }}
    >
      <div className="absolute inset-x-0 top-0 flex h-8 items-center gap-1.5 border-b border-black/5 px-3" style={{ background: config.surface_color }}>
        <span className="h-2.5 w-8 rounded-full" style={{ background: hexToRgba(config.primary_color, 0.34) }} />
        <span className="ml-auto h-2 w-2 rounded-full" style={{ background: config.accent_color }} />
      </div>

      <div
        className="absolute inset-x-3 top-10 h-12 overflow-hidden"
        style={{
          borderRadius: radius,
          background: `linear-gradient(110deg, ${config.primary_color}, ${config.secondary_color})`,
        }}
      >
        <span className="absolute left-3 top-3 h-2 w-16 rounded-full bg-white/80" />
        <span className="absolute left-3 top-7 h-1.5 w-10 rounded-full bg-white/40" />
        <span className="absolute right-3 top-2 h-8 w-12 rounded-xl bg-white/20" />
      </div>

      <div className="absolute inset-x-3 bottom-3 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((item) => (
          <span
            key={item}
            className="h-5 border border-black/5"
            style={{
              borderRadius: radius,
              background: item === 1 ? hexToRgba(config.accent_color, 0.18) : config.surface_color,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function SelectControl({ label, value, options, onChange }) {
  const hasCurrent = options.some(([optionValue]) => optionValue === value)
  const safeOptions = hasCurrent ? options : [[value, value], ...options]

  return (
    <div className="space-y-2">
      <Label className="text-[11px] font-black uppercase tracking-[0.11em] text-slate-500">{label}</Label>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-3 pr-9 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        >
          {safeOptions.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>{optionLabel}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  )
}

function ColorControl({ label, value, onChange }) {
  return (
    <div className="space-y-2">
      <Label className="text-[11px] font-black uppercase tracking-[0.11em] text-slate-500">{label}</Label>
      <div className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100">
        <input
          type="color"
          value={safeHex(value, '#4f46e5')}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-8 cursor-pointer overflow-hidden rounded-lg border-0 bg-transparent p-0"
          aria-label={`${label} picker`}
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onChange(safeHex(event.target.value, value))}
          className="h-8 border-0 bg-transparent p-0 text-xs font-bold uppercase shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  )
}

function injectLiveTheme(frame, draft, themeSlug, themeName) {
  try {
    const doc = frame?.contentDocument
    if (!doc?.body) return false

    return applyStoreThemeToDocument({
      theme_id: themeSlug || 'preview',
      theme_name: themeName || 'Preview',
      brand_color: draft.primary_color,
      theme_config: {
        ...draft,
        slug: themeSlug || 'preview',
        name: themeName || 'Preview',
      },
      theme_updated_at: new Date().toISOString(),
    }, doc)
  } catch (error) {
    console.warn('Could not apply live theme preview:', error)
    return false
  }
}

function ActualStorefrontPreview({ store, draft, themeSlug, themeName, viewport, onViewport, refreshKey, onRefresh }) {
  const iframeRef = useRef(null)
  const stageRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [loaded, setLoaded] = useState(false)

  const preview = VIEWPORTS[viewport] || VIEWPORTS.desktop
  const storefrontPath = store?.subdomain
    ? `/shop/${encodeURIComponent(store.subdomain)}?bazarhq_theme_preview=1`
    : '/shop'

  const applyTheme = useCallback(() => {
    const frame = iframeRef.current
    if (!frame) return
    const applied = injectLiveTheme(frame, draft, themeSlug, themeName)
    if (applied) setLoaded(true)
  }, [draft, themeSlug, themeName])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined

    const updateScale = () => {
      const available = Math.max(320, stage.clientWidth - 24)
      setScale(Math.min(1, available / preview.width))
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [preview.width])

  useEffect(() => {
    const frame = iframeRef.current
    if (!frame) return undefined

    const timer = window.setTimeout(applyTheme, 0)
    return () => window.clearTimeout(timer)
  }, [applyTheme])

  const iframeHeight = viewport === 'mobile' ? 1200 : 1050

  return (
    <section className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-[0_30px_90px_-54px_rgba(15,23,42,.42)] xl:flex xl:h-full xl:min-h-0 xl:flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-emerald-700">Actual storefront · live preview</p>
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">
            Unsaved design changes are applied instantly inside the real storefront.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {Object.entries(VIEWPORTS).map(([key, item]) => {
            const Icon = item.icon
            const active = viewport === key
            return (
              <button
                type="button"
                key={key}
                onClick={() => onViewport(key)}
                title={item.label}
                className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
                  active
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
          <button
            type="button"
            onClick={onRefresh}
            title="Reload storefront"
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <p className="min-w-0 flex-1 truncate text-center text-[11px] font-bold text-slate-500">
            {store?.subdomain ? `${store.subdomain}.bazarhq.com` : 'your-store.bazarhq.com'}
          </p>
          <Eye className="h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>

      <div
        ref={stageRef}
        className="relative h-[620px] min-h-[620px] overflow-auto overscroll-contain bg-[radial-gradient(circle_at_top,#e0e7ff_0,transparent_36%),#eef2f7] p-3 xl:h-auto xl:min-h-0 xl:flex-1"
      >
        {!store?.storefront_published && (
          <div className="absolute left-1/2 top-5 z-30 -translate-x-1/2 rounded-full border border-amber-200 bg-amber-50/95 px-4 py-2 text-xs font-bold text-amber-800 shadow-lg backdrop-blur">
            Full live storefront preview is available after the store is published.
          </div>
        )}

        {!loaded && store?.storefront_published && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-slate-50/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              Loading real storefront…
            </div>
          </div>
        )}

        <div
          className="mx-auto"
          style={{
            width: preview.width * scale,
            height: iframeHeight * scale,
          }}
        >
          <div
            className="origin-top overflow-hidden rounded-[1.1rem] bg-white shadow-[0_30px_90px_-36px_rgba(15,23,42,.45)]"
            style={{
              width: preview.width,
              height: iframeHeight,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <iframe
              key={`${storefrontPath}-${refreshKey}`}
              ref={iframeRef}
              title="Actual storefront live theme preview"
              src={storefrontPath}
              onLoad={() => {
                setLoaded(false)
                window.setTimeout(() => {
                  injectLiveTheme(iframeRef.current, draft, themeSlug, themeName)
                  setLoaded(true)
                }, 120)
              }}
              className="h-full w-full border-0 bg-white"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

export default function MerchantThemesPage() {
  const { store, isLoading: storeLoading } = useCurrentStore()
  const [themes, setThemes] = useState([])
  const [loadingThemes, setLoadingThemes] = useState(true)
  const [selectedSlug, setSelectedSlug] = useState('')
  const [draft, setDraft] = useState(DEFAULT_THEME)
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewport, setViewport] = useState('desktop')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true

    async function loadThemes() {
      setLoadingThemes(true)

      const { data, error } = await supabase
        .from('platform_themes')
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true })

      if (!mounted) return

      if (error) {
        toast.error(error.message || 'Could not load themes')
        setThemes([])
      } else {
        setThemes(data || [])
      }

      setLoadingThemes(false)
    }

    loadThemes()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!store || !themes.length) return

    const currentSlug = String(store.theme_id || '').trim()
    const selected =
      themes.find((theme) => theme.slug === currentSlug) ||
      themes.find((theme) => theme.is_default) ||
      themes[0]

    const nextSlug = selected?.slug || ''
    const nextDraft = normalizeTheme(selected, {
      ...objectValue(store.theme_config),
      primary_color: objectValue(store.theme_config).primary_color || store.brand_color,
    })

    setSelectedSlug(nextSlug)
    setDraft(nextDraft)
    setSavedSnapshot(serializeDraft(nextSlug, nextDraft))
  }, [store?.id, store?.theme_id, store?.brand_color, store?.theme_updated_at, themes])

  const selectedTheme = useMemo(
    () => themes.find((theme) => theme.slug === selectedSlug) || themes[0] || null,
    [themes, selectedSlug],
  )

  const dirty = savedSnapshot && serializeDraft(selectedSlug, draft) !== savedSnapshot

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function chooseTheme(theme) {
    const next = normalizeTheme(theme)
    setSelectedSlug(theme.slug)
    setDraft(next)
  }

  function resetToSelectedTheme() {
    if (!selectedTheme) return
    setDraft(normalizeTheme(selectedTheme))
    toast.success('Theme defaults restored in preview')
  }

  async function saveTheme() {
    if (!store?.id || !selectedTheme?.slug) {
      toast.error('Select a theme first')
      return
    }

    setSaving(true)

    try {
      const { error: applyError } = await supabase.rpc('apply_store_theme', {
        p_store_id: store.id,
        p_theme_slug: selectedTheme.slug,
        p_primary_color: safeHex(draft.primary_color, DEFAULT_THEME.primary_color),
        p_secondary_color: safeHex(draft.secondary_color, DEFAULT_THEME.secondary_color),
        p_accent_color: safeHex(draft.accent_color, DEFAULT_THEME.accent_color),
      })

      if (applyError) throw applyError

      const config = {
        ...objectValue(selectedTheme.config),
        ...draft,
        slug: selectedTheme.slug,
        name: themeLabel(selectedTheme),
        description: selectedTheme.description || null,
      }

      const savedAt = new Date().toISOString()
      const savedStoreTheme = {
        ...store,
        theme_id: selectedTheme.slug,
        theme_name: themeLabel(selectedTheme),
        brand_color: draft.primary_color,
        theme_config: config,
        theme_updated_at: savedAt,
        updated_at: savedAt,
      }

      const { error: updateError } = await supabase
        .from('stores')
        .update({
          theme_id: savedStoreTheme.theme_id,
          theme_name: savedStoreTheme.theme_name,
          brand_color: savedStoreTheme.brand_color,
          theme_config: savedStoreTheme.theme_config,
          theme_updated_at: savedStoreTheme.theme_updated_at,
          updated_at: savedStoreTheme.updated_at,
        })
        .eq('id', store.id)

      if (updateError) throw updateError

      // Update any already-open storefront tab immediately. The storefront also
      // listens to Supabase Realtime through theme-system.js, so other viewers
      // receive the saved theme without a manual refresh when Realtime is enabled.
      broadcastStoreThemeUpdate(savedStoreTheme)

      setSavedSnapshot(serializeDraft(selectedTheme.slug, draft))
      setRefreshKey((current) => current + 1)
      toast.success('Storefront theme saved and published')
    } catch (error) {
      console.error('Theme save failed:', error)
      toast.error(error?.message || 'Could not save theme')
    } finally {
      setSaving(false)
    }
  }

  function openStorefront() {
    if (!store?.subdomain) return
    window.open(`/shop/${encodeURIComponent(store.subdomain)}`, '_blank', 'noopener,noreferrer')
  }

  if (storeLoading || loadingThemes) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          Loading storefront design studio…
        </div>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="rounded-[1.7rem] border border-amber-200 bg-amber-50 p-8 text-center">
        <Palette className="mx-auto h-9 w-9 text-amber-600" />
        <h2 className="mt-3 text-xl font-black text-slate-950">Create a store first</h2>
        <p className="mt-2 text-sm text-slate-600">Theme customization becomes available after your first store is created.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1700px] pb-12 xl:flex xl:h-[calc(100vh-5.25rem)] xl:min-h-0 xl:flex-col xl:overflow-hidden xl:pb-0">
      <header className="sticky top-[70px] z-40 mb-6 xl:static xl:top-auto xl:shrink-0 rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,.97)_0%,rgba(248,250,252,.97)_48%,rgba(238,242,255,.97)_100%)] backdrop-blur-xl p-5 shadow-[0_25px_80px_-55px_rgba(15,23,42,.38)] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700">
              <WandSparkles className="h-3.5 w-3.5" />
              Storefront design studio
            </span>
            <h1 className="mt-3 text-2xl font-black tracking-[-0.03em] text-slate-950 sm:text-3xl">
              Themes & Customisation
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
              Select a professionally designed theme, fine-tune every visual detail, and watch the actual storefront update on the right before saving.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-2 text-xs font-black ${
              dirty
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}>
              {dirty ? 'Unsaved preview' : 'Saved'}
            </span>

            <Button variant="outline" className="rounded-full" onClick={openStorefront}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open storefront
            </Button>

            <Button
              className="rounded-full bg-emerald-600 px-5 font-black text-white hover:bg-emerald-700"
              onClick={saveTheme}
              disabled={saving || !dirty}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-6 xl:min-h-0 xl:flex-1 xl:overflow-hidden xl:grid-cols-[470px_minmax(0,1fr)]">
        <div className="space-y-5 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pr-2 xl:pb-6 [scrollbar-gutter:stable] [scrollbar-width:thin]">
          <section className="rounded-[1.7rem] border border-slate-200 bg-white p-4 shadow-[0_22px_65px_-48px_rgba(15,23,42,.34)]">
            <div className="flex items-start justify-between gap-3 px-1">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-indigo-600">Theme library</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Available themes</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Active themes created by Super Admin appear here automatically.</p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-[10px] font-black text-indigo-700">
                {themes.length} themes
              </span>
            </div>

            <div className="mt-4 grid max-h-[470px] grid-cols-2 gap-3 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
              {themes.map((theme) => {
                const selected = selectedSlug === theme.slug

                return (
                  <motion.button
                    type="button"
                    key={theme.id || theme.slug}
                    whileHover={{ y: -2 }}
                    onClick={() => chooseTheme(theme)}
                    className={`relative rounded-[1.3rem] border p-2.5 text-left transition ${
                      selected
                        ? 'border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-100'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {selected && (
                      <span className="absolute right-4 top-4 z-10 grid h-6 w-6 place-items-center rounded-full bg-indigo-600 text-white shadow">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <ThemeMiniature theme={theme} selected={selected} />
                    <div className="px-1 pb-1 pt-3">
                      <p className="truncate text-sm font-black text-slate-950">{themeLabel(theme)}</p>
                      <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-4 text-slate-500">
                        {theme.description || `${normalizeTheme(theme).layout_preset} storefront theme`}
                      </p>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </section>

          <section className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-[0_22px_65px_-48px_rgba(15,23,42,.34)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-indigo-600">Selected theme</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">{themeLabel(selectedTheme)}</h2>
              </div>
              <Button size="sm" variant="outline" className="rounded-full" onClick={resetToSelectedTheme}>
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Reset
              </Button>
            </div>

            <div className="mt-5">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">Brand colours</h3>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <ColorControl label="Primary" value={draft.primary_color} onChange={(value) => updateDraft('primary_color', value)} />
                <ColorControl label="Secondary" value={draft.secondary_color} onChange={(value) => updateDraft('secondary_color', value)} />
                <ColorControl label="Accent" value={draft.accent_color} onChange={(value) => updateDraft('accent_color', value)} />
                <ColorControl label="Surface" value={draft.surface_color} onChange={(value) => updateDraft('surface_color', value)} />
                <ColorControl label="Page bg" value={draft.background_color} onChange={(value) => updateDraft('background_color', value)} />
                <ColorControl label="Text" value={draft.text_color} onChange={(value) => updateDraft('text_color', value)} />
              </div>
            </div>

            <div className="my-5 h-px bg-slate-100" />

            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">Structure & typography</h3>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <SelectControl label="Storefront layout" value={draft.layout_preset} options={CONTROL_OPTIONS.layout_preset} onChange={(value) => updateDraft('layout_preset', value)} />
                <SelectControl label="Font style" value={draft.font_family} options={CONTROL_OPTIONS.font_family} onChange={(value) => updateDraft('font_family', value)} />
                <SelectControl label="Navbar style" value={draft.nav_style} options={CONTROL_OPTIONS.nav_style} onChange={(value) => updateDraft('nav_style', value)} />
                <SelectControl label="Hero style" value={draft.hero_style} options={CONTROL_OPTIONS.hero_style} onChange={(value) => updateDraft('hero_style', value)} />
                <SelectControl label="Hero height" value={draft.hero_height} options={CONTROL_OPTIONS.hero_height} onChange={(value) => updateDraft('hero_height', value)} />
                <SelectControl label="Hero alignment" value={draft.hero_alignment} options={CONTROL_OPTIONS.hero_alignment} onChange={(value) => updateDraft('hero_alignment', value)} />
                <SelectControl label="Content width" value={draft.content_width} options={CONTROL_OPTIONS.content_width} onChange={(value) => updateDraft('content_width', value)} />
              </div>
            </div>

            <div className="my-5 h-px bg-slate-100" />

            <div>
              <h3 className="text-sm font-black text-slate-900">Components & feel</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <SelectControl label="Card style" value={draft.card_style} options={CONTROL_OPTIONS.card_style} onChange={(value) => updateDraft('card_style', value)} />
                <SelectControl label="Button style" value={draft.button_style} options={CONTROL_OPTIONS.button_style} onChange={(value) => updateDraft('button_style', value)} />
                <SelectControl label="Corner radius" value={draft.corner_radius} options={CONTROL_OPTIONS.corner_radius} onChange={(value) => updateDraft('corner_radius', value)} />
                <SelectControl label="Card shadow" value={draft.shadow_strength} options={CONTROL_OPTIONS.shadow_strength} onChange={(value) => updateDraft('shadow_strength', value)} />
                <SelectControl label="Card hover" value={draft.card_hover} options={CONTROL_OPTIONS.card_hover} onChange={(value) => updateDraft('card_hover', value)} />
                <SelectControl label="Heading style" value={draft.heading_style} options={CONTROL_OPTIONS.heading_style} onChange={(value) => updateDraft('heading_style', value)} />
                <SelectControl label="Spacing" value={draft.density} options={CONTROL_OPTIONS.density} onChange={(value) => updateDraft('density', value)} />
                <SelectControl label="Background" value={draft.background_style} options={CONTROL_OPTIONS.background_style} onChange={(value) => updateDraft('background_style', value)} />
                <SelectControl label="Animation" value={draft.animation_style} options={CONTROL_OPTIONS.animation_style} onChange={(value) => updateDraft('animation_style', value)} />
                <SelectControl label="Product grid" value={draft.product_grid} options={CONTROL_OPTIONS.product_grid} onChange={(value) => updateDraft('product_grid', value)} />
                <SelectControl label="Image ratio" value={draft.image_ratio} options={CONTROL_OPTIONS.image_ratio} onChange={(value) => updateDraft('image_ratio', value)} />
                <SelectControl label="Image fit" value={draft.image_fit} options={CONTROL_OPTIONS.image_fit} onChange={(value) => updateDraft('image_fit', value)} />
              </div>
            </div>
          </section>
        </div>

        <div className="xl:h-full xl:min-h-0 xl:overflow-hidden">
          <ActualStorefrontPreview
            store={store}
            draft={draft}
            themeSlug={selectedSlug}
            themeName={themeLabel(selectedTheme)}
            viewport={viewport}
            onViewport={setViewport}
            refreshKey={refreshKey}
            onRefresh={() => setRefreshKey((current) => current + 1)}
          />
        </div>
      </div>
    </div>
  )
}