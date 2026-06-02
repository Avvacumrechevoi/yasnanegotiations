// ════════════════════════════════════════════════════════════════════
// core/astro-panel.js — независимый модуль «Астрономия»
//
// Содержит ВСЁ что относится к астро-режиму 3D-просмотра:
//   • DEFAULTS    — дефолтные значения 14 слоёв (что включено по умолчанию)
//   • SECTIONS    — структура UI (4 группы: Геометрия / Сфера / Координаты / Солнце)
//   • useAstroMode()    — хук для master-toggle (открывает / закрывает панель)
//   • useAstroLayers()  — хук для индивидуальных слоёв + persist в localStorage
//   • <Panel/>    — React-компонент панели с двумя layout'ами:
//                   - desktop: floating top-left (260px)
//                   - mobile:  bottom-sheet с collapsed-chip-состоянием
//
// Архитектура: модуль НЕ знает про Three.js. Он только хранит state и
// рендерит UI. yasna-3d.js читает astroLayers как prop и сам решает что
// показывать. Это позволяет добавлять новые слои в одном месте без правок
// 3D-рендера или app.js.
//
// Чтобы добавить новый слой:
//   1. Добавь key в DEFAULTS (по умолчанию выкл/вкл)
//   2. Добавь { k, label, sub } в нужную секцию SECTIONS
//   3. В yasna-3d.js — создай subgroup в astroSubs + добавь объекты в неё
//   useEffect на JSON.stringify(astroLayers) сам подхватит видимость.
//
// CSS-классы: ВСЕ scoped через `.astro-*` префикс — изоляция от остальных
// разделов гарантирована.
// ════════════════════════════════════════════════════════════════════
;(function(){
'use strict';
const React = window.React;
const { useState, useEffect, useMemo } = React;

// ─── Дефолтные значения слоёв ────────────────────────────────────────
// При первом запуске эти слои включены; пользователь меняет → localStorage.
const DEFAULTS = {
  tropics:    true,   // Тропики Рака и Козерога ±23.5°
  arctics:    true,   // Полярные круги ±66.5°
  parallels:  false,  // Сетка параллелей (15/30/45/60°) — много шума
  ecliptic:   true,   // Эклиптика — большой круг 23.5°
  zodiac:     true,   // 12 знаков зодиака на эклиптике
  seasons:    true,   // Метки Весна/Лето/Осень/Зима
  meridians:  false,  // 12 вертикальных дуг через апексы — много линий
  cardinals:  true,   // Зенит/Восток/Надир/Запад
  polaris:    true,   // Полярная Звезда
  sun:        true,   // Солнце-маркер на эклиптике
  sunCycle:   false,  // Анимация Солнца (требует ручного запуска)
  terminator: false,  // Граница день/ночь (требует sunCycle)
  dayNight:   false,  // Подсветка полок по освещённости
  tiltAxis:   false,  // Наклон оси на 23.5°
  realStars:   false, // Реальные звёзды (HYG, до 6.5ᵐ)
  realConstel: false, // Линии настоящих созвездий
  realNames:   false, // Имена ярких звёзд
  realPlanets: false, // Солнце/Луна/планеты на текущую дату
};

// ─── Структура UI ────────────────────────────────────────────────────
// Группировка по тематическим разделам — помогает учиться постепенно.
const SECTIONS = [
  { title: 'Геометрия Земли', layers: [
    { k:'tropics',   label:'Тропики',          sub:'±23.5°' },
    { k:'arctics',   label:'Полярные круги',   sub:'±66.5°' },
    { k:'parallels', label:'Сетка параллелей' },
  ]},
  { title: 'Небесная сфера', layers: [
    { k:'ecliptic',  label:'Эклиптика' },
    { k:'zodiac',    label:'Зодиак',           sub:'12 знаков' },
    { k:'seasons',   label:'Сезоны' },
  ]},
  { title: 'Координаты', layers: [
    { k:'meridians', label:'12 меридианов' },
    { k:'cardinals', label:'Кардинальные точки' },
    { k:'polaris',   label:'Полярная звезда' },
  ]},
  { title: 'Солнце и динамика', layers: [
    { k:'sun',        label:'Солнце' },
    { k:'sunCycle',   label:'Цикл Солнца',           sub:'анимация' },
    { k:'terminator', label:'Терминатор · день/ночь' },
    { k:'dayNight',   label:'Освещённость полок' },
    { k:'tiltAxis',   label:'Наклон оси Земли',      sub:'23.5°' },
  ]},
  { title: 'Реальное небо', layers: [
    { k:'realStars',   label:'Звёзды',      sub:'8920 · до 6.5ᵐ' },
    { k:'realConstel', label:'Созвездия',   sub:'88 фигур' },
    { k:'realNames',   label:'Имена звёзд' },
    { k:'realPlanets', label:'Планеты',     sub:'Солнце · Луна · на сегодня' },
  ]},
];

// ─── Хук: detect mobile (одиночный resize listener) ─────────────────
function useIsMobile(breakpoint = 768){
  const [m, setM] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= breakpoint);
  useEffect(() => {
    const onR = () => setM(window.innerWidth <= breakpoint);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, [breakpoint]);
  return m;
}

// ─── Хук: master toggle ──────────────────────────────────────────────
// Открывает / закрывает астро-панель. Persistится в localStorage.
function useAstroMode(){
  const [on, setOn] = useState(() => {
    try { return localStorage.getItem('yasna_astro_mode') === '1'; }
    catch(_) { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('yasna_astro_mode', on ? '1' : '0'); } catch(_){}
  }, [on]);
  return [on, setOn];
}

// ─── Хук: layers state + toggle ──────────────────────────────────────
// Возвращает [layers, toggle, setLayers]. Defensive: при загрузке
// мерджим с DEFAULTS — если в localStorage старая версия без новых ключей,
// они появятся со значениями по умолчанию.
function useAstroLayers(){
  const [layers, setLayers] = useState(() => {
    try {
      const s = localStorage.getItem('yasna_astro_layers');
      if(s) return Object.assign({}, DEFAULTS, JSON.parse(s));
    } catch(_){}
    return Object.assign({}, DEFAULTS);
  });
  useEffect(() => {
    try { localStorage.setItem('yasna_astro_layers', JSON.stringify(layers)); }
    catch(_){}
  }, [layers]);
  const toggle = (k) => setLayers(s => ({ ...s, [k]: !s[k] }));
  const reset = () => setLayers(Object.assign({}, DEFAULTS));
  return [layers, toggle, setLayers, reset];
}

// ─── UI: Toggle (кнопка одного слоя) ─────────────────────────────────
// ON: яркий синий, opacity 1, ●
// OFF: приглушённый серый, opacity 0.62, ○ — глаз сразу видит «выкл»
function Toggle({ on, label, sub, onClick }){
  return React.createElement('button', {
    type:'button',
    className: 'astro-toggle' + (on ? ' is-on' : ''),
    onClick,
    'aria-pressed': on ? 'true' : 'false',
  },
    React.createElement('span', { className:'astro-toggle__dot', 'aria-hidden':true }, on ? '●' : '○'),
    React.createElement('span', { className:'astro-toggle__label' },
      label,
      sub && React.createElement('span', { className:'astro-toggle__sub' }, ' · ' + sub)
    )
  );
}

// ─── UI: Section (заголовок + дети) ──────────────────────────────────
function Section({ title, children }){
  return React.createElement('div', { className:'astro-section' },
    React.createElement('div', { className:'astro-section__title' }, title),
    children
  );
}

// ─── UI: Panel ───────────────────────────────────────────────────────
// Props:
//   astroLayers — { tropics: bool, ... }
//   onToggle    — (key) => void
//   onClose     — () => void  (закрыть = выключить master toggle)
//
// Layouts:
//   desktop : floating top-left, 260px wide
//   mobile  : bottom-sheet (max-height 65vh) ИЛИ collapsed chip (~40px)
//
// Mobile-специфика:
//   – bottom-sheet с handle сверху (визуальная подсказка swipe-down)
//   – кнопка «−» (collapse) — превращает в chip
//   – chip кликается → разворачивается обратно
//   – × — полностью закрывает astro-режим
function Panel({ astroLayers, onToggle, onClose }){
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('yasna_astro_collapsed') === '1'; }
    catch(_){ return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('yasna_astro_collapsed', collapsed ? '1' : '0'); }
    catch(_){}
  }, [collapsed]);

  // Сколько слоёв включено — показываем в chip
  const onCount = useMemo(() => {
    const L = astroLayers || {};
    return Object.values(L).filter(Boolean).length;
  }, [astroLayers]);

  // Mobile collapsed: chip справа-снизу, не блокирует звезду
  if(isMobile && collapsed){
    return React.createElement('button', {
      type:'button',
      className:'astro-chip',
      onClick: () => setCollapsed(false),
      'aria-label':'Развернуть панель астрономии',
    },
      React.createElement('span', { className:'astro-chip__icon', 'aria-hidden':true }, '🌍'),
      React.createElement('span', { className:'astro-chip__label' }, 'Астрономия'),
      React.createElement('span', { className:'astro-chip__count' }, onCount + ' слоёв'),
      React.createElement('span', { className:'astro-chip__arrow', 'aria-hidden':true }, '⌃')
    );
  }

  // Expanded panel — desktop floating ИЛИ mobile bottom-sheet
  return React.createElement('div', {
    className: 'astro-panel' + (isMobile ? ' astro-panel--mobile' : ''),
    role: isMobile ? 'dialog' : undefined,
    'aria-label': 'Астрономические слои',
  },
    // Header
    React.createElement('div', { className:'astro-panel__hdr' },
      isMobile && React.createElement('div', { className:'astro-panel__handle', 'aria-hidden':true }),
      React.createElement('div', { className:'astro-panel__title' },
        React.createElement('span', { className:'astro-panel__icon', 'aria-hidden':true }, '🌍'),
        React.createElement('h4', null, 'Астрономия')
      ),
      React.createElement('div', { className:'astro-panel__hdr-btns' },
        // На мобиле: «–» сворачивает в chip (не закрывает совсем)
        isMobile && React.createElement('button', {
          type:'button',
          className:'astro-panel__icon-btn',
          onClick: () => setCollapsed(true),
          'aria-label':'Свернуть',
          title:'Свернуть в кнопку',
        }, '–'),
        // × — полностью закрывает astro-режим
        React.createElement('button', {
          type:'button',
          className:'astro-panel__icon-btn',
          onClick: onClose,
          'aria-label':'Закрыть астро-режим',
          title:'Закрыть астро-режим',
        }, '×')
      )
    ),
    // Body
    React.createElement('div', { className:'astro-panel__body' },
      SECTIONS.map(section =>
        React.createElement(Section, { key: section.title, title: section.title },
          section.layers.map(layer =>
            React.createElement(Toggle, {
              key: layer.k,
              on: !!astroLayers[layer.k],
              label: layer.label,
              sub: layer.sub,
              onClick: () => onToggle(layer.k),
            })
          )
        )
      ),
      React.createElement('div', { className:'astro-panel__hint' },
        'Включай слои по одному, чтобы понять, что значит каждый элемент. Любой набор сохраняется.'
      )
    )
  );
}

// ─── Export ──────────────────────────────────────────────────────────
window.YasnaAstro = {
  Panel,
  useAstroMode,
  useAstroLayers,
  DEFAULTS,
  SECTIONS,
};

})();
