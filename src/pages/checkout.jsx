import { Link } from '@tanstack/react-router'
import { ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
function CheckoutPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-mesh p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary shadow-glow"><ShoppingBag className="h-7 w-7 text-primary-foreground" /></div>
      <h2 className="mt-4 text-2xl font-semibold">Checkout coming soon</h2>
      <p className="mt-2 text-sm text-muted-foreground">bKash, Nagad, and card payments will be live here.</p>
      <Link to="/shop"><Button variant="outline" className="mt-6">Back to shop</Button></Link>
    </div>
  )
}

export default CheckoutPage
