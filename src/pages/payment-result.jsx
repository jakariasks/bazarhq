import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { CheckCircle2, XCircle, AlertTriangle, ArrowLeft, ReceiptText, Loader2, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'

function getParams() {
  const params = new URLSearchParams(window.location.search)
  return {
    store: (params.get('store') || '').trim().toLowerCase(),
    order: (params.get('order') || '').trim(),
    reason: (params.get('reason') || '').trim(),
  }
}

const SAFE_REASON_TEXT = {
  'gateway-init-failed': 'The secure payment page could not be opened. Please try again.',
  'gateway-unavailable': 'The payment service is temporarily unavailable. Please try again later.',
  'credentials-invalid': 'Online payment is temporarily unavailable for this shop. Choose another payment method or contact the merchant.',
  'payment-not-verified': 'The gateway response could not be verified yet. Please check the order again shortly.',
  'payment-risk-review': 'The payment was received but is being reviewed before confirmation.',
}

export default function PaymentResultPage({ type = 'success' }) {
  const navigate = useNavigate()
  const params = useMemo(() => getParams(), [])
  const [retrying, setRetrying] = useState(false)

  const config = {
    success: {
      icon: CheckCircle2,
      tone: 'text-green-600 bg-green-50 border-green-200',
      title: 'Payment successful',
      body: 'Your SSLCommerz payment was securely verified. The merchant can now process the order.',
    },
    fail: {
      icon: XCircle,
      tone: 'text-red-600 bg-red-50 border-red-200',
      title: 'Payment not completed',
      body: SAFE_REASON_TEXT[params.reason] || 'The payment was not completed or could not be verified. No successful payment has been recorded.',
    },
    cancel: {
      icon: AlertTriangle,
      tone: 'text-amber-600 bg-amber-50 border-amber-200',
      title: 'Payment cancelled',
      body: 'You cancelled the secure payment. The order remains unpaid, and you may retry payment.',
    },
  }[type] || {}

  const Icon = config.icon || AlertTriangle
  const canRetry = type !== 'success' && params.order && params.store

  async function retryPayment() {
    if (!canRetry || retrying) return
    setRetrying(true)

    try {
      const { data, error } = await supabase.functions.invoke('sslcommerz-initiate', {
        body: { order_id: params.order, store_slug: params.store },
      })

      if (error || !data?.gateway_url) {
        throw new Error(data?.message || 'Could not open the secure payment page. Please log in and try again.')
      }

      window.location.assign(data.gateway_url)
    } catch (error) {
      toast.error(error?.message || 'Could not retry payment')
      setRetrying(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-lg items-center justify-center">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/70">
          <div className={`mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border ${config.tone}`}>
            <Icon className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">{config.title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{config.body}</p>

          {params.order && (
            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order ID</p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-900">{params.order}</p>
            </div>
          )}

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {canRetry && (
              <Button onClick={retryPayment} disabled={retrying} className="gap-2 sm:col-span-2">
                {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Retry secure payment
              </Button>
            )}

            {params.order && (
              <Button
                onClick={() => navigate({ to: '/track', search: { store: params.store, order: params.order, phone: '' } })}
                className="gap-2"
              >
                <ReceiptText className="h-4 w-4" /> Track order
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => window.location.assign(params.store ? `/shop/${encodeURIComponent(params.store)}` : '/')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back to shop
            </Button>
          </div>

          <p className="mt-6 text-xs leading-5 text-slate-500">
            Payment status is updated only after server-side verification with SSLCommerz. Do not share card or OTP information with the merchant.
          </p>
        </div>
      </div>
    </div>
  )
}
