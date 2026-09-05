/* ═══════════════════════════════════════════════════════════════════════════
   ЛЕНТА УПРАВЛЕНИЙ — клиентский модуль. Экспорт: window.YasnaLenta.

   ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. Записи из открытых каналов управлений показывают два
   экрана: главный («Лента новостей», app/glavnaya.html) и вся лента с чипами
   управлений (lenta.html) — обе через встроить().
   Одна карточка, один кэш, одно правило времени — иначе экраны разойдутся
   на первой же правке. Здесь нет ни разметки экрана, ни его состояний: только
   сеть, хранилище, карточка и время. Состояния — дело страницы.

   ЧТО ДЕРЖИМ:
     • СЕТЬ — только через YasnaSvyaz.зов (срок, повторы чтения, предохранитель,
       причина словами). Сам модуль к площадкам не ходит: адреса картинок
       приходят в ответе сервера и ставятся из данных.
     • КЭШ первой страницы (yasna_lenta_kesh_v1, ≤40 записей, потолок 96 КБ):
       экран рисуется из него ДО первого запроса и без сети.
     • МЕТКА «ВИДЕЛ» (yasna_lenta_videno_v1) — курсор самой свежей увиденной
       записи; от неё сервер считает «N новых».
     • КАРТОЧКА — DOM-строитель, только textContent: чужой текст никогда не
       попадает в innerHTML. Все внешние ссылки — target=_blank rel=noopener.
     • ВРЕМЯ — в поясе устройства, одно правило (см. время()).

   ЧЕГО НЕТ НАРОЧНО: просмотров, лайков, процентов и счётчиков — ничего
   такого карточка не показывает.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var КЛЮЧ_КЭША = 'yasna_lenta_kesh_v1';
  var КЛЮЧ_ВИДЕНО = 'yasna_lenta_videno_v1';
  var ПАЧКА = 20;                       /* записей за один запрос */
  var КЭШ_ЗАПИСЕЙ = 40;                 /* больше в кэш не кладём */
  var КЭШ_БАЙТ = 96 * 1024;             /* потолок кэша в знаках JSON */
  var СВЕЖЕЕ_ЖИВЁТ = 5 * 60 * 1000;     /* «есть новое» — не чаще раза в 5 минут */
  var СРОК = 12000;                     /* мс на запрос ленты */
  var ДОЛГО = 450;                      /* мс долгого нажатия */
  var СДВИГ = 8;                        /* px: дальше — это прокрутка, а не нажатие */

  var МЕСЯЦЫ = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа',
                'сентября', 'октября', 'ноября', 'декабря'];
  var МЕСЯЦЫ_ИМ = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август',
                   'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  /* Знаки — контуры 24×24, stroke 1.9, как на остальных экранах. */
  var ЗНАК = {
    канал:  'M4 12.5 20 5l-3.2 14L11 15.6zM11 15.6 9.8 19',
    статья: 'M6 4h9l4 4v12H6zM15 4v4h4M9 12h6M9 15.5h6',
    видео:  'M4 7.5h11v9H4zM15 10.5l5-2.5v8l-5-2.5',
    сайт:   'M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17',
    наружу: 'M7 17 17 7M9 7h8v8',
    фото:   'M4 7h3l1.5-2h7L17 7h3v11H4zM12 15.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    микро:  'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6',
    текст:  'M5 7h14M5 12h14M5 17h9',
    дели:   'M16 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 11l6-3M8 13l6 3',
    ещё:    'M5 12h.01M12 12h.01M19 12h.01',
    копия:  'M8 8h12v12H8zM16 8V4H4v12h4',
    игра:   'M7 4l13 8-13 8z',
    запись: 'M4 6.5h16v13H4zM4 10h16M8 4v4M16 4v4',
    жалоба: 'M12 3 2.5 20h19zM12 9.5v4.5M12 17h.01'
  };

  /* Площадка → как её назвать и куда ведёт «Открыть». Неизвестная площадка
     показывается своим именем: ломаться карточка не должна. */
  var ПЛОЩАДКА = {
    telegram: { имя: 'Телеграм',  знак: 'канал',  открыть: 'Открыть в Телеграме' },
    rutube:   { имя: 'Rutube',    знак: 'видео',  открыть: 'Смотреть на Rutube' },
    dzen:     { имя: 'Дзен',      знак: 'статья', открыть: 'Открыть в Дзене' },
    vk:       { имя: 'ВКонтакте', знак: 'сайт',   открыть: 'Открыть во ВКонтакте' }
  };

  /* ─── Хранилище ─────────────────────────────────────────────────────────
     Через реестр YasnaStorage (он же разбирает JSON по описанию ключа);
     без него — напрямую, с тем же молчаливым отказом при переполнении. */
  function взять(ключ, запасное) {
    try {
      if (window.YasnaStorage && window.YasnaStorage.get) return window.YasnaStorage.get(ключ, запасное);
      var сырое = localStorage.getItem(ключ);
      if (сырое == null) return запасное;
      return ключ === КЛЮЧ_КЭША ? JSON.parse(сырое) : сырое;
    } catch (e) { return запасное; }
  }
  function положить(ключ, значение) {
    try {
      if (window.YasnaStorage && window.YasnaStorage.set) return window.YasnaStorage.set(ключ, значение);
      localStorage.setItem(ключ, typeof значение === 'string' ? значение : JSON.stringify(значение));
      return true;
    } catch (e) { return false; }
  }

  /* ─── Помощники разметки ────────────────────────────────────────────────── */
  function эл(тег, атр, дети) {
    var э = document.createElement(тег);
    if (атр) for (var к in атр) if (атр.hasOwnProperty(к) && атр[к] != null && атр[к] !== false) {
      if (к === 'text') э.textContent = атр[к];
      else if (к === 'class') э.className = атр[к];
      else э.setAttribute(к, атр[к]);
    }
    (дети || []).forEach(function (д) {
      if (д == null || д === false) return;
      э.appendChild(typeof д === 'string' ? document.createTextNode(д) : д);
    });
    return э;
  }
  function свг(путь, класс) {
    var NS = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    if (класс) s.setAttribute('class', класс);
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', путь);
    s.appendChild(p);
    if (путь === ЗНАК.сайт) {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '8.5');
      s.appendChild(c);
    }
    if (путь === ЗНАК.игра) p.setAttribute('fill', 'currentColor');
    return s;
  }
  function при(n, один, два, пять) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return пять;
    if (b > 1 && b < 5) return два;
    if (b === 1) return один;
    return пять;
  }
  function чч(n) { return (n < 10 ? '0' : '') + n; }
  function хост(u) {
    try { return new URL(u).host.replace(/^www\./, ''); } catch (e) { return String(u || ''); }
  }

  /* ─── Время: пояс устройства, одно правило на оба экрана ──────────────────
     «только что» → «N мин назад» → «сегодня, 10:53» → «вчера, 14:14» →
     «2 дня назад» (до 6) → «26 июня» → «30 июля 2023». Сутки считаем по
     местному календарю телефона, а не по разности в часах: запись в 23:30
     вчера — это «вчера», даже если прошло полчаса. */
  function началоСуток(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  function время(iso, сейчас) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var n = сейчас ? new Date(сейчас) : new Date();
    var разн = (n.getTime() - d.getTime()) / 1000;
    if (разн < 45) return 'только что';
    if (разн < 3600) return Math.max(1, Math.round(разн / 60)) + ' мин назад';
    var часы = чч(d.getHours()) + ':' + чч(d.getMinutes());
    var дн = Math.round((началоСуток(n) - началоСуток(d)) / 86400000);
    if (дн <= 0) return 'сегодня, ' + часы;
    if (дн === 1) return 'вчера, ' + часы;
    if (дн <= 6) return дн + ' ' + при(дн, 'день', 'дня', 'дней') + ' назад';
    if (d.getFullYear() === n.getFullYear()) return d.getDate() + ' ' + МЕСЯЦЫ[d.getMonth()];
    return d.getDate() + ' ' + МЕСЯЦЫ[d.getMonth()] + ' ' + d.getFullYear();
  }
  function полнаяДата(iso, безВремени) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var с = d.getDate() + ' ' + МЕСЯЦЫ[d.getMonth()] + ' ' + d.getFullYear();
    return безВремени ? с : с + ', ' + чч(d.getHours()) + ':' + чч(d.getMinutes());
  }
  /* Метка месяца между записями: null для текущего месяца, «Июль» в этом
     году, «Апрель 2025» в прошлых. Ключ — чтобы не ставить две подряд. */
  function меткаМесяца(iso, сейчас) {
    var d = new Date(iso), n = сейчас ? new Date(сейчас) : new Date();
    if (isNaN(d.getTime())) return null;
    if (d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()) return { ключ: 'сейчас', текст: null };
    return { ключ: d.getFullYear() + '-' + d.getMonth(),
             текст: МЕСЯЦЫ_ИМ[d.getMonth()] + (d.getFullYear() !== n.getFullYear() ? ' ' + d.getFullYear() : '') };
  }
  function длительность(с) {
    if (!с) return '';
    var м = Math.round(с / 60);
    if (м < 1) return 'меньше минуты';
    return м >= 60 ? Math.floor(м / 60) + ' ч ' + (м % 60) + ' мин' : м + ' мин';
  }

  /* ─── Управления: эмблема и имя из данных центра ──────────────────────────
     Записи общего канала центра помечены «centr»: своей эмблемы у центра нет,
     показываем эмблему Ясна-Школы (её канал) и имя центра. */
  function данныеУправлений() { return (window.YasnaUpravleniya && window.YasnaUpravleniya.upravleniya) || []; }
  function найтиУпр(id) {
    var сп = данныеУправлений();
    for (var i = 0; i < сп.length; i++) if (сп[i].id === id) return сп[i];
    return null;
  }
  function управление(id) {
    var Д = window.YasnaUpravleniya;
    if (id === 'centr') {
      var ш = найтиУпр('yasna-shkola');
      return { id: 'centr', имя: (Д && Д.centr && Д.centr.nazvanie) || 'Центр', эмблема: ш ? ш.emblema : '' };
    }
    var у = найтиУпр(id);
    return { id: id || '', имя: у ? у.nazvanie : String(id || ''), эмблема: у ? у.emblema : '' };
  }
  function диск(упр, класс) {
    var д = эл('span', { class: класс || 'disk' });
    if (упр.эмблема) {
      var img = эл('img', { src: упр.эмблема, alt: '', loading: 'lazy', decoding: 'async' });
      img.addEventListener('error', function () { if (img.parentNode) img.parentNode.removeChild(img); д.textContent = (упр.имя || '?').charAt(0); });
      д.appendChild(img);
    } else д.textContent = (упр.имя || '?').charAt(0);
    return д;
  }

  /* ─── Сеть ──────────────────────────────────────────────────────────────── */
  function безТранспорта() {
    var e = new Error('на этой странице нет транспорта к серверу');
    e.причина = 'нет-адреса';
    return Promise.reject(e);
  }
  function строкаЗапроса(о) {
    var ч = [];
    for (var к in о) if (о.hasOwnProperty(к) && о[к] != null && о[к] !== '')
      ч.push(encodeURIComponent(к) + '=' + encodeURIComponent(String(о[к])));
    return ч.length ? '?' + ч.join('&') : '';
  }
  function нормализовать(о) {
    о = о || {};
    return {
      zapisi: Array.isArray(о.zapisi) ? о.zapisi.filter(function (з) { return з && з.id && з.data; }) : [],
      dalshe: typeof о.dalshe === 'string' && о.dalshe ? о.dalshe : null,
      novyh: typeof о.novyh === 'number' ? о.novyh : null,
      upravleniya_s_zapisyami: Array.isArray(о.upravleniya_s_zapisyami) ? о.upravleniya_s_zapisyami.filter(Boolean) : [],
      sobrano_at: о.sobrano_at || null
    };
  }
  /* страница({kursor, n, upravlenie, tip, otkuda, posle}) → ответ /lenta в
     единой форме. posle нужен только счётчику новых (свежее()); n=0 с ним
     отдаёт лишь число, без записей. */
  function страница(о) {
    о = о || {};
    var С = window.YasnaSvyaz;
    if (!С || !С.зов) return безТранспорта();
    var n = о.n == null ? ПАЧКА : Math.max(0, Math.min(50, Math.floor(Number(о.n)) || 0));
    var путь = '/lenta' + строкаЗапроса({ n: n, kursor: о.kursor, posle: о.posle,
                                          upravlenie: о.upravlenie, tip: о.tip, otkuda: о.otkuda });
    return С.зов(путь, { как: 'GET', срок: СРОК }).then(нормализовать);
  }

  /* ─── Кэш первой страницы ───────────────────────────────────────────────── */
  function кэш() {
    var к = взять(КЛЮЧ_КЭША, null);
    if (!к || typeof к !== 'object' || !Array.isArray(к.zapisi)) return null;
    return {
      zapisi: к.zapisi.filter(function (з) { return з && з.id && з.data; }),
      dalshe: typeof к.dalshe === 'string' && к.dalshe ? к.dalshe : null,
      kogda: к.kogda || null,
      sobrano_at: к.sobrano_at || null,
      upravleniya_s_zapisyami: Array.isArray(к.upravleniya_s_zapisyami) ? к.upravleniya_s_zapisyami : []
    };
  }
  /* В кэш идёт только ПЕРВАЯ страница общей ленты (без фильтров): это то, что
     показывается до запроса. Потолок в знаках — чтобы длинные выдержки не
     вытеснили из localStorage прогресс. */
  function запомнить(ответ) {
    var о = нормализовать(ответ);
    var з = о.zapisi.slice(0, КЭШ_ЗАПИСЕЙ);
    var тело = { v: 1, kogda: new Date().toISOString(), zapisi: з, dalshe: о.dalshe,
                 sobrano_at: о.sobrano_at, upravleniya_s_zapisyami: о.upravleniya_s_zapisyami };
    var ужалось = false;
    while (з.length > 1) {
      var длина = 0;
      try { длина = JSON.stringify(тело).length; } catch (e) { break; }
      if (длина <= КЭШ_БАЙТ) break;
      з.pop(); ужалось = true;
    }
    if (ужалось) тело.dalshe = null;   /* хвост кэша срезан — листать от него нельзя */
    return положить(КЛЮЧ_КЭША, тело);
  }

  /* ─── «Есть новое» ──────────────────────────────────────────────────────── */
  var свежееПамять = null;   /* { когда, ответ } — не чаще раза в 5 минут */
  function увидел(курсор) {
    if (!курсор) return false;
    свежееПамять = null;      /* метка сдвинулась — прежний счёт новых устарел */
    return положить(КЛЮЧ_ВИДЕНО, String(курсор));
  }
  function видено() { var в = взять(КЛЮЧ_ВИДЕНО, ''); return typeof в === 'string' ? в : ''; }
  /* Без сети — из кэша: число записей над увиденной, если она в кэше есть. */
  function свежееИзКэша() {
    var к = кэш(), в = видено();
    var novyh = 0;
    if (к && в) for (var i = 0; i < к.zapisi.length; i++) { if (к.zapisi[i].kursor === в) { novyh = i; break; } }
    return { novyh: novyh, upravleniya_s_zapisyami: к ? к.upravleniya_s_zapisyami : [], sobrano_at: к ? к.sobrano_at : null };
  }
  function свежее() {
    if (свежееПамять && Date.now() - свежееПамять.когда < СВЕЖЕЕ_ЖИВЁТ) return Promise.resolve(свежееПамять.ответ);
    var в = видено();
    return страница({ n: 0, posle: в || null }).then(function (о) {
      var ответ = { novyh: о.novyh == null ? 0 : о.novyh,
                    upravleniya_s_zapisyami: о.upravleniya_s_zapisyami, sobrano_at: о.sobrano_at };
      свежееПамять = { когда: Date.now(), ответ: ответ };
      return ответ;
    }).catch(function () { return свежееИзКэша(); });
  }

  /* ─── Жалоба ────────────────────────────────────────────────────────────── */
  var ПРИЧИНЫ_ЖАЛОБЫ = ['ya_na_foto', 'prava', 'reklama', 'drugoe'];
  function жалоба(id, prichina, tekst, kontakt) {
    var С = window.YasnaSvyaz;
    if (!С || !С.зов) return безТранспорта();
    if (!id || ПРИЧИНЫ_ЖАЛОБЫ.indexOf(prichina) < 0) {
      var e = new Error('не указана причина'); e.причина = 'отказ'; return Promise.reject(e);
    }
    var тело = { id: String(id), prichina: prichina };
    if (tekst) тело.tekst = String(tekst).slice(0, 1000);
    if (kontakt) тело.kontakt = String(kontakt).slice(0, 200);
    /* Секрет устройства транспорт кладёт в X-Device-Secret сам. */
    return С.зов('/lenta/zhaloba', { как: 'POST', тело: тело, срок: СРОК });
  }

  /* ─── Заголовок и выдержка ──────────────────────────────────────────────
     У Телеграма заголовка нет — сервер отдаёт первую строку. Она становится
     заголовком, только если короткая, целая, не приветствие и не хэштег;
     иначе показывается одна выдержка. Строка с премиум-эмодзи вместо букв
     («🔠ажется») заголовком не бывает. */
  function чистыйТекст(т) {
    return String(т || '').replace(/https?:\/\/\S+/g, '').replace(/Please open Telegram[^.]*\.?/i, '')
      .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  }
  function заголовокИВыдержка(з) {
    var т = чистыйТекст(з.tekst), зг = String(з.zagolovok || '').replace(/\s+/g, ' ').trim();
    var безНачала = function (текст, начало) {
      var к = текст.replace(/\s+/g, ' ');
      return к.indexOf(начало) === 0 ? к.slice(начало.length).replace(/^[\s.…:!—–-]+/, '') : текст;
    };
    if (з.istochnik !== 'telegram') return { заг: зг, выд: з.tekst == null ? '' : безНачала(т, зг) };
    /* Ведущие эмодзи и знаки снимаем по-юникодному: \W без флага u считает
       кириллицу «не-словом» и съел бы всю строку — приветствие прошло бы
       заголовком. */
    var первая = зг.replace(/^[^\p{L}\p{N}#]+/u, '');
    var годится = зг.length > 0 && зг.length <= 80 && !/…$/.test(зг) && !/^#/.test(первая)
      && !/^(дорог|здравств|добр|привет|друзья|товарищ)/iu.test(первая)
      && !/[\uD83C-\uDBFF][\uDC00-\uDFFF][а-яё]/.test(зг)
      && зг !== 'Запись в Телеграме' && зг !== 'Фото' && зг !== 'Запись со ссылкой';
    if (годится) return { заг: зг, выд: безНачала(т, зг) };
    return { заг: '', выд: т || зг };
  }
  /* Имя канала; с ведущим — для листа и подписи вслух. В карточке ведущий
     стоит отдельной строкой: в одной строке с временем он обрезался бы до
     «ведё…», а имя источника — часть указания источника, его не режут. */
  function подписьКанала(з, сВедущим) {
    var п = '';
    if (з.istochnik === 'telegram') п = '@' + String(з.kanal || '');
    else п = з.kanal_nazvanie || String(з.kanal || 'канал');
    if (сВедущим && з.vedushchij) п += ' · ведёт ' + з.vedushchij;
    return п;
  }
  function площадка(з) {
    return ПЛОЩАДКА[з.istochnik] || { имя: String(з.istochnik || 'источник'), знак: 'сайт', открыть: 'Открыть запись' };
  }
  function видЗаписи(з) {
    if (з.bez_prevyu) return 'bez';
    var т = String(з.tip || 'tekst');
    return ['foto', 'video', 'statya', 'ssylka', 'anons', 'tekst'].indexOf(т) >= 0 ? т : 'tekst';
  }

  /* ─── Карточка v2 ───────────────────────────────────────────────────────
     Разбор владельца (05.09.2026): прежняя карточка называла площадку дважды
     («Телеграм» в шапке и «Открыть в Телеграме» внизу), дублировала
     «Поделиться» в нижней строке и в меню, несла чип типа, который угадывал
     тип неверно. Теперь: шапка — эмблема · управление · «@канал · время ↗»
     (имя канала — единственное и обязательное указание источника по
     лицензии); заголовок и выдержка с миниатюрой справа; внизу два действия:
     «Поделиться» и «⋯» (открыть в источнике, скопировать ссылку, только это
     управление, страница управления, пожаловаться). Вся карточка — ссылка в
     источник. Долгое нажатие открывает то же меню. */
  function карточка(з, о) {
    о = о || {};
    var пл = площадка(з), тз = заголовокИВыдержка(з), упр = управление(з.upravlenie);
    var вид = видЗаписи(з);
    var когда = время(з.data, о.сейчас);
    var коротко = тз.заг || тз.выд.slice(0, 80) || пл.имя;
    var к = эл('article', { class: 'k k--' + вид, 'data-id': з.id, 'data-upr': упр.id,
      'aria-label': упр.имя + ', ' + подписьКанала(з, true) + ', ' + когда + ': ' + коротко });
    if (о.n != null) к.style.setProperty('--n', String(о.n));

    var мета = эл('div', { class: 'k-meta' }, [
      эл('span', { class: 'kanal', text: подписьКанала(з) }),
      эл('time', { datetime: з.data, title: полнаяДата(з.data), text: когда }),
      эл('span', { class: 'vyhod', 'aria-hidden': 'true' }, [ свг(ЗНАК.наружу) ]) ]);
    var шапка = эл('div', { class: 'k-shapka' }, [ диск(упр), эл('div', { class: 'k-kto' }, [
      эл('div', { class: 'k-upr', text: упр.имя }), мета,
      з.vedushchij ? эл('div', { class: 'k-vedet', text: 'ведёт ' + з.vedushchij }) : null ]) ]);

    var текст = эл('div', { class: 'k-tekst' }, [
      тз.заг ? эл('h3', { class: 'k-zag', text: тз.заг }) : null,
      тз.выд ? эл('p', { class: 'k-vyd', text: тз.выд }) : null ]);
    var содерж = эл('div', { class: 'k-soderzh' }, [ текст ]);
    if (з.kartinka && вид !== 'video') {
      var мини = эл('div', { class: 'k-mini' });
      var мИмг = эл('img', { src: з.kartinka, alt: '', loading: 'lazy', decoding: 'async' });
      /* Битой картинки не бывает: узел уходит вместе с картинкой. */
      мИмг.addEventListener('error', function () { if (мини.parentNode) мини.parentNode.removeChild(мини); });
      мини.appendChild(мИмг);
      if (з.kartinok > 1) мини.appendChild(эл('span', { class: 'n', text: '▣ ' + з.kartinok }));
      содерж.appendChild(мини);
    }
    var телоДети = [ шапка, содерж ];
    if (вид === 'video') {
      /* Кадра нет нарочно: условия площадок. Плашка — знак, длительность. */
      телоДети.push(эл('div', { class: 'k-video' }, [
        эл('div', { class: 'kadr bez' }, [ эл('span', { class: 'igrat' }, [ свг(ЗНАК.игра) ]) ]),
        эл('div', {}, [
          эл('b', { text: 'Видео' + (з.dlitelnost_s ? ' · ' + длительность(з.dlitelnost_s) : '') }),
          эл('small', { text: пл.имя }) ]) ]));
    }
    if (вид === 'bez') телоДети.push(эл('div', { class: 'k-plashka' }, [ свг(ЗНАК.микро), 'Голосовое, кружок или стикер — открывается в Телеграме' ]));
    if (з.ssylka_v_zapisi) телоДети.push(эл('span', { class: 'k-ssylka' }, [ свг(ЗНАК.наружу), 'ссылка в записи: ' + хост(з.ssylka_v_zapisi) ]));

    var тело = эл('a', { class: 'k-telo', href: з.ssylka, target: '_blank', rel: 'noopener',
      'aria-label': пл.открыть + ': ' + коротко }, телоДети);
    к.appendChild(тело);

    var дели = эл('button', { class: 'k-share', type: 'button', 'aria-label': 'Поделиться ссылкой на запись', title: 'Поделиться' }, [ свг(ЗНАК.дели) ]);
    дели.addEventListener('click', function (e) {
      e.preventDefault();
      поделиться(з).then(function (как) { if (как === 'copy') сказать('Ссылка скопирована'); });
    });
    var ещё = эл('button', { class: 'k-esche', type: 'button', 'aria-label': 'Действия с записью', 'aria-haspopup': 'dialog' }, [ свг(ЗНАК.ещё) ]);
    ещё.addEventListener('click', function (e) { e.preventDefault(); лист(з, к); });
    к.appendChild(эл('div', { class: 'k-niz' }, [ дели, ещё ]));
    долгоеНажатие(к, з);
    return к;
  }

  /* ─── Лист действий, жалоба, короткое сообщение ─────────────────────────
     Живут в модуле, а не на экране: ленту показывают два экрана (сама лента
     и главный), и меню карточки у них одно. Узлы создаются по первому зову
     и висят в конце body поверх наббара оболочки. */
  var листУзел = null, скрим = null, снек = null, кудаВернуть = null, снекТаймер = null;
  function узлыЛиста() {
    if (листУзел) return;
    скрим = эл('div', { class: 'scrim' }); скрим.hidden = true;
    листУзел = эл('div', { class: 'list', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Действия с записью', tabindex: '-1' }); листУзел.hidden = true;
    снек = эл('div', { class: 'snek', role: 'status' }); снек.hidden = true;
    document.body.appendChild(скрим); document.body.appendChild(листУзел); document.body.appendChild(снек);
    скрим.addEventListener('click', закрытьЛист);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') закрытьЛист(); });
    /* Системная «назад» в приложении: открыт лист — закрывает его, а не экран. */
    window.addEventListener('yasna:назад', function (e) { if (закрытьЛист()) e.preventDefault(); });
  }
  function очиститьЛист() { while (листУзел.firstChild) листУзел.removeChild(листУзел.firstChild); }
  function закрытьЛист() {
    if (!листУзел || листУзел.hidden) return false;
    листУзел.hidden = true; скрим.hidden = true;
    очиститьЛист();
    if (кудаВернуть && кудаВернуть.focus) { try { кудаВернуть.focus(); } catch (e) {} }
    кудаВернуть = null;
    return true;
  }
  function открытьЛист() { скрим.hidden = false; листУзел.hidden = false; try { листУзел.focus(); } catch (e) {} }
  function пункт(знак, текст, чем, класс) {
    var э = чем === 'button'
      ? эл('button', { class: 'list-p' + (класс ? ' ' + класс : ''), type: 'button' })
      : эл('a', { class: 'list-p', href: чем, target: класс === 'svoj' ? null : '_blank', rel: класс === 'svoj' ? null : 'noopener' });
    э.appendChild(свг(знак)); э.appendChild(эл('span', { text: текст }));
    листУзел.appendChild(э);
    return э;
  }
  /* «Только это управление»: экран ленты перехватывает событие
     yasna:лента-фильтр и меняет чип; главный экран не перехватывает — тогда
     уходим на экран ленты с этим управлением. */
  function лист(з, узел) {
    узлыЛиста();
    кудаВернуть = (узел && узел.querySelector && узел.querySelector('.k-esche')) || узел || null;
    очиститьЛист();
    var пл = площадка(з), тз = заголовокИВыдержка(з), упр = управление(з.upravlenie);
    листУзел.appendChild(эл('div', { class: 'list-ruchka', 'aria-hidden': 'true' }));
    листУзел.appendChild(эл('div', { class: 'list-zag', text: тз.заг || тз.выд.slice(0, 70) || пл.имя }));
    листУзел.appendChild(эл('div', { class: 'list-o', text: упр.имя + ' · ' + подписьКанала(з) + ' · ' + полнаяДата(з.data) }));
    пункт(ЗНАК.наружу, пл.открыть, з.ssylka).addEventListener('click', function () { setTimeout(закрытьЛист, 0); });
    пункт(ЗНАК.копия, 'Скопировать ссылку', 'button').addEventListener('click', function () {
      закрытьЛист();
      скопировать(з.ssylka).then(function (ок) { сказать(ок ? 'Ссылка скопирована' : 'Не удалось скопировать: ' + з.ssylka); });
    });
    if (упр.id && упр.id !== 'centr') {
      пункт(ЗНАК.канал, 'Только «' + упр.имя + '»', 'button').addEventListener('click', function () {
        закрытьЛист();
        var e = new CustomEvent('yasna:лента-фильтр', { bubbles: true, cancelable: true, detail: { upravlenie: упр.id } });
        var перехвачено = !(узел || document.body).dispatchEvent(e);
        if (!перехвачено) location.href = 'lenta.html?upravlenie=' + encodeURIComponent(упр.id) + '&otkuda=lenta';
      });
    }
    пункт(ЗНАК.сайт, 'Страница управления', 'upravleniya.html' + (упр.id && упр.id !== 'centr' ? '#' + упр.id : ''), 'svoj');
    пункт(ЗНАК.жалоба, 'Пожаловаться на запись', 'button', 'zhaloba').addEventListener('click', function () { формаЖалобы(з); });
    открытьЛист();
  }
  /* Жалоба: причина, что не так, как связаться. Уходит в /lenta/zhaloba. */
  function формаЖалобы(з) {
    узлыЛиста();
    очиститьЛист();
    var С = window.YasnaSvyaz, тз = заголовокИВыдержка(з);
    листУзел.appendChild(эл('div', { class: 'list-ruchka', 'aria-hidden': 'true' }));
    листУзел.appendChild(эл('div', { class: 'list-zag', text: 'Пожаловаться на запись' }));
    листУзел.appendChild(эл('div', { class: 'list-o', text: тз.заг || тз.выд.slice(0, 70) || з.ssylka }));
    var форма = эл('form', { class: 'zh-forma', novalidate: '' });
    var набор = эл('fieldset', {}, [ эл('legend', { text: 'Причина' }) ]);
    [['ya_na_foto', 'Я на фото'], ['prava', 'Нарушение прав'], ['reklama', 'Реклама'], ['drugoe', 'Другое']].forEach(function (п, i) {
      var вход = эл('input', { type: 'radio', name: 'prichina', value: п[0] });
      if (i === 0) вход.checked = true;
      набор.appendChild(эл('label', { class: 'pr' }, [ вход, п[1] ]));
    });
    форма.appendChild(набор);
    var текст = эл('textarea', { name: 'tekst', maxlength: '1000', placeholder: 'Что именно не так' });
    var контакт = эл('input', { type: 'text', name: 'kontakt', maxlength: '200', placeholder: 'Почта или телеграм, если нужен ответ', autocomplete: 'off' });
    форма.appendChild(эл('label', { class: 'pole' }, [ 'Что не так (не обязательно)', текст ]));
    форма.appendChild(эл('label', { class: 'pole' }, [ 'Как с вами связаться (не обязательно)', контакт ]));
    var итог = эл('div', { class: 'zh-itog', role: 'status' });
    var отправить = эл('button', { class: 'zh-kn glav', type: 'submit', text: 'Отправить' });
    var отмена = эл('button', { class: 'zh-kn', type: 'button', text: 'Отмена' });
    отмена.addEventListener('click', закрытьЛист);
    форма.appendChild(эл('div', { class: 'zh-knopki' }, [ отмена, отправить ]));
    форма.appendChild(итог);
    форма.addEventListener('submit', function (e) {
      e.preventDefault();
      var выбрано = форма.querySelector('input[name="prichina"]:checked');
      отправить.disabled = true; отправить.textContent = 'Отправляю…'; итог.className = 'zh-itog'; итог.textContent = '';
      жалоба(з.id, выбрано ? выбрано.value : 'drugoe', текст.value.trim(), контакт.value.trim()).then(function (о) {
        очиститьЛист();
        листУзел.appendChild(эл('div', { class: 'list-ruchka', 'aria-hidden': 'true' }));
        листУзел.appendChild(эл('div', { class: 'list-zag', text: 'Спасибо, жалоба принята' }));
        листУзел.appendChild(эл('div', { class: 'zh-itog', text: 'Запись посмотрят и при необходимости уберут в течение ' + срокСловами(о && о.srok) + '.' }));
        var кн = эл('button', { class: 'zh-kn', type: 'button', text: 'Закрыть', style: 'margin:14px 12px 0;width:calc(100% - 24px)' });
        кн.addEventListener('click', закрытьЛист);
        листУзел.appendChild(кн);
      }, function (e) {
        отправить.disabled = false; отправить.textContent = 'Отправить';
        итог.className = 'zh-itog beda';
        итог.textContent = (e && e.код === 429) ? 'Жалоб с этого устройства пока достаточно — попробуйте через час.' : (С && С.словами ? С.словами(e) : 'Не получилось отправить.');
      });
    });
    листУзел.appendChild(форма);
    открытьЛист();
    try { набор.querySelector('input').focus(); } catch (e) {}
  }
  /* Срок из ответа сервера («3 дня») — в родительном падеже после «в течение». */
  function срокСловами(srok) {
    var м = String(srok || '').match(/^(\d+)/), n = м ? Number(м[1]) : 3;
    return ({ 1: 'одного дня', 2: 'двух дней', 3: 'трёх дней', 4: 'четырёх дней', 5: 'пяти дней', 7: 'недели' })[n] || (n + ' дней');
  }
  function сказать(текст) {
    узлыЛиста();
    снек.textContent = текст; снек.hidden = false;
    if (снекТаймер) clearTimeout(снекТаймер);
    снекТаймер = setTimeout(function () { снек.hidden = true; }, 2200);
  }


  /* Долгое нажатие: 450 мс без сдвига больше 8 px. Клик после него гасится,
     чтобы вместе с листом не открылся и источник. contextmenu (то же долгое
     нажатие у Android и правая кнопка на столе) ведёт туда же.
     Гасим НА ВРЕМЯ, а не флагом до следующего клика: лист открывается, пока
     палец ещё прижат, и отпускание приходится уже на затемнение — клик по
     карточке не рождается вовсе, и флаг остался бы взведённым навсегда,
     съев следующее честное нажатие. */
  var подавитьДо = 0, последнийЛист = 0;
  function долгоеНажатие(к, з) {
    var таймер = null, x0 = 0, y0 = 0;
    function открыть() {
      if (Date.now() - последнийЛист < 600) return;
      последнийЛист = Date.now();
      подавитьДо = Date.now() + 700;
      лист(з, к);
    }
    function отмена() { if (таймер) { clearTimeout(таймер); таймер = null; } }
    к.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('button')) return;
      x0 = e.clientX; y0 = e.clientY;
      отмена();
      таймер = setTimeout(function () { таймер = null; открыть(); }, ДОЛГО);
    });
    к.addEventListener('pointermove', function (e) {
      if (таймер && (Math.abs(e.clientX - x0) > СДВИГ || Math.abs(e.clientY - y0) > СДВИГ)) отмена();
    });
    к.addEventListener('pointerup', отмена);
    к.addEventListener('pointercancel', отмена);
    к.addEventListener('pointerleave', отмена);
    к.addEventListener('contextmenu', function (e) {
      if (e.target.closest('button')) return;
      e.preventDefault(); отмена(); открыть();
    });
    к.addEventListener('click', function (e) {
      if (Date.now() < подавитьДо) { e.preventDefault(); e.stopPropagation(); подавитьДо = 0; }
    }, true);
  }

  /* ─── Поделиться и скопировать ─────────────────────────────────────────
     В Android WebView navigator.share нет вовсе — делимся родным плагином
     Capacitor; на сайте — navigator.share; нет ни того ни другого —
     копируем ссылку. Возвращает, что вышло: 'share' | 'copy' | false. */
  function скопировать(текст) {
    if (navigator.clipboard && navigator.clipboard.writeText)
      return navigator.clipboard.writeText(текст).then(function () { return true; }, function () { return скопироватьСтарым(текст); });
    return Promise.resolve(скопироватьСтарым(текст));
  }
  function скопироватьСтарым(текст) {
    try {
      var п = document.createElement('textarea');
      п.value = текст; п.setAttribute('readonly', ''); п.style.position = 'fixed'; п.style.opacity = '0';
      document.body.appendChild(п); п.select();
      var ок = document.execCommand && document.execCommand('copy');
      document.body.removeChild(п);
      return !!ок;
    } catch (e) { return false; }
  }
  function поделиться(з) {
    var тз = заголовокИВыдержка(з), упр = управление(з.upravlenie);
    var что = { title: упр.имя + ' · Ясна', text: (тз.заг || тз.выд.slice(0, 120) || упр.имя), url: з.ssylka };
    var П = (window.Capacitor && window.Capacitor.Plugins) || {};
    var родной = П.Share && П.Share.share;
    if (родной) return Promise.resolve(П.Share.share({ title: что.title, text: что.text, url: что.url, dialogTitle: 'Поделиться записью' }))
      .then(function () { return 'share'; }, function () { return false; });
    if (navigator.share) return navigator.share(что).then(function () { return 'share'; }, function () { return false; });
    return скопировать(з.ssylka).then(function (ок) { return ок ? 'copy' : false; });
  }

  /* ─── Встроенная лента ──────────────────────────────────────────────────
     Одна логика на два экрана: встроить(контейнер, {n, upravlenie, otkuda})
     рисует первую пачку ИЗ КЭША, обновляет с сервера, ставит кнопку
     «Показать ещё» на следующие n записей по курсору (бесконечной прокрутки
     нет — так решил владелец), в конце — честную концовку. Состояния тихие:
     без сети с кэшем — полоса «показываю сохранённое»; без кэша — одна
     строка и «Повторить». Возвращает { обновить, фильтр, состояние }. */
  function встроить(контейнер, н) {
    н = н || {};
    var упр = н.upravlenie || null, N = Math.max(1, Math.min(50, Number(н.n) || ПАЧКА));
    var откуда = н.otkuda || null;
    var корень = эл('div', { class: 'ln-vstroeno' });
    var лента = эл('div', { class: 'lenta', role: 'feed', 'aria-busy': 'false', 'aria-label': 'Записи управлений' });
    var скелет = эл('ul', { class: 'skelet', 'aria-hidden': 'true' }); скелет.hidden = true;
    var полоса = эл('div', { class: 'polosa', role: 'status' }); полоса.hidden = true;
    var тихо = эл('div', { class: 'tiho-sost', role: 'status' }); тихо.hidden = true;
    var кнопка = эл('button', { class: 'esche-kn', type: 'button', text: 'Показать ещё' }); кнопка.hidden = true;
    var концовка = эл('div', { class: 'konec' }); концовка.hidden = true;
    var оСебе = эл('p', { class: 'o-sebe' }); оСебе.hidden = true;
    [лента, скелет, полоса, тихо, кнопка, концовка, оСебе].forEach(function (у) { корень.appendChild(у); });
    while (контейнер.firstChild) контейнер.removeChild(контейнер.firstChild);
    контейнер.appendChild(корень);

    var Т = { записи: [], dalshe: null, гружу: false, заход: 0, sobrano_at: null, управления: [], предМес: null, n: 0, изКэша: false };
    function видим(з) {
      if (!упр) return true;
      var у = Array.isArray(з.upravleniya) && з.upravleniya.length ? з.upravleniya : [з.upravlenie];
      return у.indexOf(упр) >= 0;
    }
    function скелетПоказать(сколько, подпись) {
      while (скелет.firstChild) скелет.removeChild(скелет.firstChild);
      for (var i = 0; i < сколько; i++) скелет.appendChild(эл('li', { class: 'sk' }, [
        эл('div', { class: 'sk-r' }, [ эл('i', { class: 'd' }), эл('div', {}, [ эл('i', { class: 's1' }), эл('i', { class: 's2' }) ]) ]),
        эл('i', { class: 't' }), эл('i', { class: 't t2' }), эл('i', { class: 't3' }) ]));
      if (подпись) скелет.appendChild(эл('li', { class: 'sk-podpis' }, [ эл('span', { class: 'kolco' }), подпись ]));
      скелет.hidden = false; лента.setAttribute('aria-busy', 'true');
    }
    function скелетСкрыть() { скелет.hidden = true; лента.setAttribute('aria-busy', 'false'); }
    function пачка(записи, первая) {
      var узел = эл('div', { class: 'ln-pachka' + (первая ? ' ln-pachka--pervaya' : '') });
      записи.forEach(function (з) {
        var м = меткаМесяца(з.data);
        if (м && м.текст && м.ключ !== Т.предМес) узел.appendChild(эл('div', { class: 'mesyac', role: 'heading', 'aria-level': '3', text: м.текст }));
        if (м) Т.предМес = м.ключ;
        узел.appendChild(карточка(з, { n: первая ? Т.n++ : null }));
      });
      лента.appendChild(узел);
    }
    function очистить() {
      while (лента.firstChild) лента.removeChild(лента.firstChild);
      Т.записи = []; Т.dalshe = null; Т.предМес = null; Т.n = 0; Т.гружу = false;
      полоса.hidden = true; тихо.hidden = true; кнопка.hidden = true; концовка.hidden = true; оСебе.hidden = true;
      кнопка.className = 'esche-kn'; кнопка.textContent = 'Показать ещё';
    }
    function кнопкаПоказать() { кнопка.hidden = !Т.dalshe || Т.гружу; }
    function полосаПоказать(e, когда) {
      var сеть = e && e.причина === 'нет-сети', С = window.YasnaSvyaz;
      while (полоса.firstChild) полоса.removeChild(полоса.firstChild);
      полоса.appendChild(свг(сеть ? 'M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01M3 3l18 18' : 'M12 8v5M12 16h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'));
      полоса.appendChild(эл('div', {}, [ эл('b', { text: сеть ? 'Без сети' : 'Сервер не отвечает' }),
        эл('span', { text: (когда ? 'Показываю сохранённое от ' + полнаяДата(когда) : 'Показываю сохранённое') + (сеть || !С ? '' : ' · ' + С.словами(e)) }) ]));
      var кн = эл('button', { type: 'button', text: сеть ? 'Обновить' : 'Повторить' });
      кн.addEventListener('click', function () { if (С && С.забыть) С.забыть(); первая(); });
      полоса.appendChild(кн);
      полоса.hidden = false;
    }
    function тихоПоказать(текст, сПовтором) {
      while (тихо.firstChild) тихо.removeChild(тихо.firstChild);
      тихо.appendChild(эл('span', { text: текст }));
      if (сПовтором) {
        var кн = эл('button', { type: 'button', text: 'Повторить' });
        кн.addEventListener('click', function () { var С = window.YasnaSvyaz; if (С && С.забыть) С.забыть(); первая(); });
        тихо.appendChild(кн);
      }
      тихо.hidden = false;
    }
    function концовкаПоказать() {
      while (концовка.firstChild) концовка.removeChild(концовка.firstChild);
      var n = Т.записи.length;
      if (!n) { концовка.hidden = true; return; }
      var старая = полнаяДата(Т.записи[n - 1].data, true);
      var лучи = свг('M12 3v3.5', 'luchi');
      концовка.appendChild(лучи);
      концовка.appendChild(эл('b', { text: 'Это все записи' }));
      концовка.appendChild(эл('p', { text: (упр ? 'У этого управления ' : 'В ленте ') + n + ' ' + при(n, 'запись', 'записи', 'записей') + (старая ? ', самая старая — ' + старая : '') + '.' }));
      var все = данныеУправлений(), есть = Т.управления;
      var без = все.filter(function (у) { return есть.indexOf(у.id) < 0; }).map(function (у) { return у.nazvanie; });
      if (!упр && без.length) концовка.appendChild(эл('p', { text: 'Записей в ленте пока нет у: ' + без.join(', ') + '.' }));
      концовка.appendChild(эл('a', { class: 'dver', href: 'upravleniya.html', text: 'Каналы управлений ›' }));
      концовка.appendChild(эл('p', { class: 'prava', text: 'Если вы изображены на фото или запись нарушает ваши права — откройте меню «⋯» у записи и выберите «Пожаловаться на запись». Такие записи убирают в течение трёх дней.' }));
      концовка.hidden = false;
    }
    function оСебеПоказать() {
      if (!Т.sobrano_at) { оСебе.hidden = true; return; }
      оСебе.textContent = 'Записи из открытых каналов управлений; обновлено ' + время(Т.sobrano_at) + '.';
      оСебе.hidden = false;
    }
    function принять(о, первыйЗаход) {
      скелетСкрыть(); полоса.hidden = true; тихо.hidden = true;
      if (!упр && первыйЗаход) запомнить(о);
      Т.управления = о.upravleniya_s_zapisyami.slice();
      Т.sobrano_at = о.sobrano_at || Т.sobrano_at;
      var в = о.zapisi.filter(видим);
      if (первыйЗаход) {
        var было = Т.записи.map(function (з) { return з.id; }).join('|'), стало = в.map(function (з) { return з.id; }).join('|');
        if (!Т.изКэша || было !== стало) { очистить(); Т.записи = в; if (в.length) пачка(в, true); }
        else Т.записи = в;
        Т.изКэша = false;
        if (!упр && о.zapisi.length) увидел(о.zapisi[0].kursor);
      } else {
        Т.записи = Т.записи.concat(в);
        if (в.length) пачка(в, false);
      }
      Т.dalshe = о.dalshe;
      Т.sobrano_at = о.sobrano_at || Т.sobrano_at;
      if (!Т.записи.length && !Т.dalshe) тихоПоказать(упр ? 'У этого управления записей в ленте пока нет.' : 'Записей пока нет: лента наполняется из открытых каналов управлений.', false);
      else if (!Т.записи.length && Т.dalshe) { ещё(); return; }
      кнопкаПоказать();
      if (!Т.dalshe) концовкаПоказать(); else концовка.hidden = true;
      оСебеПоказать();
      корень.dispatchEvent(new CustomEvent('yasna:лента-ответ', { bubbles: true, detail: { ответ: о, upravlenie: упр, первый: первыйЗаход } }));
    }
    function первая() {
      Т.заход++;
      var метка = Т.заход, отк = откуда; откуда = null;
      очистить(); Т.изКэша = false;
      var к = кэш(), изК = к ? к.zapisi.filter(видим) : [];
      if (к) { Т.управления = к.upravleniya_s_zapisyami.slice(); Т.sobrano_at = к.sobrano_at; }
      if (изК.length) { Т.изКэша = true; Т.записи = изК; Т.dalshe = упр ? null : к.dalshe; пачка(изК, true); оСебеПоказать(); }
      else скелетПоказать(3, '');
      страница({ n: N, upravlenie: упр, otkuda: отк }).then(function (о) {
        if (метка !== Т.заход) return;
        принять(о, true);
      }, function (e) {
        if (метка !== Т.заход) return;
        скелетСкрыть();
        if (Т.изКэша) { полосаПоказать(e, к && к.kogda); кнопка.hidden = true; }
        else тихоПоказать(e && e.причина === 'нет-сети' ? 'Нет сети, а сохранённых записей пока нет.' : 'Лента не открылась: ' + (window.YasnaSvyaz ? window.YasnaSvyaz.словами(e) : 'сервер не отвечает') + '.', true);
      });
    }
    function ещё() {
      if (Т.гружу || !Т.dalshe) return;
      Т.гружу = true; кнопка.hidden = true; кнопка.className = 'esche-kn';
      скелетПоказать(2, 'Загружаю ещё…');
      var метка = Т.заход, курсор = Т.dalshe;
      страница({ n: N, kursor: курсор, upravlenie: упр }).then(function (о) {
        if (метка !== Т.заход) return;
        Т.гружу = false; принять(о, false);
      }, function (e) {
        if (метка !== Т.заход) return;
        Т.гружу = false; скелетСкрыть();
        кнопка.className = 'esche-kn beda';
        кнопка.textContent = 'Не загрузилось — повторить';
        кнопка.hidden = false;
      });
    }
    кнопка.addEventListener('click', ещё);
    первая();
    return {
      обновить: первая,
      фильтр: function (id) { упр = id || null; первая(); },
      состояние: Т,
      корень: корень
    };
  }

  window.YasnaLenta = {
    страница: страница,
    кэш: кэш,
    запомнить: запомнить,
    свежее: свежее,
    забытьСвежее: function () { свежееПамять = null; },
    увидел: увидел,
    видено: видено,
    карточка: карточка,
    лист: лист,
    встроить: встроить,
    сказать: сказать,
    закрытьЛист: закрытьЛист,
    время: время,
    полнаяДата: полнаяДата,
    меткаМесяца: меткаМесяца,
    жалоба: жалоба,
    ПРИЧИНЫ_ЖАЛОБЫ: ПРИЧИНЫ_ЖАЛОБЫ,
    поделиться: поделиться,
    скопировать: скопировать,
    управление: управление,
    площадка: площадка,
    подписьКанала: подписьКанала,
    заголовокИВыдержка: заголовокИВыдержка,
    видЗаписи: видЗаписи,
    при: при,
    эл: эл,
    свг: свг,
    диск: диск,
    ЗНАК: ЗНАК,
    ПАЧКА: ПАЧКА
  };
})();
