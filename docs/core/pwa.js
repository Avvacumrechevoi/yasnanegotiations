/* ═══════════════════════════════════════════════════════════════════════════
   Подключение офлайна. Отдельный маленький файл, а не строка в каждой из
   девяти страниц: одиннадцать копий одного кода расходятся на второй правке.

   Работник живёт в корне сайта (./sw.js), а не в core/ — область действия
   у него равна папке, где он лежит, и из core/ он не увидел бы остальной сайт.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  if (!('serviceWorker' in navigator)) return;

  /* Корень сайта относительно текущей страницы: страницы лежат на трёх
     глубинах (/, /games/krug/, /games/duel/v2/), а сам сайт может стоять не в
     корне домена — на Pages он живёт в /yasnanegotiations/.
     Приставку берём из ссылки на манифест и РАЗРЕШАЕМ её в настоящий адрес.
     Без этого шага на главной выходила пустая строка, register получал scope
     '' — то есть область, равную самой странице, — и работник управлял ровно
     одним адресом /index.html, а не сайтом. Снаружи это выглядело как рабочий
     офлайн: страницы открывались из обычного кэша браузера, а не из нашего. */
  var base = document.querySelector('link[rel="manifest"]');
  var приставка = base ? base.getAttribute('href').replace(/manifest\.webmanifest$/, '') : './';
  var корень = new URL(приставка || './', location.href).pathname;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register(корень + 'sw.js', { scope: корень })
      .then(function (reg) {
        /* Новая версия приезжает молча и ждёт закрытия вкладок. Говорим об
           этом словами и даём нажать — молчаливая подмена бандлов на середине
           занятия хуже, чем лишняя строка внизу экрана. */
        reg.addEventListener('updatefound', function () {
          var новый = reg.installing;
          if (!новый) return;
          новый.addEventListener('statechange', function () {
            if (новый.state === 'installed' && navigator.serviceWorker.controller) {
              показатьОбновление(новый);
            }
          });
        });
      })
      .catch(function (e) {
        if (window.console) console.warn('Ясна: офлайн не подключился —', e && e.message);
      });
  });

  var перезагрузка = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (перезагрузка) return;
    перезагрузка = true;
    location.reload();
  });

  function показатьОбновление(работник) {
    if (document.getElementById('yasna-update')) return;
    var d = document.createElement('div');
    d.id = 'yasna-update';
    d.setAttribute('role', 'status');
    d.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:18px', 'transform:translateX(-50%)',
      'z-index:99999', 'display:flex', 'gap:14px', 'align-items:center',
      'max-width:calc(100vw - 32px)', 'padding:11px 14px', 'border-radius:12px',
      'background:#111827', 'color:#fff', 'box-shadow:0 6px 24px rgba(0,0,0,.24)',
      'font:500 14px/1.4 system-ui,-apple-system,sans-serif'
    ].join(';');
    d.innerHTML = '<span>Обновление готово</span>';

    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Обновить';
    b.style.cssText = 'font:600 14px/1 inherit;color:#111827;background:#fff;' +
      'border:0;border-radius:8px;padding:9px 13px;cursor:pointer';
    b.onclick = function () { работник.postMessage('обновись'); };

    var x = document.createElement('button');
    x.type = 'button';
    x.textContent = 'позже';
    x.setAttribute('aria-label', 'Отложить обновление');
    x.style.cssText = 'font:400 13px/1 inherit;color:#9aa3b2;background:none;' +
      'border:0;padding:6px;cursor:pointer';
    x.onclick = function () { d.remove(); };

    d.appendChild(b); d.appendChild(x);
    document.body.appendChild(d);
  }
})();
