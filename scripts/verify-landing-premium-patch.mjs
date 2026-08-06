import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const files = {
  index: path.join(root, 'src/pages/index.jsx'),
  card: path.join(root, 'src/components/marketplace-product-card.jsx'),
}

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${name}: ${file}`)
}

const index = fs.readFileSync(files.index, 'utf8')
const card = fs.readFileSync(files.card, 'utf8')

const checks = [
  ['customer login CTA', index.includes('Customer login')],
  ['merchant login CTA', index.includes('Merchant login')],
  ['mobile shop two rows', index.includes('grid-rows-2')],
  ['mobile shop horizontal scroll', index.includes('overflow-x-auto')],
  ['maximum five product columns', index.includes('xl:grid-cols-5')],
  ['premium accent card', card.includes('ACCENTS')],
  ['square product image', card.includes('aspect-square')],
  ['compact title-price spacing', card.includes('mt-2 flex items-end')],
]

const failed = checks.filter(([, ok]) => !ok)
if (failed.length) {
  for (const [label] of failed) console.error(`FAIL: ${label}`)
  process.exit(1)
}

console.log('BazarHQ landing premium cards/auth patch is installed correctly.')
