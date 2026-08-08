import { corsHeaders, requireUser, safeError } from '../_shared/merchant-auth.ts'

const MAX_EXPORT_ROWS = 50_000
const FIVE_YEARS_MS = 5 * 366 * 24 * 60 * 60 * 1000
const exposedHeaders = [
  'Content-Disposition',
  'X-Row-Count',
  'X-Valid-Orders',
  'X-Cancelled-Orders',
  'X-Analytics-Revenue',
  'X-Average-Order-Value',
  'X-Unique-Visitors',
  'X-Product-Views',
  'X-Generated-Ms',
].join(', ')

function csvCell(value: unknown) {
  const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function num(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const started = Date.now()
  try {
    const { admin, user } = await requireUser(req)
    const body = await req.json().catch(() => ({}))
    const storeId = String(body.store_id || '')
    const start = new Date(String(body.start || ''))
    const end = new Date(String(body.end || ''))

    if (!storeId || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      return json({ error: 'Select a valid date range.', code: 'INVALID_RANGE' }, 400)
    }
    if (end.getTime() - start.getTime() > FIVE_YEARS_MS) {
      return json({ error: 'Export range cannot exceed five years.', code: 'RANGE_TOO_LARGE' }, 400)
    }

    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('id,shop_name,owner_id')
      .eq('id', storeId)
      .eq('owner_id', user.id)
      .maybeSingle()
    if (storeError) throw storeError
    if (!store) return json({ error: 'Store not found.', code: 'STORE_NOT_FOUND' }, 404)

    const [{ count: orderCount, error: countError }, { data: exportSummary, error: summaryError }] = await Promise.all([
      admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString()),
      admin.rpc('get_merchant_analytics_export_summary', {
        p_store_id: storeId,
        p_owner_id: user.id,
        p_start: start.toISOString(),
        p_end: end.toISOString(),
      }),
    ])
    if (countError) throw countError
    if (summaryError) throw summaryError

    const totalRows = Number(orderCount || 0)
    if (totalRows > MAX_EXPORT_ROWS) {
      return json({
        error: `This range contains ${totalRows.toLocaleString()} orders. Export is limited to ${MAX_EXPORT_ROWS.toLocaleString()} orders; choose a shorter range.`,
        code: 'ROW_LIMIT_EXCEEDED',
        row_count: totalRows,
      }, 413)
    }

    const rows: Record<string, unknown>[] = []
    const pageSize = 1000
    for (let from = 0; from < totalRows; from += pageSize) {
      const { data, error } = await admin
        .from('orders')
        .select('order_id,created_at,customer_name,customer_phone,status,payment_method,payment_status,subtotal,delivery_charge,discount,total,district,items')
        .eq('store_id', storeId)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('created_at', { ascending: true })
        .range(from, Math.min(from + pageSize - 1, totalRows - 1))
      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < pageSize) break
    }

    const summary = exportSummary || {}
    const reportRows: unknown[][] = [
      ['BazarHQ Merchant Analytics Export'],
      ['Store', store.shop_name || 'Store'],
      ['Start', start.toISOString()],
      ['End (exclusive)', end.toISOString()],
      ['Generated at', new Date().toISOString()],
      [],
      ['Dashboard reconciliation summary'],
      ['Revenue (cancelled excluded)', num(summary.revenue)],
      ['Orders (all statuses)', num(summary.orders)],
      ['Valid orders', num(summary.valid_orders)],
      ['Cancelled orders', num(summary.cancelled_orders)],
      ['Average order value', num(summary.average_order_value)],
      ['Unique visitors (distinct session_id)', num(summary.unique_visitors)],
      ['Product views', num(summary.product_views)],
      ['Homepage visitors', num(summary.homepage_visitors)],
      ['Category visitors', num(summary.category_visitors)],
      [],
      ['Order detail'],
      ['Order ID','Date','Customer','Phone','Status','Payment Method','Payment Status','Subtotal','Delivery Charge','Discount','Total','District','Items'],
    ]

    for (const row of rows) {
      reportRows.push([
        row.order_id, row.created_at, row.customer_name, row.customer_phone, row.status,
        row.payment_method, row.payment_status, row.subtotal, row.delivery_charge,
        row.discount, row.total, row.district, row.items,
      ])
    }

    const csv = reportRows.map((row) => row.map(csvCell).join(',')).join('\n')
    const filename = `${String(store.shop_name || 'store').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-analytics-${start.toISOString().slice(0,10)}-to-${new Date(end.getTime() - 1).toISOString().slice(0,10)}.csv`
    const generatedMs = Date.now() - started

    return new Response(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Expose-Headers': exposedHeaders,
        'X-Row-Count': String(rows.length),
        'X-Valid-Orders': String(num(summary.valid_orders)),
        'X-Cancelled-Orders': String(num(summary.cancelled_orders)),
        'X-Analytics-Revenue': String(num(summary.revenue)),
        'X-Average-Order-Value': String(num(summary.average_order_value)),
        'X-Unique-Visitors': String(num(summary.unique_visitors)),
        'X-Product-Views': String(num(summary.product_views)),
        'X-Generated-Ms': String(generatedMs),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof Response) return error
    return json({ error: safeError(error, 'Could not export analytics.'), code: 'EXPORT_FAILED' }, 500)
  }
})
