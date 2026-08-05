// src/components/auth-guard.jsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Loader2, Mail, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MerchantMfaGate } from "@/components/merchant-mfa-gate";

export function AuthGuard({ children }) {
  const { user, loading, emailVerified, wrongRole, wrongRoleEmail, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!loading && !user && !wrongRole) {
      navigate({ to: "/login", search: { redirect: location.pathname } });
    }
  }, [loading, user, wrongRole, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (wrongRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-mesh p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-elegant">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Merchant account required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This browser is currently signed in as a customer
            {wrongRoleEmail ? (
              <>
                {" "}(<strong className="text-foreground">{wrongRoleEmail}</strong>)
              </>
            ) : null}
            . Merchant dashboard access is blocked for customer accounts.
          </p>
          <Button
            className="mt-6 w-full"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login", search: { redirect: location.pathname } });
            }}
          >
            Sign out and log in as merchant
          </Button>
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={() => navigate({ to: "/shop" })}
          >
            Go to storefront
          </Button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (!emailVerified) {
    const handleResend = async () => {
      setResending(true);
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
        options: { emailRedirectTo: `${window.location.origin}/merchant` },
      });
      setResending(false);

      if (error) {
        toast.error(error.message);
        return;
      }

      setResent(true);
      toast.success("Verification email sent!");
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-mesh p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-elegant">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Verify your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a verification link to <strong className="text-foreground">{user.email}</strong>.
            <br />Please verify before accessing your dashboard.
          </p>
          {resent ? (
            <p className="mt-4 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
              ✓ Verification email sent. Check your inbox.
            </p>
          ) : (
            <Button onClick={handleResend} disabled={resending} variant="outline" className="mt-6 gap-2">
              {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Resend verification email
            </Button>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-4 block w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Already verified? Refresh this page
          </button>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
            className="mt-3 block w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Sign out and use a different account
          </button>
        </div>
      </div>
    );
  }

  return <MerchantMfaGate user={user}>{children}</MerchantMfaGate>;
}
