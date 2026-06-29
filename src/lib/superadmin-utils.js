export const BD_CURRENCY = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  maximumFractionDigits: 0,
})

export function formatMoney(value = 0) {
  return BD_CURRENCY.format(Number(value || 0)).replace('BDT', '৳')
}

export function formatNumber(value = 0) {
  return new Intl.NumberFormat('en-BD').format(Number(value || 0))
}

export function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-BD', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function startOfDaysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

export function downloadCSV(filename, rows = []) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (value) => {
    const text = value == null ? '' : String(value)
    return `"${text.replaceAll('"', '""')}"`
  }
  const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function statusClass(status) {
  const value = String(status || '').toLowerCase()
  if (['active', 'healthy', 'online', 'sent', 'approved', 'published', 'delivered', 'paid'].includes(value)) {
    return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
  }
  if (['warning', 'scheduled', 'pending', 'draft', 'processing'].includes(value)) {
    return 'bg-amber-500/15 text-amber-200 border-amber-500/30'
  }
  if (['error', 'down', 'failed', 'cancelled', 'suspended', 'deleted', 'rejected'].includes(value)) {
    return 'bg-rose-500/15 text-rose-200 border-rose-500/30'
  }
  return 'bg-slate-500/15 text-slate-200 border-slate-500/30'
}
