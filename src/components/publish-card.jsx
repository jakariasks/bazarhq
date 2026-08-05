import { useQueryClient, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Globe, EyeOff, Loader2, ExternalLink, AlertCircle, CheckCircle2, Copy, FileText } from 'lucide-react'
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

  const { data: readiness, isLoading: readinessLoading, isFetching } = useQuery({
    queryKey: ['store-publish-readiness', store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_store_publish_readiness', { p_store_id: store.id })
      if (error) throw error
      return data || {}
    },
  })

  if (isLoading || readinessLoading || !store) return <Skeleton className="h-48 w-full rounded-2xl" />

  const accountStatus = store.account_status || 'active'
  const isRestricted = accountStatus === 'suspended' || accountStatus === 'deleted'
  const published = Boolean(readiness?.is_published) && !isRestricted
  const canPublish = Boolean(readiness?.ready) && !isRestricted
  const shopUrl = store.subdomain ? getStorefrontUrl(store.subdomain, { absolute: true }) : null
  const shopLabel = store.subdomain ? getStorefrontLabel(store.subdomain) : ''

  async function toggle(next) {
    if (!user || !store || isRestricted) return
    try {
      const { data, error } = await supabase.rpc('set_storefront_published_guarded', {
        p_store_id: store.id,
        p_publish: next,
      })
      if (error) throw error
      toast.success(next ? 'Storefront is live 🎉' : 'Storefront returned to Draft')
      qc.setQueryData(['store-publish-readiness', store.id], data)
      qc.invalidateQueries({ queryKey: ['stores', user.id] })
    } catch (error) {
      toast.error(error?.message || 'Could not change storefront status.')
      qc.invalidateQueries({ queryKey: ['store-publish-readiness', store.id] })
    }
  }

  async function copyLink() {
    if (!shopUrl) return
    try { await navigator.clipboard.writeText(shopUrl); toast.success('Storefront link copied') }
    catch { toast.error('Could not copy link') }
  }

  const checks = [
    { ok: readiness?.has_subdomain, label: readiness?.has_subdomain ? 'Unique subdomain set' : 'Set a unique subdomain' },
    { ok: Number(readiness?.published_products || 0) > 0, label: `${Number(readiness?.published_products || 0)} published product${Number(readiness?.published_products || 0) === 1 ? '' : 's'}` },
    { ok: Number(readiness?.active_payment_methods || 0) > 0, label: `${Number(readiness?.active_payment_methods || 0)} valid payment method${Number(readiness?.active_payment_methods || 0) === 1 ? '' : 's'}` },
    { ok: readiness?.policies_complete, label: readiness?.policies_complete ? 'Store policies complete' : 'Complete return, shipping and payment policies' },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${published ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>{published ? <Globe className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2"><h3 className="font-semibold">Storefront</h3><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${published ? 'border-success/30 bg-success/10 text-success' : 'border-border bg-muted text-muted-foreground'}`}>{published ? 'Live' : 'Draft'}</span></div>
            <p className="mt-1 text-sm text-muted-foreground">{published ? 'Your shop is public. Unpublishing returns it to Draft.' : canPublish ? 'All requirements are complete. Publish when ready.' : 'The store remains Draft until every readiness requirement is complete.'}</p>
            {shopUrl && <div className="mt-2 flex flex-wrap items-center gap-2"><a href={shopUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-primary hover:underline"><span className="truncate">{shopLabel}</span><ExternalLink className="h-3 w-3" /></a><button type="button" onClick={copyLink} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-primary"><Copy className="h-3 w-3" /> Copy</button></div>}
          </div>
        </div>
        <div className="flex items-center gap-3"><Switch checked={published} disabled={isFetching || isRestricted || (!published && !canPublish)} onCheckedChange={toggle} />{isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}</div>
      </div>

      <div className="border-t border-border bg-muted/30 px-5 py-3">
        <div className="grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
          {checks.map((check) => <div key={check.label} className="flex items-center gap-1.5">{check.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : check.label.includes('policies') ? <FileText className="h-3.5 w-3.5 text-warning" /> : <AlertCircle className="h-3.5 w-3.5 text-warning" />}<span className={check.ok ? '' : 'text-muted-foreground'}>{check.label}</span></div>)}
        </div>
        <Link to={store.subdomain ? getStorefrontPath(store.subdomain) : '/shop'} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Preview storefront <ExternalLink className="h-3 w-3" /></Link>
      </div>
    </div>
  )
}
