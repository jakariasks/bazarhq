import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ShoppingBag, Loader2, Eye, EyeOff, Check, X, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/integrations/supabase/client'

function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword

  // Password strength
  const strength = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'One uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'One number', ok: /[0-9]/.test(password) },
  ]
  const strongEnough = strength.every((s) => s.ok)

  const submit = async (e) => {
    e.preventDefault()
    if (!strongEnough) { toast.error('Please meet all password requirements.'); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success('Password updated! Please sign in.')
    navigate({ to: '/login' })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-mesh p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <ShoppingBag className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">BazarHQ</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Set new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a strong password for your account.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {/* New password */}
            <div className="grid gap-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Strength indicators */}
              {password.length > 0 && (
                <motion.ul
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1"
                >
                  {strength.map((s) => (
                    <li key={s.label} className="flex items-center gap-1.5 text-xs">
                      {s.ok
                        ? <Check className="h-3.5 w-3.5 text-success" />
                        : <X className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className={s.ok ? 'text-success' : 'text-muted-foreground'}>{s.label}</span>
                    </li>
                  ))}
                </motion.ul>
              )}
            </div>

            {/* Confirm password */}
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`pr-10 transition-colors ${
                    passwordsMismatch
                      ? 'border-destructive focus-visible:ring-destructive/30'
                      : passwordsMatch
                      ? 'border-success focus-visible:ring-success/30'
                      : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-xs"
                >
                  {passwordsMatch ? (
                    <><Check className="h-3.5 w-3.5 text-success" /><span className="text-success">Passwords match</span></>
                  ) : (
                    <><X className="h-3.5 w-3.5 text-destructive" /><span className="text-destructive">Passwords do not match</span></>
                  )}
                </motion.div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || passwordsMismatch || !strongEnough}
              className="w-full bg-gradient-primary shadow-glow"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}

export default ResetPassword
