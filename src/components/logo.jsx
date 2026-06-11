import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

/**
 * BazarHQ Logo component
 * size: 'sm' | 'md' | 'lg'
 * showText: show "BazarHQ" text next to logo
 * asLink: wrap in a <Link to="/">
 */
export function Logo({ size = 'md', showText = true, asLink = true, className }) {
  const sizes = {
    sm: { img: 'h-7 w-7', text: 'text-sm' },
    md: { img: 'h-9 w-9', text: 'text-base' },
    lg: { img: 'h-12 w-12', text: 'text-xl' },
  }
  const s = sizes[size] ?? sizes.md

  const inner = (
    <span className={cn('flex items-center gap-2', className)}>
      <img
        src="/logo.png"
        alt="BazarHQ"
        className={cn('shrink-0 rounded-xl object-contain', s.img)}
      />
      {showText && (
        <span className={cn('font-semibold tracking-tight', s.text)}>
          BazarHQ
        </span>
      )}
    </span>
  )

  if (!asLink) return inner

  return (
    <Link to="/" className="flex items-center gap-2">
      <img
        src="/logo.png"
        alt="BazarHQ"
        className={cn('shrink-0 rounded-xl object-contain', s.img)}
      />
      {showText && (
        <span className={cn('font-semibold tracking-tight', s.text)}>
          BazarHQ
        </span>
      )}
    </Link>
  )
}
