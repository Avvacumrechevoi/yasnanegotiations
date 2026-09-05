-- 008 · Rutube выключен из ленты: robots.txt площадки запрещает /rss/ и /api/
-- для всех роботов (User-agent: *, проверено 05.09.2026), а сборщик уважает
-- robots.txt — первый же заход честно отказался («otkaz_robots»). Условия
-- Rutube (п. 2.4) и так позволяли только ссылку; ссылка на канал остаётся на
-- карточке управления Ясна-Школа (upravleniya.html), в ленте видео Rutube нет.
-- Включать обратно — только с письменного разрешения площадки.
UPDATE lenta_istochniki
SET vklyuchen = false,
    period_min = 1440u,
    zametka = "выключен 05.09.2026: robots.txt Rutube запрещает /rss/ и /api/ всем роботам — ссылка на канал остаётся на карточке управления"u,
    obnovleno_at = CurrentUtcTimestamp()
WHERE klyuch = "rutube:24295181"u;
