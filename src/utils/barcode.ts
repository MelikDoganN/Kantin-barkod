/** USB klavye tipi barkod okuyucular için minimum geçerli uzunluk */
export const MIN_BARCODE_LENGTH = 4

export function normalizeBarcode(value: string): string {
  return value.trim()
}

export function isBarcodeTooShort(value: string): boolean {
  const normalized = normalizeBarcode(value)
  return normalized.length > 0 && normalized.length < MIN_BARCODE_LENGTH
}

export function sanitizeBarcodeInput(value: string): string {
  return value.replace(/[\r\n\t]/g, '')
}
