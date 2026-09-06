-- 009 · Сборщик ходит к Телеграму раз в ЧАС (решение владельца 05.09.2026),
-- а не раз в 15 минут: записей в каналах одна-две в день, чаще не нужно.
-- Тик таймера остаётся 15-минутным: после сбоя источник переспрашивается
-- уже на следующем тике (см. отбор просроченных в server/lenta-sbor.js).
UPDATE lenta_istochniki
SET period_min = 60u, obnovleno_at = CurrentUtcTimestamp()
WHERE istochnik = "telegram"u AND vklyuchen;

-- Журнал чистит сама база: строки старше 30 дней исчезают по TTL — уборка
-- сборщика (5 × 500 строк в сутки) не поспевала бы за чтениями ленты.
ALTER TABLE lenta_zhurnal SET (TTL = Interval("P30D") ON at);
