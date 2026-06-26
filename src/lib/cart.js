// src/lib/cart.js
// Cart persisted in localStorage keyed by storeId (C2 SRS)

const PREFIX = "bazarhq_cart_";

function getKey(storeId) {
  return `${PREFIX}${storeId}`;
}

// ── Read ───────────────────────────────────────────────────────────────────────
export function getCart(storeId) {
  try {
    const raw = localStorage.getItem(getKey(storeId));
    if (!raw) return { items: [], updatedAt: Date.now() };
    return JSON.parse(raw);
  } catch {
    return { items: [], updatedAt: Date.now() };
  }
}

// ── Write ──────────────────────────────────────────────────────────────────────
function saveCart(storeId, cart) {
  cart.updatedAt = Date.now();
  localStorage.setItem(getKey(storeId), JSON.stringify(cart));
}

// ── Add Item ───────────────────────────────────────────────────────────────────
// Returns { success, message } — may fail if out of stock
export function addToCart(storeId, product, variant = null, qty = 1) {
  const cart = getCart(storeId);
  const key  = buildKey(product.id, variant);

  const availableStock = variant ? (variant.stock ?? product.stock) : product.stock;

  // Out of stock guard (C2-FR)
  if (availableStock === 0) {
    return { success: false, message: "পণ্যটি stock-এ নেই।" };
  }

  const existing = cart.items.find((i) => i.key === key);

  if (existing) {
    const newQty = existing.qty + qty;
    // Stock cap (C2-FR: cannot exceed available stock)
    if (newQty > availableStock) {
      return {
        success: false,
        message: `সর্বোচ্চ ${availableStock}টি add করা যাবে।`,
      };
    }
    existing.qty = newQty;
  } else {
    if (qty > availableStock) {
      return {
        success: false,
        message: `সর্বোচ্চ ${availableStock}টি add করা যাবে।`,
      };
    }
    cart.items.push({
      key,
      productId:    product.id,
      title:        product.title,
      image:        product.images?.[0] || null,
      price:        variant?.price ?? product.price,   // stored price at time of adding
      originalPrice: variant?.price ?? product.price,  // for price change detection
      stock:        availableStock,                     // for qty cap enforcement
      variantId:    variant?.id    || null,
      variantLabel: buildVariantLabel(variant),
      qty,
    });
  }

  saveCart(storeId, cart);
  return { success: true };
}

// ── Update Quantity ────────────────────────────────────────────────────────────
export function updateQty(storeId, key, qty) {
  const cart = getCart(storeId);
  const item = cart.items.find((i) => i.key === key);
  if (!item) return;

  // Enforce stock cap
  const capped = Math.min(qty, item.stock);

  if (capped <= 0) {
    removeItem(storeId, key);
    return;
  }
  item.qty = capped;
  saveCart(storeId, cart);
}

// ── Remove Item ────────────────────────────────────────────────────────────────
export function removeItem(storeId, key) {
  const cart = getCart(storeId);
  cart.items = cart.items.filter((i) => i.key !== key);
  saveCart(storeId, cart);
}

// ── Clear Cart ─────────────────────────────────────────────────────────────────
export function clearCart(storeId) {
  localStorage.removeItem(getKey(storeId));
}

// ── Sync Prices (C2-FR: price change detection) ────────────────────────────────
// Call this at checkout init with fresh product data from the DB.
// Returns list of items whose price changed.
export function syncCartPrices(storeId, freshProducts) {
  const cart     = getCart(storeId);
  const changed  = [];

  cart.items.forEach((item) => {
    const fresh = freshProducts.find((p) => p.id === item.productId);
    if (!fresh) return;

    const freshPrice = item.variantId
      ? fresh.variants?.find((v) => v.id === item.variantId)?.price ?? fresh.price
      : fresh.price;

    if (freshPrice !== item.price) {
      changed.push({
        key:      item.key,
        title:    item.title,
        oldPrice: item.price,
        newPrice: freshPrice,
      });
      item.price = freshPrice;
    }

    // Also update stock cap
    const freshStock = item.variantId
      ? fresh.variants?.find((v) => v.id === item.variantId)?.stock ?? fresh.stock
      : fresh.stock;
    item.stock = freshStock;
    if (item.qty > freshStock) {
      item.qty = freshStock;
    }
  });

  // Remove items that are now 0 stock
  cart.items = cart.items.filter((i) => i.stock > 0);

  saveCart(storeId, cart);
  return changed; // empty array = no changes
}

// ── Totals ─────────────────────────────────────────────────────────────────────
export function getCartTotals(storeId, deliveryCharge = 0) {
  const { items } = getCart(storeId);
  const subtotal  = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const total     = subtotal + deliveryCharge;
  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);
  return { subtotal, total, itemCount, items };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function buildKey(productId, variant) {
  return variant ? `${productId}_${variant.id}` : `${productId}`;
}

function buildVariantLabel(variant) {
  if (!variant) return null;
  if (variant.options) {
    return Object.entries(variant.options).map(([k, v]) => `${k}: ${v}`).join(", ");
  }
  return variant.label || null;
}
