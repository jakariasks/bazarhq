import fs from 'node:fs'
const s=fs.readFileSync('src/pages/shop-product.jsx','utf8')
const checks=[
['variant normalizer exists',s.includes('normalizeStorefrontProductVariants')],
['product fetch normalizes data',s.includes('const productData = normalizeStorefrontProductVariants(productDataRaw)')],
['json variant fallback',s.includes('variant_options')],
]
let f=0; for(const [n,o] of checks){console.log((o?'✓':'✗'),n); if(!o)f++} if(f)process.exit(1)
