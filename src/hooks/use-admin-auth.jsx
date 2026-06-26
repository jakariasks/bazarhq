// src/hooks/use-admin-auth.jsx
// A1 SRS: Separate admin auth with session management, lockout, audit log
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_SESSION_KEY  = "bazarhq_admin_session";
const SESSION_MAX_MS     = 8 * 60 * 60 * 1000;   // 8 hours
const INACTIVITY_MAX_MS  = 30 * 60 * 1000;        // 30 minutes
const MAX_FAILED         = 3;
const LOCKOUT_MINUTES    = 30;

const AdminAuthContext = createContext(null);

// ── Helpers ───────────────────────────────────────────────────────────────────
function getStoredSession() {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(data) {
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
    ...data,
    loginAt:      Date.now(),
    lastActiveAt: Date.now(),
  }));
}

function clearSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AdminAuthProvider({ children }) {
  const [admin,   setAdmin]   = useState(null);   // { id, email, role }
  const [loading, setLoading] = useState(true);
  const inactivityTimer = useRef(null);

  // ── Restore session on mount ────────────────────────────────────────────────
  useEffect(() => {
    const session = getStoredSession();
    if (session) {
      const now = Date.now();
      const expired    = (now - session.loginAt)      > SESSION_MAX_MS;
      const inactive   = (now - session.lastActiveAt) > INACTIVITY_MAX_MS;
      if (expired || inactive) {
        clearSession();
      } else {
        setAdmin({ id: session.id, email: session.email, role: session.role });
        resetInactivityTimer();
      }
    }
    setLoading(false);
  }, []);

  // ── Inactivity timer ────────────────────────────────────────────────────────
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      clearSession();
      setAdmin(null);
      window.location.href = "/superadmin/login?reason=inactive";
    }, INACTIVITY_MAX_MS);

    // Update lastActiveAt
    const session = getStoredSession();
    if (session) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ ...session, lastActiveAt: Date.now() }));
    }
  }, []);

  // Reset timer on any user interaction
  useEffect(() => {
    if (!admin) return;
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer));
    return () => events.forEach((e) => window.removeEventListener(e, resetInactivityTimer));
  }, [admin, resetInactivityTimer]);

  // ── Audit Log ───────────────────────────────────────────────────────────────
  const writeAuditLog = useCallback(async (action, details = {}, targetType = null, targetId = null) => {
    const session = getStoredSession();
    if (!session) return;

    // Get IP (best-effort)
    let ip = "unknown";
    try {
      const r = await fetch("https://api.ipify.org?format=json");
      const d = await r.json();
      ip = d.ip;
    } catch { /* ignore */ }

    await supabase.from("admin_audit_log").insert({
      admin_id:    session.id,
      admin_email: session.email,
      action,
      target_type: targetType,
      target_id:   targetId ? String(targetId) : null,
      details,
      ip_address:  ip,
    });
  }, []);

  // ── Step 1: Verify email + password ────────────────────────────────────────
  async function verifyCredentials(email, password) {
    // Fetch admin record
    const { data: adminUser, error } = await supabase
      .from("admin_users")
      .select("id, email, role, totp_enabled, totp_secret, failed_attempts, locked_until, allowed_ips")
      .eq("email", email)
      .single();

    if (error || !adminUser) throw new Error("Invalid credentials.");

    // Check lockout
    if (adminUser.locked_until && new Date(adminUser.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(adminUser.locked_until) - Date.now()) / 60000);
      throw new Error(`Account locked. Try again in ${mins} minute(s).`);
    }

    // Verify password via Supabase auth (admin must also have a Supabase auth account)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      // Increment failed attempts
      const newCount = (adminUser.failed_attempts || 0) + 1;
      const update   = { failed_attempts: newCount };
      if (newCount >= MAX_FAILED) {
        update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
        update.failed_attempts = 0;
        await writeAuditLog("login.lockout", { email, reason: `${MAX_FAILED} failed attempts` });
      }
      await supabase.from("admin_users").update(update).eq("id", adminUser.id);
      throw new Error("Invalid credentials.");
    }

    // Reset failed attempts on success
    await supabase.from("admin_users").update({ failed_attempts: 0 }).eq("id", adminUser.id);
    await supabase.auth.signOut(); // Sign out of Supabase auth — we use our own session

    return adminUser;
  }

  // ── Step 2: Verify TOTP ────────────────────────────────────────────────────
  async function verifyTOTP(adminUser, code) {
    if (!adminUser.totp_enabled) return true; // Skip if not enabled

    // NOTE: In production, verify using otplib:
    // import { authenticator } from 'otplib';
    // return authenticator.verify({ token: code, secret: adminUser.totp_secret });

    // Placeholder: accept any 6-digit code in dev (replace with real TOTP)
    if (!/^\d{6}$/.test(code)) throw new Error("Invalid 2FA code. Enter 6 digits.");

    // Real TOTP check would go here
    return true;
  }

  // ── Full login flow ─────────────────────────────────────────────────────────
  async function login(email, password, totpCode = null) {
    const adminUser = await verifyCredentials(email, password);

    if (adminUser.totp_enabled) {
      if (!totpCode) return { requiresTOTP: true, adminUser };
      await verifyTOTP(adminUser, totpCode);
    }

    // Create session
    const sessionData = { id: adminUser.id, email: adminUser.email, role: adminUser.role };
    saveSession(sessionData);
    setAdmin(sessionData);

    // Update last login
    await supabase.from("admin_users").update({ last_login_at: new Date().toISOString() }).eq("id", adminUser.id);
    await writeAuditLog("login.success", { email });

    resetInactivityTimer();
    return { success: true };
  }

  // ── Logout ──────────────────────────────────────────────────────────────────
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
