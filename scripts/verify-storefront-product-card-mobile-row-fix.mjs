import fs from 'fs'

const files = [
  'src/components/marketplace-product-card.jsx',
  'src/pages/shop.jsx',
]

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`Missing file: ${file}`)
    process.exit(1)
  }
}

const cardCode = fs.readFileSync('src/components/marketplace-product-card.jsx', 'utf8')
const shopCode = fs.readFileSync('src/pages/shop.jsx', 'utf8')

const cardChecks = [
  'aspect-[10/11]',
  'h-[60%]',
  'hover:scale-[1.015]',
  'group-hover/image:scale-[1.18]',
]

const shopChecks = [
  'flex flex-nowrap items-center gap-2 overflow-x-auto',
  'View cart',
  'Secure checkout',
  'flex flex-nowrap items-center gap-4 overflow-x-auto whitespace-nowrap',
]

const missing = [
  ...cardChecks.filter((item) => !cardCode.includes(item)).map((item) => `marketplace-product-card.jsx -> ${item}`),
  ...shopChecks.filter((item) => !shopCode.includes(item)).map((item) => `shop.jsx -> ${item}`),
]

if (missing.length) {
  console.error('Patch is not fully installed.')
  console.error('Missing markers:')
  missing.forEach((item) => console.error(`- ${item}`))
  process.exit(1)
}

console.log('BazarHQ storefront product card + mobile hero row fix patch is installed correctly.')
