import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, ChevronsUpDown, Plus, Search, Store as StoreIcon, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useCurrentStore, useSwitchStore } from '@/lib/use-current-store'
import { getStorefrontLabel } from '@/lib/storefront-url'

function StoreAvatar({ store, size = 28 }) {
  const color = store?.brand_color || '#6366f1'
  const initial = (store?.shop_name || 'S').charAt(0).toUpperCase()
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white shadow-sm ring-1 ring-black/5"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 70%, #000))` }}
    >
      {store ? initial : <StoreIcon className="h-3.5 w-3.5" />}
    </span>
  )
}

function StoreRow({ s, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn('group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none', active && 'bg-accent/60')}
    >
      <StoreAvatar store={s} size={28} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{s.shop_name || 'Untitled store'}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {s.subdomain ? getStorefrontLabel(s.subdomain) : 'No subdomain'}
        </span>
      </span>
      <Check className={cn('h-4 w-4 shrink-0 text-primary transition-all', active ? 'opacity-100 scale-100' : 'opacity-0 scale-75')} />
    </button>
  )
}

export function StoreSwitcher({ variant = 'sidebar' }) {
  const { store, stores, isLoading } = useCurrentStore()
  const switchStore = useSwitchStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return stores
    return stores.filter((s) =>
      (s.shop_name || '').toLowerCase().includes(q) || (s.subdomain || '').toLowerCase().includes(q)
    )
  }, [stores, query])

  const label = store?.shop_name?.trim() || 'Untitled store'
  const sub = store?.subdomain ? getStorefrontLabel(store.subdomain) : 'Not set up yet'

  const handleSelect = (id) => {
    if (id !== store?.id) switchStore(id)
    setOpen(false)
    setQuery('')
  }

  if (variant === 'menu') {
    return (
      <>
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Your stores</DropdownMenuLabel>
        {isLoading ? (
          <div className="space-y-1 px-2 py-1.5">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-7 w-7 animate-pulse rounded-md bg-muted" />
                <span className="h-3 flex-1 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : stores.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">No stores yet</div>
        ) : (
          <ScrollArea className={stores.length > 5 ? 'h-60' : ''}>
            <div className="space-y-0.5 p-1">
              {stores.map((s) => <StoreRow key={s.id} s={s} active={s.id === store?.id} onSelect={() => handleSelect(s.id)} />)}
            </div>
          </ScrollArea>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/merchant/stores/new" className="gap-2"><Plus className="h-4 w-4" /> Create store</Link>
        </DropdownMenuItem>
      </>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery('') }}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-left hover:bg-muted">
          <div className="flex min-w-0 items-center gap-2">
            <StoreAvatar store={store} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{label}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>
            </span>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-64 p-0">
        <DropdownMenuLabel className="px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Switch store</DropdownMenuLabel>
        {isLoading ? (
          <div className="space-y-1 p-2">
            {[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-2 px-1 py-1"><span className="h-7 w-7 animate-pulse rounded-md bg-muted" /><span className="h-3 flex-1 animate-pulse rounded bg-muted" /></div>)}
          </div>
        ) : stores.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">No stores yet</div>
        ) : (
          <>
            {stores.length >= 4 && (
              <div className="relative px-2 pt-2 pb-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-[calc(50%-2px)] text-muted-foreground" />
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search stores…" className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring" />
              </div>
            )}
            <ScrollArea className={filtered.length > 5 ? 'h-64' : ''}>
              <div className="space-y-0.5 p-1">
                {filtered.map((s) => <StoreRow key={s.id} s={s} active={s.id === store?.id} onSelect={() => handleSelect(s.id)} />)}
              </div>
            </ScrollArea>
          </>
        )}
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuItem asChild className="gap-2 rounded-none px-3 py-2.5">
          <Link to="/merchant/stores/new">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-muted-foreground/40 text-muted-foreground"><Plus className="h-3.5 w-3.5" /></span>
            <span className="text-sm font-medium">Create store</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
