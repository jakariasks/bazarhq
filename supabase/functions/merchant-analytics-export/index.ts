import { corsHeaders, requireUser, safeError } from '../_shared/merchant-auth.ts'

function csvCell(value: unknown) {
  const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed.' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  try {
    const { admin, user } = await requireUser(req)
    const body = await req.json().catch(() => ({}))
    const storeId = String(body.store_id || '')
    const start = new Date(String(body.start || ''))
    const end = new Date(String(body.end || ''))
    if (!storeId || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) throw new Error('INVALID_RANGE')
    if (end.getTime() - start.getTime() > 5 * 366 * 24 * 60 * 60 * 1000) throw new Error('RANGE_TOO_LARGE')

    const { data: store } = await admin.from('stores').select('id,shop_name,owner_id').eq('id', storeId).eq('owner_id', user.id).maybeSingle()
    if (!store) throw new Error('STORE_NOT_FOUND')

    const rows: Record<string, unknown>[] = []
    const pageSize = 1000
    for (let from = 0; from < 50_000; from += pageSize) {
      const { data, error } = await admin
        .from('orders')
        .select('order_id,created_at,customer_name,customer_phone,status,payment_method,payment_status,subtotal,delivery_charge,discount,total,district,items')
        .eq('store_id', storeId)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('created_at', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < pageSize) break
    }

    const header = ['Order ID','Date','Customer','Phone','Status','Payment Method','Payment Status','Subtotal','Delivery Charge','Discount','Total','District','Items']
    const lines = [header.map(csvCell).join(',')]
    for (const row of rows) lines.push([
      row.order_id, row.created_at, row.customer_name, row.customer_phone, row.status,
      row.payment_method, row.payment_status, row.subtotal, row.delivery_charge,
      row.discount, row.total, row.district, row.items,
    ].map(csvCell).join(','))
    const filename = `${String(store.shop_name || 'store').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-analytics-${start.toISOString().slice(0,10)}-to-${end.toISOString().slice(0,10)}.csv`
    return new Response(`\uFEFF${lines.join('\n')}`, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'X-Row-Count': String(rows.length) },
    })
  } catch (error) {
    if (error instanceof Response) return error
    const code = String((error as Error)?.message || '')
    const status = code === 'STORE_NOT_FOUND' ? 404 : 400
    return new Response(JSON.stringify({ error: code === 'INVALID_RANGE' ? 'Select a valid date range.' : code === 'RANGE_TOO_LARGE' ? 'Export range cannot exceed five years.' : code === 'STORE_NOT_FOUND' ? 'Store not found.' : safeError(error, 'Could not export analytics.') }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
