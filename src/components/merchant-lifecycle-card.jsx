import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RotateCcw, Trash2 } from 'lucide-react'
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
function daysLeft(value) { return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)) }

export function MerchantLifecycleCard() {
  const { user } = useAuth()
  const { store } = useCurrentStore()
  const qc = useQueryClient()
  const [readiness, setReadiness] = useState(null)
  const [open,setOpen] = useState(false)
  const [phrase,setPhrase] = useState('')
  const [busy,setBusy] = useState(false)

  async function load() {
    if (!store?.id) return
    const { data, error } = await supabase.rpc('get_merchant_deletion_readiness',{ p_store_id: store.id })
    if (error) toast.error(error.message); else setReadiness(data)
  }
  useEffect(() => { load() }, [store?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function scheduleDeletion() {
    if (phrase !== PHRASE) return toast.error(`Type ${PHRASE} exactly.`)
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('merchant_delete_store',{ p_store_id: store.id })
      if (error) throw error
      toast.success(`Store unpublished. Permanent cleanup is scheduled for ${new Date(data.deletion_scheduled_at).toLocaleDateString('en-BD')}.`)
      setOpen(false); setPhrase('')
      await qc.invalidateQueries()
      window.location.href = '/merchant'
    } catch (error) { toast.error(error.message || 'Could not schedule store deletion.') }
    finally { setBusy(false) }
  }

  return <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
    <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10"><Trash2 className="h-5 w-5 text-destructive" /></div><div className="flex-1"><h3 className="font-semibold text-destructive">Delete store</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">The storefront is unpublished immediately. Data cleanup runs after 30 days, and the store can be restored during that countdown. Active order obligations block deletion.</p>{readiness && !readiness.can_delete && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="mr-1 inline h-4 w-4" />Complete or cancel {readiness.pending_obligations} pending/confirmed/processing/shipped order{readiness.pending_obligations === 1 ? '' : 's'} first.</div>}<Button variant="destructive" size="sm" className="mt-4 gap-2" disabled={!readiness?.can_delete} onClick={() => setOpen(true)}><Trash2 className="h-4 w-4" />Delete my store</Button></div></div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Schedule store deletion</DialogTitle></DialogHeader><div className="space-y-4"><div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><AlertTriangle className="mb-2 h-5 w-5" />The store becomes unavailable immediately. Permanent anonymization/cleanup runs after 30 days unless you restore it.</div><div><Label>Type <strong>{PHRASE}</strong></Label><Input className="mt-1 font-mono" value={phrase} onChange={(e) => setPhrase(e.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button variant="destructive" disabled={busy || phrase !== PHRASE} onClick={scheduleDeletion}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm deletion</Button></DialogFooter></DialogContent></Dialog>
  </section>
}

export function DeletedStoreRecovery() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [stores,setStores] = useState([])
  const [busy,setBusy] = useState('')
  async function load() {
    if (!user?.id) return
    const { data } = await supabase.from('stores').select('id,shop_name,subdomain,deletion_scheduled_at,deleted_at,permanently_deleted_at').eq('owner_id',user.id).eq('account_status','deleted').is('permanently_deleted_at',null).order('deleted_at',{ascending:false})
    setStores((data || []).filter((item) => item.deletion_scheduled_at && new Date(item.deletion_scheduled_at) > new Date()))
  }
  useEffect(() => { load() }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  async function restore(id) {
    setBusy(id)
    const { error } = await supabase.rpc('merchant_restore_deleted_store',{ p_store_id:id })
    setBusy('')
    if (error) return toast.error(error.message)
    toast.success('Store restored in Draft. Review settings before publishing again.')
    await qc.invalidateQueries()
    window.location.reload()
  }
  if (!stores.length) return null
  return <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 text-amber-950"><div className="flex items-start gap-3"><RotateCcw className="mt-1 h-5 w-5" /><div className="flex-1"><h2 className="font-semibold">Deleted store recovery</h2><p className="mt-1 text-sm">Restore before the 30-day cleanup deadline.</p><div className="mt-4 space-y-3">{stores.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-xl bg-white/70 p-4 sm:flex-row sm:items-center"><div className="flex-1"><p className="font-medium">{item.shop_name || 'Deleted store'}</p><p className="text-xs text-amber-800">{daysLeft(item.deletion_scheduled_at)} day{daysLeft(item.deletion_scheduled_at) === 1 ? '' : 's'} remaining · cleanup {new Date(item.deletion_scheduled_at).toLocaleDateString('en-BD')}</p></div><Button size="sm" onClick={() => restore(item.id)} disabled={busy === item.id}>{busy === item.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Restore store</Button></div>)}</div></div></div></section>
}
