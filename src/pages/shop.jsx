// src/pages/shop.jsx
// C1 SRS: Guest access · theme rendering · search · category/price filter · sort · stock warnings
import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase }  from "@/integrations/supabase/client";
import { getCart, addToCart, getCartTotals } from "@/lib/cart";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Badge }  from "@/components/ui/badge";
import {
  Search, ShoppingCart, User, ChevronDown,
  X, AlertTriangle, Tag, Filter, SlidersHorizontal,
} from "lucide-react";

// ── Subdomain / Store Detection ────────────────────────────────────────────────
function getSubdomain() {
  const host = window.location.hostname; // e.g. myshop.bazarhq.com
  const parts = host.split(".");
  if (parts.length >= 3) return parts[0];
  // Dev: ?shop=myshop in URL
  return new URLSearchParams(window.location.search).get("shop") || null;
}

// ── Product Card ───────────────────────────────────────────────────────────────
function ProductCard({ product, storeId, onView, onCartChange }) {
  const [adding,  setAdding]  = useState(false);
  const [flash,   setFlash]   = useState(false);  // added-to-cart flash
  const [errMsg,  setErrMsg]  = useState("");

  const isOutOfStock = product.stock === 0;
  const isLowStock   = product.stock > 0 && product.stock < 5;
  const discount     = product.compare_at_price > product.price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : 0;

  async function handleAddToCart(e) {
    e.stopPropagation();
    setErrMsg("");
    setAdding(true);
    const result = addToCart(storeId, product);
    if (result.success) {
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
      onCartChange?.();
    } else {
      setErrMsg(result.message);
    }
    setAdding(false);
  }

  return (
    <div
      className="group bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden hover:shadow-md transition-all cursor-pointer"
      onClick={() => onView(product)}
    >
      {/* Image */}
      <div className="aspect-square relative overflow-hidden bg-[var(--muted)]">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.title}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${isOutOfStock ? "opacity-50 grayscale" : ""}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--muted-foreground)] opacity-30">
            <Tag className="h-10 w-10" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {discount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              -{discount}%
            </span>
          )}
          {isOutOfStock && (
            <span className="bg-gray-800/80 text-white text-xs px-2 py-0.5 rounded-full">
              Stock নেই
            </span>
          )}
          {isLowStock && (
            <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> মাত্র {product.stock}টি
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium leading-snug line-clamp-2 mb-2">{product.title}</p>
        <div className="flex items-center gap-2 mb-3">
          <span className="font-bold text-[var(--primary)]">৳{Number(product.price).toLocaleString()}</span>
          {product.compare_at_price > product.price && (
            <span className="text-xs text-[var(--muted-foreground)] line-through">
              ৳{Number(product.compare_at_price).toLocaleString()}
            </span>
          )}
        </div>

        {errMsg && <p className="text-xs text-red-500 mb-2">{errMsg}</p>}

        <Button
          size="sm"
          className="w-full"
          disabled={isOutOfStock || adding}
          variant={isOutOfStock ? "outline" : flash ? "secondary" : "default"}
          onClick={handleAddToCart}
        >
          {isOutOfStock ? "Stock নেই" : flash ? "✓ Added!" : adding ? "…" : "Cart-এ যোগ করুন"}
        </Button>
      </div>
    </div>
  );
}

// ── Product Detail Modal ───────────────────────────────────────────────────────
function ProductModal({ product, storeId, onClose, onCartChange }) {
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [qty,             setQty]             = useState(1);
  const [imgIdx,          setImgIdx]          = useState(0);
  const [errMsg,          setErrMsg]          = useState("");
  const [flash,           setFlash]           = useState(false);

  const currentPrice  = selectedVariant?.price ?? product.price;
  const currentStock  = selectedVariant?.stock ?? product.stock;
  const isOutOfStock  = currentStock === 0;
  const isLowStock    = currentStock > 0 && currentStock < 5;

  function handleAddToCart() {
    setErrMsg("");
    // Require variant selection if variants exist
    if (product.has_variants && !selectedVariant) {
      setErrMsg("প্রথমে variant বেছে নিন।");
      return;
    }
    const result = addToCart(storeId, product, selectedVariant, qty);
    if (result.success) {
      setFlash(true);
      onCartChange?.();
      setTimeout(() => { setFlash(false); onClose(); }, 1000);
    } else {
      setErrMsg(result.message);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Images */}
        <div className="aspect-square relative bg-[var(--muted)]">
          {product.images?.length > 0 && (
            <img src={product.images[imgIdx]} alt={product.title} className="w-full h-full object-cover" />
          )}
          <button
            className="absolute top-3 right-3 bg-black/50 text-white rounded-full p-1.5"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
          {/* Thumbnails */}
          {product.images?.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {product.images.map((_, i) => (
                <button
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${i === imgIdx ? "bg-white scale-125" : "bg-white/50"}`}
                  onClick={() => setImgIdx(i)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-bold">{product.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-bold text-[var(--primary)]">৳{Number(currentPrice).toLocaleString()}</span>
              {product.compare_at_price > product.price && (
                <span className="text-sm text-[var(--muted-foreground)] line-through">
                  ৳{Number(product.compare_at_price).toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Low stock warning (C1-FR: Only X left) */}
          {isLowStock && (
            <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 text-sm px-3 py-2 rounded-lg">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              মাত্র <strong>{currentStock}টি</strong> বাকি আছে!
            </div>
          )}
          {isOutOfStock && (
            <div className="bg-red-50 dark:bg-red-950/30 text-red-600 text-sm px-3 py-2 rounded-lg text-center">
              এই পণ্যটি এখন stock-এ নেই।
            </div>
          )}

          {/* Variants */}
          {product.has_variants && product.variant_types?.length > 0 && (
            <div className="space-y-3">
              {product.variant_types.map((type) => {
                const values = [...new Set(
                  (product.variants || []).map((v) => v.options?.[type]).filter(Boolean)
                )];
                return (
                  <div key={type}>
                    <p className="text-sm font-medium mb-1.5">{type}</p>
                    <div className="flex flex-wrap gap-2">
                      {values.map((val) => {
                        const matchVariant = product.variants?.find((v) => v.options?.[type] === val);
                        const outOfStock   = matchVariant?.stock === 0;
                        const isSelected   = selectedVariant?.options?.[type] === val;
                        return (
                          <button
                            key={val}
                            disabled={outOfStock}
                            onClick={() => !outOfStock && setSelectedVariant(matchVariant)}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                              isSelected
                                ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                                : outOfStock
                                ? "border-[var(--border)] text-[var(--muted-foreground)] opacity-40 cursor-not-allowed line-through"
                                : "border-[var(--border)] hover:border-[var(--primary)]"
                            }`}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quantity */}
          {!isOutOfStock && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">পরিমাণ:</span>
              <div className="flex items-center border border-[var(--border)] rounded-lg overflow-hidden">
                <button className="px-3 py-1.5 hover:bg-[var(--muted)] text-lg leading-none"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <span className="px-4 py-1.5 text-sm font-medium">{qty}</span>
                <button className="px-3 py-1.5 hover:bg-[var(--muted)] text-lg leading-none"
                  onClick={() => setQty((q) => Math.min(currentStock, q + 1))}>+</button>
              </div>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{product.description}</p>
          )}

          {errMsg && <p className="text-sm text-red-500">{errMsg}</p>}

          <Button
            className="w-full"
            disabled={isOutOfStock}
            onClick={handleAddToCart}
          >
            {flash ? "✓ Cart-এ যোগ হয়েছে!" : isOutOfStock ? "Stock নেই" : "Cart-এ যোগ করুন"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Shop Page ─────────────────────────────────────────────────────────────
export default function ShopPage() {
  const navigate             = useNavigate();
  const { isLoggedIn }       = useCustomerAuth();
  const subdomain            = getSubdomain();

  const [store,     setStore]     = useState(null);
  const [products,  setProducts]  = useState([]);
  const [status,    setStatus]    = useState("loading"); // loading | not-found | unpublished | ok
  const [cartCount, setCartCount] = useState(0);

  // Filters
  const [search,    setSearch]    = useState("");
  const [category,  setCategory]  = useState("all");
  const [sort,      setSort]      = useState("newest");
  const [priceMin,  setPriceMin]  = useState("");
  const [priceMax,  setPriceMax]  = useState("");
  const [showFilter,setShowFilter]= useState(false);

  // Modal
  const [viewProduct, setViewProduct] = useState(null);

  // ── Load store & products ──────────────────────────────────────────────────
  useEffect(() => {
    if (!subdomain) { setStatus("not-found"); return; }

    async function load() {
      const { data: storeData, error } = await supabase
        .from("stores")
        .select("*")
        .eq("subdomain", subdomain)
        .single();

      if (error || !storeData) { setStatus("not-found"); return; }
      if (!storeData.storefront_published) { setStatus("unpublished"); return; }

      setStore(storeData);

      const { data: prods } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", storeData.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      setProducts(prods || []);
      setStatus("ok");
    }
    load();
  }, [subdomain]);

  // ── Cart count ─────────────────────────────────────────────────────────────
  const refreshCartCount = useCallback(() => {
    if (!store) return;
    const { itemCount } = getCartTotals(store.id);
    setCartCount(itemCount);
  }, [store]);

  useEffect(() => { refreshCartCount(); }, [refreshCartCount]);

  // ── Derived: categories ────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
    return ["all", ...cats];
  }, [products]);

  // ── Derived: filtered & sorted products ───────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...products];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.tags?.some?.((t) => t.toLowerCase().includes(q))
      );
    }

    // Category
    if (category !== "all") {
      list = list.filter((p) => p.category === category);
    }

    // Price range
    if (priceMin !== "") list = list.filter((p) => p.price >= Number(priceMin));
    if (priceMax !== "") list = list.filter((p) => p.price <= Number(priceMax));

    // Sort
    switch (sort) {
      case "price-asc":  list.sort((a, b) => a.price - b.price); break;
      case "price-desc": list.sort((a, b) => b.price - a.price); break;
      case "newest":
      default:           list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return list;
  }, [products, search, category, sort, priceMin, priceMax]);

  // ── Brand color injection ──────────────────────────────────────────────────
  useEffect(() => {
    if (store?.brand_color) {
      document.documentElement.style.setProperty("--shop-primary", store.brand_color);
    }
  }, [store]);

  // ── Render: not found / unpublished ───────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-pulse text-[var(--muted-foreground)]">লোড হচ্ছে…</div>
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] text-center p-8">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold mb-2">Shop খুঁজে পাওয়া যায়নি</h1>
        <p className="text-[var(--muted-foreground)]">এই subdomain-এ কোনো shop নেই।</p>
      </div>
    );
  }

  if (status === "unpublished") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] text-center p-8">
        <div className="text-5xl mb-4">🚧</div>
        <h1 className="text-2xl font-bold mb-2">Shop এখন উপলব্ধ নেই</h1>
        <p className="text-[var(--muted-foreground)]">Merchant এই shop টি সাময়িকভাবে বন্ধ রেখেছেন।</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">

      {/* ── Announcement Bar ─────────────────────────────────────────────── */}
      {store.announcement_enabled && store.announcement_text && (
        <div className="bg-[var(--primary)] text-white text-xs text-center py-2 px-4">
          {store.announcement_text}
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          {/* Logo / Shop Name */}
          <div className="flex-1 font-bold text-lg truncate">
            {store.logo_url
              ? <img src={store.logo_url} alt={store.shop_name} className="h-8 object-contain" />
              : store.shop_name
            }
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Customer account */}
            <button
              className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
              onClick={() => navigate({ to: isLoggedIn ? "/customer/account" : "/customer/login" })}
              title={isLoggedIn ? "My Account" : "Login"}
            >
              <User className="h-5 w-5" />
            </button>

            {/* Cart */}
            <button
              className="relative p-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
              onClick={() => navigate({ to: "/checkout", search: { shop: subdomain } })}
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[var(--primary)] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Banner ──────────────────────────────────────────────────── */}
      {store.show_hero && (store.banner_url || store.tagline) && (
        <section
          className="relative h-48 sm:h-72 flex items-center justify-center text-center overflow-hidden"
          style={{ backgroundColor: store.brand_color || "var(--primary)" }}
        >
          {store.banner_url && (
            <img src={store.banner_url} alt="banner" className="absolute inset-0 w-full h-full object-cover opacity-50" />
          )}
          <div className="relative z-10 px-6">
            <h1 className="text-2xl sm:text-4xl font-bold text-white drop-shadow">{store.shop_name}</h1>
            {store.tagline && <p className="text-white/90 mt-2 text-sm sm:text-base">{store.tagline}</p>}
          </div>
        </section>
      )}

      {/* ── Search & Filter Bar ───────────────────────────────────────────── */}
      <div className="bg-[var(--card)] border-b border-[var(--border)] sticky top-14 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 space-y-2">
          {/* Search Input (C1-FR: real-time search) */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
            <Input
              placeholder="পণ্য খুঁজুন…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4"
            />
            {search && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
                <X className="h-4 w-4 text-[var(--muted-foreground)]" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full border transition-all ${
                  category === cat
                    ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                    : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]"
                }`}
              >
                {cat === "all" ? "সব পণ্য" : cat}
              </button>
            ))}

            {/* Sort + Filter toggle */}
            <button
              onClick={() => setShowFilter((v) => !v)}
              className="ml-auto whitespace-nowrap text-xs px-3 py-1.5 rounded-full border border-[var(--border)] flex items-center gap-1 hover:border-[var(--primary)] transition-all"
            >
              <SlidersHorizontal className="h-3 w-3" />
              Filter
            </button>
          </div>

          {/* Expanded filter panel */}
          {showFilter && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="col-span-1">
                <select
                  className="w-full border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs bg-[var(--background)]"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="newest">নতুন আগে</option>
                  <option value="price-asc">দাম: কম থেকে বেশি</option>
                  <option value="price-desc">দাম: বেশি থেকে কম</option>
                </select>
              </div>
              <Input
                className="text-xs h-8"
                placeholder="Min ৳"
                type="number"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
              />
              <Input
                className="text-xs h-8"
                placeholder="Max ৳"
                type="number"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Products Grid ─────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Result count */}
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          {filtered.length} টি পণ্য
          {search && ` "${search}" এর জন্য`}
          {category !== "all" && ` · ${category}`}
        </p>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">🔍</div>
            <h3 className="font-medium mb-1">কোনো পণ্য পাওয়া যায়নি</h3>
            <p className="text-sm text-[var(--muted-foreground)]">
              ভিন্ন keyword বা category দিয়ে খোঁজ করুন।
            </p>
            {(search || category !== "all" || priceMin || priceMax) && (
              <button
                className="mt-3 text-sm text-[var(--primary)] hover:underline"
                onClick={() => { setSearch(""); setCategory("all"); setPriceMin(""); setPriceMax(""); }}
              >
                সব filter মুছুন
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              storeId={store.id}
              onView={setViewProduct}
              onCartChange={refreshCartCount}
            />
          ))}
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)] bg-[var(--card)] mt-12">
        <div className="max-w-6xl mx-auto px-4 py-8 grid sm:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="font-bold mb-2">{store.shop_name}</p>
            {store.about_text && <p className="text-[var(--muted-foreground)] text-xs leading-relaxed">{store.about_text}</p>}
          </div>
          <div>
            <p className="font-semibold mb-2">দরকারি লিংক</p>
            <div className="space-y-1">
              <Link to="/track" search={{ shop: subdomain }} className="block text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)]">
                Order Track করুন
              </Link>
              {store.return_policy && (
                <a href="#return-policy" className="block text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)]">Return Policy</a>
              )}
              {store.shipping_policy && (
                <a href="#shipping-policy" className="block text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)]">Shipping Policy</a>
              )}
            </div>
          </div>
          <div>
            <p className="font-semibold mb-2">যোগাযোগ</p>
            <div className="space-y-1 text-xs text-[var(--muted-foreground)]">
              {store.contact_email && <p>{store.contact_email}</p>}
              {store.contact_phone && <p>{store.contact_phone}</p>}
            </div>
          </div>
        </div>
        <div className="border-t border-[var(--border)] text-center py-3 text-xs text-[var(--muted-foreground)]">
          Powered by <strong>BazarHQ</strong>
        </div>
      </footer>

      {/* ── Product Detail Modal ─────────────────────────────────────────── */}
      {viewProduct && (
        <ProductModal
          product={viewProduct}
          storeId={store.id}
          onClose={() => setViewProduct(null)}
          onCartChange={refreshCartCount}
        />
      )}
    </div>
  );
}
