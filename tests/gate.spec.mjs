import { test, expect } from '@playwright/test';

// ════════════════════════════════════════════════════════════════════
// Замок страниц (docs/core/gate.js): открыта только главная.
//
// В остальных спеках токен выдаётся в beforeEach — иначе они не дошли бы ни
// до одной страницы. Здесь наоборот: токена НЕТ, и проверяется само поведение
// замка. Файл отдельный именно поэтому — beforeEach из соседних спеков сюда
// не дотягивается.
// ════════════════════════════════════════════════════════════════════

const CLOSED = [
  '/konstruktor.html',
  '/duel.html',
  '/learn.html',
  '/trainers.html',
  '/rating.html',
  '/negotiations.html',
  '/admin.html',
  '/games/krug/',
];

test.describe('Замок: без пароля', () => {
  for (const path of CLOSED) {
    test(`${path} уводит на главную за паролем`, async ({ page }) => {
      await page.goto(path);
      await page.waitForURL(/\?lock=1/, { timeout: 10_000 });
      const u = new URL(page.url());
      expect(u.pathname, `${path} должен привести на корень`).toBe('/');
      expect(u.searchParams.get('lock')).toBe('1');
      // адрес, куда человек шёл, обязан сохраниться — иначе после входа
      // он окажется на главной и будет искать раздел заново
      expect(u.searchParams.get('back'), 'back потерян').toContain(path.replace(/\/$/, ''));
    });
  }

  test('главная открывается без пароля', async ({ page }) => {
    const r = await page.goto('/');
    expect(r?.status()).toBe(200);
    expect(new URL(page.url()).searchParams.get('lock')).toBeNull();
    await expect(page.locator('.s-hero-title')).toBeVisible();
  });

  test('страница ошибки не заперта', async ({ page }) => {
    await page.goto('/404.html');
    expect(new URL(page.url()).searchParams.get('lock')).toBeNull();
  });
});

test.describe('Замок: пароль введён', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('yasna_gate_pass', '1'); } catch (e) {}
    });
  });

  for (const path of ['/konstruktor.html', '/duel.html', '/games/krug/']) {
    test(`${path} открывается`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');
      expect(new URL(page.url()).pathname, `${path} не должен редиректить`).toBe(
        path.endsWith('/') ? path : path
      );
    });
  }
});

test.describe('Замок: ввод пароля', () => {
  // Пароль в репозиторий не кладём: он публичный, и открытый текст здесь
  // обесценил бы хеш в core/gate.js. Тест берёт пароль из окружения и без
  // него честно пропускается: GATE_PASS=… npx playwright test
  test('верный пароль впускает и возвращает на запрошенную страницу', async ({ page }) => {
    test.skip(!process.env.GATE_PASS, 'не задан GATE_PASS');
    await page.goto('/konstruktor.html');
    await page.waitForURL(/\?lock=1/);
    await page.fill('#ygl-login', 'admin');
    await page.fill('#ygl-pass', process.env.GATE_PASS);
    await page.click('#ygl-go');
    await page.waitForURL(/konstruktor\.html/, { timeout: 10_000 });
    // признак сохранён — второй раз пароль спрашивать не должны
    const flag = await page.evaluate(() => localStorage.getItem('yasna_gate_pass'));
    expect(flag).toBe('1');
  });

  test('неверный пароль не впускает', async ({ page }) => {
    await page.goto('/duel.html');
    await page.waitForURL(/\?lock=1/);
    await page.fill('#ygl-login', 'admin');
    await page.fill('#ygl-pass', 'неправильный');
    await page.click('#ygl-go');
    await expect(page.locator('#ygl-err')).toHaveText('Не подходит');
    expect(new URL(page.url()).pathname).toBe('/');
    const flag = await page.evaluate(() => localStorage.getItem('yasna_gate_pass'));
    expect(flag, 'признак не должен ставиться при неверном пароле').toBeNull();
  });
});
