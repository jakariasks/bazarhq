// src/lib/theme-system.js
// Central BazarHQ storefront theme resolver.

export const FALLBACK_THEMES = [
  { id: 'emerald', slug: 'emerald', name: 'Emerald Commerce', description: 'Clean green theme for modern commerce stores.', primary_color: '#10b981', secondary_color: '#064e3b', accent_color: '#22c55e', is_active: true, is_default: true },
  { id: 'indigo', slug: 'indigo', name: 'Indigo Premium', description: 'Premium blue-violet storefront theme.', primary_color: '#635bff', secondary_color: '#312e81', accent_color: '#8b5cf6', is_active: true, is_default: false },
  { id: 'rose', slug: 'rose', name: 'Rose Boutique', description: 'Modern boutique theme for fashion and beauty shops.', primary_color: '#e11d48', secondary_color: '#881337', accent_color: '#fb7185', is_active: true, is_default: false },
  { id: 'amber', slug: 'amber', name: 'Amber Market', description: 'Warm marketplace theme for lifestyle stores.', primary_color: '#f59e0b', secondary_color: '#7c2d12', accent_color: '#fb923c', is_active: true, is_default: false },
  { id: 'violet', slug: 'violet', name: 'Violet Studio', description: 'Stylish purple theme for premium storefronts.', primary_color: '#8b5cf6', secondary_color: '#4c1d95', accent_color: '#a78bfa', is_active: true, is_default: false },
  { id: 'slate', slug: 'slate', name: 'Slate Minimal', description: 'Minimal neutral theme for clean product catalogs.', primary_color: '#475569', secondary_color: '#0f172a', accent_color: '#94a3b8', is_active: true, is_default: false },
]

export function safeSlug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
}

export function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '').trim())
}

function color(value, fallback) {
  return isHexColor(value) ? String(value).trim() : fallback
}

export function normalizeTheme(theme, fallbackIndex = 0) {
  const fallback = FALLBACK_THEMES[fallbackIndex % FALLBACK_THEMES.length]
  const config = theme?.theme_config && typeof theme.theme_config === 'object' ? theme.theme_config : {}
  const slug = safeSlug(theme?.slug || theme?.theme_id || config.slug || theme?.id || theme?.name || fallback.slug) || fallback.slug
  return {
    id: theme?.id || slug,
    slug,
    name: theme?.name || theme?.theme_name || config.name || fallback.name,
    description: theme?.description || config.description || fallback.description || '',
    primary_color: color(theme?.primary_color || theme?.brand_color || config.primary_color, fallback.primary_color),
    secondary_color: color(theme?.secondary_color || config.secondary_color, fallback.secondary_color),
    accent_color: color(theme?.accent_color || config.accent_color, fallback.accent_color),
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
  if (store?.theme_config && typeof store.theme_config === 'object' && Object.keys(store.theme_config).length > 0) {
    return normalizeTheme({
      slug: store.theme_config.slug || store.theme_id,
      name: store.theme_config.name || store.theme_name,
      description: store.theme_config.description,
      primary_color: store.theme_config.primary_color || store.brand_color,
      secondary_color: store.theme_config.secondary_color,
      accent_color: store.theme_config.accent_color,
      is_default: store.theme_config.is_default,
      is_active: true,
    })
  }
  const key = safeSlug(store?.theme_id || store?.theme_name || store?.theme || '')
  const matched = themes.find((theme) => theme.slug === key || theme.id === key)
  if (matched) return normalizeTheme({ ...matched, primary_color: store?.brand_color || matched.primary_color })
  const defaultTheme = themes.find((theme) => theme.is_default) || themes[0]
  return normalizeTheme({ ...defaultTheme, primary_color: store?.brand_color || defaultTheme?.primary_color })
}

export function themeToStorePatch(theme) {
  const normalized = normalizeTheme(theme)
  return {
    theme_id: normalized.slug,
    theme_name: normalized.name,
    brand_color: normalized.primary_color,
    theme_config: {
      slug: normalized.slug,
      name: normalized.name,
      description: normalized.description,
      primary_color: normalized.primary_color,
      secondary_color: normalized.secondary_color,
      accent_color: normalized.accent_color,
      is_default: normalized.is_default,
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

export function getThemeCssVars(themeOrStore, platformThemes = []) {
  const theme = themeOrStore?.theme_config || themeOrStore?.brand_color || themeOrStore?.theme_id
    ? getStoreTheme(themeOrStore, platformThemes)
    : normalizeTheme(themeOrStore)
  return {
    '--shop-primary': theme.primary_color,
    '--shop-secondary': theme.secondary_color,
    '--shop-accent': theme.accent_color,
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
