import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, Loader2, RefreshCw, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/use-auth'
import { useCurrentStore } from '@/lib/use-current-store'

const PHRASE = 'DELETE MY STORE'
const BLOCKING_LABELS = { pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped' }

function daysLeft(value) {
  if (!value) return 0
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000))
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' })
}

export function MerchantLifecycleCard() {
  const { store } = useCurrentStore()
  const qc = useQueryClient()
  const [readiness, setReadiness] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!store?.id) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_merchant_deletion_readiness', { p_store_id: store.id })
      if (error) throw error
      setReadiness(data || null)
    } catch (error) {
      toast.error(error?.message || 'Could not check deletion readiness.')
    } finally {
      setLoading(false)
    }
  }, [store?.id])

  useEffect(() => { void load() }, [load])

  const blocking = useMemo(() => {
    const statuses = readiness?.blocking_statuses || {}
    return Object.entries(statuses)
      .filter(([, count]) => Number(count || 0) > 0)
      .map(([status, count]) => `${BLOCKING_LABELS[status] || status}: ${Number(count)}`)
  }, [readiness?.blocking_statuses])

  async function scheduleDeletion() {
    if (!store?.id) return
    if (phrase !== PHRASE) return toast.error(`Type ${PHRASE} exactly.`)
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('merchant_delete_store', { p_store_id: store.id })
      if (error) throw error
      const cleanupAt = data?.deletion_scheduled_at
      toast.success(`Store unpublished immediately. Permanent cleanup is scheduled for ${formatDate(cleanupAt)}.`)
      setOpen(false)
      setPhrase('')
      await qc.invalidateQueries()
      window.location.href = '/merchant'
    } catch (error) {
      toast.error(error?.message || 'Could not schedule store deletion.')
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10"><Trash2 className="h-5 w-5 text-destructive" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-destructive">Delete merchant store / account access</h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Active order obligations must be completed first. After confirmation, the storefront is unpublished immediately. You can restore during the 30-day grace period; the daily cleanup worker permanently removes merchant storefront/profile data after the deadline.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Recheck</Button>
          </div>

          {readiness?.account_status === 'deleted' && readiness?.deletion_scheduled_at && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-start gap-2"><CalendarClock className="mt-0.5 h-4 w-4" /><div><p className="font-semibold">Deletion scheduled</p><p className="mt-1">Cleanup: {formatDate(readiness.deletion_scheduled_at)} · {Number(readiness.days_remaining ?? daysLeft(readiness.deletion_scheduled_at))} day(s) remaining.</p><p className="mt-1 text-xs">Public storefront status: unpublished. Restore before the deadline to return the store as Draft/unpublished.</p></div></div>
            </div>
          )}

          {readiness && !readiness.can_delete && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="mr-1 inline h-4 w-4" />
              Complete or cancel {Number(readiness.pending_obligations || 0)} active order obligation{Number(readiness.pending_obligations || 0) === 1 ? '' : 's'} first.
              {blocking.length > 0 && <p className="mt-1 text-xs">{blocking.join(' · ')}</p>}
            </div>
          )}

          {readiness?.can_delete && readiness?.account_status !== 'deleted' && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><ShieldCheck className="mt-0.5 h-4 w-4" /><span>No blocking order obligations. The store is eligible for the 30-day deletion lifecycle.</span></div>
          )}

          <Button variant="destructive" size="sm" className="mt-4 gap-2" disabled={!readiness?.can_delete || readiness?.account_status === 'deleted' || loading} onClick={() => setOpen(true)}><Trash2 className="h-4 w-4" />Delete my store</Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Schedule 30-day deletion</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><AlertTriangle className="mb-2 h-5 w-5" />The storefront becomes unavailable immediately. Permanent merchant data cleanup runs after 30 days unless you restore the store before the deadline.</div>
            <div><Label>Type <strong>{PHRASE}</strong></Label><Input className="mt-1 font-mono" value={phrase} onChange={(event) => setPhrase(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button variant="destructive" disabled={busy || phrase !== PHRASE} onClick={scheduleDeletion}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm deletion</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export function DeletedStoreRecovery() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [stores, setStores] = useState([])
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    if (!user?.id) return
    const { data, error } = await supabase
      .from('stores')
      .select('id,shop_name,subdomain,deletion_scheduled_at,deleted_at,permanently_deleted_at,cleanup_status')
      .eq('owner_id', user.id)
      .eq('account_status', 'deleted')
      .is('permanently_deleted_at', null)
      .order('deleted_at', { ascending: false })
    if (error) {
      console.warn('Deleted store recovery load failed:', error.message)
      return
    }
    setStores((data || []).filter((item) => item.deletion_scheduled_at && new Date(item.deletion_scheduled_at) > new Date()))
  }, [user?.id])

  useEffect(() => { void load() }, [load])

  async function restore(id) {
    setBusy(id)
    try {
      const { data, error } = await supabase.rpc('merchant_restore_deleted_store', { p_store_id: id })
      if (error) throw error
      toast.success(`Store restored in Draft with ${Number(data?.days_remaining || 0)} deletion days cancelled.`)
      await qc.invalidateQueries()
      window.location.reload()
    } catch (error) {
      toast.error(error?.message || 'Could not restore store.')
    } finally {
      setBusy('')
    }
  }

  if (!stores.length) return null

  return (
    <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <div className="flex items-start gap-3"><RotateCcw className="mt-1 h-5 w-5" /><div className="flex-1"><h2 className="font-semibold">Deleted store recovery</h2><p className="mt-1 text-sm">Restore before the 30-day cleanup deadline. Restored stores remain unpublished until you review and publish again.</p><div className="mt-4 space-y-3">{stores.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-xl bg-white/70 p-4 sm:flex-row sm:items-center"><div className="flex-1"><p className="font-medium">{item.shop_name || 'Deleted store'}</p><p className="text-xs text-amber-800">{daysLeft(item.deletion_scheduled_at)} day{daysLeft(item.deletion_scheduled_at) === 1 ? '' : 's'} remaining · cleanup {formatDate(item.deletion_scheduled_at)}</p></div><Button size="sm" onClick={() => restore(item.id)} disabled={busy === item.id}>{busy === item.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Restore store</Button></div>)}</div></div></div>
    </section>
  )
}
