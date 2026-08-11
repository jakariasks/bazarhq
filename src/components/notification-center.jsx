import { useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Loader2, Package, ShieldAlert, Megaphone, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentStore } from '@/lib/use-current-store'
import { toast } from 'sonner'

function iconFor(type) {
  if (type === 'new_order') return Package
  if (type === 'order_status') return RefreshCw
  if (type === 'store_suspended' || type === 'store_deleted') return ShieldAlert
  if (type === 'announcement') return Megaphone
  return AlertTriangle
}

function formatTime(value) {
  if (!value) return ''
  const diff = Date.now() - new Date(value).getTime()
  const min = Math.max(1, Math.round(diff / 60000))
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  return new Date(value).toLocaleDateString('en-BD', { day: 'numeric', month: 'short' })
}

export function NotificationCenter() {
  const { store } = useCurrentStore()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const queryKey = ['merchant-notifications', store?.id]

  const { data: notifications = [], isLoading, error: notificationsError, refetch } = useQuery({
    queryKey,
    enabled: !!store?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_notifications')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data || []
    },
    // Realtime is primary; polling remains a low-frequency resilience fallback.
    refetchInterval: 60_000,
  })

  useEffect(() => {
    if (!store?.id) return undefined
    const channel = supabase
      .channel(`merchant-notifications:${store.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'merchant_notifications',
        filter: `store_id=eq.${store.id}`,
      }, (payload) => {
        const next = payload.new
        qc.setQueryData(queryKey, (current = []) => [next, ...current.filter((item) => item.id !== next.id)].slice(0, 30))
        toast(next.title || 'New notification', { description: next.body || next.message || '' })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'merchant_notifications',
        filter: `store_id=eq.${store.id}`,
      }, (payload) => {
        qc.setQueryData(queryKey, (current = []) => current.map((item) => item.id === payload.new.id ? payload.new : item))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [store?.id, qc]) // queryKey intentionally derives from store id

  const unread = useMemo(() => notifications.filter((item) => !item.read_at && !item.is_read).length, [notifications])

  async function markAllRead() {
    if (!store?.id || !unread) return
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('merchant_notifications')
      .update({ read_at: now, is_read: true })
      .eq('store_id', store.id)
      .is('read_at', null)
    if (error) { toast.error(error.message); return }
    qc.setQueryData(queryKey, (current = []) => current.map((item) => ({ ...item, read_at: item.read_at || now, is_read: true })))
  }

  async function markOneRead(id) {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('merchant_notifications')
      .update({ read_at: now, is_read: true })
      .eq('id', id)
      .eq('store_id', store.id)
    if (error) {
      toast.error('Could not mark the notification as read.')
      return false
    }
    qc.setQueryData(queryKey, (current = []) => current.map((item) => item.id === id ? { ...item, read_at: now, is_read: true } : item))
    return true
  }

  function notificationRoute(item) {
    const explicit = String(item?.action_url || item?.link_url || '').trim()
    if (explicit.startsWith('/merchant')) return explicit
    if (item?.type === 'new_order' || item?.type === 'order_status') return '/merchant/orders'
    if (item?.type === 'low_stock') return '/merchant/products'
    if (item?.type === 'store_suspended' || item?.type === 'store_deleted') return '/merchant/settings'
    return ''
  }

  async function openNotification(item) {
    await markOneRead(item.id)
    const target = notificationRoute(item)
    if (target) navigate({ to: target })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" disabled={!store?.id}>
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unread > 0 && <button onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[420px] overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</div>
          ) : notificationsError ? (
            <div className="px-4 py-8 text-center">
              <AlertTriangle className="mx-auto h-5 w-5 text-destructive" />
              <p className="mt-2 text-sm font-medium">Notifications could not be loaded</p>
              <button type="button" onClick={() => refetch()} className="mt-2 text-xs font-semibold text-primary hover:underline">Try again</button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No notifications yet.</div>
          ) : notifications.map((item) => {
            const Icon = iconFor(item.type)
            const read = item.read_at || item.is_read
            return (
              <DropdownMenuItem key={item.id} onSelect={() => openNotification(item)} className="mb-1 cursor-pointer rounded-xl p-3 focus:bg-muted">
                <div className="flex w-full gap-3">
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${read ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}><Icon className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2"><p className="line-clamp-1 text-sm font-semibold">{item.title}</p>{!read && <Badge className="h-5 rounded-full px-1.5 text-[10px]">New</Badge>}</div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.body || item.message}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatTime(item.created_at)}</p>
                  </div>
                </div>
              </DropdownMenuItem>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
