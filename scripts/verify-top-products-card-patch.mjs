import fs from 'node:fs'

const card = fs.readFileSync('src/components/marketplace-product-card.jsx', 'utf8')
const landing = fs.readFileSync('src/pages/index.jsx', 'utf8')
const requirements = [
  [!card.includes('#{rank}') && !card.includes('ranked'), 'rank badge removed'],
  [card.includes('group-hover/image:scale-[1.28]'), 'stronger image zoom'],
  [card.includes('hover:-translate-y-1.5'), 'card hover lift'],
  [card.includes('group-hover:pointer-events-auto') && card.includes('View details'), 'hover details link'],
  [landing.includes('showMoreTopProducts'), 'more top products state'],
  [landing.includes('More top products'), 'more top products control'],
  [landing.includes(".slice(0, showMoreTopProducts ?"), 'expandable top products grid'],
]

const failed = requirements.filter(([ok]) => !ok).map(([, name]) => name)
if (failed.length) {
  console.error(`Patch verification failed: ${failed.join(', ')}`)
  process.exit(1)
}
console.log('BazarHQ top products card hover/more patch is installed correctly.')
