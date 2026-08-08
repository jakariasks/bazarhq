function asNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function cleanText(value) {
  return String(value ?? '').trim()
}

export function catalogSlugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function normalizeVariantTypes(value) {
  const raw = Array.isArray(value) ? value : []
  return raw
    .map((item, index) => {
      const name = cleanText(item?.name || item?.type || item?.label)
      const values = Array.isArray(item?.values)
        ? item.values
        : String(item?.valuesInput || item?.values || '').split(',')
      const uniqueValues = [...new Set(values.map(cleanText).filter(Boolean))]
      return {
        id: item?.id || `type-${index + 1}`,
        name,
        values: uniqueValues,
        valuesInput: item?.valuesInput ?? uniqueValues.join(', '),
      }
    })
    .filter((item) => item.name || item.values.length)
    .slice(0, 3)
}

function cartesian(groups) {
  if (!groups.length) return []
  return groups.reduce(
    (acc, group) => acc.flatMap((combo) => group.values.map((value) => ({ ...combo, [group.name]: value }))),
    [{}],
  )
}

function variantKey(options) {
  return Object.entries(options || {})
    .map(([name, value]) => `${catalogSlugify(name) || 'option'}-${catalogSlugify(value) || 'value'}`)
    .join('__')
}

function variantLabel(options, typeOrder = []) {
  const entries = typeOrder.length
    ? typeOrder.map((name) => [name, options?.[name]]).filter(([, value]) => value != null && value !== '')
    : Object.entries(options || {})
  return entries.map(([name, value]) => `${name}: ${value}`).join(', ')
}

export function buildVariantRows(variantTypes, existingVariants = [], basePrice = 0, defaultLowStockThreshold = 5) {
  const normalizedTypes = normalizeVariantTypes(variantTypes)
    .filter((item) => item.name && item.values.length)
  if (!normalizedTypes.length) return []

  const typeOrder = normalizedTypes.map((item) => item.name)
  const combinations = cartesian(normalizedTypes)
  const existing = Array.isArray(existingVariants) ? existingVariants : []
  const existingByKey = new Map()

  existing.forEach((item) => {
    if (!item || typeof item !== 'object') return
    const options = item.options && typeof item.options === 'object' ? item.options : {}
    const key = variantKey(options) || cleanText(item.id || item.combo || item.label)
    if (key) existingByKey.set(key, item)
  })

  return combinations.map((options) => {
    const key = variantKey(options)
    const previous = existingByKey.get(key) || {}
    const adjustment = previous.price_adjustment ?? previous.adjustment ?? (
      previous.price != null && previous.price !== ''
        ? asNumber(previous.price, asNumber(basePrice)) - asNumber(basePrice)
        : 0
    )
    const stock = Math.max(0, Math.round(asNumber(previous.stock, 0)))
    const label = variantLabel(options, typeOrder)

    return {
      id: previous.id || key,
      key,
      options,
      label,
      combo: label,
      sku: cleanText(previous.sku),
      stock: String(stock),
      low_stock_threshold: previous.low_stock_threshold == null || previous.low_stock_threshold === '' ? '' : String(Math.max(0, Math.round(asNumber(previous.low_stock_threshold, defaultLowStockThreshold)))),
      price_adjustment: String(asNumber(adjustment, 0)),
      price: asNumber(basePrice) + asNumber(adjustment, 0),
      available: stock > 0,
    }
  })
}

export function variantsForDatabase(variantTypes, variants, basePrice, defaultLowStockThreshold = 5) {
  const normalizedTypes = normalizeVariantTypes(variantTypes)
    .filter((item) => item.name && item.values.length)
    .map(({ name, values }) => ({ name, values }))
  const rows = buildVariantRows(normalizedTypes, variants, basePrice, defaultLowStockThreshold)
  const normalizedVariants = rows.map((item) => {
    const stock = Math.max(0, Math.round(asNumber(item.stock, 0)))
    const adjustment = asNumber(item.price_adjustment, 0)
    return {
      id: item.id || variantKey(item.options),
      options: item.options,
      label: item.label,
      combo: item.label,
      sku: cleanText(item.sku) || null,
      stock,
      low_stock_threshold: item.low_stock_threshold == null || item.low_stock_threshold === '' ? null : Math.max(0, Math.round(asNumber(item.low_stock_threshold, defaultLowStockThreshold))),
      price_adjustment: adjustment,
      price: Math.max(0, asNumber(basePrice) + adjustment),
      available: stock > 0,
    }
  })

  return {
    variantTypes: normalizedTypes,
    variants: normalizedVariants,
    totalStock: normalizedVariants.reduce((sum, item) => sum + item.stock, 0),
  }
}

export function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    const next = source[i + 1]

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"'
        i += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (char === ',' && !quoted) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1
      row.push(cell)
      if (row.some((value) => cleanText(value))) rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell)
  if (row.some((value) => cleanText(value))) rows.push(row)
  if (!rows.length) return { headers: [], rows: [] }

  const headers = rows[0].map((header) => cleanText(header).toLowerCase())
  const records = rows.slice(1).map((values, rowIndex) => {
    const record = { __row: rowIndex + 2 }
    headers.forEach((header, index) => {
      record[header] = values[index] ?? ''
    })
    return record
  })

  return { headers, rows: records }
}

function readField(row, aliases) {
  for (const key of aliases) {
    if (row[key] != null && cleanText(row[key]) !== '') return row[key]
  }
  return ''
}

function parseTags(value) {
  return [...new Set(String(value || '').split(/[|,]/).map(cleanText).filter(Boolean))].slice(0, 20)
}

function parseImages(row) {
  const primary = cleanText(readField(row, ['image_url', 'image', 'primary_image']))
  const extra = String(readField(row, ['images', 'image_urls']) || '')
    .split('|')
    .map(cleanText)
    .filter(Boolean)
  return [...new Set([primary, ...extra].filter(Boolean))].slice(0, 6)
}

function parseOptionalJson(value) {
  const text = cleanText(value)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export function validateProductCsv(parsed, { maxRows = 500 } = {}) {
  const errors = []
  const records = []
  const requiredHeaders = ['title', 'description', 'category', 'price']
  const missingHeaders = requiredHeaders.filter((header) => !parsed.headers.includes(header))
  if (missingHeaders.length) {
    return {
      errors: [{ row: 'Header', message: `Missing required column(s): ${missingHeaders.join(', ')}` }],
      records: [],
    }
  }

  if (!parsed.rows.length) {
    return { errors: [{ row: 'File', message: 'The CSV contains no product rows.' }], records: [] }
  }

  if (parsed.rows.length > maxRows) {
    return { errors: [{ row: 'File', message: `A single import can contain up to ${maxRows} products.` }], records: [] }
  }

  parsed.rows.forEach((row) => {
    const rowErrors = []
    const title = cleanText(row.title)
    const description = cleanText(row.description)
    const category = cleanText(row.category)
    const price = asNumber(row.price, NaN)
    const compareAtRaw = cleanText(readField(row, ['compare_at_price', 'compare_price', 'original_price']))
    const compareAt = compareAtRaw ? asNumber(compareAtRaw, NaN) : null
    const stockRaw = cleanText(row.stock)
    const stock = stockRaw ? asNumber(stockRaw, NaN) : 0
    const lowStockRaw = cleanText(readField(row, ['low_stock_threshold', 'low_stock_alert_at']))
    const lowStockThreshold = lowStockRaw ? asNumber(lowStockRaw, NaN) : 5
    const statusRaw = cleanText(row.status).toLowerCase() || 'draft'
    const status = ['active', 'published', 'live'].includes(statusRaw) ? 'published' : statusRaw === 'archived' ? 'archived' : 'draft'
    const deliveryModeRaw = cleanText(readField(row, ['delivery_mode', 'delivery_charge_mode'])).toLowerCase() || 'store_default'
    const deliveryMode = ['store_default', 'free', 'custom'].includes(deliveryModeRaw) ? deliveryModeRaw : null
    const images = parseImages(row)

    if (!title) rowErrors.push('title is required')
    if (!description) rowErrors.push('description is required')
    if (!category) rowErrors.push('category is required')
    if (!Number.isFinite(price) || price <= 0) rowErrors.push('price must be greater than 0')
    if (compareAtRaw && (!Number.isFinite(compareAt) || compareAt < 0)) rowErrors.push('compare_at_price must be a valid positive number')
    if (Number.isFinite(compareAt) && compareAt > 0 && Number.isFinite(price) && compareAt < price) rowErrors.push('compare_at_price cannot be lower than price')
    if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) rowErrors.push('stock must be a non-negative whole number')
    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0 || !Number.isInteger(lowStockThreshold)) rowErrors.push('low_stock_threshold must be a non-negative whole number')
    if (!deliveryMode) rowErrors.push('delivery_mode must be store_default, free, or custom')

    const variantTypesJson = parseOptionalJson(readField(row, ['variant_types', 'variant_types_json']))
    const variantsJson = parseOptionalJson(readField(row, ['variants', 'variants_json']))
    if (variantTypesJson === undefined) rowErrors.push('variant_types must be valid JSON when provided')
    if (variantsJson === undefined) rowErrors.push('variants must be valid JSON when provided')
    if (variantTypesJson != null && !Array.isArray(variantTypesJson)) rowErrors.push('variant_types JSON must be an array')
    if (variantsJson != null && !Array.isArray(variantsJson)) rowErrors.push('variants JSON must be an array')
    if (Array.isArray(variantsJson)) {
      variantsJson.forEach((variant, index) => {
        if (variant?.low_stock_threshold == null || cleanText(variant.low_stock_threshold) === '') return
        const threshold = asNumber(variant.low_stock_threshold, NaN)
        if (!Number.isFinite(threshold) || threshold < 0 || !Number.isInteger(threshold)) {
          rowErrors.push(`variant ${index + 1} low_stock_threshold must be a non-negative whole number`)
        }
      })
    }

    if (rowErrors.length) {
      errors.push({ row: row.__row, message: rowErrors.join('; ') })
      return
    }

    let variantData = { variantTypes: [], variants: [], totalStock: Math.round(stock) }
    if (Array.isArray(variantTypesJson) && Array.isArray(variantsJson) && variantsJson.length) {
      variantData = variantsForDatabase(variantTypesJson, variantsJson, price, lowStockThreshold)
      if (!variantData.variantTypes.length || !variantData.variants.length) {
        errors.push({ row: row.__row, message: 'variant_types/variants do not produce valid combinations' })
        return
      }
    }

    records.push({
      row: row.__row,
      title,
      description,
      category,
      price,
      compare_at_price: compareAtRaw ? compareAt : null,
      stock: variantData.variants.length ? variantData.totalStock : Math.round(stock),
      low_stock_threshold: Math.max(0, Math.round(lowStockThreshold)),
      status,
      sku: cleanText(row.sku) || null,
      tags: parseTags(row.tags),
      image_url: images[0] || null,
      images,
      delivery_charge_mode: deliveryMode || 'store_default',
      delivery_charge_dhaka: cleanText(readField(row, ['delivery_dhaka', 'delivery_charge_dhaka']))
        ? asNumber(readField(row, ['delivery_dhaka', 'delivery_charge_dhaka']), 0)
        : null,
      delivery_charge_outside_dhaka: cleanText(readField(row, ['delivery_outside_dhaka', 'delivery_charge_outside_dhaka']))
        ? asNumber(readField(row, ['delivery_outside_dhaka', 'delivery_charge_outside_dhaka']), 0)
        : null,
      has_variants: variantData.variants.length > 0,
      variant_types: variantData.variantTypes,
      variants: variantData.variants,
    })
  })

  return { errors, records }
}

export function uniqueCatalogSlug(title, existingSlugs, suffix = '') {
  const base = catalogSlugify(title) || 'product'
  const normalizedExisting = existingSlugs instanceof Set ? existingSlugs : new Set(existingSlugs || [])
  const suffixPart = cleanText(suffix) ? `-${catalogSlugify(suffix)}` : ''
  let candidate = `${base}${suffixPart}`
  let counter = 2
  while (normalizedExisting.has(candidate)) {
    candidate = `${base}${suffixPart}-${counter}`
    counter += 1
  }
  normalizedExisting.add(candidate)
  return candidate
}
