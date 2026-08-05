import { useEffect, useMemo, useState } from 'react'
import { Check, Settings2, Eye, EyeOff, Loader2, AlertCircle, Lock, CreditCard, ShieldCheck, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useCurrentStore } from '@/lib/use-current-store'

const METHODS = [
  { id: 'bkash', name: 'bKash', logo: '🔴', color: '#E2136E', fields: [{ key: 'merchant_number', label: 'Merchant Number', placeholder: '01XXXXXXXXX' }] },
  { id: 'nagad', name: 'Nagad', logo: '🟠', color: '#F7941D', fields: [{ key: 'merchant_number', label: 'Merchant Number', placeholder: '01XXXXXXXXX' }] },
  { id: 'rocket', name: 'Rocket (DBBL)', logo: '🟣', color: '#8B3FC8', fields: [{ key: 'merchant_number', label: 'Merchant Number', placeholder: '01XXXXXXXXX' }] },
  { id: 'ssl', name: 'SSLCommerz (Cards)', logo: '💳', color: '#2563EB', fields: [
    { key: 'ssl_store_id', label: 'SSL Store ID', placeholder: 'Your SSLCommerz Store ID' },
    { key: 'store_password', label: 'SSL Store Password', placeholder: 'Enter the gateway password', secret: true },
  ] },
  { id: 'cod', name: 'Cash on Delivery', logo: '💵', color: '#16A34A', fields: [] },
]

function masked(last4) { return last4 ? `••••••••${last4}` : '' }
function normalizeMobile(value) {
  let number = String(value || '').replace(/\D/g, '')
  if (number.startsWith('8801') && number.length === 13) number = number.slice(2)
  if (number.startsWith('1') && number.length === 10) number = `0${number}`
  return number
}

async function paymentApi(body) {
  const { data, error } = await supabase.functions.invoke('merchant-payment-config', { body })
  if (error) throw new Error(data?.error || error.message || 'Payment request failed.')
  if (data?.error) throw new Error(data.error)
  return data
}

export default function PaymentsPage() {
  const { user } = useAuth()
  const { store, isLoading } = useCurrentStore()
  const qc = useQueryClient()
  const [configs, setConfigs] = useState({})
  const [loading, setLoading] = useState(true)
  const [configOpen, setConfigOpen] = useState(false)
  const [activeMethod, setActiveMethod] = useState(null)
  const [fieldValues, setFieldValues] = useState({})
  const [showFields, setShowFields] = useState({})
  const [sslLive, setSslLive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toggleSaving, setToggleSaving] = useState('')

  const enabledCount = useMemo(() => METHODS.filter((method) => configs[method.id]?.enabled).length, [configs])

  function applyConfigs(rows = []) {
    const map = {}
    for (const row of rows) map[row.method] = row
    setConfigs(map)
  }

  async function loadConfigs() {
    if (!store?.id) { setLoading(false); return }
    setLoading(true)
    try { applyConfigs((await paymentApi({ action: 'list', store_id: store.id })).configs) }
    catch (error) { toast.error(error.message); setConfigs({}) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadConfigs() }, [store?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshAfterChange(rows) {
    if (rows) applyConfigs(rows); else await loadConfigs()
    qc.invalidateQueries({ queryKey: ['stores', user?.id] })
    qc.invalidateQueries({ queryKey: ['store-publish-readiness', store?.id] })
    qc.invalidateQueries({ queryKey: ['publish-status', 'payments', store?.id] })
  }

  function openConfig(method) {
    const existing = configs[method.id] || {}
    setActiveMethod(method)
    setFieldValues(method.id === 'ssl' ? { ssl_store_id: '', store_password: '' } : { merchant_number: '' })
    setSslLive(Boolean(existing.is_live))
    setShowFields({})
    setConfigOpen(true)
  }

  async function toggleMethod(methodId, enabled) {
    const method = METHODS.find((item) => item.id === methodId)
    const config = configs[methodId]
    if (!method || !store) return
    if (enabled && !config?.configured) { openConfig(method); return }
    setToggleSaving(methodId)
    try {
      const data = await paymentApi({ action: 'toggle', store_id: store.id, method: methodId, enabled })
      await refreshAfterChange(data.configs)
      toast.success(enabled ? `${method.name} enabled` : `${method.name} disabled`)
    } catch (error) { toast.error(error.message) }
    finally { setToggleSaving('') }
  }

  async function saveConfig() {
    if (!store || !activeMethod) return
    setSaving(true)
    try {
      let body = { action: 'save', store_id: store.id, method: activeMethod.id, enabled: true }
      if (['bkash', 'nagad', 'rocket'].includes(activeMethod.id)) {
        const number = normalizeMobile(fieldValues.merchant_number)
        if (!/^01[3-9][0-9]{8}$/.test(number)) throw new Error('Enter a valid Bangladesh merchant number: 01XXXXXXXXX.')
        body = { ...body, merchant_number: number }
      }
      if (activeMethod.id === 'ssl') {
        const sslStoreId = String(fieldValues.ssl_store_id || '').trim()
        const password = String(fieldValues.store_password || '').trim()
        if (!sslStoreId || !password) throw new Error('SSL Store ID and Store Password are required.')
        body = { ...body, ssl_store_id: sslStoreId, store_password: password, is_live: sslLive }
      }
      const data = await paymentApi(body)
      await refreshAfterChange(data.configs)
      if (activeMethod.id === 'ssl' && !data.valid) throw new Error(data.message || 'SSLCommerz credentials could not be verified.')
      setConfigOpen(false)
      setFieldValues({})
      toast.success(data.message || `${activeMethod.name} saved and enabled`)
    } catch (error) { toast.error(error.message || 'Could not save payment configuration') }
    finally { setSaving(false) }
  }

  if (isLoading || loading) return <div className="space-y-5"><Skeleton className="h-10 w-64 rounded-xl" /><div className="grid gap-4 lg:grid-cols-2">{[0,1,2,3].map((item) => <Skeleton key={item} className="h-36 rounded-2xl" />)}</div></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Payment Methods</h1><p className="mt-1 text-sm text-muted-foreground">Sensitive credentials are validated and encrypted server-side. Checkout receives only public payment information.</p></div>
        <Badge variant="secondary" className={enabledCount > 0 ? 'w-fit gap-1 text-success' : 'w-fit gap-1 text-amber-600'}>{enabledCount > 0 ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}{enabledCount} active</Badge>
      </div>

      {enabledCount === 0 ? <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800"><AlertCircle className="h-5 w-5 shrink-0" /><p className="text-sm font-medium">The store cannot be published until one valid payment method is active.</p></div> : <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800"><ShieldCheck className="h-5 w-5 shrink-0" /><p className="text-sm font-medium">Payment setup is ready. Disabling a method affects future checkouts only; historical orders remain unchanged.</p></div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {METHODS.map((method) => {
          const config = configs[method.id]
          const enabled = Boolean(config?.enabled)
          const busy = toggleSaving === method.id
          const invalid = config?.configured && !config?.credential_valid
          return (
            <div key={method.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: `${method.color}18`, border: `1.5px solid ${method.color}40` }}>{method.logo}</div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{method.name}</h3>{enabled && <Badge variant="secondary" className="gap-1 text-[10px] text-success"><Check className="h-3 w-3" />Active</Badge>}{method.id === 'ssl' && config?.credential_valid && <Badge variant="secondary" className="text-[10px] text-blue-600">{config.is_live ? 'Live verified' : 'Sandbox verified'}</Badge>}{invalid && <Badge variant="secondary" className="gap-1 text-[10px] text-red-600"><ShieldAlert className="h-3 w-3" />Invalid / disabled</Badge>}{!config?.configured && <Badge variant="secondary" className="text-[10px] text-amber-600">Setup needed</Badge>}</div>
                    {config?.credential_last4 && <p className="mt-1 text-xs text-muted-foreground">Configured value: <span className="font-mono">{masked(config.credential_last4)}</span></p>}
                    {config?.credential_checked_at && <p className="mt-1 text-[11px] text-muted-foreground">Checked {new Date(config.credential_checked_at).toLocaleString()}</p>}
                    {config?.credential_error && <p className="mt-1 max-w-md text-xs text-red-600">{config.credential_error}</p>}
                    {method.fields.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No credentials required</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}<Switch checked={enabled} disabled={busy || saving || (method.id !== 'cod' && !config?.credential_valid)} onCheckedChange={(value) => toggleMethod(method.id, value)} /></div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3"><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3" />{method.id === 'ssl' ? 'Password encrypted with AES-GCM and never returned to the browser' : method.fields.length ? 'Only the last four digits are displayed here' : 'Ready for checkout'}</div>{method.fields.length > 0 && <Button variant="outline" size="sm" onClick={() => openConfig(method)} className="gap-1.5"><Settings2 className="h-3.5 w-3.5" />{config?.configured ? 'Reconfigure' : 'Configure'}</Button>}</div>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><CreditCard className="h-5 w-5" /></div><div><p className="font-semibold">Payment safety rules</p><p className="mt-1 text-sm text-muted-foreground">Mobile banking numbers must match Bangladesh format. SSLCommerz remains disabled until the selected Sandbox/Live gateway accepts the credentials. A live storefront cannot disable its final active method.</p></div></div></div>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Configure {activeMethod?.name}</DialogTitle></DialogHeader>
          {activeMethod && <div className="space-y-4 py-2">
            {activeMethod.id === 'ssl' && <div className="rounded-xl border border-border bg-muted/30 p-3"><Label>Gateway environment</Label><p className="mt-1 text-xs text-muted-foreground">Use Sandbox until all callbacks and IPN tests pass.</p><div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1"><button type="button" onClick={() => setSslLive(false)} className={`rounded-md px-3 py-2 text-sm font-medium ${!sslLive ? 'bg-background text-blue-600 shadow-sm' : 'text-muted-foreground'}`}>Sandbox</button><button type="button" onClick={() => setSslLive(true)} className={`rounded-md px-3 py-2 text-sm font-medium ${sslLive ? 'bg-background text-green-600 shadow-sm' : 'text-muted-foreground'}`}>Live</button></div></div>}
            {activeMethod.fields.map((field) => <div key={field.key} className="grid gap-2"><Label>{field.label} <span className="text-destructive">*</span></Label><div className="relative"><Input type={field.secret && !showFields[field.key] ? 'password' : 'text'} autoComplete="new-password" value={fieldValues[field.key] || ''} onChange={(event) => setFieldValues((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} className="font-mono" />{field.secret && <button type="button" aria-label="Show or hide password" onClick={() => setShowFields((current) => ({ ...current, [field.key]: !current[field.key] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showFields[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}</div></div>)}
            {activeMethod.id === 'ssl' && <p className="text-xs leading-5 text-muted-foreground">Validation uses a server-side BDT 10 session probe. No payment is charged. Invalid credentials are disabled without exposing raw gateway errors to customers.</p>}
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setConfigOpen(false)}>Cancel</Button><Button onClick={saveConfig} disabled={saving} className="bg-gradient-primary">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{activeMethod?.id === 'ssl' ? 'Validate & Enable' : 'Save & Enable'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
