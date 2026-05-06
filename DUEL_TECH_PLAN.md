# Дуэли онлайн — технический план

Дата: 2026-05-07. Контекст: статичный сайт на GitHub Pages, 0 серверной инфраструктуры на текущий момент. Хотим добавить 1v1 онлайн-дуэли поверх каталога игр из `GAMIFICATION_PLAN.md`.

## 0. Что значит «дуэль»

Два игрока в реальном времени соревнуются на одной и той же Ясне. Несколько вариантов конкурентной механики:

| Режим | Описание | Турнирность |
|---|---|---|
| **Race** | Обоим показана пустая Ясна Суток. Кто первый найдёт Опорный Крест — тот победил. | parallel, ~30с |
| **Quiz** | По очереди отвечают на вопросы (антиподы, праны, имена). Первый до 5 правильных подряд. | sequential, ~2 мин |
| **Mirror** | Обоим даётся набор из 12 разрозненных меток. Расставить по позициям, кто быстрее с минимумом ошибок. | parallel, ~1.5 мин |
| **Bidding** | Альтернативный ход: первый заявляет «полка X = Опорная», второй принимает или оспаривает. Очки за уверенность. | sequential, ~3 мин |
| **Tournament daily** | Асинхронный челлендж: одна игра, 24 часа, лучший результат. | async, 24h |

**Race и Mirror самые простые** для реализации (нет очерёдности ходов, синхронизация — два snapshot'а состояния). Начинать стоит с Race.

## 1. Архитектурные варианты

Главное решение — **как** два браузера обмениваются данными в реальном времени. Сравним три подхода:

### Вариант A — WebRTC P2P через signaling broker

**Идея:** играет А создаёт «room code», игрок Б вводит его на своей стороне. Через signaling-сервер (общий публичный) два браузера обмениваются SDP-офферами и устанавливают прямое WebRTC-соединение. Дальше весь трафик игры идёт между браузерами напрямую.

```
Player A ←sdp+ICE→ Signaling broker ←sdp+ICE→ Player B
              \                              /
               \─────── WebRTC DataChannel ─/
                       (peer-to-peer)
```

**Плюсы:**
- Zero infrastructure cost
- Лучшая латентность (~20–60ms p2p, без транзита через сервер)
- Никакой регистрации, никаких аккаунтов

**Минусы:**
- NAT traversal иногда не проходит (особенно на симметричных NAT — ~10% пользователей). Нужен TURN-сервер для fallback (платный).
- Невозможен server-authoritative anti-cheat — каждый клиент верит другому.
- Signaling-broker всё равно нужен (но free tier у PeerJS / Trystero хватит).

**Чем реализовать:**
- [Trystero](https://github.com/dmotz/trystero) — обёртка над WebRTC через bittorrent trackers / firebase / mqtt. Без своего сервера. ~10 KB gzip.
- [PeerJS](https://peerjs.com) — public free signaling broker. Чуть ниже надёжность.

**Когда выбирать:** для MVP (быстро запустить, понять, заходит ли пользователям).

### Вариант B — Cloudflare Workers + Durable Objects

**Идея:** маленький сервер (~100 строк JS) на Cloudflare Workers. Каждая комната — отдельный Durable Object, хранит состояние партии, валидирует ходы. Игроки соединяются через WebSocket.

```
Player A ─WS─→ Worker ──→ Durable Object (room state)
Player B ─WS─→ Worker ──→ Durable Object (same room)
```

**Плюсы:**
- Server-authoritative — нельзя жульничать.
- Free tier Cloudflare щедрый (100k запросов/день, 1M Durable Object запросов/мес). Дуэль = ~30 сообщений × 2 игрока = 60 запросов. Хватит на 16k дуэлей в день.
- Edge-execution — латентность ~50–150ms по миру.
- Durable Object идеально подходит для "комнаты" — single-threaded state, никаких race conditions.

**Минусы:**
- Нужен Cloudflare аккаунт + `wrangler` для деплоя.
- Чуть дольше первый запрос (cold start ~50ms).
- Vendor lock-in (но переезд на Node+ws с redis возможен).

**Чем реализовать:**
- [Cloudflare Workers + Durable Objects](https://developers.cloudflare.com/durable-objects/)
- Альтернатива: [PartyKit](https://www.partykit.io) — обёртка над Workers/DO, чуть проще API. Тот же бэкенд под капотом.

**Когда выбирать:** для финального продукта, когда играют десятки/сотни людей одновременно.

### Вариант C — Firebase Realtime Database

**Идея:** Firebase RTDB — managed JSON-tree БД с push-обновлениями. Игроки читают/пишут в общий узел `/rooms/ABC123`, изменения долетают через listener.

```
Player A ─→ Firebase RTDB ←─ Player B
            (listeners)
```

**Плюсы:**
- Самое простое на старте — `firebase.database().ref('rooms/X').onValue(...)`.
- Free tier (Spark plan): 100 одновременных соединений, 10GB/месяц передачи. Хватит для теста.
- Auth опционально (anonymous auth работает).

**Минусы:**
- Latency ~150–300ms (push через Firebase relays).
- Vendor lock-in сильный.
- 10GB лимит легко съесть на популярном продукте.
- Нет server-authoritative валидации (можно правила писать в Security Rules, но это ограниченно).

**Когда выбирать:** если уже используется Firebase для другого. У нас не используется.

### Рекомендация

**MVP:** Вариант A (Trystero, WebRTC). Запускается за день, без аккаунтов и инфраструктуры.

**Production:** Вариант B (Cloudflare Workers + Durable Objects). Когда станет ясно, что фича нужна и стоит вкладываться в anti-cheat и стабильность.

Можно начать с A, потом мигрировать на B без изменения клиентского API (выделить `DuelTransport` интерфейс с двумя реализациями).

## 2. Архитектура клиента

Изолированный модуль, как остальная геймификация:

```
docs/preview/games/duel/
├── transport.js            — абстракция: connect, send, on('msg'), close
├── transport-trystero.js   — реализация на WebRTC
├── transport-ws.js         — реализация на WebSocket (для CF Workers)
├── matchmaking.js          — генерация room codes, lobby
├── duel-runner.js          — общий рантайм: обрабатывает протокол, рендерит UI
├── duel-A1-race.js         — конкретный режим (Race на A1)
└── duel-A4-quiz.js         — Quiz battle
```

**API на стороне клиента:**

```js
const transport = await DuelTransport.create({
  roomCode: 'ABC123',
  role: 'host',  // или 'guest'
});

transport.on('opponent-joined', () => { /* стартуем дуэль */ });
transport.on('msg', (msg) => { /* применяем ход соперника */ });
transport.send({ type:'progress', solved:[0,3,6] });
```

## 3. Протокол сообщений (общий для всех режимов)

Малый, JSON, schema-versioned.

```js
// Lobby
{ t:'hello', v:1, name:'Alex', avatar:'...' }
{ t:'ready', v:1 }

// Game start (хост рассылает)
{ t:'start', v:1, mode:'race-A1', yasnaId:'sutok', seed:42 }

// Ход / progress (mode-specific)
{ t:'tick', v:1, you:{ score:50, solved:[0,3] }, t:1234 }   // sent each 200ms

// Финал
{ t:'finish', v:1, score:100, time:23.4 }

// Системное
{ t:'leave', v:1, reason:'closed' }
{ t:'ping', v:1 }
{ t:'pong', v:1 }
```

**Synchronization principle:** оба клиента отправляют свой текущий снапшот раз в 200ms (5 раз в секунду). Мерджинг тривиальный — обновляем UI соперника. Не надо репликэйтить каждое нажатие кнопки.

## 4. Конкретные режимы дуэлей

### Режим Race-A1 (Найди Опорный Крест на скорость)

**Mechanics:**
- Хост рандомизирует `seed` → выбирает Ясну (Суток/Года/Жизни).
- Оба видят одну и ту же диаграмму с пустыми полками.
- Каждый отмечает 4 полки. Бэкенд (или хост-клиент) валидирует — если 4 правильных, фиксирует время.
- Победил тот, у кого все 4 правильные И время меньше.
- Если оба ошиблись — продолжают, пока кто-то не справится.

**Сообщения:**
```
host → guest: { t:'start', mode:'race-A1', yasnaId:'sutok', seed:42 }
both ⇄ both: { t:'progress', solved:[0,3,6], errors:1 } ×5/s
host → both: { t:'finish', winner:'A', timeA:23.4, timeB:24.1 }
```

**Time-критично?** Да, но не безумно. WebRTC P2P (~50ms latency) полностью достаточно. Сервер тоже ОК.

### Режим Quiz-A4 (Антиподы — battle)

**Mechanics:**
- Server генерирует 5 вопросов («антипод полки X в Ясне Y?»).
- Оба видят первый вопрос. Кто быстрее ответит правильно — балл.
- Если оба ошиблись — никто. Дальше следующий.
- 3 раунда выигрыш = победа.

**Time-critical:** да, измеряем мс. **WebRTC лучше**, потому что 200ms latency через сервер дают преимущество тому, у кого сервер ближе.

**Anti-cheat issue (только для важных матчей):** локальный клиент может «откатить» свой выбор после получения ответа соперника. Решение — sealed bid: каждый отправляет hash ответа сразу, контент после короткой задержки. Заморочно для MVP, но возможно для Tournament.

### Режим Mirror-B1 (Заполни пустую Ясну)

**Mechanics:**
- Дан тот же начальный стейт обоим (seed для рандома).
- Параллельно перетаскивают 12 меток на 12 позиций.
- Считается score = (правильных меток × 10) − (неправильных × 5) − (бонус за время).
- Выигрывает с большим score.

Не time-critical — отлично работает через сервер.

### Режим Tournament (асинхронный)

**Mechanics:**
- Каждый день фиксированный seed (любой может присоединиться в течение 24 часов).
- Каждый играет один раз. Score сохраняется.
- В конце дня top-10 по leaderboard.
- Без живого соединения с противником — просто запись в общую базу.

**Тут нужен сервер обязательно** (иначе негде хранить leaderboard). Cloudflare Workers + KV / D1 идеально.

## 5. Matchmaking — как находим противника

### Способ A — Room Code (рекомендуется для MVP)

- Хост жмёт «Создать комнату» → получает 6-значный код «JLD27K».
- Делится кодом другу через мессенджер.
- Друг вводит код → подключается.
- 1v1, без рандомных людей.

**Плюсы:** просто, безопасно (играешь только с теми, кому дал код), нет очереди.

**Минусы:** нужен out-of-band канал (Telegram, ссылка). Не работает «найди мне противника».

### Способ B — Public lobby

- Игроки видят список открытых комнат: «Anna хочет Race-A1 на Ясне Суток».
- Кликаешь — попадаешь в комнату.

Требует серверного хранения списка лобби. Через WebRTC можно с приседаниями (общий broker), через CF Workers — тривиально (Durable Object «Lobby»).

### Способ C — Auto-match

- Жмёшь «Найти противника» → попадаешь в очередь → сервер пэйрит первых двух подходящих.

Сложнее, требует механизма очереди (Durable Object Queue). Для MVP перебор.

**Для P0:** только Room Code. Для P2: добавить Public lobby. Для P3: Auto-match.

## 6. Identity / Profiles

Минимум для дуэлей — *display name + avatar*. Без аутентификации.

**Подход:**
- При первом входе генерим guest-id в localStorage: `guest_${random()}`.
- Просим nickname + emoji-аватар. Сохраняем в localStorage.
- Никаких email/паролей.

**Если позже хочется лидербордов:** тогда нужны устойчивые ID. Варианты:
- Sign in with Google/Apple (OAuth)
- Magic link на email
- Или Passkey/WebAuthn (новый стандарт, без паролей)

Для MVP — guest-only.

## 7. Disconnect / Reconnect / Cheat-protection

### Disconnect
- Если соперник отвалился (нет сообщений 5с) → таймаут.
- Победителем объявляется оставшийся, если он успел показать прогресс. Иначе матч аннулируется.

### Reconnect
- В URL комнаты есть seed → можно вернуться, но это сложно (state mismatch). Для MVP не делаем — дуэль 30 секунд, отвалился = проиграл.

### Cheat-protection
- Race / Mirror: оба клиента валидируют свой собственный score. Соперник видит твой `solved[]`. Если ты говоришь «у меня 4 правильных», другой клиент это проверяет своей копией данных. Если несовпадение — match invalid.
- Quiz: можно через sealed-bid (hash + reveal). Сложно. Для MVP пропускаем — играют люди, не боты.
- Tournament: тут уже нужен server-authoritative — сервер сам валидирует. Cloudflare Worker делает это легко.

## 8. Stack для MVP

### Клиент
- **Trystero** для WebRTC (бесплатные torrent trackers как signaling).
- React (уже есть в проекте).
- Один файл `duel-runner.js` для общего UI/state.
- Пер-режим файлы (`duel-race-A1.js` и т.д.) — отдельные регистрации в `window.YasnaDuels`.

### Сервер (НЕ требуется для P0)
- Понадобится для Tournament и Public Lobby. Тогда — Cloudflare Workers + Durable Objects + KV.

### Зависимости
- `trystero@latest` (~30 KB gzip)
- React (уже есть)
- Никаких других npm-пакетов

## 9. Код-скетч (P0 — Race на Trystero)

```js
// games/duel/transport-trystero.js
import { joinRoom } from 'trystero';

export class DuelTransport {
  constructor(roomCode) {
    const room = joinRoom({ appId: 'yasna-duels' }, roomCode);
    this.room = room;
    [this.sendMsg, this.getMsg] = room.makeAction('msg');
    this.handlers = new Set();
    this.getMsg((data, peerId) => {
      this.handlers.forEach(h => h(data, peerId));
    });
    room.onPeerJoin(peerId => this._fire('opponent-joined', { peerId }));
    room.onPeerLeave(peerId => this._fire('opponent-left', { peerId }));
  }
  send(msg) { this.sendMsg(msg); }
  on(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }
  close() { this.room.leave(); }
}
```

```jsx
// games/duel/duel-race-A1.js
function DuelRaceA1({ transport, yasnaId, role }) {
  const [mySolved, setMySolved] = useState([]);
  const [oppSolved, setOppSolved] = useState([]);
  const [winner, setWinner] = useState(null);
  const startRef = useRef(performance.now());

  useEffect(() => {
    const off = transport.on(msg => {
      if (msg.t === 'progress') setOppSolved(msg.solved);
      if (msg.t === 'finish') setWinner(msg.winner);
    });
    return off;
  }, []);

  useEffect(() => {
    transport.send({ t:'progress', solved: mySolved, time: performance.now() - startRef.current });
    if (isCorrect(mySolved, yasnaId)) {
      const time = performance.now() - startRef.current;
      transport.send({ t:'finish', winner: role, time });
      setWinner(role);
    }
  }, [mySolved]);

  return (
    <div className="duel-screen">
      <PlayerBar name="Вы" solved={mySolved} />
      <Star yy={getYasna(yasnaId)} hl={mySolved} onSel={i => toggleSolve(i, mySolved, setMySolved)} />
      <PlayerBar name="Противник" solved={oppSolved} />
      {winner && <WinnerOverlay winner={winner === role ? 'Вы' : 'Противник'} />}
    </div>
  );
}
```

```jsx
// games/duel/lobby.jsx
function Lobby() {
  const [code, setCode] = useState('');
  const [mode, setMode] = useState('host');  // 'host' or 'guest'
  const [transport, setTransport] = useState(null);

  const createRoom = () => {
    const newCode = generateCode();  // например JLD27K
    setCode(newCode);
    setTransport(new DuelTransport(newCode));
  };
  const joinRoom = () => {
    setTransport(new DuelTransport(code));
  };

  if (transport) return <DuelRaceA1 transport={transport} yasnaId="sutok" role={mode}/>;
  return (
    <div>
      <button onClick={createRoom}>Создать комнату</button>
      <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Код"/>
      <button onClick={joinRoom}>Присоединиться</button>
    </div>
  );
}
```

Это весь P0. ~150 строк кода клиента + 0 строк сервера.

## 10. Латентность по режимам — что приемлемо

| Режим | Acceptable latency | Best transport |
|---|---|---|
| Race-A1 (race) | < 200ms | WebRTC (50ms) или Worker (100ms) |
| Quiz-A4 (timing) | < 100ms | WebRTC (50ms) — Worker может быть несправедлив |
| Mirror-B1 | < 500ms | любой |
| Tournament (async) | irrelevant | Worker + KV |

WebRTC хорош почти везде. Sealed-bid для Quiz решает несправедливость через сервер — если когда-нибудь захочется турниров.

## 11. Стоимость

### Trystero (P0)
- Bittorrent trackers — бесплатные, общественные. Limit ~ нет официально. На деле работают для миллионов P2P игр.
- TURN сервер для NAT-fallback (~10% случаев): свой Coturn ($5/мес VPS) или платный сервис ($0.001/min). Опционально для P0.

### Cloudflare Workers + DO (P2)
- Free tier: 100k запросов/день, 1M DO ops/месяц.
- Paid tier (если перерастём): $5/месяц + $0.15 за миллион ops.
- Расчёт: дуэль ~30с × 5 msg/sec × 2 игрока = 300 msg/match. 100k requests → ~330 матчей/день. Free tier хватит на старте.

### Firebase RTDB (если выбрать C)
- Free Spark: 100 одновременных соединений, 10GB передачи.
- Paid Blaze: $5/GB передачи, $1/100k connections-hours.

## 12. Фазы реализации

| Фаза | Что | Срок | Технология |
|---|---|---|---|
| **P0** | Race-A1 на Ясне Суток. Room code (вручную, копипастом). 1v1. | 1 день | Trystero |
| **P1** | + Quiz-A4 + Mirror-B1. Никнейм. Локальная история матчей. | 1 день | Trystero |
| **P2** | + Public lobby. Возможно — Cloudflare Worker для регистрации лобби. | 2 дня | Trystero (game) + CF Worker (lobby) |
| **P3** | + Tournament (daily challenge с лидербордом). Анти-чит на сервере. | 3 дня | Cloudflare Worker + Durable Object + KV |
| **P4** | + Аккаунты (Sign in with Google), персистентный rating ELO. | 3 дня | Worker + KV + OAuth |

## 13. Риски и не-цели

### Риски
- **NAT-traversal failure** — ~10% игроков не смогут подключиться через WebRTC. Решение P0: показывать «попробуйте мобильную сеть, либо предложите другу подключиться». Решение P2: TURN-сервер как fallback.
- **Чит на Quiz** — клиент может «знать ответ соперника» в P2P. Решение: для P0 это игра друзей, не турнир, ОК. Для P3 — sealed-bid через сервер.
- **Раскрытие IP** — WebRTC P2P раскрывает IP-адреса друг другу (для NAT-traversal). Это риск приватности. Решение: использовать TURN relay (тогда трафик идёт через сервер, IP скрыт). Опционально для пользователей через настройку.
- **Дисбаланс подключений** — у одного 4G, у другого Wi-Fi 1Gbit. Игрок с медленным интернетом проигрывает не из-за знаний. Решение: измеряем round-trip и ждём «синхронизации» перед стартом таймера.

### Не-цели
- ❌ Не делать команды 2v2 — усложняет UX и сетевой код.
- ❌ Не делать спектаторов — Twitch-style. Нет смысла на старте.
- ❌ Не делать чат во время дуэли — создаст токсичность. Только эмодзи-реакции после матча.
- ❌ Не делать ranked-систему до P4 — без аккаунтов смысла нет.
- ❌ Не делать античит выше «friends-level» в P0–P2 — это игра друзей, не киберспорт.

## 14. Итоговая рекомендация

**Стартовать с Trystero+WebRTC (Вариант A) для P0.** За 1 день получим работающий Race-A1: один игрок создаёт код, второй вводит, соревнуются. Без сервера, без аккаунтов, без денег.

Если зайдёт — на P3 (через 1–2 спринта) добавить Cloudflare Worker для Tournament и Public Lobby. Это 2-я итерация инфраструктуры, но клиентский код остаётся почти весь.

**Минимальный коммит P0:** `docs/preview/games/duel/` с 4 файлами (~200 строк), кнопка «Дуэль» в каталоге игр + одна dependency (Trystero CDN). Всё.

---

## Резюме

Технически дуэли реализуемы без серверной инфраструктуры через WebRTC P2P (Trystero). MVP — за день. Когда захочется турниров и лидербордов — добавляем Cloudflare Worker (~$0–5/мес). Никакого vendor lock-in, никаких аккаунтов на старте, всё интегрируется в текущий статичный сайт без правок существующих модулей.

**Решение, которое предлагается принять прямо сейчас:** идти по варианту A (Trystero) для P0–P2, оставить вариант B (Cloudflare Worker) на P3, когда станет ясно, что нужна персистентность и server-authoritative anti-cheat.
