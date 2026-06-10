import { useQueryClient, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Globe, EyeOff, Loader2, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useCurrentStore } from '@/lib/use-current-store'

export function PublishCard() {
  const { user } = useAuth()
  const { store, isLoading } = useCurrentStore()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)

  const { data: publishedCount = 0 } = useQuery({
    queryKey: ['publish-status', 'products', store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { count } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .eq('status', 'published')
      return count ?? 0
    },
  })

  useEffect(() => {
    if (store?.id) qc.invalidateQueries({ queryKey: ['publish-status', 'products', store.id] })
  }, [store?.id, qc])

  if (isLoading || !store) return <Skeleton className="h-44 w-full rounded-2xl" />

  const published = store.storefront_published
  const hasSubdomain = !!store.subdomain
  const canPublish = hasSubdomain && publishedCount > 0
  const shopUrl = store.subdomain ? `https://${store.subdomain}.bazarhq.com` : null

  const toggle = async (next) => {
    if (!user || !store) return
    if (next && !canPublish) {
      toast.error(!hasSubdomain ? 'Set a subdomain in store settings first' : 'Publish at least one product first')
      return
    }
    setSaving(true)
    const patch = next
      ? { storefront_published: true, published_at: new Date().toISOString() }
      : { storefront_published: false }
    const { error } = await supabase.from('stores').update(patch).eq('id', store.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(next ? 'Storefront is live 🎉' : 'Storefront unpublished')
    qc.invalidateQueries({ queryKey: ['stores', user.id] })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${published ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
            {published ? <Globe className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Storefront</h3>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${published ? 'border-success/30 bg-success/10 text-success' : 'border-border bg-muted text-muted-foreground'}`}>
                {published ? 'Live' : 'Draft'}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {published ? 'Your shop is public. Anyone with the link can browse it.' : 'Only you can see your storefront. Toggle on to make it public.'}
            </p>
            {shopUrl && (
              <a href={shopUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                {store.subdomain}.bazarhq.com <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <Switch checked={published} disabled={saving} onCheckedChange={toggle} />
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>
      <div className="border-t border-border bg-muted/30 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <div className="flex items-center gap-1.5">
            {hasSubdomain ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <AlertCircle className="h-3.5 w-3.5 text-warning" />}
            <span className={hasSubdomain ? '' : 'text-muted-foreground'}>Subdomain {hasSubdomain ? 'set' : 'not set'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {publishedCount > 0 ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <AlertCircle className="h-3.5 w-3.5 text-warning" />}
            <span className={publishedCount > 0 ? '' : 'text-muted-foreground'}>{publishedCount} published product{publishedCount === 1 ? '' : 's'}</span>
          </div>
          <Link to="/shop" className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Preview storefront <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
