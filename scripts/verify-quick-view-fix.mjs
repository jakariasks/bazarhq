import fs from 'node:fs'

const checks = [
  ['src/pages/shop.jsx', [
    'Recommended from this shop',
    'Recent reviews',
    'Product information',
    'allProducts={products}',
    'Full details & reviews',
  ]],
  ['src/components/product-image-gallery.jsx', [
    'Hover any part to zoom',
    "backgroundSize: objectFit === 'cover' ? '260%' : '300%'",
  ]],
]

let failed = false
for (const [file, markers] of checks) {
  if (!fs.existsSync(file)) {
    console.error(`Missing: ${file}`)
    failed = true
    continue
  }
  const source = fs.readFileSync(file, 'utf8')
  for (const marker of markers) {
    if (!source.includes(marker)) {
      console.error(`Missing marker in ${file}: ${marker}`)
      failed = true
    }
  }
}

if (failed) process.exit(1)
console.log('BazarHQ Quick View zoom/info/recommendation fix is installed correctly.')
