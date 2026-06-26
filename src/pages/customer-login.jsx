// src/pages/customer-login.jsx
import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Mail, Lock, Eye, EyeOff, Globe } from "lucide-react";
import { Logo } from "@/components/logo";

export default function CustomerLoginPage() {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle } = useCustomerAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  // Redirect destination (e.g. came from checkout)
  const redirectTo = new URLSearchParams(window.location.search).get("redirect") || "/customer/account";

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn({ email, password });
      navigate({ to: redirectTo });
    } catch (err) {
      setError(err.message || "লগইন করতে সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo className="h-9" />
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">স্বাগতম</h1>
          <p className="text-sm text-[var(--muted-foreground)] mb-6">আপনার customer account-এ লগইন করুন</p>

          {/* Google */}
          <Button
            variant="outline"
            className="w-full mb-4 gap-2"
            onClick={handleGoogle}
            type="button"
          >
            <Globe className="h-4 w-4" />
            Google দিয়ে লগইন করুন
          </Button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-xs text-[var(--muted-foreground)]">অথবা</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">ইমেইল</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="password">পাসওয়ার্ড</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  পাসওয়ার্ড ভুলে গেছেন?
                </Link>
              </div>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "লগইন হচ্ছে…" : "লগইন করুন"}
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--muted-foreground)] mt-6">
            নতুন account?{" "}
            <Link to="/customer/signup" className="text-[var(--primary)] font-medium hover:underline">
              Register করুন
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-[var(--muted-foreground)] mt-4">
          Merchant?{" "}
          <Link to="/login" className="text-[var(--primary)] hover:underline">
            Merchant লগইন
          </Link>
        </p>
      </div>
    </div>
  );
}
