export function buildImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath

  let path = imagePath.replace(/\\/g, '/')
  if (path.startsWith('uploads/')) path = `/${path}`
  if (path.startsWith('products/')) path = `/uploads/${path}`
  if (!path.startsWith('/')) path = `/${path}`
  if (path.startsWith('/products/')) path = `/uploads${path}`

  return path
}

export function serializeProductBrief(product: {
  id: number
  name: string
  barcode: string | null
  image?: string | null
  category: { name: string }
}) {
  const imagePath = product.image ?? null
  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    imagePath,
    imageUrl: buildImageUrl(imagePath),
    category: product.category.name,
  }
}
