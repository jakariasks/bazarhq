// ══════════════════════════════════════════════════════════════════
// routeTree.jsx — ADD these Super Admin routes to your existing file
// ══════════════════════════════════════════════════════════════════
//
// STEP 1: Add these imports at the top (alongside your existing imports)
//
import SuperAdminLoginPage    from "@/pages/superadmin/login";
import SuperAdminLayout       from "@/pages/superadmin/layout";
import SuperAdminDashboard    from "@/pages/superadmin/dashboard";
import MerchantsPage          from "@/pages/superadmin/merchants";
import SAAnalyticsPage        from "@/pages/superadmin/analytics";
import ThemesPage             from "@/pages/superadmin/themes";
import AnnouncementsPage      from "@/pages/superadmin/announcements";
import ContentPage            from "@/pages/superadmin/content";
import AuditLogPage           from "@/pages/superadmin/audit-log";

// ──────────────────────────────────────────────────────────────────
// STEP 2: Create these routes (add after your existing route definitions)
// ──────────────────────────────────────────────────────────────────

// Super Admin login (public — no auth guard)
const superAdminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path:           "/superadmin/login",
  component:      SuperAdminLoginPage,
});

// Super Admin layout (auth guard is inside the layout component)
const superAdminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path:           "/superadmin",
  component:      SuperAdminLayout,
});

// Children of superAdminLayoutRoute
const superAdminDashboardRoute = createRoute({
  getParentRoute: () => superAdminLayoutRoute,
  path:           "/",
  component:      SuperAdminDashboard,
});

const superAdminMerchantsRoute = createRoute({
  getParentRoute: () => superAdminLayoutRoute,
  path:           "/merchants",
  component:      MerchantsPage,
});

const superAdminAnalyticsRoute = createRoute({
  getParentRoute: () => superAdminLayoutRoute,
  path:           "/analytics",
  component:      SAAnalyticsPage,
});

const superAdminThemesRoute = createRoute({
  getParentRoute: () => superAdminLayoutRoute,
  path:           "/themes",
  component:      ThemesPage,
});

const superAdminAnnouncementsRoute = createRoute({
  getParentRoute: () => superAdminLayoutRoute,
  path:           "/announcements",
  component:      AnnouncementsPage,
});

const superAdminContentRoute = createRoute({
  getParentRoute: () => superAdminLayoutRoute,
  path:           "/content",
  component:      ContentPage,
});

const superAdminAuditLogRoute = createRoute({
  getParentRoute: () => superAdminLayoutRoute,
  path:           "/audit-log",
  component:      AuditLogPage,
});

// ──────────────────────────────────────────────────────────────────
// STEP 3: Add to routeTree export (inside rootRoute.addChildren([...]))
// ──────────────────────────────────────────────────────────────────

export const routeTree = rootRoute.addChildren([
  // ... your existing routes (landing, login, signup, merchant, etc.) ...

  // ↓ ADD THESE
  superAdminLoginRoute,
  superAdminLayoutRoute.addChildren([
    superAdminDashboardRoute,
    superAdminMerchantsRoute,
    superAdminAnalyticsRoute,
    superAdminThemesRoute,
    superAdminAnnouncementsRoute,
    superAdminContentRoute,
    superAdminAuditLogRoute,
  ]),
]);

// ──────────────────────────────────────────────────────────────────
// STEP 4: Update main.jsx — wrap with AdminAuthProvider
// ──────────────────────────────────────────────────────────────────
//
// import { AdminAuthProvider } from "@/hooks/use-admin-auth";
//
// <QueryClientProvider client={queryClient}>
//   <AuthProvider>
//     <CustomerAuthProvider>
//       <AdminAuthProvider>          ← ADD THIS
//         <RouterProvider router={router} />
//       </AdminAuthProvider>
//       </CustomerAuthProvider>
//   </AuthProvider>
// </QueryClientProvider>
