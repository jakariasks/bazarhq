import fs from 'fs'

const file = 'src/components/marketplace-product-card.jsx'
if (!fs.existsSync(file)) {
  console.error(`Missing file: ${file}`)
  process.exit(1)
}

const code = fs.readFileSync(file, 'utf8')
const checks = [
  "import { ArrowRight, Check, Images, Scale, ShoppingBag, Star, Store }",
  'min-h-[330px]',
  'aspect-[4/3]',
  'mt-1.5 flex items-center justify-between gap-2',
  'View details',
  'onAddToCart',
  '<Store className=',
  'hover:scale-[1.015]',
  'group-hover/image:scale-[1.18]',
]

const missing = checks.filter((item) => !code.includes(item))
if (missing.length) {
  console.error('Product card patch is not fully installed.')
  missing.forEach((item) => console.error(`- Missing: ${item}`))
  process.exit(1)
}

console.log('BazarHQ product card complete content fix is installed correctly.')
