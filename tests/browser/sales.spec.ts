import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page, request }) => {
  const login = await request.post('http://127.0.0.1:3017/api/auth/login', { data: { username: 'admin', password: 'admin123' } })
  const { data } = await login.json()
  const headers = { Authorization: `Bearer ${data.token}` }
  const drafts = await request.get('http://127.0.0.1:3017/api/sales/drafts', { headers })
  const body = await drafts.json()
  for (const draft of body.data) await request.delete(`http://127.0.0.1:3017/api/sales/drafts/${draft.id}`, { headers })
  await page.goto('/')
  await page.getByLabel('Kullanıcı Adı').fill('admin')
  await page.getByLabel('Şifre', { exact: true }).fill('admin123')
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  await page.getByRole('link', { name: 'Satış', exact: true }).click()
  await expect(page.getByPlaceholder('Barkod okutun veya ürün arayın...')).toBeEnabled()
})

async function scan(page: import('@playwright/test').Page, barcode = '8690000000001') {
  await page.keyboard.type(barcode, { delay: 5 })
  await page.keyboard.press('Enter')
}

test('automatically focuses scanner and adds a product without clicking the input', async ({ page }) => {
  await expect(page.getByPlaceholder('Barkod okutun veya ürün arayın...')).toBeFocused()
  await scan(page)
  await expect(page.locator('aside').last().getByText('Test Su', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/#\/sales$/)
})

test('scan Enter cannot activate a focused dashboard link or another control', async ({ page }) => {
  await page.getByRole('link', { name: 'Ana Sayfa' }).focus()
  await scan(page)
  await expect(page).toHaveURL(/#\/sales$/)
  await expect(page.locator('aside').last().getByText('Test Su', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Tümü/ }).focus()
  await scan(page)
  await expect(page.locator('aside').last().getByText('2 ürün', { exact: true })).toBeVisible()
})

test('rapid repeat scans preserve quantities and persisted draft after reload', async ({ page }) => {
  await scan(page)
  await scan(page)
  await scan(page)
  await expect(page.locator('aside').last().getByText('3 ürün', { exact: true })).toBeVisible()
  // Navigating immediately must flush the latest unsaved draft.
  await page.getByRole('link', { name: 'Ürünler', exact: true }).click()
  await page.getByRole('link', { name: 'Satış', exact: true }).click()
  await expect(page.locator('aside').last().getByText('3 ürün', { exact: true })).toBeVisible()
})

test('unknown barcode stays on sales and scanning never confirms payment in a dialog', async ({ page }) => {
  await scan(page, '9999999999999')
  await expect(page.getByText('Barkoda ait aktif ürün bulunamadı.')).toBeVisible()
  await expect(page).toHaveURL(/#\/sales$/)
  await scan(page)
  await page.getByRole('button', { name: 'Nakit', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Satışı Onayla' })
  await dialog.getByRole('button', { name: 'Satışı Tamamla', exact: true }).focus()
  await scan(page)
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'İptal', exact: true }).click()
  await expect(page.getByPlaceholder('Barkod okutun veya ürün arayın...')).toBeFocused()
})

test('cash checkout completes and scanner is ready for the next sale', async ({ page }) => {
  await scan(page)
  await page.getByRole('button', { name: 'Nakit', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Satışı Tamamla' }).click()
  await expect(page.getByText(/Nakit satışı tamamlandı/)).toBeVisible()
  await expect(page.getByPlaceholder('Barkod okutun veya ürün arayın...')).toBeFocused()
  await scan(page)
  await expect(page.locator('aside').last().getByText('Test Su', { exact: true })).toBeVisible()
})

test('all main screens open without JavaScript errors or server failures', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => {
    if (response.url().includes(':3017/api/') && response.status() >= 500) errors.push(`${response.status()} ${response.url()}`)
  })
  for (const label of ['Ana Sayfa', 'Ürünler', 'Kategoriler', 'Stok Yönetimi', 'Sayım', 'Raporlar', 'Vardiyalar', 'Gün Sonu', 'Borçlar', 'İşlem Geçmişi', 'Ayarlar', 'Satış']) {
    await page.getByRole('link', { name: label, exact: true }).click()
    await expect(page.locator('main')).toBeVisible()
    await expect(page.locator('main').getByText('Sunucuya bağlanılamadı.', { exact: false })).toHaveCount(0)
  }
  expect(errors).toEqual([])
})

test('unused product deletion works from the UI', async ({ page, request }) => {
  const login = await request.post('http://127.0.0.1:3017/api/auth/login', { data: { username: 'admin', password: 'admin123' } })
  const { data } = await login.json()
  const headers = { Authorization: `Bearer ${data.token}` }
  const created = await request.post('http://127.0.0.1:3017/api/products', { headers, data: {
    name: 'Silinecek Test Ürün', categoryId: 1, purchasePrice: 1, salePrice: 2,
  } })
  expect(created.ok()).toBeTruthy()
  await page.getByRole('link', { name: 'Ürünler', exact: true }).click()
  const row = page.getByRole('row').filter({ hasText: 'Silinecek Test Ürün' })
  await row.getByTitle('Sil', { exact: true }).click()
  await page.getByRole('dialog', { name: 'Ürünü Sil' }).getByRole('button', { name: 'Sil', exact: true }).click()
  await expect(row).toHaveCount(0)
})


test('Tab-terminated scanner works and manual discount editing is preserved', async ({ page }) => {
  await page.keyboard.type('8690000000001', { delay: 5 })
  await page.keyboard.press('Tab')
  await expect(page.locator('aside').last().getByText('Test Su', { exact: true })).toBeVisible()
  const discount = page.getByPlaceholder('0,00')
  await discount.fill('1.25')
  await discount.press('Tab')
  await expect(discount).toHaveValue('1.25')
  await expect(page).toHaveURL(/#\/sales$/)
})
