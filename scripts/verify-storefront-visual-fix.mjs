import fs from 'node:fs'

const checks = [
  ['src/pages/shop.jsx', ['shop-discovery-section', 'data-active={active ? "true" : "false"}', 'onClick={() => onView(product)}', 'rounded-[1rem]']],
  ['src/pages/shop-product.jsx', ['My account', 'Featured', 'shopHomePath', '<footer', 'Related products from']],
  ['src/components/product-image-gallery.jsx', ['Move cursor to magnify', "backgroundSize: '360%'", 'rounded-full']],
]

let failed = false
for (const [file, tokens] of checks) {
  if (!fs.existsSync(file)) {
    console.error(`Missing: ${file}`)
    failed = true
    continue
  }
  const source = fs.readFileSync(file, 'utf8')
  for (const token of tokens) {
    if (!source.includes(token)) {
      console.error(`Missing token in ${file}: ${token}`)
      failed = true
    }
  }
}

if (failed) process.exit(1)
console.log('BazarHQ storefront visual and shop product page fix is installed correctly.')
