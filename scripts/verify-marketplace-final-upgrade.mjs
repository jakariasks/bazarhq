import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const files = {
  landing: path.join(root, 'src/pages/index.jsx'),
  card: path.join(root, 'src/components/marketplace-product-card.jsx'),
  shop: path.join(root, 'src/pages/shop.jsx'),
  details: path.join(root, 'src/pages/shop-product.jsx'),
  gallery: path.join(root, 'src/components/product-image-gallery.jsx'),
}

const checks = [
  [files.landing, 'bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500'],
  [files.landing, "refetchInterval: compareItems.length ? 15000 : false"],
  [files.landing, 'Real-time comparison'],
  [files.landing, "setActiveCategoryGroup((current) => current === groupId ? '' : groupId)"],
  [files.card, 'group-hover/image:scale-[1.16]'],
  [files.card, 'Compare product'],
  [files.shop, 'MarketplaceProductCard'],
  [files.shop, 'shop-storefront-product-card'],
  [files.details, 'motion.div'],
  [files.gallery, "backgroundSize: '420%'"],
]

const errors = []
for (const [file, marker] of checks) {
  if (!fs.existsSync(file)) {
    errors.push(`Missing file: ${path.relative(root, file)}`)
    continue
  }
  const content = fs.readFileSync(file, 'utf8')
  if (!content.includes(marker)) errors.push(`Missing marker in ${path.relative(root, file)}: ${marker}`)
}

if (errors.length) {
  console.error('\nMarketplace final upgrade verification failed:\n')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('BazarHQ final marketplace, compare, storefront card and animation upgrade is installed correctly.')
