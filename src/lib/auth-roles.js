// src/lib/auth-roles.js
// Shared helpers to keep merchant and customer authentication from accepting the wrong account type.

export const ROLE_MERCHANT = "merchant";
export const ROLE_CUSTOMER = "customer";

export const MERCHANT_OAUTH_INTENT_KEY = "bazarhq_merchant_oauth_intent";
export const CUSTOMER_OAUTH_INTENT_KEY = "bazarhq_customer_oauth_intent";

const INTENT_MAX_AGE_MS = 15 * 60 * 1000;

export function getUserRole(user) {
  return user?.user_metadata?.role || user?.app_metadata?.role || null;
}

export function safeInternalPath(path, fallback = "/") {
  if (typeof path !== "string") return fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}

export function getStoredIntent(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.createdAt || Date.now() - parsed.createdAt > INTENT_MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function setStoredIntent(key, data = {}) {
  localStorage.setItem(
    key,
    JSON.stringify({ ...data, createdAt: Date.now() })
  );
}

export function clearStoredIntent(key) {
  localStorage.removeItem(key);
}

export function clearAllRoleIntents() {
  clearStoredIntent(MERCHANT_OAUTH_INTENT_KEY);
  clearStoredIntent(CUSTOMER_OAUTH_INTENT_KEY);
}
