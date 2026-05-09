// ════════════════════════════════════════════════════════════════════
// core/content-store.js · Content Store (Tier-1 + Tier-2 merge layer)
//
// Источники контента (в порядке приоритета):
//   1. Tier-1 baseline      — window.YasnaContent (из content.bundle.js)
//   2. Tier-2 live overrides — fetch с /content (Yandex Cloud Function)
//   3. localStorage cache   — для offline / fast-start
//
// Жизненный цикл:
//   1) При загрузке: пытаемся получить cached overrides из localStorage
//      → даём быстрый старт без сетевого запроса
//   2) Параллельно: fetch /content с If-None-Match (ETag из cached)
//      → если 304 — ничего не делаем, кэш актуален
//      → если 200 — обновляем localStorage и emit `content-updated` event
//   3) Игра читает window.YasnaContentResolved.{THEMES, QUESTIONS, ...}
//
// API:
//   await window.YasnaContentStore.init()    — bootstrap (вызвать один раз)
//   window.YasnaContentStore.getResolved()   — { THEMES, QUESTIONS, ATOMS }
//   window.YasnaContentStore.refresh()       — принудительный re-fetch
//   window.YasnaContentStore.publish(data, opts) — admin only, через API
//   window.addEventListener('yasna-content-updated', cb) — слушать обновления
//
// Fallback: если backend упал — игра работает на baseline. Не критичная
// зависимость.
// ════════════════════════════════════════════════════════════════════
;(function(){
'use strict';

const CACHE_KEY = 'yasna_content_overrides_cache_v1';
const CACHE_TTL_MS = 5 * 60 * 1000;  // 5 минут

// API endpoint читается из meta-тега (как и yasna:api).
function apiBase(){
  try {
    const el = document.querySelector('meta[name="yasna:api"]');
    return el ? el.getAttribute('content') : '';
  } catch(_){ return ''; }
}

// ─── In-memory state ─────────────────────────────────────────────────
let baseline = null;          // { THEMES, QUESTIONS, ATOMS, QUESTIONS_FULL }
let overrides = null;         // { added, edited, deleted }
let revisionMeta = null;      // { revisionId, dataHash, publishedAt, publishedBy }
let resolved = null;          // computed merge of baseline + overrides

// ─── localStorage cache helpers ──────────────────────────────────────
function loadCache(){
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    if(!parsed || !parsed.cachedAt) return null;
    return parsed;
  } catch(_){ return null; }
}
function saveCache(payload){
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ...payload,
      cachedAt: Date.now(),
    }));
  } catch(_){
    // quota — молча, в memory всё равно осталось
  }
}
function clearCache(){
  try { localStorage.removeItem(CACHE_KEY); } catch(_){}
}

// ─── Merge baseline + overrides → resolved ───────────────────────────
function computeResolved(){
  if(!baseline) return null;
  const ov = overrides || { added: [], edited: {}, deleted: [] };
  const deletedSet = new Set(ov.deleted || []);

  const baseQs = (baseline.QUESTIONS || [])
    .filter(q => !deletedSet.has(q.id))
    .map(q => ov.edited && ov.edited[q.id] ? { ...q, ...ov.edited[q.id] } : q);

  const addedQs = (ov.added || []).filter(q => q && q.id);
  const allQs = [...baseQs, ...addedQs];

  // QUESTIONS_FULL — копия baseline (overrides пока в legacy формате)
  const baseFullQs = (baseline.QUESTIONS_FULL || [])
    .filter(q => !deletedSet.has(q.id))
    .map(q => ov.edited && ov.edited[q.id] ? { ...q, ...ov.edited[q.id] } : q);

  return {
    version: baseline.version || '1.0',
    buildInfo: baseline.buildInfo,
    THEMES: baseline.THEMES || [],
    QUESTIONS: allQs,
    QUESTIONS_FULL: [...baseFullQs, ...addedQs],
    ATOMS: baseline.ATOMS || [],
    // Метаданные источников — для UI (показать «контент обновлён 5 мин назад»)
    _meta: {
      baselineVersion: baseline.version || '1.0',
      revision: revisionMeta,
      hasOverrides: !!(ov.added?.length || Object.keys(ov.edited||{}).length || ov.deleted?.length),
      counts: {
        base:    (baseline.QUESTIONS || []).length,
        added:   (ov.added || []).length,
        edited:  Object.keys(ov.edited || {}).length,
        deleted: (ov.deleted || []).length,
        total:   allQs.length,
      },
    },
  };
}

function publishGlobal(){
  resolved = computeResolved();
  // Публикуем под глобальным именем для движка
  window.YasnaContentResolved = resolved;
  // Событие — тот кто слушает, может перерисоваться
  try {
    window.dispatchEvent(new CustomEvent('yasna-content-updated', {
      detail: { meta: resolved?._meta },
    }));
  } catch(_){}
}

// ─── Network: GET /content с If-None-Match ───────────────────────────
async function fetchOverrides(etag){
  const base = apiBase();
  if(!base) return { status: 'no-api' };

  const headers = { 'Accept': 'application/json' };
  if(etag) headers['If-None-Match'] = '"' + etag + '"';

  let resp;
  try {
    resp = await fetch(base.replace(/\/$/, '') + '/content', {
      method: 'GET', headers,
      // Браузер сам кэширует, но мы сами рулим через ETag
      cache: 'no-cache',
    });
  } catch(err){
    return { status: 'network-error', error: err };
  }

  if(resp.status === 304){
    return { status: 'not-modified' };
  }
  if(!resp.ok){
    return { status: 'http-error', code: resp.status };
  }
  let body;
  try { body = await resp.json(); }
  catch(err){ return { status: 'parse-error', error: err }; }

  return { status: 'ok', body };
}

// ─── Bootstrap ───────────────────────────────────────────────────────
// init() идемпотентен — можно вызывать многократно. Каждый раз перечитывает
// baseline из window.YasnaContent (на случай если content.bundle.js загрузился
// после content-store). Cached overrides читаются из localStorage один раз.
let _initialized = false;
let _refreshPromise = null;

function init(){
  // Перечитываем baseline (мог появиться позже)
  baseline = window.YasnaContent || baseline;

  if(!_initialized){
    // Загружаем cached overrides — даёт мгновенный старт
    const cached = loadCache();
    if(cached){
      overrides = cached.data || null;
      revisionMeta = {
        revisionId: cached.revisionId,
        dataHash: cached.dataHash,
        publishedAt: cached.publishedAt,
        publishedBy: cached.publishedBy,
      };
    }
    _initialized = true;
  }

  publishGlobal();  // emit с актуальной base + кэшем

  // Async refresh — не блокируем игру. Защищены от повторного запуска.
  if(!_refreshPromise){
    _refreshPromise = refresh()
      .catch(err => {
        console.warn('[ContentStore] refresh failed (using cache/baseline):', err);
      })
      .finally(() => { _refreshPromise = null; });
  }
  return _refreshPromise;
}

async function refresh(){
  const cachedHash = revisionMeta?.dataHash || null;
  const result = await fetchOverrides(cachedHash);

  if(result.status === 'not-modified'){
    // Кэш актуален — ничего не делаем
    return { changed: false, status: 'fresh' };
  }
  if(result.status !== 'ok'){
    // Сеть/API недоступны — играем на baseline + cached. Не падаем.
    return { changed: false, status: result.status };
  }

  const body = result.body;
  // body = { revisionId, dataHash, publishedAt, publishedBy, data }
  overrides = body.data || { added: [], edited: {}, deleted: [] };
  revisionMeta = {
    revisionId: body.revisionId,
    dataHash: body.dataHash,
    publishedAt: body.publishedAt,
    publishedBy: body.publishedBy,
  };
  saveCache({ ...revisionMeta, data: overrides });
  publishGlobal();
  return { changed: true, status: 'updated', revision: revisionMeta };
}

function getResolved(){
  return resolved || computeResolved();
}

// ─── Admin: publish (через API + auth header) ─────────────────────────
async function publish(data, opts){
  const base = apiBase();
  if(!base) throw new Error('API endpoint не настроен');
  const password = (opts && opts.password) || '';
  if(!password) throw new Error('Требуется password');

  const resp = await fetch(base.replace(/\/$/, '') + '/content/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + password,
    },
    body: JSON.stringify({
      data,
      publishedBy: (opts && opts.publishedBy) || 'admin',
      notes: (opts && opts.notes) || '',
    }),
  });

  let body;
  try { body = await resp.json(); }
  catch(_){ body = null; }

  if(!resp.ok){
    const err = new Error(body?.error || ('HTTP ' + resp.status));
    err.code = resp.status;
    err.body = body;
    throw err;
  }

  // После успешного publish — refresh чтобы локально подтянуть новую ревизию
  await refresh();
  return body;
}

// ─── Export ──────────────────────────────────────────────────────────
window.YasnaContentStore = {
  init,
  refresh,
  getResolved,
  publish,
  // для отладки
  _internal: {
    getBaseline: () => baseline,
    getOverrides: () => overrides,
    getRevisionMeta: () => revisionMeta,
    clearCache,
  },
};

})();
