// ════════════════════════════════════════════════════════════════════
// docs/admin-access.js · вкладка «Доступы» админки Ясны
//
// Экспорт: window.YasnaAccessTab — React-компонент, который docs/admin.js
// рисует при выборе вкладки. Этот файл НЕ трогает логику admin.js и ничего
// не монтирует сам: всё, что нужно дописать в admin.js/admin.html, описано
// в сопроводительной записке к правке.
//
// Четыре подвкладки:
//   Люди    — кому какая роль, какие полномочия, какие персональные доступы
//   Матрица — таблица «роль × возможность», чтобы видеть картину целиком
//   Каталог — что объявили сами разделы (YasnaAccess) против таблицы features
//   Журнал  — последние записи access_audit, ОТКАЗЫ красным
//
// ─── ГЛАВНОЕ ПРО БЕЗОПАСНОСТЬ, ЧТОБЫ НЕ БЫЛО ИЛЛЮЗИЙ ────────────────
// Всё, что здесь нарисовано, — витрина. docs/ раздаётся статикой с публичных
// Pages: любую блокировку в этом файле снимают в DevTools, любой запрос
// повторяют curl'ом. Настоящие проверки живут ТОЛЬКО в server/access.js:
// роль и полномочия читаются из БД по user_id из проверенного JWT, ручка
// выдачи отказывает на ключи cap:/role:/admin:, последнего суперадмина
// понизить нельзя, каждое действие (включая отказ) пишется в access_audit.
//
// Клиентские блокировки ниже нужны ровно для двух вещей:
//   1) человек не должен сделать необратимую ошибку случайно;
//   2) отказ сервера должен быть понятен ДО отправки, а не приходить 403.
// Ни одна из них не является защитой. Если что-то из этого файла считают
// защитой — это ошибка, а не фича.
//
// Токен: Authorization: Bearer <yasna_duel_token>. В URL идентификаторы
// владельцев уходят как query (?owner=usr:…) — так задан контракт ручек;
// секретов в строке запроса нет и быть не должно.
// ════════════════════════════════════════════════════════════════════
;(function(){
'use strict';

var React = window.React;
if(!React){
  console.error('[admin-access] React не загружен — подключи admin-access.js ПОСЛЕ react.production.min.js');
  return;
}
// h — это тот же React.createElement, просто короче: JSX здесь нет и не будет,
// а вызовов создания элементов в файле несколько сотен.
var h = React.createElement;
var useState = React.useState, useEffect = React.useEffect,
    useMemo = React.useMemo, useCallback = React.useCallback, useRef = React.useRef;

// ─── мелкие утилиты ─────────────────────────────────────────────────
function str(v){ return v == null ? '' : String(v); }
function msgOf(e){ return str((e && e.message) || e) || 'неизвестная ошибка'; }
function has(obj, k){ return Object.prototype.hasOwnProperty.call(obj, k); }
function first(){
  for(var i = 0; i < arguments.length; i++){
    if(arguments[i] !== undefined && arguments[i] !== null && arguments[i] !== '') return arguments[i];
  }
  return undefined;
}
// YDB Timestamp приезжает то ISO-строкой, то числом (мс или мкс) — приводим всё.
function toDate(v){
  if(v == null || v === '') return null;
  if(v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var d;
  if(typeof v === 'number'){
    d = new Date(v > 1e14 ? Math.round(v / 1000) : v);
  } else if(/^[0-9]{10,20}$/.test(String(v))){
    var n = Number(v);
    d = new Date(n > 1e14 ? Math.round(n / 1000) : n);
  } else {
    d = new Date(String(v));
  }
  return isNaN(d.getTime()) ? null : d;
}
function fmtTime(v){
  var d = toDate(v);
  if(!d) return v ? str(v).slice(0, 24) : '—';
  return d.toLocaleString('ru');
}
function fmtAgo(v){
  var d = toDate(v);
  if(!d) return '';
  var sec = Math.round((Date.now() - d.getTime()) / 1000);
  if(sec < 0) return 'только что';
  if(sec < 90) return 'только что';
  var min = Math.round(sec / 60);
  if(min < 60) return min + ' мин назад';
  var hr = Math.round(min / 60);
  if(hr < 36) return hr + ' ч назад';
  var day = Math.round(hr / 24);
  if(day < 45) return day + ' дн назад';
  var mon = Math.round(day / 30);
  return mon + ' мес назад';
}
function shortKey(k){
  var s = str(k);
  if(s.length <= 20) return s;
  return s.slice(0, 14) + '…' + s.slice(-4);
}

// ─── стили ──────────────────────────────────────────────────────────
// Свои классы — с префиксом .adx-, чтобы не пересекаться с .ad-* админки;
// .ad-btn / .ad-warning / .ad-info / .ad-tabs переиспользуем как есть.
// Стили кладём из JS, чтобы правка admin.html оставалась в две строки.
var STYLE_ID = 'yasna-access-tab-css';
function injectStyles(){
  if(document.getElementById(STYLE_ID)) return;
  var css = [
    '.adx-status{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border:1px solid #e5e5ea;background:#fff;border-radius:10px;margin-bottom:14px;font-size:13px}',
    '.adx-who{font-weight:600}',
    '.adx-sep{color:#d2d2d7}',
    '.adx-capsline{font-size:11px;color:#86868b;flex-basis:100%;line-height:1.5}',
    '.adx-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#f0f0f2;color:#424245;white-space:nowrap}',
    '.adx-badge.is-super{background:#e6f0ff;color:#0058b8}',
    '.adx-badge.is-admin{background:#fff4e0;color:#8a5a00}',
    '.adx-badge.is-user{background:#f0f0f2;color:#6e6e73}',
    '.adx-badge.is-guest{background:#eef0f5;color:#4a5568}',
    '.adx-badge.is-warn{background:#fdecee;color:#b3000f}',
    '.adx-badge.is-ok{background:#e7f5ea;color:#137333}',
    '.adx-badge.is-soon{background:#f0f0f2;color:#86868b}',
    '.adx-cols{display:grid;grid-template-columns:308px 1fr;gap:18px;align-items:start}',
    '@media(max-width:900px){.adx-cols{grid-template-columns:1fr}}',
    '.adx-panel{background:#fff;border:1px solid #e5e5ea;border-radius:12px;padding:14px}',
    '.adx-list{max-height:520px;overflow-y:auto;margin:10px -6px 0}',
    '.adx-row{display:flex;gap:8px;align-items:center;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:13px}',
    '.adx-row:hover{background:#f5f5f7}',
    '.adx-row.is-active{background:#0071e3;color:#fff}',
    '.adx-row.is-active .adx-sub,.adx-row.is-active .adx-mono{color:rgba(255,255,255,.82)}',
    '.adx-rowmain{flex:1;min-width:0}',
    '.adx-rowmain b{display:block;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.adx-sub{font-size:11px;color:#86868b}',
    '.adx-mono{font-family:"SF Mono",Menlo,monospace;font-size:11px;color:#86868b;word-break:break-all}',
    '.adx-block{border-top:1px solid #e5e5ea;padding-top:14px;margin-top:14px}',
    '.adx-block.is-first{border-top:0;padding-top:0;margin-top:0}',
    '.adx-block h4{margin:0 0 4px;font-size:13px;font-weight:600}',
    '.adx-hint{font-size:11px;color:#86868b;line-height:1.5;margin:0 0 10px}',
    '.adx-tri{display:inline-flex;border:1px solid #d2d2d7;border-radius:8px;overflow:hidden;flex-shrink:0}',
    '.adx-trib{padding:5px 9px;border:0;background:#fff;font-size:11px;cursor:pointer;color:#424245;font-family:inherit;border-right:1px solid #e5e5ea}',
    '.adx-trib:last-child{border-right:0}',
    '.adx-trib.is-on{background:#f0f0f2;color:#1d1d1f;font-weight:700}',
    '.adx-trib.is-open.is-on{background:#137333;color:#fff}',
    '.adx-trib.is-closed.is-on{background:#d70015;color:#fff}',
    '.adx-trib:disabled{opacity:.42;cursor:not-allowed}',
    '.adx-featrow{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #f0f0f2;font-size:12px}',
    '.adx-featrow:last-child{border-bottom:0}',
    '.adx-featname{flex:1;min-width:0}',
    '.adx-featname b{font-weight:500}',
    '.adx-tablewrap{overflow:auto;max-height:70vh;border:1px solid #e5e5ea;border-radius:10px}',
    '.adx-table{border-collapse:separate;border-spacing:0;width:100%;font-size:12px;background:#fff}',
    '.adx-table th,.adx-table td{padding:7px 10px;border-bottom:1px solid #f0f0f2;text-align:left;white-space:nowrap;vertical-align:top}',
    '.adx-table thead th{position:sticky;top:0;background:#f5f5f7;z-index:2;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6e6e73}',
    '.adx-table td.adx-c,.adx-table th.adx-c{text-align:center}',
    '.adx-table td.adx-wrap{white-space:normal;min-width:180px}',
    '.adx-cell{min-width:34px;padding:3px 8px;border:1px solid #e5e5ea;border-radius:6px;background:#fff;cursor:pointer;font-size:12px;font-family:inherit;color:#86868b}',
    '.adx-cell.is-yes{background:#e7f5ea;border-color:#b7dfc2;color:#137333;font-weight:700}',
    '.adx-cell.is-no{background:#fdecee;border-color:#f6c9ce;color:#b3000f;font-weight:700}',
    '.adx-cell:disabled{opacity:.62;cursor:not-allowed}',
    '.adx-err{background:#fdecee;border:1px solid #f5a3ac;color:#8c0010;padding:9px 12px;border-radius:8px;font-size:12px;line-height:1.5;margin-bottom:12px}',
    '.adx-ok{background:#e7f5ea;border:1px solid #a8ddb6;color:#0f5c2a;padding:9px 12px;border-radius:8px;font-size:12px;line-height:1.5;margin-bottom:12px}',
    '.adx-note{font-size:12px;color:#6e6e73;line-height:1.55}',
    '.adx-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}',
    '.adx-in{padding:8px 10px;border:1px solid #d2d2d7;border-radius:8px;font-size:13px;font-family:inherit;background:#fff;color:#1d1d1f;box-sizing:border-box;width:100%}',
    '.adx-in:focus{outline:none;border-color:#0071e3;box-shadow:0 0 0 3px rgba(0,113,227,.15)}',
    '.adx-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.adx-chips{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}',
    '.adx-chip{padding:4px 10px;border:1px solid #d2d2d7;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;font-family:inherit;color:#424245}',
    '.adx-chip.is-on{background:#1d1d1f;color:#fff;border-color:#1d1d1f}',
    '.adx-check{display:flex;gap:8px;align-items:flex-start;font-size:13px;padding:5px 0;cursor:pointer;line-height:1.45}',
    '.adx-check input{margin-top:2px;width:16px;height:16px;flex-shrink:0}',
    '.adx-check.is-locked{opacity:.7;cursor:default}',
    '.adx-audit tr.is-denied td{background:#fdecee;color:#8c0010}',
    '.adx-audit tr.is-error td{background:#fff8e6;color:#5f4a08}',
    '.adx-empty{padding:34px 16px;text-align:center;color:#86868b;font-size:13px;line-height:1.6}',
    '.adx-dim{opacity:.6}',
    '.adx-pill{font-size:10px;padding:1px 6px;border-radius:6px;background:#f0f0f2;color:#6e6e73;margin-left:6px}',
    // ─── тёмная тема: тот же ключ yasna_theme → html[data-theme] ───
    'html[data-theme="dark"] .adx-status,html[data-theme="dark"] .adx-panel{background:#212121;border-color:rgba(255,255,255,.10)}',
    'html[data-theme="dark"] .adx-sep{color:rgba(255,255,255,.20)}',
    'html[data-theme="dark"] .adx-capsline,html[data-theme="dark"] .adx-sub,html[data-theme="dark"] .adx-mono,html[data-theme="dark"] .adx-hint,html[data-theme="dark"] .adx-note,html[data-theme="dark"] .adx-empty{color:#8A95A3}',
    'html[data-theme="dark"] .adx-row:hover{background:rgba(255,255,255,.06)}',
    'html[data-theme="dark"] .adx-row.is-active{background:#0077FF;color:#fff}',
    'html[data-theme="dark"] .adx-block{border-top-color:rgba(255,255,255,.10)}',
    'html[data-theme="dark"] .adx-featrow{border-bottom-color:rgba(255,255,255,.08)}',
    'html[data-theme="dark"] .adx-badge{background:#2C2C2C;color:#A8B1BE}',
    'html[data-theme="dark"] .adx-badge.is-super{background:rgba(0,119,255,.18);color:#8FBFFF}',
    'html[data-theme="dark"] .adx-badge.is-admin{background:rgba(246,198,74,.16);color:#F6C64A}',
    'html[data-theme="dark"] .adx-badge.is-ok{background:rgba(52,199,89,.16);color:#7BE495}',
    'html[data-theme="dark"] .adx-badge.is-warn{background:rgba(255,122,122,.16);color:#FF7A7A}',
    'html[data-theme="dark"] .adx-tablewrap{border-color:rgba(255,255,255,.10)}',
    'html[data-theme="dark"] .adx-table{background:#212121;color:#FEFEFE}',
    'html[data-theme="dark"] .adx-table th,html[data-theme="dark"] .adx-table td{border-bottom-color:rgba(255,255,255,.08)}',
    'html[data-theme="dark"] .adx-table thead th{background:#2C2C2C;color:#8A95A3}',
    'html[data-theme="dark"] .adx-in,html[data-theme="dark"] .adx-chip,html[data-theme="dark"] .adx-trib,html[data-theme="dark"] .adx-cell{background:#262626;border-color:rgba(255,255,255,.14);color:#FEFEFE}',
    'html[data-theme="dark"] .adx-in::placeholder{color:#8A95A3}',
    'html[data-theme="dark"] .adx-tri{border-color:rgba(255,255,255,.14)}',
    'html[data-theme="dark"] .adx-trib{border-right-color:rgba(255,255,255,.10);color:#A8B1BE}',
    'html[data-theme="dark"] .adx-trib.is-on{background:#3C3D40;color:#FEFEFE}',
    'html[data-theme="dark"] .adx-trib.is-open.is-on{background:#137333;color:#fff}',
    'html[data-theme="dark"] .adx-trib.is-closed.is-on{background:#C4000F;color:#fff}',
    'html[data-theme="dark"] .adx-chip.is-on{background:#FEFEFE;color:#151515;border-color:#FEFEFE}',
    'html[data-theme="dark"] .adx-cell.is-yes{background:rgba(52,199,89,.18);border-color:rgba(52,199,89,.4);color:#7BE495}',
    'html[data-theme="dark"] .adx-cell.is-no{background:rgba(255,122,122,.16);border-color:rgba(255,122,122,.4);color:#FF7A7A}',
    'html[data-theme="dark"] .adx-err{background:rgba(255,122,122,.12);border-color:rgba(255,122,122,.45);color:#FF9B9B}',
    'html[data-theme="dark"] .adx-ok{background:rgba(52,199,89,.12);border-color:rgba(52,199,89,.4);color:#7BE495}',
    'html[data-theme="dark"] .adx-audit tr.is-denied td{background:rgba(255,122,122,.14);color:#FF9B9B}',
    'html[data-theme="dark"] .adx-audit tr.is-error td{background:rgba(246,198,74,.12);color:#F6C64A}',
    'html[data-theme="dark"] .adx-pill{background:#2C2C2C;color:#8A95A3}'
  ].join('\n');
  var el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = css;
  document.head.appendChild(el);
}

// ─── словари ────────────────────────────────────────────────────────
// Шесть полномочий ровно в том виде, в каком они лежат в role_grants
// (см. server/migrations/003_access.sql). Слова человеческие: «энтайтлмент»
// и «капабилити» на экран не попадают.
var CAPS = [
  { id:'cap:content.publish', label:'Публиковать контент', about:'менять вопросы и уроки для всех игроков' },
  { id:'cap:access.grant',    label:'Выдавать доступы',    about:'открывать и закрывать разделы конкретным людям' },
  { id:'cap:people.view',     label:'Видеть людей',        about:'список тех, кто заходил, и их доступы' },
  { id:'cap:audit.view',      label:'Видеть журнал',       about:'кто что менял и когда' },
  { id:'cap:catalog.edit',    label:'Править каталог',     about:'публиковать список разделов платформы' },
  { id:'cap:roles.manage',    label:'Управлять ролями',    about:'выдавать роли и менять полномочия ролей' }
];
var CAP_LABEL = {};
CAPS.forEach(function(c){ CAP_LABEL[c.id] = c.label; });

var ROLE_FALLBACK = [
  { id:'user',       title:'Пользователь', rank:0,   isDefault:true },
  { id:'admin',      title:'Админ',        rank:90,  isDefault:false },
  { id:'superadmin', title:'Суперадмин',   rank:100, isDefault:false }
];

var DEFAULT_ACCESS_LABEL = { open:'открыто', account:'нужен вход', closed:'закрыто' };
var ACTION_LABEL = {
  'role.set':'выдал роль', 'role.grants':'изменил полномочия роли',
  'ent.grant':'выдал доступ', 'ent.revoke':'снял доступ',
  'grant':'выдал доступ', 'revoke':'снял доступ',
  'features.publish':'опубликовал каталог', 'catalog.publish':'опубликовал каталог',
  'content.publish':'опубликовал контент', 'denied':'отказ'
};

// Страницы, которые опрашиваются при сборке каталога. admin.html в списке нет
// осознанно: он и есть текущее окно, его объявления читаются напрямую.
var HARVEST_PAGES = [
  { file:'index.html',        title:'Главная' },
  { file:'start.html',        title:'С чего начать' },
  { file:'learn.html',        title:'Курс' },
  { file:'trainers.html',     title:'Тренажёры' },
  { file:'negotiations.html', title:'Переговоры' },
  { file:'duel.html',         title:'Игра' },
  { file:'rating.html',       title:'Рейтинг' }
];

// Ключи, которые НЕЛЬЗЯ выдавать персонально ни при каких условиях. Тот же
// запрет дублирован на сервере и там он и работает; здесь — чтобы такую
// строку невозможно было даже собрать в интерфейсе.
function isForbiddenGrantKey(feature, area){
  var f = str(feature);
  if(/^(cap:|role:|admin:)/.test(f)) return true;
  if(f === 'section:admin') return true;
  if(str(area) === 'admin') return true;
  return false;
}

// ─── сеть ───────────────────────────────────────────────────────────
function apiBase(){
  try {
    var el = document.querySelector('meta[name="yasna:api"]');
    var fromMeta = el ? el.getAttribute('content') : '';
    return str(fromMeta || window.YASNA_LEADERBOARD_API || '').replace(/\/$/, '');
  } catch(_){ return ''; }
}
function getToken(){
  try {
    if(window.YasnaStorage && window.YasnaStorage.get){
      var t = window.YasnaStorage.get('yasna_duel_token', null);
      if(t) return str(t);
    }
  } catch(_){}
  try { return str(localStorage.getItem('yasna_duel_token') || ''); } catch(_){ return ''; }
}
function httpMessage(code, data){
  var serverText = data && (data.error || data.message) ? str(data.error || data.message) : '';
  var need = data && data.need ? (CAP_LABEL[data.need] || str(data.need)) : '';
  if(code === 401) return 'Вход не принят (401). Токен просрочен или чужой — зайди заново через Telegram на duel.html и обнови эту страницу.';
  if(code === 403) return 'Прав не хватает (403)' + (need ? '. Нужно полномочие «' + need + '»' : '') + (serverText ? '. Сервер: ' + serverText : '') + '. Попытка записана в журнал.';
  if(code === 400) return 'Сервер отказался (400): ' + (serverText || 'данные не приняты');
  if(code === 404) return 'Ручка не найдена (404): ' + (serverText || 'сервер ещё не знает этот путь');
  if(code === 409) return 'Конфликт (409): ' + (serverText || 'состояние изменилось, обнови страницу');
  if(code >= 500) return 'Сервер ответил ошибкой (' + code + ')' + (serverText ? ': ' + serverText : '') + '. Данные НЕ сохранены.';
  return 'HTTP ' + code + (serverText ? ': ' + serverText : '');
}
function api(method, path, payload){
  var base = apiBase();
  if(!base){
    return Promise.reject(new Error('Адрес API не настроен: в admin.html нет meta[name="yasna:api"].'));
  }
  var token = getToken();
  if(!token){
    var e0 = new Error('Нет токена входа: открой duel.html, войди через Telegram и вернись сюда.');
    e0.code = 0;
    return Promise.reject(e0);
  }
  var opts = {
    method: method,
    headers: { 'Content-Type':'application/json', 'Accept':'application/json', 'Authorization':'Bearer ' + token }
  };
  if(payload !== undefined && payload !== null) opts.body = JSON.stringify(payload);
  return fetch(base + path, opts).then(function(resp){
    return resp.text().then(function(text){
      var data = null;
      if(text){ try { data = JSON.parse(text); } catch(_){ data = { error: text.slice(0, 300) }; } }
      if(!resp.ok){
        var err = new Error(httpMessage(resp.status, data));
        err.code = resp.status;
        err.body = data;
        throw err;
      }
      return data;
    });
  }, function(netErr){
    // Сетевой сбой и CORS выглядят одинаково — подсказываем оба варианта.
    throw new Error('Запрос не ушёл: ' + msgOf(netErr) + '. Проверь сеть; если админка открыта не с того домена, шлюз режет запрос по CORS.');
  });
}
// Ручки отдают либо массив, либо {items|owners|features|records:[…]}.
function asList(data, keys){
  if(Array.isArray(data)) return data;
  if(data && typeof data === 'object'){
    var names = (keys || []).concat(['items','rows','list','records','data']);
    for(var i = 0; i < names.length; i++){
      if(Array.isArray(data[names[i]])) return data[names[i]];
    }
  }
  return [];
}

// ─── нормализация (сервер может отдать snake_case из YDB или camelCase) ──
function normFeature(row){
  return {
    feature: str(first(row.feature, row.key, row.id)),
    area: str(first(row.area, 'other')),
    parent: first(row.parent, row.parent_feature) || null,
    title: str(first(row.title, row.name, row.feature)),
    kind: str(first(row.kind, 'section')),
    defaultAccess: str(first(row.default_access, row.defaultAccess, 'open')),
    status: str(first(row.status, 'live')),
    sensitive: !!first(row.sensitive, false),
    declaredAt: str(first(row.declared_at, row.declaredAt, '')),
    seenAt: first(row.seen_at, row.seenAt) || null
  };
}
function normRole(row){
  return {
    id: str(first(row.role_id, row.roleId, row.id)),
    title: str(first(row.title, row.role_id, row.roleId, row.id)),
    rank: Number(first(row.rank_level, row.rankLevel, row.rank, 0)) || 0,
    isDefault: !!first(row.is_default, row.isDefault, false)
  };
}
function normRoleGrant(row){
  return {
    roleId: str(first(row.role_id, row.roleId)),
    feature: str(first(row.feature, row.key)),
    granted: row.granted === null || row.granted === undefined ? null : !!row.granted
  };
}
function roleIdOf(row){
  var r = first(row.role, row.role_id, row.roleId);
  if(r && typeof r === 'object') return str(first(r.id, r.role_id, r.roleId));
  return str(r || '');
}
function normOwner(row){
  var userId = str(first(row.userId, row.user_id, ''));
  var ownerKey = str(first(row.ownerKey, row.owner_key, userId ? 'usr:' + userId : ''));
  return {
    ownerKey: ownerKey,
    userId: userId || (ownerKey.indexOf('usr:') === 0 ? ownerKey.slice(4) : ''),
    nickname: str(first(row.nickname, row.nick, row.title, '')),
    avatar: str(first(row.avatar, '')),
    tgUserId: str(first(row.tgUserId, row.tg_user_id, '')),
    lastSeenAt: first(row.lastSeenAt, row.last_seen_at) || null,
    roleId: roleIdOf(row),
    grantsCount: Number(first(row.grants, row.grantsCount, row.grants_count, 0)) || 0
  };
}
function normEnt(row){
  var g = row.granted;
  return {
    feature: str(first(row.feature, row.key)),
    granted: (g === null || g === undefined) ? null : !!g,
    source: str(first(row.source, '')),
    expiresAt: first(row.expiresAt, row.expires_at) || null,
    grantedBy: str(first(row.grantedBy, row.granted_by, ''))
  };
}
function normAudit(row){
  return {
    id: str(first(row.id, '')),
    at: first(row.at, row.created_at) || null,
    actor: str(first(row.actor, '')),
    actorRole: str(first(row.actorRole, row.actor_role, '')),
    action: str(first(row.action, '')),
    target: str(first(row.target, '')),
    feature: str(first(row.feature, '')),
    reason: str(first(row.reason, '')),
    result: str(first(row.result, ''))
  };
}
function isDenied(result){ return result === 'denied' || result === 'forbidden'; }

// ─── дерево возможностей ────────────────────────────────────────────
function buildTree(list){
  var byKey = {}, kids = {}, roots = [], i;
  for(i = 0; i < list.length; i++) byKey[list[i].feature] = list[i];
  for(i = 0; i < list.length; i++){
    var f = list[i];
    var p = (f.parent && f.parent !== f.feature && byKey[f.parent]) ? f.parent : null;
    if(p){ (kids[p] = kids[p] || []).push(f); }
    else roots.push(f);
  }
  function cmp(a, b){ return (a.area + '·' + a.title).localeCompare(b.area + '·' + b.title, 'ru'); }
  var out = [], seen = {};
  function walk(node, depth){
    if(seen[node.feature] || depth > 12) return;   // страховка от циклов parent→parent
    seen[node.feature] = 1;
    out.push({ f: node, depth: depth });
    var ch = (kids[node.feature] || []).slice().sort(cmp);
    for(var j = 0; j < ch.length; j++) walk(ch[j], depth + 1);
  }
  roots.sort(cmp).forEach(function(r){ walk(r, 0); });
  // Узлы в цикле никогда не будут корнем и никогда не будут обойдены —
  // выводим их плоско, чтобы не пропали из интерфейса молча.
  list.forEach(function(f){ if(!seen[f.feature]) out.push({ f: f, depth: 0, orphan: true }); });
  return out;
}

// ─── общие мелкие компоненты ────────────────────────────────────────
function Err(props){
  if(!props.text) return null;
  return h('div', { className:'adx-err' }, '⚠ ', props.text);
}
function Ok(props){
  if(!props.text) return null;
  return h('div', { className:'adx-ok' }, '✓ ', props.text);
}
function RoleBadge(props){
  var id = str(props.roleId);
  var roles = props.roles || ROLE_FALLBACK;
  var found = null;
  roles.forEach(function(r){ if(r.id === id) found = r; });
  if(props.guest) return h('span', { className:'adx-badge is-guest' }, 'Гостевое устройство');
  if(!id){
    var def = null;
    roles.forEach(function(r){ if(r.isDefault) def = r; });
    return h('span', { className:'adx-badge is-user', title:'Своей строки нет — действует роль по умолчанию' },
      (def ? def.title : 'Пользователь'));
  }
  var cls = id === 'superadmin' ? ' is-super' : (id === 'admin' ? ' is-admin' : ' is-user');
  return h('span', { className:'adx-badge' + cls }, found ? found.title : id);
}
// Трёхпозиционный переключатель: наследовать (нет строки) · открыть · закрыть.
function Tri(props){
  var opts = [
    { v:null,  label:'наследовать', cls:'' },
    { v:true,  label:'открыть',     cls:' is-open' },
    { v:false, label:'закрыть',     cls:' is-closed' }
  ];
  return h('div', { className:'adx-tri' }, opts.map(function(o){
    var on = props.value === o.v;
    var noOpen = (o.v === true && props.canOpen === false);
    var blocked = props.disabled || noOpen;
    return h('button', {
      key: String(o.v),
      type:'button',
      className:'adx-trib' + o.cls + (on ? ' is-on' : ''),
      disabled: blocked && !on,
      title: noOpen ? 'Нельзя открыть то, что не открыто вам самому' : undefined,
      onClick: function(){ if(!blocked && !on) props.onChange(o.v); }
    }, o.label);
  }));
}
function FeatureTitle(props){
  var f = props.f;
  return h('div', { className:'adx-featname', style:{ paddingLeft: (props.depth || 0) * 14 } },
    h('b', null, f.title),
    f.status === 'wip' && h('span', { className:'adx-badge is-soon', style:{ marginLeft:6 } }, 'Скоро'),
    f.sensitive
      ? h('span', { className:'adx-pill', title:'Закрытие реально проверяется сервером' }, 'серверное')
      : h('span', { className:'adx-pill', title:'Клиентский гейт: снимается в DevTools, продавать этим нельзя' }, 'витрина'),
    h('div', { className:'adx-mono' }, f.feature,
      f.defaultAccess ? ' · по умолчанию: ' + (DEFAULT_ACCESS_LABEL[f.defaultAccess] || f.defaultAccess) : '')
  );
}

// ─────────────────────────────────────────────────────────────────────
// ЛЮДИ
// ─────────────────────────────────────────────────────────────────────
function PeopleView(props){
  var caps = props.caps || {};
  var canView = !!caps['cap:people.view'] || props.isSuper;

  var [query, setQuery] = useState('');
  var [roleFilter, setRoleFilter] = useState('');
  var [owners, setOwners] = useState([]);
  var [listErr, setListErr] = useState('');
  var [listBusy, setListBusy] = useState(false);
  var [selected, setSelected] = useState('');
  var [guestInput, setGuestInput] = useState('');
  var [guestErr, setGuestErr] = useState('');

  // Поиск с задержкой: набор «ник» не должен выдавать шесть запросов.
  var qRef = useRef(query);
  qRef.current = query;
  useEffect(function(){
    var alive = true;
    var timer = setTimeout(function(){
      setListBusy(true); setListErr('');
      var path = '/access/owners?limit=100' +
        (qRef.current.trim() ? '&q=' + encodeURIComponent(qRef.current.trim()) : '') +
        (roleFilter ? '&role=' + encodeURIComponent(roleFilter) : '');
      api('GET', path).then(function(data){
        if(!alive) return;
        setOwners(asList(data, ['owners','people']).map(normOwner).filter(function(o){ return !!o.ownerKey; }));
        setListBusy(false);
      }, function(e){
        if(!alive) return;
        setListErr(msgOf(e)); setOwners([]); setListBusy(false);
      });
    }, query ? 350 : 0);
    return function(){ alive = false; clearTimeout(timer); };
  }, [query, roleFilter, props.tick]);

  function openGuest(){
    var raw = guestInput.trim();
    if(!raw){ setGuestErr('Впиши идентификатор устройства'); return; }
    var key = raw.indexOf('dev:') === 0 ? raw : 'dev:' + raw;
    if(!/^dev:[A-Za-z0-9._:-]{4,150}$/.test(key)){
      setGuestErr('Не похоже на идентификатор устройства. Ожидается dev:<device_id> — например dev:' + '3f2b…');
      return;
    }
    setGuestErr(''); setSelected(key);
  }

  var chips = [
    { v:'', label:'Все' },
    { v:'admin', label:'Админы' },
    { v:'superadmin', label:'Суперадмины' }
  ];

  return h('div', { className:'adx-cols' },
    // ─── слева: поиск и список ───
    h('div', { className:'adx-panel' },
      h('h4', { style:{ margin:'0 0 8px', fontSize:13 } }, 'Кого ищем'),
      h('input', {
        className:'adx-in', type:'search', value: query,
        placeholder:'ник, user_id или telegram id',
        onChange: function(e){ setQuery(e.target.value); }
      }),
      h('div', { className:'adx-chips' }, chips.map(function(c){
        return h('button', {
          key: c.v || 'all', type:'button',
          className:'adx-chip' + (roleFilter === c.v ? ' is-on' : ''),
          onClick: function(){ setRoleFilter(c.v); }
        }, c.label);
      })),

      !canView && h('div', { className:'ad-warning', style:{ marginTop:12 } },
        'У вашей роли нет полномочия «Видеть людей» — список, скорее всего, вернёт отказ.'),
      listErr ? h(Err, { text: listErr }) : null,
      listBusy && h('div', { className:'adx-note', style:{ marginTop:10 } }, 'Ищу…'),

      h('div', { className:'adx-list' },
        !listBusy && !listErr && owners.length === 0 && h('div', { className:'adx-empty' },
          query ? 'Никого не нашлось' : 'Список пуст'),
        owners.map(function(o){
          return h('div', {
            key: o.ownerKey,
            className:'adx-row' + (selected === o.ownerKey ? ' is-active' : ''),
            onClick: function(){ setSelected(o.ownerKey); }
          },
            h('div', { className:'adx-rowmain' },
              h('b', null, o.nickname || '(без ника)'),
              h('div', { className:'adx-mono' }, shortKey(o.ownerKey)),
              h('div', { className:'adx-sub' },
                (o.lastSeenAt ? fmtAgo(o.lastSeenAt) : 'когда заходил — неизвестно'),
                o.grantsCount ? ' · исключений: ' + o.grantsCount : ''
              )
            ),
            h(RoleBadge, { roleId: o.roleId, roles: props.roles })
          );
        })
      ),

      h('div', { className:'adx-block' },
        h('h4', null, 'Гостевое устройство'),
        h('p', { className:'adx-hint' },
          'У гостя роли нет — только персональные доступы. Идентификатор виден в самом браузере гостя: ',
          h('span', { className:'adx-mono' }, 'localStorage.yasna_device_id_v1'), '.'),
        h('div', { className:'adx-inline' },
          h('input', {
            className:'adx-in', style:{ flex:1, minWidth:150 }, value: guestInput,
            placeholder:'dev:1a2b3c…',
            onChange: function(e){ setGuestInput(e.target.value); },
            onKeyDown: function(e){ if(e.key === 'Enter') openGuest(); }
          }),
          h('button', { className:'ad-btn', type:'button', onClick: openGuest }, 'Открыть')
        ),
        guestErr ? h('div', { className:'adx-err', style:{ marginTop:10 } }, guestErr) : null
      )
    ),

    // ─── справа: карточка ───
    h('div', { className:'adx-panel' },
      selected
        ? h(OwnerCard, {
            key: selected,
            ownerKey: selected,
            catalog: props.catalog,
            roles: props.roles,
            caps: caps,
            isSuper: props.isSuper,
            myRoleId: props.myRoleId,
            myUserId: props.myUserId,
            superCount: props.superCount,
            tick: props.tick,
            onChanged: props.onChanged
          })
        : h('div', { className:'adx-empty' },
            'Выбери человека слева — или открой гостевое устройство по dev:<id>.',
            h('br'),
            'Роль и полномочия видны только у аккаунтов, персональные доступы — у всех.')
    )
  );
}

// ─── карточка владельца ─────────────────────────────────────────────
function OwnerCard(props){
  var ownerKey = props.ownerKey;
  var isGuest = ownerKey.indexOf('dev:') === 0;
  var catalog = props.catalog || { features:[], roles:[], roleGrants:[] };
  var roles = props.roles && props.roles.length ? props.roles : ROLE_FALLBACK;
  var caps = props.caps || {};

  var [detail, setDetail] = useState(null);
  var [loadErr, setLoadErr] = useState('');
  var [busy, setBusy] = useState(false);
  var [reason, setReason] = useState('');
  var [okText, setOkText] = useState('');
  var [err, setErr] = useState('');

  var [roleDraft, setRoleDraft] = useState('');
  var [capDraft, setCapDraft] = useState(null);      // { 'cap:x': bool }
  var [entDraft, setEntDraft] = useState({});        // { feature: true|false|null }
  var [showAll, setShowAll] = useState(false);
  var [featQuery, setFeatQuery] = useState('');
  var [tail, setTail] = useState(null);
  var [tailNote, setTailNote] = useState('');

  var reload = useCallback(function(){
    setLoadErr(''); setDetail(null);
    var q = '?owner=' + encodeURIComponent(ownerKey);
    api('GET', '/access/owner' + q).catch(function(e){
      // Разводка могла оказаться на другом пути — пробуем второй вариант,
      // но НЕ подменяем ошибку пустыми данными: пустой ответ здесь означал бы
      // «исключений нет», а это ложь, из которой рождаются лишние выдачи.
      if(e.code !== 404) throw e;
      return api('GET', '/access/grants' + q);
    }).then(function(data){
      var d = data || {};
      var ents = asList(d.grants || d.entitlements || d.ents || d, ['grants','entitlements']).map(normEnt)
        .filter(function(x){ return !!x.feature; });
      setDetail({
        ownerKey: str(first(d.ownerKey, d.owner_key, ownerKey)),
        userId: str(first(d.userId, d.user_id, ownerKey.indexOf('usr:') === 0 ? ownerKey.slice(4) : '')),
        nickname: str(first(d.nickname, d.nick, '')),
        roleId: roleIdOf(d),
        lastSeenAt: first(d.lastSeenAt, d.last_seen_at) || null,
        ents: ents,
        audit: asList(d.audit || [], ['audit']).map(normAudit)
      });
    }, function(e){ setLoadErr(msgOf(e)); });
  }, [ownerKey]);

  useEffect(function(){ reload(); }, [reload, props.tick]);

  // Черновики сбрасываем на каждую загрузку карточки — иначе галочка,
  // поставленная одному человеку, «переезжает» на следующего выбранного.
  useEffect(function(){
    if(!detail) return;
    setRoleDraft(detail.roleId || defaultRoleId(roles));
    setEntDraft({});
    setCapDraft(null);
    setErr('');
    // okText НЕ трогаем: reload() после сохранения меняет detail, и подтверждение
    // «Роль сохранена» гасло бы через миг после появления. Карточка всё равно
    // размонтируется при выборе другого человека (key=ownerKey).
  }, [detail]);

  // Хвост журнала по этому владельцу: если полномочия «Видеть журнал» нет —
  // это не ошибка, а нормальная ситуация, показываем спокойной подписью.
  useEffect(function(){
    if(!detail) return;
    if(detail.audit && detail.audit.length){ setTail(detail.audit.slice(0, 5)); setTailNote(''); return; }
    var alive = true;
    api('GET', '/access/audit?limit=5&target=' + encodeURIComponent(ownerKey)).then(function(data){
      if(!alive) return;
      setTail(asList(data, ['records','audit']).map(normAudit)); setTailNote('');
    }, function(e){
      if(!alive) return;
      setTail([]);
      setTailNote(e.code === 403
        ? 'Журнал по этому человеку не показан: у вашей роли нет полномочия «Видеть журнал».'
        : msgOf(e));
    });
    return function(){ alive = false; };
  }, [detail, ownerKey]);

  function defaultRoleId(list){
    var d = '';
    (list || []).forEach(function(r){ if(r.isDefault) d = r.id; });
    return d || 'user';
  }
  function roleById(id){
    var found = null;
    roles.forEach(function(r){ if(r.id === id) found = r; });
    return found;
  }
  var superRole = useMemo(function(){
    var byId = null, byRank = null;
    roles.forEach(function(r){
      if(r.id === 'superadmin') byId = r;
      if(!byRank || r.rank > byRank.rank) byRank = r;
    });
    return byId || byRank;
  }, [roles]);

  // Что открыто мне самому — чтобы не предлагать выдать больше, чем имею.
  // Сервер проверяет это же условие; здесь оно живёт только ради подсказки.
  var myOpen = useMemo(function(){
    if(props.isSuper) return null;                 // null = «всё»
    var set = {};
    (catalog.roleGrants || []).forEach(function(g){
      if(g.roleId === props.myRoleId && g.granted === true) set[g.feature] = 1;
    });
    return set;
  }, [catalog.roleGrants, props.myRoleId, props.isSuper]);
  function canIOpen(feature){
    if(!myOpen) return true;
    if(myOpen[feature]) return true;
    // маски вида game:partiya:* — открыто, если моя маска накрывает ключ
    var keys = Object.keys(myOpen), i;
    for(i = 0; i < keys.length; i++){
      var k = keys[i];
      if(k.charAt(k.length - 1) === '*' && feature.indexOf(k.slice(0, -1)) === 0) return true;
    }
    return false;
  }

  var entMap = useMemo(function(){
    var m = {};
    ((detail && detail.ents) || []).forEach(function(e){ m[e.feature] = e; });
    return m;
  }, [detail]);

  function entValue(feature){
    if(has(entDraft, feature)) return entDraft[feature];
    var row = entMap[feature];
    return row ? row.granted : null;
  }

  // Возможности, которые вообще можно выдавать персонально.
  var grantable = useMemo(function(){
    return (catalog.features || []).filter(function(f){
      return f.kind !== 'cap' && !isForbiddenGrantKey(f.feature, f.area);
    });
  }, [catalog.features]);

  var tree = useMemo(function(){ return buildTree(grantable); }, [grantable]);
  var visibleTree = useMemo(function(){
    var q = featQuery.trim().toLowerCase();
    return tree.filter(function(node){
      var f = node.f;
      if(q && f.title.toLowerCase().indexOf(q) < 0 && f.feature.toLowerCase().indexOf(q) < 0) return false;
      if(showAll || q) return true;
      // по умолчанию — только то, где есть своя строка или незасохранённая правка
      return has(entDraft, f.feature) || !!entMap[f.feature];
    });
  }, [tree, featQuery, showAll, entDraft, entMap]);

  var pendingEnts = useMemo(function(){
    var out = [];
    Object.keys(entDraft).forEach(function(feature){
      var was = entMap[feature] ? entMap[feature].granted : null;
      if(entDraft[feature] !== was) out.push({ feature: feature, granted: entDraft[feature] });
    });
    return out;
  }, [entDraft, entMap]);

  var currentRoleId = detail ? (detail.roleId || defaultRoleId(roles)) : '';
  var roleChanged = !!detail && !isGuest && roleDraft !== currentRoleId;
  // Понижение суперадмина. Если счётчик не загрузился — тоже блокируем: «не знаю,
  // сколько их осталось» не повод рискнуть остаться без единственного, кто может
  // выдавать роли. Сервер проверяет это же по индексу user_roles_by_role.
  var superCountKnown = typeof props.superCount === 'number';
  var demotingSuper = !!superRole && currentRoleId === superRole.id && roleDraft !== superRole.id;
  var blockDemote = demotingSuper && (!superCountKnown || props.superCount <= 1);
  var demoteWhy = !superCountKnown
    ? 'Счётчик суперадминов не загрузился — понижение заблокировано, пока неизвестно, сколько их осталось.'
    : 'Это последний суперадмин. Понизить его нельзя: платформа останется без того, кто может выдавать роли. Сначала выдай роль суперадмина второму человеку.';

  var capsOfRole = useMemo(function(){
    var m = {};
    (catalog.roleGrants || []).forEach(function(g){
      if(g.roleId === roleDraft && g.feature.indexOf('cap:') === 0) m[g.feature] = g.granted === true;
    });
    return m;
  }, [catalog.roleGrants, roleDraft]);
  var capsView = capDraft || capsOfRole;
  var capsChanged = !!capDraft && CAPS.some(function(c){ return !!capsView[c.id] !== !!capsOfRole[c.id]; });

  var needReason = !reason.trim();
  var canGrant = !!caps['cap:access.grant'] || props.isSuper;
  var canRole = props.isSuper;                    // роли выдаёт только суперадмин
  var canCaps = props.isSuper;

  function run(promise, okMsg){
    setBusy(true); setErr(''); setOkText('');
    promise.then(function(){
      setBusy(false); setOkText(okMsg);
      reload();
      if(props.onChanged) props.onChanged();
    }, function(e){
      setBusy(false); setErr(msgOf(e));
    });
  }

  function saveRole(){
    if(!detail || !detail.userId){ setErr('Не знаю user_id этого аккаунта — роль выдавать некому.'); return; }
    run(api('POST', '/access/role', {
      userId: detail.userId, roleId: roleDraft, note:'', reason: reason.trim()
    }), 'Роль сохранена: ' + ((roleById(roleDraft) || {}).title || roleDraft));
  }
  function saveCaps(){
    var grants = CAPS.filter(function(c){ return !!capsView[c.id] !== !!capsOfRole[c.id]; })
      .map(function(c){ return { feature: c.id, granted: !!capsView[c.id] }; });
    if(!grants.length){ setErr('Нечего сохранять.'); return; }
    run(api('POST', '/access/role-grants', {
      roleId: roleDraft, grants: grants, reason: reason.trim()
    }), 'Полномочия роли «' + ((roleById(roleDraft) || {}).title || roleDraft) + '» обновлены');
  }
  function saveEnts(){
    var bad = pendingEnts.filter(function(g){
      var f = null;
      (catalog.features || []).forEach(function(x){ if(x.feature === g.feature) f = x; });
      return isForbiddenGrantKey(g.feature, f && f.area);
    });
    if(bad.length){
      setErr('Через доступы нельзя выдавать полномочия и админку (' + bad[0].feature + '). Это делается ролью.');
      return;
    }
    // Ручка принимает не больше 50 строк за раз — режем на куски сами,
    // иначе большая правка молча упрётся в 400.
    var chunks = [], i;
    for(i = 0; i < pendingEnts.length; i += 50) chunks.push(pendingEnts.slice(i, i + 50));
    var chain = Promise.resolve();
    chunks.forEach(function(part){
      chain = chain.then(function(){
        return api('POST', '/access/grant', {
          owner: ownerKey,
          grants: part.map(function(g){
            return { feature: g.feature, granted: g.granted, source:'manual', expiresAt: null };
          }),
          reason: reason.trim()
        });
      });
    });
    run(chain, 'Доступы сохранены: ' + pendingEnts.length + ' строк');
  }

  if(loadErr){
    return h('div', null,
      h(Err, { text: loadErr }),
      h('button', { className:'ad-btn', type:'button', onClick: reload }, 'Повторить')
    );
  }
  if(!detail) return h('div', { className:'adx-empty' }, 'Загружаю карточку…');

  return h('div', null,
    // ─── шапка карточки ───
    h('div', { className:'adx-block is-first' },
      h('div', { className:'adx-inline', style:{ justifyContent:'space-between' } },
        h('div', null,
          h('div', { style:{ fontSize:16, fontWeight:600 } }, detail.nickname || (isGuest ? 'Гостевое устройство' : '(без ника)'),
            (!isGuest && detail.userId && detail.userId === props.myUserId)
              ? h('span', { className:'adx-pill', title:'Это ваша собственная карточка' }, 'это вы')
              : null),
          h('div', { className:'adx-mono' }, ownerKey),
          detail.lastSeenAt && h('div', { className:'adx-sub' }, 'заходил ', fmtAgo(detail.lastSeenAt))
        ),
        h(RoleBadge, { roleId: detail.roleId, roles: roles, guest: isGuest })
      )
    ),

    err ? h(Err, { text: err }) : null,
    okText ? h(Ok, { text: okText }) : null,

    // ─── роль ───
    !isGuest && h('div', { className:'adx-block' },
      h('h4', null, 'Роль'),
      h('p', { className:'adx-hint' },
        'Роль определяет, что человеку открыто по умолчанию, и что он может делать в админке. ',
        'Меняет её только суперадмин.'),
      roles.slice().sort(function(a, b){ return a.rank - b.rank; }).map(function(r){
        return h('label', {
          key: r.id,
          className:'adx-check' + (canRole ? '' : ' is-locked')
        },
          h('input', {
            type:'radio', name:'adx-role-' + ownerKey,
            checked: roleDraft === r.id, disabled: !canRole,
            onChange: function(){ setRoleDraft(r.id); }
          }),
          h('span', null, r.title,
            r.isDefault ? h('span', { className:'adx-pill' }, 'по умолчанию') : null)
        );
      }),
      !canRole && h('p', { className:'adx-hint' }, 'Роли выдаёт только суперадмин — поля заблокированы.'),
      blockDemote && h('div', { className:'ad-warning' }, demoteWhy),
      h('div', { className:'adx-actions' },
        h('button', {
          className:'ad-btn ad-btn-primary', type:'button',
          disabled: busy || !roleChanged || !canRole || needReason || blockDemote,
          title: blockDemote ? demoteWhy : (needReason ? 'Впиши причину — она уйдёт в журнал' : undefined),
          onClick: saveRole
        }, busy ? 'Сохраняю…' : 'Сохранить роль'),
        roleChanged && h('button', {
          className:'ad-btn', type:'button', onClick: function(){ setRoleDraft(currentRoleId); }
        }, 'Вернуть'),
        blockDemote
          ? h('span', { className:'adx-sub' },
              superCountKnown ? 'останется 0 суперадминов' : 'сколько суперадминов — неизвестно')
          : (needReason && roleChanged ? h('span', { className:'adx-sub' }, 'нужна причина') : null)
      )
    ),

    // ─── полномочия (галочки роли) ───
    !isGuest && roleDraft !== defaultRoleId(roles) && h('div', { className:'adx-block' },
      h('h4', null, 'Полномочия'),
      h('p', { className:'adx-hint' },
        'Это галочки РОЛИ «', ((roleById(roleDraft) || {}).title || roleDraft), '», а не одного человека: ',
        'они подействуют на всех, у кого эта роль.',
        roleChanged ? ' Роль этому человеку ещё не сохранена — галочки ниже относятся к выбранной роли, не к текущей.' : ''),
      superRole && roleDraft === superRole.id
        ? h('div', null,
            CAPS.map(function(c){
              return h('label', { key: c.id, className:'adx-check is-locked' },
                h('input', { type:'checkbox', checked: true, disabled: true, readOnly: true }),
                h('span', null, c.label, h('span', { className:'adx-sub' }, ' — ', c.about))
              );
            }),
            h('p', { className:'adx-hint' }, 'У суперадмина открыто всё, снять галочку нельзя.')
          )
        : h('div', null,
            CAPS.map(function(c){
              return h('label', { key: c.id, className:'adx-check' + (canCaps ? '' : ' is-locked') },
                h('input', {
                  type:'checkbox', checked: !!capsView[c.id], disabled: !canCaps,
                  onChange: function(e){
                    var next = {};
                    CAPS.forEach(function(x){ next[x.id] = !!capsView[x.id]; });
                    next[c.id] = e.target.checked;
                    setCapDraft(next);
                  }
                }),
                h('span', null, c.label, h('span', { className:'adx-sub' }, ' — ', c.about))
              );
            }),
            !canCaps && h('p', { className:'adx-hint' }, 'Менять полномочия ролей может только суперадмин.'),
            h('div', { className:'adx-actions' },
              h('button', {
                className:'ad-btn ad-btn-primary', type:'button',
                disabled: busy || !capsChanged || !canCaps || needReason,
                title: needReason ? 'Впиши причину — она уйдёт в журнал' : undefined,
                onClick: saveCaps
              }, busy ? 'Сохраняю…' : 'Сохранить полномочия'),
              capsChanged && h('button', {
                className:'ad-btn', type:'button', onClick: function(){ setCapDraft(null); }
              }, 'Вернуть'),
              needReason && capsChanged
                ? h('span', { className:'adx-sub' }, 'нужна причина — поле ниже')
                : null
            )
          )
    ),

    // ─── персональные доступы ───
    h('div', { className:'adx-block' },
      h('h4', null, 'Доступы'),
      h('p', { className:'adx-hint' },
        '«Наследовать» — нет своей строки, действуют правила роли. «Открыть» и «Закрыть» — личное исключение, ',
        'оно сильнее роли. Полномочия и админка здесь не выдаются в принципе.'),
      isGuest && h('div', { className:'ad-info' },
        'Гостевое устройство: доступ живёт на устройстве. Чистка данных браузера у гостя — и доступ потерян ',
        'вместе с прогрессом. Ничего платного на dev: вешать нельзя.'),
      !canGrant && h('div', { className:'ad-warning' },
        'У вашей роли нет полномочия «Выдавать доступы» — переключатели заблокированы.'),

      h('div', { className:'adx-inline', style:{ marginBottom:10 } },
        h('input', {
          className:'adx-in', style:{ flex:1, minWidth:160 }, type:'search', value: featQuery,
          placeholder:'найти возможность',
          onChange: function(e){ setFeatQuery(e.target.value); }
        }),
        h('label', { className:'adx-check', style:{ padding:0 } },
          h('input', {
            type:'checkbox', checked: showAll,
            onChange: function(e){ setShowAll(e.target.checked); }
          }),
          h('span', null, 'показать все возможности')
        )
      ),

      (catalog.features || []).length === 0
        ? h('div', { className:'adx-empty' },
            'Каталог возможностей пуст — сначала собери и опубликуй его на подвкладке «Каталог».')
        : (visibleTree.length === 0
            ? h('div', { className:'adx-empty' },
                'Личных исключений нет: всё по правилам роли. Поставь галочку «показать все возможности», чтобы выдать доступ.')
            : visibleTree.map(function(node){
                var f = node.f;
                var row = entMap[f.feature];
                var val = entValue(f.feature);
                var changed = has(entDraft, f.feature) && entDraft[f.feature] !== (row ? row.granted : null);
                return h('div', { key: f.feature, className:'adx-featrow' },
                  h(FeatureTitle, { f: f, depth: node.depth }),
                  row && (row.source || row.expiresAt) && h('span', { className:'adx-sub' },
                    row.source ? row.source : '',
                    row.expiresAt ? ' до ' + fmtTime(row.expiresAt) : ''),
                  changed && h('span', { className:'adx-badge is-warn' }, 'не сохранено'),
                  h(Tri, {
                    value: val,
                    disabled: busy || !canGrant || f.status === 'wip',
                    canOpen: canIOpen(f.feature),
                    onChange: function(next){
                      var d = {};
                      Object.keys(entDraft).forEach(function(k){ d[k] = entDraft[k]; });
                      d[f.feature] = next;
                      setEntDraft(d);
                    }
                  })
                );
              })),

      h('div', { className:'adx-actions' },
        h('button', {
          className:'ad-btn ad-btn-primary', type:'button',
          disabled: busy || pendingEnts.length === 0 || !canGrant || needReason,
          title: needReason ? 'Впиши причину — она уйдёт в журнал' : undefined,
          onClick: saveEnts
        }, busy ? 'Сохраняю…' : 'Сохранить доступы' + (pendingEnts.length ? ' (' + pendingEnts.length + ')' : '')),
        pendingEnts.length > 0 && h('button', {
          className:'ad-btn', type:'button', onClick: function(){ setEntDraft({}); }
        }, 'Отменить правки'),
        needReason && pendingEnts.length > 0
          ? h('span', { className:'adx-sub' }, 'нужна причина — поле ниже')
          : null
      )
    ),

    // ─── причина ───
    h('div', { className:'adx-block' },
      h('h4', null, 'Причина'),
      h('p', { className:'adx-hint' },
        'Уйдёт в журнал вместе с действием. Без неё сохранение заблокировано — через месяц никто не вспомнит, почему открыли.'),
      h('input', {
        className:'adx-in', value: reason,
        placeholder:'например: договорились на созвоне 26.07, доступ до конца обучения',
        onChange: function(e){ setReason(e.target.value); }
      })
    ),

    // ─── хвост журнала ───
    h('div', { className:'adx-block' },
      h('h4', null, 'Последнее по этому владельцу'),
      tailNote ? h('p', { className:'adx-hint' }, tailNote) : null,
      !tail ? h('div', { className:'adx-note' }, 'Загружаю…')
        : (tail.length === 0
            ? h('div', { className:'adx-note' }, 'Записей нет.')
            : tail.slice(0, 5).map(function(r, i){
                return h('div', { key: r.id || i, className:'adx-featrow' },
                  h('div', { className:'adx-featname' },
                    h('b', null, ACTION_LABEL[r.action] || r.action || '—'),
                    h('div', { className:'adx-sub' },
                      fmtTime(r.at), ' · ', r.actor || '—', r.feature ? ' · ' + r.feature : '',
                      r.reason ? ' · ' + r.reason : '')
                  ),
                  h('span', { className:'adx-badge ' + (isDenied(r.result) ? 'is-warn' : 'is-ok') },
                    isDenied(r.result) ? 'отказ' : (r.result || 'ok'))
                );
              }))
    )
  );
}

// ─────────────────────────────────────────────────────────────────────
// МАТРИЦА
// ─────────────────────────────────────────────────────────────────────
function MatrixView(props){
  var catalog = props.catalog || { features:[], roles:[], roleGrants:[] };
  var roles = (props.roles && props.roles.length ? props.roles : ROLE_FALLBACK)
    .slice().sort(function(a, b){ return a.rank - b.rank; });

  var [reason, setReason] = useState('');
  var [query, setQuery] = useState('');
  var [onlySensitive, setOnlySensitive] = useState(false);
  var [onlyDiff, setOnlyDiff] = useState(false);
  var [local, setLocal] = useState({});           // 'roleId|feature' → true|false|null (оптимистично)
  var [err, setErr] = useState('');
  var [busyCell, setBusyCell] = useState('');

  var serverMap = useMemo(function(){
    var m = {};
    (catalog.roleGrants || []).forEach(function(g){ m[g.roleId + '|' + g.feature] = g.granted; });
    return m;
  }, [catalog.roleGrants]);

  function cellValue(roleId, feature){
    var k = roleId + '|' + feature;
    if(has(local, k)) return local[k];
    return has(serverMap, k) ? serverMap[k] : null;
  }

  var superRole = useMemo(function(){
    var byId = null, byRank = null;
    roles.forEach(function(r){
      if(r.id === 'superadmin') byId = r;
      if(!byRank || r.rank > byRank.rank) byRank = r;
    });
    return byId || byRank;
  }, [roles]);

  var rows = useMemo(function(){
    var q = query.trim().toLowerCase();
    return buildTree(catalog.features || []).filter(function(node){
      var f = node.f;
      if(q && f.title.toLowerCase().indexOf(q) < 0 && f.feature.toLowerCase().indexOf(q) < 0) return false;
      if(onlySensitive && !f.sensitive) return false;
      if(onlyDiff){
        var differs = roles.some(function(r){ return cellValue(r.id, f.feature) !== null; });
        if(!differs) return false;
      }
      return true;
    });
  }, [catalog.features, query, onlySensitive, onlyDiff, local, serverMap, roles]);

  function nextValue(v){ return v === null ? true : (v === true ? false : null); }

  function clickCell(roleId, feature){
    if(!props.isSuper) return;
    if(!reason.trim()){ setErr('Впиши причину сверху — она уйдёт в журнал вместе с правкой.'); return; }
    var k = roleId + '|' + feature;
    var was = cellValue(roleId, feature);
    var next = nextValue(was);
    var draft = {};
    Object.keys(local).forEach(function(x){ draft[x] = local[x]; });
    draft[k] = next;
    setLocal(draft); setErr(''); setBusyCell(k);
    api('POST', '/access/role-grants', {
      roleId: roleId,
      grants: [{ feature: feature, granted: next }],
      reason: reason.trim()
    }).then(function(){
      setBusyCell('');
      if(props.onChanged) props.onChanged();
    }, function(e){
      // Откат ровно этой клетки: показывать «✓», которого нет в базе, нельзя.
      var back = {};
      Object.keys(draft).forEach(function(x){ if(x !== k) back[x] = draft[x]; });
      setLocal(back); setBusyCell('');
      setErr(msgOf(e));
    });
  }

  if((catalog.features || []).length === 0){
    return h('div', { className:'adx-panel' },
      h('div', { className:'adx-empty' },
        'Таблица возможностей пуста. Собери каталог на подвкладке «Каталог» и опубликуй — ',
        'матрица строится из него, названий разделов в коде этой страницы нет.')
    );
  }

  return h('div', null,
    err ? h(Err, { text: err }) : null,
    h('div', { className:'adx-panel', style:{ marginBottom:14 } },
      h('div', { className:'adx-inline' },
        h('input', {
          className:'adx-in', style:{ flex:'1 1 220px' }, type:'search', value: query,
          placeholder:'поиск по названию или ключу',
          onChange: function(e){ setQuery(e.target.value); }
        }),
        h('label', { className:'adx-check', style:{ padding:0 } },
          h('input', { type:'checkbox', checked: onlyDiff, onChange: function(e){ setOnlyDiff(e.target.checked); } }),
          h('span', null, 'только с правками ролей')),
        h('label', { className:'adx-check', style:{ padding:0 } },
          h('input', { type:'checkbox', checked: onlySensitive, onChange: function(e){ setOnlySensitive(e.target.checked); } }),
          h('span', null, 'только серверные'))
      ),
      h('div', { style:{ marginTop:10 } },
        h('input', {
          className:'adx-in', value: reason,
          placeholder:'причина правки — без неё галочки не нажимаются',
          onChange: function(e){ setReason(e.target.value); }
        })
      ),
      h('p', { className:'adx-hint', style:{ margin:'8px 0 0' } },
        '«—» значит «строки нет»: действует правило «по умолчанию». ',
        '«✓» открывает, «✗» закрывает явно — это разные состояния, и они видны в колонке рядом. ',
        'Каждый щелчок сразу уходит на сервер и пишется в журнал.',
        props.isSuper ? '' : ' Менять матрицу может только суперадмин — клетки только для чтения.')
    ),

    h('div', { className:'adx-tablewrap' },
      h('table', { className:'adx-table' },
        h('thead', null,
          h('tr', null,
            h('th', null, 'Возможность'),
            h('th', null, 'Статус'),
            h('th', null, 'По умолчанию'),
            roles.map(function(r){ return h('th', { key: r.id, className:'adx-c' }, r.title); })
          )
        ),
        h('tbody', null, rows.map(function(node){
          var f = node.f;
          return h('tr', { key: f.feature },
            h('td', { className:'adx-wrap' },
              h('div', { style:{ paddingLeft: node.depth * 14 } },
                h('b', { style:{ fontWeight:500 } }, f.title),
                node.orphan && h('span', { className:'adx-badge is-warn', style:{ marginLeft:6 } }, 'ветка потеряна'),
                h('div', { className:'adx-mono' }, f.feature)
              )
            ),
            h('td', null,
              f.status === 'wip'
                ? h('span', { className:'adx-badge is-soon' }, 'Скоро')
                : h('span', { className:'adx-badge is-ok' }, 'live'),
              f.sensitive
                ? h('span', { className:'adx-pill', title:'Закрытие реально проверяется сервером' }, 'серверное')
                : h('span', { className:'adx-pill', title:'Клиентский гейт — витрина' }, 'витрина')
            ),
            h('td', null, DEFAULT_ACCESS_LABEL[f.defaultAccess] || f.defaultAccess),
            roles.map(function(r){
              var isSuperCol = superRole && r.id === superRole.id;
              var v = isSuperCol ? true : cellValue(r.id, f.feature);
              var k = r.id + '|' + f.feature;
              var label = v === true ? '✓' : (v === false ? '✗' : '—');
              return h('td', { key: r.id, className:'adx-c' },
                h('button', {
                  type:'button',
                  className:'adx-cell' + (v === true ? ' is-yes' : (v === false ? ' is-no' : '')),
                  disabled: !props.isSuper || isSuperCol || busyCell === k || f.status === 'wip',
                  title: isSuperCol ? 'Суперадмину открыто всё — снять нельзя'
                    : (f.status === 'wip' ? 'Раздел ещё не готов — открывать нечего'
                      : 'Нажми, чтобы переключить: — → ✓ → ✗'),
                  onClick: function(){ clickCell(r.id, f.feature); }
                }, busyCell === k ? '…' : label)
              );
            })
          );
        }))
      )
    ),
    h('p', { className:'adx-hint', style:{ marginTop:10 } },
      'Строк: ', rows.length, ' из ', (catalog.features || []).length, '.')
  );
}

// ─────────────────────────────────────────────────────────────────────
// КАТАЛОГ
// ─────────────────────────────────────────────────────────────────────
// Что объявили сами разделы (YasnaAccess) против того, что лежит в features.
// Сборка идёт в браузере: страницы того же origin открываются в скрытых
// iframe, из них читается window.YasnaAccess.catalog(). Ни node, ни CI.
function readDeclaredFrom(win, pageTitle){
  var out = { page: pageTitle, nodes: [], error: '' };
  var A = null;
  try { A = win && win.YasnaAccess; } catch(e){ out.error = 'страница не отдала доступ к своему окну: ' + msgOf(e); return out; }
  if(!A){ out.error = 'на странице нет YasnaAccess (core/access.js не подключён)'; return out; }
  var raw = null;
  try { raw = A.catalog ? A.catalog() : (A.declared ? A.declared() : null); }
  catch(e2){ out.error = 'ошибка чтения объявлений: ' + msgOf(e2); return out; }
  var arr = [];
  if(Array.isArray(raw)) arr = raw;
  else if(raw && typeof raw === 'object'){
    arr = Object.keys(raw).map(function(k){
      var v = raw[k];
      if(v && typeof v === 'object'){
        var copy = { feature: k };
        Object.keys(v).forEach(function(p){ copy[p] = v[p]; });
        if(v.feature) copy.feature = v.feature;
        return copy;
      }
      return { feature: k };
    });
  }
  out.nodes = arr.map(normFeature).filter(function(f){ return !!f.feature; });
  return out;
}

function CatalogView(props){
  var catalog = props.catalog || { features:[] };
  var caps = props.caps || {};
  var canEdit = !!caps['cap:catalog.edit'] || props.isSuper;

  var [declared, setDeclared] = useState(null);   // [{feature,…}]
  var [pages, setPages] = useState([]);           // [{page, count, error}]
  var [fullScan, setFullScan] = useState(false);  // прошёл ли полный обход страниц
  var [progress, setProgress] = useState('');
  var [err, setErr] = useState('');
  var [okText, setOkText] = useState('');
  var [reason, setReason] = useState('');
  var [busy, setBusy] = useState(false);
  var hostRef = useRef(null);
  var aliveRef = useRef(true);

  useEffect(function(){
    aliveRef.current = true;
    return function(){ aliveRef.current = false; };
  }, []);

  // Свои объявления читаем сразу: admin.html — тоже страница платформы.
  // Пустой результат в declared НЕ пишем: тогда «пропало из приложения»
  // показало бы весь каталог как исчезнувший — вывод, ради которого потом
  // руками сносят живые узлы.
  useEffect(function(){
    var own = readDeclaredFrom(window, 'Эта страница (админка)');
    if(own.nodes.length) setDeclared(own.nodes.slice());
    setPages([{ page: own.page, count: own.nodes.length, error: own.error }]);
  }, []);

  function harvest(){
    setErr(''); setOkText('');
    var host = hostRef.current;
    if(!host){ setErr('Не нашёл контейнер для сборки — обнови страницу.'); return; }
    setBusy(true); setFullScan(false);
    var self = readDeclaredFrom(window, 'Эта страница (админка)');
    var collected = {}, reports = [{ page: self.page, count: self.nodes.length, error: self.error }];
    self.nodes.forEach(function(n){ collected[n.feature] = n; });

    var i = 0;
    function step(){
      if(!aliveRef.current) return;              // ушли с подвкладки — обход прекращаем
      if(i >= HARVEST_PAGES.length){
        setPages(reports);
        setDeclared(Object.keys(collected).map(function(k){ return collected[k]; }));
        setFullScan(reports.every(function(r){ return !r.error; }));
        setProgress(''); setBusy(false);
        return;
      }
      var page = HARVEST_PAGES[i];
      setProgress('Читаю ' + (i + 1) + ' из ' + HARVEST_PAGES.length + ': ' + page.title);
      var frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;border:0;left:-9999px;top:0';
      var done = false;
      var timer = setTimeout(function(){ finish('страница не ответила за 15 секунд'); }, 15000);
      function finish(errText){
        if(done) return;
        done = true;
        clearTimeout(timer);
        if(errText){
          reports.push({ page: page.title, count: 0, error: errText });
        } else {
          var res = readDeclaredFrom(frame.contentWindow, page.title);
          res.nodes.forEach(function(n){
            if(!collected[n.feature]) collected[n.feature] = n;
            else if(collected[n.feature].title !== n.title) collected[n.feature].conflict = true;
          });
          reports.push({ page: page.title, count: res.nodes.length, error: res.error });
        }
        try { host.removeChild(frame); } catch(_){}
        i++; step();
      }
      frame.onload = function(){ setTimeout(function(){ finish(''); }, 250); };
      frame.onerror = function(){ finish('страница не загрузилась'); };
      host.appendChild(frame);
      frame.src = page.file;
    }
    step();
  }

  var dbMap = useMemo(function(){
    var m = {};
    (catalog.features || []).forEach(function(f){ m[f.feature] = f; });
    return m;
  }, [catalog.features]);

  var diff = useMemo(function(){
    if(!declared) return null;
    var added = [], changed = [], gone = [];
    var decMap = {};
    declared.forEach(function(n){
      decMap[n.feature] = n;
      var was = dbMap[n.feature];
      if(!was){ added.push(n); return; }
      var fields = [];
      if(was.title !== n.title) fields.push('название');
      if(was.status !== n.status) fields.push('статус');
      if(was.kind !== n.kind) fields.push('тип');
      if(str(was.parent) !== str(n.parent)) fields.push('родитель');
      if(was.area !== n.area) fields.push('область');
      if(!!was.sensitive !== !!n.sensitive) fields.push('серверная проверка');
      if(fields.length) changed.push({ node: n, was: was, fields: fields });
    });
    (catalog.features || []).forEach(function(f){
      // cap:* объявляет не страница, а миграция — в «пропало» им не место.
      if(f.kind === 'cap' || f.feature.indexOf('cap:') === 0) return;
      if(!decMap[f.feature]) gone.push(f);
    });
    return { added: added, changed: changed, gone: gone };
  }, [declared, dbMap, catalog.features]);

  function publish(){
    if(!declared || !declared.length){ setErr('Сначала собери каталог — публиковать нечего.'); return; }
    setBusy(true); setErr(''); setOkText('');
    // default_access НЕ отправляем осознанно: это решение владельца, оно живёт
    // в features и правится в матрице. Прислав его из объявлений страницы, мы
    // затирали бы настройку доступа при каждой публикации каталога.
    var nodes = declared.map(function(n){
      return {
        feature: n.feature, area: n.area, parent: n.parent || null, title: n.title,
        kind: n.kind, status: n.status, sensitive: !!n.sensitive, declaredAt: n.declaredAt || ''
      };
    });
    api('POST', '/access/features', { nodes: nodes, reason: reason.trim() || 'публикация каталога из админки' })
      .then(function(res){
        setBusy(false);
        var a = res && res.added, u = res && res.updated;
        setOkText('Каталог опубликован' + (a != null ? ': добавлено ' + a : '') + (u != null ? ', обновлено ' + u : '') + '.');
        if(props.onChanged) props.onChanged();
      }, function(e){ setBusy(false); setErr(msgOf(e)); });
  }

  return h('div', null,
    err ? h(Err, { text: err }) : null,
    okText ? h(Ok, { text: okText }) : null,

    h('div', { className:'adx-panel', style:{ marginBottom:14 } },
      h('h4', { style:{ margin:'0 0 4px', fontSize:13 } }, 'Что объявили разделы'),
      h('p', { className:'adx-hint' },
        'Список берётся из самих страниц: каждая объявляет свои возможности через ',
        h('span', { className:'adx-mono' }, 'YasnaAccess.declare()'),
        '. Публикация ручная: новый раздел не должен молча получить доступ, пока вы не решили, кому он открыт.'),
      h('div', { className:'adx-inline' },
        h('button', { className:'ad-btn', type:'button', disabled: busy, onClick: harvest },
          busy && progress ? progress : 'Собрать со страниц'),
        h('button', {
          className:'ad-btn ad-btn-primary', type:'button',
          disabled: busy || !canEdit || !declared || !declared.length,
          title: canEdit ? undefined : 'Нужно полномочие «Править каталог»',
          onClick: publish
        }, busy ? 'Отправляю…' : 'Опубликовать каталог'),
        h('span', { className:'adx-sub' },
          declared ? ('объявлено: ' + declared.length + ' · в базе: ' + (catalog.features || []).length)
                   : ('в базе: ' + (catalog.features || []).length))
      ),
      !canEdit && h('p', { className:'adx-hint' }, 'У вашей роли нет полномочия «Править каталог» — публикация заблокирована.'),
      h('input', {
        className:'adx-in', style:{ marginTop:10 }, value: reason,
        placeholder:'причина публикации (уйдёт в журнал)',
        onChange: function(e){ setReason(e.target.value); }
      }),
      pages.length > 0 && h('div', { style:{ marginTop:12 } },
        pages.map(function(p, idx){
          return h('div', { key: idx, className:'adx-featrow' },
            h('div', { className:'adx-featname' },
              h('b', null, p.page),
              p.error ? h('div', { className:'adx-sub' }, p.error) : null),
            h('span', { className:'adx-badge ' + (p.error ? 'is-warn' : 'is-ok') },
              p.error ? 'нет данных' : (p.count + ' узлов'))
          );
        })
      ),
      h('div', { ref: hostRef, style:{ position:'relative', height:0, overflow:'hidden' } })
    ),

    !declared
      ? h('div', { className:'adx-panel' },
          h('div', { className:'adx-empty' },
            'Нажми «Собрать со страниц» — админка откроет страницы платформы в скрытых окнах ',
            'и прочитает, что каждая объявила о себе.'))
      : h('div', null,
          h(DiffBlock, {
            title:'Появилось в приложении', hint:'Есть на страницах, в базе нет. Появится в матрице после публикации.',
            rows: diff.added, kind:'added'
          }),
          h(DiffBlock, {
            title:'Расходятся названия или статусы', hint:'Строка в базе устарела. Публикация приведёт её к тому, что объявляет страница.',
            rows: diff.changed, kind:'changed'
          }),
          // «Пропало» показываем ТОЛЬКО после полного успешного обхода. Если
          // хотя бы одна страница не открылась, её узлы выглядят пропавшими —
          // и по такому списку легко снести живой раздел.
          fullScan
            ? h(DiffBlock, {
                title:'Пропало из приложения',
                hint:'Есть в базе, но ни одна страница это больше не объявляет. Публикация ничего НЕ удаляет — у такой строки просто перестаёт обновляться отметка «видели». Решение принимается глазами.',
                rows: diff.gone, kind:'gone'
              })
            : h('div', { className:'adx-panel' },
                h('h4', { style:{ margin:'0 0 4px', fontSize:13 } }, 'Пропало из приложения'),
                h('p', { className:'adx-hint', style:{ margin:0 } },
                  'Не считаем: обход прошёл не по всем страницам (или какая-то не открылась). ',
                  'Узлы незагрузившейся страницы выглядели бы пропавшими, а это тот самый вывод, ',
                  'по которому потом сносят живой раздел. Нажми «Собрать со страниц» и дождись, ',
                  'пока все страницы ответят.'))
        )
  );
}

function DiffBlock(props){
  var rows = props.rows || [];
  return h('div', { className:'adx-panel', style:{ marginBottom:14 } },
    h('h4', { style:{ margin:'0 0 4px', fontSize:13 } }, props.title,
      h('span', { className:'adx-pill' }, rows.length)),
    h('p', { className:'adx-hint' }, props.hint),
    rows.length === 0
      ? h('div', { className:'adx-note' }, 'Пусто — и это хорошо.')
      : rows.map(function(r, i){
          var f = props.kind === 'changed' ? r.node : r;
          return h('div', { key: f.feature || i, className:'adx-featrow' },
            h('div', { className:'adx-featname' },
              h('b', null, f.title),
              props.kind === 'changed' && h('span', { className:'adx-badge is-warn', style:{ marginLeft:6 } },
                r.fields.join(', ')),
              h('div', { className:'adx-mono' },
                f.feature, f.area ? ' · ' + f.area : '', f.declaredAt ? ' · ' + f.declaredAt : '',
                props.kind === 'gone' && f.seenAt ? ' · видели ' + fmtAgo(f.seenAt) : '')
            ),
            props.kind === 'changed' && h('span', { className:'adx-sub' }, 'в базе: ', r.was.title, ' / ', r.was.status)
          );
        })
  );
}

// ─────────────────────────────────────────────────────────────────────
// ЖУРНАЛ
// ─────────────────────────────────────────────────────────────────────
function AuditView(props){
  var caps = props.caps || {};
  var canView = !!caps['cap:audit.view'] || props.isSuper;

  var [rows, setRows] = useState(null);
  var [err, setErr] = useState('');
  var [actor, setActor] = useState('');
  var [target, setTarget] = useState('');
  var [limit, setLimit] = useState(100);
  var [tick, setTick] = useState(0);

  useEffect(function(){
    var alive = true;
    setErr(''); setRows(null);
    var path = '/access/audit?limit=' + encodeURIComponent(limit) +
      (actor.trim() ? '&actor=' + encodeURIComponent(actor.trim()) : '') +
      (target.trim() ? '&target=' + encodeURIComponent(target.trim()) : '');
    api('GET', path).then(function(data){
      if(!alive) return;
      setRows(asList(data, ['records','audit','events']).map(normAudit));
    }, function(e){
      if(!alive) return;
      setRows([]); setErr(msgOf(e));
    });
    return function(){ alive = false; };
  }, [limit, tick, props.tick]);

  var deniedCount = (rows || []).filter(function(r){ return isDenied(r.result); }).length;

  return h('div', null,
    err ? h(Err, { text: err }) : null,
    !canView && h('div', { className:'ad-warning' },
      'У вашей роли нет полномочия «Видеть журнал» — запрос, скорее всего, вернёт отказ.'),

    h('div', { className:'adx-panel', style:{ marginBottom:14 } },
      h('div', { className:'adx-inline' },
        h('input', {
          className:'adx-in', style:{ flex:'1 1 180px' }, value: actor,
          placeholder:'кто (usr:… )', onChange: function(e){ setActor(e.target.value); }
        }),
        h('input', {
          className:'adx-in', style:{ flex:'1 1 180px' }, value: target,
          placeholder:'над кем (usr:… / dev:… / роль)', onChange: function(e){ setTarget(e.target.value); }
        }),
        h('select', {
          className:'adx-in', style:{ width:'auto' }, value: limit,
          onChange: function(e){ setLimit(parseInt(e.target.value, 10) || 100); }
        },
          [50, 100, 200].map(function(n){ return h('option', { key: n, value: n }, n + ' записей'); })
        ),
        h('button', { className:'ad-btn', type:'button', onClick: function(){ setTick(tick + 1); } }, 'Показать')
      ),
      h('p', { className:'adx-hint', style:{ margin:'8px 0 0' } },
        'Журнал только читается: ни исправить, ни удалить запись нельзя. ',
        'Отказы выделены красным — серия отказов подряд означает, что кто-то перебирает права чужим токеном.',
        deniedCount ? ' Сейчас отказов в выборке: ' + deniedCount + '.' : '')
    ),

    !rows ? h('div', { className:'adx-empty' }, 'Загружаю…')
      : (rows.length === 0
          ? h('div', { className:'adx-panel' }, h('div', { className:'adx-empty' }, 'Записей нет.'))
          : h('div', { className:'adx-tablewrap' },
              h('table', { className:'adx-table adx-audit' },
                h('thead', null, h('tr', null,
                  h('th', null, 'Когда'), h('th', null, 'Кто'), h('th', null, 'Что сделал'),
                  h('th', null, 'Над кем'), h('th', null, 'Возможность'),
                  h('th', null, 'Причина'), h('th', null, 'Итог')
                )),
                h('tbody', null, rows.map(function(r, i){
                  var cls = isDenied(r.result) ? 'is-denied' : (r.result === 'error' ? 'is-error' : '');
                  return h('tr', { key: r.id || i, className: cls },
                    h('td', null, fmtTime(r.at)),
                    h('td', null, h('span', { className:'adx-mono' }, shortKey(r.actor)),
                      r.actorRole ? h('div', { className:'adx-sub' }, r.actorRole) : null),
                    h('td', null, ACTION_LABEL[r.action] || r.action || '—'),
                    h('td', null, h('span', { className:'adx-mono' }, shortKey(r.target))),
                    h('td', null, h('span', { className:'adx-mono' }, r.feature || '—')),
                    h('td', { className:'adx-wrap' }, r.reason || '—'),
                    h('td', null, isDenied(r.result) ? 'ОТКАЗ' : (r.result || '—'))
                  );
                }))
              ))
        )
  );
}

// ─────────────────────────────────────────────────────────────────────
// КОРЕНЬ ВКЛАДКИ
// ─────────────────────────────────────────────────────────────────────
var SUBTABS = [
  { id:'people',  label:'Люди' },
  { id:'matrix',  label:'Матрица' },
  { id:'catalog', label:'Каталог' },
  { id:'audit',   label:'Журнал' }
];

function AccessTab(props){
  injectStyles();
  var opts = props || {};

  var [sub, setSub] = useState('people');
  var [me, setMe] = useState(null);
  var [meErr, setMeErr] = useState('');
  var [catalog, setCatalog] = useState({ features:[], roles:[], roleGrants:[] });
  var [catErr, setCatErr] = useState('');
  var [superCount, setSuperCount] = useState(null);
  var [tick, setTick] = useState(0);
  var [loading, setLoading] = useState(true);

  // onIdentity держим в ref, а не в зависимостях loadAll: admin.js почти
  // наверняка передаст стрелку прямо в props, и тогда каждый его re-render
  // менял бы идентичность колбэка и заново дёргал бы обе ручки.
  var onIdentityRef = useRef(null);
  onIdentityRef.current = opts.onIdentity || null;

  var loadAll = useCallback(function(){
    setLoading(true); setMeErr(''); setCatErr('');
    api('GET', '/access/me').then(function(data){
      var d = data || {};
      var role = d.role && typeof d.role === 'object' ? d.role : { id: str(d.role), title: str(d.role) };
      var identity = {
        userId: str(first(d.userId, d.user_id, '')),
        nickname: str(first(d.nickname, d.nick, '')),
        roleId: str(first(role.id, role.role_id, role.roleId, '')),
        roleTitle: str(first(role.title, role.id, '')),
        rank: Number(first(role.rank, role.rank_level, 0)) || 0,
        caps: {}
      };
      var capList = Array.isArray(d.caps) ? d.caps : Object.keys(d.caps || {}).filter(function(k){ return !!d.caps[k]; });
      capList.forEach(function(c){ identity.caps[str(c)] = true; });
      setMe(identity);
      if(onIdentityRef.current){ try { onIdentityRef.current(identity); } catch(_){} }
      var reported = first(d.superadmins, d.superadminCount, d.superadmin_count);
      if(typeof reported === 'number') setSuperCount(reported);
      setLoading(false);
    }, function(e){ setMeErr(msgOf(e)); setMe(null); setLoading(false); });

    api('GET', '/access/catalog').then(function(data){
      var d = data || {};
      setCatalog({
        features: asList(d.features, ['features']).map(normFeature).filter(function(f){ return !!f.feature; }),
        roles: asList(d.roles, ['roles']).map(normRole).filter(function(r){ return !!r.id; }),
        roleGrants: asList(d.roleGrants || d.role_grants, ['roleGrants','role_grants','grants']).map(normRoleGrant)
      });
    }, function(e){ setCatErr(msgOf(e)); });
  }, []);

  useEffect(function(){ loadAll(); }, [loadAll, tick]);

  // Счётчик суперадминов. Если /access/me его не отдал — считаем по списку
  // владельцев с ролью superadmin. Нужен для блокировки «останется ноль».
  useEffect(function(){
    if(typeof superCount === 'number') return;
    var alive = true;
    api('GET', '/access/owners?role=superadmin&limit=100').then(function(data){
      if(!alive) return;
      setSuperCount(asList(data, ['owners','people']).length);
    }, function(){ if(alive) setSuperCount(null); });
    return function(){ alive = false; };
  }, [superCount, tick]);

  var roles = catalog.roles && catalog.roles.length ? catalog.roles : ROLE_FALLBACK;
  var isSuper = !!me && (me.roleId === 'superadmin' || me.rank >= 100);
  var caps = (me && me.caps) || {};
  var refresh = function(){ setSuperCount(null); setTick(tick + 1); };

  // Нет токена — единственный случай, когда экран не имеет смысла показывать.
  if(!getToken()){
    return h('div', null,
      h('div', { className:'ad-warning' },
        h('strong', null, 'Нет входа. '),
        'Управление доступами работает только от вашего аккаунта: роль читается на сервере из базы по вашему ',
        'user_id из токена. Откройте ', h('a', { href:'duel.html#login' }, 'duel.html'),
        ', войдите через Telegram и вернитесь на эту страницу.')
    );
  }

  return h('div', null,
    // ─── строка состояния ───
    h('div', { className:'adx-status' },
      loading && !me ? h('span', null, 'Проверяю, кто вы…') : null,
      me ? h('span', { className:'adx-who' }, 'Вы: ', me.nickname || '(без ника)') : null,
      me ? h('span', { className:'adx-sep' }, '·') : null,
      me ? h(RoleBadge, { roleId: me.roleId, roles: roles }) : null,
      h('span', { className:'adx-sep' }, '·'),
      h('span', { className: superCount === 1 ? 'adx-badge is-warn' : 'adx-badge' },
        'суперадминов: ', superCount == null ? '?' : superCount),
      superCount === 1 && h('span', { className:'adx-sub' },
        'один суперадмин — единственная точка отказа, выдайте роль второму человеку'),
      h('span', { style:{ flex:1 } }),
      h('button', { className:'ad-btn', type:'button', onClick: refresh }, 'Обновить'),
      me && h('div', { className:'adx-capsline' },
        'Ваши полномочия: ',
        (function(){
          var list = CAPS.filter(function(c){ return !!caps[c.id]; }).map(function(c){ return c.label; });
          if(isSuper) return 'все (суперадмин)';
          return list.length ? list.join(' · ') : 'нет ни одного';
        })())
    ),

    meErr ? h(Err, { text: 'Кто я — выяснить не удалось. ' + meErr }) : null,
    catErr ? h(Err, { text: 'Каталог возможностей не загрузился, поэтому матрица и дерево доступов пусты. ' + catErr }) : null,

    // ─── подвкладки ───
    h('div', { className:'ad-tabs' }, SUBTABS.map(function(t){
      return h('button', {
        key: t.id, type:'button',
        className:'ad-tab' + (sub === t.id ? ' is-active' : ''),
        onClick: function(){ setSub(t.id); }
      }, t.label);
    })),

    sub === 'people' && h(PeopleView, {
      catalog: catalog, roles: roles, caps: caps, isSuper: isSuper,
      myRoleId: me ? me.roleId : '', myUserId: me ? me.userId : '',
      superCount: superCount, tick: tick, onChanged: refresh
    }),
    sub === 'matrix' && h(MatrixView, {
      catalog: catalog, roles: roles, caps: caps, isSuper: isSuper, onChanged: refresh
    }),
    sub === 'catalog' && h(CatalogView, {
      catalog: catalog, caps: caps, isSuper: isSuper, onChanged: refresh
    }),
    sub === 'audit' && h(AuditView, {
      caps: caps, isSuper: isSuper, tick: tick
    })
  );
}

window.YasnaAccessTab = AccessTab;

})();
