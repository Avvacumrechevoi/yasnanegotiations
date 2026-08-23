/* ═══════════════════════════════════════════════════════════════════════
   ШТОРКА С УПОРАМИ — мини / средне / полно / закрыто.

   ЗАЧЕМ. Карточка полки на телефоне была «панелью с классом»: класс менялся,
   высота — нет (в styles.css стояло .fi{height:100%!important}, и инлайн-
   высота из жеста ему проигрывала). Человек тянул карточку, а она стояла.
   Здесь движение идёт единственным способом, который телефон рисует без
   пересчёта разметки, — transform: translate3d по вертикали.

   КАК ЭТО СДЕЛАНО В ИНДУСТРИИ (свод исследования):
     • упоры-детенты, а не свободная высота (Apple UISheet, Material 3,
       Карты, Музыка, YouTube);
     • отпускание решает не позиция, а ПРОЕКЦИЯ с учётом скорости — иначе
       быстрый короткий бросок не срабатывает и жест кажется «залипшим»;
     • пока шторка ниже среднего упора, затемнения нет и то, что под ней,
       остаётся рабочим (largestUndimmedDetent у Apple);
     • смахивание вниз идёт по одной ступени, с самой нижней — закрывает.

   Разметка, которую ждёт модуль (см. info-card.js):
     <aside class="side-panel sht">          ← корень, height:100dvh
       <div class="sht-korpus">
         <div class="sht-ruchka" data-tyaga>…<button class="sht-ruchka-knopka">
         <header class="sht-shapka" data-tyaga>…
         <div class="sht-telo">…прокручиваемое содержимое…
   Слушатели висят на КОРНЕ (делегирование), поэтому перерисовка React
   внутри ничего не ломает.
   ═══════════════════════════════════════════════════════════════════════ */
(function (window, document) {
'use strict';

var БРОСОК   = 0.45;  /* px/мс — выше этого жест считаем броском           */
var ПРОЕКЦИЯ = 110;   /* мс    — на столько «долетит» палец по инерции     */
var ЛЮФТ     = 8;     /* px    — до этого не решаем: тянем или скроллим    */
var ОКНО_V   = 90;    /* мс    — окно замера скорости                      */
var ТАП      = 6;     /* px    — сдвиг, ниже которого жест считается тапом  */

function создать(корень, наст) {
  наст = наст || {};
  var Y = {}, H = 0, целевой = 0, кадр = null, ждёт = null;
  var упор = 'закрыто';   /* стартуем за краем экрана и выезжаем на упор */
  var перо = null;      /* активная тяга */
  var таймерЗакрытия = null;
  var решение = null;   /* 'тяга' | 'скролл' | 'гориз' | null */
  var снят = false;

  function тело() { return корень.querySelector('.sht-telo'); }
  function мобильная() {
    return window.matchMedia('(max-width:1023px)').matches;
  }
  function чис(s) { var v = parseFloat(s); return isFinite(v) ? v : 0; }

  /* ── Геометрия: упоры в пикселях сдвига вниз от верха экрана ───────── */
  function пересчитать() {
    H = корень.offsetHeight || window.innerHeight || 1;
    /* Высоту наббара берём замером невидимой метки .sht-mera: у неё
       height:var(--sht-dok). Читать саму переменную нельзя — она хранится
       как есть, строкой «calc(70px + 0px)», и parseFloat даёт NaN. */
    var метка = корень.querySelector('.sht-mera');
    var док = метка ? метка.offsetHeight : 0;
    /* Мини меряем по содержимому, а не долей экрана: до метки .sht-mini-kraj
       стоят суть и единственное действие, и они обязаны помещаться целиком.
       На 360×800 доля экрана давала упор, при котором кнопка наполовину
       уходила под наббар — нажимать было можно, видно нельзя. */
    var край = корень.querySelector('.sht-mini-kraj');
    var нужно = край ? край.offsetTop + 22 : Math.round(H * 0.235);
    var мини   = Math.min(Math.round(H * 0.46), Math.max(150, нужно)) + док;
    var средне = Math.round(H * 0.50) + док;
    var верх   = Math.max(44, Math.round(H * 0.075));
    Y = {
      полно:   верх,
      средне:  Math.max(верх + 40, H - средне),
      мини:    Math.max(верх + 80, H - мини),
      закрыто: H
    };
    низкий = H < 620;                     /* ландшафт: среднего упора нет */
    if (низкий && упор === 'средне') упор = 'полно';
    /* Через кУпору, а не поставить(): только он держит data-upор, html[data-sht]
       и --sht-h. Иначе после поворота карточка стояла на месте «полно», а
       считалась «средней» — снизу зияло 290px пустого листа, а маска гасила
       текст под наббаром, которого там уже не было. */
    if (первый) { поставить(Y[упор] != null ? Y[упор] : Y.мини, false); return; }
    кУпору(упор, 0);
  }
  var низкий = false;
  var первый = true;

  function ступени() {
    var с = ['полно'];
    if (!низкий) с.push('средне');
    с.push('мини');
    if (наст.закрываемая !== false) с.push('закрыто');
    return с;                              /* сверху вниз */
  }

  /* ── Запись кадра: единственная точка правки DOM ───────────────────── */
  function поставить(y, плавно, длит) {
    целевой = y;
    ждёт = { y: y, плавно: плавно, длит: длит || 0 };
    if (кадр) return;
    кадр = requestAnimationFrame(function () {
      кадр = null;
      var з = ждёт; ждёт = null;
      if (!з || снят) return;
      корень.classList.toggle('sht--snap', !!з.плавно);
      if (з.плавно) корень.style.setProperty('--sht-dur', (з.длит || 320) + 'ms');
      корень.style.setProperty('--sht-y', Math.round(з.y) + 'px');
      var надДоком = з.y < (Y['средне'] != null ? Y['средне'] : Y.полно) - 8;
      корень.classList.toggle('sht--nad-dokom', надДоком);
      var фон = корень.parentNode && корень.parentNode.querySelector('.sht-fon');
      if (фон) {
        var верх = Y.полно, низ = (Y['средне'] != null ? Y['средне'] : Y.мини);
        var p = (низ - з.y) / Math.max(1, низ - верх);
        p = p < 0 ? 0 : p > 1 ? 1 : p;
        фон.style.opacity = p.toFixed(3);
        фон.style.pointerEvents = p > 0.5 ? 'auto' : 'none';
      }
    });
  }

  function резинка(x) { return 26 * (1 - Math.exp(-x / 26)); }

  /* ── Ядро тяги ─────────────────────────────────────────────────────── */
  function тягаНачать(y) {
    /* Берём ТЕКУЩЕЕ положение листа, а не цель анимации: если палец лёг на
       ходу, старт по цели телепортировал шторку в конечную точку — рывок в
       полэкрана. getBoundingClientRect у трансформированного элемента даёт
       реальное, уже проинтерполированное значение. */
    var сейчас = целевой;
    try {
      var r = корень.getBoundingClientRect();
      if (r && isFinite(r.top)) сейчас = Math.round(r.top);
    } catch (_) {}
    корень.style.setProperty('--sht-y', сейчас + 'px');
    корень.classList.remove('sht--snap');
    целевой = сейчас;
    корень.style.setProperty('--sht-h', высотаТела(Y.полно) + 'px');
    перо = { y0: y, старт: сейчас, упорНаСтарте: упор, точки: [{ t: Date.now(), y: y }] };
  }
  function тягаВести(y) {
    if (!перо) return;
    var t = Date.now();
    перо.точки.push({ t: t, y: y });
    while (перо.точки.length > 2 && t - перо.точки[0].t > ОКНО_V) перо.точки.shift();
    var ny = перо.старт + (y - перо.y0);
    if (ny < Y.полно) ny = Y.полно - резинка(Y.полно - ny);
    if (ny > Y.закрыто) ny = Y.закрыто + резинка(ny - Y.закрыто);
    поставить(ny, false);
  }
  function тягаКончить() {
    if (!перо) return;
    var т = перо.точки, v = 0;
    if (т.length > 1) {
      var a = т[0], b = т[т.length - 1], dt = b.t - a.t;
      if (dt > 8) v = (b.y - a.y) / dt;      /* px/мс, вниз — плюс */
    }
    var сНачала = перо.упорНаСтарте;
    перо = null;
    var с = ступени();
    var долёт = целевой + v * ПРОЕКЦИЯ;
    var имя = ближний(долёт, с);
    /* Короткий быстрый бросок обязан сработать: если палец прошёл мало и
       проекция вернула бы на тот же упор, уходим на одну ступень в сторону
       броска. Отсчёт — от упора, С КОТОРОГО начали: иначе бросок считался
       от промежуточной позиции и перепрыгивал через ступень. */
    if (Math.abs(v) > БРОСОК && имя === сНачала) {
      var шаг = Math.max(0, Math.min(с.length - 1, с.indexOf(сНачала) + (v > 0 ? 1 : -1)));
      имя = с[шаг];
    }
    кУпору(имя);
  }
  function ближний(y, с) {
    var имя = с[0], разн = Infinity;
    for (var i = 0; i < с.length; i++) {
      var d = Math.abs(Y[с[i]] - y);
      if (d < разн) { разн = d; имя = с[i]; }
    }
    return имя;
  }

  /* Высота прокручиваемого тела = видимая часть шторки минус шапка.
     Иначе прокрутка на среднем упоре не работала бы вовсе: элемент был бы
     во весь экран, а видно у него только верхнюю половину, и браузер считал
     бы, что прокручивать нечего. Во время тяги высоту НЕ трогаем (взята по
     полному упору) — перерасчёт разметки на каждом кадре давал бы рывки. */
  function верхняяЧасть() {
    var р = корень.querySelector('.sht-ruchka'), ш = корень.querySelector('.sht-shapka');
    return (р ? р.offsetHeight : 0) + (ш ? ш.offsetHeight : 0);
  }
  function высотаТела(y) {
    return Math.max(96, Math.round(H - y - верхняяЧасть()));
  }

  function кУпору(имя, силойДлит) {
    if (!(имя in Y)) return;
    var путь = Math.abs(целевой - Y[имя]);
    var длит = Math.min(420, Math.max(190, Math.round(путь * 0.55)));
    if (силойДлит != null) длит = силойДлит;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) длит = 1;
    /* Отложенное закрытие снимаем: человек мог за эти 400 мс уже выбрать
       другое место, и таймер погасил бы его выбор. */
    clearTimeout(таймерЗакрытия); таймерЗакрытия = null;
    упор = имя;
    корень.dataset.upor = имя;
    var кн = корень.querySelector('.sht-ruchka-knopka');
    if (кн) {
      кн.setAttribute('aria-expanded', имя === 'полно' ? 'true' : 'false');
      кн.setAttribute('aria-label', имя === 'полно' ? 'Свернуть карточку' : 'Раскрыть карточку');
    }
    document.documentElement.setAttribute('data-sht', имя);
    поставить(Y[имя], true, длит);
    корень.style.setProperty('--sht-h', высотаТела(имя === 'закрыто' ? Y.мини : Y[имя]) + 'px');
    var т = тело();
    if (т && имя === 'мини') т.scrollTop = 0;
    if (наст.наУпор) наст.наУпор(имя);
    if (имя === 'закрыто' && наст.наЗакрытие) {
      таймерЗакрытия = setTimeout(function () {
        таймерЗакрытия = null;
        if (!снят && упор === 'закрыто' && наст.наЗакрытие) наст.наЗакрытие();
      }, длит + 20);
    }
  }

  function шагВверх() {
    var с = ступени(), i = с.indexOf(упор);
    кУпору(с[Math.max(0, i - 1)]);
  }
  function шагВниз() {
    var с = ступени(), i = с.indexOf(упор);
    кУпору(с[Math.min(с.length - 1, i + 1)]);
  }

  /* ── Жест ──────────────────────────────────────────────────────────────
     Один разбор на touch и на мышь: телефон присылает touch, стенд и
     десктоп — мышь. pointerdown не годится: отменить нативную прокрутку
     можно только в touchmove, а он не приходит для pointer-событий. */
  function начало(e, x, y) {
    if (!мобильная() || перо) { решение = 'мимо'; return; }
    var цель = e.target;
    var кнопка = цель.closest && цель.closest('button,a,input,select,textarea');
    var ручка = цель.closest && цель.closest('.sht-ruchka');
    var зона = цель.closest && цель.closest('[data-tyaga]');
    /* Точку начала пишем ВСЕГДА и первым делом. Раньше выход на кнопке стоял
       выше этих строк, и следующий жест считал смещение от чужой, оставшейся
       с прошлого касания точки: смахивание вниз с большой кнопки «Урок…» то
       работало, то нет — в зависимости от того, где человек трогал карточку
       до этого. */
    начало.x0 = x; начало.y0 = y; начало.t0 = Date.now();
    начало.зона = !!зона;
    начало.ручка = !!ручка;
    начало.старт = целевой;
    решение = null;
    if (кнопка && !ручка) {
      /* Кнопку не перехватываем на тапе, но смахивание с неё — это жест
         шторки: на полном упоре тело почти целиком из кнопок. */
      решение = зона ? 'ждём' : null;
      начало.скнопки = true;
      return;
    }
    начало.скнопки = false;
    if (зона) { решение = 'ждём'; }          /* в шапке решаем ось */
    else if (цель.closest && цель.closest('.sht-telo')) { решение = null; }
    else { решение = 'мимо'; }
  }
  function ведение(e, x, y) {
    if (!мобильная() || решение === 'мимо') return;
    var dx = x - начало.x0, dy = y - начало.y0;
    if (решение === 'ждём') {                /* шапка: ось решается один раз */
      if (Math.abs(dx) < ЛЮФТ && Math.abs(dy) < ЛЮФТ) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.2) { решение = 'гориз'; }
      else { решение = 'тяга'; тягаНачать(y); }
    }
    if (решение === null) {                  /* тело: тянем или скроллим */
      if (Math.abs(dy) < ЛЮФТ) return;
      var т = тело();
      var естьКуда = т && т.scrollHeight > т.clientHeight + 1;
      var сверху = !т || т.scrollTop <= 0;
      var вниз = dy > 0;
      var тянем = (упор === 'мини') || (вниз && сверху) || (!вниз && упор !== 'полно');
      if (!тянем && естьКуда) { решение = 'скролл'; return; }
      решение = 'тяга';
      тягаНачать(y);
    }
    if (решение === 'тяга') {
      if (e.cancelable) e.preventDefault();
      тягаВести(y);
    } else if (решение === 'гориз') {
      if (e.cancelable) e.preventDefault();
    }
  }
  function конец(e, x, y) {
    последнийЖест = Date.now();
    var р = решение; решение = null;
    if (!мобильная() || р === 'мимо') return;
    var dx = (x != null ? x : начало.x0) - начало.x0;
    var dy = (y != null ? y : начало.y0) - начало.y0;
    var быстро = Date.now() - начало.t0 < 400;
    if (р === 'гориз') {
      if (Math.abs(dx) > 48 && наст.наСоседа) наст.наСоседа(dx < 0 ? 1 : -1);
      return;
    }
    if (р === 'тяга') { тягаКончить(); return; }
    /* тап */
    if (начало.скнопки) return;              /* кнопка сама разберётся */
    if (Math.abs(dx) < ТАП && Math.abs(dy) < ТАП && быстро) {
      /* Из полного тап сворачивает сразу в мини: иначе вниз тапом не выйти —
         тап давал бы вечное средне ↔ полно. */
      if (начало.ручка) { упор === 'полно' ? кУпору('мини') : шагВверх(); }
      else if (начало.зона && упор === 'мини') { шагВверх(); }
    }
  }

  /* После касания Chrome досылает совместимые mousedown/mouseup — и жест
     считался дважды: один тап по ручке уводил сразу через ступень. Мышь
     слушаем только тогда, когда касаний не было. */
  var последнийТач = 0;
  var последнийЖест = 0;
  function тНач(e) {
    последнийТач = Date.now();
    if (e.touches.length === 1) начало(e, e.touches[0].clientX, e.touches[0].clientY); else решение = 'мимо';
  }
  function тВед(e) { if (e.touches.length === 1) ведение(e, e.touches[0].clientX, e.touches[0].clientY); }
  function тКон(e) {
    последнийТач = Date.now();
    var t = e.changedTouches && e.changedTouches[0];
    конец(e, t ? t.clientX : null, t ? t.clientY : null);
  }
  function мВниз(e) {
    if (e.button !== 0) return;
    if (Date.now() - последнийТач < 700) return;   /* эхо касания — пропускаем */
    начало(e, e.clientX, e.clientY);
    window.addEventListener('mousemove', мВед);
    window.addEventListener('mouseup', мВверх);
  }
  function мВед(e) { ведение(e, e.clientX, e.clientY); }
  function мВверх(e) {
    конец(e, e.clientX, e.clientY);
    window.removeEventListener('mousemove', мВед);
    window.removeEventListener('mouseup', мВверх);
  }

  корень.addEventListener('touchstart', тНач, { passive: true });
  корень.addEventListener('touchmove', тВед, { passive: false });
  корень.addEventListener('touchend', тКон);
  корень.addEventListener('touchcancel', тКон);
  корень.addEventListener('mousedown', мВниз);

  /* ── Клавиатура, Escape и аппаратная «назад» ───────────────────────── */
  function поКлавише(e) {
    if (!мобильная()) return;
    var внутри = e.target && e.target.closest && e.target.closest('.sht-ruchka');
    if (e.key === 'Escape') { e.stopPropagation(); кУпору('закрыто'); return; }
    if (!внутри) return;
    if (e.key === 'ArrowUp') { шагВверх(); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { шагВниз(); e.preventDefault(); }
  }
  /* Слушаем окно, а не корень: фокус почти всегда снаружи карточки, и до
     неё клавиша просто не доходила — Escape не закрывал ничего. */
  window.addEventListener('keydown', поКлавише);

  /* Enter и Space на ручке шлют только click — ни touchstart, ни mousedown.
     Без этого с клавиатуры шторка не двигалась вовсе. */
  function поКлику(e) {
    if (!мобильная()) return;
    if (Date.now() - последнийЖест < 450) return;   /* эхо пальца или мыши */
    var к = e.target.closest && e.target.closest('.sht-ruchka-knopka');
    if (!к) return;
    упор === 'полно' ? кУпору('мини') : шагВверх();
  }
  корень.addEventListener('click', поКлику);

  function поНазад(e) {
    if (!мобильная() || e.defaultPrevented) return;
    e.preventDefault();
    шагВниз();
  }
  window.addEventListener('yasna:назад', поНазад);

  /* Тап по затемнению опускает шторку на ступень — не закрывает разом:
     человек, скорее всего, хочет вернуться к кругу, а не потерять место. */
  var фонУзел = корень.parentNode && корень.parentNode.querySelector('.sht-fon');
  function поФону() { if (упор === 'полно') кУпору('средне'); }
  if (фонУзел) фонУзел.addEventListener('click', поФону);

  var таймер = null;
  function отложенныйПересчёт() {
    clearTimeout(таймер);
    таймер = setTimeout(пересчитать, 120);
  }
  window.addEventListener('resize', отложенныйПересчёт);
  window.addEventListener('orientationchange', отложенныйПересчёт);

  пересчитать();
  первый = false;
  кУпору(наст.старт || 'мини');

  return {
    кУпору: кУпору,
    упор: function () { return упор; },
    закрыть: function () { if (мобильная()) кУпору('закрыто'); else if (наст.наЗакрытие) наст.наЗакрытие(); },
    пересчитать: пересчитать,
    снять: function () {
      снят = true;
      корень.removeEventListener('touchstart', тНач);
      корень.removeEventListener('touchmove', тВед);
      корень.removeEventListener('touchend', тКон);
      корень.removeEventListener('touchcancel', тКон);
      корень.removeEventListener('mousedown', мВниз);
      корень.removeEventListener('click', поКлику);
      window.removeEventListener('keydown', поКлавише);
      window.removeEventListener('yasna:назад', поНазад);
      if (фонУзел) фонУзел.removeEventListener('click', поФону);
      window.removeEventListener('resize', отложенныйПересчёт);
      window.removeEventListener('orientationchange', отложенныйПересчёт);
      window.removeEventListener('mousemove', мВед);
      window.removeEventListener('mouseup', мВверх);
      document.documentElement.removeAttribute('data-sht');
      clearTimeout(таймер);
      clearTimeout(таймерЗакрытия);
      if (кадр) cancelAnimationFrame(кадр);
      var фон = корень.parentNode && корень.parentNode.querySelector('.sht-fon');
      if (фон) фон.style.opacity = 0;
    }
  };
}

window.YasnaShtorka = { создать: создать };

})(window, document);
