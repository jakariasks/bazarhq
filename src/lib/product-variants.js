function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function parseArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim()) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function cleanText(value) {
  return String(value ?? '').trim()
}

/**
 * Canonical comparison key for variant group names.
 *
 * This deliberately ignores:
 * - letter case: Size === size
 * - spaces / underscore / hyphen: Shoe Size === shoe_size
 * - British spelling: Colour === Color
 *
 * Display labels are NOT changed; this is only for matching old/new records.
 */
function canonicalOptionName(value) {
  let key = cleanText(value)
    .toLowerCase()
    .replace(/[\s_-]+/g, '')

  if (key === 'colour' || key === 'colours') key = 'color'
  if (key === 'colors') key = 'color'
  if (key === 'sizes') key = 'size'

  return key
}

function canonicalOptionValue(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function optionValueByName(options, requestedName) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return ''

  // Exact match remains the fastest and preferred path.
  if (Object.prototype.hasOwnProperty.call(options, requestedName)) {
    return cleanText(options[requestedName])
  }

  const requestedKey = canonicalOptionName(requestedName)
  if (!requestedKey) return ''

  const entry = Object.entries(options).find(
    ([name]) => canonicalOptionName(name) === requestedKey,
  )

  return entry ? cleanText(entry[1]) : ''
}

function cleanOptions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, option]) => [cleanText(key), cleanText(option)])
      .filter(([key, option]) => key && option),
  )
}

function extractVariantOptions(variant) {
  if (!variant || typeof variant !== 'object') return {}

  // Current canonical shape is variant.options.
  // The extra aliases keep older imported/staged BazarHQ variant data usable.
  const direct =
    (variant.options && typeof variant.options === 'object' && !Array.isArray(variant.options) && variant.options) ||
    (variant.attributes && typeof variant.attributes === 'object' && !Array.isArray(variant.attributes) && variant.attributes) ||
    (variant.option_values && typeof variant.option_values === 'object' && !Array.isArray(variant.option_values) && variant.option_values) ||
    (variant.variant_options && typeof variant.variant_options === 'object' && !Array.isArray(variant.variant_options) && variant.variant_options) ||
    {}

  return cleanOptions(direct)
}

function parseOptionsFromLabel(label) {
  const source = cleanText(label)
  if (!source || !source.includes(':')) return {}

  const result = {}

  source.split(',').forEach((part) => {
    const separator = part.indexOf(':')
    if (separator < 1) return

    const key = cleanText(part.slice(0, separator))
    const value = cleanText(part.slice(separator + 1))

    if (key && value) result[key] = value
  })

  return result
}

function mergeOptions(...sources) {
  const result = {}

  sources.forEach((source) => {
    Object.entries(source || {}).forEach(([name, value]) => {
      const cleanName = cleanText(name)
      const cleanValue = cleanText(value)
      if (!cleanName || !cleanValue) return

      // Keep the first display spelling for a canonical group, but let explicit
      // object data override a label-parsed value.
      const canonical = canonicalOptionName(cleanName)
      const existingKey = Object.keys(result).find(
        (key) => canonicalOptionName(key) === canonical,
      )

      if (existingKey) {
        result[existingKey] = cleanValue
      } else {
        result[cleanName] = cleanValue
      }
    })
  })

  return result
}

export function getVariantId(variant) {
  if (!variant) return null

  const options = extractVariantOptions(variant)

  return (
    cleanText(variant.id) ||
    cleanText(variant.key) ||
    cleanText(variant.combo) ||
    cleanText(variant.label) ||
    (Object.keys(options).length ? JSON.stringify(options) : null)
  )
}

export function buildVariantLabel(variantOrOptions, orderedNames = []) {
  if (!variantOrOptions) return null

  if (
    variantOrOptions.options ||
    variantOrOptions.attributes ||
    variantOrOptions.option_values ||
    variantOrOptions.variant_options ||
    variantOrOptions.combo ||
    variantOrOptions.label ||
    variantOrOptions.id
  ) {
    const direct = cleanText(variantOrOptions.combo || variantOrOptions.label)
    if (direct) return direct

    return buildVariantLabel(extractVariantOptions(variantOrOptions), orderedNames)
  }

  const options = cleanOptions(variantOrOptions)
  const names = orderedNames.length ? orderedNames : Object.keys(options)

  const parts = names
    .map((name) => {
      const value = optionValueByName(options, name)
      return value ? `${name}: ${value}` : ''
    })
    .filter(Boolean)

  return parts.join(', ') || null
}

export function normalizeVariantTypes(product) {
  const declared = parseArray(product?.variant_types)
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null

      const name = cleanText(item.name || item.type || item.label)
      const values = Array.isArray(item.values)
        ? item.values
        : String(item.values || item.valuesInput || '').split(',')

      const uniqueValues = [...new Set(values.map(cleanText).filter(Boolean))]

      return name
        ? {
            id: cleanText(item.id) || `type-${index + 1}`,
            name,
            values: uniqueValues,
          }
        : null
    })
    .filter(Boolean)

  if (declared.length) return declared

  const variants = parseArray(product?.variants)
  const names = []
  const valuesByCanonicalName = new Map()

  variants.forEach((variant) => {
    if (!variant || typeof variant !== 'object') return

    const options = mergeOptions(
      parseOptionsFromLabel(variant.combo || variant.label),
      extractVariantOptions(variant),
    )

    Object.entries(options).forEach(([name, value]) => {
      const canonical = canonicalOptionName(name)
      if (!canonical) return

      const existingName = names.find(
        (candidate) => canonicalOptionName(candidate) === canonical,
      )

      if (!existingName) names.push(name)

      if (!valuesByCanonicalName.has(canonical)) {
        valuesByCanonicalName.set(canonical, [])
      }

      const values = valuesByCanonicalName.get(canonical)
      if (
        value &&
        !values.some(
          (existing) => canonicalOptionValue(existing) === canonicalOptionValue(value),
        )
      ) {
        values.push(value)
      }
    })
  })

  return names.map((name, index) => ({
    id: `type-${index + 1}`,
    name,
    values: valuesByCanonicalName.get(canonicalOptionName(name)) || [],
  }))
}

export function getEffectiveVariantPrice(product, variant) {
  const basePrice = Math.max(0, toNumber(product?.price, 0))

  if (!variant) return basePrice

  if (variant.price !== '' && variant.price != null) {
    return Math.max(0, toNumber(variant.price, basePrice))
  }

  const adjustment = toNumber(
    variant.price_adjustment ?? variant.adjustment,
    0,
  )

  return Math.max(0, basePrice + adjustment)
}

export function getVariantLowStockThreshold(product, variant) {
  const productThreshold = Math.max(
    0,
    Math.round(toNumber(product?.low_stock_threshold, 5)),
  )

  if (
    variant?.low_stock_threshold == null ||
    variant?.low_stock_threshold === ''
  ) {
    return productThreshold
  }

  return Math.max(
    0,
    Math.round(toNumber(variant.low_stock_threshold, productThreshold)),
  )
}

export function normalizeProductVariants(product) {
  const typeNames = normalizeVariantTypes(product).map((item) => item.name)
  const variants = parseArray(product?.variants)

  return variants
    .filter((variant) => variant && typeof variant === 'object')
    .map((variant, index) => {
      const options = mergeOptions(
        parseOptionsFromLabel(variant.combo || variant.label),
        extractVariantOptions(variant),
      )

      const id = getVariantId({ ...variant, options }) || `variant-${index + 1}`
      const label =
        buildVariantLabel({ ...variant, options }, typeNames) ||
        `Variant ${index + 1}`
      const stock = Math.max(0, Math.round(toNumber(variant.stock, 0)))
      const price = getEffectiveVariantPrice(product, variant)
      const lowStockThreshold = getVariantLowStockThreshold(product, variant)
      const explicitlyUnavailable =
        variant.available === false ||
        String(variant.available).toLowerCase() === 'false'
      const available = stock > 0 && !explicitlyUnavailable

      return {
        ...variant,
        id,
        options,
        label,
        combo: cleanText(variant.combo) || label,
        stock,
        price,
        price_adjustment: toNumber(
          variant.price_adjustment ?? variant.adjustment,
          price - toNumber(product?.price, 0),
        ),
        low_stock_threshold: lowStockThreshold,
        available,
      }
    })
}

export function getVariantGroups(product, normalizedVariants = null) {
  const variants = normalizedVariants || normalizeProductVariants(product)
  const declared = normalizeVariantTypes(product)

  if (declared.length) {
    return declared.map((group) => {
      const values = [...group.values]

      variants.forEach((variant) => {
        const value = optionValueByName(variant.options, group.name)
        if (
          value &&
          !values.some(
            (existing) =>
              canonicalOptionValue(existing) === canonicalOptionValue(value),
          )
        ) {
          values.push(value)
        }
      })

      return { ...group, values }
    })
  }

  const names = []
  const valuesByCanonicalName = new Map()

  variants.forEach((variant) => {
    Object.entries(variant.options || {}).forEach(([name, value]) => {
      const canonical = canonicalOptionName(name)
      if (!canonical) return

      if (
        !names.some(
          (existingName) => canonicalOptionName(existingName) === canonical,
        )
      ) {
        names.push(name)
      }

      if (!valuesByCanonicalName.has(canonical)) {
        valuesByCanonicalName.set(canonical, [])
      }

      const values = valuesByCanonicalName.get(canonical)

      if (
        value &&
        !values.some(
          (existing) =>
            canonicalOptionValue(existing) === canonicalOptionValue(value),
        )
      ) {
        values.push(value)
      }
    })
  })

  return names.map((name, index) => ({
    id: `type-${index + 1}`,
    name,
    values: valuesByCanonicalName.get(canonicalOptionName(name)) || [],
  }))
}

export function variantMatchesSelection(
  variant,
  selection,
  { ignoreName = null } = {},
) {
  if (!variant) return false

  const ignoreCanonical = canonicalOptionName(ignoreName)

  return Object.entries(selection || {}).every(([name, value]) => {
    if (!value) return true
    if (
      ignoreCanonical &&
      canonicalOptionName(name) === ignoreCanonical
    ) {
      return true
    }

    const variantValue = optionValueByName(variant.options, name)

    return (
      variantValue &&
      canonicalOptionValue(variantValue) === canonicalOptionValue(value)
    )
  })
}

export function optionHasMatchingVariant(
  variants,
  selection,
  groupName,
  optionValue,
  { inStockOnly = true } = {},
) {
  const nextSelection = {
    ...(selection || {}),
    [groupName]: optionValue,
  }

  return variants.some(
    (variant) =>
      (!inStockOnly || variant.available) &&
      variantMatchesSelection(variant, nextSelection),
  )
}

export function findSelectedVariant(variants, selection, groups = []) {
  if (!variants.length) return null

  const requiredNames = groups.length
    ? groups.map((group) => group.name)
    : [
        ...new Set(
          variants.flatMap((variant) => Object.keys(variant.options || {})),
        ),
      ]

  if (
    requiredNames.length &&
    requiredNames.some((name) => !cleanText(selection?.[name]))
  ) {
    return null
  }

  return (
    variants.find((variant) =>
      requiredNames.every((name) => {
        const variantValue = optionValueByName(variant.options, name)
        return (
          variantValue &&
          canonicalOptionValue(variantValue) ===
            canonicalOptionValue(selection?.[name])
        )
      }),
    ) || null
  )
}

export function buildCartVariant(product, variant) {
  if (!variant) return null

  const normalized = {
    ...variant,
    id: getVariantId(variant),
    label: buildVariantLabel(variant),
    options: cleanOptions(variant.options),
    price: getEffectiveVariantPrice(product, variant),
    stock: Math.max(0, Math.round(toNumber(variant.stock, 0))),
    low_stock_threshold: getVariantLowStockThreshold(product, variant),
  }

  return normalized
}

export function formatSelectedOptions(selection, groups = []) {
  const names = groups.length
    ? groups.map((group) => group.name)
    : Object.keys(selection || {})

  return names
    .filter((name) => cleanText(selection?.[name]))
    .map((name) => `${name}: ${selection[name]}`)
    .join(', ')
}

/**
 * Commerce summary used by storefront/listing UIs.
 *
 * Variant products must not be represented by the base product row alone:
 * the purchasable price can differ per variant and explicit unavailable
 * variants must not keep the product looking in-stock. This helper keeps the
 * listing, filters, cart entry points and detail page on one canonical view.
 */
export function getProductCommerceSummary(product) {
  const basePrice = Math.max(0, toNumber(product?.price, 0))
  const baseStock = Math.max(0, Math.round(toNumber(product?.stock, 0)))
  const variants = normalizeProductVariants(product)

  if (!variants.length) {
    return {
      hasVariants: false,
      variants,
      availableVariants: [],
      price: basePrice,
      minPrice: basePrice,
      maxPrice: basePrice,
      hasPriceRange: false,
      stock: baseStock,
      inStock: baseStock > 0,
    }
  }

  const availableVariants = variants.filter((variant) => variant.available)
  const priceSource = availableVariants.length ? availableVariants : variants
  const prices = priceSource
    .map((variant) => Math.max(0, toNumber(variant.price, basePrice)))
    .filter(Number.isFinite)
  const minPrice = prices.length ? Math.min(...prices) : basePrice
  const maxPrice = prices.length ? Math.max(...prices) : basePrice
  const stock = availableVariants.reduce(
    (sum, variant) => sum + Math.max(0, Math.round(toNumber(variant.stock, 0))),
    0,
  )

  return {
    hasVariants: true,
    variants,
    availableVariants,
    price: minPrice,
    minPrice,
    maxPrice,
    hasPriceRange: maxPrice > minPrice,
    stock,
    inStock: stock > 0,
  }
}

// Exported only for lightweight verifier/tests; harmless to app code.
export const __variantMatchingInternals = {
  canonicalOptionName,
  canonicalOptionValue,
  optionValueByName,
}
