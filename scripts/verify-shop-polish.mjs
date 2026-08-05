import fs from 'node:fs'

const checks = [
  ['src/pages/shop.jsx', 'shop-hero-shell'],
  ['src/pages/shop.jsx', 'width: 90% !important'],
  ['src/pages/shop.jsx', 'grid-template-columns: repeat(6'],
  ['src/pages/shop.jsx', 'shop-featured-grid'],
  ['src/pages/shop-product.jsx', 'Related products from'],
  ['src/pages/shop-product.jsx', 'More product information'],
  ['src/pages/shop-product.jsx', 'Average rating'],
  ['src/components/product-image-gallery.jsx', 'Hover any part to zoom'],
  ['src/components/product-image-gallery.jsx', "backgroundSize: objectFit === 'cover' ? '260%' : '300%'"],
]

let failed = false
for (const [file, marker] of checks) {
  if (!fs.existsSync(file)) {
    console.error(`Missing file: ${file}`)
    failed = true
    continue
  }
  const text = fs.readFileSync(file, 'utf8')
  if (!text.includes(marker)) {
    console.error(`Missing update marker in ${file}: ${marker}`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log('BazarHQ shop page visible polish patch is installed correctly.')
