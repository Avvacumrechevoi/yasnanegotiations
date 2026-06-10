import { test, expect } from '@playwright/test';

// ════════════════════════════════════════════════════════════════════
// CRUD пользовательских Ясен — регрессия главного blocker'а:
// «Сохранить и закрыть» раньше НИЧЕГО не сохранял (потеря при F5/смене таба).
// Теперь: реестр localStorage.yasna_custom_v1 + debounce-автосейв +
// секция «Мои Ясны» в Picker + ✎ Редактировать (copy-on-write) + удаление.
// Один сквозной тест: у Playwright чистый контекст на тест → чистый storage.
// ════════════════════════════════════════════════════════════════════

const setNative = async (page, locator, value) => {
  await locator.click();
  await locator.fill(value);
};

test('полный цикл: создать → автосейв → F5 → открыть → редактировать → copy-on-write → удалить', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.waitForFunction(() => !!window.YasnaCore);

  // ── 1. СОЗДАТЬ ──
  await page.getByRole('button', { name: 'Создать новую Ясну' }).first().click();
  const nameInput = page.getByPlaceholder('Название');
  await expect(nameInput).toBeVisible();
  await setNative(page, nameInput, 'Тестовая E2E');
  await setNative(page, page.getByPlaceholder('ВХОД / ОСНОВА'), 'Альфа');
  // дождаться debounce-автосейва (400мс) + флаш эффекта
  await page.waitForFunction(() => {
    try { return (JSON.parse(localStorage.getItem('yasna_custom_v1')||'[]')).some(c => c.name === 'Тестовая E2E'); }
    catch { return false; }
  }, { timeout: 5000 });
  await page.getByRole('button', { name: /Сохранить и закрыть/ }).click();

  // ── 2. ПЕРЕЖИВАЕТ F5 ──
  await page.reload();
  await page.waitForFunction(() => !!window.YasnaCore);
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('yasna_custom_v1')||'[]'));
  expect(rec.length, 'запись должна пережить перезагрузку').toBe(1);
  expect(rec[0].name).toBe('Тестовая E2E');
  expect(rec[0].p[0]).toBe('Альфа');
  expect(rec[0].user).toBe(true);

  // ── 3. ВИДНА В PICKER («Мои Ясны») И ОТКРЫВАЕТСЯ ──
  await page.getByTitle('Все доступные Ясны').click();
  const mySection = page.getByTestId('my-yasnas');
  await expect(mySection).toBeVisible();
  await mySection.getByTitle('Открыть «Тестовая E2E»').click();
  await expect(page.locator('svg text', { hasText: 'Альфа' }).first()).toBeVisible();

  // ── 4. РЕДАКТИРОВАНИЕ — та же запись, без дублей ──
  await page.getByRole('button', { name: 'Редактировать текущую Ясну' }).first().click();
  await setNative(page, page.getByPlaceholder('ПЕРВЫЙ РЕЗУЛЬТАТ'), 'Бета');
  await page.waitForFunction(() => {
    try { const r = JSON.parse(localStorage.getItem('yasna_custom_v1')||'[]'); return r.length === 1 && r[0].p[1] === 'Бета'; }
    catch { return false; }
  }, { timeout: 5000 });
  await page.getByRole('button', { name: /Сохранить и закрыть/ }).click();

  // ── 5. COPY-ON-WRITE для встроенного шаблона ──
  await page.locator('.nav-tabs button', { hasText: 'Суток' }).first().click();
  await page.getByRole('button', { name: 'Редактировать текущую Ясну' }).first().click();
  await expect(page.getByPlaceholder('Название')).toHaveValue('Суток (моя)');
  // лёгкая правка, чтобы копия записалась
  await setNative(page, page.getByPlaceholder('Название'), 'Суток копия E2E');
  await page.waitForFunction(() => {
    try { return (JSON.parse(localStorage.getItem('yasna_custom_v1')||'[]')).some(c => c.name === 'Суток копия E2E'); }
    catch { return false; }
  }, { timeout: 5000 });
  await page.getByRole('button', { name: /Сохранить и закрыть/ }).click();
  // оригинал «Суток» в T не тронут
  const orig = await page.evaluate(() => window.YasnaData.T.find(t => t.id === 'суток').n);
  expect(orig).toBe('Суток');

  // ── 6. УДАЛЕНИЕ (включая открытую) ──
  page.on('dialog', d => d.accept());
  await page.getByTitle('Все доступные Ясны').click();
  await page.getByTestId('my-yasnas').getByTitle('Удалить').nth(1).click(); // «Суток копия E2E» (открытая)
  await page.getByTestId('my-yasnas').getByTitle('Удалить').first().click(); // «Тестовая E2E»
  await page.waitForFunction(() => {
    try { return (JSON.parse(localStorage.getItem('yasna_custom_v1')||'[]')).length === 0; }
    catch { return false; }
  }, { timeout: 5000 });
});

test('pinned-вкладки переживают перезагрузку', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.YasnaCore);
  // снять один дефолтный пин через Picker
  await page.getByTitle('Все доступные Ясны').click();
  await page.locator('.picker-inner button', { hasText: 'Года' }).first().click();
  await page.locator('.picker-inner button', { hasText: '✕' }).first().click();
  await page.reload();
  await page.waitForFunction(() => !!window.YasnaCore);
  const pinned = await page.evaluate(() => JSON.parse(localStorage.getItem('yasna_pinned_v1')||'[]'));
  expect(pinned.includes('года')).toBe(false);
  expect(pinned.length).toBeGreaterThan(0);
});
