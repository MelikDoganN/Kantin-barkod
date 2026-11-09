import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/electron',
  workers: 1,
  timeout: 30000,
  webServer: { command: 'node scripts/browser-test-server.mjs', url: 'http://127.0.0.1:4173', timeout: 60000 },
})
