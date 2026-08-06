import fs from 'node:fs'

const checks = [
  {
    file: 'src/pages/index.jsx',
    required: [
      '<span className="sm:hidden">Search</span>',
      'overflow-x-auto whitespace-nowrap',
      'grid grid-cols-4 divide-x',
      "[data.metrics.shops, 'Shops', 'Active shops']",
    ],
  },
  {
    file: 'src/pages/shop.jsx',
    required: [
      'appearance-none rounded-[0.95rem]',
      'placeholder="Min price"',
      'placeholder="Max price"',
      'bg-emerald-50/80',
      'bg-slate-950 px-3 py-2',
    ],
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
  for (const token of check.required) {
    if (!source.includes(token)) {
      console.error(`Missing expected update in ${check.file}: ${token}`)
      failed = true
    }
  }
}

if (failed) process.exit(1)
console.log('BazarHQ mobile marketplace and storefront UI patch is installed correctly.')
