import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const shop = read('src/pages/shop.jsx')
const product = read('src/pages/shop-product.jsx')
const gallery = read('src/components/product-image-gallery.jsx')

const checks = [
  ['full-width hero', shop.includes('width: 100% !important') && shop.includes('shop-hero-shell')],
  ['category strip above search', shop.indexOf('shop-category-strip') < shop.indexOf('Search products, category, or tags')],
  ['inline filter row', shop.includes('shop-inline-filter') && shop.includes('Min price') && shop.includes('On offer')],
  ['left filter sidebar removed', !shop.includes('<FiltersSidebar')],
  ['quick view modal removed', !shop.includes('<ProductModal') && !shop.includes('Quick view')],
  ['product clicks open details route', shop.includes('to="/shop/$storeSlug/product/$productId"')],
  ['modern product card', shop.includes('View product details') && shop.includes('shop-themed-card')],
  ['same-shop related products', product.includes('Related products from')],
  ['reviews and rating breakdown', product.includes('Reviews & ratings') && product.includes('Average rating')],
  ['cursor-position zoom', gallery.includes('backgroundPosition: `${zoom.x}% ${zoom.y}%`') && gallery.includes("backgroundSize: objectFit === 'cover' ? '300%' : '340%'" )],
  ['all-image thumbnails', gallery.includes('normalizedImages.map') && gallery.includes('Show product image')],
]

const failed = checks.filter(([, ok]) => !ok)
if (failed.length) {
  console.error('Storefront upgrade verification failed:')
  for (const [name] of failed) console.error(`- ${name}`)
  process.exit(1)
}

console.log('BazarHQ storefront/product-details upgrade is installed correctly.')
