import { supabase } from '@/integrations/supabase/client'

export const DEFAULT_STORE_THEME = Object.freeze({
  slug: 'emerald',
  name: 'Emerald Commerce',
  primary_color: '#10b981',
  secondary_color: '#064e3b',
  accent_color: '#22c55e',
  surface_color: '#ffffff',
  background_color: '#f8fafc',
  text_color: '#0f172a',
  layout_preset: 'modern-brand',
  font_family: 'inter',
  nav_style: 'glass',
  hero_style: 'banner-right',
  card_style: 'soft',
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
})

const PRESET_FALLBACKS = {
  emerald: DEFAULT_STORE_THEME,
  indigo: {
    ...DEFAULT_STORE_THEME,
    slug: 'indigo',
    name: 'Indigo Premium',
    primary_color: '#635bff',
    secondary_color: '#312e81',
    accent_color: '#8b5cf6',
    font_family: 'plus-jakarta',
    hero_style: 'split',
    card_style: 'shadow',
    animation_style: 'premium',
  },
  'rose-boutique': {
    ...DEFAULT_STORE_THEME,
    slug: 'rose-boutique',
    name: 'Rose Boutique',
    primary_color: '#e11d48',
    secondary_color: '#881337',
    accent_color: '#fb7185',
    background_color: '#fff1f2',
    text_color: '#111827',
    layout_preset: 'boutique',
    font_family: 'playfair',
    nav_style: 'minimal',
    hero_style: 'editorial',
    card_style: 'glass',
    button_style: 'soft',
    density: 'spacious',
    background_style: 'clean',
    product_grid: 'two',
  },
  'amber-marketplace': {
    ...DEFAULT_STORE_THEME,
    slug: 'amber-marketplace',
    name: 'Amber Marketplace',
    primary_color: '#f59e0b',
    secondary_color: '#7c2d12',
    accent_color: '#fb923c',
    background_color: '#fffbeb',
    layout_preset: 'marketplace',
    nav_style: 'solid',
    hero_style: 'compact',
    card_style: 'bordered',
    button_style: 'rounded',
    corner_radius: 'large',
    density: 'compact',
    background_style: 'clean',
    animation_style: 'minimal',
    product_grid: 'four',
  },
  'tech-edge': {
    ...DEFAULT_STORE_THEME,
    slug: 'tech-edge',
    name: 'Tech Edge',
    primary_color: '#2563eb',
    secondary_color: '#020617',
    accent_color: '#06b6d4',
    surface_color: '#0f172a',
    background_color: '#020617',
    text_color: '#e2e8f0',
    layout_preset: 'tech',
    font_family: 'manrope',
    nav_style: 'dark',
    hero_style: 'split',
    card_style: 'bordered',
    button_style: 'sharp',
    corner_radius: 'medium',
    background_style: 'dark',
    product_grid: 'three',
  },
}

const FONT_STACKS = {
  inter: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  'plus-jakarta': '"Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif',
  poppins: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif',
  manrope: 'Manrope, Inter, ui-sans-serif, system-ui, sans-serif',
  playfair: '"Playfair Display", Georgia, serif',
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  arial: 'Arial, Helvetica, sans-serif',
  verdana: 'Verdana, Geneva, sans-serif',
  trebuchet: '"Trebuchet MS", Arial, sans-serif',
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
  rounded: '"Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif',
}

const RADIUS_MAP = {
  extra: { card: '1.75rem', button: '999px' },
  large: { card: '1.25rem', button: '1rem' },
  medium: { card: '.9rem', button: '.75rem' },
  small: { card: '.55rem', button: '.45rem' },
  sharp: { card: '.15rem', button: '.15rem' },
}

const LIVE_STORAGE_KEY = 'bazarhq:store-theme-live'
const LIVE_CHANNEL_NAME = 'bazarhq-store-theme'
const liveStoreCache = new Map()
let activeRealtimeStoreId = null
let activeRealtimeChannel = null
let browserBridgeReady = false
let broadcastChannel = null
let registrationQueued = false
let queuedStore = null
let pollTimer = null
let pollingStoreId = null
let pollingInFlight = false

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

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== ''
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

function isStoreLike(value) {
  return Boolean(
    value && typeof value === 'object' && (
      value.theme_config !== undefined ||
      value.storefront_published !== undefined ||
      value.subdomain ||
      value.shop_name ||
      value.brand_color
    )
  )
}

function cacheKey(store) {
  if (!store) return ''
  return String(store.id || store.subdomain || '').trim()
}

function mergeLiveStore(store) {
  if (!isStoreLike(store)) return store || {}
  const key = cacheKey(store)
  if (!key) return store
  const live = liveStoreCache.get(key)
  return live ? { ...store, ...live } : store
}

function pickThemeValue(config, row, key, fallback) {
  if (hasValue(config[key])) return config[key]
  if (hasValue(row[key])) return row[key]
  return fallback
}

export function normalizeStoreTheme(storeOrTheme = {}) {
  const input = mergeLiveStore(storeOrTheme)
  const config = objectValue(input.theme_config || input.config)
  const rawSlug = String(config.slug || input.theme_id || input.slug || DEFAULT_STORE_THEME.slug).trim().toLowerCase()
  const preset = PRESET_FALLBACKS[rawSlug] || { ...DEFAULT_STORE_THEME, slug: rawSlug || DEFAULT_STORE_THEME.slug }

  // Store rows historically used brand_color as the only custom primary colour.
  // A complete theme_config is newer and must win when it exists.
  const primaryFallback = safeHex(input.brand_color, preset.primary_color)
  const primary = safeHex(
    hasValue(config.primary_color) ? config.primary_color : input.primary_color,
    primaryFallback,
  )

  const normalized = {
    slug: rawSlug || preset.slug,
    name: String(config.name || input.theme_name || input.name || preset.name || 'Store theme'),
    description: String(config.description || input.description || preset.description || ''),
    primary_color: primary,
    secondary_color: safeHex(pickThemeValue(config, input, 'secondary_color', preset.secondary_color), preset.secondary_color),
    accent_color: safeHex(pickThemeValue(config, input, 'accent_color', preset.accent_color), preset.accent_color),
    surface_color: safeHex(pickThemeValue(config, input, 'surface_color', preset.surface_color), preset.surface_color),
    background_color: safeHex(pickThemeValue(config, input, 'background_color', preset.background_color), preset.background_color),
    text_color: safeHex(pickThemeValue(config, input, 'text_color', preset.text_color), preset.text_color),
    layout_preset: String(pickThemeValue(config, input, 'layout_preset', preset.layout_preset)),
    font_family: String(pickThemeValue(config, input, 'font_family', preset.font_family)),
    nav_style: String(pickThemeValue(config, input, 'nav_style', preset.nav_style)),
    hero_style: String(pickThemeValue(config, input, 'hero_style', preset.hero_style)),
    card_style: String(pickThemeValue(config, input, 'card_style', preset.card_style)),
    button_style: String(pickThemeValue(config, input, 'button_style', preset.button_style)),
    corner_radius: String(pickThemeValue(config, input, 'corner_radius', preset.corner_radius)),
    density: String(pickThemeValue(config, input, 'density', preset.density)),
    background_style: String(pickThemeValue(config, input, 'background_style', preset.background_style)),
    animation_style: String(pickThemeValue(config, input, 'animation_style', preset.animation_style)),
    product_grid: String(pickThemeValue(config, input, 'product_grid', preset.product_grid)),
    content_width: String(pickThemeValue(config, input, 'content_width', preset.content_width || DEFAULT_STORE_THEME.content_width)),
    hero_height: String(pickThemeValue(config, input, 'hero_height', preset.hero_height || DEFAULT_STORE_THEME.hero_height)),
    hero_alignment: String(pickThemeValue(config, input, 'hero_alignment', preset.hero_alignment || DEFAULT_STORE_THEME.hero_alignment)),
    image_ratio: String(pickThemeValue(config, input, 'image_ratio', preset.image_ratio || DEFAULT_STORE_THEME.image_ratio)),
    image_fit: String(pickThemeValue(config, input, 'image_fit', preset.image_fit || DEFAULT_STORE_THEME.image_fit)),
    shadow_strength: String(pickThemeValue(config, input, 'shadow_strength', preset.shadow_strength || DEFAULT_STORE_THEME.shadow_strength)),
    card_hover: String(pickThemeValue(config, input, 'card_hover', preset.card_hover || DEFAULT_STORE_THEME.card_hover)),
    heading_style: String(pickThemeValue(config, input, 'heading_style', preset.heading_style || DEFAULT_STORE_THEME.heading_style)),
    store_id: input.id || null,
    store_slug: input.subdomain || null,
    theme_updated_at: input.theme_updated_at || null,
  }

  return normalized
}

export function getStoreTheme(store) {
  if (isStoreLike(store)) queueStoreRuntimeRegistration(store)
  return normalizeStoreTheme(store)
}

export function getThemeCssVars(storeOrTheme) {
  if (isStoreLike(storeOrTheme)) queueStoreRuntimeRegistration(storeOrTheme)
  const theme = normalizeStoreTheme(storeOrTheme)
  const radius = RADIUS_MAP[theme.corner_radius] || RADIUS_MAP.extra
  const font = FONT_STACKS[theme.font_family] || FONT_STACKS.inter

  return {
    '--shop-primary': theme.primary_color,
    '--shop-primary-soft': hexToRgba(theme.primary_color, 0.10),
    '--shop-primary-ring': hexToRgba(theme.primary_color, 0.24),
    '--shop-primary-strong': hexToRgba(theme.primary_color, 0.88),
    '--shop-secondary': theme.secondary_color,
    '--shop-secondary-soft': hexToRgba(theme.secondary_color, 0.12),
    '--shop-accent': theme.accent_color,
    '--shop-accent-soft': hexToRgba(theme.accent_color, 0.13),
    '--shop-surface': theme.surface_color,
    '--shop-page-bg': theme.background_color,
    '--shop-text': theme.text_color,
    '--shop-font-family': font,
    '--shop-card-radius': radius.card,
    '--shop-button-radius': radius.button,
  }
}

export function themeDataAttributes(storeOrTheme) {
  const theme = normalizeStoreTheme(storeOrTheme)
  return {
    'data-bazarhq-dynamic-theme': 'true',
    'data-theme-slug': theme.slug,
    'data-theme-layout': theme.layout_preset,
    'data-theme-font': theme.font_family,
    'data-theme-nav': theme.nav_style,
    'data-theme-hero': theme.hero_style,
    'data-theme-card': theme.card_style,
    'data-theme-button': theme.button_style,
    'data-theme-radius': theme.corner_radius,
    'data-theme-density': theme.density,
    // Existing storefront CSS uses data-theme-bg. Keep the longer alias too
    // so newer pages can use either spelling safely.
    'data-theme-bg': theme.background_style,
    'data-theme-background': theme.background_style,
    'data-theme-animation': theme.animation_style,
    'data-theme-grid': theme.product_grid,
    'data-theme-width': theme.content_width,
    'data-theme-hero-height': theme.hero_height,
    'data-theme-hero-align': theme.hero_alignment,
    'data-theme-image-ratio': theme.image_ratio,
    'data-theme-image-fit': theme.image_fit,
    'data-theme-shadow': theme.shadow_strength,
    'data-theme-hover': theme.card_hover,
    'data-theme-heading': theme.heading_style,
  }
}

function runtimeCss() {
  return `
    [data-bazarhq-dynamic-theme="true"] {
      background-color: var(--shop-page-bg) !important;
      color: var(--shop-text) !important;
      font-family: var(--shop-font-family) !important;
      transition: background-color .28s ease, color .28s ease, font-family .2s ease;
    }

    [data-bazarhq-dynamic-theme="true"] .shop-main {
      color: var(--shop-text) !important;
      margin-inline: auto !important;
      transition: max-width .3s ease, padding .3s ease, gap .3s ease, background .3s ease;
    }

    [data-bazarhq-dynamic-theme="true"] .shop-storefront-product-card,
    [data-bazarhq-dynamic-theme="true"] .shop-themed-card,
    [data-bazarhq-dynamic-theme="true"] .shop-product-surface,
    [data-bazarhq-dynamic-theme="true"] .shop-filter-panel {
      font-family: var(--shop-font-family) !important;
      transition: border-radius .25s ease, border-color .25s ease, box-shadow .25s ease, background .25s ease, transform .25s ease;
    }

    [data-bazarhq-dynamic-theme="true"][data-theme-bg="gradient"] .shop-main {
      background:
        radial-gradient(circle at 8% 1%, var(--shop-primary-soft), transparent 28%),
        radial-gradient(circle at 92% 14%, var(--shop-accent-soft), transparent 25%),
        linear-gradient(180deg, var(--shop-page-bg), color-mix(in srgb, var(--shop-page-bg) 92%, var(--shop-primary) 8%)) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-bg="soft"] .shop-main {
      background: linear-gradient(180deg, var(--shop-page-bg), var(--shop-primary-soft) 112%) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-bg="clean"] .shop-main { background: var(--shop-page-bg) !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-bg="warm"] .shop-main {
      background: linear-gradient(180deg, #fffaf2, color-mix(in srgb, var(--shop-page-bg) 84%, #f59e0b 16%)) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-bg="cool"] .shop-main {
      background: linear-gradient(180deg, #f5f9ff, color-mix(in srgb, var(--shop-page-bg) 84%, #3b82f6 16%)) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-bg="contrast"] .shop-main {
      background: linear-gradient(135deg, color-mix(in srgb, var(--shop-secondary) 7%, var(--shop-page-bg)), var(--shop-page-bg) 45%, color-mix(in srgb, var(--shop-primary) 8%, var(--shop-page-bg))) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-bg="dark"] {
      background: var(--shop-page-bg) !important;
      color: var(--shop-text) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-bg="dark"] .shop-main,
    [data-bazarhq-dynamic-theme="true"][data-theme-bg="dark"] footer {
      background: var(--shop-page-bg) !important;
      color: var(--shop-text) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-bg="dark"] .shop-themed-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-bg="dark"] .shop-storefront-product-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-bg="dark"] .shop-product-surface,
    [data-bazarhq-dynamic-theme="true"][data-theme-bg="dark"] .shop-filter-panel {
      background: var(--shop-surface) !important;
      color: var(--shop-text) !important;
      border-color: rgba(255,255,255,.10) !important;
    }

    [data-bazarhq-dynamic-theme="true"][data-theme-nav="glass"] > header {
      background: color-mix(in srgb, var(--shop-surface) 76%, transparent) !important;
      border-color: var(--shop-primary-soft) !important;
      backdrop-filter: blur(20px) saturate(150%);
      box-shadow: 0 10px 35px rgba(15,23,42,.06) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-nav="solid"] > header {
      background: var(--shop-surface) !important;
      border-color: var(--shop-primary-soft) !important;
      box-shadow: 0 5px 20px rgba(15,23,42,.06) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-nav="minimal"] > header {
      background: color-mix(in srgb, var(--shop-page-bg) 92%, transparent) !important;
      border-color: transparent !important;
      box-shadow: none !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-nav="dark"] > header {
      background: color-mix(in srgb, var(--shop-secondary) 92%, #020617) !important;
      color: #fff !important;
      border-color: rgba(255,255,255,.10) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-nav="floating"] > header {
      margin: .7rem auto 0 !important;
      width: min(calc(100% - 2rem), 92rem) !important;
      border: 1px solid var(--shop-primary-soft) !important;
      border-radius: 1.2rem !important;
      background: color-mix(in srgb, var(--shop-surface) 90%, transparent) !important;
      box-shadow: 0 18px 55px rgba(15,23,42,.11) !important;
      backdrop-filter: blur(16px);
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-nav="accent"] > header {
      border-bottom: 3px solid var(--shop-primary) !important;
      background: var(--shop-surface) !important;
      box-shadow: none !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-nav="dark"] > header a,
    [data-bazarhq-dynamic-theme="true"][data-theme-nav="dark"] > header button,
    [data-bazarhq-dynamic-theme="true"][data-theme-nav="dark"] > header span { color: inherit; }

    [data-bazarhq-dynamic-theme="true"][data-theme-layout="modern-brand"] .shop-main { max-width: 88rem !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-layout="marketplace"] .shop-main { max-width: 100rem !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-layout="boutique"] .shop-main { max-width: 82rem !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-layout="minimal"] .shop-main { max-width: 76rem !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-layout="tech"] .shop-main { max-width: 94rem !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-layout="editorial"] .shop-main { max-width: 84rem !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-layout="catalog"] .shop-main { max-width: 106rem !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-layout="luxury"] .shop-main { max-width: 86rem !important; }

    [data-bazarhq-dynamic-theme="true"][data-theme-width="narrow"] .shop-main { max-width: 74rem !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-width="standard"] .shop-main { max-width: 88rem !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-width="wide"] .shop-main { max-width: 102rem !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-width="full"] .shop-main { max-width: none !important; width: 100% !important; }

    [data-bazarhq-dynamic-theme="true"][data-theme-hero="compact"] .shop-hero-grid {
      min-height: 280px !important;
      grid-template-columns: minmax(0, 1fr) minmax(260px, .72fr) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-hero="centered"] .shop-hero-grid {
      display: block !important;
      max-width: 980px !important;
      margin-inline: auto !important;
      text-align: center !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-hero="centered"] .shop-hero-copy {
      align-items: center !important;
      text-align: center !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-hero="editorial"] .shop-hero-grid {
      grid-template-columns: minmax(0, 1.3fr) minmax(260px, .7fr) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-hero="split"] .shop-hero-grid {
      grid-template-columns: minmax(0, 1fr) minmax(300px, 1fr) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-hero="banner-right"] .shop-hero-grid {
      grid-template-columns: minmax(0, .86fr) minmax(360px, 1.14fr) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-hero="full-bleed"] .shop-hero-grid {
      grid-template-columns: minmax(0, .72fr) minmax(420px, 1.28fr) !important;
      min-height: 520px !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-hero="minimal"] .shop-hero-grid {
      grid-template-columns: 1fr !important;
      min-height: 250px !important;
      max-width: 900px !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-hero="minimal"] .shop-hero-slider,
    [data-bazarhq-dynamic-theme="true"][data-theme-hero="minimal"] .shop-hero-visual { display: none !important; }

    [data-bazarhq-dynamic-theme="true"][data-theme-hero-height="short"] .shop-hero-shell,
    [data-bazarhq-dynamic-theme="true"][data-theme-hero-height="short"] .shop-hero-inner,
    [data-bazarhq-dynamic-theme="true"][data-theme-hero-height="short"] .shop-hero-grid { min-height: 270px !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-hero-height="standard"] .shop-hero-grid { min-height: 380px !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-hero-height="tall"] .shop-hero-grid { min-height: 520px !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-hero-height="cinematic"] .shop-hero-grid { min-height: 650px !important; }

    [data-bazarhq-dynamic-theme="true"][data-theme-hero-align="left"] .shop-hero-copy {
      align-items: flex-start !important;
      text-align: left !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-hero-align="center"] .shop-hero-copy {
      align-items: center !important;
      text-align: center !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-hero-align="right"] .shop-hero-copy {
      align-items: flex-end !important;
      text-align: right !important;
    }

    [data-bazarhq-dynamic-theme="true"][data-theme-card="soft"] .shop-themed-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-card="soft"] .shop-storefront-product-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-card="soft"] .shop-hover-lift {
      background: var(--shop-surface) !important;
      border: 1px solid var(--shop-primary-soft) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-card="shadow"] .shop-themed-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-card="shadow"] .shop-storefront-product-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-card="shadow"] .shop-hover-lift {
      background: var(--shop-surface) !important;
      border-color: transparent !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-card="bordered"] .shop-themed-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-card="bordered"] .shop-storefront-product-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-card="bordered"] .shop-hover-lift {
      background: var(--shop-surface) !important;
      border: 1.5px solid var(--shop-primary-ring) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-card="flat"] .shop-themed-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-card="flat"] .shop-storefront-product-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-card="flat"] .shop-hover-lift {
      background: var(--shop-surface) !important;
      border-color: transparent !important;
      box-shadow: none !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-card="glass"] .shop-themed-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-card="glass"] .shop-storefront-product-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-card="glass"] .shop-hover-lift {
      background: color-mix(in srgb, var(--shop-surface) 76%, transparent) !important;
      border: 1px solid color-mix(in srgb, var(--shop-primary) 20%, transparent) !important;
      backdrop-filter: blur(18px) saturate(135%);
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-card="elevated"] .shop-themed-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-card="elevated"] .shop-storefront-product-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-card="elevated"] .shop-hover-lift {
      background: var(--shop-surface) !important;
      border: 1px solid rgba(148,163,184,.12) !important;
      transform: translateY(-2px);
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-card="gradient"] .shop-themed-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-card="gradient"] .shop-storefront-product-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-card="gradient"] .shop-hover-lift {
      background: linear-gradient(155deg, var(--shop-surface), var(--shop-primary-soft)) !important;
      border: 1px solid var(--shop-primary-soft) !important;
    }

    [data-bazarhq-dynamic-theme="true"][data-theme-radius] .shop-themed-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-radius] .shop-storefront-product-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-radius] .shop-hover-lift,
    [data-bazarhq-dynamic-theme="true"][data-theme-radius] .shop-product-surface,
    [data-bazarhq-dynamic-theme="true"][data-theme-radius] .shop-hero-copy,
    [data-bazarhq-dynamic-theme="true"][data-theme-radius] .shop-hero-visual {
      border-radius: var(--shop-card-radius) !important;
    }

    [data-bazarhq-dynamic-theme="true"][data-theme-shadow="none"] .shop-themed-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-shadow="none"] .shop-storefront-product-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-shadow="none"] .shop-hover-lift { box-shadow: none !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-shadow="soft"] .shop-themed-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-shadow="soft"] .shop-storefront-product-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-shadow="soft"] .shop-hover-lift { box-shadow: 0 10px 30px rgba(15,23,42,.07) !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-shadow="medium"] .shop-themed-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-shadow="medium"] .shop-storefront-product-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-shadow="medium"] .shop-hover-lift { box-shadow: 0 18px 48px rgba(15,23,42,.12) !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-shadow="strong"] .shop-themed-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-shadow="strong"] .shop-storefront-product-card,
    [data-bazarhq-dynamic-theme="true"][data-theme-shadow="strong"] .shop-hover-lift { box-shadow: 0 25px 70px rgba(15,23,42,.21) !important; }

    [data-bazarhq-dynamic-theme="true"] .shop-main button,
    [data-bazarhq-dynamic-theme="true"] .shop-theme-button {
      border-radius: var(--shop-button-radius) !important;
      transition: all .2s ease !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-button="soft"] .shop-main button,
    [data-bazarhq-dynamic-theme="true"][data-theme-button="soft"] .shop-theme-button {
      background: var(--shop-primary-soft) !important;
      color: var(--shop-primary) !important;
      border-color: transparent !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-button="outline"] .shop-main button,
    [data-bazarhq-dynamic-theme="true"][data-theme-button="outline"] .shop-theme-button {
      background: transparent !important;
      color: var(--shop-primary) !important;
      border: 1.5px solid var(--shop-primary) !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-button="gradient"] .shop-main button,
    [data-bazarhq-dynamic-theme="true"][data-theme-button="gradient"] .shop-theme-button {
      background: linear-gradient(110deg, var(--shop-primary), var(--shop-secondary)) !important;
      color: #fff !important;
      border-color: transparent !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-button="square"] .shop-main button,
    [data-bazarhq-dynamic-theme="true"][data-theme-button="square"] .shop-theme-button { border-radius: .25rem !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-button="pill"] .shop-main button,
    [data-bazarhq-dynamic-theme="true"][data-theme-button="pill"] .shop-theme-button { border-radius: 999px !important; }

    [data-bazarhq-dynamic-theme="true"][data-theme-density="compact"] .shop-main {
      padding-top: 1.3rem !important;
      padding-bottom: 1.3rem !important;
      gap: 1.8rem !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-density="comfortable"] .shop-main { gap: 3rem !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-density="spacious"] .shop-main {
      padding-top: 4rem !important;
      padding-bottom: 4rem !important;
      gap: 4.5rem !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-density="airy"] .shop-main {
      padding-top: 5.5rem !important;
      padding-bottom: 5.5rem !important;
      gap: 6rem !important;
    }

    [data-bazarhq-dynamic-theme="true"] .shop-featured-grid,
    [data-bazarhq-dynamic-theme="true"] .shop-product-grid {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
    @media (min-width: 768px) {
      [data-bazarhq-dynamic-theme="true"][data-theme-grid="two"] .shop-featured-grid,
      [data-bazarhq-dynamic-theme="true"][data-theme-grid="two"] .shop-product-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      [data-bazarhq-dynamic-theme="true"][data-theme-grid="three"] .shop-featured-grid,
      [data-bazarhq-dynamic-theme="true"][data-theme-grid="three"] .shop-product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
      [data-bazarhq-dynamic-theme="true"][data-theme-grid="four"] .shop-featured-grid,
      [data-bazarhq-dynamic-theme="true"][data-theme-grid="four"] .shop-product-grid,
      [data-bazarhq-dynamic-theme="true"][data-theme-grid="five"] .shop-featured-grid,
      [data-bazarhq-dynamic-theme="true"][data-theme-grid="five"] .shop-product-grid,
      [data-bazarhq-dynamic-theme="true"][data-theme-grid="six"] .shop-featured-grid,
      [data-bazarhq-dynamic-theme="true"][data-theme-grid="six"] .shop-product-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
    }
    @media (min-width: 1280px) {
      [data-bazarhq-dynamic-theme="true"][data-theme-grid="five"] .shop-featured-grid,
      [data-bazarhq-dynamic-theme="true"][data-theme-grid="five"] .shop-product-grid { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; }
      [data-bazarhq-dynamic-theme="true"][data-theme-grid="six"] .shop-featured-grid,
      [data-bazarhq-dynamic-theme="true"][data-theme-grid="six"] .shop-product-grid { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }
    }

    [data-bazarhq-dynamic-theme="true"][data-theme-image-ratio="square"] .shop-storefront-product-card img { aspect-ratio: 1 / 1 !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-image-ratio="portrait"] .shop-storefront-product-card img { aspect-ratio: 4 / 5 !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-image-ratio="landscape"] .shop-storefront-product-card img { aspect-ratio: 4 / 3 !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-image-ratio="wide"] .shop-storefront-product-card img { aspect-ratio: 16 / 9 !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-image-fit="cover"] .shop-storefront-product-card img { object-fit: cover !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-image-fit="contain"] .shop-storefront-product-card img {
      object-fit: contain !important;
      background: var(--shop-surface) !important;
    }

    [data-bazarhq-dynamic-theme="true"][data-theme-hover="none"] .shop-hover-lift:hover,
    [data-bazarhq-dynamic-theme="true"][data-theme-hover="none"] .shop-storefront-product-card:hover { transform: none !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-hover="lift"] .shop-hover-lift:hover,
    [data-bazarhq-dynamic-theme="true"][data-theme-hover="lift"] .shop-storefront-product-card:hover { transform: translateY(-8px) !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-hover="zoom"] .shop-storefront-product-card:hover { transform: scale(1.025) !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-hover="glow"] .shop-storefront-product-card:hover {
      box-shadow: 0 22px 65px color-mix(in srgb, var(--shop-primary) 22%, transparent) !important;
      transform: translateY(-5px) !important;
    }

    [data-bazarhq-dynamic-theme="true"][data-theme-heading="normal"] h1,
    [data-bazarhq-dynamic-theme="true"][data-theme-heading="normal"] h2 { letter-spacing: -.025em !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-heading="uppercase"] h1,
    [data-bazarhq-dynamic-theme="true"][data-theme-heading="uppercase"] h2 {
      text-transform: uppercase !important;
      letter-spacing: .055em !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-heading="editorial"] h1,
    [data-bazarhq-dynamic-theme="true"][data-theme-heading="editorial"] h2 {
      font-weight: 700 !important;
      letter-spacing: -.045em !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-heading="spaced"] h1,
    [data-bazarhq-dynamic-theme="true"][data-theme-heading="spaced"] h2 {
      letter-spacing: .09em !important;
      text-transform: uppercase !important;
      font-weight: 700 !important;
    }

    [data-bazarhq-dynamic-theme="true"][data-theme-animation="none"] .shop-animate,
    [data-bazarhq-dynamic-theme="true"][data-theme-animation="none"] .shop-scroll-reveal,
    [data-bazarhq-dynamic-theme="true"][data-theme-animation="none"] .shop-float-soft {
      animation: none !important;
      transition: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
    [data-bazarhq-dynamic-theme="true"][data-theme-animation="minimal"] .shop-hover-lift { transition-duration: .12s !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-animation="smooth"] .shop-hover-lift { transition-duration: .28s !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-animation="premium"] .shop-hover-lift:hover { transition-duration: .36s !important; }
    [data-bazarhq-dynamic-theme="true"][data-theme-animation="playful"] .shop-hover-lift:hover {
      transform: translateY(-8px) rotate(-.4deg) scale(1.015) !important;
    }

    @media (max-width: 767px) {
      [data-bazarhq-dynamic-theme="true"] .shop-hero-grid {
        grid-template-columns: 1fr !important;
        min-height: auto !important;
      }
      [data-bazarhq-dynamic-theme="true"][data-theme-hero-align="right"] .shop-hero-copy {
        align-items: flex-start !important;
        text-align: left !important;
      }
    }
  `
}

function ensureRuntimeStyle(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc?.head) return
  let style = doc.getElementById('bazarhq-dynamic-storefront-theme-runtime')
  if (!style) {
    style = doc.createElement('style')
    style.id = 'bazarhq-dynamic-storefront-theme-runtime'
    doc.head.appendChild(style)
  }
  if (style.textContent !== runtimeCss()) style.textContent = runtimeCss()
}

function findThemeRoot(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return null
  return (
    doc.querySelector('[data-bazarhq-dynamic-theme="true"]') ||
    doc.querySelector('[data-theme-layout][data-theme-font]') ||
    doc.querySelector('[data-theme-layout]') ||
    doc.querySelector('.shop-main')?.parentElement ||
    null
  )
}

export function applyStoreThemeToElement(target, storeOrTheme) {
  if (!target) return false
  const theme = normalizeStoreTheme(storeOrTheme)
  const vars = getThemeCssVars(theme)
  const attrs = themeDataAttributes(theme)

  Object.entries(vars).forEach(([name, value]) => {
    target.style.setProperty(name, value, 'important')
  })
  Object.entries(attrs).forEach(([name, value]) => {
    target.setAttribute(name, String(value))
  })
  return true
}

export function applyStoreThemeToDocument(storeOrTheme, doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return false
  ensureRuntimeStyle(doc)
  const root = findThemeRoot(doc)
  if (!root) return false
  return applyStoreThemeToElement(root, storeOrTheme)
}

function rememberLiveStore(store) {
  if (!store || typeof store !== 'object') return
  const themeOnly = {
    id: store.id || null,
    subdomain: store.subdomain || null,
    theme_id: store.theme_id,
    theme_name: store.theme_name,
    brand_color: store.brand_color,
    theme_config: store.theme_config,
    theme_updated_at: store.theme_updated_at,
    updated_at: store.updated_at,
  }

  const keys = new Set([
    cacheKey(store),
    store.id ? String(store.id) : '',
    store.subdomain ? String(store.subdomain) : '',
  ])
  keys.forEach((key) => {
    if (key) liveStoreCache.set(key, themeOnly)
  })
}

function incomingMatchesRegisteredStore(message) {
  const current = queuedStore
  if (!current || !message) return true
  const incomingId = String(message.id || message.store_id || '').trim()
  const incomingSlug = String(message.subdomain || message.store_slug || '').trim()
  const currentId = String(current.id || '').trim()
  const currentSlug = String(current.subdomain || '').trim()
  return Boolean(
    (incomingId && currentId && incomingId === currentId) ||
    (incomingSlug && currentSlug && incomingSlug === currentSlug)
  )
}

function handleIncomingTheme(message) {
  const payload = objectValue(message?.store || message)
  if (!payload || !incomingMatchesRegisteredStore(payload)) return
  rememberLiveStore(payload)
  applyStoreThemeToDocument(payload)
}

function installBrowserBridge() {
  if (browserBridgeReady || typeof window === 'undefined') return
  browserBridgeReady = true
  ensureRuntimeStyle()

  window.addEventListener('storage', (event) => {
    if (event.key !== LIVE_STORAGE_KEY || !event.newValue) return
    try {
      handleIncomingTheme(JSON.parse(event.newValue))
    } catch {
      // Ignore malformed storage events.
    }
  })

  window.addEventListener('bazarhq:store-theme-updated', (event) => {
    handleIncomingTheme(event?.detail)
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && queuedStore?.id) {
      pollStoreThemeOnce(queuedStore).catch(() => null)
    }
  })

  if ('BroadcastChannel' in window) {
    try {
      broadcastChannel = new BroadcastChannel(LIVE_CHANNEL_NAME)
      broadcastChannel.onmessage = (event) => handleIncomingTheme(event.data)
    } catch {
      broadcastChannel = null
    }
  }
}


function themeFingerprint(store) {
  if (!store) return ''
  const config = objectValue(store.theme_config)
  return JSON.stringify([
    store.theme_id || '',
    store.brand_color || '',
    store.theme_updated_at || '',
    config.primary_color || '',
    config.secondary_color || '',
    config.accent_color || '',
    config.surface_color || '',
    config.background_color || '',
    config.text_color || '',
    config.layout_preset || '',
    config.font_family || '',
    config.nav_style || '',
    config.hero_style || '',
    config.card_style || '',
    config.button_style || '',
    config.corner_radius || '',
    config.density || '',
    config.background_style || '',
    config.animation_style || '',
    config.product_grid || '',
    config.content_width || '',
    config.hero_height || '',
    config.hero_alignment || '',
    config.image_ratio || '',
    config.image_fit || '',
    config.shadow_strength || '',
    config.card_hover || '',
    config.heading_style || '',
  ])
}

async function pollStoreThemeOnce(store) {
  if (!store?.id || pollingInFlight || typeof document === 'undefined') return
  pollingInFlight = true
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('id,subdomain,theme_id,theme_name,brand_color,theme_config,theme_updated_at,updated_at')
      .eq('id', store.id)
      .maybeSingle()

    if (error || !data) return

    const key = cacheKey(store)
    const current = liveStoreCache.get(key) || store
    if (themeFingerprint(current) !== themeFingerprint(data)) {
      rememberLiveStore(data)
      applyStoreThemeToDocument(data)
    }
  } catch {
    // Polling is a fallback only. A temporary network failure should never
    // interrupt storefront browsing.
  } finally {
    pollingInFlight = false
  }
}

function scheduleStoreThemePolling(store) {
  if (typeof window === 'undefined' || !store?.id) return
  if (pollingStoreId !== store.id) {
    pollingStoreId = store.id
    if (pollTimer) window.clearTimeout(pollTimer)
    pollTimer = null
  }

  const tick = async () => {
    const latest = queuedStore
    if (!latest?.id || latest.id !== pollingStoreId) return
    if (document.visibilityState !== 'hidden') await pollStoreThemeOnce(latest)
    const delay = document.visibilityState === 'hidden' ? 15000 : 5000
    pollTimer = window.setTimeout(tick, delay)
  }

  if (!pollTimer) pollTimer = window.setTimeout(tick, 5000)
}

async function subscribeStoreRealtime(store) {
  if (typeof window === 'undefined' || !store?.id) return
  if (activeRealtimeStoreId === store.id && activeRealtimeChannel) return

  if (activeRealtimeChannel) {
    try {
      await supabase.removeChannel(activeRealtimeChannel)
    } catch {
      // A failed cleanup must not block storefront rendering.
    }
  }

  activeRealtimeStoreId = store.id
  activeRealtimeChannel = supabase
    .channel(`storefront-theme-${store.id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'stores',
        filter: `id=eq.${store.id}`,
      },
      (payload) => {
        const next = payload?.new
        if (!next) return
        rememberLiveStore(next)
        applyStoreThemeToDocument(next)
      },
    )
    .subscribe()
}

function queueStoreRuntimeRegistration(store) {
  if (typeof window === 'undefined' || !store?.id) return
  queuedStore = store
  installBrowserBridge()
  ensureRuntimeStyle()

  if (registrationQueued) return
  registrationQueued = true
  Promise.resolve().then(() => {
    registrationQueued = false
    const nextStore = queuedStore
    if (nextStore?.id) {
      subscribeStoreRealtime(nextStore).catch(() => null)
      scheduleStoreThemePolling(nextStore)
    }
  })
}

export function broadcastStoreThemeUpdate(store) {
  if (!store || typeof store !== 'object') return
  rememberLiveStore(store)
  const message = { ...store, __bazarhq_theme_event: true, sent_at: Date.now() }

  if (typeof window !== 'undefined') {
    installBrowserBridge()
    try {
      window.localStorage.setItem(LIVE_STORAGE_KEY, JSON.stringify(message))
    } catch {
      // Storage can be unavailable in private mode.
    }
    try {
      window.dispatchEvent(new CustomEvent('bazarhq:store-theme-updated', { detail: message }))
    } catch {
      // CustomEvent may be unavailable in non-browser tests.
    }
  }

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(message)
    } catch {
      // BroadcastChannel is only a fast same-browser enhancement.
    }
  }
}
