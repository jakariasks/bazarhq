// src/pages/superadmin/layout.jsx  — REPLACE your existing superadmin/layout.jsx
// Added: System Health nav item + auto inactivity check
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import {
  LayoutDashboard, Users, BarChart3, Palette,
  Megaphone, FileText, ShieldAlert, LogOut,
  Menu, X, Shield, Activity,
} from "lucide-react";

const NAV = [
  { to: "/superadmin",               label: "Dashboard",     icon: LayoutDashboard, exact: true },
  { to: "/superadmin/merchants",     label: "Merchants",     icon: Users            },
  { to: "/superadmin/analytics",     label: "Analytics",     icon: BarChart3        },
  { to: "/superadmin/system-health", label: "System Health", icon: Activity         },
  { to: "/superadmin/themes",        label: "Themes",        icon: Palette          },
  { to: "/superadmin/announcements", label: "Announcements", icon: Megaphone        },
  { to: "/superadmin/content",       label: "Content",       icon: FileText         },
  { to: "/superadmin/audit-log",     label: "Audit Log",     icon: ShieldAlert      },
];

function AdminGuard({ children }) {
  const { isLoggedIn, loading } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isLoggedIn) navigate({ to: "/superadmin/login" });
  }, [loading, isLoggedIn, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }
  if (!isLoggedIn) return null;
  return children;
}

export default function SuperAdminLayout() {
  const { admin, logout, resetInactivityTimer } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Reset inactivity on every navigation
  useEffect(() => { resetInactivityTimer?.(); }, [location.pathname]);

  const isActive = (to, exact) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  async function handleLogout() {
    await logout();
    navigate({ to: "/superadmin/login" });
  }

  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-gray-950 text-gray-100">

        {/* Mobile overlay */}
        {open && (
          <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-gray-900 border-r border-gray-800 flex flex-col transform transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>

          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-bold text-sm text-white leading-tight">BazarHQ</p>
                <p className="text-[10px] text-violet-400 leading-tight">Super Admin</p>
              </div>
            </div>
            <button className="lg:hidden text-gray-400 hover:text-gray-200" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {NAV.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive(to, exact)
                    ? "bg-violet-600/20 text-violet-300 font-medium"
                    : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>

          {/* Admin info + logout */}
          <div className="border-t border-gray-800 p-4 shrink-0">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-full bg-violet-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {admin?.email?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate">{admin?.email}</p>
                <p className="text-[10px] text-gray-500 capitalize">
                  {admin?.role?.replace(/_/g, " ")}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header */}
          <header className="h-14 border-b border-gray-800 bg-gray-900/80 backdrop-blur flex items-center px-4 gap-3 lg:hidden sticky top-0 z-20">
            <button onClick={() => setOpen(true)} className="text-gray-400 hover:text-gray-200">
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-semibold text-sm text-white">BazarHQ Admin</span>
          </header>

          <main className="flex-1 p-5 lg:p-7 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminGuard>
  );
}
