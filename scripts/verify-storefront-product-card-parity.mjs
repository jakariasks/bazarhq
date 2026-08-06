import fs from 'node:fs'

const checks = [
  {
    file: 'src/pages/shop.jsx',
    needles: [
      'import MarketplaceProductCard from "@/components/marketplace-product-card";',
      '<MarketplaceProductCard',
      'className="shop-storefront-product-card"',
      'shopName={shopName}',
      'average_rating: product?.average_rating ?? product?.rating ?? 0',
      'sold_quantity: product?.sold_quantity ?? product?.order_count ?? 0',
      'font-size: .78rem !important',
    ],
    absent: ['font-size: .78rem !important'],
  },
  {
    file: 'src/components/marketplace-product-card.jsx',
    needles: [
      'font-sans antialiased',
      'text-[15px] font-extrabold',
      'sm:text-base',
      'text-[1.25rem] font-black',
      'text-[13px] font-black',
    ],
    absent: [],
  },
]

let failed = false

for (const check of checks) {
  if (!fs.existsSync(check.file)) {
    console.error(`Missing file: ${check.file}`)
    failed = true
    continue
  }

  const source = fs.readFileSync(check.file, 'utf8')
  for (const needle of check.needles) {
    if (check.absent.includes(needle)) continue
    if (!source.includes(needle)) {
      console.error(`Missing expected marker in ${check.file}: ${needle}`)
      failed = true
    }
  }

  for (const needle of check.absent) {
    if (source.includes(needle)) {
      console.error(`Old marker still exists in ${check.file}: ${needle}`)
      failed = true
    }
  }
}

if (failed) process.exit(1)
console.log('BazarHQ storefront product card parity patch is installed correctly.')
