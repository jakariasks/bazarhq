// src/hooks/use-customer-auth.jsx

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
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

const MOBILE_AUTH_CALLBACK = "com.bazarhq.app://auth/callback";

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

function getAuthorizationCode(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.searchParams.get("code");
  } catch (error) {
    console.error("Invalid OAuth callback URL:", error);
    return null;
  }
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

  const ensureCustomerProfile = useCallback(
    async (user, reason = "session") => {
      if (!user) {
        return {
          isCustomer: false,
          profile: null,
        };
      }

      const existingProfile = await getProfile(user.id);
      const metadataRole = getUserRole(user);
      const oauthIntent = getOAuthIntent();

      const hasCustomerIntent =
        reason === "signup" || reason === "oauth" || Boolean(oauthIntent);

      if (metadataRole === ROLE_MERCHANT && !existingProfile) {
        clearOAuthIntent();

        return {
          isCustomer: false,
          profile: null,
          wrongRole: true,
        };
      }

      const isCustomer =
        metadataRole === ROLE_CUSTOMER ||
        Boolean(existingProfile) ||
        hasCustomerIntent;

      if (!isCustomer) {
        return {
          isCustomer: false,
          profile: null,
        };
      }

      let finalProfile = existingProfile;

      const fullName =
        existingProfile?.full_name || getDisplayName(user);

      const phone =
        existingProfile?.phone ||
        user.user_metadata?.phone ||
        null;

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
            {
              onConflict: "id",
            }
          )
          .select("*")
          .maybeSingle();

        if (error) {
          console.error(
            "Customer profile create failed:",
            error.message
          );
        } else {
          finalProfile = data;
        }
      }

      if (metadataRole !== ROLE_CUSTOMER) {
        const { error } = await supabase.auth.updateUser({
          data: {
            ...user.user_metadata,
            role: ROLE_CUSTOMER,
            full_name: fullName,
            phone,
          },
        });

        if (error) {
          console.error(
            "Customer metadata update failed:",
            error.message
          );
        }
      }

      clearOAuthIntent();

      return {
        isCustomer: true,
        profile:
          finalProfile ||
          existingProfile || {
            id: user.id,
            full_name: fullName,
            phone,
          },
      };
    },
    [getProfile]
  );

  const loadCustomerFromSession = useCallback(
    async (session, reason = "session") => {
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
    },
    [ensureCustomerProfile]
  );

  const handleOAuthCallback = useCallback(
    async (url) => {
      if (!url?.startsWith(MOBILE_AUTH_CALLBACK)) {
        return;
      }

      setLoading(true);

      try {
        const code = getAuthorizationCode(url);

        if (!code) {
          throw new Error(
            "Google login callback did not contain an authorization code."
          );
        }

        const { data, error } =
          await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          throw error;
        }

        await Browser.close();

        await loadCustomerFromSession(
          data.session,
          "oauth"
        );

        const storedIntent = getOAuthIntent();
        const redirectPath = safeInternalPath(
          storedIntent?.redirectTo,
          "/customer/account"
        );

        clearOAuthIntent();

        window.location.replace(redirectPath);
      } catch (error) {
        console.error(
          "Google OAuth callback failed:",
          error
        );

        clearOAuthIntent();

        try {
          await Browser.close();
        } catch {
          // Browser may already be closed.
        }
      } finally {
        setLoading(false);
      }
    },
    [loadCustomerFromSession]
  );

  useEffect(() => {
    let mounted = true;
    let appUrlListener = null;

    const initializeAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      await loadCustomerFromSession(
        session,
        getOAuthIntent() ? "oauth" : "session"
      );

      if (mounted) {
        setLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setLoading(true);

        setTimeout(async () => {
          if (!mounted) return;

          const reason =
            event === "SIGNED_IN" && getOAuthIntent()
              ? "oauth"
              : "session";

          await loadCustomerFromSession(
            session,
            reason
          );

          if (mounted) {
            setLoading(false);
          }
        }, 0);
      }
    );

    const initializeDeepLinkListener = async () => {
      if (!Capacitor.isNativePlatform()) {
        return;
      }

      appUrlListener = await App.addListener(
        "appUrlOpen",
        ({ url }) => {
          handleOAuthCallback(url);
        }
      );

      const launchUrl = await App.getLaunchUrl();

      if (launchUrl?.url) {
        await handleOAuthCallback(launchUrl.url);
      }
    };

    initializeDeepLinkListener();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      appUrlListener?.remove();
    };
  }, [handleOAuthCallback, loadCustomerFromSession]);

  async function signUp({
    email,
    password,
    fullName,
    phone,
    captchaToken,
    redirectTo = "/customer/account",
  }) {
    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const cleanedName = fullName.trim();
    const cleanedPhone = phone?.trim() || null;

    const safeRedirect = safeInternalPath(
      redirectTo,
      "/customer/account"
    );

    await supabase.auth.signOut();
    clearAllRoleIntents();

    const emailRedirectTo =
      Capacitor.isNativePlatform()
        ? MOBILE_AUTH_CALLBACK
        : `${window.location.origin}${safeRedirect}`;

    const { data, error } =
      await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo,
          captchaToken,
          data: {
            role: ROLE_CUSTOMER,
            full_name: cleanedName,
            phone: cleanedPhone,
          },
        },
      });

    if (error) {
      throw error;
    }

    if (data.session?.user) {
      const result = await ensureCustomerProfile(
        data.session.user,
        "signup"
      );

      setCustomer(data.session.user);
      setProfile(result.profile);
    }

    return data;
  }

  async function signIn({
    email,
    password,
    captchaToken,
  }) {
    await supabase.auth.signOut();
    clearAllRoleIntents();

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
        options: {
          captchaToken,
        },
      });

    if (error) {
      throw error;
    }

    const result = await ensureCustomerProfile(
      data.user,
      "signin"
    );

    if (!result.isCustomer) {
      await supabase.auth.signOut();

      throw new Error(
        "No customer account was found for this email address."
      );
    }

    setCustomer(data.user);
    setProfile(result.profile);

    return data;
  }

  async function signInWithGoogle(
    redirectTo = "/customer/account"
  ) {
    const safeRedirect = safeInternalPath(
      redirectTo,
      "/customer/account"
    );

    await supabase.auth.signOut();
    clearAllRoleIntents();
    setOAuthIntent(safeRedirect);

    const isNative =
      Capacitor.isNativePlatform();

    const redirectUrl = isNative
      ? MOBILE_AUTH_CALLBACK
      : `${window.location.origin}${safeRedirect}`;

    const { data, error } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: isNative,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

    if (error) {
      clearOAuthIntent();
      throw error;
    }

    if (isNative) {
      if (!data?.url) {
        clearOAuthIntent();

        throw new Error(
          "Google login URL was not returned."
        );
      }

      await Browser.open({
        url: data.url,
      });
    }
  }

  async function signOut() {
    clearAllRoleIntents();

    await supabase.auth.signOut();

    setCustomer(null);
    setProfile(null);
  }

  async function updateProfile({
    fullName,
    phone,
  }) {
    if (!customer) {
      throw new Error(
        "You must be logged in to update your profile."
      );
    }

    const nextProfile = {
      id: customer.id,
      full_name: fullName.trim(),
      phone: phone?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("customer_profiles")
      .upsert(nextProfile, {
        onConflict: "id",
      })
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    setProfile(data || nextProfile);

    const { error: updateError } =
      await supabase.auth.updateUser({
        data: {
          ...customer.user_metadata,
          role: ROLE_CUSTOMER,
          full_name: nextProfile.full_name,
          phone: nextProfile.phone,
        },
      });

    if (updateError) {
      throw updateError;
    }
  }

  async function changePassword({
    currentPassword,
    newPassword,
  }) {
    if (!customer?.email) {
      throw new Error(
        "Email login is required to change your password here."
      );
    }

    const { error: reAuthError } =
      await supabase.auth.signInWithPassword({
        email: customer.email,
        password: currentPassword,
      });

    if (reAuthError) {
      throw new Error(
        "Your current password is incorrect."
      );
    }

    const { error } =
      await supabase.auth.updateUser({
        password: newPassword,
      });

    if (error) {
      throw error;
    }
  }

  async function deleteAccount() {
    if (!customer) return;

    await supabase
      .from("customer_profiles")
      .delete()
      .eq("id", customer.id);

    await signOut();
  }

  const value = {
    customer,
    profile,
    loading,
    isLoggedIn: Boolean(customer),
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    changePassword,
    deleteAccount,

    refetchProfile: async () => {
      if (!customer) return null;

      const nextProfile = await getProfile(
        customer.id
      );

      setProfile(nextProfile);

      return nextProfile;
    },
  };

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(
    CustomerAuthContext
  );

  if (!context) {
    throw new Error(
      "useCustomerAuth must be used within CustomerAuthProvider"
    );
  }

  return context;
}