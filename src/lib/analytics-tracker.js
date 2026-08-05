import { supabase } from '@/integrations/supabase/client'

const SESSION_KEY = 'bazarhq_analytics_session_id'

export function getAnalyticsSessionId() {
  let sessionId = localStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    localStorage.setItem(SESSION_KEY, sessionId)
  }
  return sessionId
}

function normalizePayload(eventNameOrPayload, maybePayload = {}) {
  if (typeof eventNameOrPayload === 'string') return { event_type: eventNameOrPayload, ...maybePayload }
  return eventNameOrPayload || {}
}

export async function trackStoreEvent(eventNameOrPayload, maybePayload = {}) {
  try {
    const payload = normalizePayload(eventNameOrPayload, maybePayload)
    const storeId = payload.store_id || payload.storeId || null
    const storeSlug = payload.store_slug || payload.storeSlug || null
    const productId = payload.product_id || payload.productId || null
    const eventType = payload.event_type || payload.eventType || payload.type || payload.event || 'page_view'
    if (!storeId && !storeSlug) return { ok: false, skipped: true }
    const path = payload.path || window.location.pathname
    const metadata = {
      ...(payload.metadata || {}),
      search: window.location.search,
      referrer: document.referrer || null,
    }
    const { error } = await supabase.rpc('track_analytics_event', {
      p_store_subdomain: storeSlug,
      p_store_id: storeId,
      p_event_type: eventType,
      p_path: path,
      p_session_id: getAnalyticsSessionId(),
      p_product_id: productId,
      p_metadata: metadata,
    })
    if (error) return { ok: false, error }
    return { ok: true }
  } catch (error) {
    console.warn('[analytics] failed:', error)
    return { ok: false, error }
  }
}

export const trackAnalyticsEvent = (payload) => trackStoreEvent(payload)
export const trackPageView = (storeId, metadata = {}) => trackStoreEvent('page_view', { storeId, metadata })
export const trackProductView = (storeId, productId, metadata = {}) => trackStoreEvent('product_view', { storeId, productId, metadata })
export const trackAddToCart = (storeId, productId, metadata = {}) => trackStoreEvent('add_to_cart', { storeId, productId, metadata })
export const trackCheckoutStart = (storeId, metadata = {}) => trackStoreEvent('checkout_start', { storeId, metadata })
export const trackOrderPlaced = (storeId, orderId, metadata = {}) => trackStoreEvent('order_placed', { storeId, orderId, metadata })
export const trackCategoryView = (storeId, category, metadata = {}) => trackStoreEvent('category_view', { storeId, metadata: { ...metadata, category } })
