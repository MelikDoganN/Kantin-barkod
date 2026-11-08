import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Banknote,
  CreditCard,
  Minus,
  Plus,
  ScanBarcode,
  ShoppingCart,
  StickyNote,
  Trash2,
  Undo2,
  X,
  CircleDot,
  Clock,
  CornerDownLeft,
  HandCoins,
  Loader2,
  PlusCircle,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { StatusBadge, EmptyState } from '@/components/common'
import { DebtSaleModal } from '@/components/sales/DebtSaleModal'
import { SaleConfirmModal } from '@/components/sales/SaleConfirmModal'
import { ProductThumb } from '@/components/products/ProductThumb'
import { ApiError } from '@/services/api'
import { fetchCategories, fetchProducts, type ApiCategory } from '@/services/catalog'
import {
  cancelDraftSale,
  createDraftSale,
  draftToCartItems,
  fetchDraftSales,
  fetchProductByBarcode,
  finalizeDraftSale,
  updateDraftSale,
  type PaymentTypeApi,
} from '@/services/sales'
import { formatShiftTime } from '@/services/shifts'
import { useShift } from '@/context/ShiftContext'
import type { BadgeTone, CartItem, Customer, Product } from '@/types'
import { formatCurrency, cn } from '@/utils/format'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { useClock } from '@/hooks/useClock'

type StockLevel = 'normal' | 'low' | 'critical'

interface PendingSale {
  id: number
  cart: CartItem[]
  discount: number
}

interface PendingPayment {
  type: PaymentTypeApi
  customer?: Customer
}

function getStockLevel(shelfStock: number): StockLevel {
  if (shelfStock <= 5) return 'critical'
  if (shelfStock <= 20) return 'low'
  return 'normal'
}

const stockTone: Record<StockLevel, BadgeTone> = {
  normal: 'success',
  low: 'warning',
  critical: 'danger',
}

const categoryIcons: Record<string, string> = {
  İçecekler: '🥤',
  Yiyecekler: '🥪',
  Atıştırmalıklar: '🍫',
  Temizlik: '🧹',
  Diğer: '📦',
}

function cartToPayload(cart: CartItem[]) {
  return cart.map((item) => ({
    productId: Number(item.product.id),
    quantity: item.quantity,
  }))
}

function saleTotals(cart: CartItem[], discount: number) {
  const subtotal = cart.reduce((sum, item) => sum + item.product.salePrice * item.quantity, 0)
  const total = Math.max(subtotal - discount, 0)
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  return { subtotal, total, itemCount }
}

export function SalesPage() {
  const { time } = useClock()
  const { currentShift, refreshShift } = useShift()

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ApiCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([])
  const [activeSaleId, setActiveSaleId] = useState<number | null>(null)
  const [draftsLoading, setDraftsLoading] = useState(false)
  const [debtModalOpen, setDebtModalOpen] = useState(false)
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null)
  const [scanning, setScanning] = useState(0)
  const [paying, setPaying] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [lastDebt, setLastDebt] = useState<{ name: string; total: number } | null>(null)

  const draftWritesRef = useRef(new Map<number, Promise<void>>())
  const blockedRef = useRef(false)
  blockedRef.current = paying || !!pendingPayment || debtModalOpen
  const searchRef = useRef<HTMLInputElement>(null)
  const scanQueueRef = useRef(Promise.resolve())
  const draftBusyRef = useRef(false)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSalesRef = useRef(pendingSales)
  const activeSaleIdRef = useRef(activeSaleId)

  useEffect(() => {
    pendingSalesRef.current = pendingSales
  }, [pendingSales])

  useEffect(() => {
    activeSaleIdRef.current = activeSaleId
  }, [activeSaleId])

  const activeSale = useMemo(
    () => pendingSales.find((sale) => sale.id === activeSaleId) ?? null,
    [pendingSales, activeSaleId],
  )

  const cart = activeSale?.cart ?? []
  const discount = activeSale?.discount ?? 0
  const { subtotal, total, itemCount } = useMemo(
    () => saleTotals(cart, discount),
    [cart, discount],
  )

  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [productList, categoryList] = await Promise.all([
        fetchProducts(),
        fetchCategories(),
      ])
      setProducts(productList.filter((p) => p.status === 'active'))
      setCategories(categoryList.filter((c) => c.isActive))
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Ürünler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [])

  const persistDraft = useCallback(async (id: number, nextCart: CartItem[], nextDiscount: number) => {
    const previous = draftWritesRef.current.get(id) ?? Promise.resolve()
    const write = previous.catch(() => undefined).then(async () => {
      await updateDraftSale(id, {
        items: cartToPayload(nextCart),
        discount: nextDiscount > 0 ? nextDiscount : 0,
      })
    })
    draftWritesRef.current.set(id, write)
    try { await write } finally {
      if (draftWritesRef.current.get(id) === write) draftWritesRef.current.delete(id)
    }
  }, [])

  const flushActiveDraft = useCallback(async () => {
    const id = activeSaleIdRef.current
    const sale = pendingSalesRef.current.find((item) => item.id === id)
    if (!id || !sale) return
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current)
      syncTimerRef.current = null
    }
    await persistDraft(id, sale.cart, sale.discount)
  }, [persistDraft])

  const schedulePersist = useCallback(
    (id: number, nextCart: CartItem[], nextDiscount: number) => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
      syncTimerRef.current = setTimeout(() => {
        void persistDraft(id, nextCart, nextDiscount).catch((err) => {
          setPayError(err instanceof ApiError ? err.message : 'Sepet kaydedilemedi.')
        })
      }, 400)
    },
    [persistDraft],
  )

  const patchActiveSale = useCallback(
    (updater: (sale: PendingSale) => PendingSale) => {
      const id = activeSaleIdRef.current
      if (!id) return
      const next = pendingSalesRef.current.map((sale) => (sale.id === id ? updater(sale) : sale))
      pendingSalesRef.current = next
      setPendingSales(next)
      const updated = next.find((sale) => sale.id === id)
      if (updated) schedulePersist(updated.id, updated.cart, updated.discount)
    },
    [schedulePersist],
  )

  const ensureDraftAfterChange = useCallback(async (remaining: PendingSale[]) => {
    if (remaining.length > 0) {
      setPendingSales(remaining)
      setActiveSaleId(remaining[0].id)
      return
    }
    const draft = await createDraftSale()
    setPendingSales([{ id: draft.id, cart: [], discount: 0 }])
    setActiveSaleId(draft.id)
  }, [])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    if (!currentShift) {
      setPendingSales([])
      setActiveSaleId(null)
      return
    }

    let cancelled = false

    async function loadDrafts() {
      setDraftsLoading(true)
      setPayError(null)
      try {
        let drafts = await fetchDraftSales()
        if (cancelled) return
        if (drafts.length === 0) {
          drafts = [await createDraftSale()]
        }
        if (cancelled) return
        setPendingSales(
          drafts.map((draft) => ({
            id: draft.id,
            cart: draftToCartItems(draft),
            discount: draft.discount,
          })),
        )
        setActiveSaleId(drafts[0].id)
      } catch (err) {
        if (!cancelled) {
          setPayError(err instanceof ApiError ? err.message : 'Taslak satışlar yüklenemedi.')
        }
      } finally {
        if (!cancelled) setDraftsLoading(false)
      }
    }

    void loadDrafts()

    return () => {
      cancelled = true
    }
  }, [currentShift?.id])

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current)
        const sale = pendingSalesRef.current.find((item) => item.id === activeSaleIdRef.current)
        if (sale) void persistDraft(sale.id, sale.cart, sale.discount).catch(() => undefined)
      }
    }
  }, [persistDraft])

  const availableProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === 'all' || product.categoryId === activeCategory
      const term = search.trim().toLowerCase()
      const matchesSearch =
        term === '' ||
        product.name.toLowerCase().includes(term) ||
        product.barcode.includes(term)
      return matchesCategory && matchesSearch
    })
  }, [products, activeCategory, search])

  function addToCart(product: Product) {
    if (!activeSaleIdRef.current || paying || pendingPayment || debtModalOpen) return
    setSuccessMsg(null)
    setPayError(null)
    setLastDebt(null)
    patchActiveSale((sale) => {
      const existing = sale.cart.find((item) => item.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.shelfStock) {
          setPayError(`Yetersiz stok: ${product.name}`)
          return sale
        }
        return {
          ...sale,
          cart: sale.cart.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        }
      }
      if (product.shelfStock < 1) {
        setPayError(`Yetersiz stok: ${product.name}`)
        return sale
      }
      return { ...sale, cart: [...sale.cart, { product, quantity: 1 }] }
    })
  }

  function scanBarcode(term: string, allowNameSearch = false) {
    const saleId = activeSaleIdRef.current
    if (!saleId || paying || pendingPayment || debtModalOpen) return
    setScanning((count) => count + 1)
    scanQueueRef.current = scanQueueRef.current.then(async () => {
      try {
        const product = await fetchProductByBarcode(term)
        if (activeSaleIdRef.current !== saleId || blockedRef.current) return
        addToCart(product)
        setProducts((prev) => prev.some((p) => p.id === product.id)
          ? prev.map((p) => p.id === product.id ? product : p) : [...prev, product])
      } catch (err) {
        if (activeSaleIdRef.current !== saleId || blockedRef.current) return
        const match = allowNameSearch && err instanceof ApiError && err.status === 404
          ? availableProducts.find((p) => p.name.toLowerCase().includes(term.toLowerCase())) : null
        if (match) addToCart(match)
        else setPayError(err instanceof ApiError ? err.message : 'Ürün bulunamadı.')
      } finally {
        setScanning((count) => count - 1)
      }
    })
  }

  useBarcodeScanner((barcode) => scanBarcode(barcode), Boolean(currentShift && activeSaleId && !draftsLoading))

  useEffect(() => {
    if (currentShift && activeSaleId && !draftsLoading && !pendingPayment && !debtModalOpen && !paying) {
      searchRef.current?.focus()
    }
  }, [currentShift?.id, activeSaleId, draftsLoading, pendingPayment, debtModalOpen, paying])

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const tabBarcode = event.key === 'Tab' && /^\d{4,}$/.test(event.currentTarget.value.trim())
    if (event.key !== 'Enter' && !tabBarcode) return
    event.preventDefault()
    event.stopPropagation()
    const term = event.currentTarget.value.trim()
    if (!term) return
    setSearch('')
    scanBarcode(term, !tabBarcode)
  }

  function updateQuantity(productId: string, delta: number) {
    if (paying || pendingPayment || debtModalOpen) return
    patchActiveSale((sale) => ({
      ...sale,
      cart: sale.cart
        .map((item) => {
          if (item.product.id !== productId) return item
          const nextQty = item.quantity + delta
          if (delta > 0 && nextQty > item.product.shelfStock) {
            setPayError(`Yetersiz stok: ${item.product.name}`)
            return item
          }
          return { ...item, quantity: nextQty }
        })
        .filter((item) => item.quantity > 0),
    }))
  }

  function removeItem(productId: string) {
    if (paying || pendingPayment || debtModalOpen) return
    patchActiveSale((sale) => ({
      ...sale,
      cart: sale.cart.filter((item) => item.product.id !== productId),
    }))
  }

  function setDiscountValue(value: number) {
    patchActiveSale((sale) => ({ ...sale, discount: value }))
  }

  async function switchSale(saleId: number) {
    if (saleId === activeSaleId || paying || scanning > 0) return
    // Sepetler lokalde korunur; API senkronu geçişi engellemesin.
    void flushActiveDraft().catch((err) => {
      setPayError(err instanceof ApiError ? err.message : 'Satış kaydedilemedi.')
    })
    activeSaleIdRef.current = saleId
    setActiveSaleId(saleId)
    setSuccessMsg(null)
    setPayError(null)
    setLastDebt(null)
    setPendingPayment(null)
  }

  async function handleNewSale() {
    if (!currentShift || paying || scanning > 0 || draftsLoading || draftBusyRef.current) return
    draftBusyRef.current = true
    setPaying(true)
    try {
      void flushActiveDraft().catch(() => undefined)
      const draft = await createDraftSale()
      const nextSale: PendingSale = { id: draft.id, cart: [], discount: 0 }
      activeSaleIdRef.current = draft.id
      setPendingSales((prev) => {
        const next = [...prev, nextSale]
        pendingSalesRef.current = next
        return next
      })
      setActiveSaleId(draft.id)
      setSuccessMsg(null)
      setPayError(null)
      setLastDebt(null)
      setPendingPayment(null)
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : 'Yeni satış açılamadı.')
    } finally {
      draftBusyRef.current = false
      setPaying(false)
    }
  }

  async function handleCancelSale() {
    if (!activeSaleId || paying || scanning > 0 || draftBusyRef.current) return
    draftBusyRef.current = true
    setPaying(true)
    try {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current)
        syncTimerRef.current = null
      }
      await draftWritesRef.current.get(activeSaleId)?.catch(() => undefined)
      await cancelDraftSale(activeSaleId)
      const remaining = pendingSales.filter((sale) => sale.id !== activeSaleId)
      await ensureDraftAfterChange(remaining)
      setSuccessMsg(null)
      setPayError(null)
      setLastDebt(null)
      setPendingPayment(null)
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : 'Satış iptal edilemedi.')
    } finally {
      draftBusyRef.current = false
      setPaying(false)
    }
  }

  function openConfirm(payment: PendingPayment) {
    if (cart.length === 0 || paying || !currentShift || !activeSaleId) return
    setPayError(null)
    setSuccessMsg(null)
    setPendingPayment(payment)
  }

  function handleCashOrCard(paymentType: 'CASH' | 'CARD') {
    openConfirm({ type: paymentType })
  }

  function handleDebtCustomerConfirm(customer: Customer) {
    setDebtModalOpen(false)
    openConfirm({ type: 'CREDIT', customer })
  }

  function handleConfirmCancel() {
    if (paying) return
    setPendingPayment(null)
  }

  async function handleConfirmComplete() {
    if (!pendingPayment || !activeSaleId || cart.length === 0 || paying) return
    if (!currentShift) {
      setPayError('Vardiya açmanız gerekiyor.')
      return
    }

    const paymentType = pendingPayment.type
    const customer = pendingPayment.customer
    const saleTotal = total

    setPaying(true)
    setPayError(null)
    setSuccessMsg(null)
    setLastDebt(null)

    try {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current)
        syncTimerRef.current = null
      }
      await persistDraft(activeSaleId, cart, discount)

      await finalizeDraftSale(activeSaleId, {
        items: cartToPayload(cart),
        paymentType,
        customerId: customer ? Number(customer.id) : undefined,
        discount: discount > 0 ? discount : 0,
      })

      const label =
        paymentType === 'CASH' ? 'Nakit' : paymentType === 'CARD' ? 'Kart' : 'Borç'
      setSuccessMsg(`${label} satışı tamamlandı · ${formatCurrency(saleTotal)}`)
      if (paymentType === 'CREDIT' && customer) {
        setLastDebt({ name: customer.name, total: saleTotal })
      }

      setPendingPayment(null)
      const remaining = pendingSales.filter((sale) => sale.id !== activeSaleId)
      await ensureDraftAfterChange(remaining)
      await Promise.all([loadCatalog(), refreshShift()])
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : 'Satış tamamlanamadı.')
    } finally {
      setPaying(false)
    }
  }

  const paymentDisabled = cart.length === 0 || scanning > 0 || paying || !currentShift || !activeSaleId

  return (
    <div className="flex h-full gap-4 lg:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold leading-tight text-slate-800">Satış</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currentShift ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 sm:text-sm">
                <CircleDot size={13} />
                Aktif Vardiya · {currentShift.personnel} ·{' '}
                {formatShiftTime(currentShift.startTime)} - Açık
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 sm:text-sm">
                <CircleDot size={13} />
                Vardiya açmanız gerekiyor.
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 sm:text-sm">
              <Clock size={13} className="text-slate-400" />
              <span className="tabular-nums">{time}</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <ScanBarcode
            size={20}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-500"
          />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Barkod okutun veya ürün arayın..."
            disabled={!currentShift || draftsLoading || !activeSaleId || paying || !!pendingPayment || debtModalOpen}
            className="h-11 w-full rounded-card border border-slate-300 bg-white pl-11 pr-28 text-sm text-slate-800 shadow-card transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-50 sm:text-base"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 sm:text-xs">
            <CornerDownLeft size={12} />
            Enter ile ekle
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory('all')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors',
              activeCategory === 'all'
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            <span>🗂️</span>
            Tümü
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(String(category.id))}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors',
                activeCategory === String(category.id)
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              <span>{categoryIcons[category.name] ?? '📦'}</span>
              {category.name}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin pr-1">
          {loading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-slate-500">
              <Loader2 size={20} className="animate-spin text-brand-600" />
              <span className="text-sm">Ürünler yükleniyor...</span>
            </div>
          ) : loadError ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3">
              <p className="text-sm text-red-600">{loadError}</p>
              <Button variant="outline" onClick={() => void loadCatalog()}>
                Tekrar Dene
              </Button>
            </div>
          ) : availableProducts.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Ürün bulunamadı"
              description="Arama veya kategori filtresini değiştirin."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {availableProducts.map((product) => {
                const level = getStockLevel(product.shelfStock)
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={!currentShift || draftsLoading || !activeSaleId || paying || !!pendingPayment || debtModalOpen}
                    className="group flex flex-col overflow-hidden rounded-card border border-slate-200 bg-white text-center shadow-card transition-all hover:-translate-y-0.5 hover:border-[#F97316] hover:shadow-panel disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="relative flex h-28 w-full items-center justify-center border-b border-slate-100 bg-slate-50 transition-colors group-hover:bg-brand-50/50">
                      <span className="absolute right-2 top-2 z-10">
                        <StatusBadge tone={stockTone[level]}>{product.shelfStock}</StatusBadge>
                      </span>
                      <ProductThumb
                        src={product.imageUrl ?? product.imagePath}
                        fallback={product.icon}
                        size="xl"
                        className="h-28 w-full rounded-none border-0 bg-transparent"
                      />
                    </div>
                    <div className="flex flex-1 flex-col items-center gap-1 px-3 py-3">
                      <span className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-slate-700">
                        {product.name}
                      </span>
                      <span className="text-lg font-bold text-brand-600">
                        {formatCurrency(product.salePrice)}
                      </span>
                      <span className="text-xs text-slate-400">Stok: {product.shelfStock} adet</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 rounded-card border border-slate-200 bg-white px-3 py-2.5 shadow-card">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Aktif Satışlar
            </span>
            <Button
              variant="outline"
              size="sm"
              icon={<PlusCircle size={14} />}
              disabled={!currentShift || paying || draftsLoading}
              onClick={() => void handleNewSale()}
            >
              Yeni Satış
            </Button>
          </div>
          {draftsLoading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
              <Loader2 size={14} className="animate-spin" />
              Satışlar yükleniyor...
            </div>
          ) : pendingSales.length === 0 ? (
            <p className="py-2 text-xs text-slate-400">Vardiya açıldığında satış başlatılır.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-0.5">
              {pendingSales.map((sale, index) => {
                const totals = saleTotals(sale.cart, sale.discount)
                const isActive = sale.id === activeSaleId
                return (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => void switchSale(sale.id)}
                    className={cn(
                      'min-w-[160px] flex-shrink-0 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      isActive
                        ? 'border-brand-400 bg-brand-50 shadow-sm ring-1 ring-brand-200'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-700">
                        Satış #{index + 1}
                      </span>
                      <StatusBadge tone={isActive ? 'info' : 'neutral'}>
                        {isActive ? 'Aktif' : 'Bekliyor'}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {totals.itemCount} ürün · {formatCurrency(totals.total)}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="flex w-[380px] flex-shrink-0 flex-col rounded-card border border-slate-200 bg-white shadow-panel">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-800">Sepet</h2>
          </div>
          <StatusBadge tone="info">{itemCount} ürün</StatusBadge>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto scrollbar-thin px-4 py-3">
          {cart.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={ShoppingCart}
                title="Sepet boş"
                description="Satışa başlamak için ürün ekleyin veya barkod okutun."
              />
            </div>
          ) : (
            <ul className="space-y-2">
              {cart.map((item) => (
                <li
                  key={item.product.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-start gap-3">
                    <ProductThumb
                      src={item.product.imageUrl ?? item.product.imagePath}
                      fallback={item.product.icon}
                      size="sm"
                      className="h-11 w-11 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatCurrency(item.product.salePrice)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(item.product.id)}
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition-colors hover:border-red-300 hover:bg-red-100 hover:text-red-700"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold text-slate-700">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-700"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">
                      {formatCurrency(item.product.salePrice * item.quantity)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Ara Toplam</dt>
              <dd className="font-medium text-slate-700">{formatCurrency(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">İndirim</dt>
              <dd className="relative">
                <input
                  type="number"
                  min={0}
                  value={discount || ''}
                  onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                  placeholder="0,00"
                  disabled={!activeSaleId}
                  className="h-8 w-28 rounded-lg border border-slate-300 pl-2 pr-6 text-right text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  ₺
                </span>
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">Genel Toplam</span>
            <span className="text-2xl font-bold text-brand-600">{formatCurrency(total)}</span>
          </div>

          <div className="mt-4 space-y-2">
            {!currentShift && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                Satış yapmadan önce vardiya açmanız gerekiyor.
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="success"
                size="lg"
                icon={<Banknote size={18} />}
                disabled={paymentDisabled}
                onClick={() => handleCashOrCard('CASH')}
              >
                Nakit
              </Button>
              <Button
                size="lg"
                icon={<CreditCard size={18} />}
                disabled={paymentDisabled}
                onClick={() => handleCashOrCard('CARD')}
                className="border-transparent bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
              >
                Kart
              </Button>
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              icon={<HandCoins size={18} />}
              disabled={paymentDisabled}
              onClick={() => setDebtModalOpen(true)}
            >
              Borç Satış
            </Button>
          </div>

          {successMsg && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              {successMsg}
            </div>
          )}
          {payError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
              {payError}
            </div>
          )}
          {lastDebt && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
              <HandCoins size={14} className="flex-shrink-0" />
              <span>
                {lastDebt.name} borcuna {formatCurrency(lastDebt.total)} işlendi.
              </span>
            </div>
          )}

          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <Button
              variant="danger"
              size="sm"
              fullWidth
              icon={<Trash2 size={14} />}
              onClick={() => void handleCancelSale()}
              disabled={!activeSaleId || paying || draftsLoading}
            >
              Satışı İptal Et
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" size="sm" icon={<Undo2 size={14} />} disabled title="Satış iptali Gün Sonu ekranındaki satış detayından yapılır.">
                İade
              </Button>
              <Button variant="outline" size="sm" icon={<StickyNote size={14} />} disabled title="Satışa not ekleme bu sürümde desteklenmiyor.">
                Not Ekle
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <DebtSaleModal
        open={debtModalOpen}
        total={total}
        onClose={() => setDebtModalOpen(false)}
        onConfirm={handleDebtCustomerConfirm}
      />

      {pendingPayment && (
        <SaleConfirmModal
          open
          cart={cart}
          subtotal={subtotal}
          discount={discount}
          total={total}
          paymentType={pendingPayment.type}
          customerName={pendingPayment.customer?.name}
          confirming={paying}
          onCancel={handleConfirmCancel}
          onConfirm={() => void handleConfirmComplete()}
        />
      )}
    </div>
  )
}
