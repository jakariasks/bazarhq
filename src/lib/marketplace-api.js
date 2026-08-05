import { supabase } from '@/integrations/supabase/client'

const EMPTY_HOME = Object.freeze({
  metrics: { shops: 0, products: 0, orders: 0, categories: 0 },
  categories: [],
  top_shops: [],
  top_products: [],
  products: [],
  comparisons: [],
})

const EMPTY_RECOMMENDATIONS = Object.freeze({
  target: null,
  comparison: { shop_count: 0, best_price: 0, highest_price: 0, saving: 0 },
  same_product: [],
  recommended: [],
})

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback
}

export function normalizeMarketplaceHome(value) {
  const source = asObject(value, EMPTY_HOME)
  return {
    metrics: { ...EMPTY_HOME.metrics, ...asObject(source.metrics) },
    categories: asArray(source.categories),
    top_shops: asArray(source.top_shops),
    top_products: asArray(source.top_products),
    products: asArray(source.products),
    comparisons: asArray(source.comparisons),
  }
}

export function normalizeMarketplaceRecommendations(value) {
  const source = asObject(value, EMPTY_RECOMMENDATIONS)
  return {
    target: source.target || null,
    comparison: {
      ...EMPTY_RECOMMENDATIONS.comparison,
      ...asObject(source.comparison),
    },
    same_product: asArray(source.same_product),
    recommended: asArray(source.recommended),
  }
}

export async function fetchMarketplaceHome({ search = '', category = '', limit = 12 } = {}) {
  const { data, error } = await supabase.rpc('get_marketplace_home', {
    p_search: String(search || '').trim() || null,
    p_category: String(category || '').trim() || null,
    p_limit: Math.max(4, Math.min(Number(limit) || 12, 36)),
  })

  if (error) {
    const message = String(error.message || '')
    if (error.code === 'PGRST202' || message.includes('get_marketplace_home')) {
      throw new Error('Marketplace database migration is not installed yet.')
    }
    throw error
  }

  return normalizeMarketplaceHome(data)
}

export async function fetchMarketplaceProductRecommendations(productId, limit = 12) {
  if (!productId) return normalizeMarketplaceRecommendations(null)

  const { data, error } = await supabase.rpc('get_marketplace_product_recommendations', {
    p_product_id: productId,
    p_limit: Math.max(4, Math.min(Number(limit) || 12, 24)),
  })

  if (error) {
    const message = String(error.message || '')
    if (error.code === 'PGRST202' || message.includes('get_marketplace_product_recommendations')) {
      throw new Error('Marketplace recommendation migration is not installed yet.')
    }
    throw error
  }

  return normalizeMarketplaceRecommendations(data)
}
