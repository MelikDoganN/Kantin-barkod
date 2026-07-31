import { api } from '@/services/api'
import { isImagePath, resolveImageUrl } from '@/utils/resolveImageUrl'

/** @deprecated resolveImageUrl kullanın */
export const resolveMediaUrl = resolveImageUrl
export { isImagePath, resolveImageUrl }

export async function deleteProduct(id: number | string) {
  return api.delete<{ id: number }>(`/products/${id}`)
}

export async function uploadProductImage(id: number | string, file: File) {
  const form = new FormData()
  form.append('image', file)
  return api.postForm<{ id: number; imagePath: string; imageUrl: string | null }>(
    `/products/${id}/image`,
    form,
  )
}

export async function deleteProductImage(id: number | string) {
  return api.delete<{ id: number; imagePath: null; imageUrl: null }>(`/products/${id}/image`)
}
