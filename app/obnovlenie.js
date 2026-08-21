/* ═══════════════════════════════════════════════════════════════════════════
   САМООБНОВЛЕНИЕ ПРИЛОЖЕНИЯ — насколько это возможно без магазина.

   Полной тихой автоматики Android вне магазина не даёт принципиально:
   установку подтверждает человек. Поэтому честный максимум такой:
     — приложение раз в несколько часов само смотрит version.json в нашем
       хранилище (Яндекс, работает из России);
     — если вышла новая версия — на главной появляется плашка, в Профиле
       карточка показывает состояние;
     — «Скачать» открывает APK в браузере телефона: загрузка → одно
       касание «Установить» — ставится поверх, данные сохраняются.

   Проверка идёт НАТИВНЫМ запросом (CapacitorHttp из ядра Capacitor), а не
   fetch: браузерный fetch упёрся бы в CORS хранилища, а настраивать CORS
   бакета отсюда нельзя — для этого нужны S3-ключи, которые не должны
   проходить через переписку. Нативному запросу CORS безразличен.

   Выкладка новой версии: app/vypustit.sh — кладёт APK и version.json в
   бакет. Формат version.json:
     { "versionCode": 10, "versionName": "1.9",
       "url": "https://storage.yandexcloud.net/yasnalab.ru/app/yasna.apk",
       "izmeneniya": "что нового, одной строкой" }
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  var АДРЕС = 'https://storage.yandexcloud.net/yasnalab.ru/app/version.json';
  var РАЗ_В = 6 * 3600e3;                       /* не дёргать чаще раза в 6 ч */
  var К_КОГДА = 'yasna_obnova_kogda';
  var К_ОТЛОЖЕНО = 'yasna_obnova_otlozheno';    /* versionCode, который скрыли */
  var К_КЭШ = 'yasna_obnova_kesh';              /* последний ответ хранилища */

  function плагины() { var C = window.Capacitor; return (C && C.Plugins) || {}; }

  function моиДанные() {
    var App = плагины().App;
    if (!App || !App.getInfo) return Promise.resolve(null);
    return App.getInfo().then(function (i) {
      return { код: parseInt(i.build, 10) || 0, имя: i.version || '?' };
    }).catch(function () { return null; });
  }

  function скачатьМанифест() {
    var Http = плагины().CapacitorHttp;
    var адрес = АДРЕС + '?t=' + Date.now();     /* мимо кэшей по дороге */
    /* Жёсткий срок: без сети нативный запрос может висеть минутами, и
       кнопка застревала на «Проверяю…» — проверено на стенде без сети. */
    var срок = new Promise(function (_, нет) {
      setTimeout(function () { нет(new Error('время вышло')); }, 10000);
    });
    var запрос = (Http && Http.get)
      ? Http.get({ url: адрес }).then(function (r) {
          if (r.status !== 200) throw new Error('код ' + r.status);
          return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        })
      : fetch(адрес).then(function (r) { return r.json(); });
    return Promise.race([запрос, срок]);
  }

  /* Проверка. сила=true — по кнопке (без квоты и без «отложено»). */
  window.yasnaObnova = function (сила) {
    return моиДанные().then(function (я) {
      if (!я) return { статус: 'вне-приложения' };
      var сейчас = Date.now();
      if (!сила) {
        var было = 0;
        try { было = +localStorage.getItem(К_КОГДА) || 0; } catch (e) {}
        if (сейчас - было < РАЗ_В) {
          /* Квота не истекла — отвечаем из кэша прошлой проверки. */
          try {
            var к = JSON.parse(localStorage.getItem(К_КЭШ) || 'null');
            if (к) return разобрать(я, к, false);
          } catch (e) {}
          return { статус: 'рано' };
        }
      }
      return скачатьМанифест().then(function (м) {
        try {
          localStorage.setItem(К_КОГДА, String(сейчас));
          localStorage.setItem(К_КЭШ, JSON.stringify(м));
        } catch (e) {}
        return разобрать(я, м, !!сила);
      }).catch(function (e) {
        return { статус: 'сеть', ошибка: String(e && e.message || e).slice(0, 80) };
      });
    });
  };

  function разобрать(я, м, сила) {
    if (!м || !м.versionCode) return { статус: 'сеть' };
    if (м.versionCode <= я.код) return { статус: 'свежая', имя: я.имя };
    if (!сила) {
      try {
        if (+localStorage.getItem(К_ОТЛОЖЕНО) === м.versionCode)
          return { статус: 'отложено', имя: м.versionName };
      } catch (e) {}
    }
    return { статус: 'есть', имя: м.versionName, url: м.url,
             изменения: м.izmeneniya || '', код: м.versionCode };
  }

  window.yasnaObnovaOtlozhit = function (код) {
    try { localStorage.setItem(К_ОТЛОЖЕНО, String(код)); } catch (e) {}
  };

  /* «Скачать»: наружный адрес Capacitor открывает в браузере телефона —
     тот сам качает APK и предлагает установить поверх. */
  window.yasnaObnovaSkachat = function (url) {
    window.open(url, '_system') || (location.href = url);
  };

  /* Плашка на главной: вставляется в #obnova-mesto, если там она уместна. */
  window.yasnaObnovaPlashka = function () {
    var место = document.getElementById('obnova-mesto');
    if (!место) return;
    window.yasnaObnova(false).then(function (о) {
      if (о.статус !== 'есть') return;
      var d = document.createElement('div');
      d.className = 'obnova';
      d.setAttribute('role', 'status');
      d.innerHTML =
        '<div class="obnova-t">Вышла версия ' + о.имя + '</div>' +
        (о.изменения ? '<div class="obnova-o"></div>' : '') +
        '<div class="obnova-r">' +
          '<button type="button" class="obnova-da">Скачать и установить</button>' +
          '<button type="button" class="obnova-net">позже</button>' +
        '</div>';
      if (о.изменения) d.querySelector('.obnova-o').textContent = о.изменения;
      d.querySelector('.obnova-da').onclick = function () { window.yasnaObnovaSkachat(о.url); };
      d.querySelector('.obnova-net').onclick = function () {
        window.yasnaObnovaOtlozhit(о.код); d.remove();
      };
      место.appendChild(d);
    });
  };
})();
