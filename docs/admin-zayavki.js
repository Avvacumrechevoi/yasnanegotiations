// ═══════════════════════════════════════════════════════════════════
// Вкладка «Заявки» в админке: разбор обращений «Посчитать имя».
//
// ЗАЧЕМ ОТДЕЛЬНЫМ ФАЙЛОМ. Тем же порядком, что и «Доступы»: правки заявок не
// должны смешиваться с редактором контента, и одна ошибка не должна ломать
// другое. Вкладка появляется в админке, только если этот файл подключён.
//
// ФАКТИЧЕСКИЙ КОНТРАКТ (server/zayavki.js, задеплоен):
//   GET /zayavki?sostoyanie=novaya|v_rabote|otvecheno
//        → { zayavki[{id,vid,imya,rozhdenie,svyaz,vopros,sostoyanie,otvet,
//                     createdAt,updatedAt}], sostoyanie }
//   PUT /zayavki  { id, sostoyanie, otvet } → { saved, id, sostoyanie }
// Обе ручки закрыты правом cap:zayavki.read (или суперадмином). Права нет —
// сервер отвечает 403, и мы так и пишем: «нет права», а не пустым списком.
//
// ЧТО ЗДЕСЬ ВИДНО. Имя, дата рождения, способ связи и вопрос — то, что человек
// сам прислал, чтобы ему ответили. Это персональные данные: показываем их
// только тому, у кого есть право, и ничего лишнего рядом не выводим.
// ═══════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var h = React.createElement;

  var СОСТОЯНИЯ = [
    { key: 'novaya',    title: 'Новые' },
    { key: 'v_rabote',  title: 'В работе' },
    { key: 'otvecheno', title: 'Отвечено' }
  ];

  function apiBase() {
    try {
      var el = document.querySelector('meta[name="yasna:api"]');
      return (el && el.getAttribute('content')) || '';
    } catch (_) { return ''; }
  }
  function api(path, opts) {
    var o = opts || {};
    var base = apiBase();
    if (!base) return Promise.reject(new Error('адрес API не задан на странице'));
    var headers = { 'Content-Type': 'application/json' };
    var t = '';
    try { t = localStorage.getItem('yasna_duel_token') || ''; } catch (_) {}
    if (t) headers.Authorization = 'Bearer ' + t;
    /* ЖЁСТКИЙ СРОК. Без него недоступный сервер оставляет экран со словом
       «Загружаю…» навсегда: запрос не падает, он висит. Проверено — шлюз
       бывает недостижим, и вкладка выглядела сломанной без единого слова
       о причине. AbortController поддерживают все браузеры, где живёт
       админка. */
    var стоп = null, срок = null;
    try { стоп = new AbortController(); } catch (_) {}
    if (стоп) срок = setTimeout(function () { стоп.abort(); }, 15000);
    return fetch(base + path, {
      method: o.method || 'GET', headers: headers,
      body: o.body ? JSON.stringify(o.body) : undefined,
      signal: стоп ? стоп.signal : undefined
    }).catch(function (e) {
      if (срок) clearTimeout(срок);
      /* Сообщение браузера наружу не отдаём: «Failed to fetch» человеку
         ничего не говорит и выглядит как чужой текст на русском экране. */
      var что = String((e && e.message) || '');
      throw new Error(
        e && e.name === 'AbortError' ? 'сервер не ответил за 15 секунд'
        : /failed to fetch|networkerror|load failed/i.test(что) ? 'нет связи с сервером'
        : что || 'нет связи с сервером');
    }).then(function (r) {
      if (срок) clearTimeout(срок);
      return r;
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) {
          var e = new Error(d.detail || d.error || ('код ' + r.status));
          e.код = r.status;
          throw e;
        }
        return d;
      });
    });
  }

  function датаСловами(iso) {
    if (!iso) return '';
    var д = new Date(iso);
    if (isNaN(д)) return '';
    var М = ['января','февраля','марта','апреля','мая','июня','июля','августа',
             'сентября','октября','ноября','декабря'];
    return д.getDate() + ' ' + М[д.getMonth()] + ', ' +
           String(д.getHours()).padStart(2, '0') + ':' + String(д.getMinutes()).padStart(2, '0');
  }

  function Zayavka(props) {
    var з = props.з;
    var поле = React.useRef(null);
    var s = React.useState(false), идёт = s[0], занять = s[1];

    function пометить(новое) {
      занять(true);
      props.onПометить(з.id, новое, поле.current ? поле.current.value : '')
        .catch(function () {})
        .then(function () { занять(false); });
    }

    return h('div', { className: 'ad-q', style: { flexDirection: 'column', alignItems: 'stretch', gap: 10 } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' } },
        h('div', { style: { fontWeight: 600, fontSize: 15 } }, з.imya || '—'),
        h('div', { className: 'ad-hdr-meta' }, датаСловами(з.createdAt))
      ),
      h('div', { style: { fontSize: 13, lineHeight: 1.6 } },
        h('div', null, 'Дата рождения: ', з.rozhdenie || '—'),
        h('div', null, 'Связь: ', h('b', null, з.svyaz || '—')),
        з.vopros && h('div', { style: { marginTop: 6 } }, '«' + з.vopros + '»')
      ),
      /* Ответ лежит рядом с заявкой: команда пишет, что ответила, и это видно
         человеку в его профиле. Поле подставляет прежний текст — сервер
         пишет то, что прислали, и пустое поле стёрло бы написанное раньше. */
      h('textarea', {
        ref: поле, defaultValue: з.otvet || '', rows: 2,
        placeholder: 'Что ответили — увидит человек в своём профиле',
        style: { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8,
                 border: '1px solid #d2d2d7', fontFamily: 'inherit', fontSize: 13 }
      }),
      h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
        з.sostoyanie !== 'v_rabote' && h('button', {
          className: 'ad-btn', disabled: идёт, onClick: function () { пометить('v_rabote'); }
        }, 'Взять в работу'),
        h('button', {
          className: 'ad-btn ad-btn-primary', disabled: идёт,
          onClick: function () { пометить('otvecheno'); }
        }, идёт ? 'Сохраняю…' : 'Отвечено'),
        з.sostoyanie !== 'novaya' && h('button', {
          className: 'ad-btn', disabled: идёт, onClick: function () { пометить('novaya'); }
        }, 'Вернуть в новые')
      )
    );
  }

  function ZayavkiTab() {
    var s1 = React.useState('novaya'), состояние = s1[0], выбрать = s1[1];
    var s2 = React.useState([]), список = s2[0], положить = s2[1];
    var s3 = React.useState('загружаю'), как = s3[0], какПоставить = s3[1];

    function перечитать(сост) {
      какПоставить('загружаю');
      api('/zayavki?sostoyanie=' + encodeURIComponent(сост)).then(function (о) {
        положить(о.zayavki || []);
        какПоставить('готово');
      }).catch(function (e) {
        положить([]);
        // Причину называем словами: 403 — это «нет права», а не «пусто».
        какПоставить(e && e.код === 403
          ? 'Нет права на разбор заявок. Нужно cap:zayavki.read — выдаётся во вкладке «Доступы».'
          : 'Не удалось загрузить: ' + ((e && e.message) || 'нет связи'));
      });
    }
    React.useEffect(function () { перечитать(состояние); }, [состояние]);

    function пометить(id, новое, ответ) {
      return api('/zayavki', { method: 'PUT', body: { id: id, sostoyanie: новое, otvet: ответ } })
        .then(function () { перечитать(состояние); });
    }

    return h('div', null,
      h('div', { className: 'ad-tabs', style: { marginBottom: 16 } },
        СОСТОЯНИЯ.map(function (с) {
          return h('button', {
            key: с.key,
            className: 'ad-tab' + (состояние === с.key ? ' is-active' : ''),
            onClick: function () { выбрать(с.key); }
          }, с.title);
        })
      ),
      как === 'загружаю' && h('div', { className: 'ad-empty' }, 'Загружаю…'),
      как !== 'загружаю' && как !== 'готово' && h('div', { className: 'ad-warning' }, как),
      как === 'готово' && !список.length &&
        h('div', { className: 'ad-empty' }, 'Здесь пусто.'),
      как === 'готово' && список.map(function (з) {
        return h(Zayavka, { key: з.id, з: з, onПометить: пометить });
      })
    );
  }

  window.YasnaZayavkiTab = ZayavkiTab;
})();
