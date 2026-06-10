import { createRootRoute, createRoute, Outlet } from '@tanstack/react-router'

// Page imports
import Landing from './pages/index'
import Login from './pages/login'
import Signup from './pages/signup'
import ForgotPassword from './pages/forgot-password'
import ResetPassword from './pages/reset-password'
import Onboarding from './pages/onboarding'
import ShopPage from './pages/shop'
import CheckoutPage from './pages/checkout'
import TrackPage from './pages/track'

import MerchantLayout from './pages/merchant/layout'
import DashboardPage from './pages/merchant/index'
import ProductsPage from './pages/merchant/products'
import OrdersPage from './pages/merchant/orders'
import CustomersPage from './pages/merchant/customers'
import AnalyticsPage from './pages/merchant/analytics'
import ThemesPage from './pages/merchant/themes'
import PaymentsPage from './pages/merchant/payments'
import SettingsPage from './pages/merchant/settings'
import CreateStorePage from './pages/merchant/stores-new'

// Root
const rootRoute = createRootRoute({ component: Outlet })

// Public routes
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Landing })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: Login })
const signupRoute = createRoute({ getParentRoute: () => rootRoute, path: '/signup', component: Signup })
const forgotRoute = createRoute({ getParentRoute: () => rootRoute, path: '/forgot-password', component: ForgotPassword })
const resetRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reset-password', component: ResetPassword })
const onboardingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/onboarding', component: Onboarding })
const shopRoute = createRoute({ getParentRoute: () => rootRoute, path: '/shop', component: ShopPage })
const checkoutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/checkout', component: CheckoutPage })
const trackRoute = createRoute({ getParentRoute: () => rootRoute, path: '/track', component: TrackPage })

// Merchant layout + children
const merchantRoute = createRoute({ getParentRoute: () => rootRoute, path: '/merchant', component: MerchantLayout })
const merchantIndexRoute = createRoute({ getParentRoute: () => merchantRoute, path: '/', component: DashboardPage })
const productsRoute = createRoute({ getParentRoute: () => merchantRoute, path: '/products', component: ProductsPage })
const ordersRoute = createRoute({ getParentRoute: () => merchantRoute, path: '/orders', component: OrdersPage })
const customersRoute = createRoute({ getParentRoute: () => merchantRoute, path: '/customers', component: CustomersPage })
const analyticsRoute = createRoute({ getParentRoute: () => merchantRoute, path: '/analytics', component: AnalyticsPage })
const themesRoute = createRoute({ getParentRoute: () => merchantRoute, path: '/themes', component: ThemesPage })
const paymentsRoute = createRoute({ getParentRoute: () => merchantRoute, path: '/payments', component: PaymentsPage })
const settingsRoute = createRoute({ getParentRoute: () => merchantRoute, path: '/settings', component: SettingsPage })
const storesNewRoute = createRoute({ getParentRoute: () => merchantRoute, path: '/stores/new', component: CreateStorePage })

export const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  forgotRoute,
  resetRoute,
  onboardingRoute,
  shopRoute,
  checkoutRoute,
  trackRoute,
  merchantRoute.addChildren([
    merchantIndexRoute,
    productsRoute,
    ordersRoute,
    customersRoute,
    analyticsRoute,
    themesRoute,
    paymentsRoute,
    settingsRoute,
    storesNewRoute,
  ]),
])
