import { test, expect } from '@playwright/test';

// ════════════════════════════════════════════════════════════════════
// Регрессия НАВИГАЦИИ и АДАПТИВА (desktop + mobile).
// Ловит ровно то, что раньше приходилось аудитить руками:
//   • каждая страница отвечает 200;
//   • единый свитчер: все 4 раздела ДОСТИЖИМЫ (на десктопе — инлайн,
//     на мобайле у конструктора — в бургере «Разделы»);
//   • логотип ведёт на лендинг (start.html);
//   • нет горизонтального переполнения страницы;
//   • на узких телефонах (375px) последний раздел свитчера НЕ обрезан.
// Mobile прогоняем через resize вьюпорта (а не отдельный проект),
// чтобы тест работал и в CI (там только chromium).
// ════════════════════════════════════════════════════════════════════

const PAGES = [
  { path: '/',            name: 'Конструктор', spa: true,  active: 'index.html'  },
  { path: '/duel.html',   name: 'Игра',        spa: true,  active: 'duel.html'   },
  { path: '/start.html',  name: 'Лендинг',     spa: false, active: null          },
  { path: '/learn.html',  name: 'Обучение',    spa: false, active: 'learn.html'  },
  { path: '/rating.html', name: 'Рейтинг',     spa: false, active: 'rating.html' },
];
const SECTION_HREFS = ['index.html', 'duel.html', 'learn.html', 'rating.html'];

async function waitBar(page){
  // Ждём, что ссылки бара отрисованы. state:'attached' — чтобы не залипнуть на
  // display:none-элементе (на мобайле инлайн-свитчер конструктора скрыт).
  await page.waitForSelector('a[href="rating.html"]', { state: 'attached', timeout: 15_000 });
}

// Открыть бургер один раз (если ещё не открыт).
async function ensureBurgerOpen(page){
  if (await page.locator('.hdr-burger a[href="rating.html"]:visible').count() === 0){
    const btn = page.locator('.hdr-burger > button');
    if (await btn.count() > 0){ await btn.first().click(); await page.waitForTimeout(300); }
  }
}

// «раздел достижим» = есть видимая ссылка a[href=...] (в баре ИЛИ, на мобайле
// у конструктора, в открытом бургере «Разделы»)
async function sectionReachable(page, href, allowBurger){
  if (await page.locator(`a[href="${href}"]:visible`).count() > 0) return true;
  if (allowBurger){
    await ensureBurgerOpen(page);
    return await page.locator(`.hdr-burger a[href="${href}"]:visible`).count() > 0;
  }
  return false;
}

test.describe('Навигация: целостность ссылок', () => {
  for (const p of PAGES){
    test(`${p.path} отвечает 200`, async ({ page }) => {
      const res = await page.request.get(p.path);
      expect(res.status(), `${p.path} должен отдавать 200`).toBe(200);
    });
  }
});

for (const vp of [
  { w: 1280, h: 820, label: 'desktop' },
  { w: 375,  h: 812, label: 'mobile'  },
]){
  test.describe(`Адаптив @ ${vp.label} (${vp.w}px)`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } });

    for (const p of PAGES){
      test(`${p.name}: бар, 4 раздела достижимы, без переполнения`, async ({ page }) => {
        await page.goto(p.path);
        await waitBar(page);

        // 1) логотип → лендинг
        const logo = page.locator('.ynav-home[href="start.html"], .hdr a[href="start.html"], .dp-header-home[href="start.html"]').first();
        await expect(logo, 'логотип должен вести на start.html').toHaveCount(1);

        // 2) все 4 раздела достижимы (мобайл-конструктор: разрешаем бургер)
        const allowBurger = p.spa && p.name === 'Конструктор' && vp.w <= 768;
        for (const href of SECTION_HREFS){
          const ok = await sectionReachable(page, href, allowBurger);
          expect(ok, `раздел ${href} недостижим на ${vp.label}`).toBeTruthy();
        }

        // 3) нет горизонтального переполнения СТРАНИЦЫ
        const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
        expect(pageOverflow, 'горизонтальное переполнение страницы').toBeFalsy();
      });
    }

    // Регресс-гард обрезки «Рейтинг» на узких телефонах (был баг: right 394>375).
    // Только там, где свитчер инлайн (статика + игра); у конструктора он в бургере.
    if (vp.w <= 380){
      for (const p of PAGES.filter(p => p.name !== 'Конструктор')){
        test(`${p.name}: последний раздел свитчера влезает в экран`, async ({ page }) => {
          await page.goto(p.path);
          await waitBar(page);
          const sel = p.spa ? '.dp-switch .ynav-item' : '#site-nav .ynav-item';
          await page.waitForSelector(sel);
          const res = await page.evaluate((s) => {
            const items = [...document.querySelectorAll(s)];
            const last = items[items.length - 1];
            if (!last) return { missing: true };
            const cont = last.closest('.ynav-links');           // скролл-контейнер свитчера
            const lr = last.getBoundingClientRect();
            const cr = cont.getBoundingClientRect();
            // обрезан, если выходит за правый край контейнера (уехал под «Войти» / в скролл)
            return { itemRight: Math.round(lr.right), contRight: Math.round(cr.right), clipped: lr.right > cr.right + 1, text: last.textContent.trim() };
          }, sel);
          expect(res.missing, 'свитчер пуст').toBeFalsy();
          expect(res.clipped, `последний раздел "${res.text}" обрезан контейнером бара: right ${res.itemRight} > край ${res.contRight}`).toBeFalsy();
        });
      }
    }
  });
}

// Подсветка активного раздела на своей странице.
test.describe('Активный раздел подсвечен', () => {
  for (const p of PAGES.filter(p => p.active)){
    test(`${p.name}: .is-active на ${p.active}`, async ({ page }) => {
      await page.goto(p.path);
      await waitBar(page);
      const active = page.locator(`.ynav-item.is-active[href="${p.active}"]`);
      await expect(active, `активным должен быть ${p.active}`).toHaveCount(1);
    });
  }
});
