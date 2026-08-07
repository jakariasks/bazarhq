import fs from 'fs'

const componentPath = 'src/components/marketplace-product-card.jsx'
const shopPath = 'src/pages/shop.jsx'

for (const file of [componentPath, shopPath]) {
  if (!fs.existsSync(file)) {
    console.error(`Missing file: ${file}`)
    process.exit(1)
  }
}

const component = fs.readFileSync(componentPath, 'utf8')
const shop = fs.readFileSync(shopPath, 'utf8')

const checks = [
  [component.includes('showViewDetails = true'), 'shared card showViewDetails prop'],
  [component.includes('{showViewDetails && ('), 'conditional View details action'],
  [shop.includes('showViewDetails={false}'), 'storefront View details disabled'],
  [shop.includes(': "Add to cart"'), 'storefront Add to cart label'],
  [shop.includes('? "Out of stock"'), 'storefront Out of stock label'],
]

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label)

if (failed.length) {
  console.error('Patch is not fully installed:')
  failed.forEach((item) => console.error(`- ${item}`))
  process.exit(1)
}

console.log('BazarHQ storefront single add-to-cart parity fix is installed correctly.')
