import fs from 'node:fs'

function loadEnv(path = '.env') {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]]) continue
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    process.env[match[1]] = value
  }
}
loadEnv()

const baseUrl = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const token = process.env.BAZARHQ_TEST_ACCESS_TOKEN || ''
const storeId = process.env.BAZARHQ_TEST_STORE_ID || ''

if (!baseUrl || !anonKey || !token || !storeId) {
  console.error('Live verification needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, BAZARHQ_TEST_ACCESS_TOKEN and BAZARHQ_TEST_STORE_ID.')
  console.error('Keep the access token local; do not commit or share it.')
  process.exit(2)
}

const end = new Date(); end.setHours(23, 59, 59, 999)
const start = new Date(end); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0)
const endExclusive = new Date(end.getTime() + 1)
const headers = { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

const t0 = performance.now()
const analyticsResponse = await fetch(`${baseUrl}/rest/v1/rpc/get_merchant_analytics`, {
  method: 'POST', headers,
  body: JSON.stringify({ p_store_id: storeId, p_start: start.toISOString(), p_end: endExclusive.toISOString() }),
})
const loadMs = Math.round(performance.now() - t0)
if (!analyticsResponse.ok) throw new Error(`Analytics RPC ${analyticsResponse.status}: ${await analyticsResponse.text()}`)
const analytics = await analyticsResponse.json()
const summary = analytics?.summary || {}

console.log(`Analytics RPC: ${loadMs} ms ${loadMs <= 3000 ? '✓ ≤3s' : '✗ >3s'}`)
console.log(`Revenue (cancelled excluded): ${Number(summary.revenue || 0)}`)
console.log(`Orders: ${Number(summary.orders || 0)}; cancelled: ${Number(summary.cancelled_orders || 0)}`)
console.log(`Unique sessions: ${Number(summary.unique_visitors || 0)}`)

const exportResponse = await fetch(`${baseUrl}/functions/v1/merchant-analytics-export`, {
  method: 'POST', headers,
  body: JSON.stringify({ store_id: storeId, start: start.toISOString(), end: endExclusive.toISOString() }),
})
if (!exportResponse.ok) throw new Error(`Export ${exportResponse.status}: ${await exportResponse.text()}`)

const headerNum = (name) => Number(exportResponse.headers.get(name) || 0)
const mismatches = []
if (headerNum('x-row-count') !== Number(summary.orders || 0)) mismatches.push('orders')
if (headerNum('x-cancelled-orders') !== Number(summary.cancelled_orders || 0)) mismatches.push('cancelled orders')
if (Math.abs(headerNum('x-analytics-revenue') - Number(summary.revenue || 0)) > 0.01) mismatches.push('revenue')
if (headerNum('x-unique-visitors') !== Number(summary.unique_visitors || 0)) mismatches.push('unique visitors')
if (headerNum('x-product-views') !== Number(summary.product_views || 0)) mismatches.push('product views')

if (mismatches.length) throw new Error(`Dashboard/export mismatch: ${mismatches.join(', ')}`)
if (loadMs > 3000) throw new Error(`Analytics SLA failed: ${loadMs} ms > 3000 ms`)

console.log('CSV reconciliation: ✓ exact dashboard totals')
console.log(`Export generation: ${exportResponse.headers.get('x-generated-ms') || '?'} ms`)
console.log('Live M-11/M-12 acceptance passed.')
