// src/pages/superadmin/login.jsx
// A1 SRS: Separate admin login, email+password, TOTP 2FA challenge
import { useState, useEffect } from "react";
import { useNavigate }  from "@tanstack/react-router";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Shield, Eye, EyeOff, AlertCircle, Lock } from "lucide-react";

export default function SuperAdminLoginPage() {
  const navigate          = useNavigate();
  const { login, isLoggedIn, loading } = useAdminAuth();

  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [totpCode,  setTotpCode]  = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [step,      setStep]      = useState("credentials"); // "credentials" | "totp"
  const [pendingAdmin, setPendingAdmin] = useState(null);
  const [error,     setError]     = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reason = new URLSearchParams(window.location.search).get("reason");

  useEffect(() => {
    if (!loading && isLoggedIn) navigate({ to: "/superadmin" });
  }, [loading, isLoggedIn, navigate]);

  async function handleCredentials(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.requiresTOTP) {
        setPendingAdmin(result.adminUser);
        setStep("totp");
      } else if (result.success) {
        navigate({ to: "/superadmin" });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTOTP(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password, totpCode);
      navigate({ to: "/superadmin" });
    } catch (err) {
      setError(err.message);
      setTotpCode("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600 shadow-lg shadow-violet-900/50 mb-4">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">BazarHQ Admin</h1>
          <p className="text-gray-400 text-sm mt-1">Restricted access — authorized personnel only</p>
        </div>

        {/* Inactivity notice */}
        {reason === "inactive" && (
          <div className="mb-4 flex items-center gap-2 bg-amber-900/30 border border-amber-700 text-amber-400 text-sm px-4 py-3 rounded-xl">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Session expired due to inactivity. Please sign in again.
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">

          {/* Step 1: Credentials */}
          {step === "credentials" && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div>
                <Label className="text-gray-300 text-sm">Admin Email</Label>
                <Input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-violet-500"
                  placeholder="admin@bazarhq.com"
                />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Password</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-violet-500 pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    onClick={() => setShowPw(v => !v)}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-900/30 border border-red-700 text-red-400 text-sm px-3 py-2.5 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold"
                disabled={submitting}
              >
                {submitting ? "Verifying…" : "Sign In"}
              </Button>
            </form>
          )}

          {/* Step 2: TOTP */}
          {step === "totp" && (
            <form onSubmit={handleTOTP} className="space-y-4">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-900/50 mb-3">
                  <Lock className="h-5 w-5 text-violet-400" />
                </div>
                <h2 className="text-white font-semibold">Two-Factor Authentication</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Enter the 6-digit code from your authenticator app.
                </p>
              </div>

              <div>
                <Label className="text-gray-300 text-sm">Authenticator Code</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoFocus
                  required
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mt-1 bg-gray-800 border-gray-700 text-white text-center text-xl tracking-[0.5em] font-mono placeholder:text-gray-600 focus:border-violet-500"
                  placeholder="000000"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-900/30 border border-red-700 text-red-400 text-sm px-3 py-2.5 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold"
                disabled={submitting || totpCode.length < 6}
              >
                {submitting ? "Verifying…" : "Verify & Continue"}
              </Button>

              <button
                type="button"
                className="w-full text-sm text-gray-500 hover:text-gray-300"
                onClick={() => { setStep("credentials"); setTotpCode(""); setError(""); }}
              >
                ← Back to sign in
              </button>
            </form>
          )}

          <p className="text-center text-xs text-gray-600 mt-6">
            Account locked after {3} failed attempts · Session expires in 8h
          </p>
        </div>
      </div>
    </div>
  );
}
