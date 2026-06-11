import { Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
function TrackPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-mesh p-8">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant">
        <img src="/logo.png" alt="BazarHQ" className="h-12 w-12 rounded-xl object-contain mx-auto" />
        <h1 className="mt-4 text-center text-2xl font-semibold">Track your order</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Enter your order ID to check the status.</p>
        <div className="mt-6 grid gap-3">
          <div className="grid gap-2"><Label>Order ID</Label><Input placeholder="e.g. BHQ-2026-001" /></div>
          <Button className="bg-gradient-primary shadow-glow">Track order</Button>
        </div>
      </div>
    </div>
  )
}

export default TrackPage
