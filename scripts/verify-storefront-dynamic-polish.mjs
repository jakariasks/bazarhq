import fs from 'node:fs'

const files = {
  shop: 'src/pages/shop.jsx',
  detail: 'src/pages/shop-product.jsx',
  about: 'src/pages/shop-about.jsx',
  card: 'src/components/marketplace-product-card.jsx',
  gallery: 'src/components/product-image-gallery.jsx',
  variants: 'src/lib/product-variants.js',
  theme: 'src/lib/theme-system.js',
}

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]))
const checks = []
const add = (name, pass) => checks.push({ name, pass: Boolean(pass) })

add('canonical commerce summary exists', text.variants.includes('export function getProductCommerceSummary(product)'))
add('shop listing uses commerce summary', text.shop.includes('getProductCommerceSummary(product).price') && text.shop.includes('getProductCommerceSummary(product).stock'))
add('shared product card is variant-aware', text.card.includes('const commerce = useMemo(() => getProductCommerceSummary(product)'))
add('storefront product cards participate in theme runtime', text.card.includes('shop-storefront-product-card') && text.card.includes('themeAware'))
add('theme image ratio applies to card media wrapper', text.theme.includes('[data-theme-image-ratio="portrait"] .shop-card-media'))
add('shop image normalization supports JSON/object image values', text.shop.includes('normalizeProductImages(product?.images, product?.image_url)'))
add('shop cart reconciles latest catalog', text.shop.includes('reconcileCartWithProducts(store.id, products || [])'))
add('shop cart supports clear action', text.shop.includes('clearCart(store.id)'))
add('shop catalog errors have explicit UX state', text.shop.includes('setStatus("catalog-error")') && text.shop.includes('Products could not be loaded'))
add('shop hero autoplay respects reduced motion', text.shop.includes('(prefers-reduced-motion: reduce)'))
add('categories filter case-insensitively', text.shop.includes('.toLocaleLowerCase() === category.toLocaleLowerCase()'))
add('offer fallback avoids fake limited-offer claim', text.shop.includes('product && discount > 0 ? `${discount}% off` : "Store offer"'))
add('product detail uses canonical dynamic theme engine', text.detail.includes("getStoreTheme, getThemeCssVars, themeDataAttributes") && !text.detail.includes("@/lib/preview-themes"))
add('product detail exact ID/slug/SKU route wins before legacy fuzzy route', text.detail.includes('productMatchesExactRoute') && text.detail.includes('productMatchesLegacyRoute') && text.detail.indexOf('find((row) => productMatchesExactRoute') < text.detail.indexOf('find((row) => productMatchesLegacyRoute'))
add('product detail reconciles stale cart', text.detail.includes('reconcileCartWithProducts(storeData.id, productRows || [])'))
add('product detail uses variant-aware commerce stock/price', text.detail.includes('const totalVariantStock = commerce.stock') && text.detail.includes('const overallOutOfStock = !commerce.inStock'))
add('product detail gallery uses dynamic image fit/ratio', text.detail.includes("objectFit={activeTheme.image_fit === 'cover' ? 'cover' : 'contain'}") && text.detail.includes('aspectRatio={activeTheme.image_ratio}'))
add('gallery supports configurable aspect ratio', text.gallery.includes("aspectRatio = 'square'") && text.gallery.includes('ratioClass'))
add('about page respects suspended/deleted shop state', text.about.includes('data.account_status === "suspended"') && text.about.includes('data.account_status === "deleted"'))
add('about page no longer fabricates enabled payment methods', text.about.includes('Payment options enabled by this merchant are shown during checkout.'))
add('store contact email and phone are actionable', text.about.includes('mailto:') && text.about.includes('tel:') && text.shop.includes('mailto:') && text.shop.includes('tel:'))
add('featured fallback is labeled as latest instead of curated', text.shop.includes('hasExplicitFeatured: featured.length > 0') && text.shop.includes('Latest products'))
add('hero pagination remains accessible', text.shop.includes('aria-current={activeIndex === index ? "true" : undefined}') && !text.shop.includes('aria-hidden="true"'))
add('cart shows dynamic delivery rule hints', text.shop.includes('delivery_charge_dhaka') && text.shop.includes('free_delivery_min_amount'))
add('footer policy links use real about-page anchors', text.shop.includes('#return-policy') && text.shop.includes('#shipping-policy') && !text.shop.includes('alert(store.return_policy)'))
add('product detail offer nav only renders when an offer exists', text.detail.includes('storeHasOffers && <a href={`${shopHomePath}#offers`}'))
add('product detail about copy uses canonical store fields', text.detail.includes('store.about_text || store.description || store.tagline'))

let passed = 0
for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'}  ${check.name}`)
  if (check.pass) passed += 1
}
console.log(`\n${passed}/${checks.length} checks passed`)
if (passed !== checks.length) process.exit(1)
