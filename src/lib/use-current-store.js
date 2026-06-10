import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

export function useStores() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['stores', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCurrentStoreId() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['current-store-id', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('current_store_id')
        .eq('id', user.id)
        .maybeSingle()
      return data?.current_store_id ?? null
    },
  })
}

export function useCurrentStore() {
  const stores = useStores()
  const currentId = useCurrentStoreId()
  const list = stores.data ?? []
  const store = list.find((s) => s.id === currentId.data) ?? list[0] ?? null
  return { store, stores: list, isLoading: stores.isLoading || currentId.isLoading }
}

export function useSwitchStore() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return async (storeId) => {
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .update({ current_store_id: storeId })
      .eq('id', user.id)
    if (error) { toast.error(error.message); return }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['current-store-id', user.id] }),
      qc.invalidateQueries({ queryKey: ['stores', user.id] }),
      qc.invalidateQueries({ queryKey: ['publish-status'] }),
      qc.invalidateQueries({ queryKey: ['shop-profile'] }),
      qc.invalidateQueries({ queryKey: ['products'] }),
    ])
    toast.success('Switched store')
  }
}
