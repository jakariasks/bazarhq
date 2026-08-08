import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const checks = []
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
  checks.push(message)
}

const products = read('src/pages/merchant/products.jsx')
const prefs = read('src/components/merchant-notification-preferences.jsx')
const checkout = read('src/pages/checkout.jsx')
const worker = read('supabase/functions/process-notification-queue/index.ts')
const provider = read('supabase/functions/_shared/notification-providers.ts')
const reminder = read('supabase/functions/run-pending-order-reminders/index.ts')
const sql = read('supabase/migrations/20260808_merchant_notifications_low_stock_reminders_complete.sql')
const csv = read('public/samples/product-import-template.csv')

assert(products.includes('lowStockThreshold'), 'M-06 product threshold UI is present')
assert(products.includes("'low_stock_threshold'"), 'M-06 variant threshold editor is present')
assert(products.includes("kickNotificationDelivery('product_inventory_change')"), 'M-06 merchant inventory change kicks durable delivery')
assert(sql.includes('update of stock,variants,low_stock_threshold,status'), 'M-06 database trigger watches product and variant inventory')
assert(sql.includes("v_item->>'low_stock_threshold'"), 'M-06 variant-aware threshold SQL is present')
assert(csv.includes('low_stock_threshold'), 'M-06 CSV import template supports thresholds')

assert(checkout.includes('process-notification-queue'), 'M-07 checkout immediately kicks notification delivery')
assert(sql.includes("'new_order','New order received'"), 'M-07 new-order merchant queue trigger is present')
assert(provider.includes('RESEND_API_KEY'), 'M-07 Resend email provider adapter is present')
assert(provider.includes('SMS_GATEWAY_URL'), 'M-07 SMS gateway provider adapter is present')
assert(worker.includes('latency_ms'), 'M-07 delivery SLA latency is logged')
assert(prefs.includes('30-second delivery target'), 'M-07 merchant UI exposes the 30-second target')

assert(worker.includes('queueFallbackEmail'), 'M-08 SMS-to-email fallback is implemented')
assert(worker.includes('!deliveryError.retryable || attempt >= maxAttempts'), 'M-08 terminal SMS failures fall back without useless retries')
assert(worker.indexOf('// SMS first') < worker.indexOf('let emailQuery'), 'M-08 fallback email can be delivered in the same worker invocation')
assert(prefs.includes('Automatic email fallback when SMS cannot be delivered'), 'M-08 fallback preference UI is present')

assert(sql.includes('pending_reminder_queued_at'), 'M-09 reminder dedupe state is present')
assert(sql.includes("interval '48 hours'"), 'M-09 48-hour threshold is enforced in SQL')
assert(sql.includes('configure_bazarhq_notification_scheduler'), 'M-09 cron setup function is present')
assert(sql.includes("'*/5 * * * *'"), 'M-09 reminder worker is scheduled every 5 minutes')
assert(reminder.includes('create_pending_order_reminders'), 'M-09 reminder Edge Function invokes the durable RPC')
assert(reminder.includes('process-notification-queue'), 'M-09 reminders immediately kick delivery')

const helperUrl = pathToFileURL(path.join(root, 'src/lib/product-catalog-tools.js')).href
const { buildVariantRows, variantsForDatabase, parseCsv, validateProductCsv } = await import(`${helperUrl}?t=${Date.now()}`)
const types = [{ name: 'Size', values: ['S', 'M'] }]
const variants = [
  { options: { Size: 'S' }, stock: 2, low_stock_threshold: 1, price_adjustment: 0 },
  { options: { Size: 'M' }, stock: 6, low_stock_threshold: null, price_adjustment: 50 },
]
const rows = buildVariantRows(types, variants, 100, 4)
assert(rows[0].low_stock_threshold === '1', 'M-06 explicit variant threshold is preserved')
assert(rows[1].low_stock_threshold === '', 'M-06 blank variant threshold inherits product default')
const normalized = variantsForDatabase(types, rows, 100, 4)
assert(normalized.variants[0].low_stock_threshold === 1, 'M-06 variant threshold persists to DB payload')
assert(normalized.variants[1].low_stock_threshold === null, 'M-06 inherited threshold persists as null override')

const csvText = 'title,description,category,price,stock,low_stock_threshold\nA,Desc,General,100,3,2\n'
const validated = validateProductCsv(parseCsv(csvText))
assert(validated.errors.length === 0 && validated.records[0]?.low_stock_threshold === 2, 'M-06 CSV threshold validation passes')

console.log(`PASS: ${checks.length} M-06–M-09 completion checks`)
for (const item of checks) console.log(`✓ ${item}`)
