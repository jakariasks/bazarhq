import { useEffect } from 'react'
import { Link, Outlet, useLocation } from '@tanstack/react-router'
import {
  Activity,
  BarChart3,
  Bell,
  FileText,
  Gauge,
  LogOut,
  Megaphone,
  Palette,
  Shield,
  Store,
  TerminalSquare,
  LockKeyhole,
  FileSpreadsheet,
} from 'lucide-react'
import { AdminGuard, useAdminAuth } from '@/hooks/use-admin-auth'

const navItems = [
  { href: '/superadmin', label: 'Dashboard', icon: Gauge },
  { href: '/superadmin/merchants', label: 'Merchants', icon: Store },
  { href: '/superadmin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/superadmin/reports', label: 'Reports', icon: FileSpreadsheet },
  { href: '/superadmin/system-health', label: 'System Health', icon: Activity },
  { href: '/superadmin/themes', label: 'Themes', icon: Palette },
  { href: '/superadmin/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/superadmin/content', label: 'Content & Policies', icon: FileText },
  { href: '/superadmin/audit-log', label: 'Audit Log', icon: TerminalSquare },
  { href: '/superadmin/security', label: 'Security', icon: LockKeyhole },
]

function isActivePath(pathname, href) {
  if (href === '/superadmin') {
    return pathname === '/superadmin' || pathname === '/superadmin/'
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function AdminShell() {
  const { admin, logout, refreshSession } = useAdminAuth()
  const location = useLocation()
  const pathname = location.pathname || '/superadmin'

  useEffect(() => {
    const onFocus = () => {
      // Verify quietly in the background. This does not replace the current page
      // with the AdminGuard loading screen.
      refreshSession?.()
    }

    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshSession])

  return (
    <div className="min-h-screen bg-[#070b16] text-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-white/10 bg-[#080d1b]/95 backdrop-blur-xl lg:block">
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-600 shadow-lg shadow-violet-950/40">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-black tracking-tight">BazarHQ</p>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">
              Super Admin
            </p>
          </div>
        </div>

        <nav className="space-y-1 px-4 py-5">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                to={item.href}
                preload="intent"
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? 'bg-violet-600/20 text-violet-100 ring-1 ring-violet-500/25'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-5">
          <div className="mb-4 rounded-2xl bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-violet-600 font-bold">
                {admin?.email?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{admin?.email || 'Admin'}</p>
                <p className="text-xs capitalize text-slate-400">
                  {admin?.role?.replaceAll('_', ' ') || 'Full access'}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070b16]/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-600">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="font-black">BazarHQ Admin</p>
                <p className="text-xs text-slate-400">Platform control center</p>
              </div>
            </div>

            <div className="hidden lg:block">
              <p className="text-sm font-medium text-slate-400">Platform control center</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200 sm:inline-flex">
                Production monitor
              </span>
              <button className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 hover:text-white">
                <Bell className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto px-4 pb-3 lg:hidden">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href)

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  preload="intent"
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'border-violet-500/40 bg-violet-600/20 text-violet-100'
                      : 'border-white/10 text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default function SuperAdminLayout() {
  return (
    <AdminGuard>
      <AdminShell />
    </AdminGuard>
  )
}