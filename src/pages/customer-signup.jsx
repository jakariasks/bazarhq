// src/pages/customer-signup.jsx
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Globe, CheckCircle2, XCircle } from "lucide-react";
import { Logo } from "@/components/logo";

function getRedirectTo() {
  const redirect = new URLSearchParams(window.location.search).get("redirect");
  return redirect?.startsWith("/") && !redirect.startsWith("//")
    ? redirect
    : "/customer/account";
}

function PasswordRule({ ok, text }) {
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

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  const redirectTo = getRedirectTo();
  const loginSearch = redirectTo !== "/customer/account" ? { redirect: redirectTo } : {};

  const passwordHasLength = password.length >= 8;
  const passwordHasNumber = /\d/.test(password);
  const phoneIsValid = !phone || /^01[3-9]\d{8}$/.test(phone);

  async function handleSignup(event) {
    event.preventDefault();

    if (!passwordHasLength || !passwordHasNumber) {
      setError("Password must be at least 8 characters and include one number.");
      return;
    }

    if (!phoneIsValid) {
      setError("Enter a valid Bangladesh phone number, for example 01XXXXXXXXX.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const data = await signUp({ email, password, fullName, phone, redirectTo });
      const hasSession = !!data.session;

      if (hasSession) {
        window.location.assign(redirectTo);
        return;
      }

      setNeedsEmailConfirmation(true);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setError("");
    setGoogleLoading(true);

    try {
      await signInWithGoogle(redirectTo);
    } catch (err) {
      setError(err.message || "Google registration failed. Please try again.");
      setGoogleLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 text-center shadow-sm">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">
            {needsEmailConfirmation ? "Check your email" : "Account created"}
          </h2>
          <p className="text-sm text-[var(--muted-foreground)] mb-6">
            {needsEmailConfirmation ? (
              <>
                We sent a confirmation link to <strong>{email}</strong>. Open the link to activate your customer account. If no email arrives, disable email confirmation during development or configure SMTP in Supabase.
              </>
            ) : (
              "Your customer account is ready."
            )}
          </p>
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/customer/login", search: loginSearch })}
          >
            Go to login
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
          <h1 className="text-2xl font-bold mb-1">Create a customer account</h1>
          <p className="text-sm text-[var(--muted-foreground)] mb-6">
            Save addresses, place orders faster, and track your order history.
          </p>

          <Button
            variant="outline"
            className="w-full mb-4 gap-2"
            onClick={handleGoogleSignup}
            type="button"
            disabled={googleLoading || loading}
          >
            <Globe className="h-4 w-4" />
            {googleLoading ? "Redirecting to Google..." : "Continue with Google"}
          </Button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-xs text-[var(--muted-foreground)]">or</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                pattern="01[3-9]\d{8}"
                title="Enter a valid Bangladesh phone number, for example 01XXXXXXXXX."
                className="mt-1"
              />
              {!phoneIsValid && (
                <p className="text-xs text-red-500 mt-1">Use a valid Bangladesh phone number.</p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="your@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {password && (
                <div className="flex gap-3 mt-2">
                  <PasswordRule ok={passwordHasLength} text="8+ characters" />
                  <PasswordRule ok={passwordHasNumber} text="One number" />
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--muted-foreground)] mt-6">
            Already have an account?{" "}
            <Link
              to="/customer/login"
              search={loginSearch}
              className="text-[var(--primary)] font-medium hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
