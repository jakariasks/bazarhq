import { useEffect, useState } from 'react'
import { AlertTriangle, Bell, Loader2, Mail, MessageSquare, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/use-auth'
import { useCurrentStore } from '@/lib/use-current-store'

const DEFAULTS = {
  new_order: true, low_stock: true, order_status: true, pending_order_reminder: true, weekly_report: false, marketing: false,
  dashboard_enabled: true, email_enabled: true, sms_enabled: true, sms_email_fallback: true,
  recipient_email: '', recipient_phone: '', max_attempts: 5,
}

export function MerchantNotificationPreferences() {
  const { user } = useAuth()
  const { store } = useCurrentStore()
  const [prefs, setPrefs] = useState(DEFAULTS)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!store?.id) { setLoading(false); return }
    setLoading(true)
    const [{ data, error }, { data: deliveryLogs }] = await Promise.all([
      supabase.from('merchant_notification_preferences').select('*').eq('store_id', store.id).maybeSingle(),
      supabase.from('notification_delivery_logs').select('*').eq('store_id', store.id).order('created_at', { ascending: false }).limit(20),
    ])
    if (error) toast.error(error.message)
    setPrefs({ ...DEFAULTS, ...(data || {}), recipient_email: data?.recipient_email || user?.email || store.contact_email || '', recipient_phone: data?.recipient_phone || store.phone || store.whatsapp_number || '' })
    setLogs(deliveryLogs || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [store?.id, user?.email]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (key, value) => setPrefs((current) => ({ ...current, [key]: value }))

  async function save() {
    if (!store?.id || !user?.id) return
    const phone = String(prefs.recipient_phone || '').replace(/\D/g, '')
    if (prefs.sms_enabled && !/^(?:01[3-9][0-9]{8}|8801[3-9][0-9]{8})$/.test(phone)) return toast.error('Enter a valid Bangladesh notification phone number.')
    if (prefs.email_enabled && !/^\S+@\S+\.\S+$/.test(String(prefs.recipient_email || '').trim())) return toast.error('Enter a valid notification email.')
    setSaving(true)
    const { error } = await supabase.from('merchant_notification_preferences').upsert({
      store_id: store.id, merchant_id: user.id,
      new_order: prefs.new_order, low_stock: prefs.low_stock, order_status: prefs.order_status, pending_order_reminder: prefs.pending_order_reminder,
      weekly_report: prefs.weekly_report, marketing: prefs.marketing,
      dashboard_enabled: prefs.dashboard_enabled, email_enabled: prefs.email_enabled,
      sms_enabled: prefs.sms_enabled, sms_email_fallback: prefs.sms_email_fallback,
      recipient_email: prefs.recipient_email.trim() || null,
      recipient_phone: prefs.recipient_phone.trim() || null,
      max_attempts: Number(prefs.max_attempts || 5), updated_at: new Date().toISOString(),
    }, { onConflict: 'store_id' })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Notification preferences saved.')
  }

  if (loading) return <div className="flex items-center justify-center rounded-2xl border p-12 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading preferences…</div>

  const types = [
    ['new_order','New orders','Instant dashboard, email or SMS when a customer places an order.',Bell],
    ['low_stock','Low-stock alerts','Triggered when a product crosses its low-stock threshold or reaches zero.',AlertTriangle],
    ['order_status','Order status updates','Dashboard, email or SMS when an order status changes.',RefreshCw],
    ['pending_order_reminder','48-hour pending-order reminders','Alerts you once when an order has remained Pending for more than 48 hours.',AlertTriangle],
    ['weekly_report','Weekly report','Reserved for the weekly performance report worker.',Mail],
    ['marketing','BazarHQ tips and updates','Optional product and platform communication.',MessageSquare],
  ]

  return <div className="space-y-5">
    <section className="rounded-2xl border border-border bg-card p-6">
      <h3 className="font-semibold">Delivery channels</h3><p className="mt-1 text-sm text-muted-foreground">Dashboard uses Supabase Realtime. New-order delivery is kicked immediately after checkout; durable queues retry automatically, with a 30-second delivery target.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[['dashboard_enabled','Dashboard realtime',Bell],['email_enabled','Email',Mail],['sms_enabled','SMS',MessageSquare]].map(([key,label,Icon]) => <label key={key} className="flex items-center justify-between rounded-xl border p-4"><span className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-muted-foreground" />{label}</span><Switch checked={Boolean(prefs[key])} onCheckedChange={(value) => set(key,value)} /></label>)}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><Label>Notification email</Label><Input className="mt-1" value={prefs.recipient_email} onChange={(e) => set('recipient_email',e.target.value)} /></div>
        <div><Label>Notification phone</Label><Input className="mt-1" value={prefs.recipient_phone} onChange={(e) => set('recipient_phone',e.target.value)} placeholder="01XXXXXXXXX" /></div>
      </div>
      <label className="mt-4 flex items-center justify-between rounded-xl bg-muted/40 p-4"><span><span className="block text-sm font-medium">Automatic email fallback when SMS cannot be delivered</span><span className="text-xs text-muted-foreground">If the normal Email channel is off, permanent SMS failures fall back to the notification email immediately; temporary gateway failures retry first and fall back after the final attempt.</span></span><Switch checked={prefs.sms_email_fallback} onCheckedChange={(value) => set('sms_email_fallback',value)} /></label>
    </section>

    <section className="rounded-2xl border border-border bg-card p-6"><h3 className="font-semibold">Notification types</h3><div className="mt-4 divide-y divide-border">{types.map(([key,label,desc,Icon]) => <div key={key} className="flex items-center justify-between gap-4 py-4"><div className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-medium">{label}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{desc}</p></div></div><Switch checked={Boolean(prefs[key])} onCheckedChange={(value) => set(key,value)} /></div>)}</div><Button onClick={save} disabled={saving} className="mt-5 gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save preferences</Button></section>

    <section className="rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Recent delivery attempts</h3><p className="mt-1 text-xs text-muted-foreground">Safe provider status and failure logs; recipients are masked.</p></div><Button variant="outline" size="sm" onClick={load}>Refresh</Button></div><div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border">{logs.length ? logs.map((log) => { const seconds = Number.isFinite(Number(log.latency_ms)) ? Math.max(0, Math.round(Number(log.latency_ms) / 1000)) : null; const slaMet = seconds != null && seconds <= 30; return <div key={log.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:flex-wrap"><span className="font-medium uppercase">{log.queue_type}</span><span className="text-muted-foreground">{log.notification_type || 'notification'} · {log.recipient_masked || 'masked'}</span>{seconds != null && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${slaMet ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{seconds}s {slaMet ? '≤30s' : 'over target'}</span>}<span className={`sm:ml-auto ${log.status === 'sent' ? 'text-success' : log.status === 'failed' ? 'text-destructive' : 'text-amber-600'}`}>{log.status} · attempt {log.attempt}{log.fallback_used ? ' · fallback' : ''}</span>{log.error_message && <span className="text-xs text-destructive sm:basis-full">{log.error_message}</span>}</div> }) : <p className="p-5 text-center text-sm text-muted-foreground">No delivery attempts logged yet.</p>}</div></section>
  </div>
}
