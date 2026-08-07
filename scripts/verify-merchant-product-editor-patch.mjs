import fs from 'fs'

const file = 'src/pages/merchant/products.jsx'
if (!fs.existsSync(file)) {
  console.error(`Missing file: ${file}`)
  process.exit(1)
}

const code = fs.readFileSync(file, 'utf8')
const checks = [
  'Realtime product editor',
  'Live storefront preview',
  "merchant-products-",
  "supabase.storage.from('product-images')",
  'Publishing checklist',
  'Add new product',
]

const missing = checks.filter((item) => !code.includes(item))

if (missing.length) {
  console.error('Merchant product editor patch is not fully installed.')
  console.error('Missing markers:')
  missing.forEach((item) => console.error(`- ${item}`))
  process.exit(1)
}

console.log('BazarHQ merchant product editor realtime polish patch is installed correctly.')
