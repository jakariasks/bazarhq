import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(rel) {
  const full = path.join(root, rel)
  if (!fs.existsSync(full)) {
    throw new Error(`Missing file: ${rel}`)
  }
  return fs.readFileSync(full, 'utf8')
}

const productPage = read('src/pages/shop-product.jsx')
const selector = read('src/components/product-variant-selector.jsx')
const variants = read('src/lib/product-variants.js')
const cart = read('src/lib/cart.js')
const checkout = read('src/pages/checkout.jsx')
const worker = read('supabase/functions/process-notification-queue/index.ts')
const migration = read('supabase/migrations/20260809_customer_variants_order_confirmation_complete.sql')

const checks = [
  ['C01 grouped storefront selector', productPage.includes('<ProductVariantSelector') && selector.includes('Select {group.name}')],
  ['C01 option compatibility disabling', selector.includes('optionHasMatchingVariant') && selector.includes('disabled={!enabled}')],
  ['C01 sold-out option state', selector.includes('Sold out') && selector.includes('CircleSlash2')],
  ['C02 selected variant binds price', productPage.includes('selectedVariant?.price') && variants.includes('getEffectiveVariantPrice')],
  ['C02 selected variant binds stock', productPage.includes('selectedVariant?.stock') && productPage.includes('Selected option unavailable')],
  ['C02 price adjustment compatibility', variants.includes('price_adjustment') && variants.includes('basePrice + adjustment')],
  ['C03 low-stock warning', productPage.includes('Only ${stock} left in stock') && productPage.includes('lowStockThreshold')],
  ['C03 variant threshold inheritance', variants.includes('getVariantLowStockThreshold')],
  ['C04 cart persists variant options', cart.includes('variantOptions:') && cart.includes('variantSku:')],
  ['C04 cart revalidates fresh variant', cart.includes('normalizeProductVariants(product)')],
  ['C04 checkout sends variant metadata', checkout.includes('variant_options: item.variantOptions') && checkout.includes('variant_sku: item.variantSku')],
  ['C04 order enrichment trigger', migration.includes('enrich_order_variant_items') && migration.includes("'variant_options', v_variant->'options'")],
  ['C05 verified-email gate', migration.includes('email_confirmed_at is not null') && migration.includes('v_customer_email = v_auth_email')],
  ['C05 SMS contains items total tracking', migration.includes("v_sms_message :=") && migration.includes("' confirmed. Items: ' || v_items_text") && migration.includes("'. Track: ' || v_tracking_url")],
  ['C05 confirmation email template', migration.includes('v_email_html :=') && migration.includes('Track order')],
  ['C05 queue dedupe', migration.includes('dedupe_key') && migration.includes('on conflict (dedupe_key) do nothing')],
  ['C05 immediate checkout worker kick', checkout.includes('process-notification-queue') && checkout.includes('8_000')],
  ['C05 customer worker is order-scoped', worker.includes('scopedOrderId') && worker.includes("query.eq('order_id', scopedOrderId)")],
  ['C05 delivery latency instrumentation', migration.includes('within_30_seconds') && migration.includes('latency_ms')],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`)
  if (!ok) failed++
}

if (failed) {
  console.error(`\nC-01–C-05 completion patch: ${failed} check(s) failed.`)
  process.exit(1)
}

console.log(`\nC-01–C-05 completion patch: ${checks.length} checks passed.`)
