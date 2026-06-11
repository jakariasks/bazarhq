import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Loader2, Eye, EyeOff, Check, X, Mail, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'

function validateBDPhone(raw) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 11) return { ok: false, message: 'Must be 11 digits (e.g. 01712345678)' }
  if (!/^01[3-9]/.test(digits)) return { ok: false, message: 'Must start with 013–019' }
  return { ok: true, digits }
}

function Signup() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState('email')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')

  useEffect(() => { if (user) navigate({ to: '/onboarding' }) }, [user])

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword

  const submitEmail = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) { toast.error('Passwords do not match.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/onboarding`, data: { full_name: name } },
    })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success("Account created! Let's set up your shop.")
    navigate({ to: '/onboarding' })
  }

  const submitPhone = async (e) => {
    e.preventDefault()
    const v = validateBDPhone(phone)
    if (!v.ok) { setPhoneError(v.message); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match.'); return }
    setLoading(true)
    const fakeEmail = `${v.digits}@phone.bazarhq.com`
    const { error } = await supabase.auth.signUp({
      email: fakeEmail, password,
      options: { data: { full_name: name, phone_number: '+88' + v.digits, signup_method: 'phone' } },
    })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success("Account created! Let's set up your shop.")
    navigate({ to: '/onboarding' })
  }

  const signInWithGoogle = async () => {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/onboarding` },
    })
    if (error) { toast.error(error.message); setGoogleLoading(false) }
  }

  const onPhoneChange = (val) => {
    setPhone(val.replace(/\D/g, '').slice(0, 11))
    if (phoneError) setPhoneError('')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-mesh p-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
        <Logo size="lg" className="mb-8 justify-center" />

        <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant sm:p-8">
          <h1 className="text-2xl font-semibold">Launch your shop</h1>
          <p className="mt-1 text-sm text-muted-foreground">Free to start. No credit card required.</p>

          <Button type="button" variant="outline" className="mt-5 w-full gap-2" onClick={signInWithGoogle} disabled={googleLoading}>
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

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />OR<div className="h-px flex-1 bg-border" />
          </div>

          {/* Tab switcher */}
          <div className="mb-5 grid grid-cols-2 rounded-xl border border-border bg-muted/40 p-1">
            {[{ id: 'email', label: 'Email', icon: Mail }, { id: 'phone', label: 'Phone', icon: Phone }].map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setTab(id)}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${tab === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === 'email' && (
              <motion.form key="email" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}
                onSubmit={submitEmail} autoComplete="off" className="space-y-4">
                <input type="text" name="fake-user" style={{ display: 'none' }} readOnly />
                <input type="password" name="fake-pass" style={{ display: 'none' }} readOnly />

                <div className="grid gap-2">
                  <Label htmlFor="name-e">Name</Label>
                  <Input id="name-e" required autoComplete="off" placeholder="Rahim Uddin" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email-e">Email</Label>
                  <Input id="email-e" type="email" required autoComplete="off" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <PasswordFields
                  password={password} setPassword={setPassword}
                  confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
                  showPassword={showPassword} setShowPassword={setShowPassword}
                  showConfirmPassword={showConfirmPassword} setShowConfirmPassword={setShowConfirmPassword}
                  passwordsMatch={passwordsMatch} passwordsMismatch={passwordsMismatch}
                />
                <Button type="submit" disabled={loading || passwordsMismatch} className="w-full bg-gradient-primary shadow-glow">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create my shop'}
                </Button>
              </motion.form>
            )}

            {tab === 'phone' && (
              <motion.form key="phone" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}
                onSubmit={submitPhone} autoComplete="off" className="space-y-4">
                <input type="text" name="fake-user" style={{ display: 'none' }} readOnly />
                <input type="password" name="fake-pass" style={{ display: 'none' }} readOnly />

                <div className="grid gap-2">
                  <Label htmlFor="name-p">Name</Label>
                  <Input id="name-p" required autoComplete="off" placeholder="Rahim Uddin" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone-p">Phone number</Label>
                  <div className={`flex overflow-hidden rounded-lg border bg-background transition-all focus-within:ring-2 ${phoneError ? 'border-destructive focus-within:ring-destructive/30' : 'border-border focus-within:ring-ring'}`}>
                    <div className="flex shrink-0 items-center gap-1.5 border-r border-border bg-muted px-3 text-sm font-medium">
                      <span className="text-base leading-none">🇧🇩</span>
                      <span className="text-muted-foreground">+880</span>
                    </div>
                    <Input id="phone-p" type="tel" inputMode="numeric" required autoComplete="off" placeholder="1XXXXXXXXXX" value={phone} onChange={(e) => onPhoneChange(e.target.value)} className="border-0 focus-visible:ring-0" />
                  </div>
                  {phoneError
                    ? <p className="flex items-center gap-1 text-xs text-destructive"><X className="h-3 w-3" />{phoneError}</p>
                    : <p className="text-xs text-muted-foreground">Bangladeshi mobile only. Example: 01712345678 (11 digits).</p>
                  }
                </div>
                <PasswordFields
                  password={password} setPassword={setPassword}
                  confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
                  showPassword={showPassword} setShowPassword={setShowPassword}
                  showConfirmPassword={showConfirmPassword} setShowConfirmPassword={setShowConfirmPassword}
                  passwordsMatch={passwordsMatch} passwordsMismatch={passwordsMismatch}
                />
                <Button type="submit" disabled={loading || passwordsMismatch} className="w-full bg-gradient-primary shadow-glow">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create my shop'}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have one? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

function PasswordFields({ password, setPassword, confirmPassword, setConfirmPassword, showPassword, setShowPassword, showConfirmPassword, setShowConfirmPassword, passwordsMatch, passwordsMismatch }) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="pwd">Password</Label>
        <div className="relative">
          <Input id="pwd" type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
          <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cpwd">Confirm Password</Label>
        <div className="relative">
          <Input id="cpwd" type={showConfirmPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password"
            value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
            className={`pr-10 transition-colors ${passwordsMismatch ? 'border-destructive focus-visible:ring-destructive/30' : passwordsMatch ? 'border-success focus-visible:ring-success/30' : ''}`} />
          <button type="button" onClick={() => setShowConfirmPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {confirmPassword.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1.5 text-xs">
            {passwordsMatch
              ? <><Check className="h-3.5 w-3.5 text-success" /><span className="text-success">Passwords match</span></>
              : <><X className="h-3.5 w-3.5 text-destructive" /><span className="text-destructive">Passwords do not match</span></>}
          </motion.div>
        )}
      </div>
    </>
  )
}

export default Signup
