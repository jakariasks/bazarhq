import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { LayoutDashboard, Package, ShoppingCart, Users, BarChart3, Palette, CreditCard, Settings, Search, Bell, Menu, X, LogOut, Check, AlertTriangle, ShieldAlert, PlusCircle, Store as StoreIcon, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { Input } from '@/components/ui/input'
import { AuthGuard } from '@/components/auth-guard'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/integrations/supabase/client'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { previewThemes, themeCssVars, getTheme, DEFAULT_THEME_ID } from '@/lib/preview-themes'
import { toast } from 'sonner'
import { StoreSwitcher } from '@/components/store-switcher'
import { useCurrentStore } from '@/lib/use-current-store'

const nav = [
  { to: '/merchant', label: 'Dashboard', icon: LayoutDashboard, exact: true, noStore: true },
  { to: '/merchant/products', label: 'Products', icon: Package },
  { to: '/merchant/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/merchant/customers', label: 'Customers', icon: Users },
  { to: '/merchant/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/merchant/themes', label: 'Themes', icon: Palette },
  { to: '/merchant/payments', label: 'Payments', icon: CreditCard },
  { to: '/merchant/settings', label: 'Settings', icon: Settings },
]

function NoStoreDashboard({ user, navigate }) {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-elegant sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,.14),transparent_30%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Dashboard ready
            </span>
            <h1 className="mt-5 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
              Welcome to BazarHQ, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Merchant'}.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Your merchant account is active. You have not created a shop yet. Start when you are ready; your free plan allows one store per merchant email.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button className="gap-2 rounded-xl bg-gradient-primary shadow-glow" onClick={() => navigate({ to: '/merchant/stores/new' })}>
                <PlusCircle className="h-4 w-4" /> Create your shop
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => navigate({ to: '/merchant/settings' })}>
                Account settings
              </Button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-border bg-background/80 p-5 shadow-sm backdrop-blur">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <StoreIcon className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Next steps</h2>
            <div className="mt-4 space-y-3">
              {[
                'Choose a store name and unique storefront URL.',
                'Select your business categories.',
                'Add products and payment methods.',
                'Publish your storefront when setup is complete.',
              ].map((item, index) => (
                <div key={item} className="flex gap-3 rounded-xl border border-border bg-muted/30 p-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span>
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['Secure account', 'Email verification and bot protection help keep fake signups away.'],
          ['Free plan limit', 'One active store per merchant email in the free version.'],
          ['Create later', 'You can use the dashboard first and create your shop later.'],
        ].map(([title, desc]) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{desc}</p>
          </div>
        ))}
      </section>
    </div>
  )
}

function MerchantLayout() {
  const location = useLocation()
  const path = location.pathname
  const [open, setOpen] = useState(false)
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { store, isLoading: storeLoading } = useCurrentStore()

  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID)
  useEffect(() => { if (store?.theme_id) setThemeId(store.theme_id) }, [store?.theme_id])

  const applyTheme = async (t) => {
    setThemeId(t.id)
    if (!store) return
    const { error } = await supabase.from('stores').update({ theme_id: t.id }).eq('id', store.id)
    if (error) { toast.error(error.message); return }
    toast.success(`Theme set to ${t.name}`)
    qc.invalidateQueries({ queryKey: ['stores', user?.id] })
  }

  const activeTheme = getTheme(themeId)
  const initial = (user?.user_metadata?.shop_name || user?.email || '?').charAt(0).toUpperCase()
  const accountStatus = store?.account_status || 'active'
  const isSuspended = accountStatus === 'suspended'
  const isDeleted = accountStatus === 'deleted'
  const isRestricted = !!store && (isSuspended || isDeleted)
  const isNewStoreRoute = path === '/merchant/stores/new' || path.startsWith('/merchant/stores/new')
  const hasNoActiveStore = !storeLoading && !store
  const showNoStoreDashboard = hasNoActiveStore && !isNewStoreRoute

  return (
    <div className="flex min-h-screen w-full bg-muted/30" style={themeCssVars(activeTheme)}>
      {open && <div className="fixed inset-0 z-30 bg-foreground/30 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-border bg-sidebar transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Logo size="sm" />
          <button className="lg:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>

        <div className="px-3 py-2">
          <StoreSwitcher variant="sidebar" />
        </div>

        <nav className="space-y-1 px-3 py-2">
          {nav.map((item) => {
            const active = item.exact ? path === item.to : path === item.to || path.startsWith(item.to + '/')
            const disabled = hasNoActiveStore && !item.noStore

            if (disabled) {
              return (
                <button key={item.to} type="button" disabled className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground/50">
                  <item.icon className="h-4 w-4" /> {item.label}
                </button>
              )
            }

            return (
              <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'}`}>
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-4 left-3 right-3 rounded-xl border border-border bg-gradient-primary p-4 text-primary-foreground">
          <div className="text-sm font-medium">Upgrade to Pro</div>
          <p className="mt-1 text-xs opacity-90">Unlock advanced analytics & API access.</p>
          <Button size="sm" variant="secondary" className="mt-3 w-full">Upgrade</Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <div className="relative hidden flex-1 max-w-md md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={hasNoActiveStore ? 'Create a store to search products, orders, customers…' : 'Search products, orders, customers…'} className="pl-9" disabled={hasNoActiveStore} />
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            <span className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide sm:inline-flex ${hasNoActiveStore ? 'border-primary/20 bg-primary/10 text-primary' : isSuspended ? 'border-red-300 bg-red-50 text-red-700' : isDeleted ? 'border-slate-300 bg-slate-100 text-slate-600' : store?.storefront_published ? 'border-success/30 bg-success/10 text-success' : 'border-border bg-muted text-muted-foreground'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${hasNoActiveStore ? 'bg-primary' : isSuspended ? 'bg-red-600' : isDeleted ? 'bg-slate-500' : store?.storefront_published ? 'bg-success' : 'bg-muted-foreground'}`} />
              {hasNoActiveStore ? 'No store yet' : isSuspended ? 'Suspended' : isDeleted ? 'Deleted' : store?.storefront_published ? 'Live' : 'Draft'}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" disabled={hasNoActiveStore}>
                  <span className="inline-block h-3.5 w-3.5 rounded-full ring-2 ring-background" style={{ background: activeTheme.swatch }} />
                  <span className="hidden sm:inline">{activeTheme.name}</span>
                  <Palette className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Preview theme</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {previewThemes.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => applyTheme(t)} className="gap-2">
                    <span className="inline-block h-4 w-4 rounded-full" style={{ background: t.swatch }} />
                    <span className="flex-1">{t.name}</span>
                    {t.id === activeTheme.id && <Check className="h-4 w-4 opacity-70" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon"><Bell className="h-5 w-5" /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">{initial}</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">{user?.email}</div>
                <DropdownMenuSeparator />
                <StoreSwitcher variant="menu" />
                <DropdownMenuSeparator />
                {hasNoActiveStore ? (
                  <DropdownMenuItem onClick={() => navigate({ to: '/merchant/stores/new' })}><PlusCircle className="mr-2 h-4 w-4" /> Create store</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => navigate({ to: '/merchant/settings' })}><Settings className="mr-2 h-4 w-4" /> Settings</DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: '/' }) }}><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {isRestricted && (
            <div className={`mb-5 rounded-2xl border p-4 shadow-sm ${isSuspended ? 'border-red-200 bg-red-50 text-red-900' : 'border-slate-200 bg-slate-50 text-slate-900'}`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isSuspended ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}>
                  {isSuspended ? <ShieldAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold">{isSuspended ? 'Your merchant account is suspended' : 'This store has been deleted'}</h2>
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    {isSuspended
                      ? `Your storefront is offline and cannot be published now${store?.suspended_reason ? `: ${store.suspended_reason}` : '.'}`
                      : 'This storefront is offline and cannot be published again from the merchant dashboard.'}
                  </p>
                  <p className="mt-2 text-xs opacity-70">Contact BazarHQ support if you think this is a mistake.</p>
                </div>
              </div>
            </div>
          )}
          {showNoStoreDashboard ? <NoStoreDashboard user={user} navigate={navigate} /> : <Outlet />}
        </main>
      </div>
    </div>
  )
}

function WrappedMerchantLayout() {
  return <AuthGuard><MerchantLayout /></AuthGuard>
}

export default WrappedMerchantLayout
