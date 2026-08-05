// src/lib/cart.js
// Cart persisted in localStorage per store.

const PREFIX = "bazarhq_cart_";
const MAX_LINE_ITEMS = 50;

function getStorageKey(storeId) {
  return `${PREFIX}${storeId}`;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getVariantId(variant) {
  if (!variant) return null;
  return (
    variant.id ||
    variant.combo ||
    variant.label ||
    (variant.options ? JSON.stringify(variant.options) : null)
  );
}

function buildVariantLabel(variant) {
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

function buildItemKey(productId, variant) {
  const variantId = getVariantId(variant);
  return variantId ? `${productId}_${variantId}` : String(productId);
}

function findFreshVariant(variants = [], item) {
  if (!Array.isArray(variants) || !item?.variantId) return null;

  return variants.find((variant) => {
    const id = getVariantId(variant);
    const label = buildVariantLabel(variant);
    return id === item.variantId || label === item.variantLabel;
  }) || null;
}

export function getCart(storeId) {
  if (!storeId) return { items: [], updatedAt: Date.now() };

  try {
    const raw = localStorage.getItem(getStorageKey(storeId));
    if (!raw) return { items: [], updatedAt: Date.now() };

    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch {
    return { items: [], updatedAt: Date.now() };
  }
}

function saveCart(storeId, cart) {
  if (!storeId) return;
  localStorage.setItem(
    getStorageKey(storeId),
    JSON.stringify({ ...cart, updatedAt: Date.now() })
  );
}

export function addToCart(storeId, product, variant = null, qty = 1) {
  if (!storeId || !product?.id) {
    return { success: false, message: "Could not update the cart." };
  }

  const requestedQty = Math.max(1, toNumber(qty, 1));
  const availableStock = toNumber(variant?.stock ?? product.stock, 0);

  if (availableStock <= 0) {
    return { success: false, message: "This product is out of stock." };
  }

  if (requestedQty > availableStock) {
    return { success: false, message: `Only ${availableStock} item(s) can be added.` };
  }

  const cart = getCart(storeId);
  const key = buildItemKey(product.id, variant);
  const existing = cart.items.find((item) => item.key === key);

  if (existing) {
    const nextQty = existing.qty + requestedQty;
    if (nextQty > availableStock) {
      return { success: false, message: `Only ${availableStock} item(s) can be added.` };
    }

    existing.qty = nextQty;
    existing.stock = availableStock;
    existing.price = toNumber(variant?.price ?? product.price, existing.price);
    saveCart(storeId, cart);
    return { success: true };
  }

  if (cart.items.length >= MAX_LINE_ITEMS) {
    return { success: false, message: `You can add up to ${MAX_LINE_ITEMS} different items.` };
  }

  const price = toNumber(variant?.price ?? product.price, 0);

  cart.items.push({
    key,
    productId: product.id,
    title: product.title,
    image: product.images?.[0] || null,
    price,
    originalPrice: price,
    stock: availableStock,
    variantId: getVariantId(variant),
    variantLabel: buildVariantLabel(variant),
    qty: requestedQty,
  });

  saveCart(storeId, cart);
  return { success: true };
}

export function updateQty(storeId, key, qty) {
  const cart = getCart(storeId);
  const item = cart.items.find((cartItem) => cartItem.key === key);
  if (!item) return;

  const nextQty = Math.min(Math.max(0, toNumber(qty, 0)), toNumber(item.stock, 0));

  if (nextQty <= 0) {
    removeItem(storeId, key);
    return;
  }

  item.qty = nextQty;
  saveCart(storeId, cart);
}

export function removeItem(storeId, key) {
  const cart = getCart(storeId);
  cart.items = cart.items.filter((item) => item.key !== key);
  saveCart(storeId, cart);
}

export function clearCart(storeId) {
  if (!storeId) return;
  localStorage.removeItem(getStorageKey(storeId));
}

export function reconcileCartWithProducts(storeId, freshProducts) {
  const cart = getCart(storeId);
  const products = Array.isArray(freshProducts) ? freshProducts : [];
  const priceChanges = [];
  const stockChanges = [];
  const nextItems = [];

  cart.items.forEach((item) => {
    const freshProduct = products.find((product) => product.id === item.productId);
    const productIsInactive = freshProduct?.status && !["published", "active"].includes(freshProduct.status);

    if (!freshProduct || productIsInactive) {
      stockChanges.push({
        key: item.key,
        title: item.title,
        type: "removed",
        message: `${item.title} is no longer available and was removed from the cart.`,
      });
      return;
    }

    const freshVariant = item.variantId ? findFreshVariant(freshProduct.variants, item) : null;

    if (item.variantId && !freshVariant) {
      stockChanges.push({
        key: item.key,
        title: item.title,
        type: "removed",
        message: `${item.title} (${item.variantLabel || "selected option"}) is no longer available and was removed from the cart.`,
      });
      return;
    }

    const freshPrice = toNumber(freshVariant?.price ?? freshProduct.price, 0);
    const freshStock = Math.max(0, toNumber(freshVariant?.stock ?? freshProduct.stock, 0));

    if (freshPrice !== toNumber(item.price, 0)) {
      priceChanges.push({
        key: item.key,
        title: item.title,
        oldPrice: toNumber(item.price, 0),
        newPrice: freshPrice,
      });
      item.price = freshPrice;
    }

    item.stock = freshStock;

    if (freshStock <= 0) {
      stockChanges.push({
        key: item.key,
        title: item.title,
        type: "removed",
        message: `${item.title} is out of stock and was removed from the cart.`,
      });
      return;
    }

    if (toNumber(item.qty, 0) > freshStock) {
      const oldQty = toNumber(item.qty, 0);
      item.qty = freshStock;
      stockChanges.push({
        key: item.key,
        title: item.title,
        type: "quantity-adjusted",
        oldQty,
        newQty: freshStock,
        message: `${item.title} quantity was changed from ${oldQty} to ${freshStock} because stock changed.`,
      });
    }

    if (toNumber(item.qty, 0) > 0) nextItems.push(item);
  });

  cart.items = nextItems;
  saveCart(storeId, cart);

  return { priceChanges, stockChanges, items: nextItems };
}

export function syncCartPrices(storeId, freshProducts) {
  return reconcileCartWithProducts(storeId, freshProducts).priceChanges;
}

export function getCartTotals(storeId, deliveryCharge = 0) {
  const { items } = getCart(storeId);
  const subtotal = items.reduce(
    (sum, item) => sum + toNumber(item.price, 0) * toNumber(item.qty, 0),
    0
  );
  const total = subtotal + toNumber(deliveryCharge, 0);
  const itemCount = items.reduce((sum, item) => sum + toNumber(item.qty, 0), 0);

  return { subtotal, total, itemCount, items };
}
