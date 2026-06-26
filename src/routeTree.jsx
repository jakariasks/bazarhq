// src/routeTree.jsx — COMPLETE FILE (replace your existing routeTree.jsx)
import { createRootRoute, createRoute, Outlet } from "@tanstack/react-router";

// ── Public pages ─────────────────────────────────────────────────────────────
import LandingPage        from "@/pages/index";
import LoginPage          from "@/pages/login";
import SignupPage         from "@/pages/signup";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage  from "@/pages/reset-password";
import OnboardingPage     from "@/pages/onboarding";
import ShopPage           from "@/pages/shop";
import CheckoutPage       from "@/pages/checkout";
import TrackPage          from "@/pages/track";

// ── Merchant dashboard ────────────────────────────────────────────────────────
import MerchantLayout   from "@/pages/merchant/layout";
import DashboardPage    from "@/pages/merchant/index";
import ProductsPage     from "@/pages/merchant/products";
import OrdersPage       from "@/pages/merchant/orders";
import CustomersPage    from "@/pages/merchant/customers";
import AnalyticsPage    from "@/pages/merchant/analytics";
import ThemesPage       from "@/pages/merchant/themes";
import PaymentsPage     from "@/pages/merchant/payments";
import SettingsPage     from "@/pages/merchant/settings";
import NewStorePage     from "@/pages/merchant/stores-new";

// ── Customer account ──────────────────────────────────────────────────────────
import CustomerLoginPage   from "@/pages/customer-login";
import CustomerSignupPage  from "@/pages/customer-signup";
import CustomerAccountPage from "@/pages/customer-account";

// ── Super Admin ───────────────────────────────────────────────────────────────
import SuperAdminLogin    from "@/pages/superadmin/login";
import SuperAdminLayout   from "@/pages/superadmin/layout";
import SADashboard        from "@/pages/superadmin/dashboard";
import SAMerchants        from "@/pages/superadmin/merchants";
import SAAnalytics        from "@/pages/superadmin/analytics";
import SASystemHealth     from "@/pages/superadmin/system-health";
import SAThemes           from "@/pages/superadmin/themes";
import SAAnnouncements    from "@/pages/superadmin/announcements";
import SAContent          from "@/pages/superadmin/content";
import SAAuditLog         from "@/pages/superadmin/audit-log";

// ── Root ──────────────────────────────────────────────────────────────────────
const rootRoute = createRootRoute({ component: Outlet });

// ── Public routes ─────────────────────────────────────────────────────────────
const indexRoute          = createRoute({ getParentRoute: () => rootRoute, path: "/",                component: LandingPage        });
const loginRoute          = createRoute({ getParentRoute: () => rootRoute, path: "/login",           component: LoginPage          });
const signupRoute         = createRoute({ getParentRoute: () => rootRoute, path: "/signup",          component: SignupPage         });
const forgotRoute         = createRoute({ getParentRoute: () => rootRoute, path: "/forgot-password", component: ForgotPasswordPage });
const resetRoute          = createRoute({ getParentRoute: () => rootRoute, path: "/reset-password",  component: ResetPasswordPage  });
const onboardingRoute     = createRoute({ getParentRoute: () => rootRoute, path: "/onboarding",      component: OnboardingPage     });
const shopRoute           = createRoute({ getParentRoute: () => rootRoute, path: "/shop",            component: ShopPage           });
const checkoutRoute       = createRoute({ getParentRoute: () => rootRoute, path: "/checkout",        component: CheckoutPage       });
const trackRoute          = createRoute({ getParentRoute: () => rootRoute, path: "/track",           component: TrackPage          });

// ── Customer routes ───────────────────────────────────────────────────────────
const customerLoginRoute   = createRoute({ getParentRoute: () => rootRoute, path: "/customer/login",   component: CustomerLoginPage   });
const customerSignupRoute  = createRoute({ getParentRoute: () => rootRoute, path: "/customer/signup",  component: CustomerSignupPage  });
const customerAccountRoute = createRoute({ getParentRoute: () => rootRoute, path: "/customer/account", component: CustomerAccountPage });

// ── Merchant routes ───────────────────────────────────────────────────────────
const merchantRoute     = createRoute({ getParentRoute: () => rootRoute, path: "/merchant",             component: MerchantLayout });
const mDashboardRoute   = createRoute({ getParentRoute: () => merchantRoute, path: "/",                 component: DashboardPage  });
const mProductsRoute    = createRoute({ getParentRoute: () => merchantRoute, path: "/products",         component: ProductsPage   });
const mOrdersRoute      = createRoute({ getParentRoute: () => merchantRoute, path: "/orders",           component: OrdersPage     });
const mCustomersRoute   = createRoute({ getParentRoute: () => merchantRoute, path: "/customers",        component: CustomersPage  });
const mAnalyticsRoute   = createRoute({ getParentRoute: () => merchantRoute, path: "/analytics",        component: AnalyticsPage  });
const mThemesRoute      = createRoute({ getParentRoute: () => merchantRoute, path: "/themes",           component: ThemesPage     });
const mPaymentsRoute    = createRoute({ getParentRoute: () => merchantRoute, path: "/payments",         component: PaymentsPage   });
const mSettingsRoute    = createRoute({ getParentRoute: () => merchantRoute, path: "/settings",         component: SettingsPage   });
const mNewStoreRoute    = createRoute({ getParentRoute: () => merchantRoute, path: "/stores/new",       component: NewStorePage   });

// ── Super Admin routes ────────────────────────────────────────────────────────
const saLoginRoute      = createRoute({ getParentRoute: () => rootRoute,          path: "/superadmin/login",    component: SuperAdminLogin  });
const saLayoutRoute     = createRoute({ getParentRoute: () => rootRoute,          path: "/superadmin",          component: SuperAdminLayout });
const saDashboardRoute  = createRoute({ getParentRoute: () => saLayoutRoute,      path: "/",                    component: SADashboard      });
const saMerchantsRoute  = createRoute({ getParentRoute: () => saLayoutRoute,      path: "/merchants",           component: SAMerchants      });
const saAnalyticsRoute  = createRoute({ getParentRoute: () => saLayoutRoute,      path: "/analytics",           component: SAAnalytics      });
const saHealthRoute     = createRoute({ getParentRoute: () => saLayoutRoute,      path: "/system-health",       component: SASystemHealth   });
const saThemesRoute     = createRoute({ getParentRoute: () => saLayoutRoute,      path: "/themes",              component: SAThemes         });
const saAnnouncRoute    = createRoute({ getParentRoute: () => saLayoutRoute,      path: "/announcements",       component: SAAnnouncements  });
const saContentRoute    = createRoute({ getParentRoute: () => saLayoutRoute,      path: "/content",             component: SAContent        });
const saAuditRoute      = createRoute({ getParentRoute: () => saLayoutRoute,      path: "/audit-log",           component: SAAuditLog       });

// ── Route Tree ────────────────────────────────────────────────────────────────
export const routeTree = rootRoute.addChildren([
  // Public
  indexRoute,
  loginRoute,
  signupRoute,
  forgotRoute,
  resetRoute,
  onboardingRoute,
  shopRoute,
  checkoutRoute,
  trackRoute,

  // Customer
  customerLoginRoute,
  customerSignupRoute,
  customerAccountRoute,

  // Merchant dashboard
  merchantRoute.addChildren([
    mDashboardRoute,
    mProductsRoute,
    mOrdersRoute,
    mCustomersRoute,
    mAnalyticsRoute,
    mThemesRoute,
    mPaymentsRoute,
    mSettingsRoute,
    mNewStoreRoute,
  ]),

  // Super Admin
  saLoginRoute,
  saLayoutRoute.addChildren([
    saDashboardRoute,
    saMerchantsRoute,
    saAnalyticsRoute,
    saHealthRoute,
    saThemesRoute,
    saAnnouncRoute,
    saContentRoute,
    saAuditRoute,
  ]),
]);
