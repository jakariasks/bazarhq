import { supabase } from '@/integrations/supabase/client'

export function onboardingKey(userId, flow = 'store') {
  return `bazarhq_onboarding_${flow}_${userId || 'guest'}`
}

export function saveOnboardingDraft(userId, payload, flow = 'store') {
  if (!userId) return
  const data = { ...payload, saved_at: new Date().toISOString() }
  localStorage.setItem(onboardingKey(userId, flow), JSON.stringify(data))
}

export function loadOnboardingDraft(userId, flow = 'store') {
  if (!userId) return null
  try { return JSON.parse(localStorage.getItem(onboardingKey(userId, flow)) || 'null') } catch { return null }
}

export function clearOnboardingDraft(userId, flow = 'store') {
  if (!userId) return
  localStorage.removeItem(onboardingKey(userId, flow))
}

export async function syncOnboardingProgress(userId, progress, step) {
  if (!userId) return
  await supabase.from('profiles').update({ onboarding_progress: progress, onboarding_step: step, updated_at: new Date().toISOString() }).eq('id', userId)
}

export async function syncStoreOnboardingProgress(storeId, progress, step, completed = false) {
  if (!storeId) return
  await supabase.from('stores').update({ onboarding_progress: progress, onboarding_step: step, onboarding_completed: completed }).eq('id', storeId)
}
