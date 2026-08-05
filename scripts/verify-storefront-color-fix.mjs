import fs from 'node:fs'
const path = 'src/pages/shop.jsx'
const text = fs.readFileSync(path, 'utf8')
const required = [
  'shop-discovery-section',
  'shop-discovery-inner',
  'shop-search-surface',
  'linear-gradient(\n              180deg',
  'var(--shop-page-bg)',
]
const missing = required.filter((token) => !text.includes(token))
if (missing.length) {
  console.error('Storefront color harmony fix is missing:', missing.join(', '))
  process.exit(1)
}
console.log('BazarHQ storefront color harmony fix is installed correctly.')
