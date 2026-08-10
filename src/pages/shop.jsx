// src/pages/shop.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  addToCart,
  clearCart,
  getCartTotals,
  reconcileCartWithProducts,
  removeItem,
  updateQty,
} from "@/lib/cart";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { getStoreTheme, getThemeCssVars, themeDataAttributes } from "@/lib/theme-system";
import { getProductCommerceSummary } from "@/lib/product-variants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MarketplaceProductCard from "@/components/marketplace-product-card";
import { normalizeProductImages } from "@/components/product-image-gallery";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Filter,
  Minus,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Truck,
  User,
  X,
  Zap,
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

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function money(value, currency = "BDT") {
  const amount = toNumber(value).toLocaleString("en-BD", { maximumFractionDigits: 2 });
  return String(currency || "BDT").toUpperCase() === "BDT" ? `৳${amount}` : `${currency} ${amount}`;
}

function commercePriceLabel(product, currency = "BDT") {
  const commerce = getProductCommerceSummary(product);
  return `${commerce.hasPriceRange ? "From " : ""}${money(commerce.price, currency)}`;
}

function clampText(text, fallback = "") {
  if (typeof text !== "string") return fallback;
  return text.trim() || fallback;
}

function parseArrayValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fall back to comma-separated text.
  }

  return value.split(",");
}

function normalizeCategoryList(value) {
  return parseArrayValue(value)
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item?.name) return String(item.name).trim();
      if (item?.label) return String(item.label).trim();
      if (item?.title) return String(item.title).trim();
      return "";
    })
    .filter(Boolean);
}

function getImages(product) {
  return normalizeProductImages(product?.images, product?.image_url);
}

function getImage(product) {
  return getImages(product)[0] || null;
}

function getCartProduct(product) {
  return { ...product, images: getImages(product) };
}

function getTags(product) {
  const value = product?.tags;
  if (Array.isArray(value)) return value.map((tag) => String(tag?.name || tag?.label || tag).trim().toLowerCase()).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((tag) => String(tag?.name || tag?.label || tag).trim().toLowerCase()).filter(Boolean);
    } catch {
      // Fall through to comma-separated tags.
    }
    return value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

function getProductPrice(product) {
  return getProductCommerceSummary(product).price;
}

function getDiscount(product) {
  const price = getProductPrice(product);
  const compareAt = toNumber(product?.compare_at_price, 0);
  if (!price || compareAt <= price) return 0;
  return Math.round((1 - price / compareAt) * 100);
}

function getStock(product) {
  return getProductCommerceSummary(product).stock;
}

function isFeatured(product) {
  const tags = getTags(product);
  return Boolean(
    product?.is_featured ||
    product?.featured ||
    tags.includes("featured") ||
    tags.includes("hero") ||
    tags.includes("highlight")
  );
}

function hasVariants(product) {
  return getProductCommerceSummary(product).hasVariants;
}

function hexToRgb(hex) {
  if (typeof hex !== "string") return null;
  const cleaned = hex.replace("#", "").trim();
  if (![3, 6].includes(cleaned.length)) return null;
  const value = cleaned.length === 3
    ? cleaned.split("").map((char) => char + char).join("")
    : cleaned;
  const number = Number.parseInt(value, 16);
  if (Number.isNaN(number)) return null;
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

function rgba(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(79, 70, 229, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--shop-primary)]">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl dark:text-white">
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function ProductCard({ product, currency, storeId, storeSlug, shopName, onView, onCartChange, onOpenCart }) {
  const [adding, setAdding] = useState(false);
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState("");

  const commerce = getProductCommerceSummary(product);
  const outOfStock = !commerce.inStock;
  const requiresVariant = commerce.hasVariants;
  const normalizedProduct = {
    ...product,
    average_rating: product?.average_rating ?? product?.rating ?? 0,
    sold_quantity: product?.sold_quantity ?? product?.order_count ?? 0,
    shop_name: product?.shop_name || shopName || "This shop",
    store_slug: product?.store_slug || product?.subdomain || storeSlug,
  };

  async function handleAddToCart() {
    setError("");

    if (requiresVariant) {
      onView(product);
      return;
    }

    setAdding(true);
    const result = addToCart(storeId, getCartProduct(product));
    setAdding(false);

    if (!result.success) {
      setFlash(false);
      setError(result.message || "Could not add this product to the cart.");
      return;
    }

    setFlash(true);
    onCartChange?.();
    onOpenCart?.();
    window.setTimeout(() => setFlash(false), 1200);
  }

  return (
    <MarketplaceProductCard
      product={normalizedProduct}
      currency={currency}
      storeSlug={storeSlug}
      shopName={shopName}
      onAddToCart={handleAddToCart}
      addToCartLabel={
        outOfStock
          ? "Out of stock"
          : flash
            ? "Added to cart"
            : adding
              ? "Adding..."
              : "Add to cart"
      }
      addToCartDisabled={outOfStock || adding}
      statusMessage={error}
      statusTone={error ? "error" : "neutral"}
      showViewDetails={false}
      themeAware
      className="shop-storefront-product-card"
    />
  );
}

function ProductRail({ title, products, currency, storeId, storeSlug, shopName, onView, onCartChange, onOpenCart, curated = true }) {
  if (!products.length) return null;

  return (
    <section className="shop-scroll-reveal space-y-5">
      <SectionHeader
        eyebrow={curated ? "Curated collection" : "Recently added"}
        title={title}
        description={curated ? "Products highlighted by this store for easier discovery." : "Fresh additions from this store, ordered by the latest published items."}
      />
      <div className="shop-featured-grid grid gap-4">
        {products.map((product, index) => (
          <div key={`${title}-${product.id}`} className="shop-animate" style={{ animationDelay: `${index * 70}ms` }}>
            <ProductCard
              product={product}
              currency={currency}
              storeId={storeId}
              storeSlug={storeSlug}
              shopName={shopName}
              onView={onView}
              onCartChange={onCartChange}
              onOpenCart={onOpenCart}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function HeroSlider({ slides, activeSlide, setActiveSlide, shopName, className = "" }) {
  const safeSlides = slides.length
    ? slides
    : [{ image: null, title: shopName, eyebrow: "Store highlights", subtitle: "Shop with confidence" }];
  const activeIndex = activeSlide % safeSlides.length;

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#eef2ff_0%,#f8fafc_42%,#e0e7ff_100%)] dark:bg-[linear-gradient(135deg,#020617_0%,#111827_48%,#020617_100%)]" />

      {safeSlides.map((slide, index) => (
        <div
          key={`${slide.image || "slide"}-${index}`}
          className={`absolute inset-0 transition-all duration-[1100ms] ease-out ${activeIndex === index ? "opacity-100 scale-100" : "opacity-0 scale-[1.015]"}`}
        >
          {slide.image ? (
            <img
              src={slide.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-100 transition duration-[1100ms] ease-out"
              onError={(event) => { event.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-end pr-20 text-[var(--shop-primary)] opacity-20">
              <ShoppingBag className="h-40 w-40" />
            </div>
          )}
        </div>
      ))}

      {/* Left-side readability layer only: keeps text clear while the right-side banner stays visible. */}
      <div className="absolute inset-y-0 left-0 w-[58%] bg-[linear-gradient(90deg,rgba(248,250,252,.98)_0%,rgba(248,250,252,.92)_44%,rgba(248,250,252,.52)_74%,transparent_100%)] backdrop-blur-[2px] dark:bg-[linear-gradient(90deg,rgba(2,6,23,.92)_0%,rgba(15,23,42,.78)_48%,rgba(15,23,42,.38)_78%,transparent_100%)]" />
      <div className="absolute inset-y-0 left-0 w-[48%] bg-[radial-gradient(circle_at_22%_28%,var(--shop-primary-soft),transparent_44%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/45 via-transparent to-transparent dark:from-slate-950/40" />

      {safeSlides.length > 1 && (
        <div className="absolute bottom-8 right-8 z-30 flex gap-2 rounded-full bg-slate-950/25 p-1.5 backdrop-blur-xl dark:bg-white/10">
          {safeSlides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Show banner ${index + 1}`}
              aria-current={activeIndex === index ? "true" : undefined}
              onClick={() => setActiveSlide(index)}
              className={`h-2.5 rounded-full transition-all duration-300 ${activeIndex === index ? "w-9 bg-white shadow-sm" : "w-2.5 bg-white/55 hover:bg-white/90"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OfferSection({ store, product, currency, onView }) {
  if (store?.offer_enabled === false) return null;

  const hasCustomOffer = Boolean(
    clampText(store?.offer_title) ||
    clampText(store?.offer_subtitle) ||
    clampText(store?.offer_image_url)
  );

  if (!product && !hasCustomOffer) return null;

  const discount = product ? getDiscount(product) : 0;
  const image = clampText(store?.offer_image_url) || (product ? getImage(product) : null);
  const title = clampText(store?.offer_title, product ? "Special deal for smart shoppers" : `Special offer from ${clampText(store?.shop_name, "this store")}`);
  const subtitle = clampText(
    store?.offer_subtitle,
    product
      ? "Compare the current price and stock, then open the product details before adding it to your cart."
      : "Explore current offers, featured picks, and customer-friendly checkout from this merchant."
  );
  const badge = clampText(store?.offer_badge, product && discount > 0 ? `${discount}% off` : "Store offer");
  const buttonText = clampText(store?.offer_button_text, product ? "View product" : "Shop products");
  const offerLayoutClass = image ? "lg:grid-cols-[1.4fr_.6fr]" : "";

  function handleAction() {
    if (product) onView(product);
    else document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section id="offers" className="shop-scroll-reveal w-full overflow-hidden rounded-[1.5rem] border border-white/60 bg-slate-950 text-white shadow-xl transition duration-500 hover:-translate-y-0.5 hover:shadow-2xl dark:border-white/10">
      <div className={`grid gap-4 p-4 sm:p-5 lg:items-center ${offerLayoutClass}`}>
        <div className="space-y-3.5">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/80">
            <Zap className="h-3.5 w-3.5 text-amber-300" /> {badge}
          </span>
          <div>
            <h2 className="text-xl font-black tracking-tight sm:text-2xl">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {discount > 0 && <span className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-black">Save {discount}%</span>}
            {product && <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">{commercePriceLabel(product, currency)}</span>}
          </div>
          <Button className="h-9 rounded-xl bg-white px-4 text-sm text-slate-950 transition hover:-translate-y-0.5 hover:bg-white/90" onClick={handleAction}>
            {buttonText} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {image && (
          <div className="relative h-[132px] overflow-hidden rounded-[1.1rem] border border-white/10 bg-white/10 sm:h-[144px] lg:h-[132px]">
            <img src={image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-xl" />
            <img src={image} alt={title} className="relative z-10 h-full w-full object-contain p-3" />
          </div>
        )}
      </div>
    </section>
  );
}

function CartDrawer({ open, store, products, subdomain, currency, onClose, onCartChange }) {
  const navigate = useNavigate();
  const [cart, setCart] = useState(() => getCartTotals(store?.id));
  const [cartNotice, setCartNotice] = useState("");

  const refresh = useCallback(() => {
    if (!store?.id) return;
    setCart(getCartTotals(store.id));
    onCartChange?.();
  }, [store?.id, onCartChange]);

  useEffect(() => {
    if (!open || !store?.id) return;
    const reconciliation = reconcileCartWithProducts(store.id, products || []);
    const changes = [...(reconciliation?.priceChanges || []), ...(reconciliation?.stockChanges || [])];
    setCartNotice(changes.length ? "Your cart was refreshed with the latest product price and stock." : "");
    refresh();
  }, [open, products, refresh, store?.id]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const deliveryHints = [
    store?.delivery_charge_dhaka != null ? `Dhaka ${money(store.delivery_charge_dhaka, currency)}` : null,
    store?.delivery_charge_outside != null ? `Outside Dhaka ${money(store.delivery_charge_outside, currency)}` : null,
    toNumber(store?.free_delivery_min_amount, 0) > 0 ? `Free delivery from ${money(store.free_delivery_min_amount, currency)}` : null,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="shop-drawer-enter ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-white/10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--shop-primary)]">Shopping cart</p>
            <h2 className="text-xl font-black text-slate-950 dark:text-white">Your selected items</h2>
          </div>
          <div className="flex items-center gap-2">
            {cart.itemCount > 0 && (
              <button
                type="button"
                className="rounded-full px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                onClick={() => { clearCart(store.id); setCartNotice("Cart cleared."); refresh(); }}
              >
                Clear
              </button>
            )}
            <button type="button" className="rounded-full border border-slate-200 p-2 transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10" onClick={onClose} aria-label="Close cart">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {cartNotice && (
            <p className="mb-4 rounded-xl border border-[var(--shop-primary-ring)] bg-[var(--shop-primary-soft)] px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200">
              {cartNotice}
            </p>
          )}
          {cart.items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 rounded-full bg-[var(--shop-primary-soft)] p-5 text-[var(--shop-primary)]">
                <ShoppingBag className="h-10 w-10" />
              </div>
              <h3 className="text-lg font-black text-slate-950 dark:text-white">Your cart is empty</h3>
              <p className="mt-2 max-w-xs text-sm text-slate-500">Add products to your cart and checkout when you are ready.</p>
              <Button className="mt-5 rounded-xl" variant="outline" onClick={onClose}>Continue shopping</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.items.map((item) => (
                <div key={item.key} className="flex gap-3 rounded-2xl border border-slate-200 p-3 transition hover:border-[var(--shop-primary-ring)] hover:shadow-md dark:border-white/10">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5">
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300"><Package className="h-7 w-7" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="line-clamp-2 text-sm font-black text-slate-950 dark:text-white">{item.title}</p>
                        {item.variantLabel && <p className="mt-1 text-xs text-slate-500">{item.variantLabel}</p>}
                      </div>
                      <button type="button" className="text-slate-400 transition hover:text-rose-500" onClick={() => { removeItem(store.id, item.key); refresh(); }}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="font-black text-[var(--shop-primary)]">{money(item.price, currency)}</p>
                      <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                        <button type="button" aria-label={`Decrease quantity of ${item.title}`} className="px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => { updateQty(store.id, item.key, item.qty - 1); refresh(); }}>-</button>
                        <span className="min-w-8 text-center text-xs font-black">{item.qty}</span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${item.title}`}
                          disabled={item.qty >= item.stock}
                          className="px-2 py-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-white/10"
                          onClick={() => { updateQty(store.id, item.key, item.qty + 1); refresh(); }}
                        >+</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-5 dark:border-white/10">
          <div className="mb-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-500"><span>Items</span><span>{cart.itemCount}</span></div>
            <div className="flex justify-between text-lg font-black text-slate-950 dark:text-white"><span>Products subtotal</span><span>{money(cart.subtotal, currency)}</span></div>
            <p className="text-xs font-semibold text-slate-400">Delivery charge is calculated at checkout from the destination and current store rules.</p>
            {deliveryHints.length > 0 && (
              <p className="text-[11px] font-bold leading-5 text-slate-500">{deliveryHints.join(" • ")}</p>
            )}
          </div>
          <Button
            disabled={cart.itemCount === 0}
            className="h-12 w-full rounded-2xl bg-[var(--shop-primary)] text-white transition hover:-translate-y-0.5 hover:opacity-90"
            onClick={() => navigate({ to: "/checkout", search: { store: subdomain } })}
          >
            Checkout now <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" className="mt-2 w-full" onClick={onClose}>Continue shopping</Button>
        </div>
      </aside>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-16 animate-pulse rounded-3xl bg-white dark:bg-white/5" />
        <div className="h-72 animate-pulse rounded-[2rem] bg-white dark:bg-white/5" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-80 animate-pulse rounded-3xl bg-white dark:bg-white/5" />)}
        </div>
      </div>
    </div>
  );
}

function EmptyShopState({ title, message, icon: Icon = ShoppingBag }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8 text-center dark:bg-slate-950">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm dark:border-white/10 dark:bg-white/5">
        <Icon className="h-8 w-8" />
      </div>
      <h1 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">{title}</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">{message}</p>
    </div>
  );
}

export default function ShopPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const { isLoggedIn } = useCustomerAuth();
  const routeSlug = params?.storeSlug || params?.shopSlug || params?.subdomain;
  const subdomain = useMemo(() => getSubdomain(routeSlug), [routeSlug]);
  const currentShopPath = subdomain ? `/shop/${encodeURIComponent(subdomain)}` : "/shop";
  const aboutPath = subdomain ? `/shop/${encodeURIComponent(subdomain)}/about` : "/shop/about";

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [cartCount, setCartCount] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [discountOnly, setDiscountOnly] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (!subdomain) {
      setStatus("not-found");
      return;
    }

    async function loadStorefront() {
      setStatus("loading");

      const { data: storeData, error: storeError } = await supabase
        .from("stores")
        .select("*")
        .eq("subdomain", subdomain)
        .maybeSingle();

      if (storeError || !storeData) {
        setStatus("not-found");
        return;
      }

      const accountStatus = storeData.account_status || "active";

      if (accountStatus === "suspended") {
        setStore(storeData);
        setStatus("suspended");
        return;
      }

      if (accountStatus === "deleted") {
        setStore(storeData);
        setStatus("deleted");
        return;
      }

      if (!storeData.storefront_published) {
        setStore(storeData);
        setStatus("unpublished");
        return;
      }

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", storeData.id)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (productError) {
        console.error("Product load failed:", productError.message);
        setStore(storeData);
        setProducts([]);
        setStatus("catalog-error");
        return;
      }

      const freshProducts = productData || [];
      setStore(storeData);
      setProducts(freshProducts);
      reconcileCartWithProducts(storeData.id, freshProducts);
      setCartCount(getCartTotals(storeData.id).itemCount);
      setStatus("ok");
    }

    loadStorefront();
  }, [subdomain]);


  useEffect(() => {
    if (status !== "ok" || !store?.id || !subdomain) return;
    import("@/lib/analytics-tracker").then(({ trackStoreEvent }) => {
      trackStoreEvent({ storeSlug: subdomain, storeId: store.id, eventType: "page_view", path: window.location.pathname });
    });
  }, [status, store?.id, subdomain]);

  useEffect(() => {
    if (status !== "ok" || !store?.id || category === "all") return;
    import("@/lib/analytics-tracker").then(({ trackCategoryView }) => {
      trackCategoryView(store.id, category, { store_slug: subdomain, path: window.location.pathname });
    });
  }, [status, store?.id, subdomain, category]);

  const refreshCartCount = useCallback(() => {
    if (!store?.id) return;
    const { itemCount } = getCartTotals(store.id);
    setCartCount(itemCount);
  }, [store?.id]);

  useEffect(() => {
    refreshCartCount();
  }, [refreshCartCount]);

  const currency = store?.currency || "BDT";
  const activeTheme = getStoreTheme(store);
  const shopVars = getThemeCssVars(store);
  const themeAttrs = themeDataAttributes(activeTheme);

  const categories = useMemo(() => {
    const categoryMap = new Map();
    const ensureCategory = (rawName) => {
      const name = clampText(rawName, "General");
      const key = name.toLocaleLowerCase();
      if (!categoryMap.has(key)) categoryMap.set(key, { key, name, count: 0 });
      return categoryMap.get(key);
    };

    normalizeCategoryList(store?.categories).forEach((name) => ensureCategory(name));
    products.forEach((product) => {
      const entry = ensureCategory(product.category);
      entry.count += 1;
    });

    return [
      { name: "all", key: "all", count: products.length },
      ...Array.from(categoryMap.values()).filter((item) => item.count > 0),
    ];
  }, [store?.categories, products]);

  useEffect(() => {
    if (category === "all") return;
    const categoryStillAvailable = categories.some(
      (item) => item.name.toLocaleLowerCase() === category.toLocaleLowerCase(),
    );
    if (!categoryStillAvailable) setCategory("all");
  }, [categories, category]);

  const collections = useMemo(() => {
    const byNewest = [...products].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const featured = products.filter(isFeatured);
    const byDiscount = [...products].sort((a, b) => getDiscount(b) - getDiscount(a));

    return {
      featured: (featured.length ? featured : byNewest).slice(0, 6),
      hasExplicitFeatured: featured.length > 0,
      deal: byDiscount.find((product) => getDiscount(product) > 0) || null,
    };
  }, [products]);

  const showProductRail = collections.hasExplicitFeatured || products.length > 6;
  const productRailLabel = collections.hasExplicitFeatured ? "Featured" : "New arrivals";

  const hasOfferSection = store?.offer_enabled !== false && Boolean(
    collections.deal || clampText(store?.offer_title) || clampText(store?.offer_subtitle) || clampText(store?.offer_image_url)
  );

  const heroSlides = useMemo(() => {
    const rawImages = [];
    const pushImage = (image) => {
      if (typeof image === "string" && image.trim()) rawImages.push(image.trim());
    };

    pushImage(store?.banner_url);
    [store?.hero_banner_urls, store?.banner_images, store?.banner_urls, store?.hero_images].forEach((value) => {
      parseArrayValue(value).forEach(pushImage);
    });
    products.forEach((product) => pushImage(getImage(product)));

    const uniqueImages = Array.from(new Set(rawImages)).slice(0, 4);
    while (uniqueImages.length > 0 && uniqueImages.length < 2) uniqueImages.push(uniqueImages[0]);

    const heroTitle = clampText(store?.hero_title, "Browse this store with confidence");
    const heroSubtitle = clampText(store?.hero_subtitle || store?.tagline, "Explore products, check current stock, and review checkout details before ordering.");

    if (uniqueImages.length === 0) {
      return [
        { image: null, eyebrow: "Online store", title: heroTitle, subtitle: heroSubtitle },
        { image: null, eyebrow: "Store highlights", title: "Shop confidently from this merchant", subtitle: "Browse the collection and add your favorites to cart." },
      ];
    }

    return uniqueImages.map((image, index) => ({
      image,
      eyebrow: index === 0 ? "Online store" : index === 1 ? "Featured collection" : index === 2 ? "Special offer" : "Store highlights",
      title: index === 0 ? heroTitle : index === 1 ? "Discover this store's featured picks" : index === 2 ? "Offers made for smart shoppers" : "Shop with confidence",
      subtitle: index === 0 ? heroSubtitle : "Compare products, check stock, and checkout safely from this storefront.",
    }));
  }, [store, products]);

  useEffect(() => {
    if (heroSlides.length <= 1 || typeof window === "undefined") return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      setActiveSlide((value) => (value + 1) % heroSlides.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  const filtered = useMemo(() => {
    let list = [...products];

    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter((product) => (
        String(product.title || product.name || "").toLowerCase().includes(query) ||
        String(product.description || "").toLowerCase().includes(query) ||
        String(product.category || "").toLowerCase().includes(query) ||
        getTags(product).some((tag) => tag.includes(query))
      ));
    }

    if (category !== "all") list = list.filter((product) => clampText(product.category, "General").toLocaleLowerCase() === category.toLocaleLowerCase());
    if (priceMin !== "") list = list.filter((product) => getProductPrice(product) >= Number(priceMin));
    if (priceMax !== "") list = list.filter((product) => getProductPrice(product) <= Number(priceMax));
    if (inStockOnly) list = list.filter((product) => getStock(product) > 0);
    if (discountOnly) list = list.filter((product) => getDiscount(product) > 0);

    switch (sort) {
      case "price-asc":
        list.sort((a, b) => getProductPrice(a) - getProductPrice(b));
        break;
      case "price-desc":
        list.sort((a, b) => getProductPrice(b) - getProductPrice(a));
        break;
      case "discount":
        list.sort((a, b) => getDiscount(b) - getDiscount(a));
        break;
      case "rating":
        list.sort((a, b) => toNumber(b.average_rating) - toNumber(a.average_rating) || toNumber(b.rating_count) - toNumber(a.rating_count));
        break;
      case "name":
        list.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
        break;
      case "newest":
      default:
        list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    return list;
  }, [products, search, category, sort, priceMin, priceMax, inStockOnly, discountOnly]);

  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return undefined;

    const elements = Array.from(document.querySelectorAll(".shop-scroll-reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -60px 0px" }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [status, filtered.length, products.length, category, search, sort, priceMin, priceMax, inStockOnly, discountOnly]);


  const openProductDetails = useCallback((product) => {
    if (!product || !subdomain) return;
    navigate({
      to: "/shop/$storeSlug/product/$productId",
      params: { storeSlug: subdomain, productId: String(product.slug || product.id) },
    });
  }, [navigate, subdomain]);

  function clearFilters() {
    setSearch("");
    setCategory("all");
    setSort("newest");
    setPriceMin("");
    setPriceMax("");
    setInStockOnly(false);
    setDiscountOnly(false);
  }

  if (status === "loading") return <LoadingState />;

  if (status === "not-found") {
    return (
      <EmptyShopState
        title="Shop not found"
        message="No shop was found for this shop URL. Open a URL like /shop/your-shop."
        icon={Search}
      />
    );
  }

  if (status === "catalog-error") {
    return (
      <EmptyShopState
        title="Products could not be loaded"
        message="The shop is online, but its product catalog could not be loaded right now. Please refresh and try again."
        icon={AlertTriangle}
      />
    );
  }

  if (status === "unpublished") {
    return (
      <EmptyShopState
        title="Shop is currently unavailable"
        message="The merchant has temporarily unpublished this storefront. Please check again later."
        icon={AlertTriangle}
      />
    );
  }

  if (status === "suspended") {
    return (
      <EmptyShopState
        title="This shop is suspended"
        message="This storefront is temporarily offline because the merchant account was suspended by BazarHQ. Please contact the merchant or BazarHQ support for details."
        icon={AlertTriangle}
      />
    );
  }

  if (status === "deleted") {
    return (
      <EmptyShopState
        title="This shop is no longer available"
        message="This storefront has been removed from BazarHQ."
        icon={Package}
      />
    );
  }

  const shopName = clampText(store.shop_name, "BazarHQ Store");
  const tagline = clampText(store.tagline, "Discover products from this BazarHQ storefront.");
  const about = clampText(store.about_text || store.description, "An online store powered by BazarHQ for product discovery, cart, checkout, and order tracking.");
  const heroVisible = store.show_hero !== false;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white" style={shopVars} {...themeAttrs}>
      <style>{`
        @keyframes shopFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shopDrawerIn {
          from { opacity: 0; transform: translateX(28px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes shopModalIn {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shopFloatSoft {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes shopShine {
          from { transform: translateX(-120%) rotate(10deg); }
          to { transform: translateX(140%) rotate(10deg); }
        }
        .shop-animate { animation: shopFadeUp 0.62s ease both; }
        .shop-drawer-enter { animation: shopDrawerIn 0.32s ease both; }
        .shop-modal-enter { animation: shopModalIn 0.25s ease both; }
        .shop-scroll-reveal { opacity: 0; transform: translateY(26px); transition: opacity 0.7s ease, transform 0.7s ease; }
        .shop-scroll-reveal.is-visible { opacity: 1; transform: translateY(0); }
        .shop-hover-lift { transition: transform 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease; }
        .shop-hover-lift:hover { transform: translateY(-6px); box-shadow: 0 22px 55px rgba(15, 23, 42, 0.12); }
        .shop-hero-copy { isolation: isolate; }
        .shop-hero-visual { filter: drop-shadow(0 28px 80px rgba(15,23,42,.13)); }
        .shop-float-soft { animation: shopFloatSoft 6s ease-in-out infinite; }
        [data-theme-font] { font-family: var(--shop-font-family); background: var(--shop-page-bg); }

       [data-theme-button] button,
[data-theme-button] .shop-theme-button {
  border-radius: var(--shop-button-radius) !important;
}
        [data-theme-radius] .shop-hover-lift, [data-theme-radius] .shop-themed-card, [data-theme-radius] .shop-hero-copy, [data-theme-radius] .shop-hero-visual, [data-theme-radius] .shop-product-surface { border-radius: var(--shop-card-radius) !important; }
        [data-theme-card="flat"] .shop-hover-lift { box-shadow: none !important; border-color: rgba(148,163,184,.28) !important; }
        [data-theme-card="bordered"] .shop-hover-lift { box-shadow: none !important; border-width: 1.5px !important; }
        [data-theme-card="shadow"] .shop-hover-lift { box-shadow: 0 18px 50px rgba(15,23,42,.13) !important; }
        [data-theme-card="glass"] .shop-hover-lift { background: rgba(255,255,255,.72) !important; backdrop-filter: blur(18px); }
        [data-theme-nav="dark"] header { background: rgba(2,6,23,.92) !important; color: white !important; border-color: rgba(255,255,255,.10) !important; }
        [data-theme-nav="dark"] header a, [data-theme-nav="dark"] header button, [data-theme-nav="dark"] header span { color: inherit; }
        [data-theme-nav="minimal"] header { background: transparent !important; border-color: transparent !important; }
        [data-theme-bg="dark"] { color: white; }
        [data-theme-bg="dark"] main, [data-theme-bg="dark"] section, [data-theme-bg="dark"] footer { color: white; }
        [data-theme-bg="dark"] .shop-filter-panel, [data-theme-bg="dark"] .shop-product-surface, [data-theme-bg="dark"] .shop-themed-card { background: rgba(15,23,42,.88) !important; border-color: rgba(255,255,255,.10) !important; }
        [data-theme-hero="centered"] .shop-hero-grid { display: block !important; max-width: 980px; }
        [data-theme-hero="centered"] .shop-hero-grid > * { margin-inline: auto; }
        [data-theme-hero="centered"] .shop-hero-copy { text-align: center; align-items: center; }
        
        [data-theme-hero="compact"] .shop-hero-grid { padding-top: 1.5rem !important; padding-bottom: 1.5rem !important; }
        [data-theme-hero="compact"] .shop-hero-copy, [data-theme-hero="compact"] .shop-hero-slider { min-height: 260px !important; }
        [data-theme-hero="editorial"] .shop-hero-grid { grid-template-columns: minmax(0, 1.15fr) minmax(260px, .85fr) !important; }
        [data-theme-hero="editorial"] .shop-hero-copy { color: white !important; }
        [data-theme-layout="marketplace"] .shop-main-inner { max-width: 92rem !important; }

        .shop-page-shell {
          width: 100%;
          max-width: 92rem;
          margin-inline: auto;
          padding-inline: clamp(1.25rem, 3vw, 2.75rem);
        }
        [data-theme-width="narrow"] .shop-page-shell { max-width: 76rem; }
        [data-theme-width="standard"] .shop-page-shell { max-width: 88rem; }
        [data-theme-width="wide"] .shop-page-shell { max-width: 92rem; }
        [data-theme-width="full"] .shop-page-shell { max-width: 96rem; }
        .shop-main {
          width: 100% !important;
          max-width: none !important;
        }
        .shop-main-inner {
          width: 100%;
          margin-inline: auto;
          align-items: stretch;
        }
        [data-theme-width="narrow"] .shop-main-inner.shop-page-shell { max-width: 76rem !important; }
        [data-theme-width="standard"] .shop-main-inner.shop-page-shell { max-width: 88rem !important; }
        [data-theme-width="wide"] .shop-main-inner.shop-page-shell { max-width: 92rem !important; }
        [data-theme-width="full"] .shop-main-inner.shop-page-shell { max-width: 96rem !important; }

        /* Explicit storefront polish rules. These are intentionally placed after
           theme rules so the merchant-selected theme cannot revert the updated
           hero size or marketplace-style grid. */
        .shop-hero-shell {
          width: 100% !important;
          max-width: none !important;
          min-height: 420px !important;
          margin: 0 !important;
          border-radius: 0 !important;
          border-inline: 0 !important;
        }
        .shop-hero-inner { min-height: 420px !important; }
        .shop-featured-grid,
        .shop-product-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .shop-product-grid .shop-themed-card,
        .shop-featured-grid .shop-themed-card { min-width: 0; }
        @media (min-width: 768px) {
          .shop-featured-grid,
          .shop-product-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (min-width: 1024px) {
          .shop-featured-grid,
          .shop-product-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
        }
        @media (min-width: 1280px) {
          .shop-featured-grid,
          .shop-product-grid { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; }
        }
        @media (min-width: 1536px) {
          .shop-featured-grid,
          .shop-product-grid { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 767px) {
          .shop-hero-shell {
            width: 100% !important;
            min-height: 390px !important;
            margin: 0 !important;
            border-radius: 0 !important;
          }
          .shop-hero-inner {
            min-height: 390px !important;
            padding-top: 2.25rem !important;
            padding-bottom: 2.25rem !important;
          }
        }
        .shop-storefront-product-card {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
        }
        .shop-storefront-product-card img { transform-origin: center; }
        .shop-category-strip { scrollbar-width: thin; scrollbar-color: var(--shop-primary) transparent; }
        .shop-inline-filter select,
        .shop-inline-filter input { min-width: 0; }

        /* Smooth the visual transition between the full-width hero and the
           product collection. This section is intentionally theme-aware so it
           does not appear as a separate hard-white block. */
        .shop-discovery-section {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 12% 0%, var(--shop-primary-soft), transparent 34%),
            linear-gradient(
              180deg,
              rgba(255,255,255,.98) 0%,
              rgba(248,250,252,.94) 46%,
              var(--shop-page-bg) 100%
            ) !important;
          border-color: rgba(148,163,184,.22) !important;
        }
        .shop-discovery-section::after {
          content: "";
          position: absolute;
          inset: auto 0 0;
          height: 44px;
          pointer-events: none;
          background: linear-gradient(180deg, transparent, var(--shop-page-bg));
        }
        .shop-discovery-inner {
          position: relative;
          z-index: 1;
          padding-top: .85rem;
          padding-bottom: 1rem;
        }
        .shop-category-strip {
          padding: .15rem 0 .35rem;
        }
        .shop-search-surface {
          border-radius: 1.15rem;
          background: rgba(255,255,255,.82);
          box-shadow: 0 10px 30px rgba(15,23,42,.05);
          backdrop-filter: blur(14px);
        }
        .shop-search-surface input {
          background: transparent !important;
          border-color: rgba(148,163,184,.24) !important;
        }
        .shop-inline-filter {
          background: rgba(255,255,255,.66) !important;
          border-color: rgba(148,163,184,.22) !important;
          box-shadow: 0 10px 28px rgba(15,23,42,.04);
          backdrop-filter: blur(14px);
        }
        [data-theme-bg="dark"] .shop-discovery-section {
          background:
            radial-gradient(circle at 12% 0%, var(--shop-primary-soft), transparent 34%),
            linear-gradient(180deg, rgba(15,23,42,.98), rgba(15,23,42,.94), var(--shop-page-bg)) !important;
        }
        [data-theme-bg="dark"] .shop-search-surface,
        [data-theme-bg="dark"] .shop-inline-filter {
          background: rgba(15,23,42,.72) !important;
          border-color: rgba(255,255,255,.1) !important;
        }
        @media (max-width: 639px) {
          .shop-page-shell { padding-inline: 1rem; }
          .shop-discovery-inner { padding-top: .7rem; padding-bottom: .85rem; }
          .shop-search-surface { border-radius: 1rem; }
        }
        @media (max-width: 639px) {
          .shop-storefront-product-card { border-radius: 1rem !important; }
        }
        [data-theme-layout="minimal"] .shop-hero-copy { color: var(--shop-text) !important; }
        [data-theme-layout="minimal"] .shop-hero-copy h1, [data-theme-layout="minimal"] .shop-hero-copy p { color: var(--shop-text) !important; }
        [data-theme-layout="tech"] .shop-hero-copy h1 { color: white !important; }
        [data-theme-density="compact"] .shop-main { padding-top: 1.75rem !important; padding-bottom: 1.75rem !important; }
        [data-theme-density="compact"] .shop-main-inner { gap: 2rem !important; }
        [data-theme-density="spacious"] .shop-main { padding-top: 4.5rem !important; padding-bottom: 4.5rem !important; }
        [data-theme-density="spacious"] .shop-main-inner { gap: 5rem !important; }
        [data-theme-animation="none"] .shop-animate, [data-theme-animation="none"] .shop-scroll-reveal, [data-theme-animation="none"] .shop-float-soft { animation: none !important; transition: none !important; opacity: 1 !important; transform: none !important; }
        [data-theme-animation="premium"] .shop-hover-lift:hover { transform: translateY(-9px) scale(1.01); }
        @media (prefers-reduced-motion: reduce) {
          .shop-animate, .shop-drawer-enter, .shop-modal-enter, .shop-float-soft { animation: none !important; }
          .shop-scroll-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
          .shop-hover-lift, .shop-hover-lift:hover { transform: none !important; }
        }
          .shop-storefront-product-card > a {
  border-radius: 0 !important;
}
      `}</style>

      {store.announcement_enabled && store.announcement_text && (
        <div className="bg-[var(--shop-primary)] px-4 py-2 text-center text-xs font-bold text-white">
          {store.announcement_text}
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90">
        <div className="shop-page-shell flex h-16 items-center gap-4">
          <button type="button" className="flex items-center gap-3" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            {store.logo_url ? (
              <img src={store.logo_url} alt={shopName} className="h-10 w-10 rounded-2xl object-cover" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--shop-primary)] text-lg font-black text-white shadow-lg shadow-[var(--shop-primary-ring)]">
                {shopName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-lg font-black tracking-tight text-slate-950 dark:text-white">{shopName}</span>
          </button>

          <nav className="ml-4 hidden items-center gap-5 text-sm font-semibold text-slate-600 lg:flex dark:text-slate-300">
            {showProductRail && <a href="#featured" className="transition hover:text-[var(--shop-primary)]">{productRailLabel}</a>}
            <a href="#products" className="transition hover:text-[var(--shop-primary)]">Products</a>
            {hasOfferSection && <a href="#offers" className="transition hover:text-[var(--shop-primary)]">Offers</a>}
            <Link to={aboutPath} className="transition hover:text-[var(--shop-primary)]">About</Link>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-[var(--shop-primary)] hover:text-[var(--shop-primary)] sm:inline-flex dark:border-white/10 dark:text-slate-300"
              onClick={() => navigate({
                to: isLoggedIn ? "/customer/account" : "/customer/login",
                search: isLoggedIn ? {} : { redirect: currentShopPath },
              })}
              type="button"
            >
              <User className="mr-2 h-4 w-4" />
              {isLoggedIn ? "My account" : "Login"}
            </button>

            <button
              className="rounded-full p-2.5 text-slate-700 transition hover:bg-slate-100 sm:hidden dark:text-slate-200 dark:hover:bg-white/10"
              onClick={() => navigate({
                to: isLoggedIn ? "/customer/account" : "/customer/login",
                search: isLoggedIn ? {} : { redirect: currentShopPath },
              })}
              type="button"
              aria-label="Customer account"
            >
              <User className="h-5 w-5" />
            </button>

            <button
              className="relative rounded-full bg-slate-100 p-2.5 text-slate-800 transition hover:-translate-y-0.5 hover:bg-[var(--shop-primary-soft)] hover:text-[var(--shop-primary)] dark:bg-white/10 dark:text-white"
              onClick={() => setCartOpen(true)}
              type="button"
              aria-label="Open cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--shop-primary)] px-1 text-[10px] font-black text-white">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {heroVisible && (
        <section className="shop-hero-shell relative isolate overflow-hidden border border-slate-200/70 bg-slate-50 shadow-[0_24px_70px_-42px_rgba(15,23,42,.35)] dark:border-white/10 dark:bg-slate-950">
          <HeroSlider
            slides={heroSlides}
            activeSlide={activeSlide}
            setActiveSlide={setActiveSlide}
            shopName={shopName}
            className="z-0"
          />

          <div className="shop-float-soft absolute -left-24 top-20 z-0 h-72 w-72 rounded-full bg-[var(--shop-primary-ring)] blur-3xl opacity-55" />
          <div className="shop-float-soft absolute right-16 top-8 z-0 h-64 w-64 rounded-full bg-white/55 blur-3xl opacity-60 [animation-delay:1.2s]" />

          <div className="shop-hero-inner shop-page-shell relative z-10 flex items-center py-8">
            <div className="shop-scroll-reveal max-w-2xl">
              <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-[var(--shop-primary)] shadow-[0_16px_45px_rgba(15,23,42,.08)] backdrop-blur-xl dark:bg-white/12 dark:text-white/90">
                <Sparkles className="h-3.5 w-3.5" /> Digital shop
              </span>

              <h1 className="max-w-3xl text-4xl font-black leading-[0.96] tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl dark:text-white">
                {shopName}
              </h1>

              <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-slate-600 sm:text-base dark:text-slate-200">
                {tagline}
              </p>

              <div className="mt-7 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <Button
                  className="h-11 shrink-0 rounded-full bg-[var(--shop-primary)] px-6 font-black text-white shadow-[0_18px_46px_var(--shop-primary-ring)] transition duration-300 hover:-translate-y-0.5 hover:bg-[var(--shop-primary)]/90"
                  onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Shop products <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  className="h-11 shrink-0 rounded-full bg-white/70 px-6 font-bold text-slate-950 shadow-[0_14px_35px_rgba(15,23,42,.06)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/90 dark:bg-white/12 dark:text-white dark:hover:bg-white/18"
                  variant="ghost"
                  onClick={() => setCartOpen(true)}
                >
                  View cart
                </Button>
                <Button
                  className="h-11 shrink-0 rounded-full bg-transparent px-5 font-bold text-slate-600 transition hover:-translate-y-0.5 hover:bg-white/45 hover:text-[var(--shop-primary)] dark:text-slate-200 dark:hover:bg-white/10"
                  variant="ghost"
                  onClick={() => navigate({ to: aboutPath })}
                >
                  About
                </Button>
              </div>

              <div className="mt-6 flex flex-nowrap items-center gap-4 overflow-x-auto whitespace-nowrap pb-1 text-xs font-bold text-slate-600 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:text-slate-200/90">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[var(--shop-primary)]" /> Checkout ready</span>
                <span className="inline-flex items-center gap-1.5"><Truck className="h-4 w-4 text-[var(--shop-primary)]" /> Local delivery</span>
                <span className="inline-flex items-center gap-1.5"><ShoppingBag className="h-4 w-4 text-[var(--shop-primary)]" /> Curated products</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {products.length > 0 && (
      <section className="shop-discovery-section border-y border-slate-200 dark:border-white/10">
        <div className="shop-discovery-inner shop-page-shell">
          <div className="shop-category-strip flex items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((item) => {
              const active = category === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setCategory(item.name)}
                  aria-pressed={active}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black transition sm:gap-2 sm:px-3.5 sm:text-xs ${active ? "border-[var(--shop-primary)] bg-[var(--shop-primary)] text-white shadow-[0_8px_20px_-14px_var(--shop-primary-ring)]" : "border-slate-200/90 bg-white/80 text-slate-600 hover:border-[var(--shop-primary)] hover:bg-white hover:text-[var(--shop-primary)] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"}`}
                >
                  {item.name === "all" ? "All categories" : item.name}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/18 text-white" : "bg-slate-100/90 text-slate-500 dark:bg-white/10 dark:text-slate-300"}`}>{item.count}</span>
                </button>
              );
            })}
          </div>

          <div className="shop-search-surface relative mt-2.5 p-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search products, categories, or tags..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12 rounded-[0.95rem] border-slate-200 pl-12 pr-12 text-sm font-semibold transition focus:ring-4 focus:ring-[var(--shop-primary-ring)] sm:text-[15px] dark:border-white/10"
            />
            {search && (
              <button className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200" onClick={() => setSearch("")} type="button" aria-label="Clear search">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="shop-inline-filter mt-2 rounded-[1.1rem] border border-slate-200/90 bg-white/72 p-2 shadow-[0_16px_36px_-30px_rgba(15,23,42,.3)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/72">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-[minmax(180px,1.15fr)_repeat(2,minmax(112px,.7fr))]">
              <label className="relative col-span-2 sm:col-span-1">
                <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--shop-primary)]" />
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="h-10 w-full min-w-0 appearance-none rounded-[0.8rem] border border-slate-200 bg-slate-50/90 pl-10 pr-8 text-xs font-black text-slate-700 outline-none transition hover:border-[var(--shop-primary)] focus:border-[var(--shop-primary)] focus:ring-4 focus:ring-[var(--shop-primary-ring)] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                  aria-label="Sort products"
                >
                  <option value="newest">Newest first</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="discount">Best discount</option>
                  <option value="rating">Top rated</option>
                  <option value="name">Name A-Z</option>
                </select>
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">▼</span>
              </label>

              <label className="relative min-w-0">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">৳</span>
                <Input className="h-10 w-full min-w-0 rounded-[0.8rem] border-slate-200 bg-slate-50/90 pl-7 pr-2 text-xs font-bold transition focus:ring-4 focus:ring-[var(--shop-primary-ring)] dark:border-white/10 dark:bg-white/5" placeholder="Min price" type="number" min="0" inputMode="decimal" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} />
              </label>
              <label className="relative min-w-0">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">৳</span>
                <Input className="h-10 w-full min-w-0 rounded-[0.8rem] border-slate-200 bg-slate-50/90 pl-7 pr-2 text-xs font-bold transition focus:ring-4 focus:ring-[var(--shop-primary-ring)] dark:border-white/10 dark:bg-white/5" placeholder="Max price" type="number" min="0" inputMode="decimal" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} />
              </label>
            </div>

            <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setInStockOnly((value) => !value)}
                aria-pressed={inStockOnly}
                className={`h-8 shrink-0 rounded-full border px-2.5 text-[10px] font-black transition ${inStockOnly ? "border-emerald-600 bg-emerald-600 text-white shadow-[0_10px_24px_-16px_rgba(5,150,105,.85)]" : "border-emerald-200 bg-emerald-50/80 text-emerald-700 hover:border-emerald-400 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"}`}
              >
                In stock
              </button>
              <button
                type="button"
                onClick={() => setDiscountOnly((value) => !value)}
                aria-pressed={discountOnly}
                className={`h-8 shrink-0 rounded-full border px-2.5 text-[10px] font-black transition ${discountOnly ? "border-rose-500 bg-rose-500 text-white shadow-[0_10px_24px_-16px_rgba(244,63,94,.85)]" : "border-rose-200 bg-rose-50/80 text-rose-700 hover:border-rose-400 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300"}`}
              >
                On offer
              </button>

              {(search || category !== "all" || sort !== "newest" || priceMin || priceMax || inStockOnly || discountOnly) && (
                <button type="button" onClick={clearFilters} className="h-8 shrink-0 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-black text-[var(--shop-primary)] transition hover:border-[var(--shop-primary)] hover:bg-[var(--shop-primary-soft)] dark:border-white/10 dark:bg-white/5">
                  Clear all
                </button>
              )}

              <span className="ml-auto shrink-0 rounded-full bg-slate-950 px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm dark:bg-white dark:text-slate-950">
                {filtered.length} result{filtered.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
      </section>
      )}

      <main className="shop-main w-full py-8">
        <div className="shop-main-inner shop-page-shell flex flex-col gap-8 sm:gap-10">
        {showProductRail && (
          <div id="featured">
            <ProductRail
              title={collections.hasExplicitFeatured ? "Featured products" : "Latest products"}
              curated={collections.hasExplicitFeatured}
              products={collections.featured}
              currency={currency}
              storeId={store.id}
              storeSlug={subdomain}
              shopName={shopName}
              onView={openProductDetails}
              onCartChange={refreshCartCount}
              onOpenCart={() => setCartOpen(true)}
            />
          </div>
        )}

        <section id="products" className="shop-scroll-reveal space-y-5">
          <SectionHeader
            eyebrow="All products"
            title="Explore the full collection"
            description={`${filtered.length} product${filtered.length === 1 ? "" : "s"} matched your current search and filters.`}
            action={
              <Button variant="outline" className="rounded-xl transition hover:-translate-y-0.5" onClick={clearFilters}>
                <Filter className="h-4 w-4" /> Clear filters
              </Button>
            }
          />

          <div>
            {filtered.length === 0 ? (
              <div className="shop-product-surface rounded-[2rem] border border-dashed border-slate-300 bg-white p-12 text-center dark:border-white/10 dark:bg-slate-950">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--shop-primary-soft)] text-[var(--shop-primary)]">
                  <Search className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-black">No products found</h3>
                <p className="mt-2 text-sm text-slate-500">Try different categories, keywords, a price range, or another filter.</p>
                <Button className="mt-5 rounded-xl" variant="outline" onClick={clearFilters}>Reset filters</Button>
              </div>
            ) : (
              <div className="shop-product-grid grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {filtered.map((product, index) => (
                  <div key={product.id} className="shop-animate" style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}>
                    <ProductCard
                      product={product}
                      currency={currency}
                      storeId={store.id}
                      storeSlug={subdomain}
                      shopName={shopName}
                      onView={openProductDetails}
                      onCartChange={refreshCartCount}
                      onOpenCart={() => setCartOpen(true)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <OfferSection store={store} product={collections.deal} currency={currency} onView={openProductDetails} />
        </div>
      </main>

      <footer className="shop-scroll-reveal border-t border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-3">
              {store.logo_url ? (
                <img src={store.logo_url} alt={shopName} className="h-11 w-11 rounded-2xl object-cover" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--shop-primary)] font-black text-white">
                  {shopName.charAt(0).toUpperCase()}
                </span>
              )}
              <p className="text-lg font-black">{shopName}</p>
            </div>
            <p className="max-w-md text-sm leading-7 text-slate-600 dark:text-slate-300">{about}</p>
          </div>

          <div>
            <p className="mb-4 font-black">Useful links</p>
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <Link to="/track" search={{ store: subdomain }} className="block transition hover:text-[var(--shop-primary)]">Track order</Link>
              <Link to={aboutPath} className="block transition hover:text-[var(--shop-primary)]">About merchant</Link>
              <button type="button" onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })} className="block transition hover:text-[var(--shop-primary)]">All products</button>
              {store.return_policy && <a href={`${aboutPath}#return-policy`} className="block transition hover:text-[var(--shop-primary)]">Return policy</a>}
              {store.shipping_policy && <a href={`${aboutPath}#shipping-policy`} className="block transition hover:text-[var(--shop-primary)]">Shipping policy</a>}
            </div>
          </div>

          <div>
            <p className="mb-4 font-black">Contact</p>
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {store.contact_email && <a href={`mailto:${store.contact_email}`} className="block transition hover:text-[var(--shop-primary)]">{store.contact_email}</a>}
              {(store.contact_phone || store.phone) && <a href={`tel:${String(store.contact_phone || store.phone).replace(/\s+/g, "")}`} className="block transition hover:text-[var(--shop-primary)]">{store.contact_phone || store.phone}</a>}
              {store.address && <p>{store.address}</p>}
              {!store.contact_email && !(store.contact_phone || store.phone) && !store.address && <p>Contact details will appear here after merchant setup.</p>}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 py-4 text-center text-xs font-semibold text-slate-500 dark:border-white/10">
          Powered by <strong>BazarHQ</strong>
        </div>
      </footer>


      <CartDrawer
        open={cartOpen}
        store={store}
        products={products}
        subdomain={subdomain}
        currency={currency}
        onClose={() => setCartOpen(false)}
        onCartChange={refreshCartCount}
      />
    </div>
  );
}
