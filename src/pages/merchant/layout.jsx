import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { LayoutDashboard, Package, ShoppingCart, Users, BarChart3, Palette, CreditCard, Settings, ShoppingBag, Search, Bell, Menu, X, LogOut, Check } from 'lucide-react'
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
  { to: '/merchant', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/merchant/products', label: 'Products', icon: Package },
  { to: '/merchant/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/merchant/customers', label: 'Customers', icon: Users },
  { to: '/merchant/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/merchant/themes', label: 'Themes', icon: Palette },
  { to: '/merchant/payments', label: 'Payments', icon: CreditCard },
  { to: '/merchant/settings', label: 'Settings', icon: Settings },
]

function MerchantLayout() {
  const location = useLocation()
  const path = location.pathname
  const [open, setOpen] = useState(false)
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { store } = useCurrentStore()

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
            <Input placeholder="Search products, orders, customers…" className="pl-9" />
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            <span className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide sm:inline-flex ${store?.storefront_published ? 'border-success/30 bg-success/10 text-success' : 'border-border bg-muted text-muted-foreground'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${store?.storefront_published ? 'bg-success' : 'bg-muted-foreground'}`} />
              {store?.storefront_published ? 'Live' : 'Draft'}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
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
                <DropdownMenuItem onClick={() => navigate({ to: '/merchant/settings' })}><Settings className="mr-2 h-4 w-4" /> Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: '/' }) }}><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function WrappedMerchantLayout() {
  return <AuthGuard><MerchantLayout /></AuthGuard>
}

export default WrappedMerchantLayout
