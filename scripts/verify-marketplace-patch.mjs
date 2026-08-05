import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const required = [
  'src/pages/index.jsx',
  'src/pages/shop.jsx',
  'src/pages/shop-product.jsx',
  'src/components/product-image-gallery.jsx',
  'src/components/marketplace-product-card.jsx',
  'src/lib/marketplace-api.js',
  'supabase/migrations/20260805_marketplace_landing.sql',
  'supabase/verification/verify_marketplace_landing.sql',
]

const errors = []
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`Missing ${file}`)
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

if (!errors.length) {
  const landing = read('src/pages/index.jsx')
  const detail = read('src/pages/shop-product.jsx')
  const shop = read('src/pages/shop.jsx')
  const api = read('src/lib/marketplace-api.js')
  const sql = read('supabase/migrations/20260805_marketplace_landing.sql')

  const checks = [
    [landing.includes('Download APK'), 'Landing APK action missing'],
    [landing.includes('Top selling shops'), 'Top shops section missing'],
    [landing.includes('Top ranking products'), 'Top products section missing'],
    [landing.includes('Compare the same product across shops'), 'Comparison section missing'],
    [!landing.includes("supabase.from('orders')") && !landing.includes('supabase.from("orders")'), 'Landing must not query protected orders directly'],
    [detail.includes('ProductImageGallery'), 'Product detail gallery missing'],
    [detail.includes('Same product from other shops'), 'Cross-shop recommendation section missing'],
    [!detail.includes('images.slice(0, 5)'), 'Product detail still limits thumbnails to five'],
    [shop.includes('ProductImageGallery'), 'Store quick-view gallery missing'],
    [shop.includes('images.length} images'), 'Store product image-count badge missing'],
    [api.includes("supabase.rpc('get_marketplace_home'"), 'Marketplace home RPC client missing'],
    [api.includes("supabase.rpc('get_marketplace_product_recommendations'"), 'Recommendation RPC client missing'],
    [sql.includes('create or replace function public.get_marketplace_home'), 'Marketplace home RPC migration missing'],
    [sql.includes('create or replace function public.get_marketplace_product_recommendations'), 'Recommendation RPC migration missing'],
    [sql.includes("grant execute on function public.get_marketplace_home"), 'Marketplace RPC public execute grant missing'],
  ]

  for (const [ok, message] of checks) if (!ok) errors.push(message)
}

if (errors.length) {
  console.error('Marketplace patch verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('BazarHQ marketplace patch static verification passed.')
