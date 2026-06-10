import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Loader2, Eye, EyeOff, Mail, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'

function Login() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const search = useSearch({ strict: false })
  const redirect = search?.redirect || '/merchant'

  const [tab, setTab] = useState('email')

  // Email
  const [email, setEmail] = useState('')

  // Phone
  const [phone, setPhone] = useState('')

  // Shared
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => { if (user) navigate({ to: redirect }) }, [user])

  // ── Email login ──
  const submitEmail = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success('Welcome back!')
    navigate({ to: redirect })
  }

  // ── Phone login (uses the same alias trick as signup) ──
  const submitPhone = async (e) => {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 11 || !/^01[3-9]/.test(digits)) {
      toast.error('Enter a valid 11-digit Bangladeshi number (e.g. 01306060688)')
      return
    }
    setLoading(true)
    const fakeEmail = `${digits}@phone.bazarhq.com`
    const { error } = await supabase.auth.signInWithPassword({ email: fakeEmail, password })
    setLoading(false)
    if (error) { toast.error('Invalid phone number or password'); return }
    toast.success('Welcome back!')
    navigate({ to: redirect })
  }

  const signInWithGoogle = async () => {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/merchant` },
    })
    if (error) { toast.error(error.message); setGoogleLoading(false) }
  }

  const onPhoneChange = (val) => {
    setPhone(val.replace(/\D/g, '').slice(0, 11))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-mesh p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <ShoppingBag className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">BazarHQ</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant sm:p-8">
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to manage your shop.</p>

          {/* Google */}
          <Button
            type="button"
            variant="outline"
            className="mt-5 w-full gap-2"
            onClick={signInWithGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            )}
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />OR<div className="h-px flex-1 bg-border" />
          </div>

          {/* Tab switcher */}
          <div className="mb-5 grid grid-cols-2 rounded-xl border border-border bg-muted/40 p-1">
            {[
              { id: 'email', label: 'Email', icon: Mail },
              { id: 'phone', label: 'Phone', icon: Phone },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all duration-200 ${
                  tab === id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* ── EMAIL FORM ── */}
          <AnimatePresence mode="wait">
            {tab === 'email' && (
              <motion.form
                key="email"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                onSubmit={submitEmail}
                className="space-y-4"
              >
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoFocus
                    placeholder="jakaria@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <PasswordField
                  value={password}
                  onChange={setPassword}
                  show={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                  forgotLink
                />
                <Button type="submit" disabled={loading} className="w-full bg-gradient-primary shadow-glow">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
                </Button>
              </motion.form>
            )}

            {/* ── PHONE FORM ── */}
            {tab === 'phone' && (
              <motion.form
                key="phone"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                onSubmit={submitPhone}
                className="space-y-4"
              >
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <div className="flex overflow-hidden rounded-lg border border-border bg-background transition-all focus-within:ring-2 focus-within:ring-ring">
                    <div className="flex shrink-0 items-center gap-1.5 border-r border-border bg-muted px-3 text-sm font-medium">
                      <span className="text-base leading-none">🇧🇩</span>
                      <span className="text-muted-foreground">+880</span>
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      required
                      autoFocus
                      placeholder="01306060688"
                      value={phone}
                      onChange={(e) => onPhoneChange(e.target.value)}
                      className="border-0 focus-visible:ring-0"
                    />
                  </div>
                 
                </div>
                <PasswordField
                  value={password}
                  onChange={setPassword}
                  show={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                />
                <Button type="submit" disabled={loading} className="w-full bg-gradient-primary shadow-glow">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to BazarHQ?{' '}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

// ── Shared password field ──
function PasswordField({ value, onChange, show, onToggle, forgotLink }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="password">Password</Label>
        {forgotLink && (
          <Link to="/forgot-password" className="text-xs text-primary hover:underline">
            Forgot password?
          </Link>
        )}
      </div>
      <div className="relative">
        <Input
          id="password"
          type={show ? 'text' : 'password'}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export default Login
