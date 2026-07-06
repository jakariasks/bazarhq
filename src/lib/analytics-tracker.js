import { supabase } from '@/integrations/supabase/client'

const SESSION_KEY = 'bazarhq_analytics_session_id'

export function getAnalyticsSessionId() {
  let sessionId = localStorage.getItem(SESSION_KEY)

  if (!sessionId) {
    sessionId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    localStorage.setItem(SESSION_KEY, sessionId)
  }

  return sessionId
}

function normalizePayload(eventNameOrPayload, maybePayload = {}) {
  if (typeof eventNameOrPayload === 'string') {
    return {
      event_type: eventNameOrPayload,
      ...maybePayload,
    }
  }

  return eventNameOrPayload || {}
}

export async function trackStoreEvent(eventNameOrPayload, maybePayload = {}) {
  try {
    const payload = normalizePayload(eventNameOrPayload, maybePayload)

    const storeId = payload.store_id || payload.storeId || null
    const productId = payload.product_id || payload.productId || null
    const orderId = payload.order_id || payload.orderId || null
    const customerId = payload.customer_id || payload.customerId || null
    const eventType = payload.event_type || payload.type || payload.event || 'page_view'

    if (!storeId) return { ok: false, skipped: true }

    const metadata = {
      ...(payload.metadata || {}),
      path: window.location.pathname,
      search: window.location.search,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent || null,
    }

    const { error } = await supabase.from('analytics_events').insert({
      store_id: storeId,
      product_id: productId,
      order_id: orderId,
      customer_id: customerId,
      event_type: eventType,
      session_id: getAnalyticsSessionId(),
      metadata,
    })

    if (error) {
      console.warn('[analytics] skipped:', error.message)
      return { ok: false, error }
    }

    return { ok: true }
  } catch (error) {
    console.warn('[analytics] failed:', error)
    return { ok: false, error }
  }
}

export async function trackAnalyticsEvent(payload) {
  return trackStoreEvent(payload)
}

export async function trackPageView(storeId, metadata = {}) {
  return trackStoreEvent('page_view', {
    storeId,
    metadata,
  })
}

export async function trackProductView(storeId, productId, metadata = {}) {
  return trackStoreEvent('product_view', {
    storeId,
    productId,
    metadata,
  })
}

export async function trackAddToCart(storeId, productId, metadata = {}) {
  return trackStoreEvent('add_to_cart', {
    storeId,
    productId,
    metadata,
  })
}

export async function trackCheckoutStart(storeId, metadata = {}) {
  return trackStoreEvent('checkout_start', {
    storeId,
    metadata,
  })
}

export async function trackOrderPlaced(storeId, orderId, metadata = {}) {
  return trackStoreEvent('order_placed', {
    storeId,
    orderId,
    metadata,
  })
}