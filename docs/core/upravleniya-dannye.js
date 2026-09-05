/* ═══════════════════════════════════════════════════════════════════════
   ДВЕНАДЦАТЬ УПРАВЛЕНИЙ ЦЕНТРА «ЗОЛОТОЙ ЯСЕНЬ» — данные для приложения.

   ОТКУДА. Собрано из content/upravleniya.json репозитория yasna3 (сайт
   zolotoj-yasen.ru); памятка по полям — content/upravleniya.md там же.
   При расхождении прав сайт. Дата сборки — поле obnovleno.

   ПОЧЕМУ ЛЕЖИТ ЗДЕСЬ, А НЕ ТЯНЕТСЯ С GITHUB. Приложение обязано быть
   самодостаточным: сборщик витрины проверяет, что страницы ничего не грузят
   с чужих серверов, а GitHub из российских сетей открывается через раз.
   Эмблемы — рядом, в assets/upravleniya/, по тем же именам файлов.

   ПРАВИЛА, КОТОРЫЕ ДЕРЖИТ САЙТ (и мы вслед за ним):
     • подразделения называются «управления» — не направления, не отделы;
     • названия только по-русски и как в файле: Гербальдика, ЛитПроСвет;
     • эмблемы принадлежат управлениям: показывать как есть, на светлой
       подложке, без перекраски и обрезки; пять из них растровые с
       непрозрачным фоном — на тёмной теме нужен светлый диск;
     • где stranica == null — ведём на zayavka;
     • общие телефоны центра — в блоке centr; почта proyasna@yandex.ru —
       только у «Воспитания и Образования»;
     • числа, даты, обещания — только те, что уже есть на сайте.

   Тот же порядок, что у дерева знаний: обычный script-тег, экспорт в
   window.YasnaUpravleniya. Обновлять — пересобрать из JSON, не править руками.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
window.YasnaUpravleniya = {
 "obnovleno": "2026-09-05",
 "centr": {
  "nazvanie": "Золотой Ясень",
  "podzagolovok": "Интеграционный центр",
  "sajt": "https://zolotoj-yasen.ru",
  "telefony": [
   "+7 908 293-93-63",
   "+7 915 259-52-50"
  ],
  "telegram": "https://t.me/russkaya_yasna",
  "operator": "ИП Архипов Сергей Юрьевич, ИНН 771409900020, ОГРНИП 317774600605551"
 },
 "sobytie": {
  "nazvanie": "Большой лист",
  "chto": "Съезд Ясны: общий сбор всех двенадцати управлений",
  "data": "2026-09-26",
  "vremya": "16:00–20:00",
  "den": "суббота",
  "mesto": "Конференц-зал в историческом центре Москвы, 3 минуты пешком от метро Марксистская и Таганская; точный адрес присылают после регистрации",
  "vhod": "свободный, по записи",
  "stranica": "https://zolotoj-yasen.ru/bolshoy-list/",
  "zapis": "https://zolotoj-yasen.ru/zayavka/?goal=day",
  "kalendar": "https://zolotoj-yasen.ru/bolshoy-list/bolshoy-list.ics"
 },
 "upravleniya": [
  {
   "nomer": 1,
   "id": "yasna-shkola",
   "nazvanie": "Ясна-Школа",
   "temy": [
    "Обучение",
    "информационное"
   ],
   "opisanie": "Русская Школа Русского Языка. Уроки РШРЯ, курсы и статьи о русском языке, взгляде на мир и русской семье.",
   "rukovoditel": "Архипов Сергей Юрьевич",
   "format": "Онлайн · очно возможно",
   "emblema": "assets/upravleniya/yasna-shkola.png",
   "zayavka": "https://zolotoj-yasen.ru/zayavka/?dir=yasna-shkola",
   "stranica": "https://zolotoj-yasen.ru/upravleniya/yasna-shkola/",
   "kontakty": [
    "https://rutube.ru/channel/24295181",
    "https://t.me/Yasna_axlbot",
    "https://t.me/russkaya_yasna",
    "https://vk.com/yasnaslovo",
    "https://youtube.com/@russkaya_yasna"
   ]
  },
  {
   "nomer": 2,
   "id": "vospitanie",
   "nazvanie": "Воспитание и Образование",
   "temy": [
    "Воспитание",
    "образование"
   ],
   "opisanie": "Родителям рассказываем, что такое воспитание, детям предлагаем образовательный курс. Четыре опоры: телосложение, обучение, образование, просвещение.",
   "rukovoditel": "Костромитин Руслан Александрович",
   "format": "Москва · Петербург · онлайн",
   "emblema": "assets/upravleniya/vospitanie.svg",
   "zayavka": null,
   "stranica": "https://zolotoj-yasen.ru/upravleniya/vospitanie/",
   "kontakty": [
    "mailto:proyasna@yandex.ru"
   ]
  },
  {
   "nomer": 3,
   "id": "alexandria",
   "nazvanie": "Александрия",
   "temy": [
    "Раскладки",
    "теория и практика"
   ],
   "opisanie": "Теоретическое ядро Ясны: изучаем построение раскладок — «разложи всё и соедини всё». От медицины до истории.",
   "rukovoditel": "Фахрутдинов Тимур Михайлович",
   "format": "Петербург + онлайн",
   "emblema": "assets/upravleniya/alexandria-emblem.jpg",
   "zayavka": "https://zolotoj-yasen.ru/zayavka/?dir=alexandria",
   "stranica": "https://zolotoj-yasen.ru/upravleniya/alexandria/",
   "kontakty": [
    "https://t.me/aleksandriya_2026",
    "https://t.me/mobictas",
    "https://t.me/yasna_besedy",
    "mailto:admin@yasna.spb.ru"
   ]
  },
  {
   "nomer": 4,
   "id": "neglinka",
   "nazvanie": "Неглинка",
   "temy": [
    "История",
    "география"
   ],
   "opisanie": "Проясняем историю и географию России — гуляем по Москве, читаем то, что зашифровано в улицах.",
   "rukovoditel": "Воинов Леонид Викторович",
   "format": "Москва + онлайн",
   "emblema": "assets/upravleniya/neglinka-emblem.png",
   "zayavka": "https://zolotoj-yasen.ru/zayavka/?dir=neglinka",
   "stranica": "https://zolotoj-yasen.ru/upravleniya/neglinka/",
   "kontakty": [
    "https://dzen.ru/a/ZDFn-JkZ_iBQDXcC",
    "https://dzen.ru/a/ZGFqHUumAiQFTbZF",
    "https://dzen.ru/id/629888dd626c9e4130ceb7ea",
    "https://t.me/neglinka78",
    "https://vk.com/public_38meridian"
   ]
  },
  {
   "nomer": 5,
   "id": "granika",
   "nazvanie": "Граника",
   "temy": [
    "Архитектура",
    "астрономия"
   ],
   "opisanie": "Читаем язык предков в камне — усадьбы, крепости, монастыри и храмовые комплексы. Русский классицизм и деревянное зодчество.",
   "rukovoditel": "Акимов Александр Анатольевич",
   "format": "Москва + онлайн",
   "emblema": "assets/upravleniya/granika.png",
   "zayavka": "https://zolotoj-yasen.ru/zayavka/?dir=granika",
   "stranica": "https://zolotoj-yasen.ru/upravleniya/granika/",
   "kontakty": [
    "https://t.me/russkaya_yasna"
   ]
  },
  {
   "nomer": 6,
   "id": "astronevod",
   "nazvanie": "Астроневод",
   "temy": [
    "Астросмыслы",
    "астрокоды"
   ],
   "opisanie": "Астрономия наших предков: археоастрономия древних поселений, звёздный язык сказок и баллад, астрономические сюжеты в иконописи. Как небо отражалось в земной планировке.",
   "rukovoditel": "Виноградова Анна Львовна",
   "format": "Москва + онлайн",
   "emblema": "assets/upravleniya/astronevod.png",
   "zayavka": "https://zolotoj-yasen.ru/zayavka/?dir=astronevod",
   "stranica": "https://zolotoj-yasen.ru/upravleniya/astronevod/",
   "kontakty": [
    "https://dzen.ru/astronevod",
    "https://t.me/astronevod"
   ]
  },
  {
   "nomer": 7,
   "id": "marshruty",
   "nazvanie": "Ясные маршруты",
   "temy": [
    "Натурные уроки",
    "исследование"
   ],
   "opisanie": "Натурные уроки по городам: читаем устройство поселений через астрономию, географию, архитектуру и историю. Москва, Петербург, Кронштадт.",
   "rukovoditel": "Дрожжина Лидия Андреевна",
   "format": "Москва · Петербург · Кронштадт",
   "emblema": "assets/upravleniya/marshruty.png",
   "zayavka": "https://zolotoj-yasen.ru/zayavka/?dir=marshruty",
   "stranica": "https://zolotoj-yasen.ru/upravleniya/marshruty/",
   "kontakty": [
    "https://t.me/naturnie_uroki"
   ]
  },
  {
   "nomer": 8,
   "id": "litprosvet",
   "nazvanie": "ЛитПроСвет",
   "temy": [
    "Литература"
   ],
   "opisanie": "Литература как способ думать и чувствовать. Возвращаем людей к чтению — клубы, аудиолекторий, разборы классики.",
   "rukovoditel": "Скиба Анастасия Александровна",
   "format": "Москва + онлайн",
   "emblema": "assets/upravleniya/litprosvet-mark.svg",
   "zayavka": "https://zolotoj-yasen.ru/zayavka/?dir=litprosvet",
   "stranica": null,
   "kontakty": []
  },
  {
   "nomer": 9,
   "id": "izvod",
   "nazvanie": "Извод",
   "temy": [
    "Языки"
   ],
   "opisanie": "Устройство языка и изводы слов — тех, что сформировали смыслы русского мировоззрения. Фольклор, история, истинные смыслы фразеологизмов.",
   "rukovoditel": "Ванин Александр Николаевич",
   "format": "Москва + онлайн",
   "emblema": "assets/upravleniya/izvod.png",
   "zayavka": "https://zolotoj-yasen.ru/zayavka/?dir=izvod",
   "stranica": "https://zolotoj-yasen.ru/upravleniya/izvod/",
   "kontakty": [
    "https://dzen.ru/id/5e9a2d632385352365504c51",
    "https://t.me/+9ZxiZ56f8zY3ODhi",
    "https://t.me/+zWpMyIdJOJdlNjBi"
   ]
  },
  {
   "nomer": 10,
   "id": "dzhiva",
   "nazvanie": "Джива",
   "temy": [
    "Здоровье",
    "тело"
   ],
   "opisanie": "Здоровье и тело в русской традиции. Дыхание, движение, голос, уклад — практики возвращения к себе.",
   "rukovoditel": "Белова Екатерина Андреевна",
   "format": "Москва + онлайн",
   "emblema": "assets/upravleniya/dzhiva.png",
   "zayavka": "https://zolotoj-yasen.ru/zayavka/?dir=dzhiva",
   "stranica": "https://zolotoj-yasen.ru/upravleniya/dzhiva/",
   "kontakty": []
  },
  {
   "nomer": 11,
   "id": "parad",
   "nazvanie": "Парад Красоты",
   "temy": [
    "Красота",
    "лад"
   ],
   "opisanie": "Красота, лад и любовь как уклад жизни. Эстетика русской традиции — от образа до отношений между людьми.",
   "rukovoditel": "Стефарова Вишня Владимировна",
   "format": "Москва + онлайн",
   "emblema": "assets/upravleniya/parad.png",
   "zayavka": "https://zolotoj-yasen.ru/zayavka/?dir=parad",
   "stranica": null,
   "kontakty": []
  },
  {
   "nomer": 12,
   "id": "geraldika",
   "nazvanie": "Гербальдика",
   "temy": [
    "Символика",
    "гербы"
   ],
   "opisanie": "Родовые знаки, гербы и символика. Читаем язык образов — что и зачем зашифровано в гербах городов и родов.",
   "rukovoditel": "Грачёв Алексей Анатольевич",
   "format": "Москва + онлайн",
   "emblema": "assets/upravleniya/geraldika.png",
   "zayavka": "https://zolotoj-yasen.ru/zayavka/?dir=geraldika",
   "stranica": "https://zolotoj-yasen.ru/upravleniya/geraldika/",
   "kontakty": []
  }
 ]
};
})();
