import { defineConfig, devices } from '@playwright/test';

// ════════════════════════════════════════════════════════════════════
// Playwright config — smoke-тесты приложения Ясна.
//
// Запуск:
//   npm run build           # сначала бандл должен быть готов
//   npm test                # smoke-тесты в headless Chromium
//   npm run test:headed     # с открытым браузером (для дебага)
//
// Pre-requirement: docs/dist/app.min.js и docs/dist/duel.min.js
// существуют (создаются `npm run build`).
// ════════════════════════════════════════════════════════════════════

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    url: 'http://localhost:8080/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // mobile запускаем только локально — экономим CI-минуты
    ...(process.env.CI ? [] : [{ name: 'mobile', use: { ...devices['iPhone 13'] } }]),
  ],
});
