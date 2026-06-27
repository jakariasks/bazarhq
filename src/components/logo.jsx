import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

const sizeMap = {
  sm: { mark: 'h-8 w-8', text: 'text-base', sub: 'text-[9px]' },
  md: { mark: 'h-10 w-10', text: 'text-lg', sub: 'text-[10px]' },
  lg: { mark: 'h-12 w-12', text: 'text-2xl', sub: 'text-[11px]' },
}

function LogoMark({ size = 'md' }) {
  const s = sizeMap[size] ?? sizeMap.md

  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-emerald-500 text-white shadow-[0_14px_34px_rgba(79,70,229,0.28)] ring-1 ring-white/30', s.mark)}>
      <span className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.55),transparent_30%)]" />
      <svg viewBox="0 0 48 48" className="relative h-[68%] w-[68%]" aria-hidden="true">
        <path
          d="M14.5 19.5h19l-2 15.5a4 4 0 0 1-4 3.5h-7a4 4 0 0 1-4-3.5l-2-15.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
        <path
          d="M18.5 20c.7-6.2 3.2-9.5 5.5-9.5s4.8 3.3 5.5 9.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path d="M20 27h8M20 32h6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.92" />
      </svg>
    </span>
  )
}

export function Logo({ size = 'md', showText = true, asLink = true, className }) {
  const s = sizeMap[size] ?? sizeMap.md

  const inner = (
    <span className={cn('inline-flex items-center gap-3 text-slate-950', className)}>
      <LogoMark size={size} />
      {showText && (
        <span className="leading-none">
          <span className={cn('block font-black tracking-tight', s.text)}>
            Bazar<span className="bg-gradient-to-r from-indigo-600 to-emerald-500 bg-clip-text text-transparent">HQ</span>
          </span>
          <span className={cn('mt-1 hidden font-bold uppercase tracking-[0.24em] text-slate-400 sm:block', s.sub)}>
            Commerce OS
          </span>
        </span>
      )}
    </span>
  )

  if (!asLink) return inner

  return (
    <Link to="/" className="inline-flex items-center gap-3 rounded-2xl outline-none ring-primary/30 transition-transform hover:-translate-y-0.5 focus-visible:ring-4">
      {inner}
    </Link>
  )
}
