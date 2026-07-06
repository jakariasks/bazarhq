import { useState } from 'react'
import { Loader2, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { resendVerificationEmail } from '@/lib/auth-verification'

export function ResendVerificationCard({ defaultEmail = '', compact = false }) {
  const [email, setEmail] = useState(defaultEmail)
  const [loading, setLoading] = useState(false)

  const send = async () => {
    setLoading(true)
    try {
      await resendVerificationEmail(email)
      toast.success('Verification email sent. Check your inbox/spam folder.')
    } catch (error) {
      toast.error(error?.message || 'Could not send verification email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={compact ? 'space-y-2' : 'rounded-2xl border border-border bg-muted/30 p-4'}>
      {!compact && (
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <MailCheck className="h-4 w-4 text-primary" /> Need verification email?
        </div>
      )}
      <div className="flex gap-2">
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-10 rounded-xl" />
        <Button type="button" variant="outline" onClick={send} disabled={loading} className="rounded-xl whitespace-nowrap">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resend'}
        </Button>
      </div>
    </div>
  )
}
