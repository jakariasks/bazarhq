import { useQueryClient, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Globe, EyeOff, Loader2, ExternalLink, AlertCircle, CheckCircle2, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useCurrentStore } from '@/lib/use-current-store'
import { getStorefrontLabel, getStorefrontPath, getStorefrontUrl } from '@/lib/storefront-url'

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

  const accountStatus = store.account_status || 'active'
  const isSuspended = accountStatus === 'suspended'
  const isDeleted = accountStatus === 'deleted'
  const isRestricted = isSuspended || isDeleted
  const published = !!store.storefront_published && !isRestricted
  const hasSubdomain = !!store.subdomain
  const canPublish = hasSubdomain && publishedCount > 0 && !isRestricted
  const shopUrl = hasSubdomain ? getStorefrontUrl(store.subdomain, { absolute: true }) : null
  const shopLabel = hasSubdomain ? getStorefrontLabel(store.subdomain) : ''

  const toggle = async (next) => {
    if (!user || !store) return
    if (isRestricted) {
      toast.error(isSuspended ? 'This store is suspended by BazarHQ. You cannot publish it now.' : 'This store was deleted by BazarHQ.')
      return
    }

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

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success(next ? 'Storefront is live 🎉' : 'Storefront unpublished')
    qc.invalidateQueries({ queryKey: ['stores', user.id] })
  }

  const copyLink = async () => {
    if (!shopUrl) return
    try {
      await navigator.clipboard.writeText(shopUrl)
      toast.success('Storefront link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${published ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
            {published ? <Globe className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Storefront</h3>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isSuspended ? 'border-red-300 bg-red-50 text-red-700' : isDeleted ? 'border-slate-300 bg-slate-100 text-slate-600' : published ? 'border-success/30 bg-success/10 text-success' : 'border-border bg-muted text-muted-foreground'}`}>
                {isSuspended ? 'Suspended' : isDeleted ? 'Deleted' : published ? 'Live' : 'Draft'}
              </span>
            </div>

            <p className="mt-0.5 text-sm text-muted-foreground">
              {isSuspended
                ? `Your storefront is offline because BazarHQ suspended this store${store.suspended_reason ? `: ${store.suspended_reason}` : '.'}`
                : isDeleted
                  ? 'This store was deleted by BazarHQ and can no longer be published.'
                  : published
                    ? 'Your shop is public. Anyone with the link can browse it.'
                    : 'Only you can see your storefront. Toggle on to make it public.'}
            </p>

            {shopUrl && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a href={shopUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-primary hover:underline">
                  <span className="truncate">{shopLabel}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <Switch checked={published} disabled={saving || isRestricted} onCheckedChange={toggle} />
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

          <Link
            to={store.subdomain ? getStorefrontPath(store.subdomain) : "/shop"}
            className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Preview storefront <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
