// src/pages/shop-about.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { getStoreTheme, getThemeCssVars, themeDataAttributes } from "@/lib/theme-system";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  User,
} from "lucide-react";

function getSubdomain(routeSlug) {
  if (typeof routeSlug === "string" && routeSlug.trim()) return decodeURIComponent(routeSlug.trim()).toLowerCase();

  const host = window.location.hostname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const querySlug = params.get("store") || params.get("shop") || params.get("subdomain");

  if (querySlug?.trim()) return querySlug.trim().toLowerCase();

  if (host.endsWith(".localhost")) {
    const slug = host.replace(".localhost", "").split(".")[0];
    return slug || null;
  }

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return null;

  const reservedHosts = new Set(["www", "app", "admin", "superadmin", "dashboard", "bazarhq"]);
  const parts = host.split(".");

  if (parts.length >= 3 && !reservedHosts.has(parts[0])) return parts[0];
  return null;
}

function clampText(text, fallback = "") {
  if (typeof text !== "string") return fallback;
  return text.trim() || fallback;
}

function EmptyState({ title, message, backTo = "/", backLabel = "Go to marketplace" }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8 text-center dark:bg-slate-950">
      <div className="rounded-full bg-white p-5 text-slate-400 shadow-sm dark:bg-white/5">
        <Store className="h-10 w-10" />
      </div>
      <h1 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">{title}</h1>
      <p className="mt-2 max-w-md text-sm leading-7 text-slate-500">{message}</p>
      <Link to={backTo} className="mt-6 inline-flex rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-white/10 dark:text-slate-300">
        {backLabel}
      </Link>
    </div>
  );
}

export default function ShopAboutPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const { isLoggedIn } = useCustomerAuth();
  const routeSlug = params?.storeSlug || params?.shopSlug || params?.subdomain;
  const subdomain = useMemo(() => getSubdomain(routeSlug), [routeSlug]);
  const [store, setStore] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!subdomain) {
      setStatus("not-found");
      return;
    }

    async function loadStore() {
      setStatus("loading");
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("subdomain", subdomain)
        .maybeSingle();

      if (error || !data) {
        setStatus("not-found");
        return;
      }

      setStore(data);
      if (data.account_status === "suspended") { setStatus("suspended"); return; }
      if (data.account_status === "deleted") { setStatus("deleted"); return; }
      setStatus(data.storefront_published ? "ok" : "unpublished");
    }

    loadStore();
  }, [subdomain]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-16 animate-pulse rounded-3xl bg-white dark:bg-white/5" />
          <div className="h-96 animate-pulse rounded-[2rem] bg-white dark:bg-white/5" />
        </div>
      </div>
    );
  }

  if (status === "not-found") {
    return <EmptyState title="Shop not found" message="No shop was found for this shop URL. Open /shop/your-shop/about." />;
  }

  if (status === "suspended") {
    return <EmptyState title="Shop temporarily unavailable" message="This storefront is currently suspended and cannot accept customer visits." />;
  }

  if (status === "deleted") {
    return <EmptyState title="Shop unavailable" message="This storefront is no longer available." />;
  }

  if (status === "unpublished") {
    return <EmptyState title="Shop is currently unavailable" message="The merchant has temporarily unpublished this storefront. Please check again later." />;
  }

  const activeTheme = getStoreTheme(store);
  const shopVars = getThemeCssVars(store);
  const themeAttrs = themeDataAttributes(activeTheme);

  const shopName = clampText(store.shop_name, "BazarHQ Store");
  const tagline = clampText(store.tagline, "An online shop powered by BazarHQ.");
  const aboutTitle = clampText(store.about_title, `About ${shopName}`);
  const aboutImage = clampText(store.about_image_url) || store.banner_url || store.logo_url;
  const about = clampText(
    store.about_mission || store.about_text || store.description,
    "This merchant has created a modern online storefront with BazarHQ to sell products, manage orders, and serve customers with a smooth checkout experience."
  );
  const currentShopPath = subdomain ? `/shop/${encodeURIComponent(subdomain)}` : "/shop";
  const currentAboutPath = subdomain ? `/shop/${encodeURIComponent(subdomain)}/about` : "/shop/about";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white" style={shopVars} {...themeAttrs}>
      <style>{`
        [data-theme-font] { font-family: var(--shop-font-family); background: var(--shop-page-bg); }
        [data-theme-button] button, [data-theme-button] a { border-radius: var(--shop-button-radius) !important; }
        [data-theme-radius] .shop-about-card, [data-theme-radius] .shop-about-image { border-radius: var(--shop-card-radius) !important; }
        [data-theme-nav="dark"] header { background: rgba(2,6,23,.92) !important; color: white !important; border-color: rgba(255,255,255,.10) !important; }
      `}</style>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link to={currentShopPath} className="flex min-w-0 items-center gap-3">
            {store.logo_url ? (
              <img src={store.logo_url} alt={shopName} className="h-10 w-10 rounded-2xl object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--shop-primary)] text-sm font-black text-white">
                {shopName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate text-lg font-black tracking-tight">{shopName}</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-5 text-sm font-semibold text-slate-600 lg:flex dark:text-slate-300">
            <Link to={currentShopPath} className="hover:text-[var(--shop-primary)]">Shop</Link>
            <Link to={currentAboutPath} className="text-[var(--shop-primary)]">About</Link>
            <Link to="/track" search={{ store: subdomain }} className="hover:text-[var(--shop-primary)]">Track order</Link>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-[var(--shop-primary)] hover:text-[var(--shop-primary)] sm:inline-flex dark:border-white/10 dark:text-slate-300"
              onClick={() => navigate({
                to: isLoggedIn ? "/customer/account" : "/customer/login",
                search: isLoggedIn ? {} : { redirect: currentAboutPath },
              })}
              type="button"
            >
              <User className="mr-2 h-4 w-4" />
              {isLoggedIn ? "My account" : "Login"}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--shop-primary-soft)] via-white to-white dark:via-slate-950 dark:to-slate-950" />
          <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-[var(--shop-primary-ring)] blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
            <Link to={currentShopPath} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[var(--shop-primary)] dark:text-slate-300">
              <ArrowLeft className="h-4 w-4" /> Back to shop
            </Link>

            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div className="shop-about-card overflow-hidden rounded-[2rem] border border-white/70 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-white/5">
                <div className="shop-about-image relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-slate-100 dark:bg-slate-900">
                  {aboutImage ? (
                    <img src={aboutImage} alt={aboutTitle} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[var(--shop-primary)]">
                      <ShoppingBag className="h-20 w-20" />
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/70 sm:p-8">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--shop-primary-ring)] bg-[var(--shop-primary-soft)] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--shop-primary)]">
                  <Store className="h-4 w-4" /> About merchant
                </span>
                <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">{aboutTitle}</h1>
                <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">{shopName} — {tagline}</p>
                <p className="mt-6 whitespace-pre-line text-sm leading-8 text-slate-600 dark:text-slate-300">{about}</p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Button className="h-12 rounded-2xl bg-[var(--shop-primary)] text-white hover:opacity-90" onClick={() => navigate({ to: currentShopPath })}>
                    Browse products <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button className="h-12 rounded-2xl" variant="outline" onClick={() => navigate({ to: "/track", search: { store: subdomain } })}>
                    Track order
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950">
            <div className="mb-4 inline-flex rounded-2xl bg-[var(--shop-primary-soft)] p-3 text-[var(--shop-primary)]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-black">Clear checkout</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">Review product, price, and delivery details clearly before placing an order.</p>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950">
            <div className="mb-4 inline-flex rounded-2xl bg-[var(--shop-primary-soft)] p-3 text-[var(--shop-primary)]">
              <CreditCard className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-black">BD payment ready</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">Payment options enabled by this merchant are shown during checkout.</p>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950">
            <div className="mb-4 inline-flex rounded-2xl bg-[var(--shop-primary-soft)] p-3 text-[var(--shop-primary)]">
              <Truck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-black">Local delivery</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">Designed for Bangladesh-focused online selling and customer delivery workflows.</p>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-12 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950 sm:p-8">
            <h2 className="text-2xl font-black">Store information</h2>
            <div className="mt-6 grid gap-4 text-sm text-slate-600 dark:text-slate-300">
              {store.contact_email && (
                <a href={`mailto:${store.contact_email}`} className="flex items-center gap-3 transition hover:text-[var(--shop-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shop-primary-ring)]">
                  <Mail className="h-5 w-5 text-[var(--shop-primary)]" /> {store.contact_email}
                </a>
              )}
              {(store.contact_phone || store.phone) && (
                <a href={`tel:${String(store.contact_phone || store.phone).replace(/\s+/g, '')}`} className="flex items-center gap-3 transition hover:text-[var(--shop-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shop-primary-ring)]">
                  <Phone className="h-5 w-5 text-[var(--shop-primary)]" /> {store.contact_phone || store.phone}
                </a>
              )}
              {store.address && <p className="flex items-center gap-3"><MapPin className="h-5 w-5 text-[var(--shop-primary)]" /> {store.address}</p>}
              {!store.contact_email && !(store.contact_phone || store.phone) && !store.address && <p>Contact details will appear here after merchant setup.</p>}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950 sm:p-8">
            <h2 className="text-2xl font-black">Customer support</h2>
            <div className="mt-5 space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <p className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--shop-primary)]" /> Order status can be tracked from the tracking page.</p>
              <p className="flex gap-3"><PackageCheck className="mt-0.5 h-5 w-5 text-[var(--shop-primary)]" /> Product stock and checkout details are validated before order placement.</p>
            </div>
          </div>
        </section>

        {(store.return_policy || store.shipping_policy) && (
          <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-2">
              {store.return_policy && (
                <div id="return-policy" className="scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950 sm:p-8">
                  <h2 className="text-xl font-black">Return policy</h2>
                  <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300">{store.return_policy}</p>
                </div>
              )}
              {store.shipping_policy && (
                <div id="shipping-policy" className="scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950 sm:p-8">
                  <h2 className="text-xl font-black">Shipping policy</h2>
                  <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300">{store.shipping_policy}</p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs font-semibold text-slate-500 dark:border-white/10 dark:bg-slate-950">
        Powered by <strong>BazarHQ</strong>
      </footer>
    </div>
  );
}
