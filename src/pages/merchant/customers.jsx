import { Search, Mail, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
function CustomersPage() {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Customers</h1><p className="mt-1 text-sm text-muted-foreground">Build lasting relationships with your buyers</p></div>
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search customers…" className="pl-9" /></div>
          <Button variant="outline" size="sm"><Mail className="mr-1.5 h-4 w-4" /> Export</Button>
        </div>
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Users className="h-6 w-6 text-muted-foreground" /></div>
          <h3 className="mt-4 text-base font-semibold">No customers yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Customer profiles will appear here once people start ordering from your shop.</p>
        </div>
      </div>
    </div>
  )
}

export default CustomersPage
