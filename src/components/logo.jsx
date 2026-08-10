const sizes = {
  sm: {
    mark: 'h-8 w-8',
    title: 'text-base',
    subtitle: 'text-[7px]',
    gap: 'gap-2',
  },
  md: {
    mark: 'h-10 w-10',
    title: 'text-lg',
    subtitle: 'text-[8px]',
    gap: 'gap-2.5',
  },
  lg: {
    mark: 'h-12 w-12',
    title: 'text-xl',
    subtitle: 'text-[9px]',
    gap: 'gap-3',
  },
}

function joinClass(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function Logo({ size = 'md', className = '', showText = true, compact = false }) {
  const current = sizes[size] || sizes.md

  return (
    <div className={joinClass('inline-flex items-center', current.gap, className)}>
      <span
        className={joinClass(
          'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80',
          current.mark
        )}
      >
        <img
          src="/logo.png"
          alt="BazarHQ logo"
          className="h-full w-full object-cover"
          draggable="false"
        />
      </span>

      {showText && !compact ? (
        <span className="leading-none">
          <span className={joinClass('block font-extrabold tracking-tight text-current', current.title)}>
            Bazar<span className="text-emerald-500">HQ</span>
          </span>
          <span className={joinClass('mt-1 block font-bold uppercase tracking-[0.34em] text-slate-400', current.subtitle)}>
            A Bangladeshi MarketPlace
          </span>
        </span>
      ) : null}
    </div>
  )
}

export default Logo
