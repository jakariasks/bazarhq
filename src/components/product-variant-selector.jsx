import { Check, CircleSlash2 } from 'lucide-react'
import {
  findSelectedVariant,
  formatSelectedOptions,
  getVariantGroups,
  optionHasMatchingVariant,
} from '@/lib/product-variants'

export default function ProductVariantSelector({
  product,
  variants = [],
  selection = {},
  onChange,
}) {
  const groups = getVariantGroups(product, variants)
  const selectedVariant = findSelectedVariant(variants, selection, groups)
  const complete = groups.length > 0 && groups.every((group) => selection[group.name])

  if (!variants.length || !groups.length) return null

  function selectOption(groupName, optionValue) {
    if (!optionHasMatchingVariant(variants, selection, groupName, optionValue)) return

    const next = {
      ...selection,
      [groupName]: optionValue,
    }

    // If a previously selected value in a later group is no longer compatible
    // with the newly selected option, remove it instead of leaving an impossible
    // combination selected.
    groups.forEach((group) => {
      if (group.name === groupName || !next[group.name]) return

      const stillCompatible = optionHasMatchingVariant(
        variants,
        next,
        group.name,
        next[group.name],
      )

      if (!stillCompatible) delete next[group.name]
    })

    onChange?.(next)
  }

  return (
    <div className="mt-6 space-y-5">
      {groups.map((group) => (
        <div key={group.id || group.name}>
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <p className="text-sm font-black text-slate-900">
              Select {group.name}
            </p>
            {selection[group.name] && (
              <span className="text-xs font-bold text-[var(--shop-primary)]">
                {selection[group.name]}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {group.values.map((optionValue) => {
              const selected = selection[group.name] === optionValue
              const enabled = optionHasMatchingVariant(
                variants,
                selection,
                group.name,
                optionValue,
              )
              const existsButSoldOut = !enabled && optionHasMatchingVariant(
                variants,
                selection,
                group.name,
                optionValue,
                { inStockOnly: false },
              )

              return (
                <button
                  key={`${group.name}-${optionValue}`}
                  type="button"
                  onClick={() => selectOption(group.name, optionValue)}
                  disabled={!enabled}
                  aria-pressed={selected}
                  className={[
                    'relative min-w-[76px] rounded-xl border px-4 py-2.5 text-sm font-bold transition',
                    selected
                      ? 'border-[var(--shop-primary)] bg-[var(--shop-primary)] text-white shadow-sm'
                      : enabled
                        ? 'border-slate-200 bg-white text-slate-700 hover:border-[var(--shop-primary)] hover:bg-[var(--shop-primary)]/5 hover:text-[var(--shop-primary)]'
                        : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through opacity-75',
                  ].join(' ')}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {selected && <Check className="h-3.5 w-3.5" />}
                    {!enabled && <CircleSlash2 className="h-3.5 w-3.5" />}
                    {optionValue}
                  </span>
                  {existsButSoldOut && (
                    <span className="mt-0.5 block text-[10px] font-black uppercase tracking-wide">
                      Sold out
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div
        className={[
          'rounded-xl border px-4 py-3 text-sm',
          complete && selectedVariant
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-amber-200 bg-amber-50 text-amber-800',
        ].join(' ')}
      >
        {complete && selectedVariant ? (
          <>
            <span className="font-black">Selected:</span>{' '}
            {formatSelectedOptions(selection, groups)}
          </>
        ) : (
          <>
            <span className="font-black">Choose all options:</span>{' '}
            {groups
              .filter((group) => !selection[group.name])
              .map((group) => group.name)
              .join(', ')}
          </>
        )}
      </div>
    </div>
  )
}
