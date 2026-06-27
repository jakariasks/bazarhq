// src/hooks/use-customer-auth.jsx
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CUSTOMER_OAUTH_INTENT_KEY,
  ROLE_CUSTOMER,
  ROLE_MERCHANT,
  clearAllRoleIntents,
  clearStoredIntent,
  getStoredIntent,
  getUserRole,
  safeInternalPath,
  setStoredIntent,
} from "@/lib/auth-roles";

const CustomerAuthContext = createContext(null);

function getOAuthIntent() {
  return getStoredIntent(CUSTOMER_OAUTH_INTENT_KEY);
}

function setOAuthIntent(redirectTo) {
  setStoredIntent(CUSTOMER_OAUTH_INTENT_KEY, { redirectTo });
}

function clearOAuthIntent() {
  clearStoredIntent(CUSTOMER_OAUTH_INTENT_KEY);
}

function getDisplayName(user, fallback = "") {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    fallback ||
    user?.email?.split("@")[0] ||
    "Customer"
  );
}

export function CustomerAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const getProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from("customer_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Customer profile load failed:", error.message);
    }

    return data || null;
  }, []);

  const ensureCustomerProfile = useCallback(async (user, reason = "session") => {
    if (!user) return { isCustomer: false, profile: null };

    const existingProfile = await getProfile(user.id);
    const metadataRole = getUserRole(user);
    const oauthIntent = getOAuthIntent();
    const hasCustomerIntent = reason === "signup" || reason === "oauth" || !!oauthIntent;

    if (metadataRole === ROLE_MERCHANT && !existingProfile) {
      clearOAuthIntent();
      return { isCustomer: false, profile: null, wrongRole: true };
    }

    const isCustomer = metadataRole === ROLE_CUSTOMER || !!existingProfile || hasCustomerIntent;
    if (!isCustomer) return { isCustomer: false, profile: null };

    let finalProfile = existingProfile;
    const fullName = existingProfile?.full_name || getDisplayName(user);
    const phone = existingProfile?.phone || user.user_metadata?.phone || null;

    if (!existingProfile) {
      const { data, error } = await supabase
        .from("customer_profiles")
        .upsert(
          {
            id: user.id,
            full_name: fullName,
            phone,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("Customer profile create failed:", error.message);
      } else {
        finalProfile = data;
      }
    }

    if (metadataRole !== ROLE_CUSTOMER) {
      await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          role: ROLE_CUSTOMER,
          full_name: fullName,
          phone,
        },
      });
    }

    clearOAuthIntent();
    return {
      isCustomer: true,
      profile: finalProfile || existingProfile || { id: user.id, full_name: fullName, phone },
    };
  }, [getProfile]);

  const loadCustomerFromSession = useCallback(async (session, reason = "session") => {
    const user = session?.user || null;
    if (!user) {
      setCustomer(null);
      setProfile(null);
      return null;
    }

    const result = await ensureCustomerProfile(user, reason);
    if (result.isCustomer) {
      setCustomer(user);
      setProfile(result.profile);
      return user;
    }

    setCustomer(null);
    setProfile(null);
    return null;
  }, [ensureCustomerProfile]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      await loadCustomerFromSession(session, getOAuthIntent() ? "oauth" : "session");
      if (mounted) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setLoading(true);
      setTimeout(async () => {
        if (!mounted) return;
        const reason = event === "SIGNED_IN" && getOAuthIntent() ? "oauth" : "session";
        await loadCustomerFromSession(session, reason);
        if (mounted) setLoading(false);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadCustomerFromSession]);

  async function signUp({ email, password, fullName, phone, captchaToken, redirectTo = "/customer/account" }) {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanedName = fullName.trim();
    const cleanedPhone = phone?.trim() || null;
    const safeRedirect = safeInternalPath(redirectTo, "/customer/account");

    await supabase.auth.signOut();
    clearAllRoleIntents();

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${safeRedirect}`,
        captchaToken,
        data: {
          role: ROLE_CUSTOMER,
          full_name: cleanedName,
          phone: cleanedPhone,
        },
      },
    });

    if (error) throw error;

    if (data.session?.user) {
      const result = await ensureCustomerProfile(data.session.user, "signup");
      setCustomer(data.session.user);
      setProfile(result.profile);
    }

    return data;
  }

  async function signIn({ email, password, captchaToken }) {
    await supabase.auth.signOut();
    clearAllRoleIntents();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
      options: { captchaToken },
    });

    if (error) throw error;

    const result = await ensureCustomerProfile(data.user, "signin");
    if (!result.isCustomer) {
      await supabase.auth.signOut();
      throw new Error("No customer account was found for this email address.");
    }

    setCustomer(data.user);
    setProfile(result.profile);
    return data;
  }

  async function signInWithGoogle(redirectTo = "/customer/account") {
    const safeRedirect = safeInternalPath(redirectTo, "/customer/account");

    await supabase.auth.signOut();
    clearAllRoleIntents();
    setOAuthIntent(safeRedirect);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${safeRedirect}`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      clearOAuthIntent();
      throw error;
    }
  }

  async function signOut() {
    clearAllRoleIntents();
    await supabase.auth.signOut();
    setCustomer(null);
    setProfile(null);
  }

  async function updateProfile({ fullName, phone }) {
    if (!customer) throw new Error("You must be logged in to update your profile.");

    const nextProfile = {
      id: customer.id,
      full_name: fullName.trim(),
      phone: phone?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("customer_profiles")
      .upsert(nextProfile, { onConflict: "id" })
      .select("*")
      .maybeSingle();

    if (error) throw error;
    setProfile(data || nextProfile);

    await supabase.auth.updateUser({
      data: {
        ...customer.user_metadata,
        role: ROLE_CUSTOMER,
        full_name: nextProfile.full_name,
        phone: nextProfile.phone,
      },
    });
  }

  async function changePassword({ currentPassword, newPassword }) {
    if (!customer?.email) throw new Error("Email login is required to change your password here.");

    const { error: reAuthError } = await supabase.auth.signInWithPassword({
      email: customer.email,
      password: currentPassword,
    });
    if (reAuthError) throw new Error("Your current password is incorrect.");

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async function deleteAccount() {
    if (!customer) return;
    await supabase.from("customer_profiles").delete().eq("id", customer.id);
    await signOut();
  }

  const value = {
    customer,
    profile,
    loading,
    isLoggedIn: !!customer,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    changePassword,
    deleteAccount,
    refetchProfile: async () => {
      if (!customer) return null;
      const next = await getProfile(customer.id);
      setProfile(next);
      return next;
    },
  };

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
}
