# ✦ Ясна

Интерактивный тренажёр и игра по системе Ясны (12-лучевые звёздные диаграммы).

## 🌐 Живые страницы

- **Конструктор / тренажёр** — <https://avvacumrechevoi.github.io/yasnanegotiations/>
- **Игра по Ясне (Дуэль)** — <https://avvacumrechevoi.github.io/yasnanegotiations/duel.html>

## Архитектура

```
docs/                  — то, что отдаёт GitHub Pages
  index.html           — Конструктор/тренажёр (React SPA)
  duel.html            — «Игра по Ясне» v2.0: партия из 9 тем · 124 вопроса,
                         соперник «Тень» (бот) или живой друг по ссылке
  core/ games/ lessons/ tours/   — исходные модули
  dist/*.min.js        — собранные esbuild-бандлы (деплоятся на Pages)
server/                — бэкенд: Yandex Cloud Functions за API Gateway
  auth-telegram.js     — вход через Telegram (HMAC + JWT)
  submit.js            — приём результатов матчей (анти-чит)
  leaderboard.js       — рейтинг
  content-fetch.js / content-publish.js  — overrides контента (admin)
  api-gateway.yaml     — спецификация шлюза · schema.sql — таблицы YDB
firebase-rules.json    — правила Firebase RTDB (realtime-дуэли)
content/               — контентное дерево (вопросы, темы)
scripts/               — сборка (esbuild) и валидация контента
specifications/        — спецификации · tests/ — Playwright smoke
.github/workflows/     — deploy.yml (Pages) · test.yml (smoke)
```

## Стек

React 18 + Three.js + Firebase (compat) из CDN; бандлинг — esbuild;
бэкенд — Node.js Cloud Functions + YDB; realtime — Firebase Realtime Database.

## Разработка

```bash
npm install
npm run build      # валидация контента + esbuild-бандлы в docs/dist
npm run serve      # локальный статический сервер docs/
npm test           # Playwright smoke-тесты
```

Деплой автоматический: push в `main` → `deploy.yml` собирает бандлы и публикует `docs/` на GitHub Pages.
Бэкенд (`server/`) и правила Firebase деплоятся **отдельно** (Yandex Cloud / Firebase Console).

## Стиль

Светлая тема: тёплый янтарный акцент, системные шрифты; есть тёмная тема (`theme-vk-dark`).

## Лицензия

MIT
