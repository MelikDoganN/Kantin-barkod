const API_ORIGIN = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api').replace(
  /\/api\/?$/,
  '',
)

/**
 * Ürün / medya görselleri için tek kaynak.
 * null → null (placeholder)
 * http(s) → olduğu gibi
 * /uploads/... veya uploads/... → API origin eklenir
 */
export function resolveImageUrl(image: string | null | undefined): string | null {
  if (!image) return null

  const trimmed = image.trim()
  if (!trimmed) return null

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed
  }

  // Emoji / kısa metin — görsel yolu değil
  if (!trimmed.includes('/') && !trimmed.includes('\\') && !trimmed.includes('.')) {
    return null
  }

  let path = trimmed.replace(/\\/g, '/')

  if (path.startsWith('/uploads/')) {
    return `${API_ORIGIN}${path}`
  }
  if (path.startsWith('uploads/')) {
    return `${API_ORIGIN}/${path}`
  }
  // Eski / tutarsız kayıtlar: products/xxx.jpeg
  if (path.startsWith('/products/')) {
    return `${API_ORIGIN}/uploads${path}`
  }
  if (path.startsWith('products/')) {
    return `${API_ORIGIN}/uploads/${path}`
  }
  // Diğer göreli yollar
  if (path.startsWith('/')) {
    return `${API_ORIGIN}${path}`
  }

  return `${API_ORIGIN}/${path}`
}

/** Görsel dosya yolu mu? (emoji / boş değil) */
export function isImagePath(value: string | null | undefined): boolean {
  if (!value) return false
  const v = value.trim()
  if (!v) return false
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('blob:') || v.startsWith('data:')) return true
  if (v.startsWith('/uploads/') || v.startsWith('uploads/')) return true
  if (v.startsWith('/products/') || v.startsWith('products/')) return true
  return /\.(jpe?g|png|gif|webp|svg)$/i.test(v)
}
