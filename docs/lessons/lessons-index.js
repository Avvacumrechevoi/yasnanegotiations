// ═══════════════════════════════════════════════════════════════════
// LESSONS INDEX — assembly point
// Each lesson-*.js pushes its data into window.YasnaLessons.lessons.
// This file exposes it as the LESSONS global that the app expects.
// Must load AFTER all lesson-*.js files.
// ═══════════════════════════════════════════════════════════════════

const LESSONS = window.YasnaLessons.lessons;
window.YasnaLessons.LESSONS = LESSONS;

// Уроки конструктора объявляют себя в черновике каталога доступов.
// Это НЕ права: declare() ничего не закрывает (см. core/access.js) —
// черновик нужен админке, чтобы собрать каталог одной кнопкой.
try {
  if (window.YasnaAccess && window.YasnaAccess.declare) {
    window.YasnaAccess.declare(LESSONS.map(function (l) {
      return {
        feature: 'lesson:' + l.id,
        area: 'constructor',
        parent: 'section:constructor',
        title: l.title || l.id,
        kind: 'lesson',
        declaredAt: 'lessons/lessons-index.js'
      };
    }));
  }
} catch (_) {}
