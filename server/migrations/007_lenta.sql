-- ═══════════════════════════════════════════════════════════════════
-- Миграция 007 — лента публикаций управлений.
--
-- ЗАЧЕМ. У управлений центра есть свои каналы (Телеграм, видеотека на
-- Rutube), и человек в приложении узнаёт о новом уроке или разборе только
-- если сам ходит по всем адресам. Лента собирает свежее в одно место и
-- показывает его в приложении своими силами: без чужих скриптов и без
-- обращений телефона к t.me (из России они отвечают через раз).
--
-- ПОЧЕМУ СБОР НА СЕРВЕРЕ. Витрина приложения самодостаточна: сборщик
-- витрины запрещает грузить чужие ресурсы, а сети Телеграма из России режут.
-- Поэтому источники опрашивает отдельная функция по таймеру (yasna-lenta-sbor,
-- server/lenta-sbor.js), складывает разобранные записи сюда, а копии
-- превью — в бакет yasnalab.ru (lenta/…). Приложение ходит только к своему
-- API (server/lenta.js в пакете auth-telegram) и своему бакету.
--
-- ЧЕТЫРЕ ТАБЛИЦЫ.
--   lenta_istochniki — каналы как ДАННЫЕ, а не код сборщика: включить,
--     выключить, сменить период можно без выкатки. Там же согласие
--     правообладателя (soglasie_at, licenziya_ssylka, vedushchij) и состояние
--     сбора: когда проверяли, когда удалось, ошибка, сбоев подряд, дата
--     последней публикации («источник молчит N дней»).
--   lenta_publikacii — записи. Ключ istochnik:kanal:id даёт дедупликацию
--     самим ключом: повторный запуск ничего не удваивает. skryto — запись
--     убрана (модератором или потому, что исчезла в источнике); такие строки
--     ручки не отдают никогда, а сборщик удаляет их картинки из бакета.
--   lenta_zhurnal — след каждого опроса и каждого чтения ленты (otkuda),
--     на 30 дней, чтобы разбирать «почему лента застыла» по фактам.
--   lenta_zhaloby — обращения «Пожаловаться на запись» из приложения; срок
--     разбора — 3 дня.
--
-- КУРСОР ЛЕНТЫ — (data DESC, klyuch DESC): data — время публикации до
-- секунды, klyuch — разделитель равных секунд (альбомы дают несколько
-- записей с одной меткой). Индекс po_data держит общую ленту, po_kanalu —
-- ленту канала и сверку сборщика.
--
-- ХРАНЕНИЕ. Только UTC. Сборщик раз в сутки оставляет у канала «последние
-- 10 записей без срока + всё моложе 365 дней» (иначе молчащая Неглинка
-- тихо исчезла бы весной 2027), журнал — 30 дней.
--
-- ЧУЖОЙ ТЕКСТ. tekst и zagolovok — цитаты из каналов, обрезанные по слову
-- (120 / 400 знаков), без разметки. Показывать только через textContent.
--
-- РАННЕР. apply-migrations.sh вырезает комментарии «--» и делит файл по «;»,
-- поэтому в строковых литералах ниже нет ни точки с запятой, ни двойного
-- дефиса.
-- ═══════════════════════════════════════════════════════════════════

-- ─── источники ─────────────────────────────────────────────────────
CREATE TABLE lenta_istochniki (
  klyuch          Utf8 NOT NULL,      -- istochnik + ':' + kanal
  istochnik       Utf8 NOT NULL,      -- 'telegram' | 'rutube' | 'dzen' | 'vk' | 'youtube'
  kanal           Utf8 NOT NULL,      -- ключ канала внутри источника (имя, id)
  adres           Utf8 NOT NULL,      -- публичная ссылка, как в данных управления
  nazvanie        Utf8,               -- имя канала из шапки, обновляет сборщик
  upravlenie      Utf8 NOT NULL,      -- главное управление (для подписи записи)
  upravleniya     Utf8 NOT NULL,      -- все управления через запятую (общие каналы)
  vklyuchen       Bool NOT NULL,      -- false — не опрашивать, но показывать в состоянии
  period_min      Uint32 NOT NULL,    -- не чаще, чем раз в столько минут
  zametka         Utf8,               -- почему выключен или что особенного
  soglasie_at     Timestamp,          -- когда получено согласие правообладателя
  licenziya_ssylka Utf8,              -- где лежит лицензия (ссылка на документ)
  vedushchij      Utf8,               -- имя ведущего личного канала из лицензии
  proveren_at     Timestamp,          -- последний опрос (любой исход)
  udacha_at       Timestamp,          -- последний удачный опрос
  oshibka         Utf8,               -- текст последней ошибки, NULL если удача
  oshibok_podryad Uint32,             -- сбросить в 0 при удаче
  poslednyaya_publikaciya Timestamp,  -- data самой свежей записи канала
  zapisej         Uint64,             -- сколько видимых строк канала в lenta_publikacii
  obnovleno_at    Timestamp NOT NULL,
  PRIMARY KEY (klyuch)
);

-- ─── публикации ────────────────────────────────────────────────────
CREATE TABLE lenta_publikacii (
  klyuch          Utf8 NOT NULL,      -- istochnik + ':' + kanal + ':' + id
  istochnik       Utf8 NOT NULL,
  kanal           Utf8 NOT NULL,
  id              Utf8 NOT NULL,      -- внешний id записи в источнике
  data            Timestamp NOT NULL, -- время публикации (UTC, до секунды)
  upravlenie      Utf8 NOT NULL,      -- главное управление канала на момент сбора
  upravleniya     Utf8,               -- все управления канала через запятую
  tip             Utf8 NOT NULL,      -- 'tekst' | 'foto' | 'video' | 'ssylka' | 'statya' | 'anons'
  zagolovok       Utf8 NOT NULL,      -- до 120 знаков, пустая строка = заголовка нет
  tekst           Utf8,               -- до 400 знаков, обрезка по слову
  ssylka          Utf8 NOT NULL,      -- оригинал в источнике
  kartinka        Utf8,               -- копия миниатюры (≤160 px) в бакете или NULL
  kartinka_polnaya Utf8,              -- копия ≤480 px в бакете или NULL
  kartinka_istochnika Utf8,           -- откуда качали (для повторной попытки)
  kartinka_popytok Uint32,            -- неудачных скачиваний, после 3 не трогаем
  kartinok        Uint32,             -- сколько фото в записи (альбом)
  dlitelnost_s    Uint32,             -- для видео
  bez_prevyu      Bool,               -- стикер, голосовое, кружок: превью нет
  ssylka_v_zapisi Utf8,               -- хост ссылки из записи (только хост)
  skryto          Bool,               -- убрана: ручки не отдают, картинки удаляются
  skryto_prichina Utf8,               -- 'udaleno_v_istochnike' | причина модератора
  skryto_at       Timestamp,
  tekst_hash      Utf8,               -- отпечаток текста для окна правок 7 дней
  sobrano_at      Timestamp NOT NULL,
  obnovleno_at    Timestamp NOT NULL,
  PRIMARY KEY (klyuch),
  INDEX lenta_publikacii_po_data GLOBAL ON (data),
  INDEX lenta_publikacii_po_kanalu GLOBAL ON (istochnik, kanal, data)
);

-- ─── журнал опросов и чтений ───────────────────────────────────────
CREATE TABLE lenta_zhurnal (
  istochnik_klyuch Utf8 NOT NULL,     -- ключ источника, 'uborka' или 'lenta' для чтений
  at              Timestamp NOT NULL,
  ishod           Utf8 NOT NULL,      -- 'ok' | 'pusto' | 'oshibka' | 'propusk' | 'trevoga' | 'otkaz_robots'
  soobshchenie    Utf8,               -- текст ошибки или примечание
  dlitelnost_ms   Uint32,
  novyh           Uint32,
  otkuda          Utf8,               -- 'timer' | 'ruchnoj' | segodnya | biblioteka | upravleniya | lenta
  PRIMARY KEY (istochnik_klyuch, at),
  INDEX lenta_zhurnal_po_at GLOBAL ON (at)
);

-- ─── жалобы из приложения ──────────────────────────────────────────
CREATE TABLE lenta_zhaloby (
  klyuch          Utf8 NOT NULL,      -- klyuch публикации
  at              Timestamp NOT NULL,
  prichina        Utf8 NOT NULL,      -- 'ya_na_foto' | 'prava' | 'reklama' | 'drugoe'
  tekst           Utf8,
  kontakt         Utf8,
  ustrojstvo      Utf8,               -- хеш секрета устройства (лимит 5 в час)
  sostoyanie      Utf8 NOT NULL,      -- 'novaya' | 'razobrana'
  PRIMARY KEY (klyuch, at)
);

-- ─── индекс секрета устройства ─────────────────────────────────────
-- /lenta/zhaloba принимает только секрет ПРИВЯЗАННОГО устройства (иначе
-- лимит «5 в час» обходился случайными секретами). Клиент шлёт секрет
-- заголовком, а deviceId — не всегда, поэтому строку device_auth ищем по
-- хешу: нужен вторичный индекс. Строится в фоне; если раннер не дождался —
-- вручную: ydb table index add global-sync --index-name device_auth_po_secret_hash
-- --columns secret_hash device_auth
ALTER TABLE device_auth ADD INDEX device_auth_po_secret_hash GLOBAL ON (secret_hash);

-- ─── права ─────────────────────────────────────────────────────────
-- Состояние сбора и модерация открыты суперадмину и админу.
UPSERT INTO role_grants (role_id, feature, granted, updated_by, updated_at) VALUES
  ("superadmin"u, "cap:lenta.istochniki"u, true, "migration:007"u, CurrentUtcTimestamp()),
  ("superadmin"u, "cap:lenta.moderate"u,   true, "migration:007"u, CurrentUtcTimestamp()),
  ("admin"u,      "cap:lenta.istochniki"u, true, "migration:007"u, CurrentUtcTimestamp()),
  ("admin"u,      "cap:lenta.moderate"u,   true, "migration:007"u, CurrentUtcTimestamp());

-- ─── каналы управлений ─────────────────────────────────────────────
-- Один UPSERT на канал: раннер шлёт утверждения по одному, и упавший канал
-- не утянет остальные. Выключенные каналы записаны нарочно: состояние сбора
-- должно честно показывать, почему у управления ленты нет.
--
-- Первый этап (решение владельца 05.09.2026): четыре канала Телеграма и
-- видеотека Rutube. Лицензии и согласие правообладателей получены —
-- soglasie_at ставится сейчас, ссылку на документ (licenziya_ssylka) и имя
-- ведущего личного канала (vedushchij) владелец вписывает руками.

UPSERT INTO lenta_istochniki (klyuch, istochnik, kanal, adres, upravlenie, upravleniya, vklyuchen, period_min, zametka, soglasie_at, obnovleno_at) VALUES
  ("telegram:russkaya_yasna"u, "telegram"u, "russkaya_yasna"u, "https://t.me/russkaya_yasna"u,
   "yasna-shkola"u, "yasna-shkola,granika,centr"u, true, 15u,
   "лицензия получена 05.09.2026. Общий канал Ясна-Школы, Граники и центра, собирается один раз"u,
   CurrentUtcTimestamp(), CurrentUtcTimestamp());

UPSERT INTO lenta_istochniki (klyuch, istochnik, kanal, adres, upravlenie, upravleniya, vklyuchen, period_min, zametka, soglasie_at, obnovleno_at) VALUES
  ("telegram:astronevod"u, "telegram"u, "astronevod"u, "https://t.me/astronevod"u,
   "astronevod"u, "astronevod"u, true, 15u,
   "лицензия получена 05.09.2026"u,
   CurrentUtcTimestamp(), CurrentUtcTimestamp());

UPSERT INTO lenta_istochniki (klyuch, istochnik, kanal, adres, upravlenie, upravleniya, vklyuchen, period_min, zametka, soglasie_at, obnovleno_at) VALUES
  ("telegram:naturnie_uroki"u, "telegram"u, "naturnie_uroki"u, "https://t.me/naturnie_uroki"u,
   "marshruty"u, "marshruty"u, true, 15u,
   "лицензия получена 05.09.2026. Анонсы правятся датами: окно правок 7 дней"u,
   CurrentUtcTimestamp(), CurrentUtcTimestamp());

UPSERT INTO lenta_istochniki (klyuch, istochnik, kanal, adres, upravlenie, upravleniya, vklyuchen, period_min, zametka, soglasie_at, obnovleno_at) VALUES
  ("telegram:neglinka78"u, "telegram"u, "neglinka78"u, "https://t.me/neglinka78"u,
   "neglinka"u, "neglinka"u, true, 15u,
   "лицензия получена 05.09.2026. Канал молчит с 26.06.2026, собирается как архив"u,
   CurrentUtcTimestamp(), CurrentUtcTimestamp());

-- Rutube: только официальный RSS канала (заголовок, длительность, ссылка,
-- дата загрузки), без кадров и описаний по условиям площадки. Даты в RSS —
-- даты загрузки роликов 2023–2024, поэтому канал живёт под чипом «Видео»
-- как архив, а уборка оставляет у него 10 последних записей.
UPSERT INTO lenta_istochniki (klyuch, istochnik, kanal, adres, upravlenie, upravleniya, vklyuchen, period_min, zametka, soglasie_at, obnovleno_at) VALUES
  ("rutube:24295181"u, "rutube"u, "24295181"u, "https://rutube.ru/channel/24295181"u,
   "yasna-shkola"u, "yasna-shkola"u, true, 60u,
   "лицензия получена 05.09.2026. Только официальный RSS: заголовок, длительность, ссылка, без кадров и описаний"u,
   CurrentUtcTimestamp(), CurrentUtcTimestamp());

-- Телеграм Александрии: канал заведён 06.07.2026, записей нет (одна
-- служебная). Выключен до первой публикации и лицензии.
UPSERT INTO lenta_istochniki (klyuch, istochnik, kanal, adres, upravlenie, upravleniya, vklyuchen, period_min, zametka, obnovleno_at) VALUES
  ("telegram:aleksandriya_2026"u, "telegram"u, "aleksandriya_2026"u, "https://t.me/aleksandriya_2026"u,
   "alexandria"u, "alexandria"u, false, 1440u,
   "канал пуст (одна служебная запись), лицензии нет. Включить после первой публикации и лицензии"u,
   CurrentUtcTimestamp());

-- Дзен: условия площадки (п. 5.1 и 5.3.1) запрещают копирование содержимого
-- и сбор третьими лицами. Не собирается без письменного разрешения Дзена.
UPSERT INTO lenta_istochniki (klyuch, istochnik, kanal, adres, upravlenie, upravleniya, vklyuchen, period_min, zametka, obnovleno_at) VALUES
  ("dzen:astronevod"u, "dzen"u, "astronevod"u, "https://dzen.ru/astronevod"u,
   "astronevod"u, "astronevod"u, false, 1440u,
   "условия Дзена запрещают копирование и сбор третьими лицами. Молчит с 04.2025, жизнь канала в Телеграме"u,
   CurrentUtcTimestamp());

UPSERT INTO lenta_istochniki (klyuch, istochnik, kanal, adres, upravlenie, upravleniya, vklyuchen, period_min, zametka, obnovleno_at) VALUES
  ("dzen:629888dd626c9e4130ceb7ea"u, "dzen"u, "629888dd626c9e4130ceb7ea"u, "https://dzen.ru/id/629888dd626c9e4130ceb7ea"u,
   "neglinka"u, "neglinka"u, false, 1440u,
   "условия Дзена запрещают копирование и сбор третьими лицами. «Байки нашего Костра», молчит с 07.2023"u,
   CurrentUtcTimestamp());

UPSERT INTO lenta_istochniki (klyuch, istochnik, kanal, adres, upravlenie, upravleniya, vklyuchen, period_min, zametka, obnovleno_at) VALUES
  ("dzen:5e9a2d632385352365504c51"u, "dzen"u, "5e9a2d632385352365504c51"u, "https://dzen.ru/id/5e9a2d632385352365504c51"u,
   "izvod"u, "izvod"u, false, 1440u,
   "условия Дзена запрещают копирование и сбор третьими лицами. «Очевидное-невероятное», единственная площадка Извода: включать только с разрешения Дзена"u,
   CurrentUtcTimestamp());

-- ВКонтакте: правила платформы запрещают копировать медиа, стены мертвы
-- (yasnaslovo — последняя запись 12.03.2026, public_38meridian — с 08.2022).
UPSERT INTO lenta_istochniki (klyuch, istochnik, kanal, adres, upravlenie, upravleniya, vklyuchen, period_min, zametka, obnovleno_at) VALUES
  ("vk:yasnaslovo"u, "vk"u, "yasnaslovo"u, "https://vk.com/yasnaslovo"u,
   "yasna-shkola"u, "yasna-shkola"u, false, 1440u,
   "правила ВКонтакте запрещают копирование медиа, стена обновляется редко (последняя запись 12.03.2026)"u,
   CurrentUtcTimestamp());

UPSERT INTO lenta_istochniki (klyuch, istochnik, kanal, adres, upravlenie, upravleniya, vklyuchen, period_min, zametka, obnovleno_at) VALUES
  ("vk:public_38meridian"u, "vk"u, "public_38meridian"u, "https://vk.com/public_38meridian"u,
   "neglinka"u, "neglinka"u, false, 1440u,
   "правила ВКонтакте запрещают копирование медиа, стена мертва с 08.2022"u,
   CurrentUtcTimestamp());

-- YouTube: условия запрещают сборщики и копирование, из России не
-- открывается, публикаций нет с 30.12.2024. Остаётся ссылкой на карточке.
UPSERT INTO lenta_istochniki (klyuch, istochnik, kanal, adres, upravlenie, upravleniya, vklyuchen, period_min, zametka, obnovleno_at) VALUES
  ("youtube:russkaya_yasna"u, "youtube"u, "russkaya_yasna"u, "https://youtube.com/@russkaya_yasna"u,
   "yasna-shkola"u, "yasna-shkola"u, false, 1440u,
   "условия YouTube запрещают сборщики и копирование, из России не открывается, публикаций нет с 30.12.2024"u,
   CurrentUtcTimestamp());
