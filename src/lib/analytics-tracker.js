import { supabase } from '@/integrations/supabase/client'

function getOrCreateSessionId() {
  const key = 'bazarhq_analytics_session'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  localStorage.setItem(key, id)
  return id
}

export async function trackStoreEvent({ storeSlug, storeId, eventType = 'page_view', path, productId = null, metadata = {} }) {
  try {
    if (!storeSlug && !storeId) return
    const sessionId = getOrCreateSessionId()
    await supabase.rpc('track_analytics_event', {
      p_store_subdomain: storeSlug || null,
      p_store_id: storeId || null,
      p_event_type: eventType,
      p_path: path || window.location.pathname,
      p_session_id: sessionId,
      p_product_id: productId,
      p_metadata: metadata,
    })
  } catch (error) {
    // Analytics must never break storefront UX.
    console.warn('Analytics tracking skipped:', error?.message || error)
  }
}
