import fs from 'fs'

const file = 'src/pages/merchant/products.jsx'
if (!fs.existsSync(file)) {
  console.error(`Missing file: ${file}`)
  process.exit(1)
}

const code = fs.readFileSync(file, 'utf8')
const required = [
  "supabase.storage.from('shop-branding')",
  '`${user.id}/products/${store.id}/',
  '{ upsert: false }',
  "if (!user?.id)",
]
const forbidden = [
  "supabase.storage.from('product-images')",
  '`${store.id}/${Date.now()}',
]

const missing = required.filter((marker) => !code.includes(marker))
const foundForbidden = forbidden.filter((marker) => code.includes(marker))

if (missing.length || foundForbidden.length) {
  console.error('Product image RLS path fix is not fully installed.')
  if (missing.length) {
    console.error('Missing markers:')
    missing.forEach((marker) => console.error(`- ${marker}`))
  }
  if (foundForbidden.length) {
    console.error('Old markers still present:')
    foundForbidden.forEach((marker) => console.error(`- ${marker}`))
  }
  process.exit(1)
}

console.log('BazarHQ merchant product image RLS path fix is installed correctly.')
