/* ═══════════════════════════════════════════════════════════════════════════
   Собирает www/ — то, что ляжет ВНУТРЬ приложения, — из docs/.

   Почему копия, а не тот же каталог: в приложении часть сайта лишняя, а часть
   вредна. Ниже каждое исключение с причиной; если добавляете новое —
   добавляйте и причину, иначе через месяц никто не вспомнит, почему файла нет.

   Запуск:  npm run vitrina   (или npm run sync — соберёт и перенесёт в android/)
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync,
         readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ЗДЕСЬ = dirname(fileURLToPath(import.meta.url));
const ИСТОК = join(ЗДЕСЬ, '..', 'docs');
const ЦЕЛЬ  = join(ЗДЕСЬ, 'www');

/* Что не едет в приложение. */
const НЕ_БРАТЬ = [
  // Админка — рабочий инструмент владельца, а не часть продукта. В приложении
  // она была бы кнопкой «сломать сайт» на виду у всех.
  'admin.html', 'admin.js', 'admin-access.js',
  // Опытная страница v2 тянет babel-standalone с чужого CDN (3 МБ) и
  // компилирует JSX прямо в браузере. В приложении это и вес, и зависимость
  // от сети — ровно то, от чего мы уходим.
  'games/duel/v2',
  // Пустой каталог с прежних времён.
  'preview',
  // Служебное для GitHub Pages: в приложении не значит ничего.
  'CNAME', '.nojekyll', 'robots.txt',
  // Офлайн-механика сайта. Внутри приложения все файлы и так местные, а
  // работник только мешал бы обновлению: содержимое меняется вместе с APK.
  'sw.js', 'offline.html',
  // Замок и его будущие грабли: файл лежал мёртвым грузом, но если какая-то
  // страница снова его подключит, приложение навсегда уведёт на главную.
  'core/gate.js', 'core/pwa.js',
  // Исходники, запечённые в dist/*.min.js: страницы приложения грузят только
  // бандлы (проверено по src= всех страниц), а эти копии — треть веса APK.
  // ВАЖНО: games/duel/*.css остаются — их duel.html грузит напрямую.
  'app.js', 'lessons', 'tours',
  'core/astro-panel.js', 'core/sky-real.js',
  // content-store.js грузила только вырезанная админка.
  'core/content-store.js',
  'games/duel/content', 'games/duel/content.bundle.js',
  'games/duel/duel.js', 'games/duel/duel-page.js', 'games/duel/turnir-engine.js',
  'games/duel/group-engine.js', 'games/duel/rt-firebase.js', 'games/duel/trivia-bank.js',
  'games/duel/duel-games.js', 'games/duel/duel-game-mirror.js',
  'games/duel/duel-game-quiz.js', 'games/duel/duel-game-speed.js',
  // Сирота: ни одной ссылки ниоткуда (проверено грепом по всем html/js).
  'games/krug/varianty',
  // Карта России 518 КБ не используется ни одной страницей.
  'assets/russia-map.svg',
];

const МУСОР = /(^|\/)(\.DS_Store|.*\.md)$/;

function собрать() {
  rmSync(ЦЕЛЬ, { recursive: true, force: true });
  mkdirSync(ЦЕЛЬ, { recursive: true });

  let взято = 0, пропущено = 0, байт = 0;
  const обойти = (dir) => {
    for (const имя of readdirSync(dir)) {
      const путь = join(dir, имя);
      const отн = relative(ИСТОК, путь);
      if (НЕ_БРАТЬ.some(x => отн === x || отн.startsWith(x + '/')) || МУСОР.test(отн)) {
        пропущено++; continue;
      }
      if (statSync(путь).isDirectory()) { обойти(путь); continue; }
      const куда = join(ЦЕЛЬ, отн);
      mkdirSync(dirname(куда), { recursive: true });
      cpSync(путь, куда);
      взято++; байт += statSync(путь).size;
    }
  };
  обойти(ИСТОК);
  return { взято, пропущено, байт };
}

/* Правки в скопированных страницах. */
function поправить() {
  const страницы = [];
  const обойти = (dir) => {
    for (const имя of readdirSync(dir)) {
      const п = join(dir, имя);
      if (statSync(п).isDirectory()) обойти(п);
      else if (имя.endsWith('.html')) страницы.push(п);
    }
  };
  обойти(ЦЕЛЬ);

  let замок = 0, работник = 0, прибавка = 0;
  for (const п of страницы) {
    let s = readFileSync(п, 'utf8');
    const было = s;

    // ЗАМОК. core/gate.js уводит на главную всех, кто не ввёл служебный
    // пароль. В приложении это значило бы: человек ставит его из магазина и
    // первым делом видит окно пароля. Признак «пароль введён» хранится в
    // localStorage, а у приложения оно своё — то есть ввести его было бы
    // нечем. Замок держит сайт на время стройки, приложение он не держит.
    const s1 = s.replace(/\s*<!--[^>]*Замок[^>]*-->\s*/g, '\n')
                .replace(/\s*<script[^>]+core\/gate\.js[^>]*><\/script>/g, '');
    if (s1 !== s) замок++;
    s = s1;

    // РАБОТНИК ОФЛАЙНА. Внутри приложения файлы и так местные; работник только
    // добавил бы второй кэш поверх APK и путал обновления.
    const s2 = s.replace(/\s*<script[^>]+core\/pwa\.js[^>]*><\/script>/g, '');
    if (s2 !== s) работник++;
    s = s2;

    // VIEWPORT-FIT=COVER — каждой странице приложения. Android 15+ рисует
    // WebView под строкой состояния; Capacitor сдвигает содержимое сам только
    // когда страница объявила cover (иначе он лишь ставит CSS-переменные,
    // которых сайт не знает). Без этой строки на живом телефоне шапка уезжала
    // под часы — на эмуляторе без выреза этого не было видно.
    s = s.replace(/(<meta[^>]+name=["']viewport["'][^>]+content=["'])([^"']*?)(["'])/i,
      (вся, до, значение, после) =>
        /viewport-fit/.test(значение) ? вся : до + значение + ',viewport-fit=cover' + после);

    // ПРИБАВКА ПРИЛОЖЕНИЯ: кнопка «назад», строка состояния, знак о пропаже
    // сети. Без этого обёртка остаётся сайтом в рамке — и это первое, за что
    // её отклоняют в магазине.
    if (!/pribavka\.js/.test(s)) {
      const глубина = relative(ЦЕЛЬ, dirname(п)).split(/[\\/]/).filter(Boolean).length;
      const вверх = '../'.repeat(глубина);
      const тег = `\n<script defer src="${вверх}pribavka.js"></script>`;
      if (/<\/body>/i.test(s)) s = s.replace(/<\/body>/i, тег + '\n</body>');
      else s += тег;
      прибавка++;
    }

    if (s !== было) writeFileSync(п, s, 'utf8');
  }
  return { страницы: страницы.length, замок, работник, прибавка };
}

const c = собрать();
/* Прибавка живёт рядом со сборщиком, а не в docs/: на сайте она не нужна и
   там бы только мозолила глаза. */
cpSync(join(ЗДЕСЬ, 'pribavka.js'), join(ЦЕЛЬ, 'pribavka.js'));

/* ГЛАВНАЯ ПРИЛОЖЕНИЯ вместо сайтовой. Сайтовая — рекламная страница со
   скроллом и героем; в приложении человеку нужны двери в занятия одним
   касанием и нижний наббар. Замена происходит ДО поправить(), чтобы новая
   главная тоже получила прибавку. */
cpSync(join(ЗДЕСЬ, 'glavnaya.html'), join(ЦЕЛЬ, 'index.html'));
const p = поправить();
const остатки = [];
const известные = [];
(function проверить(dir) {
  for (const имя of readdirSync(dir)) {
    const п = join(dir, имя);
    if (statSync(п).isDirectory()) { проверить(п); continue; }
    if (!/\.(html|js|css)$/.test(имя)) continue;
    const s = readFileSync(п, 'utf8');
    /* Ищем только то, что страница ГРУЗИТ: src у скриптов и картинок,
       href у таблиц стилей, @import. Обычные ссылки для человека
       (t.me, справка Anthropic) сюда не попадают — они и должны вести
       наружу, их открывает браузер, а не приложение. */
    const грузит = [
      /<script[^>]+src=["'](https?:\/\/[^"']+)["']/g,
      /<link[^>]+rel=["']stylesheet["'][^>]+href=["'](https?:\/\/[^"']+)["']/g,
      /<link[^>]+href=["'](https?:\/\/[^"']+)["'][^>]+rel=["']stylesheet["']/g,
      /@import\s+url\(["']?(https?:\/\/[^"')]+)/g,
      /\.src\s*=\s*["'](https?:\/\/[^"']+)["']/g,
    ];
    for (const re of грузит) {
      for (const m of s.matchAll(re)) {
        const u = m[1];
        /* Свой шлюз и Firebase — сеть по делу, а не подгрузка кода. */
        if (/apigw\.yandexcloud\.net|firebaseio\.com/.test(u)) continue;
        /* Виджет Telegram остаётся в коде, но в приложении не выполняется:
           обе точки подключения закрыты проверкой на YasnaApp/ в строке
           браузера (games/duel/duel.js и duel-page.js). Вход через Telegram
           привязан к домену в BotFather и к браузерному окружению — в
           приложении он невозможен, и вместо кнопки там стоит строка
           «Вход через Telegram доступен на сайте». */
        if (/telegram\.org\/js\/telegram-widget/.test(u)) { известные.push(`${relative(ЦЕЛЬ, п)} → ${u}`); continue; }
        остатки.push(`${relative(ЦЕЛЬ, п)} → ${u}`);
      }
    }
  }
})(ЦЕЛЬ);

/* ОБЛОМКИ РАЗМЕТКИ. Отдельная проверка, потому что на этом я уже обжёгся:
   старая иконка сидела в data:image/svg+xml с СЫРОЙ разметкой внутри, правило
   удаления <link ...[^>]*> оборвалось на первом же '>' внутри этого svg, и
   остаток вытек в документ обычным текстом — на девяти страницах над шапкой
   висело ✦"/>. В браузере ошибки нет, в консоли тихо; видно только глазами,
   и я увидел это лишь на снимке с телефона. */
const обломки = [];
(function ломано(dir) {
  for (const имя of readdirSync(dir)) {
    const п = join(dir, имя);
    if (statSync(п).isDirectory()) { ломано(п); continue; }
    if (!имя.endsWith('.html')) continue;
    const s = readFileSync(п, 'utf8');
    /* Хвост незакрытого тега: закрывающий svg или text, за которым идёт
       кавычка и '>', — так выглядит именно этот вид обломка. */
    if (/<\/(?:svg|text)>["']\s*\/?>/.test(s))
      обломки.push(`${relative(ЦЕЛЬ, п)} — хвост незакрытого тега в разметке`);
    /* Причина, а не следствие: сырая разметка внутри адреса data:. */
    if (/href=["']data:image\/svg\+xml,\s*</.test(s))
      обломки.push(`${relative(ЦЕЛЬ, п)} — сырая разметка внутри data:-адреса`);
  }
})(ЦЕЛЬ);

console.log(`  взято файлов: ${c.взято}, пропущено: ${c.пропущено}, вес: ${(c.байт/1048576).toFixed(1)} МБ`);
console.log(`  страниц: ${p.страницы} · снят замок: ${p.замок} · снят работник офлайна: ${p.работник} · добавлена прибавка: ${p.прибавка}`);
if (обломки.length) {
  console.log('\n  ⚠ ОБЛОМКИ РАЗМЕТКИ — они видны на странице обычным текстом:');
  for (const x of обломки) console.log('    ' + x);
  process.exitCode = 1;
}
if (остатки.length) {
  console.log('\n  ⚠ ОСТАЛИСЬ ССЫЛКИ НА ЧУЖИЕ СЕРВЕРА — в приложении они не откроются без сети:');
  for (const x of остатки) console.log('    ' + x);
  process.exitCode = 1;
} else {
  console.log('  ссылок на чужие сервера нет — приложение самодостаточно');
}
if (известные.length) {
  console.log(`  (известное исключение: виджет Telegram в ${известные.length} местах — код есть, в приложении не выполняется)`);
}
