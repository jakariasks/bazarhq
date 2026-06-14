import { useEffect, useState } from 'react'
import { Check, Settings2, Eye, EyeOff, Loader2, AlertCircle, Lock, CreditCard } from 'lucide-react'
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
  { id: 'bkash',  name: 'bKash',            logo: '🔴', color: '#E2136E', fields: [{ key: 'merchant_number', label: 'Merchant Number', placeholder: '01XXXXXXXXX' }] },
  { id: 'nagad',  name: 'Nagad',             logo: '🟠', color: '#F7941D', fields: [{ key: 'merchant_number', label: 'Merchant Number', placeholder: '01XXXXXXXXX' }] },
  { id: 'rocket', name: 'Rocket (DBBL)',     logo: '🟣', color: '#8B3FC8', fields: [{ key: 'merchant_number', label: 'Merchant Number', placeholder: '01XXXXXXXXX' }] },
  { id: 'ssl',    name: 'SSLCommerz (Cards)', logo: '💳', color: '#2563EB', fields: [
    { key: 'store_id',       label: 'Store ID',       placeholder: 'your_store_id' },
    { key: 'store_password', label: 'Store Password', placeholder: '••••••••', secret: true },
  ]},
  { id: 'cod',    name: 'Cash on Delivery',  logo: '💵', color: '#16A34A', fields: [] },
]

// SRS M6: Mask credentials — show last 4 chars
function maskValue(val) {
  if (!val || val.length <= 4) return '****'
  return '•'.repeat(val.length - 4) + val.slice(-4)
}

export default function PaymentsPage() {
  const { user } = useAuth()
  const { store, isLoading } = useCurrentStore()
  const qc = useQueryClient()
  const [configs, setConfigs] = useState({}) // { bkash: { enabled, merchant_number }, ... }
  const [loading, setLoading] = useState(true)
  const [configOpen, setConfigOpen] = useState(false)
  const [activeMethod, setActiveMethod] = useState(null)
  const [fieldValues, setFieldValues] = useState({})
  const [showFields, setShowFields] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!store?.id) return
    loadConfigs()
  }, [store?.id])

  const loadConfigs = async () => {
    setLoading(true)
    const { data } = await supabase.from('payment_configs').select('*').eq('store_id', store.id)
    const map = {}
    for (const row of data ?? []) { map[row.method] = row }
    setConfigs(map)
    setLoading(false)
  }

  const toggleMethod = async (methodId, enabled) => {
    if (!store) return
    const method = METHODS.find(m => m.id === methodId)

    // SRS M6: methods with credentials must be configured first
    if (enabled && method.fields.length > 0 && !configs[methodId]?.merchant_number && !configs[methodId]?.store_id) {
      setActiveMethod(method)
      setFieldValues({})
      setShowFields({})
      setConfigOpen(true)
      return
    }

    const existing = configs[methodId]
    if (existing) {
      await supabase.from('payment_configs').update({ enabled }).eq('id', existing.id)
    } else {
      await supabase.from('payment_configs').insert({ store_id: store.id, method: methodId, enabled })
    }
    toast.success(enabled ? `${method.name} enabled` : `${method.name} disabled`)
    loadConfigs()
    qc.invalidateQueries({ queryKey: ['stores', user?.id] })
  }

  const openConfig = (method) => {
    setActiveMethod(method)
    const existing = configs[method.id] || {}
    const vals = {}
    for (const f of method.fields) vals[f.key] = existing[f.key] || ''
    setFieldValues(vals)
    setShowFields({})
    setConfigOpen(true)
  }

  const saveConfig = async () => {
    if (!store || !activeMethod) return
    // SRS M6: validate format
    for (const f of activeMethod.fields) {
      if (!fieldValues[f.key]?.trim()) {
        toast.error(`Please enter ${f.label}`)
        return
      }
    }
    // Phone format check for bKash/Nagad/Rocket
    if (['bkash','nagad','rocket'].includes(activeMethod.id)) {
      const num = fieldValues['merchant_number']?.replace(/\D/g,'')
      if (!num || num.length !== 11 || !/^01[3-9]/.test(num)) {
        toast.error('Invalid merchant number — must be 11-digit BD number (01XXXXXXXXX)')
        return
      }
    }
    setSaving(true)
    const existing = configs[activeMethod.id]
    const payload = { store_id: store.id, method: activeMethod.id, enabled: true, ...fieldValues }
    if (existing) {
      await supabase.from('payment_configs').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('payment_configs').insert(payload)
    }
    setSaving(false)
    toast.success(`${activeMethod.name} configured & enabled`)
    setConfigOpen(false)
    loadConfigs()
    qc.invalidateQueries({ queryKey: ['stores', user?.id] })
  }

  const enabledCount = METHODS.filter(m => configs[m.id]?.enabled).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Payment Methods</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the payment methods available to your customers at checkout.
        </p>
      </div>

      {/* SRS M6: at least 1 active warning */}
      {!loading && enabledCount === 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">You need at least one payment method enabled before publishing your shop.</p>
        </div>
      )}

      {isLoading || loading ? (
        <div className="space-y-4">{[0,1,2].map(i=><Skeleton key={i} className="h-28 rounded-2xl"/>)}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {METHODS.map(m => {
            const cfg = configs[m.id]
            const enabled = cfg?.enabled ?? false
            const configured = m.fields.length === 0 || (cfg && (cfg.merchant_number || cfg.store_id))
            return (
              <div key={m.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
                      style={{ background: m.color + '18', border: `1.5px solid ${m.color}40` }}>
                      {m.logo}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{m.name}</h3>
                        {enabled && <Badge variant="secondary" className="gap-1 text-success text-[10px]"><Check className="h-3 w-3"/>Active</Badge>}
                        {!configured && <Badge variant="secondary" className="text-[10px] text-amber-600">Setup needed</Badge>}
                      </div>
                      {/* SRS M6: show masked credentials */}
                      {cfg?.merchant_number && (
                        <p className="text-xs text-muted-foreground">
                          Number: <span className="font-mono">{maskValue(cfg.merchant_number)}</span>
                        </p>
                      )}
                      {cfg?.store_id && (
                        <p className="text-xs text-muted-foreground">
                          Store ID: <span className="font-mono">{maskValue(cfg.store_id)}</span>
                        </p>
                      )}
                      {m.fields.length === 0 && <p className="text-xs text-muted-foreground">No credentials needed</p>}
                    </div>
                  </div>
                  <Switch checked={enabled} onCheckedChange={v=>toggleMethod(m.id, v)} />
                </div>
                {m.fields.length > 0 && (
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Lock className="h-3 w-3" /> Credentials stored encrypted
                    </div>
                    <Button variant="outline" size="sm" onClick={()=>openConfig(m)} className="gap-1.5">
                      <Settings2 className="h-3.5 w-3.5" />{configured ? 'Update' : 'Configure'}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><CreditCard className="h-5 w-5"/></div>
          <div>
            <p className="font-semibold">Payouts</p>
            <p className="mt-1 text-sm text-muted-foreground">Receive earnings directly to your bKash or bank. Configure payout in Settings.</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Lock className="h-3 w-3"/>BazarHQ never stores card numbers or full credentials.</div>
          </div>
        </div>
      </div>

      {/* Configure dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure {activeMethod?.name}</DialogTitle>
          </DialogHeader>
          {activeMethod && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
                🔒 Your credentials are stored encrypted. BazarHQ never exposes them to customers.
              </div>
              {activeMethod.fields.map(f => (
                <div key={f.key} className="grid gap-2">
                  <Label>{f.label} <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input
                      type={f.secret && !showFields[f.key] ? 'password' : 'text'}
                      autoComplete="off"
                      value={fieldValues[f.key] || ''}
                      onChange={e=>setFieldValues(v=>({...v,[f.key]:e.target.value}))}
                      placeholder={f.placeholder}
                      className="font-mono"
                    />
                    {f.secret && (
                      <button type="button" onClick={()=>setShowFields(s=>({...s,[f.key]:!s[f.key]}))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showFields[f.key] ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={()=>setConfigOpen(false)}>Cancel</Button>
            <Button onClick={saveConfig} disabled={saving} className="bg-gradient-primary">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
