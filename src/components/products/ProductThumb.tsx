import { useEffect, useState } from 'react'
import { cn } from '@/utils/format'
import { isImagePath, resolveImageUrl } from '@/utils/resolveImageUrl'

interface ProductThumbProps {
  src?: string | null
  fallback?: string
  className?: string
  imgClassName?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeMap = {
  sm: 'h-10 w-10 text-xl',
  md: 'h-14 w-14 text-2xl',
  lg: 'h-20 w-20 text-4xl',
  xl: 'h-28 w-full text-5xl',
}

function safeFallback(fallback?: string): string {
  if (!fallback || isImagePath(fallback)) return '📦'
  return fallback
}

export function ProductThumb({
  src,
  fallback = '📦',
  className,
  imgClassName,
  size = 'sm',
}: ProductThumbProps) {
  const resolved = resolveImageUrl(src)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setBroken(false)
  }, [resolved])

  const showImage = Boolean(resolved) && !broken

  return (
    <span
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50',
        sizeMap[size],
        className,
      )}
    >
      {showImage ? (
        <img
          src={resolved!}
          alt=""
          className={cn('h-full w-full object-contain p-1', imgClassName)}
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="leading-none">{safeFallback(fallback)}</span>
      )}
    </span>
  )
}
