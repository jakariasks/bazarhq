// src/lib/storefront-url.js
// Central storefront URL helper.
// Vercel/free prototype URL format:
//   /shop/merchant-subdomain
// Legacy query URLs such as /shop?store=merchant-subdomain still work in shop.jsx.
// Real wildcard subdomains require a custom domain and wildcard DNS in Vercel.

const DEFAULT_SHOP_PATH = '/shop'

export function cleanStoreSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.bazarhq\.com$/, '')
    .replace(/\.vercel\.app$/, '')
}

function getRuntimeHost() {
  if (typeof window === 'undefined') return ''
  return window.location.hostname.toLowerCase()
}

function getRuntimeOrigin() {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

export function isVercelHost(host = getRuntimeHost()) {
  return host === 'vercel.app' || host.endsWith('.vercel.app')
}

export function isLocalHost(host = getRuntimeHost()) {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost')
}

export function wildcardStorefrontsEnabled() {
  return String(import.meta.env.VITE_ENABLE_WILDCARD_STOREFRONTS || '').toLowerCase() === 'true'
}

export function getStorefrontBaseDomain() {
  return String(import.meta.env.VITE_STOREFRONT_BASE_DOMAIN || '').trim().toLowerCase()
}

export function shouldUseWildcardStorefront(host = getRuntimeHost()) {
  const baseDomain = getStorefrontBaseDomain()
  if (!wildcardStorefrontsEnabled()) return false
  if (!baseDomain) return false
  if (baseDomain.endsWith('vercel.app')) return false
  if (isVercelHost(host)) return false
  if (isLocalHost(host)) return false
  return true
}

function splitPath(path = DEFAULT_SHOP_PATH) {
  const value = String(path || DEFAULT_SHOP_PATH)
  const [pathname, query = ''] = value.split('?')
  return { pathname: pathname || DEFAULT_SHOP_PATH, query: query ? `?${query}` : '' }
}

export function getStorefrontPath(subdomain, path = DEFAULT_SHOP_PATH) {
  const slug = cleanStoreSlug(subdomain)
  if (!slug) return path

  const encoded = encodeURIComponent(slug)
  const { pathname, query } = splitPath(path)

  if (pathname === '/shop' || pathname === '/shop/') return `/shop/${encoded}${query}`
  if (pathname === '/shop/about' || pathname === '/shop/about/') return `/shop/${encoded}/about${query}`

  // Allows future paths such as /shop/$storeSlug/campaigns.
  if (pathname.includes('$storeSlug')) return `${pathname.replace('$storeSlug', encoded)}${query}`

  // Safe fallback for unknown shop paths.
  const suffix = pathname.startsWith('/shop/') ? pathname.replace(/^\/shop\/?/, '') : pathname.replace(/^\//, '')
  return suffix ? `/shop/${encoded}/${suffix}${query}` : `/shop/${encoded}${query}`
}

export function getStorefrontUrl(subdomain, options = {}) {
  const { path = DEFAULT_SHOP_PATH, absolute = false } = options
  const slug = cleanStoreSlug(subdomain)
  if (!slug) return path

  const host = getRuntimeHost()
  const origin = getRuntimeOrigin()
  const baseDomain = getStorefrontBaseDomain()

  if (shouldUseWildcardStorefront(host)) {
    return `https://${slug}.${baseDomain}${path}`
  }

  const relativePath = getStorefrontPath(slug, path)
  if (absolute && origin) return `${origin}${relativePath}`
  return relativePath
}

export function getStorefrontLabel(subdomain, options = {}) {
  const { path = DEFAULT_SHOP_PATH } = options
  const slug = cleanStoreSlug(subdomain)
  if (!slug) return 'No storefront link yet'

  const host = getRuntimeHost()
  const baseDomain = getStorefrontBaseDomain()

  if (shouldUseWildcardStorefront(host)) return `${slug}.${baseDomain}${path}`

  const currentHost = host || 'your-domain.com'
  return `${currentHost}${getStorefrontPath(slug, path)}`
}
