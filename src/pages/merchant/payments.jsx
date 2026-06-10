import { useState } from 'react'
import { Check, Settings2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
const methods = [
  { id: 'bkash', name: 'bKash', desc: 'Most popular mobile payment in BD', color: 'from-pink-500 to-rose-600', logo: 'bK', fee: '1.85%' },
  { id: 'nagad', name: 'Nagad', desc: 'Government-backed mobile financial service', color: 'from-orange-500 to-red-600', logo: 'N', fee: '1.50%' },
  { id: 'ssl', name: 'SSLCommerz', desc: 'All major cards + 30+ banks', color: 'from-blue-500 to-indigo-600', logo: 'SSL', fee: '2.50%' },
  { id: 'cod', name: 'Cash on Delivery', desc: 'Pay when you receive (Dhaka & Ctg)', color: 'from-emerald-500 to-teal-600', logo: '৳', fee: 'Free' },
]
function PaymentsPage() {
  const [enabled, setEnabled] = useState({ bkash: true, nagad: true, ssl: true, cod: true })
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Payment methods</h1><p className="mt-1 text-sm text-muted-foreground">Accept payments via Bangladesh's most popular options</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        {methods.map((m) => (
          <div key={m.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${m.color} text-base font-bold text-white shadow-md`}>{m.logo}</div>
                <div>
                  <div className="flex items-center gap-2"><h3 className="text-base font-semibold">{m.name}</h3>{enabled[m.id]&&<Badge variant="secondary" className="gap-1 text-success"><Check className="h-3 w-3"/>Active</Badge>}</div>
                  <p className="text-sm text-muted-foreground">{m.desc}</p>
                </div>
              </div>
              <Switch checked={enabled[m.id]} onCheckedChange={(v) => setEnabled({...enabled,[m.id]:v})} />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <div className="text-sm">Fee: <span className="font-medium">{m.fee}</span></div>
              <Button variant="ghost" size="sm"><Settings2 className="mr-1.5 h-4 w-4"/>Configure</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">৳</div>
          <div>
            <div className="font-semibold">Payouts</div>
            <p className="mt-1 text-sm text-muted-foreground">Receive your earnings every 3 business days to your linked bank account. No payout account configured yet.</p>
            <Button variant="outline" size="sm" className="mt-3">Change payout account</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentsPage
