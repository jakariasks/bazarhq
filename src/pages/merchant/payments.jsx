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

const METHOD_ALIASES = {
  sslcommerz: 'ssl',
  cash_on_delivery: 'cod',
  cashondelivery: 'cod',
}

function canonicalMethod(method) {
  const value = String(method || '').trim().toLowerCase()
  return METHOD_ALIASES[value] || value
}

const PAYMENT_CONFIG_SELECT = 'id, store_id, method, enabled, merchant_number, ssl_store_id, is_live, ssl_credentials_valid, ssl_credentials_checked_at, ssl_credentials_error, created_at, updated_at'

const METHODS = [
  { id: 'bkash', name: 'bKash', logo: '🔴', color: '#E2136E', fields: [{ key: 'merchant_number', label: 'Merchant Number', placeholder: '01XXXXXXXXX' }] },
  { id: 'nagad', name: 'Nagad', logo: '🟠', color: '#F7941D', fields: [{ key: 'merchant_number', label: 'Merchant Number', placeholder: '01XXXXXXXXX' }] },
  { id: 'rocket', name: 'Rocket (DBBL)', logo: '🟣', color: '#8B3FC8', fields: [{ key: 'merchant_number', label: 'Merchant Number', placeholder: '01XXXXXXXXX' }] },
  {
    id: 'ssl', name: 'SSLCommerz (Cards)', logo: '💳', color: '#2563EB',
    fields: [
      { key: 'ssl_store_id', label: 'SSL Store ID', placeholder: 'Your SSLCommerz Store ID' },
      { key: 'store_password', label: 'SSL Store Password', placeholder: 'Enter the gateway password', secret: true },
    ],
  },
  { id: 'cod', name: 'Cash on Delivery', logo: '💵', color: '#16A34A', fields: [] },
]

function maskValue(value) {
  if (!value) return ''
  const text = String(value)
  if (text.length <= 4) return '••••'
  return '•'.repeat(Math.max(4, text.length - 4)) + text.slice(-4)
}

function isConfigured(method, config) {
  if (!method) return false
  if (method.id === 'ssl') return Boolean(config?.ssl_credentials_valid && config?.ssl_store_id)
  if (method.fields.length === 0) return true
  return method.fields.every((field) => String(config?.[field.key] || '').trim().length > 0)
}

async function functionErrorMessage(error, fallback) {
  const response = error?.context
  if (response && typeof response.clone === 'function') {
    try {
      const payload = await response.clone().json()
      if (payload?.message) return String(payload.message)
    } catch {
      // The response may be non-JSON. Fall through to the safe fallback.
    }
  }
  return fallback || error?.message || 'The request could not be completed.'
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

  useEffect(() => {
    if (!store?.id) {
      setLoading(false)
      return
    }
    loadConfigs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id])

  async function loadConfigs() {
    if (!store?.id) return
    setLoading(true)

    const { data, error } = await supabase
      .from('payment_configs')
      .select(PAYMENT_CONFIG_SELECT)
      .eq('store_id', store.id)
      .order('created_at', { ascending: true })

    if (error) {
      toast.error(error.message)
      setConfigs({})
      setLoading(false)
      return
    }

    const map = {}
    for (const row of data || []) {
      const method = canonicalMethod(row.method)
      if (!METHODS.some((item) => item.id === method)) continue

      const normalized = { ...row, method, enabled: Boolean(row.enabled) }
      const current = map[method]

      // A legacy database may contain both `sslcommerz` and `ssl`. Prefer the
      // newest record until the old alias is removed by a database migration.
      if (!current || new Date(normalized.updated_at || normalized.created_at || 0) >= new Date(current.updated_at || current.created_at || 0)) {
        map[method] = normalized
      }
    }
    setConfigs(map)
    setLoading(false)
  }

  async function saveRow(methodId, patch) {
    if (!store?.id) throw new Error('No active store selected.')

    const method = canonicalMethod(methodId)
    const now = new Date().toISOString()
    const payload = {
      store_id: store.id,
      method,
      ...patch,
      updated_at: now,
    }

    // Always upsert by the real database uniqueness contract. Relying on the
    // locally loaded config map creates a race: an existing row can be missed
    // and a second INSERT then violates payment_configs_store_id_method_key.
    let { data, error } = await supabase
      .from('payment_configs')
      .upsert(payload, {
        onConflict: 'store_id,method',
        ignoreDuplicates: false,
      })
      .select(PAYMENT_CONFIG_SELECT)
      .single()

    // Defensive fallback for stale PostgREST schema cache or older projects.
    // A duplicate-key result means the row exists, so update it explicitly.
    if (error?.code === '23505') {
      const fallback = await supabase
        .from('payment_configs')
        .update({ ...patch, updated_at: now })
        .eq('store_id', store.id)
        .eq('method', method)
        .select(PAYMENT_CONFIG_SELECT)
        .single()

      data = fallback.data
      error = fallback.error
    }

    if (error) throw error

    setConfigs((current) => ({
      ...current,
      [method]: { ...data, method, enabled: Boolean(data?.enabled) },
    }))

    return data
  }

  async function refreshAfterChange() {
    await loadConfigs()
    qc.invalidateQueries({ queryKey: ['stores', user?.id] })
    qc.invalidateQueries({ queryKey: ['publish-status', 'payments', store?.id] })
    qc.invalidateQueries({ queryKey: ['dashboard-payment-count', store?.id] })
  }

  function openConfig(method) {
    setActiveMethod(method)
    const existing = configs[canonicalMethod(method.id)] || {}
    const values = {}
    for (const field of method.fields) values[field.key] = field.secret ? '' : (existing[field.key] || '')
    setFieldValues(values)
    setSslLive(Boolean(existing.is_live))
    setShowFields({})
    setConfigOpen(true)
  }

  async function toggleMethod(methodId, enabled) {
    if (!store) return
    const method = METHODS.find((item) => item.id === methodId)
    const existing = configs[canonicalMethod(methodId)]
    if (!method) return

    if (enabled && !isConfigured(method, existing)) {
      openConfig(method)
      return
    }
    if (!enabled && existing?.enabled && enabledCount <= 1) {
      toast.error('Keep at least one payment method active.')
      return
    }

    setToggleSaving(methodId)
    try {
      await saveRow(methodId, { enabled })
      toast.success(enabled ? `${method.name} enabled` : `${method.name} disabled`)
      await refreshAfterChange()
    } catch (error) {
      toast.error(error.message || 'Could not update payment method')
    } finally {
      setToggleSaving('')
    }
  }

  async function saveConfig() {
    if (!store || !activeMethod) return

    for (const field of activeMethod.fields) {
      if (!String(fieldValues[field.key] || '').trim()) {
        toast.error(`Enter ${field.label}`)
        return
      }
    }

    if (['bkash', 'nagad', 'rocket'].includes(activeMethod.id)) {
      const number = fieldValues.merchant_number?.replace(/\D/g, '')
      if (!number || number.length !== 11 || !/^01[3-9]/.test(number)) {
        toast.error('Enter a valid 11-digit Bangladesh merchant number.')
        return
      }
      fieldValues.merchant_number = number
    }

    setSaving(true)
    try {
      if (activeMethod.id === 'ssl') {
        const { data, error } = await supabase.functions.invoke('sslcommerz-validate-config', {
          body: {
            store_id: store.id,
            ssl_store_id: String(fieldValues.ssl_store_id || '').trim(),
            store_password: String(fieldValues.store_password || '').trim(),
            is_live: sslLive,
          },
        })

        if (error) {
          const message = await functionErrorMessage(error, 'SSLCommerz verification service could not be reached. Existing settings were not changed.')
          await refreshAfterChange()
          throw new Error(message)
        }

        if (!data?.valid) {
          await refreshAfterChange()
          throw new Error(data?.message || 'SSLCommerz credentials were rejected. Online payment remains disabled.')
        }

        toast.success(data?.message || `SSLCommerz ${sslLive ? 'live' : 'sandbox'} credentials verified and enabled`)
      } else {
        const payload = { enabled: true }
        for (const field of activeMethod.fields) payload[field.key] = String(fieldValues[field.key] || '').trim()
        await saveRow(activeMethod.id, payload)
        toast.success(`${activeMethod.name} is ready`)
      }

      setConfigOpen(false)
      await refreshAfterChange()
    } catch (error) {
      toast.error(error.message || 'Could not save payment configuration')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || loading) {
    return <div className="space-y-5"><Skeleton className="h-10 w-64 rounded-xl" /><div className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-36 rounded-2xl" />)}</div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Payment Methods</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enable at least one verified method for checkout.</p>
        </div>
        <Badge variant="secondary" className={enabledCount > 0 ? 'w-fit gap-1 text-success' : 'w-fit gap-1 text-amber-600'}>
          {enabledCount > 0 ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}{enabledCount} active
        </Badge>
      </div>

      {enabledCount === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-800"><AlertCircle className="h-5 w-5 shrink-0" /><p className="text-sm font-medium">Choose one payment method. Cash on Delivery is enough to publish.</p></div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800"><ShieldCheck className="h-5 w-5 shrink-0" /><p className="text-sm font-medium">Payment setup complete. Customers see only enabled and valid methods.</p></div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {METHODS.map((method) => {
          const config = configs[canonicalMethod(method.id)]
          const enabled = Boolean(config?.enabled)
          const configured = isConfigured(method, config)
          const busy = toggleSaving === method.id
          const sslInvalid = method.id === 'ssl' && config?.ssl_store_id && !config?.ssl_credentials_valid

          return (
            <div key={method.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ background: `${method.color}18`, border: `1.5px solid ${method.color}40` }}>{method.logo}</div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{method.name}</h3>
                      {enabled && <Badge variant="secondary" className="gap-1 text-[10px] text-success"><Check className="h-3 w-3" />Active</Badge>}
                      {method.id === 'ssl' && config?.ssl_credentials_valid && <Badge variant="secondary" className="text-[10px] text-blue-600">{config.is_live ? 'Live verified' : 'Sandbox verified'}</Badge>}
                      {sslInvalid && <Badge variant="secondary" className="gap-1 text-[10px] text-red-600"><ShieldAlert className="h-3 w-3" />Invalid / disabled</Badge>}
                      {!configured && !sslInvalid && <Badge variant="secondary" className="text-[10px] text-amber-600">Setup needed</Badge>}
                    </div>
                    {config?.merchant_number && <p className="mt-1 text-xs text-muted-foreground">Number: <span className="font-mono">{maskValue(config.merchant_number)}</span></p>}
                    {method.id === 'ssl' && config?.ssl_store_id && <p className="mt-1 text-xs text-muted-foreground">Store ID: <span className="font-mono">{maskValue(config.ssl_store_id)}</span></p>}
                    {method.id === 'ssl' && config?.ssl_credentials_checked_at && <p className="mt-1 text-[11px] text-muted-foreground">Checked {new Date(config.ssl_credentials_checked_at).toLocaleString()}</p>}
                    {method.id === 'ssl' && config?.ssl_credentials_error && <p className="mt-1 max-w-md text-[11px] leading-4 text-red-600">{config.ssl_credentials_error}</p>}
                    {method.fields.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No credentials needed</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}<Switch checked={enabled} disabled={busy || saving || (method.id === 'ssl' && !configured)} onCheckedChange={(value) => toggleMethod(method.id, value)} /></div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3" />{method.id === 'ssl' ? 'Password is verified server-side and never exposed to checkout' : method.fields.length ? 'Credentials are private' : 'Ready for checkout'}</div>
                {method.fields.length > 0 && <Button variant="outline" size="sm" onClick={() => openConfig(method)} className="gap-1.5"><Settings2 className="h-3.5 w-3.5" />{configured ? 'Revalidate' : 'Configure'}</Button>}
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><CreditCard className="h-5 w-5" /></div><div><p className="font-semibold">SSLCommerz security rule</p><p className="mt-1 text-sm text-muted-foreground">Card payment is shown only after the credentials pass server-side validation. Invalid credentials automatically disable SSLCommerz without exposing the gateway error to customers.</p></div></div></div>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Configure {activeMethod?.name}</DialogTitle></DialogHeader>
          {activeMethod && (
            <div className="space-y-4 py-2">
              {activeMethod.id === 'ssl' && (
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div><Label>Gateway environment</Label><p className="mt-1 text-xs text-muted-foreground">Use Sandbox until every callback and IPN test passes.</p></div>
                    <div className="inline-flex rounded-lg border border-border bg-background p-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setSslLive(false)}
                        className={`rounded-md px-3 py-1.5 font-medium transition ${!sslLive ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        Sandbox
                      </button>
                      <button
                        type="button"
                        onClick={() => setSslLive(true)}
                        className={`rounded-md px-3 py-1.5 font-medium transition ${sslLive ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        Live
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeMethod.fields.map((field) => (
                <div key={field.key} className="grid gap-2">
                  <Label>{field.label} <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input type={field.secret && !showFields[field.key] ? 'password' : 'text'} autoComplete="new-password" value={fieldValues[field.key] || ''} onChange={(event) => setFieldValues((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} className="font-mono" />
                    {field.secret && <button type="button" aria-label="Show or hide password" onClick={() => setShowFields((current) => ({ ...current, [field.key]: !current[field.key] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">{showFields[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>}
                  </div>
                </div>
              ))}

              {activeMethod.id === 'ssl' && <p className="text-xs leading-5 text-muted-foreground">Save runs a real credential check against the selected SSLCommerz environment. Failure keeps online payment disabled.</p>}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setConfigOpen(false)}>Cancel</Button><Button onClick={saveConfig} disabled={saving} className="bg-gradient-primary">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{activeMethod?.id === 'ssl' ? 'Validate & Enable' : 'Save & Enable'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
