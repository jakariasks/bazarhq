// src/pages/shop.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  addToCart,
  getCartTotals,
  removeItem,
  updateQty,
} from "@/lib/cart";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { getTheme, themeCssVars } from "@/lib/preview-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Filter,
  Minus,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
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
  return `${currency} ${toNumber(value).toLocaleString("en-BD")}`;
}

function clampText(text, fallback = "") {
  if (typeof text !== "string") return fallback;
  return text.trim() || fallback;
}

function getImage(product) {
  if (Array.isArray(product?.images) && product.images.length > 0) return product.images[0];
  if (product?.image_url) return product.image_url;
  return null;
}

function getCartProduct(product) {
  const image = getImage(product);
  const images = Array.isArray(product?.images) && product.images.length > 0
    ? product.images
    : image
      ? [image]
      : [];
  return { ...product, images };
}

function getTags(product) {
  if (Array.isArray(product?.tags)) return product.tags.map((tag) => String(tag).toLowerCase());
  if (typeof product?.tags === "string") {
    return product.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function getDiscount(product) {
  const price = toNumber(product?.price, 0);
  const compareAt = toNumber(product?.compare_at_price, 0);
  if (!price || compareAt <= price) return 0;
  return Math.round((1 - price / compareAt) * 100);
}

function getStock(product) {
  return toNumber(product?.stock, 0);
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

function getVariantId(variant) {
  if (!variant) return null;
  return variant.id || variant.combo || variant.label || (variant.options ? JSON.stringify(variant.options) : null);
}

function getVariantLabel(variant) {
  if (!variant) return null;
  if (variant.combo) return variant.combo;
  if (variant.label) return variant.label;
  if (variant.options) {
    return Object.entries(variant.options)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
  }
  return getVariantId(variant);
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

function normalizeVariants(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : parseArrayValue(product?.variants);
  if (!variants.length) return [];

  return variants
    .filter((variant) => variant && typeof variant === "object")
    .map((variant, index) => ({
      ...variant,
      id: getVariantId(variant) || `variant-${index}`,
      label: getVariantLabel(variant) || `Variant ${index + 1}`,
      price: variant.price === "" || variant.price == null ? product.price : variant.price,
      stock: toNumber(variant.stock, 0),
    }));
}

function hasVariants(product) {
  return Boolean(product?.has_variants && normalizeVariants(product).length > 0);
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

function RatingStars() {
  return (
    <div className="flex items-center gap-1 text-amber-400" aria-label="Rating placeholder">
      {[0, 1, 2, 3, 4].map((item) => (
        <Star key={item} className="h-3.5 w-3.5 fill-current" />
      ))}
      <span className="ml-1 text-xs font-semibold text-slate-500 dark:text-slate-400">4.8</span>
    </div>
  );
}

function ProductImage({ product, className = "" }) {
  const image = getImage(product);
  const outOfStock = getStock(product) <= 0;

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 ${className}`}>
      {image ? (
        <img
          src={image}
          alt={product.title}
          className={`h-full w-full object-cover transition duration-700 ease-out group-hover:scale-110 ${outOfStock ? "opacity-60 grayscale" : ""}`}
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-700">
          <Package className="h-12 w-12" />
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, currency, storeId, onView, onCartChange, onOpenCart }) {
  const [adding, setAdding] = useState(false);
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState("");

  const stock = getStock(product);
  const outOfStock = stock <= 0;
  const lowStock = stock > 0 && stock <= 5;
  const price = toNumber(product.price, 0);
  const compareAt = toNumber(product.compare_at_price, 0);
  const discount = getDiscount(product);
  const requiresVariant = hasVariants(product);

  async function handleAddToCart(event) {
    event.stopPropagation();
    setError("");

    if (requiresVariant) {
      onView(product);
      return;
    }

    setAdding(true);
    const result = addToCart(storeId, getCartProduct(product));
    setAdding(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setFlash(true);
    onCartChange?.();
    onOpenCart?.();
    setTimeout(() => setFlash(false), 1000);
  }

  return (
    <article className="group shop-hover-lift overflow-hidden rounded-[1.45rem] border border-slate-200/80 bg-white shadow-sm transition-all duration-500 hover:border-[var(--shop-primary-ring)] dark:border-white/10 dark:bg-slate-950">
      <div className="relative">
        <button type="button" className="block w-full text-left" onClick={() => onView(product)}>
          <ProductImage product={product} className="aspect-[4/3]" />
        </button>

        <div className="absolute left-3 top-3 flex flex-col gap-2">
          {discount > 0 && (
            <span className="inline-flex w-fit items-center rounded-full bg-rose-500 px-2.5 py-1 text-xs font-black text-white shadow-sm">
              -{discount}%
            </span>
          )}
          {isFeatured(product) && (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-slate-900 shadow-sm backdrop-blur">
              <Sparkles className="h-3 w-3 text-[var(--shop-primary)]" /> Featured
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onView(product);
          }}
          className="absolute right-3 top-3 translate-y-1 rounded-full bg-white/90 p-2 text-slate-700 opacity-0 shadow-sm backdrop-blur transition duration-300 hover:bg-white hover:text-[var(--shop-primary)] group-hover:translate-y-0 group-hover:opacity-100"
          aria-label="Quick view"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {product.category || "General"}
          </span>
          <RatingStars />
        </div>

        <button type="button" className="block text-left" onClick={() => onView(product)}>
          <h3 className="line-clamp-2 min-h-[2.6rem] text-sm font-bold leading-snug text-slate-950 transition hover:text-[var(--shop-primary)] dark:text-white">
            {product.title}
          </h3>
        </button>

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-lg font-black text-[var(--shop-primary)]">{money(price, currency)}</p>
            {compareAt > price && (
              <p className="text-xs font-semibold text-slate-400 line-through">{money(compareAt, currency)}</p>
            )}
          </div>
          <span className={`text-xs font-bold ${outOfStock ? "text-rose-500" : lowStock ? "text-amber-600" : "text-emerald-600"}`}>
            {outOfStock ? "Out of stock" : lowStock ? `${stock} left` : "In stock"}
          </span>
        </div>

        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>}

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button
            size="sm"
            className="rounded-xl bg-[var(--shop-primary)] text-white transition duration-300 hover:-translate-y-0.5 hover:opacity-90"
            disabled={outOfStock || adding}
            onClick={handleAddToCart}
          >
            {outOfStock ? "Out of stock" : requiresVariant ? "Choose option" : flash ? "Added" : adding ? "Adding..." : "Add to cart"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl transition duration-300 hover:-translate-y-0.5 hover:border-[var(--shop-primary)] hover:text-[var(--shop-primary)]"
            onClick={() => onView(product)}
          >
            View
          </Button>
        </div>
      </div>
    </article>
  );
}

function ProductRail({ title, products, currency, storeId, onView, onCartChange, onOpenCart }) {
  if (!products.length) return null;

  return (
    <section className="shop-scroll-reveal space-y-5">
      <SectionHeader
        eyebrow="Curated collection"
        title={title}
        description="Handpicked products from this store for a smoother shopping experience."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product, index) => (
          <div key={`${title}-${product.id}`} className="shop-animate" style={{ animationDelay: `${index * 70}ms` }}>
            <ProductCard
              product={product}
              currency={currency}
              storeId={storeId}
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
  const safeSlides = slides.length ? slides : [{ image: null, title: shopName, eyebrow: "Featured collection", subtitle: "Clean shopping, trusted checkout" }];
  const activeIndex = activeSlide % safeSlides.length;
  const active = safeSlides[activeIndex];

  return (
    <div className={`shop-scroll-reveal relative overflow-hidden rounded-[2rem] border border-white/50 bg-gradient-to-br from-white/30 via-[var(--shop-primary-soft)] to-white/10 p-2 shadow-2xl shadow-[var(--shop-primary-ring)] backdrop-blur-xl transition duration-500 hover:-translate-y-1 hover:shadow-[0_30px_80px_var(--shop-primary-ring)] dark:border-white/10 dark:from-white/10 dark:via-white/5 dark:to-white/0 ${className}`}>
      <div className="relative aspect-[16/7] min-h-[200px] overflow-hidden rounded-[1.45rem] bg-slate-100 sm:min-h-[230px] lg:min-h-[250px] dark:bg-slate-900">
        {safeSlides.map((slide, index) => (
          <div
            key={`${slide.image || "slide"}-${index}`}
            className={`absolute inset-0 transition-all duration-700 ease-out ${activeIndex === index ? "opacity-100 scale-100" : "opacity-0 scale-105"}`}
          >
            {slide.image ? (
              <>
                <img src={slide.image} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/50 to-[var(--shop-primary-soft)] dark:from-slate-950/80 dark:via-slate-950/50" />
                <img
                  src={slide.image}
                  alt={`${shopName} banner ${index + 1}`}
                  className="relative z-10 h-full w-full object-contain p-4 transition duration-700 ease-out"
                />
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--shop-primary-soft)] to-slate-100 text-[var(--shop-primary)] dark:to-slate-900">
                <ShoppingBag className="h-20 w-20" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
          </div>
        ))}

        <div className="absolute bottom-5 left-5 right-5 z-30 max-w-2xl text-white">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/80">{active.eyebrow}</p>
          <h2 className="mt-2 text-xl font-black tracking-tight sm:text-3xl">{active.title}</h2>
          <p className="mt-2 max-w-xl text-xs leading-5 text-white/80 sm:text-sm">{active.subtitle}</p>
        </div>

        {safeSlides.length > 1 && (
          <div className="absolute bottom-5 right-5 z-40 flex gap-2 rounded-full bg-white/20 p-1 backdrop-blur">
            {safeSlides.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Show banner ${index + 1}`}
                onClick={() => setActiveSlide(index)}
                className={`h-2.5 rounded-full transition-all duration-300 ${activeIndex === index ? "w-7 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FiltersSidebar({
  categories,
  category,
  setCategory,
  sort,
  setSort,
  priceMin,
  setPriceMin,
  priceMax,
  setPriceMax,
  inStockOnly,
  setInStockOnly,
  discountOnly,
  setDiscountOnly,
  clearFilters,
  showMobile,
  onClose,
}) {
  const activeCount = Number(category !== "all") + Number(Boolean(priceMin)) + Number(Boolean(priceMax)) + Number(inStockOnly) + Number(discountOnly);

  return (
    <aside className={`${showMobile ? "block" : "hidden"} lg:block`}>
      <div className="shop-animate sticky top-36 rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm transition duration-300 hover:shadow-lg dark:border-white/10 dark:bg-slate-950">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--shop-primary)]">Filters</p>
            <h3 className="mt-1 text-base font-black text-slate-950 dark:text-white">Refine</h3>
          </div>
          <button type="button" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-white/10" onClick={onClose} aria-label="Close filters">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="shop-category-filter" className="mb-2 block text-xs font-black text-slate-950 dark:text-white">Category</label>
            <select
              id="shop-category-filter"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-[var(--shop-primary)] focus:ring-4 focus:ring-[var(--shop-primary-ring)] dark:border-white/10 dark:bg-slate-950"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name === "all" ? "All products" : item.name} ({item.count})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="shop-sort-filter" className="mb-2 block text-xs font-black text-slate-950 dark:text-white">Sort</label>
            <select
              id="shop-sort-filter"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-[var(--shop-primary)] focus:ring-4 focus:ring-[var(--shop-primary-ring)] dark:border-white/10 dark:bg-slate-950"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="discount">Best discount</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>

          <div>
            <p className="mb-2 text-xs font-black text-slate-950 dark:text-white">Price</p>
            <div className="space-y-2">
              <Input className="h-10 rounded-xl text-sm" placeholder="Min" type="number" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} />
              <Input className="h-10 rounded-xl text-sm" placeholder="Max" type="number" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold transition hover:border-[var(--shop-primary)] dark:border-white/10">
              <input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} />
              In stock only
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold transition hover:border-[var(--shop-primary)] dark:border-white/10">
              <input type="checkbox" checked={discountOnly} onChange={(event) => setDiscountOnly(event.target.checked)} />
              On offer only
            </label>
          </div>

          <Button variant="outline" className="h-10 w-full rounded-xl text-sm" onClick={clearFilters}>
            <Filter className="h-4 w-4" /> Clear {activeCount > 0 ? `(${activeCount})` : ""}
          </Button>
        </div>
      </div>
    </aside>
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
      ? "Get the best value from this store. Compare price, check stock, and add it to your cart before the offer ends."
      : "Explore current offers, featured picks, and customer-friendly checkout from this merchant."
  );
  const badge = clampText(store?.offer_badge, "Limited offer");
  const buttonText = clampText(store?.offer_button_text, product ? "Quick view" : "Shop products");

  function handleAction() {
    if (product) onView(product);
    else document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section id="offers" className="shop-scroll-reveal overflow-hidden rounded-[2rem] border border-white/60 bg-slate-950 text-white shadow-xl transition duration-500 hover:-translate-y-1 hover:shadow-2xl dark:border-white/10">
      <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-white/80">
            <Zap className="h-3.5 w-3.5 text-amber-300" /> {badge}
          </span>
          <div>
            <h2 className="text-2xl font-black tracking-tight sm:text-4xl">{title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {discount > 0 && <span className="rounded-full bg-rose-500 px-4 py-2 text-sm font-black">Save {discount}%</span>}
            {product && <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold">{money(product.price, currency)}</span>}
          </div>
          <Button className="rounded-2xl bg-white text-slate-950 transition hover:-translate-y-0.5 hover:bg-white/90" onClick={handleAction}>
            {buttonText} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative min-h-[220px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/10">
          {image ? (
            <>
              <img src={image} alt={title} className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-xl" />
              <img src={image} alt={title} className="relative z-10 h-full min-h-[220px] w-full object-contain p-4" />
            </>
          ) : (
            <div className="flex h-full min-h-[220px] items-center justify-center text-white/40">
              <ShoppingBag className="h-20 w-20" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ProductModal({ product, currency, storeId, onClose, onCartChange, onOpenCart }) {
  const variants = normalizeVariants(product);
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id || null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(false);

  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) || null;
  const currentStock = toNumber(selectedVariant?.stock ?? product.stock, 0);
  const currentPrice = toNumber(selectedVariant?.price ?? product.price, 0);
  const outOfStock = currentStock <= 0;
  const image = getImage(product);

  useEffect(() => {
    setQty(1);
    setError("");
  }, [product.id, selectedVariantId]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function handleAddToCart() {
    setError("");
    const result = addToCart(storeId, getCartProduct(product), selectedVariant, qty);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setFlash(true);
    onCartChange?.();
    onOpenCart?.();
    setTimeout(() => {
      setFlash(false);
      onClose();
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="shop-modal-enter max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl dark:bg-slate-950" onClick={(event) => event.stopPropagation()}>
        <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative min-h-[320px] bg-slate-100 dark:bg-slate-900">
            {image ? (
              <img src={image} alt={product.title} className="h-full min-h-[320px] w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[320px] items-center justify-center text-slate-300"><Package className="h-20 w-20" /></div>
            )}
            {getDiscount(product) > 0 && <span className="absolute left-5 top-5 rounded-full bg-rose-500 px-3 py-1.5 text-sm font-black text-white">-{getDiscount(product)}%</span>}
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--shop-primary)]">{product.category || "General"}</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl dark:text-white">{product.title}</h2>
                <div className="mt-3"><RatingStars /></div>
              </div>
              <button type="button" className="rounded-full border border-slate-200 p-2 transition hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10" onClick={onClose}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <p className="text-3xl font-black text-[var(--shop-primary)]">{money(currentPrice, currency)}</p>
                {toNumber(product.compare_at_price, 0) > currentPrice && <p className="mt-1 text-sm font-semibold text-slate-400 line-through">{money(product.compare_at_price, currency)}</p>}
              </div>

              <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${outOfStock ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`}>
                {outOfStock ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {outOfStock ? "This item is currently out of stock." : `${currentStock} item${currentStock === 1 ? "" : "s"} available`}
              </div>

              {variants.length > 0 && (
                <div>
                  <p className="mb-3 text-sm font-black text-slate-950 dark:text-white">Choose option</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {variants.map((variant) => {
                      const variantStock = toNumber(variant.stock, 0);
                      const disabled = variantStock <= 0;
                      const selected = selectedVariantId === variant.id;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSelectedVariantId(variant.id)}
                          className={`rounded-2xl border px-4 py-3 text-left transition duration-300 disabled:cursor-not-allowed disabled:opacity-45 ${selected ? "border-[var(--shop-primary)] bg-[var(--shop-primary-soft)] text-[var(--shop-primary)]" : "border-slate-200 hover:border-[var(--shop-primary)] dark:border-white/10"}`}
                        >
                          <span className="block text-sm font-black">{variant.label}</span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {money(variant.price, currency)} · {variantStock} available
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!outOfStock && (
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-3 dark:border-white/10">
                  <span className="text-sm font-black text-slate-950 dark:text-white">Quantity</span>
                  <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                    <button
                      type="button"
                      className="px-3 py-2 transition hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-white/10"
                      disabled={qty <= 1}
                      onClick={() => setQty((value) => Math.max(1, value - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-10 text-center text-sm font-black">{qty}</span>
                    <button
                      type="button"
                      className="px-3 py-2 transition hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-white/10"
                      disabled={qty >= currentStock}
                      onClick={() => setQty((value) => Math.min(currentStock, value + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {product.description && (
                <div>
                  <p className="mb-2 text-sm font-black text-slate-950 dark:text-white">Description</p>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{product.description}</p>
                </div>
              )}

              {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{error}</p>}

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  className="h-12 rounded-2xl bg-[var(--shop-primary)] text-white transition hover:-translate-y-0.5 hover:opacity-90"
                  disabled={outOfStock}
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="h-4 w-4" />
                  {flash ? "Added to cart" : outOfStock ? "Out of stock" : "Add to cart"}
                </Button>
                <Button className="h-12 rounded-2xl transition hover:-translate-y-0.5" variant="outline" onClick={onClose}>
                  Continue shopping
                </Button>
              </div>

              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
                <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-[var(--shop-primary)]" /> Fast local delivery</div>
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[var(--shop-primary)]" /> Secure checkout</div>
                <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-[var(--shop-primary)]" /> bKash, Nagad, Rocket and COD supported</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ open, store, subdomain, currency, onClose, onCartChange }) {
  const navigate = useNavigate();
  const [cart, setCart] = useState(() => getCartTotals(store?.id));

  const refresh = useCallback(() => {
    if (!store?.id) return;
    setCart(getCartTotals(store.id));
    onCartChange?.();
  }, [store?.id, onCartChange]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

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
          <button type="button" className="rounded-full border border-slate-200 p-2 dark:border-white/10" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
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
                        <button type="button" className="px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => { updateQty(store.id, item.key, item.qty - 1); refresh(); }}>-</button>
                        <span className="min-w-8 text-center text-xs font-black">{item.qty}</span>
                        <button type="button" className="px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => { updateQty(store.id, item.key, item.qty + 1); refresh(); }}>+</button>
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
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{money(cart.subtotal, currency)}</span></div>
            <div className="flex justify-between text-lg font-black text-slate-950 dark:text-white"><span>Total</span><span>{money(cart.total, currency)}</span></div>
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

function EmptyShopState({ title, message, emoji = "🔍" }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8 text-center dark:bg-slate-950">
      <div className="text-5xl">{emoji}</div>
      <h1 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">{title}</h1>
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
  const [showFilter, setShowFilter] = useState(false);
  const [viewProduct, setViewProduct] = useState(null);
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
      }

      setStore(storeData);
      setProducts(productData || []);
      setStatus("ok");
    }

    loadStorefront();
  }, [subdomain]);

  const refreshCartCount = useCallback(() => {
    if (!store?.id) return;
    const { itemCount } = getCartTotals(store.id);
    setCartCount(itemCount);
  }, [store?.id]);

  useEffect(() => {
    refreshCartCount();
  }, [refreshCartCount]);

  const currency = store?.currency || "BDT";
  const theme = getTheme(store?.theme_id);
  const themeVars = themeCssVars(theme);
  const primaryColor = store?.brand_color || theme.swatch || "#4f46e5";
  const shopVars = {
    ...themeVars,
    "--shop-primary": primaryColor,
    "--shop-primary-soft": rgba(primaryColor, 0.12),
    "--shop-primary-ring": rgba(primaryColor, 0.24),
  };

  const categories = useMemo(() => {
    const counts = new Map();
    products.forEach((product) => {
      const name = clampText(product.category, "General");
      counts.set(name, (counts.get(name) || 0) + 1);
    });

    const merchantCategories = normalizeCategoryList(store?.categories);
    const names = new Set([...merchantCategories, ...counts.keys()]);

    return [
      { name: "all", count: products.length },
      ...Array.from(names).map((name) => ({ name, count: counts.get(name) || 0 })),
    ];
  }, [store?.categories, products]);

  const collections = useMemo(() => {
    const byNewest = [...products].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const featured = products.filter(isFeatured);
    const byDiscount = [...products].sort((a, b) => getDiscount(b) - getDiscount(a));

    return {
      featured: (featured.length ? featured : byNewest).slice(0, 4),
      deal: byDiscount.find((product) => getDiscount(product) > 0) || products.find((product) => getStock(product) > 0) || null,
    };
  }, [products]);

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

    const heroTitle = clampText(store?.hero_title, "Clean shopping, trusted checkout");
    const heroSubtitle = clampText(store?.hero_subtitle || store?.tagline, "Shop curated products with secure payment and smooth delivery.");

    if (uniqueImages.length === 0) {
      return [
        { image: null, eyebrow: "Premium online store", title: heroTitle, subtitle: heroSubtitle },
        { image: null, eyebrow: "Store highlights", title: "Shop confidently from this merchant", subtitle: "Browse the collection and add your favorites to cart." },
      ];
    }

    return uniqueImages.map((image, index) => ({
      image,
      eyebrow: index === 0 ? "Premium online store" : index === 1 ? "Featured collection" : index === 2 ? "Special offer" : "Store highlights",
      title: index === 0 ? heroTitle : index === 1 ? "Discover this store's featured picks" : index === 2 ? "Offers made for smart shoppers" : "Shop with confidence",
      subtitle: index === 0 ? heroSubtitle : "Compare products, check stock, and checkout safely from this storefront.",
    }));
  }, [store, products]);

  useEffect(() => {
    if (heroSlides.length <= 1) return undefined;
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
        product.title?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query) ||
        getTags(product).some((tag) => tag.includes(query))
      ));
    }

    if (category !== "all") list = list.filter((product) => clampText(product.category, "General") === category);
    if (priceMin !== "") list = list.filter((product) => toNumber(product.price, 0) >= Number(priceMin));
    if (priceMax !== "") list = list.filter((product) => toNumber(product.price, 0) <= Number(priceMax));
    if (inStockOnly) list = list.filter((product) => getStock(product) > 0);
    if (discountOnly) list = list.filter((product) => getDiscount(product) > 0);

    switch (sort) {
      case "price-asc":
        list.sort((a, b) => toNumber(a.price, 0) - toNumber(b.price, 0));
        break;
      case "price-desc":
        list.sort((a, b) => toNumber(b.price, 0) - toNumber(a.price, 0));
        break;
      case "discount":
        list.sort((a, b) => getDiscount(b) - getDiscount(a));
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
      />
    );
  }

  if (status === "unpublished") {
    return (
      <EmptyShopState
        title="Shop is currently unavailable"
        message="The merchant has temporarily unpublished this storefront. Please check again later."
        emoji="🚧"
      />
    );
  }

  const shopName = clampText(store.shop_name, "BazarHQ Store");
  const tagline = clampText(store.tagline, "Discover quality products, smooth checkout, and reliable delivery.");
  const about = clampText(store.about_text || store.description, "A modern online store powered by BazarHQ for a fast and secure shopping experience.");
  const heroVisible = store.show_hero !== false;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white" style={shopVars}>
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
        .shop-hero-card::before { content: ""; position: absolute; inset: -1px; border-radius: inherit; padding: 1px; background: linear-gradient(135deg, rgba(255,255,255,.65), rgba(255,255,255,.12), var(--shop-primary-ring)); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; }
        .shop-hero-shine::after { content: ""; position: absolute; top: -35%; bottom: -35%; width: 38%; left: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent); animation: shopShine 4.8s ease-in-out infinite; pointer-events: none; }
        .shop-float-soft { animation: shopFloatSoft 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .shop-animate, .shop-drawer-enter, .shop-modal-enter, .shop-float-soft { animation: none !important; }
          .shop-scroll-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
          .shop-hover-lift, .shop-hover-lift:hover { transform: none !important; }
        }
      `}</style>

      {store.announcement_enabled && store.announcement_text && (
        <div className="bg-[var(--shop-primary)] px-4 py-2 text-center text-xs font-bold text-white">
          {store.announcement_text}
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
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
            <a href="#featured" className="transition hover:text-[var(--shop-primary)]">Featured</a>
            <a href="#products" className="transition hover:text-[var(--shop-primary)]">Products</a>
            <a href="#offers" className="transition hover:text-[var(--shop-primary)]">Offers</a>
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
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,var(--shop-primary-soft),transparent_32%),linear-gradient(135deg,#f8fafc_0%,#eef2ff_48%,#f8fafc_100%)] dark:bg-[radial-gradient(circle_at_18%_18%,var(--shop-primary-ring),transparent_32%),linear-gradient(135deg,#020617_0%,#0f172a_52%,#020617_100%)]" />
          <div className="shop-float-soft absolute -right-28 -top-28 h-72 w-72 rounded-full bg-[var(--shop-primary-ring)] blur-3xl" />
          <div className="shop-float-soft absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-[var(--shop-primary-ring)] blur-3xl [animation-delay:1.2s]" />

          <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(280px,4fr)_minmax(0,6fr)] lg:px-8 lg:py-8">
            <div className="shop-scroll-reveal shop-hero-card shop-hero-shine relative order-1 flex flex-col justify-center overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-[var(--shop-primary)] p-6 text-white shadow-2xl shadow-[var(--shop-primary-ring)] transition duration-500 hover:-translate-y-1 hover:shadow-[0_32px_90px_var(--shop-primary-ring)]">
              <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
              <div className="relative z-10">
                <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white/85 backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" /> Brand store
                </span>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{shopName}</h1>
                <p className="mt-4 text-sm leading-7 text-white/75">{tagline}</p>
                <div className="mt-6 grid gap-3">
                  <Button
                    className="h-11 rounded-2xl bg-white px-5 font-black text-slate-950 shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-0.5 hover:bg-white/90"
                    onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    Shop products <ArrowRight className="h-4 w-4" />
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      className="h-11 rounded-2xl border-white/20 bg-white/10 px-5 font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15"
                      variant="outline"
                      onClick={() => setCartOpen(true)}
                    >
                      View cart
                    </Button>
                    <Button
                      className="h-11 rounded-2xl border-white/20 bg-white/10 px-5 font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15"
                      variant="outline"
                      onClick={() => navigate({ to: aboutPath })}
                    >
                      About
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <HeroSlider slides={heroSlides} activeSlide={activeSlide} setActiveSlide={setActiveSlide} shopName={shopName} className="order-2" />
          </div>
        </section>
      )}

      <section className="sticky top-16 z-30 border-y border-slate-200 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search products, category, or tags..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-12 rounded-2xl border-slate-200 bg-slate-50 pl-12 pr-12 text-base transition focus:ring-4 focus:ring-[var(--shop-primary-ring)] dark:border-white/10 dark:bg-white/5"
              />
              {search && (
                <button className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setSearch("")} type="button">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              className="h-12 rounded-2xl lg:hidden"
              onClick={() => setShowFilter((value) => !value)}
            >
              <SlidersHorizontal className="h-4 w-4" /> Filter <ChevronDown className={`h-4 w-4 transition ${showFilter ? "rotate-180" : ""}`} />
            </Button>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
        <div id="featured">
          <ProductRail
            title="Featured products"
            products={collections.featured}
            currency={currency}
            storeId={store.id}
            onView={setViewProduct}
            onCartChange={refreshCartCount}
            onOpenCart={() => setCartOpen(true)}
          />
        </div>

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

          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)]">
            <FiltersSidebar
              categories={categories}
              category={category}
              setCategory={setCategory}
              sort={sort}
              setSort={setSort}
              priceMin={priceMin}
              setPriceMin={setPriceMin}
              priceMax={priceMax}
              setPriceMax={setPriceMax}
              inStockOnly={inStockOnly}
              setInStockOnly={setInStockOnly}
              discountOnly={discountOnly}
              setDiscountOnly={setDiscountOnly}
              clearFilters={clearFilters}
              showMobile={showFilter}
              onClose={() => setShowFilter(false)}
            />

            <div>
              {filtered.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-12 text-center dark:border-white/10 dark:bg-slate-950">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--shop-primary-soft)] text-[var(--shop-primary)]">
                    <Search className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-black">No products found</h3>
                  <p className="mt-2 text-sm text-slate-500">Try a different keyword, category, price range, or filter.</p>
                  <Button className="mt-5 rounded-xl" variant="outline" onClick={clearFilters}>Reset search</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((product, index) => (
                    <div key={product.id} className="shop-animate" style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}>
                      <ProductCard
                        product={product}
                        currency={currency}
                        storeId={store.id}
                        onView={setViewProduct}
                        onCartChange={refreshCartCount}
                        onOpenCart={() => setCartOpen(true)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <OfferSection store={store} product={collections.deal} currency={currency} onView={setViewProduct} />
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
              {store.return_policy && <button type="button" onClick={() => alert(store.return_policy)} className="block transition hover:text-[var(--shop-primary)]">Return policy</button>}
              {store.shipping_policy && <button type="button" onClick={() => alert(store.shipping_policy)} className="block transition hover:text-[var(--shop-primary)]">Shipping policy</button>}
            </div>
          </div>

          <div>
            <p className="mb-4 font-black">Contact</p>
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {store.contact_email && <p>{store.contact_email}</p>}
              {(store.contact_phone || store.phone) && <p>{store.contact_phone || store.phone}</p>}
              {store.address && <p>{store.address}</p>}
              {!store.contact_email && !(store.contact_phone || store.phone) && !store.address && <p>Contact details will appear here after merchant setup.</p>}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 py-4 text-center text-xs font-semibold text-slate-500 dark:border-white/10">
          Powered by <strong>BazarHQ</strong>
        </div>
      </footer>

      {viewProduct && (
        <ProductModal
          product={viewProduct}
          currency={currency}
          storeId={store.id}
          onClose={() => setViewProduct(null)}
          onCartChange={refreshCartCount}
          onOpenCart={() => setCartOpen(true)}
        />
      )}

      <CartDrawer
        open={cartOpen}
        store={store}
        subdomain={subdomain}
        currency={currency}
        onClose={() => setCartOpen(false)}
        onCartChange={refreshCartCount}
      />
    </div>
  );
}
