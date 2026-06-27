// src/hooks/use-admin-auth.jsx
// BazarHQ Super Admin Auth
// Fixes: admin_users 406/no-row errors, email normalization, clearer dev errors,
// role/session separation, and stale Supabase session conflicts.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_SESSION_KEY = "bazarhq_admin_session";
const SESSION_MAX_MS = 8 * 60 * 60 * 1000; // 8 hours
const INACTIVITY_MAX_MS = 30 * 60 * 1000; // 30 minutes
const MAX_FAILED = 3;
const LOCKOUT_MINUTES = 30;

const AdminAuthContext = createContext(null);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getStoredSession() {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(data) {
  sessionStorage.setItem(
    ADMIN_SESSION_KEY,
    JSON.stringify({
      ...data,
      loginAt: Date.now(),
      lastActiveAt: Date.now(),
    }),
  );
}

function clearSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimer = useRef(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);

    inactivityTimer.current = setTimeout(() => {
      clearSession();
      setAdmin(null);
      window.location.href = "/superadmin/login?reason=inactive";
    }, INACTIVITY_MAX_MS);

    const session = getStoredSession();
    if (session) {
      sessionStorage.setItem(
        ADMIN_SESSION_KEY,
        JSON.stringify({ ...session, lastActiveAt: Date.now() }),
      );
    }
  }, []);

  useEffect(() => {
    const session = getStoredSession();

    if (session) {
      const now = Date.now();
      const expired = now - session.loginAt > SESSION_MAX_MS;
      const inactive = now - session.lastActiveAt > INACTIVITY_MAX_MS;

      if (expired || inactive) {
        clearSession();
      } else {
        setAdmin({ id: session.id, email: session.email, role: session.role });
        resetInactivityTimer();
      }
    }

    setLoading(false);
  }, [resetInactivityTimer]);

  useEffect(() => {
    if (!admin) return undefined;

    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((eventName) => window.addEventListener(eventName, resetInactivityTimer));

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, resetInactivityTimer));
    };
  }, [admin, resetInactivityTimer]);

  const writeAuditLog = useCallback(async (action, details = {}, targetType = null, targetId = null) => {
    const session = getStoredSession();
    if (!session) return;

    await supabase.from("admin_audit_log").insert({
      admin_id: session.id,
      admin_email: session.email,
      action,
      target_type: targetType,
      target_id: targetId ? String(targetId) : null,
      details,
      ip_address: "browser-client",
    });
  }, []);

  async function verifyCredentials(rawEmail, password) {
    const email = normalizeEmail(rawEmail);

    if (!email || !password) {
      throw new Error("Enter admin email and password.");
    }

    // maybeSingle avoids the browser console 406 error when no row is visible/found.
    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("id, email, role, totp_enabled, totp_secret, failed_attempts, locked_until, allowed_ips")
      .ilike("email", email)
      .maybeSingle();

    if (adminError) {
      throw new Error(
        `Admin lookup failed. Run supabase-superadmin-login-fix.sql first. Details: ${adminError.message}`,
      );
    }

    if (!adminUser) {
      throw new Error(
        `Admin email not found in admin_users: ${email}. Run supabase-superadmin-login-fix.sql first.`,
      );
    }

    if (adminUser.locked_until && new Date(adminUser.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(adminUser.locked_until).getTime() - Date.now()) / 60000);
      throw new Error(`Account locked. Try again in ${mins} minute(s).`);
    }

    // Avoid merchant/customer Supabase sessions affecting admin password verification.
    await supabase.auth.signOut();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      const newCount = (adminUser.failed_attempts || 0) + 1;
      const update = { failed_attempts: newCount };

      if (newCount >= MAX_FAILED) {
        update.failed_attempts = 0;
        update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
      }

      await supabase.from("admin_users").update(update).eq("id", adminUser.id);

      if (/email.*confirm/i.test(authError.message || "")) {
        throw new Error("Admin Auth user exists but email is not confirmed. Confirm it in Supabase Authentication → Users.");
      }

      throw new Error(
        "Invalid password or Supabase Auth user missing. Create the same email in Supabase Authentication → Users with Auto Confirm ON.",
      );
    }

    await supabase.from("admin_users").update({ failed_attempts: 0, locked_until: null }).eq("id", adminUser.id);

    // Admin panel uses its own sessionStorage session after password verification.
    await supabase.auth.signOut();

    return { ...adminUser, email };
  }

  async function verifyTOTP(adminUser, code) {
    if (!adminUser.totp_enabled) return true;

    if (!/^\d{6}$/.test(String(code || ""))) {
      throw new Error("Invalid 2FA code. Enter 6 digits.");
    }

    // Development placeholder. Replace with server-side TOTP verification in production.
    return true;
  }

  async function login(email, password, totpCode = null) {
    const adminUser = await verifyCredentials(email, password);

    if (adminUser.totp_enabled) {
      if (!totpCode) return { requiresTOTP: true, adminUser };
      await verifyTOTP(adminUser, totpCode);
    }

    const sessionData = {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    };

    saveSession(sessionData);
    setAdmin(sessionData);

    await supabase
      .from("admin_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", adminUser.id);

    await writeAuditLog("login.success", { email: adminUser.email });
    resetInactivityTimer();

    return { success: true };
  }

  async function logout() {
    await writeAuditLog("logout");
    clearSession();
    setAdmin(null);

    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
  }

  const value = {
    admin,
    loading,
    isLoggedIn: !!admin,
    isFullAccess: admin?.role === "full_access",
    login,
    logout,
    writeAuditLog,
    resetInactivityTimer,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be within AdminAuthProvider");
  return ctx;
}
