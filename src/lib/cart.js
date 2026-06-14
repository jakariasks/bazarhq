// Cart persisted in localStorage, keyed by storeId
const KEY = (storeId) => `bazarhq_cart_${storeId}`
const MAX_ITEMS = 50 // SRS C2-NFR: max 50 line items

export function getCart(storeId) {
  if (!storeId) return []
  try {
    const raw = localStorage.getItem(KEY(storeId))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function setCart(storeId, items) {
  if (!storeId) return
  try { localStorage.setItem(KEY(storeId), JSON.stringify(items)) } catch {}
}

export function clearCart(storeId) {
  if (!storeId) return
  try { localStorage.removeItem(KEY(storeId)) } catch {}
}

// Returns { success, next, error }
export function addToCart(storeId, item) {
  const cart = getCart(storeId)
  const existing = cart.find(i => i.id === item.id)

  if (existing) {
    // SRS C2-FR: cannot exceed available stock
    const newQty = existing.qty + 1
    if (item.stock != null && newQty > item.stock) {
      return { success: false, error: `Only ${item.stock} in stock`, next: cart }
    }
    const next = cart.map(i => i.id === item.id ? { ...i, qty: newQty } : i)
    setCart(storeId, next)
    return { success: true, next }
  }

  // SRS C2-NFR: max 50 line items
  if (cart.length >= MAX_ITEMS) {
    return { success: false, error: 'Cart limit reached (max 50 items)', next: cart }
  }

  // SRS C2-FR: cannot add out-of-stock
  if (item.stock != null && item.stock <= 0) {
    return { success: false, error: 'This item is out of stock', next: cart }
  }

  const next = [...cart, { ...item, qty: 1 }]
  setCart(storeId, next)
  return { success: true, next }
}

// Returns new cart
export function updateQty(storeId, itemId, delta, stockMap = {}) {
  const cart = getCart(storeId)
  const next = cart.map(i => {
    if (i.id !== itemId) return i
    const newQty = i.qty + delta
    if (newQty <= 0) return { ...i, qty: 0 }
    // respect stock limit
    const maxStock = stockMap[i.id] ?? i.stock ?? Infinity
    return { ...i, qty: Math.min(newQty, maxStock) }
  }).filter(i => i.qty > 0)
  setCart(storeId, next)
  return next
}

export function removeFromCart(storeId, itemId) {
  const next = getCart(storeId).filter(i => i.id !== itemId)
  setCart(storeId, next)
  return next
}

export function cartTotal(items) {
  // SRS C2-NFR: accurate to 2 decimal places
  return Math.round(items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100
}

export function cartCount(items) {
  return items.reduce((s, i) => s + i.qty, 0)
}

// Generate order ID: BHQ-YYYYMMDD-XXXX
export function generateOrderId() {
  const d = new Date()
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  const rand = Math.random().toString(36).slice(2,6).toUpperCase()
  return `BHQ-${date}-${rand}`
}

// SRS C2: Check if any cart items are now out of stock or price changed
// Returns array of issues: { id, title, type: 'outofstock'|'pricechange', newPrice?, newStock? }
export async function validateCartAgainstDB(storeId, supabase) {
  const cart = getCart(storeId)
  if (!cart.length) return { issues: [], cart }

  const ids = cart.map(i => i.id)
  const { data: products } = await supabase
    .from('products')
    .select('id, title, price, stock, status')
    .in('id', ids)

  if (!products) return { issues: [], cart }

  const issues = []
  const updatedCart = []

  for (const item of cart) {
    const product = products.find(p => p.id === item.id)

    if (!product || product.status !== 'published') {
      issues.push({ id: item.id, title: item.title, type: 'unavailable' })
      continue // drop from cart
    }

    if (product.stock <= 0) {
      issues.push({ id: item.id, title: item.title, type: 'outofstock' })
      continue // drop from cart
    }

    const cappedQty = Math.min(item.qty, product.stock)
    const priceChanged = Math.abs(Number(product.price) - Number(item.price)) > 0.01

    if (priceChanged) {
      issues.push({ id: item.id, title: item.title, type: 'pricechange', oldPrice: item.price, newPrice: Number(product.price) })
    }

    updatedCart.push({
      ...item,
      qty: cappedQty,
      price: Number(product.price), // always use latest price
      stock: product.stock,
    })
  }

  setCart(storeId, updatedCart)
  return { issues, cart: updatedCart }
}
