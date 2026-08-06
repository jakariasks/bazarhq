import fs from 'node:fs'

const indexPath = 'src/pages/index.jsx'
const cardPath = 'src/components/marketplace-product-card.jsx'

for (const file of [indexPath, cardPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${file}`)
}

const index = fs.readFileSync(indexPath, 'utf8')
const card = fs.readFileSync(cardPath, 'utf8')

const indexChecks = [
  ['previous light background', 'bg-[#f8fafc]'],
  ['customer CTA above search', 'Customer login'],
  ['merchant CTA above search', 'Merchant login'],
  ['main category grouping', 'CATEGORY_GROUPS'],
  ['subcategory explorer', 'category-explorer'],
  ['three shops on mobile', 'auto-cols-[calc((100%-1rem)/3)]'],
  ['mobile fixed navigation', 'MobileBottomNav'],
  ['professional smooth navigation', 'window.scrollTo({ top, behavior: \'smooth\' })'],
  ['compare tray', 'CompareTray'],
]

const cardChecks = [
  ['square product image', 'aspect-square'],
  ['image-only hover zoom', 'group-hover/image:scale-[1.07]'],
  ['card border and shadow', 'shadow-[0_12px_32px_-24px'],
  ['compare action', 'Compare product'],
]

for (const [name, token] of indexChecks) {
  if (!index.includes(token)) throw new Error(`Index check failed: ${name}`)
}
for (const [name, token] of cardChecks) {
  if (!card.includes(token)) throw new Error(`Card check failed: ${name}`)
}

console.log('BazarHQ marketplace professional refinement patch is installed correctly.')
