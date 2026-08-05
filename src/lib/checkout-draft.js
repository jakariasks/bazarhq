// src/lib/checkout-draft.js
// Persists guest/customer checkout preparation per store.
// Price and stock acceptance are intentionally NOT persisted; they must be
// validated again against the server after login/session restoration.

const PREFIX = "bazarhq_checkout_draft_";
const VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function storageKey(storeId) {
  return `${PREFIX}${storeId}`;
}

function cleanText(value, maxLength = 500) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function cleanDelivery(delivery = {}) {
  return {
    full_name: cleanText(delivery.full_name, 120),
    phone: cleanText(delivery.phone, 20),
    email: cleanText(delivery.email, 160),
    address: cleanText(delivery.address, 500),
    apartment: cleanText(delivery.apartment, 160),
    district: cleanText(delivery.district, 80),
    note: cleanText(delivery.note, 500),
  };
}

function clampStep(step) {
  const parsed = Number(step);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(3, Math.max(1, Math.trunc(parsed)));
}

export function getCheckoutDraft(storeId) {
  if (!storeId || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey(storeId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const updatedAt = Number(parsed?.updatedAt || 0);

    if (parsed?.version !== VERSION || !updatedAt || Date.now() - updatedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(storageKey(storeId));
      return null;
    }

    return {
      delivery: cleanDelivery(parsed.delivery),
      selectedAddressId: cleanText(parsed.selectedAddressId, 100),
      paymentMethod: cleanText(parsed.paymentMethod, 50),
      txnId: cleanText(parsed.txnId, 150),
      couponCode: cleanText(parsed.couponCode, 80),
      policyAccepted: Boolean(parsed.policyAccepted),
      step: clampStep(parsed.step),
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function saveCheckoutDraft(storeId, draft = {}) {
  if (!storeId || typeof window === "undefined") return;

  const payload = {
    version: VERSION,
    delivery: cleanDelivery(draft.delivery),
    selectedAddressId: cleanText(draft.selectedAddressId, 100),
    paymentMethod: cleanText(draft.paymentMethod, 50),
    txnId: cleanText(draft.txnId, 150),
    couponCode: cleanText(draft.couponCode, 80),
    policyAccepted: Boolean(draft.policyAccepted),
    step: clampStep(draft.step),
    updatedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(storageKey(storeId), JSON.stringify(payload));
  } catch {
    // Checkout must remain usable when storage is blocked or full.
  }
}

export function clearCheckoutDraft(storeId) {
  if (!storeId || typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(storageKey(storeId));
  } catch {
    // Ignore storage failures after a successful order.
  }
}
