import fs from 'node:fs'
import path from 'node:path'

const file = path.resolve('src/pages/customer-account.jsx')
if (!fs.existsSync(file)) {
  console.error('Missing src/pages/customer-account.jsx')
  process.exit(1)
}

const source = fs.readFileSync(file, 'utf8')
const checks = [
  ['logo marketplace link', 'aria-label="Go to BazarHQ marketplace"'],
  ['marketplace CTA', 'Explore marketplace'],
  ['shopping hub', 'Customer marketplace hub'],
  ['shop again action', 'Shop again'],
  ['animated tabs', 'layoutId="customer-tab"'],
  ['quick marketplace action', 'Shop marketplace'],
]

const missing = checks.filter(([, token]) => !source.includes(token))
if (missing.length) {
  console.error('Customer account hub patch verification failed:')
  for (const [label] of missing) console.error(`- Missing ${label}`)
  process.exit(1)
}

console.log('BazarHQ customer account marketplace hub patch is installed correctly.')
