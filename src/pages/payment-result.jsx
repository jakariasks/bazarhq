import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { CheckCircle2, XCircle, AlertTriangle, ArrowLeft, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'

function getParams() {
  const params = new URLSearchParams(window.location.search)
  return {
    store: params.get('store') || '',
    order: params.get('order') || '',
    phone: params.get('phone') || '',
    reason: params.get('reason') || '',
  }
}

export default function PaymentResultPage({ type = 'success' }) {
  const navigate = useNavigate()
  const params = useMemo(() => getParams(), [])

  const config = {
    success: {
      icon: CheckCircle2,
      tone: 'text-green-600 bg-green-50 border-green-200',
      title: 'Payment successful',
      body: 'Your SSLCommerz payment was verified. The merchant will process the order soon.',
    },
    fail: {
      icon: XCircle,
      tone: 'text-red-600 bg-red-50 border-red-200',
      title: 'Payment failed',
      body: 'The payment could not be completed. You can try again or contact the merchant.',
    },
    cancel: {
      icon: AlertTriangle,
      tone: 'text-amber-600 bg-amber-50 border-amber-200',
      title: 'Payment cancelled',
      body: 'The SSLCommerz payment was cancelled. Your order remains pending unless you complete payment later.',
    },
  }[type] || {}

  const Icon = config.icon || AlertTriangle

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
            {params.order && (
              <Button
                onClick={() => navigate({ to: '/track', search: { store: params.store, order: params.order, phone: params.phone } })}
                className="gap-2"
              >
                <ReceiptText className="h-4 w-4" /> Track order
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => navigate({ to: params.store ? `/shop/${params.store}` : '/' })}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back to shop
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
