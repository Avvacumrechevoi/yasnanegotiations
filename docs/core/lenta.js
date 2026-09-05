/* ═══════════════════════════════════════════════════════════════════════════
   ЛЕНТА УПРАВЛЕНИЙ — клиентский модуль. Экспорт: window.YasnaLenta.

   ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. Записи из открытых каналов управлений показывают два
   экрана: сама лента (lenta.html) и строка-дверь на «Сегодня» («N новых»).
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

  /* ─── Карточка ──────────────────────────────────────────────────────────
     Строение: шапка (эмблема · управление · площадка · время) → заголовок →
     выдержка (+ миниатюра справа) → медиа по типу → низ («Открыть в …»,
     чип типа, «Поделиться», «Ещё»). Тело карточки — одна ссылка в источник;
     кнопки вне ссылки. Долгое нажатие (450 мс) и кнопка «Ещё» шлют событие
     yasna:лента-лист — лист действий рисует экран. */
  function карточка(з, о) {
    о = о || {};
    var пл = площадка(з), тз = заголовокИВыдержка(з), упр = управление(з.upravlenie);
    var вид = видЗаписи(з);
    var когда = время(з.data, о.сейчас);
    var коротко = тз.заг || тз.выд.slice(0, 80) || пл.имя;
    var к = эл('article', { class: 'k k--' + вид, 'data-id': з.id, 'data-upr': упр.id, 'data-tip': вид,
      'aria-label': упр.имя + ', ' + пл.имя + ' ' + подписьКанала(з, true) + ', ' + когда + ': ' + коротко });
    if (о.n != null) к.style.setProperty('--n', String(о.n));

    var т = эл('time', { datetime: з.data, title: полнаяДата(з.data), text: когда });
    /* Два звена: «знак · площадка · @канал» и время. Точку между ними рисует
       экран (::before у времени) — на второй строке она не нужна. Имя канала
       не режется: при нехватке места время переносится, а не обрезает его. */
    var мета = эл('div', { class: 'k-meta' }, [
      эл('span', { class: 'pl' }, [ свг(ЗНАК[пл.знак]), эл('span', { text: пл.имя + ' · ' + подписьКанала(з) }) ]),
      т ]);
    var шапка = эл('div', { class: 'k-shapka' }, [ диск(упр), эл('div', { class: 'k-kto' }, [
      эл('div', { class: 'k-upr', text: упр.имя }), мета,
      з.vedushchij ? эл('div', { class: 'k-vedet', text: 'ведёт ' + з.vedushchij }) : null ]) ]);

    var текст = эл('div', { class: 'k-tekst' }, [
      тз.заг ? эл('h3', { class: 'k-zag', text: тз.заг }) : null,
      тз.выд ? эл('p', { class: 'k-vyd', text: тз.выд }) : null ]);
    var содерж = эл('div', { class: 'k-soderzh' }, [ текст ]);
    var естьМини = !!з.kartinka && (вид === 'foto' || вид === 'ssylka' || вид === 'anons' || вид === 'tekst');
    if (естьМини) {
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
      /* Кадра нет нарочно: условия площадки. Плашка — знак, длительность, имя. */
      телоДети.push(эл('div', { class: 'k-video' }, [
        эл('div', { class: 'kadr bez' }, [ эл('span', { class: 'igrat' }, [ свг(ЗНАК.игра) ]) ]),
        эл('div', {}, [
          эл('b', { text: 'Видео' + (з.dlitelnost_s ? ' · ' + длительность(з.dlitelnost_s) : '') }),
          эл('small', { text: з.istochnik === 'rutube' ? 'Rutube · архив видеотеки' : пл.имя + ' · видео' }) ]) ]));
    }
    if (вид === 'bez') телоДети.push(эл('div', { class: 'k-plashka' }, [ свг(ЗНАК.микро), 'Голосовое, кружок или стикер — открывается в Телеграме' ]));
    if (з.ssylka_v_zapisi) телоДети.push(эл('span', { class: 'k-ssylka' }, [ свг(ЗНАК.наружу), 'ссылка в записи: ' + хост(з.ssylka_v_zapisi) ]));

    var тело = эл('a', { class: 'k-telo', href: з.ssylka, target: '_blank', rel: 'noopener',
      'aria-label': пл.открыть + ': ' + коротко }, телоДети);
    к.appendChild(тело);

    /* Чип типа. «Фото» раскрывает копию побольше внутри карточки — только
       если сервер её дал (лицензия у канала); иначе чип ведёт в источник. */
    var чип = null, фото = null;
    var подписьФото = з.kartinok > 1 ? 'Фото · ' + з.kartinok : 'Фото';
    if (вид === 'foto' && з.kartinka_polnaya) {
      фото = эл('div', { class: 'k-foto' });
      var фИмг = эл('img', { src: з.kartinka_polnaya, alt: '', loading: 'lazy', decoding: 'async' });
      фИмг.addEventListener('error', function () {
        if (фото.parentNode) фото.parentNode.removeChild(фото);
        if (чип && чип.parentNode) чип.parentNode.removeChild(чип);
        к.removeAttribute('data-foto');
      });
      фото.appendChild(фИмг);
      чип = эл('button', { class: 'k-chip', type: 'button', 'aria-expanded': 'false' }, [ свг(ЗНАК.фото), эл('span', { text: подписьФото }) ]);
      чип.addEventListener('click', function () {
        var открыто = к.getAttribute('data-foto') === 'open';
        if (открыто) к.removeAttribute('data-foto'); else к.setAttribute('data-foto', 'open');
        чип.setAttribute('aria-expanded', открыто ? 'false' : 'true');
        чип.lastChild.textContent = открыто ? подписьФото : 'Скрыть';
      });
    } else if (вид === 'foto') {
      чип = эл('a', { class: 'k-chip', href: з.ssylka, target: '_blank', rel: 'noopener' }, [ свг(ЗНАК.фото), эл('span', { text: подписьФото }) ]);
    } else if (вид === 'statya') чип = эл('span', { class: 'k-chip tiho' }, [ свг(ЗНАК.статья), эл('span', { text: 'Статья' }) ]);
    else if (вид === 'anons') чип = эл('span', { class: 'k-chip tiho' }, [ свг(ЗНАК.запись), эл('span', { text: 'Анонс' }) ]);

    var дели = эл('button', { class: 'k-share', type: 'button', 'aria-label': 'Поделиться ссылкой на запись' }, [ свг(ЗНАК.дели) ]);
    дели.addEventListener('click', function (e) {
      e.preventDefault();
      поделиться(з).then(function (как) {
        к.dispatchEvent(new CustomEvent('yasna:лента-поделился', { bubbles: true, detail: { запись: з, как: как } }));
      });
    });
    var ещё = эл('button', { class: 'k-esche', type: 'button', 'aria-label': 'Действия с записью' }, [ свг(ЗНАК.ещё) ]);
    ещё.addEventListener('click', function (e) { e.preventDefault(); лист(к, з); });

    var низ = эл('div', { class: 'k-niz' }, [
      эл('a', { class: 'k-otkryt', href: з.ssylka, target: '_blank', rel: 'noopener' }, [ пл.открыть + ' ', свг(ЗНАК.наружу) ]),
      чип, дели, ещё ]);
    if (фото) к.appendChild(фото);
    к.appendChild(низ);
    долгоеНажатие(к, з);
    return к;
  }

  function лист(узел, з) {
    узел.dispatchEvent(new CustomEvent('yasna:лента-лист', { bubbles: true, detail: { запись: з, узел: узел } }));
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
      лист(к, з);
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

  window.YasnaLenta = {
    страница: страница,
    кэш: кэш,
    запомнить: запомнить,
    свежее: свежее,
    забытьСвежее: function () { свежееПамять = null; },
    увидел: увидел,
    видено: видено,
    карточка: карточка,
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
