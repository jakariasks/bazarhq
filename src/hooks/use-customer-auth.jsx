// src/hooks/use-customer-auth.jsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const CustomerAuthContext = createContext(null);

export function CustomerAuthProvider({ children }) {
  const [customer, setCustomer]   = useState(null);
  const [profile,  setProfile]    = useState(null);
  const [loading,  setLoading]    = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    const { data } = await supabase
      .from("customer_profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data || null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      if (user?.user_metadata?.role === "customer") {
        setCustomer(user);
        fetchProfile(user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user?.user_metadata?.role === "customer") {
        setCustomer(user);
        fetchProfile(user.id);
      } else {
        setCustomer(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // ── Sign Up ─────────────────────────────────────────────────────────────────
  async function signUp({ email, password, fullName, phone }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: "customer", full_name: fullName, phone } },
    });
    if (error) throw error;

    if (data.user) {
      await supabase.from("customer_profiles").insert({
        id:        data.user.id,
        full_name: fullName,
        phone,
      });
    }
    return data;
  }

  // ── Sign In ─────────────────────────────────────────────────────────────────
  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user?.user_metadata?.role !== "customer") {
      await supabase.auth.signOut();
      throw new Error("এই ইমেইল দিয়ে কোনো customer account নেই।");
    }
    return data;
  }

  // ── Google OAuth ─────────────────────────────────────────────────────────────
  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/customer/account`,
        queryParams: { role: "customer" },
      },
    });
    if (error) throw error;
  }

  // ── Sign Out ─────────────────────────────────────────────────────────────────
  async function signOut() {
    await supabase.auth.signOut();
    setCustomer(null);
    setProfile(null);
  }

  // ── Update Profile ───────────────────────────────────────────────────────────
  async function updateProfile({ fullName, phone }) {
    if (!customer) return;
    const { error } = await supabase
      .from("customer_profiles")
      .update({ full_name: fullName, phone, updated_at: new Date().toISOString() })
      .eq("id", customer.id);
    if (error) throw error;
    setProfile((p) => ({ ...p, full_name: fullName, phone }));
  }

  // ── Change Password ──────────────────────────────────────────────────────────
  async function changePassword({ currentPassword, newPassword }) {
    // Re-authenticate first
    const { error: reAuthError } = await supabase.auth.signInWithPassword({
      email: customer.email,
      password: currentPassword,
    });
    if (reAuthError) throw new Error("বর্তমান পাসওয়ার্ড ভুল।");

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  // ── Delete Account ───────────────────────────────────────────────────────────
  async function deleteAccount() {
    if (!customer) return;
    // Delete profile (cascade will handle addresses)
    await supabase.from("customer_profiles").delete().eq("id", customer.id);
    // Sign out (actual user deletion requires service role — handled server-side)
    await supabase.auth.signOut();
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
    refetchProfile: () => customer && fetchProfile(customer.id),
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
