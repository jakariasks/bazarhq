// src/hooks/use-auth.jsx
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  MERCHANT_OAUTH_INTENT_KEY,
  ROLE_CUSTOMER,
  ROLE_MERCHANT,
  clearAllRoleIntents,
  clearStoredIntent,
  getStoredIntent,
  getUserRole,
} from "@/lib/auth-roles";

const Ctx = createContext({
  session: null,
  user: null,
  rawSession: null,
  rawUser: null,
  loading: true,
  emailVerified: false,
  isMerchant: false,
  wrongRole: false,
  wrongRoleEmail: null,
  signOut: async () => {},
});

async function hasMerchantRecord(userId) {
  if (!userId) return false;

  const [{ data: profile }, { data: store }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("stores")
      .select("id")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle(),
  ]);

  return !!profile || !!store;
}

async function resolveMerchantSession(session) {
  const user = session?.user || null;
  if (!user) return { isMerchant: false, user: null, session: null, wrongRole: false };

  const role = getUserRole(user);
  const merchantIntent = getStoredIntent(MERCHANT_OAUTH_INTENT_KEY);

  if (role === ROLE_MERCHANT) {
    clearStoredIntent(MERCHANT_OAUTH_INTENT_KEY);
    return { isMerchant: true, user, session, wrongRole: false };
  }

  if (role === ROLE_CUSTOMER && !merchantIntent) {
    return { isMerchant: false, user: null, session: null, wrongRole: true };
  }

  const hasRecord = await hasMerchantRecord(user.id);
  if (hasRecord || merchantIntent) {
    if (role !== ROLE_MERCHANT) {
      await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          role: ROLE_MERCHANT,
          full_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "Merchant",
        },
      });
    }

    clearStoredIntent(MERCHANT_OAUTH_INTENT_KEY);
    return { isMerchant: true, user, session, wrongRole: false };
  }

  return { isMerchant: false, user: null, session: null, wrongRole: true };
}

export function AuthProvider({ children }) {
  const [rawSession, setRawSession] = useState(null);
  const [session, setSession] = useState(null);
  const [wrongRole, setWrongRole] = useState(false);
  const [wrongRoleEmail, setWrongRoleEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const applySession = useCallback(
    async (nextSession) => {
      setRawSession(nextSession || null);

      const resolved = await resolveMerchantSession(nextSession);
      setSession(resolved.session);
      setWrongRole(resolved.wrongRole);
      setWrongRoleEmail(resolved.wrongRole ? nextSession?.user?.email || null : null);
      queryClient.invalidateQueries();
    },
    [queryClient]
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      await applySession(data.session);
      if (mounted) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setLoading(true);
      setTimeout(async () => {
        if (!mounted) return;
        await applySession(nextSession);
        if (mounted) setLoading(false);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const user = session?.user ?? null;
  const rawUser = rawSession?.user ?? null;

  const emailVerified = user
    ? user.email_confirmed_at != null || user.user_metadata?.signup_method === "phone"
    : false;

  const value = {
    session,
    user,
    rawSession,
    rawUser,
    loading,
    emailVerified,
    isMerchant: !!user,
    wrongRole,
    wrongRoleEmail,
    signOut: async () => {
      clearAllRoleIntents();
      await supabase.auth.signOut();
      setRawSession(null);
      setSession(null);
      setWrongRole(false);
      setWrongRoleEmail(null);
      queryClient.clear();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
