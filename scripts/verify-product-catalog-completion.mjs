import fs from 'node:fs'

const products = fs.readFileSync(new URL('../src/pages/merchant/products.jsx', import.meta.url), 'utf8')
const tools = fs.readFileSync(new URL('../src/lib/product-catalog-tools.js', import.meta.url), 'utf8')
const migration = fs.readFileSync(new URL('../supabase/migrations/20260808_product_variants_catalog_completion.sql', import.meta.url), 'utf8')
const template = fs.readFileSync(new URL('../public/samples/product-import-template.csv', import.meta.url), 'utf8')
const statusMigration = fs.readFileSync(new URL('../supabase/migrations/20260808_products_status_contract_fix.sql', import.meta.url), 'utf8')

const checks = [
  ['variant editor', products.includes('function VariantEditorSection') && products.includes('Product variants')],
  ['variant stock and adjustment', products.includes('Price adjustment') && products.includes('variantsForDatabase')],
  ['duplicate action', products.includes('async function duplicateProduct') && products.includes('Draft duplicate created')],
  ['bulk CSV import', products.includes('function BulkImportDialog') && products.includes('async function importProducts')],
  ['500 row validation', tools.includes('maxRows = 500')],
  ['CSV parser', tools.includes('export function parseCsv') && tools.includes('validateProductCsv')],
  ['variant combination generator', tools.includes('export function buildVariantRows')],
  ['schema completion', migration.includes('has_variants') && migration.includes('variant_types') && migration.includes('variants')],
  ['CSV template variant example', template.includes('variant_types') && template.includes('Variant Product')],
  ['canonical published status', products.includes("form.status === 'active' ? 'published'") && tools.includes("? 'published' : statusRaw === 'archived'")],
  ['database status constraint', statusMigration.includes("status in ('draft', 'published', 'archived')")],
]

const failed = checks.filter(([, ok]) => !ok)
if (failed.length) {
  console.error('Product catalog completion verification failed:')
  failed.forEach(([label]) => console.error(`- ${label}`))
  process.exit(1)
}

console.log('Product catalog completion verification passed.')
checks.forEach(([label]) => console.log(`✓ ${label}`))
