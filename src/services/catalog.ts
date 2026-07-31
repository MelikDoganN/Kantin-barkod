import { api } from '@/services/api'
import { resolveImageUrl } from '@/utils/resolveImageUrl'
import type { Product, UnitType } from '@/types'

export interface ApiCategory {
  id: number
  name: string
  isActive: boolean
  description?: string | null
  productCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface ApiProduct {
  id: number
  name: string
  barcode: string | null
  categoryId: number
  purchasePrice: number
  salePrice: number
  unitType: string
  unitsPerCarton: number
  minimumStock: number
  image?: string | null
  imagePath?: string | null
  imageUrl?: string | null
  isActive: boolean
  category: {
    id: number
    name: string
    isActive: boolean
  }
  inventory: {
    warehouseQuantity: number
    shelfQuantity: number
  } | null
}

export interface ProductPayload {
  name: string
  barcode?: string | null
  categoryId: number
  purchasePrice: number
  salePrice: number
  unitType?: string
  unitsPerCarton?: number
  minimumStock?: number
  image?: string | null
}

export function mapApiProduct(product: ApiProduct): Product {
  const imagePath = product.imagePath ?? product.image ?? null
  const imageUrl = resolveImageUrl(product.imageUrl ?? imagePath)

  return {
    id: String(product.id),
    name: product.name,
    barcode: product.barcode ?? '',
    categoryId: String(product.categoryId),
    categoryName: product.category.name,
    purchasePrice: Number(product.purchasePrice),
    salePrice: Number(product.salePrice),
    shelfStock: product.inventory?.shelfQuantity ?? 0,
    warehouseStock: product.inventory?.warehouseQuantity ?? 0,
    criticalLevel: product.minimumStock,
    casePackSize: product.unitsPerCarton,
    unitType: (product.unitType === 'case' ? 'case' : 'unit') as UnitType,
    status: product.isActive ? 'active' : 'passive',
    icon: '📦',
    imagePath,
    imageUrl,
  }
}

export async function fetchCategories(): Promise<ApiCategory[]> {
  return api.get<ApiCategory[]>('/categories')
}

export async function fetchProducts(): Promise<Product[]> {
  const products = await api.get<ApiProduct[]>('/products')
  return products.map(mapApiProduct)
}

export async function createProduct(payload: ProductPayload): Promise<Product> {
  const product = await api.post<ApiProduct>('/products', payload)
  return mapApiProduct(product)
}

export async function updateProduct(id: number, payload: ProductPayload): Promise<Product> {
  const product = await api.put<ApiProduct>(`/products/${id}`, payload)
  return mapApiProduct(product)
}

export async function updateProductStatus(id: number, isActive: boolean): Promise<Product> {
  const product = await api.patch<ApiProduct>(`/products/${id}/status`, { isActive })
  return mapApiProduct(product)
}
