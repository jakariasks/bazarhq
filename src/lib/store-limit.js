export const FREE_PLAN_STORE_LIMIT = 1

export function normalizePlanTier(value) {
  return String(value || 'free').trim().toLowerCase() || 'free'
}

export function getStoreLimitForPlan(planTier) {
  const plan = normalizePlanTier(planTier)
  if (plan === 'free') return FREE_PLAN_STORE_LIMIT
  return Number.POSITIVE_INFINITY
}

export function isDeletedStore(store) {
  return store?.account_status === 'deleted' || store?.deleted_at
}

export function getActiveStores(stores = []) {
  return stores.filter((store) => !isDeletedStore(store))
}

export function buildStoreLimitStatus({ profile, stores }) {
  const planTier = normalizePlanTier(
    profile?.plan_tier || profile?.subscription_plan || profile?.plan
  )
  const activeStores = getActiveStores(stores)
  const storeLimit = getStoreLimitForPlan(planTier)
  const canCreate = activeStores.length < storeLimit

  return {
    planTier,
    storeLimit,
    storeCount: activeStores.length,
    canCreate,
    existingStore: activeStores[0] || null,
  }
}

export async function fetchMerchantStoreLimit(supabase, userId) {
  if (!userId) {
    return buildStoreLimitStatus({ profile: null, stores: [] })
  }

  const [profileResult, storesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, plan_tier, subscription_plan, plan, current_store_id')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('stores')
      .select('id, shop_name, subdomain, account_status, deleted_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true }),
  ])

  // If newer columns are not added yet, fall back safely to the old schema.
  if (profileResult.error || storesResult.error) {
    const fallbackStores = await supabase
      .from('stores')
      .select('id, shop_name, subdomain')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true })

    return buildStoreLimitStatus({
      profile: null,
      stores: fallbackStores.data || [],
    })
  }

  return buildStoreLimitStatus({
    profile: profileResult.data,
    stores: storesResult.data || [],
  })
}
