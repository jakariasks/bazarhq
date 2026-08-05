import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Expand, Image as ImageIcon, ZoomIn } from 'lucide-react'

function normalizeImageValue(value) {
  if (typeof value === 'string') return value.trim()
  if (value && typeof value === 'object') return String(value.url || value.secure_url || value.src || '').trim()
  return ''
}

export function normalizeProductImages(images, fallbackImage = null) {
  let source = images

  if (typeof images === 'string') {
    try {
      source = JSON.parse(images)
    } catch {
      source = images.split(',')
    }
  }

  const values = Array.isArray(source) ? source.map(normalizeImageValue).filter(Boolean) : []
  const fallback = normalizeImageValue(fallbackImage)
  if (fallback && !values.includes(fallback)) values.unshift(fallback)
  return [...new Set(values)]
}

export default function ProductImageGallery({
  images,
  fallbackImage = null,
  alt = 'Product image',
  className = '',
  compact = false,
  objectFit = 'contain',
}) {
  const normalizedImages = useMemo(() => normalizeProductImages(images, fallbackImage), [images, fallbackImage])
  const [activeIndex, setActiveIndex] = useState(0)
  const [zoom, setZoom] = useState({ active: false, x: 50, y: 50, lensX: 50, lensY: 50 })
  const mainRef = useRef(null)

  useEffect(() => {
    setActiveIndex(0)
    setZoom({ active: false, x: 50, y: 50, lensX: 50, lensY: 50 })
  }, [normalizedImages.join('|')])

  const activeImage = normalizedImages[activeIndex] || null
  const hasMultiple = normalizedImages.length > 1

  function move(direction) {
    if (!normalizedImages.length) return
    setActiveIndex((current) => (current + direction + normalizedImages.length) % normalizedImages.length)
    setZoom({ active: false, x: 50, y: 50, lensX: 50, lensY: 50 })
  }

  function handlePointerMove(event) {
    if (!activeImage || compact || event.pointerType === 'touch') return
    const rect = mainRef.current?.getBoundingClientRect()
    if (!rect?.width || !rect?.height) return

    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100))
    setZoom({
      active: true,
      x,
      y,
      lensX: Math.min(90, Math.max(10, x)),
      lensY: Math.min(90, Math.max(10, y)),
    })
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div
        ref={mainRef}
        className={`group relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm ${compact ? 'min-h-[300px]' : 'aspect-square cursor-crosshair'}`}
        onPointerMove={handlePointerMove}
        onPointerEnter={(event) => {
          if (!compact && event.pointerType !== 'touch') setZoom((current) => ({ ...current, active: true }))
        }}
        onPointerLeave={() => setZoom((current) => ({ ...current, active: false }))}
      >
        {activeImage ? (
          <>
            <img
              src={activeImage}
              alt={`${alt} ${activeIndex + 1}`}
              className={`h-full w-full select-none transition duration-500 ${objectFit === 'cover' ? 'object-cover' : 'object-contain p-5 sm:p-7'}`}
              draggable="false"
            />

            {!compact && (
              <>
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 hidden bg-white bg-no-repeat transition-opacity duration-150 lg:block ${zoom.active ? 'opacity-100' : 'opacity-0'}`}
                  style={{
                    backgroundImage: `url("${activeImage.replaceAll('"', '%22')}")`,
                    backgroundPosition: `${zoom.x}% ${zoom.y}%`,
                    backgroundSize: objectFit === 'cover' ? '300%' : '340%',
                  }}
                />
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute hidden h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-white/95 bg-white/10 shadow-[0_18px_45px_rgba(15,23,42,.25)] ring-1 ring-slate-300/70 transition-opacity duration-150 lg:block ${zoom.active ? 'opacity-100' : 'opacity-0'}`}
                  style={{ left: `${zoom.lensX}%`, top: `${zoom.lensY}%` }}
                />
              </>
            )}
          </>
        ) : (
          <div className="flex h-full min-h-[300px] items-center justify-center text-slate-300">
            <ImageIcon className="h-20 w-20" />
          </div>
        )}

        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full bg-slate-950/78 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
          {compact ? <Expand className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
          {compact ? `${activeIndex + 1} / ${Math.max(normalizedImages.length, 1)}` : 'Move cursor to zoom 3.4×'}
        </div>

        {hasMultiple && (
          <>
            <button type="button" onClick={() => move(-1)} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/94 text-slate-900 shadow-lg ring-1 ring-slate-200 transition hover:scale-105" aria-label="Previous product image">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => move(1)} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/94 text-slate-900 shadow-lg ring-1 ring-slate-200 transition hover:scale-105" aria-label="Next product image">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {normalizedImages.length > 0 && (
          <div className="absolute bottom-4 right-4 rounded-full bg-white/94 px-3 py-1.5 text-xs font-black text-slate-800 shadow-sm ring-1 ring-slate-200">
            {activeIndex + 1} / {normalizedImages.length}
          </div>
        )}
      </div>

      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {normalizedImages.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => {
                setActiveIndex(index)
                setZoom({ active: false, x: 50, y: 50, lensX: 50, lensY: 50 })
              }}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-white p-1 transition ${index === activeIndex ? 'border-[var(--shop-primary,#4f46e5)] shadow-md ring-2 ring-[var(--shop-primary,#4f46e5)]/15' : 'border-slate-200 hover:border-slate-400'}`}
              aria-label={`Show product image ${index + 1}`}
            >
              <img src={image} alt="" className="h-full w-full rounded-xl object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
