import { BarChart3 } from 'lucide-react'
function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analytics</h1><p className="mt-1 text-sm text-muted-foreground">Deep insights into your shop's performance</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[{l:'Revenue',v:'৳ 0'},{l:'Avg. Order Value',v:'৳ 0'},{l:'Conversion Rate',v:'0%'},{l:'Repeat Customers',v:'0%'}].map((s) => (
          <div key={s.l} className="rounded-2xl border border-border bg-card p-5"><div className="text-sm text-muted-foreground">{s.l}</div><div className="mt-2 text-2xl font-semibold">{s.v}</div><div className="mt-1 text-xs text-muted-foreground">No data yet</div></div>
        ))}
      </div>
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><BarChart3 className="h-6 w-6 text-muted-foreground" /></div>
        <h3 className="mt-4 text-base font-semibold">Analytics will appear once you have traffic</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Share your storefront link to start collecting visitor and sales data.</p>
      </div>
    </div>
  )
}

export default AnalyticsPage
