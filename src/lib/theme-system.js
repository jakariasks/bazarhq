// src/lib/theme-system.js
// BazarHQ Advanced Theme System
// Themes now control colors, storefront layout, typography, product-card style,
// hero style, navbar style, buttons, radius, spacing density and animations.

export const FONT_OPTIONS = [
  { value: 'inter', label: 'Inter', css: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { value: 'poppins', label: 'Poppins', css: 'Poppins, Inter, ui-sans-serif, system-ui, sans-serif' },
  { value: 'manrope', label: 'Manrope', css: 'Manrope, Inter, ui-sans-serif, system-ui, sans-serif' },
  { value: 'plus-jakarta', label: 'Plus Jakarta Sans', css: '"Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif' },
  { value: 'playfair', label: 'Playfair Display', css: '"Playfair Display", Georgia, serif' },
]

export const LAYOUT_OPTIONS = [
  { value: 'modern-brand', label: 'Modern Brand', description: 'Premium split hero with curated sections.' },
  { value: 'marketplace', label: 'Marketplace', description: 'Dense catalog style for many products.' },
  { value: 'boutique', label: 'Boutique', description: 'Editorial spacing and elegant cards.' },
  { value: 'minimal', label: 'Minimal', description: 'Clean product-first layout.' },
  { value: 'tech', label: 'Tech Store', description: 'Sharp, high-contrast electronics look.' },
]

export const HERO_OPTIONS = [
  { value: 'split', label: 'Split Hero' },
  { value: 'banner-right', label: 'Banner Right' },
  { value: 'centered', label: 'Centered Hero' },
  { value: 'editorial', label: 'Editorial Hero' },
  { value: 'compact', label: 'Compact Hero' },
]

export const CARD_OPTIONS = [
  { value: 'soft', label: 'Soft Rounded' },
  { value: 'bordered', label: 'Bordered Clean' },
  { value: 'shadow', label: 'Premium Shadow' },
  { value: 'flat', label: 'Flat Minimal' },
  { value: 'glass', label: 'Glass Card' },
]

export const NAV_OPTIONS = [
  { value: 'glass', label: 'Glass Sticky' },
  { value: 'solid', label: 'Solid White' },
  { value: 'dark', label: 'Dark Bar' },
  { value: 'minimal', label: 'Minimal' },
]

export const BUTTON_OPTIONS = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'pill', label: 'Pill' },
  { value: 'sharp', label: 'Sharp' },
  { value: 'soft', label: 'Soft' },
]

export const RADIUS_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'extra', label: 'Extra Rounded' },
]

export const DENSITY_OPTIONS = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious', label: 'Spacious' },
]

export const BACKGROUND_OPTIONS = [
  { value: 'clean', label: 'Clean Light' },
  { value: 'gradient', label: 'Soft Gradient' },
  { value: 'dark', label: 'Dark Premium' },
  { value: 'pattern', label: 'Subtle Pattern' },
]

export const ANIMATION_OPTIONS = [
  { value: 'smooth', label: 'Smooth' },
  { value: 'premium', label: 'Premium Float' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'none', label: 'No Animation' },
]

export const DEFAULT_THEME_CONFIG = {
  slug: 'emerald',
  name: 'Emerald Commerce',
  description: 'Clean green theme for modern Bangladeshi commerce stores.',
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
  is_active: true,
  is_default: true,
}

export const FALLBACK_THEMES = [
  {
    ...DEFAULT_THEME_CONFIG,
    id: 'emerald',
    slug: 'emerald',
    name: 'Emerald Commerce',
    description: 'Clean green theme for general Bangladeshi commerce stores.',
    primary_color: '#10b981',
    secondary_color: '#064e3b',
    accent_color: '#22c55e',
    layout_preset: 'modern-brand',
    hero_style: 'banner-right',
    card_style: 'soft',
    button_style: 'pill',
  },
  {
    ...DEFAULT_THEME_CONFIG,
    id: 'indigo',
    slug: 'indigo',
    name: 'Indigo Premium',
    description: 'Premium blue-violet storefront theme.',
    primary_color: '#635bff',
    secondary_color: '#312e81',
    accent_color: '#8b5cf6',
    layout_preset: 'modern-brand',
    hero_style: 'split',
    card_style: 'shadow',
    button_style: 'pill',
    is_default: false,
  },
  {
    ...DEFAULT_THEME_CONFIG,
    id: 'rose',
    slug: 'rose',
    name: 'Rose Boutique',
    description: 'Editorial boutique theme for fashion and beauty shops.',
    primary_color: '#e11d48',
    secondary_color: '#881337',
    accent_color: '#fb7185',
    layout_preset: 'boutique',
    font_family: 'playfair',
    hero_style: 'editorial',
    card_style: 'glass',
    button_style: 'soft',
    background_style: 'clean',
    is_default: false,
  },
  {
    ...DEFAULT_THEME_CONFIG,
    id: 'amber',
    slug: 'amber-market',
    name: 'Amber Market',
    description: 'Warm marketplace theme for lifestyle products.',
    primary_color: '#f59e0b',
    secondary_color: '#7c2d12',
    accent_color: '#fb923c',
    layout_preset: 'marketplace',
    hero_style: 'compact',
    card_style: 'bordered',
    button_style: 'rounded',
    density: 'compact',
    is_default: false,
  },
  {
    ...DEFAULT_THEME_CONFIG,
    id: 'violet',
    slug: 'violet-studio',
    name: 'Violet Studio',
    description: 'Stylish purple theme for premium storefronts.',
    primary_color: '#8b5cf6',
    secondary_color: '#4c1d95',
    accent_color: '#a78bfa',
    layout_preset: 'modern-brand',
    hero_style: 'centered',
    card_style: 'shadow',
    button_style: 'pill',
    animation_style: 'premium',
    is_default: false,
  },
  {
    ...DEFAULT_THEME_CONFIG,
    id: 'slate',
    slug: 'slate-minimal',
    name: 'Slate Minimal',
    description: 'Minimal dark-neutral theme for clean product catalogs.',
    primary_color: '#475569',
    secondary_color: '#0f172a',
    accent_color: '#94a3b8',
    layout_preset: 'minimal',
    nav_style: 'minimal',
    hero_style: 'compact',
    card_style: 'flat',
    button_style: 'sharp',
    background_style: 'clean',
    is_default: false,
  },
  {
    ...DEFAULT_THEME_CONFIG,
    id: 'tech',
    slug: 'tech-edge',
    name: 'Tech Edge',
    description: 'Dark high-contrast theme for electronics and gadget stores.',
    primary_color: '#2563eb',
    secondary_color: '#020617',
    accent_color: '#06b6d4',
    layout_preset: 'tech',
    nav_style: 'dark',
    hero_style: 'split',
    card_style: 'bordered',
    button_style: 'sharp',
    background_style: 'dark',
    corner_radius: 'medium',
    is_default: false,
  },
]

export function safeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '').trim())
}

function pickOption(value, options, fallback) {
  const normalized = String(value || '').trim().toLowerCase()
  return options.some((item) => item.value === normalized) ? normalized : fallback
}

function color(value, fallback) {
  return isHexColor(value) ? String(value).trim() : fallback
}

function objectValue(value) {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {}
  }
  return {}
}

function getThemeConfig(theme) {
  return {
    ...objectValue(theme?.config),
    ...objectValue(theme?.theme_config),
  }
}

export function normalizeTheme(theme, fallbackIndex = 0) {
  const fallback = FALLBACK_THEMES[fallbackIndex % FALLBACK_THEMES.length] || DEFAULT_THEME_CONFIG
  const config = getThemeConfig(theme)
  const slug = safeSlug(theme?.slug || theme?.theme_id || config.slug || theme?.id || theme?.name || fallback.slug) || fallback.slug

  const primary = color(theme?.primary_color || theme?.brand_color || config.primary_color, fallback.primary_color)
  const secondary = color(theme?.secondary_color || config.secondary_color, fallback.secondary_color)
  const accent = color(theme?.accent_color || config.accent_color, fallback.accent_color)

  return {
    id: theme?.id || slug,
    slug,
    name: theme?.name || theme?.theme_name || config.name || fallback.name,
    description: theme?.description || config.description || fallback.description || '',
    primary_color: primary,
    secondary_color: secondary,
    accent_color: accent,
    surface_color: color(theme?.surface_color || config.surface_color, fallback.surface_color || '#ffffff'),
    background_color: color(theme?.background_color || config.background_color, fallback.background_color || '#f8fafc'),
    text_color: color(theme?.text_color || config.text_color, fallback.text_color || '#0f172a'),
    layout_preset: pickOption(theme?.layout_preset || config.layout_preset, LAYOUT_OPTIONS, fallback.layout_preset || 'modern-brand'),
    font_family: pickOption(theme?.font_family || config.font_family, FONT_OPTIONS, fallback.font_family || 'inter'),
    nav_style: pickOption(theme?.nav_style || config.nav_style, NAV_OPTIONS, fallback.nav_style || 'glass'),
    hero_style: pickOption(theme?.hero_style || config.hero_style, HERO_OPTIONS, fallback.hero_style || 'banner-right'),
    card_style: pickOption(theme?.card_style || config.card_style, CARD_OPTIONS, fallback.card_style || 'soft'),
    button_style: pickOption(theme?.button_style || config.button_style, BUTTON_OPTIONS, fallback.button_style || 'pill'),
    corner_radius: pickOption(theme?.corner_radius || config.corner_radius, RADIUS_OPTIONS, fallback.corner_radius || 'extra'),
    density: pickOption(theme?.density || config.density, DENSITY_OPTIONS, fallback.density || 'comfortable'),
    background_style: pickOption(theme?.background_style || config.background_style, BACKGROUND_OPTIONS, fallback.background_style || 'gradient'),
    animation_style: pickOption(theme?.animation_style || config.animation_style, ANIMATION_OPTIONS, fallback.animation_style || 'smooth'),
    product_grid: ['two', 'three', 'four'].includes(String(theme?.product_grid || config.product_grid)) ? String(theme?.product_grid || config.product_grid) : fallback.product_grid || 'three',
    is_active: theme?.is_active !== false,
    is_default: Boolean(theme?.is_default || config.is_default),
  }
}

export function mergePlatformThemes(themes = []) {
  const map = new Map()
  FALLBACK_THEMES.forEach((theme, index) => {
    const normalized = normalizeTheme(theme, index)
    map.set(normalized.slug, normalized)
  })
  ;(themes || []).forEach((theme, index) => {
    const normalized = normalizeTheme(theme, index)
    if (normalized.is_active) map.set(normalized.slug, normalized)
  })
  return Array.from(map.values()).sort((a, b) => {
    if (a.is_default && !b.is_default) return -1
    if (!a.is_default && b.is_default) return 1
    return a.name.localeCompare(b.name)
  })
}

export function getStoreTheme(store, platformThemes = []) {
  const themes = mergePlatformThemes(platformThemes)
  const stored = objectValue(store?.theme_config)
  if (Object.keys(stored).length > 0) {
    return normalizeTheme({
      ...stored,
      slug: stored.slug || store?.theme_id,
      name: stored.name || store?.theme_name,
      primary_color: stored.primary_color || store?.brand_color,
      is_active: true,
    })
  }

  const key = safeSlug(store?.theme_id || store?.theme_name || store?.theme || '')
  const matched = themes.find((theme) => theme.slug === key || theme.id === key)
  if (matched) return normalizeTheme({ ...matched, primary_color: store?.brand_color || matched.primary_color })
  const defaultTheme = themes.find((theme) => theme.is_default) || themes[0]
  return normalizeTheme({ ...defaultTheme, primary_color: store?.brand_color || defaultTheme?.primary_color })
}

export function themeToConfig(theme) {
  const normalized = normalizeTheme(theme)
  return {
    slug: normalized.slug,
    name: normalized.name,
    description: normalized.description,
    primary_color: normalized.primary_color,
    secondary_color: normalized.secondary_color,
    accent_color: normalized.accent_color,
    surface_color: normalized.surface_color,
    background_color: normalized.background_color,
    text_color: normalized.text_color,
    layout_preset: normalized.layout_preset,
    font_family: normalized.font_family,
    nav_style: normalized.nav_style,
    hero_style: normalized.hero_style,
    card_style: normalized.card_style,
    button_style: normalized.button_style,
    corner_radius: normalized.corner_radius,
    density: normalized.density,
    background_style: normalized.background_style,
    animation_style: normalized.animation_style,
    product_grid: normalized.product_grid,
    is_default: normalized.is_default,
  }
}

export function themeToPlatformPayload(theme) {
  const normalized = normalizeTheme(theme)
  return {
    name: normalized.name,
    slug: normalized.slug,
    description: normalized.description,
    primary_color: normalized.primary_color,
    secondary_color: normalized.secondary_color,
    accent_color: normalized.accent_color,
    surface_color: normalized.surface_color,
    background_color: normalized.background_color,
    text_color: normalized.text_color,
    layout_preset: normalized.layout_preset,
    font_family: normalized.font_family,
    nav_style: normalized.nav_style,
    hero_style: normalized.hero_style,
    card_style: normalized.card_style,
    button_style: normalized.button_style,
    corner_radius: normalized.corner_radius,
    density: normalized.density,
    background_style: normalized.background_style,
    animation_style: normalized.animation_style,
    product_grid: normalized.product_grid,
    config: themeToConfig(normalized),
    is_active: normalized.is_active,
    is_default: normalized.is_default,
    updated_at: new Date().toISOString(),
  }
}

export function themeToStorePatch(theme) {
  const normalized = normalizeTheme(theme)
  return {
    theme_id: normalized.slug,
    theme_name: normalized.name,
    brand_color: normalized.primary_color,
    theme_config: {
      ...themeToConfig(normalized),
      applied_at: new Date().toISOString(),
    },
    theme_updated_at: new Date().toISOString(),
  }
}

function hexToRgb(hex) {
  if (typeof hex !== 'string') return null
  const cleaned = hex.replace('#', '').trim()
  if (![3, 6].includes(cleaned.length)) return null
  const value = cleaned.length === 3 ? cleaned.split('').map((c) => c + c).join('') : cleaned
  const parsed = Number.parseInt(value, 16)
  if (Number.isNaN(parsed)) return null
  return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 }
}

export function rgba(hex, alpha = 1) {
  const rgb = hexToRgb(hex)
  if (!rgb) return `rgba(99, 91, 255, ${alpha})`
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

function fontCss(fontKey) {
  return FONT_OPTIONS.find((font) => font.value === fontKey)?.css || FONT_OPTIONS[0].css
}

function radiusValue(key) {
  const map = {
    small: '0.65rem',
    medium: '1rem',
    large: '1.45rem',
    extra: '2rem',
  }
  return map[key] || map.extra
}

function buttonRadiusValue(key) {
  const map = {
    sharp: '0.55rem',
    rounded: '1rem',
    soft: '1.25rem',
    pill: '999px',
  }
  return map[key] || map.pill
}

function spacingValue(key) {
  const map = {
    compact: '2.5rem',
    comfortable: '3.5rem',
    spacious: '5rem',
  }
  return map[key] || map.comfortable
}

function pageBackground(theme) {
  if (theme.background_style === 'dark') {
    return `radial-gradient(circle at 18% 12%, ${rgba(theme.primary_color, 0.24)}, transparent 30%), linear-gradient(135deg, #020617 0%, #0f172a 54%, ${theme.secondary_color} 120%)`
  }
  if (theme.background_style === 'pattern') {
    return `radial-gradient(circle at 1px 1px, ${rgba(theme.primary_color, 0.18)} 1px, transparent 0), linear-gradient(135deg, #f8fafc, #ffffff)`
  }
  if (theme.background_style === 'clean') return theme.background_color || '#f8fafc'
  return `radial-gradient(circle at 18% 12%, ${rgba(theme.primary_color, 0.13)}, transparent 30%), linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #ffffff 100%)`
}

export function getThemeCssVars(themeOrStore, platformThemes = []) {
  const theme = themeOrStore?.theme_config || themeOrStore?.brand_color || themeOrStore?.theme_id
    ? getStoreTheme(themeOrStore, platformThemes)
    : normalizeTheme(themeOrStore)

  return {
    '--shop-primary': theme.primary_color,
    '--shop-secondary': theme.secondary_color,
    '--shop-accent': theme.accent_color,
    '--shop-surface': theme.surface_color,
    '--shop-bg': theme.background_color,
    '--shop-text': theme.text_color,
    '--shop-font-family': fontCss(theme.font_family),
    '--shop-radius': radiusValue(theme.corner_radius),
    '--shop-card-radius': radiusValue(theme.corner_radius),
    '--shop-button-radius': buttonRadiusValue(theme.button_style),
    '--shop-section-gap': spacingValue(theme.density),
    '--shop-page-bg': pageBackground(theme),
    '--shop-primary-soft': rgba(theme.primary_color, 0.12),
    '--shop-primary-ring': rgba(theme.primary_color, 0.24),
    '--shop-accent-soft': rgba(theme.accent_color, 0.16),
    '--shop-secondary-soft': rgba(theme.secondary_color, 0.16),
    '--shop-gradient': `linear-gradient(135deg, ${theme.primary_color}, ${theme.accent_color})`,
    '--theme-primary': theme.primary_color,
    '--theme-secondary': theme.secondary_color,
    '--theme-accent': theme.accent_color,
  }
}

export function themePreviewStyle(theme) {
  return getThemeCssVars(normalizeTheme(theme))
}

export function themeDataAttributes(themeOrStore) {
  const theme = normalizeTheme(themeOrStore?.theme_config ? themeOrStore.theme_config : themeOrStore)
  return {
    'data-theme-layout': theme.layout_preset,
    'data-theme-font': theme.font_family,
    'data-theme-nav': theme.nav_style,
    'data-theme-hero': theme.hero_style,
    'data-theme-card': theme.card_style,
    'data-theme-button': theme.button_style,
    'data-theme-radius': theme.corner_radius,
    'data-theme-density': theme.density,
    'data-theme-bg': theme.background_style,
    'data-theme-animation': theme.animation_style,
    'data-theme-grid': theme.product_grid,
  }
}
