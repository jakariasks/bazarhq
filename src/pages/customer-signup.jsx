// src/pages/customer-signup.jsx
import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Eye, EyeOff, Globe, CheckCircle2, XCircle } from "lucide-react";
import { Logo } from "@/components/logo";

function PwRule({ ok, text }) {
  return (
    <span className={`flex items-center gap-1 text-xs ${ok ? "text-green-500" : "text-[var(--muted-foreground)]"}`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {text}
    </span>
  );
}

export default function CustomerSignupPage() {
  const navigate = useNavigate();
  const { signUp, signInWithGoogle } = useCustomerAuth();

  const [fullName,  setFullName]  = useState("");
  const [phone,     setPhone]     = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [success,   setSuccess]   = useState(false);

  const pw8   = password.length >= 8;
  const pwNum = /\d/.test(password);

  async function handleSignup(e) {
    e.preventDefault();
    if (!pw8 || !pwNum) {
      setError("পাসওয়ার্ড কমপক্ষে ৮ অক্ষর এবং একটি সংখ্যা থাকতে হবে।");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signUp({ email, password, fullName, phone });
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Registration করতে সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 text-center shadow-sm">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">ইমেইল verify করুন</h2>
          <p className="text-sm text-[var(--muted-foreground)] mb-6">
            <strong>{email}</strong>-এ একটি verification link পাঠানো হয়েছে।
            লিংকে ক্লিক করে account activate করুন।
          </p>
          <Button variant="outline" onClick={() => navigate({ to: "/customer/login" })}>
            লগইন পেইজে যান
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo className="h-9" />
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 shadow-sm">
          <h1 className="text-2xl font-bold mb-1">নতুন Account খুলুন</h1>
          <p className="text-sm text-[var(--muted-foreground)] mb-6">
            Order history ও saved address এর সুবিধা পান
          </p>

          {/* Google */}
          <Button variant="outline" className="w-full mb-4 gap-2" onClick={signInWithGoogle} type="button">
            <Globe className="h-4 w-4" />
            Google দিয়ে Register করুন
          </Button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-xs text-[var(--muted-foreground)]">অথবা</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <Label htmlFor="fullName">পূর্ণ নাম</Label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                placeholder="আপনার নাম"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="phone">ফোন নম্বর</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                pattern="01[3-9]\d{8}"
                title="বাংলাদেশি ফোন নম্বর দিন (01XXXXXXXXX)"
                className="mt-1"
              />
            </div>

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
              <Label htmlFor="password">পাসওয়ার্ড</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
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
              {password && (
                <div className="flex gap-3 mt-2">
                  <PwRule ok={pw8}   text="৮+ অক্ষর" />
                  <PwRule ok={pwNum} text="একটি সংখ্যা" />
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Account তৈরি হচ্ছে…" : "Register করুন"}
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--muted-foreground)] mt-6">
            আগে থেকেই account আছে?{" "}
            <Link to="/customer/login" className="text-[var(--primary)] font-medium hover:underline">
              লগইন করুন
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
