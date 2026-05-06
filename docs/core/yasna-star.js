// ═══════════════════════════════════════════════════════════════════
// YASNA CORE — Layer 1
// The interactive 12-position star, constants (CR/PR/REF/T/FL),
// Editor, Picker, Verification, Glossary. This is the product itself.
// Do not edit while editing lessons.
// ═══════════════════════════════════════════════════════════════════

const{useState,useMemo,useEffect,useRef,useCallback}=React;


const CR={support:{id:'support',n:'Крест Опоры',p:[0,3,6,9],c:'#E8364F',v:'Надежда',
   questions:['Если убрать этот элемент — Ясна всё ещё имеет смысл? Если да — он не Опорный.','Это одно из 4 самых важных состояний/событий в вашем явлении?'],
   mistakes:['Поставить второстепенный элемент на опорную позицию.','Забыть проверить ось: 0 и 6 должны быть антиподами, 3 и 9 тоже.'],
   related:['opp','type','halves']},right:{id:'right',n:'Крест Любви',p:[1,4,7,10],c:'#E8A834',v:'Любовь',
   questions:['Этот элемент — следствие того, что произошло на предыдущей позиции?','Уберите предыдущую Опорную — этот элемент потеряет смысл?'],
   mistakes:['Поставить причину вместо следствия. Правый Крест — это ИТОГ, а не НАЧАЛО.','Перепутать с Левым крестом: Правый = результат, Левый = подготовка.'],
   related:['left','support','rhythm']},left:{id:'left',n:'Крест Веры',p:[2,5,8,11],c:'#5B9CF6',v:'Вера',
   questions:['Этот элемент готовит к тому, что будет дальше?','Он несёт в себе ожидание, предчувствие, настройку?'],
   mistakes:['Поставить результат вместо подготовки. Левый Крест — это ПЕРЕД, а не ПОСЛЕ.','Забыть, что Левый Крест — самый «тихий». Здесь не должно быть ярких событий.'],
   related:['right','support','rhythm']}};
const PR={she:{id:'she',n:'Земля ШЭ',p:[0,4,8],c:'#C0943A',el:'Земля',
   questions:['Все три элемента (0, 4, 8) — про стабильность, основу, надёжность?','Между ними чувствуется внутренняя связь? Общая тема?'],
   mistakes:['Один из трёх элементов — про перемены, движение, текучесть (это Вода ФО, не Земля).'],
   related:['tsi','type']},fo:{id:'fo',n:'Вода ФО',p:[1,5,9],c:'#4090D8',el:'Вода',
   questions:['Все три элемента (1, 5, 9) — про движение, поток, перемену?','Все три — короткие переломные моменты?'],
   mistakes:['Один из трёх — устойчивый и неизменный (это Земля ШЭ, не Вода).'],
   related:['ha','type']},tsi:{id:'tsi',n:'Воздух ЦИ',p:[2,6,10],c:'#70B8F0',el:'Воздух',
   questions:['Все три элемента (2, 6, 10) — промежуточные, переходные?','Они больше похожи на мосты между событиями, чем на сами события?'],
   mistakes:['Один из трёх — яркое событие или твёрдая основа (не промежуточное состояние).'],
   related:['she','type']},ha:{id:'ha',n:'Огонь ХА',p:[3,7,11],c:'#F06838',el:'Огонь',
   questions:['Все три элемента (3, 7, 11) — яркие, горячие, энергичные?','Все три — моменты перемен, а не длительные процессы?'],
   mistakes:['Один из трёх — спокойный и текучий (это Вода ФО, не Огонь).'],
   related:['fo','type']}};
const gc=i=>[0,3,6,9].includes(i)?'support':[1,4,7,10].includes(i)?'right':'left';
const gp=i=>['she','fo','tsi','ha'][i%4];
const opp=i=>(i+6)%12;

// COMPOSITION — идеальное соотношение 4 пран в каждой Полке.
// Сумма всегда = 100. На опорах (0/3/6/9) доминирующая прана = 60%,
// у зеркальной — 10% (минимум). На коротких — 50/25/15/10.
const COMP = [
  // [Земля, Вода, Воздух, Огонь]
  [60, 20, 10, 10], // 0 — Земля чистая (опора)
  [25, 50, 15, 10], // 1 — Вода с Землёй
  [10, 20, 50, 20], // 2 — Воздух с Огнём
  [10, 10, 20, 60], // 3 — Огонь чистый (опора)
  [50, 15, 10, 25], // 4 — Земля с Огнём
  [10, 50, 25, 15], // 5 — Вода с Воздухом
  [10, 10, 60, 20], // 6 — Воздух чистый (опора)
  [15, 10, 25, 50], // 7 — Огонь с Воздухом
  [50, 10, 15, 25], // 8 — Земля с Огнём (зеркало 4)
  [20, 60, 10, 10], // 9 — Вода чистая (опора)
  [15, 25, 50, 10], // 10 — Воздух с Водой
  [25, 15, 10, 50], // 11 — Огонь с Землёй
];
const COMP_COLORS = ['#C0943A','#4090D8','#06B6D4','#F06838']; // Земля, Вода, Воздух, Огонь
const COMP_NAMES  = ['Земля','Вода','Воздух','Огонь'];

const angDeg=i=>270-i*30;
const rad=d=>d*Math.PI/180;
const xy=(i,cx,cy,r)=>({x:cx+r*Math.cos(rad(angDeg(i))),y:cy-r*Math.sin(rad(angDeg(i)))});
const REF=[{f:'ВХОД / ОСНОВА',ex:'Ночь · Прихожая · Свинья'},{f:'ПЕРВЫЙ РЕЗУЛЬТАТ',ex:'Первый свет · Гостиная · Мойка'},{f:'КАНАЛ / ПОТОК',ex:'Заря · Столовая · Река'},{f:'ГЛАВНОЕ СОБЫТИЕ',ex:'Выход Солнца · Кухня · Плита'},{f:'ПОДЪЁМ / КУЛЬТУРА',ex:'Подъём · Веранда · Пар'},{f:'НАКОПИТЕЛЬ',ex:'Последняя тьма · Амбар · Облако'},{f:'ВЕРШИНА / ЦЕНТР',ex:'День · Чулан · Перенос'},{f:'ПИК / НАБЛЮДЕНИЕ',ex:'Первая тьма · Детская · Гроза'},{f:'ЗАЩИТА / СПУСК',ex:'Спуск · Женская · Дождь'},{f:'ОЦЕНКА / ВЕСЫ',ex:'Заход · Спальня · Касание'},{f:'УГАСАНИЕ',ex:'Сумерки · Кабинет · Стекание'},{f:'КОНЕЦ / ВЫХОД',ex:'Последний свет · Санблок · Лужа'}];
const T=[
  {id:'цветов',verified:true,starter:true,n:'Цветов радуги',rubrik:true,p:['Желтый','Оранжевый','Алый','Красный','Черный / Золотой','Фиолетовый','Синий','Голубой','Ультрамарин','Зеленый','Изумрудный','Салатовый']},
  {id:'суток',verified:true,starter:true,n:'Суток',rubrik:true,p:['Ночь','Искра','Утренняя Заря / Рассвет','Утро','Восход','Утренний Салют','День','Первая Тьма','Закат / Вечерняя Заря','Запад / Вечер Сутки','Сумерки','Вечерний Салют'],th:'День',bh:'Ночь'},
  {id:'года',verified:true,starter:true,n:'Года',rubrik:true,p:['Зима','Начало Весны','Тают снега','Весеннее Равноденствие','Появляются листья','Конец Весны','Лето','Начало Осени','Желтеют листья','Осеннее Равноденствие','Опадают листья','Конец Осени'],th:'Лето',bh:'Зима',lh:'Весна',rh:'Осень'},
  {id:'знаки_з.',verified:true,starter:true,n:'Зодиака',rubrik:true,p:['Козерог','Водолей','Рыбы','Овен','Телец','Близнецы','Рак','Лев','Дева','Весы','Скорпион','Стрелец']},
  {id:'двора_животных',verified:true,n:'Животных',rubrik:true,p:['Свинья','Грызуны','Лошадь','Козлы / Бараны','Корова / Бык','Верблюд','Человек','Кошка / Дети','Собака','Птицы','Дракон','Змея']},
  {id:'двора',verified:true,n:'Двора (Постройки)',rubrik:true,p:['Ворота','Калитка','Конюшня','Козлы / бараны','Коровник','Амбар','Веранда','Лавка хозяина','Баня / дровник','Голубятник','Пчелы / мед','Туалет / Навозная куча']},
  {id:'дома',verified:true,starter:true,n:'Дома',rubrik:true,p:['Прихожая','Гостиная','Столовая','Кухня','Веранда','Амбар','Чулан','Детская','Женская комната','Общая спальня','Кабинет','Сан.Блок']},
  {id:'спальни',verified:true,n:'Спальни',rubrik:true,p:['Халат','Гантели / Вода','Зарядка','Одеяло или Сундук','Окно / Гобилен','шкаф с книгами','Бельевой Шкаф','Красный угол','Прикроват. Тумбочка','Кровать','Прикроват.Тумбочка','Светильник']},
  {id:'кухни',verified:true,starter:true,n:'Кухни',rubrik:true,p:['Вход / Фартук','Мойка','Разделочный стол','Плита','Стол полуфабрикатов','Шкаф специй / Книга рецептов','Стол для готовки','Готовое блюдо','Делим на порции','Оценочный стол','Шведский стол','Вынос блюд / Меню']},
  {id:'круговорота_воды',verified:true,starter:true,n:'Круговорота воды',rubrik:true,p:['Вода с землей-грязь','Болото / Ключ / Родник','Река','Поверхность водоема','Пар','Облако','Холод / переход-перенос','Гроза / Молния','Дождь','Касание воды','Стекание','Лужа (брызгает-стреляет)']},
  {id:'atm_yavl',verified:true,starter:true,n:'Видимых атмосферных явлений',rubrik:true,th:'Активная атмосфера (свет, гром, осадки)',bh:'Тихие отложения и приземные явления',lh:'Влага и осадки (нарастание)',rh:'Свет, ветер и электричество (спад)',p:['Роса','Иней','Изморозь / Гололёд','Дождь / Морось','Снег','Град','Гроза','Радуга','Гало / Мираж','Буря / Ураган','Смерч / Шквал','Полярное сияние']},
  {id:'atm_skrytyh',verified:true,starter:true,n:'Скрытых атмосферных явлений',rubrik:true,th:'Активные процессы (электричество, оптика, циркуляция)',bh:'Фоновые процессы (охлаждение, давление)',lh:'Нарастание плотности и накопления',rh:'Спад через излучение и магнитное поле',p:['Радиационное Охлаждение','Сублимация','Адгезия Влаги','Конденсация','Кристаллизация','Конвекция','Электрический Разряд','Преломление Света','Атмосферное Давление','Циклогенез','Торнадогенез','Магнитосферное Возбуждение']},
  {id:'переговоров',verified:true,starter:true,n:'Переговоров',rubrik:true,th:'Игра А↔В (резонанс или десонанс)',bh:'Информационное поле и итог',lh:'Нарастание контакта (Хочу → Контр)',rh:'Спад через понимание или срыв',p:['Информационное Поле','Хочу / Не Хочу','Привлечь и Заинтересовать','Открытие Позиции','Резонирование','Ограничения и Контр','Противостояние А↔В','Обоюдное Понимание','Недопонимание','Десонанс / Срыв','Точечный Удар','Итог: Успех / Неудача']},
  {id:'печи',verified:true,n:'Печи',rubrik:true,p:['Каналы подачи','Колосники','Объем топки (духовой шкаф)','огнеупорная пластина','Лабиринт (воздуховоды в печи)','Камора (расшир.камера)','Труба','Догорел','Отапливаемый объем','Теплоупор','Кондиционер','Дверцы-заслоник / форточки']},
  {id:'дерева',verified:true,n:'Дерева',rubrik:true,p:['Корни','Косточка','Плод','Клетка (Рыльце)','Домен (Столбик)','Бахрома (Пестик)','Лепесток','Билет','Лист','Ветка','Ствол','Пень']},
  {id:'заода_предприятия',verified:true,n:'Завода',rubrik:true,p:['Рекламный отдел','Отдел Кадров / Закупок / Снабжения','Рабочие','Плановый отдел (Нач.Цеха)','Констр.Бюро / Изобретатели / Чертежники','Главный инж. / Склад / Транспортный отдел','Директор / Управа / Администрация','Хозяин / ОТК / СБ','Охрана Предприятия','Бухгалтерия','Юр. ОТдел','Готовая продукция / Отд.Сбыта']},
  {id:'удочки',verified:true,n:'Удочки',rubrik:true,p:['Поводок','Торец Удочки','Бедро УДочки','Первая рука (держит ниже)','Спина удочки','Вторая рука (выше держит удочку)','Дуга','Низга (сам край удочки)','Струна / Нерв','Поплавок','Отвес','Грузило / Дробина']},
  {id:'мирового_яйца',verified:true,n:'Мирового Яйца',rubrik:true,p:['Река','Заливные Луга','Редколесье','Лес (Чаща леса)','Опушка','Альпийские луга','Горная река / Роща','Скалы / Висячие сады','Вечные снега / Небо','Вершина горы / Небосвод','Спуск с горы / Небосклон','Обрывистый берег / Женски']},
  {id:'мирового_яйца_2',verified:true,n:'Мирового Яйца 2',rubrik:true,p:['Море','Выпас','Двор','Дом','Церковь / Сад','Храм','Школа / Терем','Мальта / Висячие сады','Дворец / Небо','Палаты / Небосвод','Канада / Небосклон','Америка / Обрывистый бере']},
  {id:'колокольни',verified:true,n:'Колокольни',rubrik:true,p:['Река / Колодец','Луг / Подвал','Двор / Хозяйственный этаж','Дом','Церковь / Памятные вещи','Храм','Школа / Колокол','Малиновый звон','Дворец','Купол','Фонарь / Маяк','Золотая рыбка / Маковка колокольни']},
  {id:'театра',verified:true,n:'Театра',rubrik:true,p:['Театральный коридор','Закулисье / Капустник','Замостье','Сцена / Мост','Подмостки / Авансцена / Эстрада','Оркестровая яма / Рампа','Зрительный зал','Балкон','Знать / Дворяне','Царская Ложа','Дирекция театра','Гримерки']},
  {id:'месяцев',verified:true,n:'Месяцев',rubrik:true,p:['Январь / Стужень','Февраль / Лютый','Март / березень','Апрель / Квитень','Май / Маженья','Июнь / Травень','Июль / Червень-Липень','Август','Сентябрь / Вересень','Октябрь / Ружник / Кострижник','Ноябрь / Листопад','Декабрь / Грудень / Грубжень']},
  {id:'головы',verified:true,n:'Головы',rubrik:true,p:['Шея','Грызло','Рот','Нос','Глаза','Лоб','Темя','Макушка','Коса','Ухо','Загивок','Задняя часть шеи']},
  {id:'тела',verified:true,n:'Тела',rubrik:true,p:['Ступни','Половые органы','Живот','Грудь','Лицо','Лоб','Волосы','Макушка / Внеш. коса','Внутр.сторона косы','Шея плечи','Спина','Ягодицы']},
  {id:'фаз_жизни',verified:true,starter:true,n:'Жизни',rubrik:true,p:['Половой Акт','Зачатие','Беременность','Рождение','Обучение','Определение','Работа и семья','Конец работы','Учитель','Смерть','Скорбь','Памятник'],th:'Зрелость',bh:'Память / Зачатие нового'},
  {id:'линий_руки',verified:true,n:'13 Линий Руки',rubrik:true,p:['Печь','Кольцо','Цепь','Луч','Запястье','Пройма / Ноготь','Костыка','Печатка','Колечко','Цепочка','Лучик','Рука']},
  {id:'внут.органов',verified:true,n:'Внутренних органов',rubrik:true,p:['Под носом / Нюхаем','Между губами и зубами','Ротовая полость','Полость глотки','Пищевод','Желудок','12-перстная кишка','Тонкий кишечник','Слепая кишка','Ободочная кишка','Сигм.кишка','Прямая кишка']},
    {id:'kostra',n:'Костра',p:['Стопка дров','Искра / Идея','Первый огонь','Шатун','Разгорается','Разгорелся','Горит','Догорел','Тухнет','Последний огонь','Раскалённые угли','Зола']},
  {id:'emotsiy',n:'Эмоций',p:['Страх','Стыд','Обида','Гнев','Интерес','Удивление','Радость','Удовольствие','Любовь','Грусть','Скука','Отвращение']},
  {id:'sistem',n:'Систем человека',p:['Сущность','Нервная','Кровеносная','Пищеварительная','Сенсорная','Лимфатическая','Дыхательная','Половая','Мышечная','Гормональная','Опорно-двигательная','Выделительная']},
  {id:'zhanrov',n:'Жанров',p:['Мистика','Семейный','Триллер','Боевик','Культурный','Фантастика','Приключения','Исторический','Музыкальный','Мелодрама','Комедия','Ужас']},
  {id:'not',n:'Нот',p:['Си','До','До диез','Рэ','Рэ диез','Ми','Фа','Фа диез','Соль','Соль диез','Ля','Ля диез']},
  {id:'chisel',n:'Чисел',p:['300/600/900','133','122','99/111/555','88/100/400','77','66/222/666','55','44/200/500','33/333/777','22/166','11/155']},
  {id:'metro',n:'Метро Москвы',p:['Таганская','Павелецкая','Серпуховская','Октябрьская','Парк культуры','Киевская','Баррикадная','Белорусская','Новослободская','Проспект Мира','Комсомольская','Курская']},

  {id:'oblachnost',n:'Облачности',p:['Свинцовое небо','Шероховатости','Много облаков','Просветы (Анастасия)','Больше неба','Единичные облака','Ясное чистое небо','Первые облака','Облаков много','Просветы уменьшаются','Небо невидимо','Затягивает']},
  {id:'atmosfery',n:'Атмосферы',custom:true,th:'Активная погода',bh:'Покой',lh:'Циклогенез',rh:'Антициклогенез',p:['Антициклон','Радиационный туман','Адвективный туман','Тёплый фронт','Пасмурно','Морось','Гроза / Ливень','Буря / Шквал','Обильные осадки','Холодный фронт','Антициклонизация','Заморозки']},

  {id:'osadkov',n:'Осадков',custom:true,th:'Максимум энергии',bh:'Минимум энергии',lh:'Жидкие (нарастание)',rh:'Твёрдые (спад)',p:['Роса','Изморось','Морось','Дождь','Ливень','Мокрый снег','Град','Снежная крупа','Снегопад','Метель','Изморозь','Иней']},

  {id:'primet_pogody',n:'Примет погоды',custom:true,th:'Прямое наблюдение',bh:'Далёкое знание',lh:'Зрение и осязание',rh:'Слух и обоняние',p:['Климатическая норма','Давление','Перистые облака','Смена ветра','Цвет зари','Роса и туман','Облака над головой','Звуки и эхо','Запахи','Поведение животных','Освещённость','Первая капля']},

  {id:'oblakov',n:'Облаков',custom:true,th:'Максимум энергии',bh:'Минимум энергии',lh:'Нагрев (подъём)',rh:'Охлаждение (спуск)',p:['Туман','Слоистые','Слоисто-кучевые','Кучевые','Мощно-кучевые','Слоисто-дождевые','Кучево-дождевые','Высоко-кучевые','Высоко-слоистые','Перисто-слоистые','Перисто-кучевые','Перистые']},

  {id:'atmo_vstrechi',n:'Атмосферы встречи',custom:true,th:'Максимум конфликта',bh:'Максимум согласия',lh:'Нарастание напряжённости',rh:'Спад / Разрядка',p:['Штиль','Натянутость','Недомолвки','Столкновение позиций','Тяжёлая атмосфера','Обиды / Упрёки','Гроза / Конфликт','Ультиматум / Тупик','Тяжёлый разговор','Разрядка','Примирение','Холодный мир']},

  {id:'vozdeistviy_vstrechi',n:'Воздействий встречи',custom:true,th:'Максимум силы',bh:'Минимум силы',lh:'Тёплые (нарастание)',rh:'Холодные (спад)',p:['Тихое одобрение','Мягкая поправка','Настойчивое повторение','Прямой отказ','Поток аргументов','Упрёк','Ультиматум','Колкости','Нотация','Манипуляция','Холодная формальность','Ледяное молчание']},

  {id:'problem_vstrechi',n:'Проблем встречи',custom:true,th:'Максимум глубины',bh:'Поверхность',lh:'Углубление',rh:'Всплытие',p:['Непонимание','Дефицит информации','Разница ожиданий','Конфликт интересов','Борьба за ресурсы','Личная обида','Ценностный конфликт','Потеря доверия','Усталость','Принципиальная позиция','Формальные претензии','Остаточное сомнение']},

  {id:'primet_vstrechi',n:'Примет встречи',custom:true,th:'Прямое наблюдение',bh:'Предварительное знание',lh:'До и начало',rh:'Процесс и финал',p:['Предыстория','Подготовка','Появление','Первые слова','Рассадка','Язык тела','Голос','Слова','Микрознаки','Энергия','Реакции','Прощание']},

  {id:'resheniy_vstrechi',n:'Решений встречи',custom:true,th:'Глубокое решение',bh:'Поверхностное решение',lh:'Нарастание глубины',rh:'Возврат к форме',p:['Прояснение','Информирование','Сверка ожиданий','Поиск общего','Расширение пирога','Признание / Извинение','Принятие различий','Восстановление доверия','Пауза','Переформулирование','Формализация','Гарантия']},
];
const FL=[
  {id:'support',l:'Опорный',c:'#E8364F',p:[0,3,6,9],g:'crosses'},
  {id:'right',l:'Управления',c:'#E8A834',p:[1,4,7,10],g:'crosses'},
  {id:'left',l:'Веры',c:'#5B9CF6',p:[2,5,8,11],g:'crosses'},
  {id:'ha',l:'Огонь',c:'#F06838',p:[3,7,11],g:'pranas'},
  {id:'fo',l:'Вода',c:'#2563EB',p:[1,5,9],g:'pranas'},
  {id:'tsi',l:'Воздух',c:'#06B6D4',p:[2,6,10],g:'pranas'},
  {id:'she',l:'Земля',c:'#C0943A',p:[0,4,8],g:'pranas'},
  {id:'opp',l:'Противоположности',c:'#ff9500',p:null,g:'struct',
   questions:['Можете сформулировать, в чём именно эти два элемента противоположны?','Если поменять их местами — Ясна сломается?'],
   mistakes:['Элементы похожи вместо того чтобы быть противоположными.','Противоположность не по сути, а случайная (далёкие по теме, но не зеркальные).'],
   related:['support','halves']},
  {id:'rhythm',l:'Ритм В→Б→П',c:'#30A060',p:null,g:'struct',
   questions:['Прочитайте тройку вслух как предложение: «[Вера] готовит к [Бой], из которого рождается [Победа]» — звучит?','Можно ли поменять элементы тройки местами и смысл сохранится? Если да — порядок неверен.'],
   mistakes:['Три элемента тройки не связаны друг с другом по смыслу.','Элемент «Вера» ярче элемента «Бой» — должно быть наоборот.'],
   related:['support','right','left']},
  {id:'arcs',l:'Три дуги',c:'#9060D0',p:null,g:'struct',
   questions:['Прочитайте 5 элементов дуги подряд — получается плавная история?','Середина дуги (позиция ХА) — самый яркий элемент из пяти?'],
   mistakes:['Элемент в середине дуги (ХА) тусклее крайних (ФО) — должно быть наоборот.'],
   related:['rhythm','she','fo','tsi','ha']},
  {id:'halves',l:'Половины',c:'#6366f1',p:null,g:'struct',
   questions:['Верхние элементы (4-8) — про открытое и явное? Нижние (10-2) — про скрытое?','Левые элементы (1-5) связаны с ростом? Правые (7-11) со спадом?'],
   mistakes:['Скрытый элемент стоит наверху (должен быть внизу).','Элемент роста стоит в правой части (должен быть слева).'],
   related:['support','opp']},
  {id:'error89',l:'Ошибка',c:'#D946EF',p:null,g:'struct'},
  {id:'mb_zodiac',l:'Зодиак',c:'#7c3aed',p:null,g:'newmech',
   questions:['Каждой Полке круга соответствует знак: 0=♑Козерог, 3=♈Овен, 6=♋Рак, 9=♎Весы — режимы совпадают с тем, что у вас на этих позициях?','Сектор Земли (0,4,8) даёт ♑♉♍, сектор Воды (1,5,9) — ♒♊♎ — стихии совпадают со знаками?'],
   mistakes:['Поставить «летнее» явление на Полку 0 — там Козерог, зимняя точка цикла.','Перевернуть направление обхода: Зодиак идёт против часовой стрелки, как и Полки.'],
   related:['support','arcs']},
  {id:'mb_scorpio_spider',l:'Скорпион↔Паук',c:'#dc2626',p:null,g:'newmech',
   questions:['Верхний полукруг (Полки 4–8) — про идею, контроль, голову («Сам»)?','Нижний полукруг (Полки 10–2) — про тело, импульс, реализацию («Особа»)?','На оси 3↔9 происходит главное противоборство верха и низа — «Поле Боя»?'],
   mistakes:['Помещать «телесные» явления в верхний полукруг или «головные» — в нижний.','Игнорировать ось 3↔9 — это главный нерв противопоставления.'],
   related:['halves','support']},
  {id:'mb_mobius',l:'Замыкание ∞',c:'#0891b2',p:null,g:'newmech',
   questions:['Полка 11 действительно перетекает в Полку 0 = Полку 12?','Конец цикла является началом следующего — это видно явно?'],
   mistakes:['Смотреть на 11 как на «тупик» — это вход в новый цикл.','Не закладывать преемственность 11→0 — Ясна тогда рассыпается в линию.'],
   related:['support','rhythm']},
  {id:'mb_accumulation',l:'Накопление→Переход',c:'#16a34a',p:null,g:'newmech',
   questions:['На длинных Полках (0,3,6,9) что-то накапливается — материал, энергия, состояние?','Соседние короткие Полки служат точками перелива (искрой, заслонкой, переломом)?'],
   mistakes:['Лишить длинные Полки накопительной функции — поставить туда мгновенные события.','Не отметить, что короткая Полка следует за длинной как разрядка.'],
   related:['type','rhythm']},
  {id:'mb_yasna2',l:'Ясна² (144)',c:'#a21caf',p:null,g:'newmech',
   questions:['Каждую Полку этой Ясны можно раскрыть в свою отдельную 12-Полочную Ясну?','12 главных × 12 вложенных = 144 ячейки — это структурно работает на твоём явлении?'],
   mistakes:['Считать, что 12 Полок — предел. Это только первый уровень; каждая раскрывается в свою Ясну.','Игнорировать вложенность: одно явление можно описать через 144 ячейки одновременно.'],
   related:['support','rhythm','mb_zodiac']},
];

function Star({yy,sel,onSel,hl,af=[],showOpp,overlay,mob,drill,onDrill,subPolki,starRotation,rotationSpeed,showComposition}){
  const isMob=typeof window!=="undefined"&&window.innerWidth<=768;
  const p=yy.p||[];
  const S=900,W=700,cx=S/2,cy=W/2,R=isMob?215:280,nr=isMob?28:32,lr=(isMob?215:280)+(isMob?62:70);
  // ВРАЩЕНИЕ ЧЕРЕЗ ПЕРЕРЕНДЕР ПОЗИЦИЙ — Star обновляет угол через rAF на 60fps.
  // Округление до 0.5px — резко уменьшает sub-pixel re-rasterization текста
  // (на 0.5px шаге глиф закрепляется на той же raster-grid, не плавает).
  const [rotAngle, setRotAngle] = React.useState(0);
  const speedRef = React.useRef(rotationSpeed||24);
  React.useEffect(()=>{ speedRef.current = rotationSpeed||24; }, [rotationSpeed]);
  React.useEffect(()=>{
    if(!starRotation){ setRotAngle(0); return; }
    let raf, lastT = null;
    const animate = (now)=>{
      if(lastT === null) lastT = now;
      const dt = (now - lastT) / 1000;
      lastT = now;
      const dir = starRotation === 'cw' ? 1 : -1;
      setRotAngle(a => a + dir * (dt / Math.max(1, speedRef.current)) * 360);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return ()=> cancelAnimationFrame(raf);
  }, [starRotation]);
  // xy с поворотом + snap к 0.5px sub-grid — глифы стабильно прицепляются к одной
  // raster-сетке, текст перестаёт "плыть"
  const xyRot = (i, c1, c2, r) => {
    const deg = angDeg(i) - rotAngle;
    const x = c1 + r*Math.cos(rad(deg));
    const y = c2 - r*Math.sin(rad(deg));
    return { x: Math.round(x*2)/2, y: Math.round(y*2)/2 };
  };
  const pts = Array.from({length:12},(_,i)=>xyRot(i,cx,cy,R))
  const lps = Array.from({length:12},(_,i)=>xyRot(i,cx,cy,lr))
  // При вращении подписи отодвигаем дальше — иначе наезжают на полки при динамичных переходах
  const lpsRot = Array.from({length:12},(_,i)=>xyRot(i,cx,cy,lr+15))
  const olps = Array.from({length:12},(_,i)=>xyRot(i,cx,cy,lr+24))
  const ilps = Array.from({length:12},(_,i)=>xyRot(i,cx,cy,lr-16))
  // Static (без rotation) — для wrap-g механик: error89, scorpio_spider, mobius
  const staticPts = Array.from({length:12},(_,i)=>xy(i,cx,cy,R))
  const hasMech=af.length>0;
  const nc=i=>(hl&&!hl.includes(i))?'#e0e0e8':CR[gc(i)].c;
  const no=i=>(hl&&!hl.includes(i))?.15:1;
  const anch=i=>{const x=lps[i].x;return Math.abs(x-cx)<25?'middle':x<cx?'end':'start';};
  return(
    <svg viewBox={mob?`40 -10 820 720`:`-80 -50 1060 800`} preserveAspectRatio="xMidYMid meet" style={{width:'100%',height:'100%',display:'block'}}>
      <defs>
        <filter id="gw"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="ns"><feDropShadow dx="0" dy="1" stdDeviation="2.5" floodOpacity=".07"/></filter>
      </defs>
      <rect x="-80" y="-50" width="1060" height="800" fill="#fff"/>
      <g className="yasna-wheel">
      {/* Decorative outer ring */}
      <circle cx={cx} cy={cy} r={R+10} fill="none" stroke="#ececee" strokeWidth=".5"/>
      {/* Main orbit */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#d0d0d5" strokeWidth="1.2"/>
      {/* Inner orbits - hidden when mechanics active */}
      {!hasMech&&<><circle cx={cx} cy={cy} r={R*.7} fill="none" stroke="#e4e4e8" strokeWidth=".7"/>
      <circle cx={cx} cy={cy} r={R*.4} fill="none" stroke="#eee" strokeWidth=".5"/></>}
      {/* Hexagon of LONG positions 0-2-4-6-8-10 */}
      {!hasMech&&<polygon points={[0,2,4,6,8,10].map(i=>`${pts[i].x},${pts[i].y}`).join(' ')} fill="none" stroke="#d8d8dd" strokeWidth=".8"/>}
      {/* Hexagram of SHORT positions 1-3-5-7-9-11 */}
      {!hasMech&&<polygon points={[1,3,5,7,9,11].map(i=>`${pts[i].x},${pts[i].y}`).join(' ')} fill="none" stroke="#d8d8dd" strokeWidth=".8"/>}
      {/* 12 rays from center - hidden when mechanics active */}
      {!hasMech&&Array.from({length:12},(_,i)=>{const s=[0,3,6,9].includes(i);return<line key={`ry${i}`} x1={cx} y1={cy} x2={pts[i].x} y2={pts[i].y} stroke={s?'#c0c0c5':'#d8d8dd'} strokeWidth={s?.9:.4}/>;})}
      {/* Crossbars and ticks - hidden when mechanics active */}
      {!hasMech&&[0,3,6,9].map(i=>{const t=pts[i],a=rad(angDeg(i)+90),bw=17;return<line key={`cb${i}`} x1={t.x+bw*Math.cos(a)} y1={t.y-bw*Math.sin(a)} x2={t.x-bw*Math.cos(a)} y2={t.y+bw*Math.sin(a)} stroke="#b8b8be" strokeWidth="1.2" strokeLinecap="round"/>;})}
      {!hasMech&&[1,2,4,5,7,8,10,11].map(i=>{const t=pts[i],a=rad(angDeg(i)+60),tw=11;return<line key={`tk${i}`} x1={t.x+tw*Math.cos(a)} y1={t.y-tw*Math.sin(a)} x2={t.x-tw*Math.cos(a)} y2={t.y+tw*Math.sin(a)} stroke="#c8c8cd" strokeWidth=".7" strokeLinecap="round"/>;})}
      {af.includes('halves')&&(yy.th||yy.bh)&&<line x1={pts[3].x} y1={pts[3].y} x2={pts[9].x} y2={pts[9].y} stroke="#d2d2d7" strokeWidth="1" strokeDasharray="8 4" opacity=".6"/>}
      {af.includes('halves')&&(yy.lh||yy.rh)&&<line x1={pts[0].x} y1={pts[0].y} x2={pts[6].x} y2={pts[6].y} stroke="#d2d2d7" strokeWidth="1" strokeDasharray="8 4" opacity=".6"/>}
      
      {showOpp&&Array.from({length:6},(_,i)=><g key={`o${i}`}><line x1={pts[i].x} y1={pts[i].y} x2={pts[i+6].x} y2={pts[i+6].y} stroke="#ea580c" strokeWidth="1.8" opacity=".55" strokeDasharray="6 4" strokeLinecap="round"/><circle cx={(pts[i].x+pts[i+6].x)/2} cy={(pts[i].y+pts[i+6].y)/2} r="3.5" fill="#ea580c" opacity=".7"/></g>)}
      {/* Rhythm: 4 triples Вера→Бой→Победа */}
      {af.includes('rhythm')&&[[2,3,4],[5,6,7],[8,9,10],[11,0,1]].map((tr,ti)=>{
        const col='#30A060';const d=tr.map((idx,j)=>`${j===0?'M':'L'}${pts[idx].x},${pts[idx].y}`).join(' ');
        return<g key={`rh${ti}`}>
          <path d={d} fill="none" stroke={col} strokeWidth="3.5" opacity=".7" strokeLinecap="round"/>
          <circle cx={pts[tr[1]].x} cy={pts[tr[1]].y} r={nr+6} fill={col} opacity=".12"/>
          {tr.map((idx,j)=><text key={j} x={pts[idx].x} y={pts[idx].y-nr-6} textAnchor="middle" fill={col} fontSize="12" fontWeight="800" opacity=".9" style={{pointerEvents:'none'}}>{['В','Б','П'][j]}</text>)}
        </g>;
      })}
      {/* Three arcs: ФО→ЦИ→ХА→ШЭ→ФО */}
      {af.includes('arcs')&&[[1,2,3,4,5],[5,6,7,8,9],[9,10,11,0,1]].map((arc,ai)=>{
        const cols=['#4090D8','#9060D0','#30A060'];const col=cols[ai];
        const d=arc.map((idx,j)=>{const p=pts[idx];return`${j===0?'M':'L'}${p.x},${p.y}`;}).join(' ');
        return<path key={`arc${ai}`} d={d} fill="none" stroke={col} strokeWidth="4" opacity=".6" strokeLinecap="round"/>;
      })}
      {/* Halves */}
      {af.includes('halves')&&(()=>{
        // Halves теперь рендерятся через wrap-g с rotate-transform.
        // Path-d вычисляются от статичных позиций (cx-R, cy) и т.п.,
        // а rotation применяется ОДНИМ атрибутом на wrap <g>. iOS Safari не
        // пересоздаёт растровый кеш path при изменении только transform на родителе.
        // Плюс: подписи внутри wrap тоже rotate'ятся, но мы хотим чтобы они
        // оставались upright — counter-rotate обратно через inner <g>.
        // Полки в xyRot используют (angDeg - rotAngle), что в SVG y-down даёт CW визуально
        // для положительного rotAngle. SVG rotate(positive) тоже CW. Без инверсии.
        return<g transform={`rotate(${rotAngle.toFixed(2)},${cx},${cy})`}>
          {/* Top: Чаша Света — arc от static(cx-R,cy) до static(cx+R,cy) через верх */}
          <path d={`M${cx-R},${cy} A${R},${R} 0 0,0 ${cx+R},${cy}`} fill="rgba(255,180,0,.08)" stroke="rgba(200,150,0,.45)" strokeWidth="2.5"/>
          {/* Bottom: Чаша Тьмы — arc от static(cx+R,cy) до static(cx-R,cy) через низ */}
          <path d={`M${cx+R},${cy} A${R},${R} 0 0,0 ${cx-R},${cy}`} fill="rgba(80,100,200,.08)" stroke="rgba(80,100,200,.4)" strokeWidth="2.5"/>
          {/* Left/Right: Нарастание — arc от static(cx,cy+R) до static(cx,cy-R) через лево */}
          <path d={`M${cx},${cy+R} A${R},${R} 0 0,0 ${cx},${cy-R}`} fill="rgba(40,180,100,.05)" stroke="rgba(40,160,90,.25)" strokeWidth="1.2"/>
          <path d={`M${cx},${cy-R} A${R},${R} 0 0,0 ${cx},${cy+R}`} fill="rgba(180,80,180,.05)" stroke="rgba(160,70,160,.25)" strokeWidth="1.2"/>
          {/* Axes — статичные линии */}
          <line x1={cx-R} y1={cy} x2={cx+R} y2={cy} stroke="#86868b" strokeWidth="1" strokeDasharray="6 4" opacity=".25"/>
          <line x1={cx} y1={cy-R} x2={cx} y2={cy+R} stroke="#86868b" strokeWidth="1" strokeDasharray="6 4" opacity=".25"/>
          {/* Подписи: counter-rotate чтобы оставались upright при вращении wrap-g */}
          <g transform={`rotate(${(-rotAngle).toFixed(2)},${cx},${cy-R*.5})`}><text x={cx} y={cy-R*.5} textAnchor="middle" fill="rgba(170,130,0,.6)" fontSize="11" fontFamily="var(--sans)" fontWeight="600">Чаша Света</text></g>
          <g transform={`rotate(${(-rotAngle).toFixed(2)},${cx},${cy+R*.55})`}><text x={cx} y={cy+R*.55} textAnchor="middle" fill="rgba(70,80,170,.5)" fontSize="11" fontFamily="var(--sans)" fontWeight="600">Чаша Тьмы</text></g>
          <g transform={`rotate(${(-rotAngle).toFixed(2)},${cx-R*.5},${cy})`}><text x={cx-R*.5} y={cy+6} textAnchor="middle" fill="rgba(40,140,80,.45)" fontSize="10" fontFamily="var(--sans)" fontWeight="500" transform={`rotate(-90 ${cx-R*.5} ${cy})`}>Нарастание ↑</text></g>
          <g transform={`rotate(${(-rotAngle).toFixed(2)},${cx+R*.5},${cy})`}><text x={cx+R*.5} y={cy+6} textAnchor="middle" fill="rgba(140,60,140,.4)" fontSize="10" fontFamily="var(--sans)" fontWeight="500" transform={`rotate(90 ${cx+R*.5} ${cy})`}>Спад ↓</text></g>
        </g>;
      })()}
      {/* Error 8↔9: zone of confusion. Wrap-g + static d — корректно вращается без re-raster */}
      {af.includes('error89')&&(()=>{
        const sp=staticPts;
        return<g transform={`rotate(${rotAngle.toFixed(2)},${cx},${cy})`}>
          {/* Primary zone 8↔9 */}
          <path d={`M${sp[8].x},${sp[8].y} A${R},${R} 0 0,1 ${sp[9].x},${sp[9].y}`} fill="rgba(217,70,239,.06)" stroke="#D946EF" strokeWidth="4" strokeDasharray="8 4"/>
          <line x1={sp[8].x} y1={sp[8].y} x2={sp[9].x} y2={sp[9].y} stroke="#D946EF" strokeWidth="3" opacity=".5" strokeDasharray="6 4"/>
          {/* Mirror zone 2↔3 */}
          <path d={`M${sp[2].x},${sp[2].y} A${R},${R} 0 0,0 ${sp[3].x},${sp[3].y}`} fill="rgba(217,70,239,.03)" stroke="#D946EF" strokeWidth="2.5" strokeDasharray="6 4" opacity=".6"/>
          <line x1={sp[2].x} y1={sp[2].y} x2={sp[3].x} y2={sp[3].y} stroke="#D946EF" strokeWidth="2" opacity=".4" strokeDasharray="6 4"/>
          {/* 4 error types: counter-rotate чтобы оставались upright */}
          {[[0,'Ошибка во сне',0,nr+30],[3,'Просмотрел',(sp[2].x-sp[3].x)/2-70,(sp[2].y-sp[3].y)/2-12],[6,'Мираж',0,-nr-22],[9,'Ошибка измерения',(sp[8].x-sp[9].x)/2+70,(sp[8].y-sp[9].y)/2-12]].map(([idx,label,dx,dy])=>{
            const p=sp[idx];
            const tx=p.x+dx, ty=p.y+dy;
            return<g key={`e${idx}`} transform={`rotate(${(-rotAngle).toFixed(2)},${tx},${ty})`}><text x={tx} y={ty} textAnchor="middle" fill="#D946EF" fontSize="10" fontWeight="700" fontFamily="var(--sans)" opacity=".85" style={{pointerEvents:'none'}}>{label}</text></g>;
          })}
          {/* Connection line 8↔9 → 2↔3 */}
          <line x1={(sp[8].x+sp[9].x)/2} y1={(sp[8].y+sp[9].y)/2} x2={(sp[2].x+sp[3].x)/2} y2={(sp[2].y+sp[3].y)/2} stroke="#D946EF" strokeWidth="1.5" opacity=".25" strokeDasharray="4 6"/>
        </g>;
      })()}

      {/* M-К-005 Зодиак: знаки рендерятся НА полке (вместо цифры) — см. код полок ниже. */}

      {/* M-Ж-118 Скорпион↔Паук — wrap-g + static d, плавно вращается с колесом */}
      {af.includes('mb_scorpio_spider')&&(()=>{
        const sp=staticPts;
        const cr=`${(-rotAngle).toFixed(2)}`; // counter-rotation для подписей
        return<g transform={`rotate(${rotAngle.toFixed(2)},${cx},${cy})`}>
          <path d={`M${sp[3].x},${sp[3].y} A${R},${R} 0 0,1 ${sp[9].x},${sp[9].y} L${sp[3].x},${sp[3].y} Z`}
                fill="rgba(37,99,235,.08)" stroke="rgba(37,99,235,.4)" strokeWidth="1.2" strokeDasharray="6 4"/>
          {/* Подписи top: counter-rotate индивидуально вокруг своего якоря */}
          <g transform={`rotate(${cr},${cx},${cy-90})`}><text x={cx} y={cy-90} textAnchor="middle" fontSize="14" fill="#1d4ed8" fontWeight="700" stroke="#fff" strokeWidth="3" paintOrder="stroke">Головной Паук · Сам</text></g>
          <g transform={`rotate(${cr},${cx},${cy-72})`}><text x={cx} y={cy-72} textAnchor="middle" fontSize="11" fill="#1e3a8a" opacity=".85" stroke="#fff" strokeWidth="2.5" paintOrder="stroke">верх · идея · мозг</text></g>
          <path d={`M${sp[3].x},${sp[3].y} A${R},${R} 0 0,0 ${sp[9].x},${sp[9].y} L${sp[3].x},${sp[3].y} Z`}
                fill="rgba(220,38,38,.08)" stroke="rgba(220,38,38,.4)" strokeWidth="1.2" strokeDasharray="6 4"/>
          <g transform={`rotate(${cr},${cx},${cy+72})`}><text x={cx} y={cy+72} textAnchor="middle" fontSize="14" fill="#b91c1c" fontWeight="700" stroke="#fff" strokeWidth="3" paintOrder="stroke">Грудной Скорпион · Особа</text></g>
          <g transform={`rotate(${cr},${cx},${cy+90})`}><text x={cx} y={cy+90} textAnchor="middle" fontSize="11" fill="#7f1d1d" opacity=".85" stroke="#fff" strokeWidth="2.5" paintOrder="stroke">низ · тело · импульс</text></g>
          <line x1={sp[3].x-26} y1={sp[3].y} x2={sp[9].x+26} y2={sp[9].y} stroke="#7c2d12" strokeWidth="2" strokeDasharray="3 4" opacity=".55"/>
          {/* ПОЛЕ БОЯ rect+text — counter-rotate */}
          <g transform={`rotate(${cr},${cx},${cy})`}>
            <rect x={cx-78} y={cy-12} width="156" height="24" rx="12" fill="#fff" stroke="#7c2d12" strokeWidth="1.4"/>
            <text x={cx} y={cy+5} textAnchor="middle" fontSize="11" fill="#7c2d12" fontWeight="700" letterSpacing="1.5">↑ ПОЛЕ БОЯ ↓</text>
          </g>
        </g>;
      })()}

      {/* M-Г-050 Лента Мёбиуса — wrap-g + static d, орбитирует с полкой 0 */}
      {af.includes('mb_mobius')&&(()=>{
        const sp=staticPts;
        const infY=cy+R-25;
        return<g transform={`rotate(${rotAngle.toFixed(2)},${cx},${cy})`}>
          <path d={`M${sp[11].x},${sp[11].y} A${R},${R} 0 0,1 ${sp[1].x},${sp[1].y}`}
                fill="none" stroke="#0891b2" strokeWidth="4" strokeLinecap="round" opacity=".75"/>
          <path d={`M${sp[11].x},${sp[11].y} A${R},${R} 0 0,1 ${sp[1].x},${sp[1].y}`}
                fill="none" stroke="#67e8f9" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="6 6" opacity=".9"
                style={{animation:'dashFlow 3s linear infinite'}}/>
          {/* ∞ counter-rotate чтобы оставался upright */}
          <g transform={`rotate(${(-rotAngle).toFixed(2)},${cx},${infY})`}>
            <text x={cx} y={infY} textAnchor="middle" fontSize="18" fill="#0891b2" fontWeight="700"
                  stroke="#fff" strokeWidth="4" paintOrder="stroke" style={{pointerEvents:'none'}}>∞</text>
          </g>
        </g>;
      })()}

      {/* M-К-007 Накопление→Переход: длинные копят, короткие — точки перелива */}
      {af.includes('mb_accumulation')&&(()=>{
        return<g>
          <defs><marker id="acc-arr-pv" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#16a34a"/></marker></defs>
          {[0,3,6,9].map(i=>{const p=pts[i];const np1=pts[(i+1)%12];const np2=pts[(i+11)%12];
            return<g key={`acc${i}`}>
              <circle cx={p.x} cy={p.y} r="42" fill="rgba(22,163,74,.16)" stroke="#16a34a" strokeWidth="1.6" strokeDasharray="3 3"/>
              <circle cx={p.x} cy={p.y} r="62" fill="none" stroke="#16a34a" strokeWidth=".8" opacity=".4"/>
              <line x1={p.x} y1={p.y} x2={np1.x} y2={np1.y} stroke="#16a34a" strokeWidth="2" markerEnd="url(#acc-arr-pv)" opacity=".7" strokeDasharray="4 3"/>
              <line x1={p.x} y1={p.y} x2={np2.x} y2={np2.y} stroke="#16a34a" strokeWidth="2" markerEnd="url(#acc-arr-pv)" opacity=".7" strokeDasharray="4 3"/>
            </g>;})}
        </g>;
      })()}

      {/* M-Г-066 Ясна² (144 Полки): вокруг каждой полки — мини-кольцо из 12 точек.
         12 главных × 12 вложенных = 144 ячейки. Источник: Ясна Года узел 9. */}
      {af.includes('mb_yasna2')&&(()=>{
        const subR = nr + 14;
        // Перформанс: при вращении 144 микро-точки дают огромную нагрузку на React
        // reconciliation (SVG re-render всех cx/cy 60 раз в сек). Скрываем точки во
        // время вращения, оставляем только 12 dashed-rings — визуальный маркер сохраняется
        const showMicro = !starRotation;
        return<g>
          {pts.map((p,i)=>(
            <g key={`y2_${i}`}>
              <circle cx={p.x} cy={p.y} r={subR+2} fill="none" stroke="#a21caf" strokeWidth=".9" strokeDasharray="2 3" opacity=".55"/>
              {showMicro&&Array.from({length:12},(_,j)=>{
                const a=(270-j*30)*Math.PI/180;
                const sx=p.x+subR*Math.cos(a);
                const sy=p.y-subR*Math.sin(a);
                return <circle key={j} cx={sx} cy={sy} r="2.2" fill="#a21caf" opacity=".7"/>;
              })}
            </g>
          ))}
          {/* Подпись по центру (если ПОЛЕ БОЯ Скорпиона не активно — иначе уйдёт ниже) */}
          {!af.includes('mb_scorpio_spider')&&<>
            <text x={cx} y={cy-6} textAnchor="middle" fontSize="14" fontWeight="700" fill="#a21caf"
                  stroke="#fff" strokeWidth="3.5" paintOrder="stroke">Ясна² = 144</text>
            <text x={cx} y={cy+12} textAnchor="middle" fontSize="10.5" fill="#86198f"
                  stroke="#fff" strokeWidth="2.5" paintOrder="stroke">12 × 12 — каждая Полка раскрывается в свою Ясну</text>
          </>}
        </g>;
      })()}

      {/* Opposition line на выбранной полке — только при активной механике "opp" */}
      {sel!==null && af.includes('opp') && <line x1={pts[sel].x} y1={pts[sel].y} x2={pts[opp(sel)].x} y2={pts[opp(sel)].y} stroke="#ea580c" strokeWidth="2.2" opacity=".75" strokeDasharray="6 4" strokeLinecap="round"/>}
      {/* Multi-mechanic layers */}
      {(()=>{const activeLayers=af.filter(id=>!['opp','axes'].includes(id)).length;
        const opaScale=activeLayers<=1?1:activeLayers<=2?.85:activeLayers<=4?.7:.55;
        return af.filter(id=>!['opp','axes'].includes(id)).map(id=>{const f=FL.find(x=>x.id===id);if(!f||!f.p)return null;
        const isCross=f.p.length===4;
        const d=f.p.map((idx,j)=>`${j===0?'M':'L'}${pts[idx].x},${pts[idx].y}`).join(' ')+'Z';
        return(<g key={id}>
          <path d={d} fill={f.c+'06'} stroke={f.c} strokeWidth={['she','fo','tsi','ha'].includes(id)?2.5:1.8} opacity={.4*opaScale} strokeDasharray={id==='she'?'none':id==='fo'?'8 4':id==='tsi'?'4 4':id==='ha'?'12 3 3 3':'none'} strokeLinecap="round"/>
          {isCross&&<><line x1={pts[f.p[0]].x} y1={pts[f.p[0]].y} x2={pts[f.p[2]].x} y2={pts[f.p[2]].y} stroke={f.c} strokeWidth="1.2" opacity={.2*opaScale} strokeDasharray="6 4"/>
          <line x1={pts[f.p[1]].x} y1={pts[f.p[1]].y} x2={pts[f.p[3]].x} y2={pts[f.p[3]].y} stroke={f.c} strokeWidth="1.2" opacity={.2*opaScale} strokeDasharray="6 4"/></>}
          {f.p.map(idx=><g key={idx}>
            <circle cx={pts[idx].x} cy={pts[idx].y} r={nr+6} fill={f.c} opacity={.06*opaScale}/>
            {['she','fo','tsi','ha'].includes(id)&&<circle cx={pts[idx].x} cy={pts[idx].y} r={nr+4} fill="none" stroke={f.c} strokeWidth=".8" opacity={.2*opaScale} strokeDasharray="3 5" style={{animation:'dashFlow 3s linear infinite'}}/>}
          </g>)}
        </g>);});})()}
      
      {/* Центр Звезды освобождён — название Ясны дублирует хедер. Здесь рабочая зона для overlay-механик (Поле Боя, ∞ и т.д.). */}
      {af.includes('halves')&&yy.th&&<text x={cx} y={34} textAnchor="middle" fill="rgba(0,0,0,.5)" fontSize="13" fontFamily="var(--sans)" fontWeight="600">{yy.th}</text>}
      {af.includes('halves')&&yy.bh&&<text x={cx} y={W-22} textAnchor="middle" fill="rgba(0,0,0,.5)" fontSize="13" fontFamily="var(--sans)" fontWeight="600">{yy.bh}</text>}
      {af.includes('halves')&&yy.lh&&<text x={20} y={cy} textAnchor="middle" fill="rgba(0,0,0,.5)" fontSize="13" fontFamily="var(--sans)" fontWeight="600" transform={`rotate(-90 20 ${cy})`}>{yy.lh}</text>}
      {af.includes('halves')&&yy.rh&&<text x={S-20} y={cy} textAnchor="middle" fill="rgba(0,0,0,.5)" fontSize="13" fontFamily="var(--sans)" fontWeight="600" transform={`rotate(90 ${S-20} ${cy})`}>{yy.rh}</text>}
      {/* Composition — мини-пироги внутри круга при showComposition */}
      {showComposition && pts.map((pt,i)=>{
        const r=COMP[i]; const total=100;
        // Pie center: между центром и Полкой на радиусе 0.62R
        const dx=(pt.x-cx)/R, dy=(pt.y-cy)/R;
        const px=Math.round((cx+dx*R*0.62)*2)/2;
        const py=Math.round((cy+dy*R*0.62)*2)/2;
        const pr=26;        // радиус пирога
        const ph=pr*0.46;   // дырка по центру (donut hole)
        const dim = hl&&!hl.includes(i)?.18:1;
        let aStart=-Math.PI/2; // старт сверху
        const segs=r.map((pct,j)=>{
          const aSeg=(pct/total)*2*Math.PI;
          const x1=px+pr*Math.cos(aStart), y1=py+pr*Math.sin(aStart);
          const aEnd=aStart+aSeg;
          const x2=px+pr*Math.cos(aEnd), y2=py+pr*Math.sin(aEnd);
          const large=aSeg>Math.PI?1:0;
          const d=`M ${px} ${py} L ${x1} ${y1} A ${pr} ${pr} 0 ${large} 1 ${x2} ${y2} Z`;
          const seg=<path key={j} d={d} fill={COMP_COLORS[j]} stroke="#fff" strokeWidth="1.5" opacity={pct>=50?1:.85}>
            <title>{`${COMP_NAMES[j]}: ${pct}%`}</title>
          </path>;
          aStart=aEnd;
          return seg;
        });
        // Find dominant prana for label color
        const maxIdx=r.indexOf(Math.max(...r));
        return <g key={`comp${i}`} style={{pointerEvents:'none',opacity:dim,transition:'opacity .25s'}}>
          {segs}
          {/* центральный круг (donut hole) */}
          <circle cx={px} cy={py} r={ph} fill="#fff" stroke="rgba(0,0,0,.08)" strokeWidth=".8"/>
          {/* номер Полки в центре пирога */}
          <text x={px} y={py+1.5} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="700" fill={COMP_COLORS[maxIdx]} fontFamily="var(--sans)">{i}</text>
          {/* доминирующая прана % под номером */}
          <text x={px} y={py+ph+8} textAnchor="middle" fontSize="9" fontWeight="600" fill={COMP_COLORS[maxIdx]} fontFamily="var(--sans)">{r[maxIdx]}%</text>
        </g>;
      })}
      {pts.map((pt,i)=>{const isSel=sel===i,c=nc(i),o=no(i);const lbl=p[i]||'';const tipText=lbl?`Полка ${i}: ${lbl}`:`Полка ${i}`;return(
        <g key={i} onClick={()=>{if(af.includes('mb_yasna2')&&drill==null&&onDrill){onDrill(i);}else{onSel(sel===i?null:i);}}} style={{cursor:'pointer'}}>
          <title>{tipText}</title>
          <circle cx={pt.x} cy={pt.y} r={nr+14} fill="transparent" stroke="none"/>
          {isSel&&<circle cx={pt.x} cy={pt.y} r={nr+8} fill={c} opacity=".06" filter="url(#gw)"/>}
          <circle cx={pt.x} cy={pt.y} r={isSel?nr+3:nr} fill="#fff" stroke={c} strokeWidth={isSel?3.2:2.2} opacity={o} filter={isSel?"url(#gw)":"url(#ns)"} style={{pointerEvents:'none',transition:'r 150ms ease'}}/>
          <text x={pt.x} y={pt.y+(af.includes('mb_zodiac')?7:6)} textAnchor="middle" fill={af.includes('mb_zodiac')?'#7c3aed':(hl&&!hl.includes(i))?'#c0c0c5':'#1f2937'} fontSize={af.includes('mb_zodiac')?(isMob?(isSel?"24":"22"):(isSel?"32":"30")):(isMob?(isSel?"22":"20"):(isSel?"30":"28"))} fontWeight={af.includes('mb_zodiac')?"600":"700"} fontFamily="var(--sans)" opacity={o} style={{pointerEvents:'none'}}>{af.includes('mb_zodiac')?['♑','♒','♓','♈','♉','♊','♋','♌','♍','♎','♏','♐'][i]:i}</text>
        </g>);})}
      {!overlay&&(starRotation?lpsRot:lps).map((pt,i)=>{const lOrig=p[i]||'';if(!lOrig)return null;let dy=5;if(!starRotation){if(i===0)dy=16;if(i===6)dy=-7;}
        // Trim incomplete trailing tokens (e.g. '("кита' or '(без свинст') — likely data-import artifacts
        let l=lOrig.replace(/\s*\([^)]*$/,'').replace(/\s*\/\s*$/,'').trim();
        // Cap each line to fit the canvas
        const maxLine=isMob?14:18;
        let parts=null;
        if(l.includes(' ')){const w=l.split(' ');const m=Math.ceil(w.length/2);parts=[w.slice(0,m).join(' '),w.slice(m).join(' ')];}
        else if(l.includes('-')&&l.length>10){const hi=l.indexOf('-');parts=[l.slice(0,hi+1),l.slice(hi+1)];}
        else if(l.includes('/')&&l.length>10){const si=l.indexOf('/');parts=[l.slice(0,si+1),l.slice(si+1).trim()];}
        else if(l.length>12){const m=Math.ceil(l.length/2);parts=[l.slice(0,m)+'-',l.slice(m)];}
        if(parts){parts=parts.map(s=>s.length>maxLine?s.slice(0,maxLine-1).trimEnd()+'…':s);}
        else if(l.length>maxLine)l=l.slice(0,maxLine-1).trimEnd()+'…';
        // Во время вращения per-index offsets дают резкие скачки (они спроектированы
        // под статичный layout). Используем единый layout — middle anchor, без xOff,
        // базовый dy. Лейблы плавно орбитируют вместе с полками.
        const isRotating = !!starRotation;
        const xOff = isRotating ? 0 : (i===3?14:i===9?-14:i===4?8:i===8?-8:0);
        const dyEff = isRotating ? 5 : dy;
        const anchEff = isRotating ? 'middle' : anch(i);
        const fs=isMob?(sel===i?'24':'22'):(sel===i?'26':'24'); // desktop +1.18× после расширения viewBox
        const fsW=isMob?(sel===i?'24':'22'):(sel===i?'26':'24');if(parts){return<text key={`l${i}`} x={pt.x+xOff} y={pt.y+dyEff-9} textAnchor={anchEff} fill={'#000'} fontSize={fsW} fontFamily="var(--serif)" fontWeight={sel===i?'700':'600'} style={{pointerEvents:'none'}}><tspan x={pt.x+xOff} dy="0">{parts[0]}</tspan><tspan x={pt.x+xOff} dy={isMob?22:22}>{parts[1]}</tspan></text>;}
        return<text key={`l${i}`} x={pt.x+xOff} y={pt.y+dyEff} textAnchor={anchEff} fill={'#000'} fontSize={fs} fontFamily="var(--serif)" fontWeight={sel===i?'700':'600'} style={{pointerEvents:'none'}}>{l}</text>;})}
      {overlay&&<>
        {/* Outer orbit - more visible, solid thin line */}
        <circle cx={cx} cy={cy} r={lr+12} fill="none" stroke="rgba(147,51,234,.18)" strokeWidth="1" strokeDasharray="2 4"/>
        {/* Satellite dots on outer orbit showing overlay structure */}
        {Array.from({length:12},(_,i)=>{const op=xy(i,cx,cy,lr+12);return<circle key={`os${i}`} cx={op.x} cy={op.y} r="3" fill={sel===i?'#7c3aed':'#9333ea'} opacity={sel===i?.9:.5}/>;})}
        {/* Thin connector lines between inner point and outer satellite */}
        {Array.from({length:12},(_,i)=>{const op=xy(i,cx,cy,lr+12);return<line key={`oc${i}`} x1={pts[i].x} y1={pts[i].y} x2={op.x} y2={op.y} stroke="rgba(147,51,234,.15)" strokeWidth="1" strokeDasharray="2 3"/>;})}
        {/* Primary Yasna labels - inner ring */}
        {ilps.map((pt,i)=>{const l=p[i]||'';if(!l)return null;const a=angDeg(i);let dy=4;if(!starRotation){if(i===0)dy=12;if(i===6)dy=-5;}return<text key={`p${i}`} x={pt.x} y={pt.y+dy} textAnchor={starRotation?'middle':anch(i)} fill={sel===i?'#1d1d1f':'rgba(0,122,255,.8)'} fontSize={sel===i?"16":"14"} fontFamily="var(--serif)" fontWeight={sel===i?'700':'500'} style={{pointerEvents:'none'}}>{l}</text>;})}
        {/* Overlay Yasna labels - outer ring */}
        {olps.map((pt,i)=>{const l=(overlay.p||[])[i]||'';if(!l)return null;let dy=22;if(!starRotation){if(i===0)dy=34;if(i===6)dy=-22;if([3,9].includes(i))dy=26;if([2,10].includes(i))dy=26;if([4,8].includes(i))dy=34;if([1,11].includes(i))dy=28;if([5,7].includes(i))dy=24;}return<text key={`o${i}`} x={pt.x} y={pt.y+dy} textAnchor={starRotation?'middle':anch(i)} fill={sel===i?'#7c3aed':'#9333ea'} fontSize={sel===i?"17":"15"} fontFamily="var(--serif)" fontWeight={sel===i?'700':'500'} fontStyle="italic" style={{pointerEvents:'none'}}>{l}</text>;})}
      </>}
      {/* M-Г-066 Ясна² Drill-down: клик по полке открывает её внутреннюю Ясну */}
      {drill!=null&&(()=>{
        const dCol='#a21caf';
        // Карточка занимает почти весь viewBox 900×700
        const cardX=10, cardY=8, cardW=S-20, cardH=W-16;
        // Центрируем sub-Ясну между низом шапки (cardY+135) и низом карточки
        const subCenterY=Math.round((cardY+135+cardY+cardH-20)/2);
        // Размеры подобраны так, чтобы длинные подписи (subLr+labelWidth) умещались внутри карточки cardX..cardX+cardW
        const subR=isMob?170:200;
        const subNr=isMob?28:32;
        const subLr=subR+(isMob?52:58);
        const SUB_PRANA_COLOR=['#C0943A','#4090D8','#06B6D4','#F06838','#C0943A','#4090D8','#06B6D4','#F06838','#C0943A','#4090D8','#06B6D4','#F06838'];
        return<g className="drill-popup" style={{animation:'drillPopup .42s cubic-bezier(.16,1,.3,1)',transformOrigin:`${cx}px ${cy}px`}}>
          {/* Карточка-попап — занимает почти весь viewBox, без backdrop */}
          <rect x={cardX} y={cardY} width={cardW} height={cardH} rx="24" ry="24"
                fill="#ffffff" stroke="rgba(162,28,175,.22)" strokeWidth="2"
                style={{filter:'drop-shadow(0 24px 56px rgba(15,23,42,.32))'}}
                />
          {/* Декоративная верхняя полоса с градиентом */}
          <defs>
            <linearGradient id="drillHdrGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fdf4ff"/>
              <stop offset="0.5" stopColor="#ede1f8"/>
              <stop offset="1" stopColor="#fdf4ff"/>
            </linearGradient>
          </defs>
          <path d={`M ${cardX} ${cardY+24} A 24 24 0 0 1 ${cardX+24} ${cardY} L ${cardX+cardW-24} ${cardY} A 24 24 0 0 1 ${cardX+cardW} ${cardY+24} L ${cardX+cardW} ${cardY+92} L ${cardX} ${cardY+92} Z`} fill="url(#drillHdrGrad)"/>
          {/* Бэйдж */}
          <rect x={cx-100} y={cardY+22} width="200" height="26" rx="13" fill="#a21caf"/>
          <text x={cx} y={cardY+39} textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="2.4" fill="#fff" fontFamily="var(--sans)">ВЛОЖЕННАЯ ЯСНА²</text>
          {/* Главный заголовок попапа */}
          <text x={cx} y={cardY+76} textAnchor="middle" fontSize={isMob?26:32} fontWeight="700" fill="#1d1d1f" fontFamily="var(--serif)">{(p[drill]||`Полка ${drill}`)}</text>
          {/* Подзаголовок-путь */}
          <text x={cx} y={cardY+102} textAnchor="middle" fontSize="12" fill="#86868b" fontFamily="var(--sans)">{(yy.name.length>26?yy.name.slice(0,24)+'…':yy.name)} · Полка {drill}</text>
          {/* Декоративный разделитель */}
          <line x1={cx-100} y1={cardY+118} x2={cx+100} y2={cardY+118} stroke="rgba(162,28,175,.22)" strokeWidth="1"/>
          {/* Close-кнопка ✕ в правом верхнем углу */}
          <g style={{cursor:'pointer'}} onClick={()=>onDrill&&onDrill(null)}>
            <circle cx={cardX+cardW-32} cy={cardY+32} r="22" fill="#fff" stroke="rgba(162,28,175,.35)" strokeWidth="1.5"/>
            <text x={cardX+cardW-32} y={cardY+39} textAnchor="middle" fontSize="22" fontWeight="500" fill="#a21caf" fontFamily="var(--sans)" style={{userSelect:'none'}}>×</text>
          </g>
          {/* Внешнее кольцо sub-Ясны */}
          <circle cx={cx} cy={subCenterY} r={subR} fill="none" stroke={dCol} strokeWidth="1.2" strokeDasharray="5 7" opacity=".35"/>
          {/* Внутреннее декоративное кольцо */}
          <circle cx={cx} cy={subCenterY} r={subR*0.55} fill="rgba(162,28,175,.03)" stroke={dCol} strokeWidth=".8" strokeDasharray="2 6" opacity=".35"/>
          {/* Sub-полки */}
          {Array.from({length:12},(_,j)=>{
            const sa=(270-j*30)*Math.PI/180;
            const sx=Math.round((cx+subR*Math.cos(sa))*2)/2;
            const sy=Math.round((subCenterY-subR*Math.sin(sa))*2)/2;
            const subName=(subPolki&&subPolki[j])||'';
            const pranaColor=SUB_PRANA_COLOR[j];
            // Top (j=6) и Bottom (j=0) sub-полки: лейбл ВНУТРИ ring (safe-zone от шапки и от низа карточки)
            const isTop=j===6, isBot=j===0;
            let lx, ly, anchor;
            if(isTop){
              lx=sx; ly=sy+subNr+(isMob?22:26); anchor='middle';
            } else if(isBot){
              lx=sx; ly=sy-subNr-(isMob?14:18); anchor='middle';
            } else {
              lx=Math.round((cx+subLr*Math.cos(sa))*2)/2;
              ly=Math.round((subCenterY-subLr*Math.sin(sa))*2)/2;
              anchor=Math.abs(lx-cx)<25?'middle':lx<cx?'end':'start';
            }
            // Длинные подписи разбиваем на 2 строки
            let parts=null;
            if(subName.length>13){
              if(subName.includes(' ')){const w=subName.split(' ');const m=Math.ceil(w.length/2);parts=[w.slice(0,m).join(' '),w.slice(m).join(' ')];}
              else if(subName.includes('/')){const si=subName.indexOf('/');parts=[subName.slice(0,si).trim(),subName.slice(si+1).trim()];}
            }
            return<g key={`sub${j}`}>
              {/* Кружок sub-полки */}
              <circle cx={sx} cy={sy} r={subNr+3} fill="rgba(255,255,255,.95)" stroke="rgba(162,28,175,.15)" strokeWidth="0.8"/>
              <circle cx={sx} cy={sy} r={subNr} fill="#fff" stroke={pranaColor} strokeWidth={isMob?2.8:3}/>
              {/* Цифра sub-полки */}
              <text x={sx} y={sy+(isMob?8:9)} textAnchor="middle" fontSize={isMob?28:32} fontWeight="700" fill="#1f2937" fontFamily="var(--sans)">{j}</text>
              {/* Подпись sub-полки — снаружи кольца */}
              {subName && parts ? (
                <text x={lx} y={ly-9} textAnchor={anchor} fontSize={isMob?17:20} fill="#1d1d1f" fontWeight="600" fontFamily="var(--serif)">
                  <tspan x={lx} dy="0">{parts[0]}</tspan>
                  <tspan x={lx} dy={isMob?20:24}>{parts[1]}</tspan>
                </text>
              ) : subName ? (
                <text x={lx} y={ly+7} textAnchor={anchor} fontSize={isMob?17:20} fill="#1d1d1f" fontWeight="600" fontFamily="var(--serif)">{subName}</text>
              ) : null}
            </g>;
          })}
          {/* Центральный декор: круглый якорь */}
          <circle cx={cx} cy={subCenterY} r="14" fill="#fff" stroke={dCol} strokeWidth="1.5" opacity=".4"/>
          <circle cx={cx} cy={subCenterY} r="6" fill={dCol} opacity=".25"/>
          <circle cx={cx} cy={subCenterY} r="3" fill={dCol}/>
        </g>;
      })()}
    </g>
    </svg>);
}

// ═══ POSITION DESCRIPTIONS ═══
const POS_DESC=[
  'Начальная точка цикла. Самое базовое, неочищенное состояние. Точка максимальной тьмы и покоя. В книге — Сила Тьмы, дно Чаши Тьмы, скрытая основа, с которой всё начинается.',
  'Первый результат ожидания во Тьме. Искра, первый просвет, самое холодное. В книге — Первый Свет: тяжёлое достижение Тьмы, долгожданное. Маленькое, но важное.',
  'Нарастание неявного света. Канал, по которому энергия течёт к главному событию. Лёгкое время — процесс ускоряется. Подготовка, вера в предстоящую победу.',
  'Главное событие цикла. Точка Проявления Света — рождение, восход, победа Света над Тьмой. Горизонт, Линия Борьбы. Время Истины, Стрелка Весов.',
  'Результат Проявления Света — рост, подъём, культура. Тяжёлое время: процесс замедляется. В книге — Подъём Солнца: явный свет растёт, но всё труднее.',
  'Последняя Тьма — конец сомнений, накопитель перед вершиной. Конец одного этапа, вера перед следующим. Проявляется пар, тепло уходит в облака.',
  'Вершина цикла. Максимум света и ясности. В книге — Сила Света, дно Чаши Света, Чистый Свет дня. Центр, откуда всё видно. Время Ожидания плодов труда.',
  'Первая Тьма — пик жара, результат дневного труда. Самое тёплое время. Первый знак спада. Победа над собой: намеченное сделано.',
  'Спуск, защита. Самое красивое время суток. Лёгкое время: процесс ускоряется вниз. Вера в жизнь и справедливость. Тьма начинает проявляться.',
  'Точка Проявления Тьмы — закат, победа Тьмы над Светом. Время Розыгрыша, Планка Весов. Горизонт, обманчивое время: видишь не то, что есть на самом деле.',
  'Угасание. Итог вечернего боя (победа Тьмы). Тяжёлое время: замедление. В книге — Вечерние Сумерки: растёт явная тьма, свет отступает.',
  'Конец цикла. Последний Свет — трудное достижение Сумерек. Вера в завтра: этот бой не последний, цикл замкнётся новой зарёй.',
];

const CROSS_CTX={
  support:{
    0:'Сила Тьмы — дно Чаши Тьмы, скрытая основа. Без этой опоры ничего не начнётся.',
    3:'Проявление Света — восход, победа Света над Тьмой. Точка Истины, Стрелка Весов.',
    6:'Сила Света — дно Чаши Света, Чистый Свет дня. Открытая вершина, центр.',
    9:'Проявление Тьмы — закат, победа Тьмы над Светом. Точка Розыгрыша, Планка Весов.',
  },
  right:{
    1:'Первый Свет — результат ожидания во Тьме (после 0). Самый холод. Исход из Тьмы.',
    4:'Подъём Солнца — исход утреннего боя (после 3). Свет победил.',
    7:'Первая Тьма — результат дневного труда (после 6). Самое тепло. Победа над собой.',
    10:'Вечерние Сумерки — исход вечернего боя (после 9). Победа Тьмы, здравый смысл.',
  },
  left:{
    2:'Утренняя Заря — вера в победу Света перед утренним боем (→3). Подготовка.',
    5:'Последняя Тьма — вера в свои силы перед трудом дня (→6). Конец сомнений.',
    8:'Вечерний Закат — вера в жизнь перед вечерним боем (→9). Сложная вера.',
    11:'Последний Свет — вера в завтра после поражения (→0). Этот бой не последний.',
  }
};

const PRANA_CTX={
  she:'Устойчивость, неизменность, фундамент. Звуковая форма: ШЕ (глухой) / ЭЛ (звонкий). Треугольник Земли: позиции 0, 4, 8 связаны через стабильность.',
  fo:'Спад, текучесть, понижение. Звуковая форма: ФО (глухой) / ОМ (звонкий). Треугольник Воды: позиции 1, 5, 9 связаны через движение и переломы.',
  tsi:'Неустойчивый покой, переходность. Звуковая форма: ЦИ (глухой) / ИНЬ (звонкий). Треугольник Воздуха: позиции 2, 6, 10 связаны через промежуточность.',
  ha:'Рост, вспышка, повышение. Звуковая форма: ХА (глухой) / АНГ (звонкий). Треугольник Огня: позиции 3, 7, 11 связаны через энергию перемен.',
};

const OPP_DESC={
  0:'Сила Тьмы ↔ Сила Света. Ось — Линия Единства (вертикаль). Скрытое ↔ Явное.',
  1:'Первый Свет ↔ Первая Тьма. Самый холод ↔ самый жар. Начало света ↔ начало тьмы.',
  2:'Утренняя Заря ↔ Вечерний Закат. Нарастание ↔ Спад. Один процесс — два направления.',
  3:'Проявление Света ↔ Проявление Тьмы. Ось — Линия Борьбы (горизонт). Истина ↔ Розыгрыш. Стрелка ↔ Планка Весов.',
  4:'Подъём Солнца ↔ Вечерние Сумерки. Утренний итог ↔ Вечерний итог. Рост ↔ Угасание.',
  5:'Последняя Тьма ↔ Последний Свет. Конец сомнений перед трудом ↔ Вера в завтра после поражения.',
};

function Info({i,p,af=[],y={},overlay=null,onEdit,onClose,onSel}){
  if(i===null)return null;
  const cr=CR[gc(i)],pr=PR[gp(i)],ref=REF[i],label=p[i]||'',oppLabel=p[opp(i)]||'';
  const prevL=p[(i+11)%12]||'',nextL=p[(i+1)%12]||'';
  const isLong=i%2===0;
  const oppPairIdx=i<6?i:i-6;
  const hasMech=af.length>0;
  const isEmpty=!label;
  // Polarity relation: which pole does this position belong to?
  const poleVert=[0,1,11].includes(i)?'bh':[5,6,7].includes(i)?'th':null;
  const poleHoriz=[2,3,4].includes(i)?'lh':[8,9,10].includes(i)?'rh':null;
  const overlayLabel=overlay&&overlay.p?(overlay.p[i]||''):'';

  const mechItems=[];
  af.forEach(fid=>{
    if(['support','right','left'].includes(fid)){
      if(CR[fid].p.includes(i)) mechItems.push({c:CR[fid].c,title:CR[fid].n+' · '+CR[fid].v,text:CROSS_CTX[fid][i]});
      else mechItems.push({c:'#aeaeb2',title:CR[fid].n,text:'Позиция '+i+' не входит в этот крест ('+CR[fid].p.join('·')+')',dim:true});
    }
    if(['she','fo','tsi','ha'].includes(fid)){
      if(PR[fid].p.includes(i)) mechItems.push({c:PR[fid].c,title:PR[fid].n,text:PRANA_CTX[fid]});
      else mechItems.push({c:'#aeaeb2',title:PR[fid].n,text:'Позиция '+i+' не входит в треугольник ('+PR[fid].p.join('·')+')',dim:true});
    }
    if(fid==='opp') mechItems.push({c:'#ff9500',title:'↔ ['+i+'] — ['+opp(i)+']',text:OPP_DESC[oppPairIdx]+(oppLabel?' «'+label+'» ↔ «'+oppLabel+'»':'')});
    if(fid==='rhythm'){
      const triples=[[2,3,4],[5,6,7],[8,9,10],[11,0,1]];
      const tri=triples.find(t=>t.includes(i));
      if(tri){
        const myK=tri.indexOf(i);
        const roles=[{r:'Вера',l:'подготовка',c:'#5B9CF6'},{r:'Бой',l:'событие',c:'#E8364F'},{r:'Победа',l:'итог',c:'#E8A834'}];
        const role=roles[myK];
        const triIdx=triples.indexOf(tri)+1;
        const triNames=['I','II','III','IV'];
        const steps=tri.map((j,k)=>({idx:j,role:roles[k],name:p[j]||'',active:k===myK}));
        mechItems.push({c:'#30A060',title:'Ритм · Тройка '+triNames[triIdx-1]+' · '+role.r,steps});
      }
    }
    if(fid==='arcs'){
      const arcs=[[1,2,3,4,5],[5,6,7,8,9],[9,10,11,0,1]];
      const arcNames=['Дуга I (утренняя)','Дуга II (дневная)','Дуга III (ночная)'];
      const arcRoles=[{r:'ФО',l:'исток',c:'#4090D8'},{r:'ЦИ',l:'нагрев',c:'#70B8F0'},{r:'ХА',l:'пик',c:'#F06838'},{r:'ШЭ',l:'остыв.',c:'#C0943A'},{r:'ФО',l:'конец',c:'#4090D8'}];
      arcs.forEach((arc,ai)=>{
        if(arc.includes(i)){
          const myK=arc.indexOf(i);
          const role=arcRoles[myK];
          const steps=arc.map((j,k)=>({idx:j,role:arcRoles[k],name:p[j]||'',active:k===myK}));
          mechItems.push({c:['#4090D8','#9060D0','#30A060'][ai],title:arcNames[ai]+' · '+role.r+' ('+role.l+')',steps});
        }
      });
    }
    if(fid==='halves'){
      const isLight=[4,5,6,7,8].includes(i);
      const isDark=[10,11,0,1,2].includes(i);
      const isHoriz=[3,9].includes(i);
      const isLeft=[1,2,3,4,5].includes(i);
      const isRight=[7,8,9,10,11].includes(i);
      const isVert=[0,6].includes(i);
      mechItems.push({c:isLight?'#C0A030':isDark?'#5868B8':'#86868b',
        title:isLight?'Чаша Света (верх)':isDark?'Чаша Тьмы (низ)':'Горизонт',
        text:isLight?'Явное, открытое, активное. Позиции 4-5-6-7-8.':isDark?'Скрытое, закрытое, пассивное. Позиции 10-11-0-1-2.':'Соединяет чаши. Точка борьбы и перехода.'});
      mechItems.push({c:isLeft?'#28A060':isRight?'#A046A0':'#86868b',
        title:isLeft?'Левая половина (нарастание)':isRight?'Правая половина (спад)':'Ось Единства',
        text:isLeft?'Энергия растёт, свет нарастает. Позиции 1-2-3-4-5.':isRight?'Энергия падает, свет убывает. Позиции 7-8-9-10-11.':'Вертикальная ось. Полюс '+(i===0?'Тьмы':'Света')+'.'});
    }
    if(fid==='error89'){
      const isMain=[8,9].includes(i);
      const isMirror=[2,3].includes(i);
      const isOpCross=[0,3,6,9].includes(i);
      const opErrors={0:'Ошибка во сне: решение приходит во сне, но ты не уверен, было ли оно.',3:'Просмотрел: на Востоке (Истина) кажется всё точно, но можно просмотреть деталь.',6:'Мираж: на вершине (День) иллюзия полноты, но реальность сложнее.',9:'Ошибка измерения: на Западе (Розыгрыш) мир показывает не то, что есть.'};
      if(isMain) mechItems.push({c:'#D946EF',title:'Зона ошибки 8↔9',text:'Элементы полочек 8 и 9 могут быть перепутаны. «'+( p[8]||'[8]')+' » выглядит как «'+(p[9]||'[9]')+'» и наоборот. ДЕВять содержит ДЕВА(8), ВОСемь содержит ВЕСы(9) — язык хранит эту путаницу.'});
      else if(isMirror) mechItems.push({c:'#D946EF',title:'Зеркало ошибки 2↔3',text:'Если 8↔9 путаются, то и 2↔3 тоже. «'+(p[2]||'[2]')+'» может содержать свойства «'+(p[3]||'[3]')+'». Пример: бар(2) по сути кухня(3), но в столовой.'});
      else if(isOpCross) mechItems.push({c:'#D946EF',title:'Ошибка Опорного креста',text:opErrors[i]});
      else mechItems.push({c:'#D946EF44',title:'Ошибка 8↔9',text:'Позиция '+i+' не в зоне основной ошибки. Главная путаница — между 8 и 9 (и зеркально 2↔3).',dim:true});
    }
    if(fid==='__none__'){
      if([0,6].includes(i)) mechItems.push({c:'#86868b',title:'Линия Единства (0↔6)',text:'Вертикальная ось. Позиция '+i+' — '+(i===0?'полюс Тьмы':'полюс Света')+'.'});
      else if([3,9].includes(i)) mechItems.push({c:'#86868b',title:'Линия Борьбы (3↔9)',text:'Горизонтальная ось. Позиция '+i+' — '+(i===3?'Восток (Истина)':'Запад (Розыгрыш)')+'.'});
      else mechItems.push({c:'#aeaeb2',title:'Оси',text:'Позиция '+i+' не на осях.',dim:true});
    }
  });

  const Tag=({color,children})=><span style={{display:'inline-block',padding:'1px 8px',borderRadius:10,fontSize:10,fontWeight:500,background:color+'12',color:color,border:`1px solid ${color}25`}}>{children}</span>;

  // Split mechItems into active and dim; collapse dim into one line when there are many
  const activeMech=mechItems.filter(it=>!it.dim);
  const dimMech=mechItems.filter(it=>it.dim);
  const collapseDim=dimMech.length>3;

  // Scroll indicator: show only when content overflows
  const[scrollHint,setScrollHint]=useState(false);
  const scrollRef=(el)=>{
    if(!el)return;
    const check=()=>{
      const overflowing=el.scrollHeight>el.clientHeight+4;
      const atBottom=el.scrollTop+el.clientHeight>=el.scrollHeight-8;
      setScrollHint(overflowing&&!atBottom);
    };
    check();
    el.onscroll=check;
    // re-check after mechItems might re-render
    setTimeout(check,50);
  };

  // Card size state: 'compact' | 'mid' | 'full' (mobile only)
  const[cardSize,setCardSize]=useState('compact');
  const sizeHeights={compact:0.32,mid:0.60,full:0.90}; // vh fractions

  // Drag state kept in ref to avoid stale closure + re-render churn
  const dragRef=React.useRef(null);

  // Cycle through states on tap of handle
  const cycleSize=()=>{
    setCardSize(s=>s==='compact'?'mid':s==='mid'?'full':'compact');
  };

  useEffect(()=>{
    const handle=document.querySelector('.fi-handle');
    if(!handle)return;

    const onDown=(e)=>{
      // Don't start drag on close button or interactive children
      if(e.target.closest('button'))return;
      const y=e.touches?e.touches[0].clientY:e.clientY;
      const h=window.innerHeight;
      // Mark if the touch started on the narrow handle (tap here cycles sizes)
      const fromHandle=e.currentTarget.classList.contains('fi-handle');
      dragRef.current={startY:y,startH:sizeHeights[cardSize]*h,h,moved:false,curH:null,tapStart:Date.now(),fromHandle};
      // add window listeners
      window.addEventListener('touchmove',onMove,{passive:false});
      window.addEventListener('touchend',onUp);
      window.addEventListener('touchcancel',onUp);
      window.addEventListener('mousemove',onMove);
      window.addEventListener('mouseup',onUp);
    };
    const onMove=(e)=>{
      const d=dragRef.current;
      if(!d)return;
      const y=e.touches?e.touches[0].clientY:e.clientY;
      const dy=d.startY-y;
      const newH=Math.max(d.h*0.20, Math.min(d.h*0.92, d.startH+dy));
      const el=document.querySelector('.fi');
      if(el){ el.style.height=newH+'px'; el.style.maxHeight=newH+'px'; el.classList.add('fi-dragging'); }
      d.curH=newH;
      d.moved=Math.abs(dy)>5;
      if(e.cancelable)e.preventDefault();
    };
    const onUp=()=>{
      const d=dragRef.current;
      if(!d){cleanup();return;}
      const el=document.querySelector('.fi');
      const wasTap=!d.moved&&(Date.now()-d.tapStart)<300;
      if(wasTap&&d.fromHandle){
        // Only cycle on handle tap
        if(el){ el.style.height=''; el.style.maxHeight=''; el.classList.remove('fi-dragging'); }
        cycleSize();
      } else if(d.curH!=null){
        const frac=d.curH/d.h;
        let target='compact';
        if(frac>0.75) target='full';
        else if(frac>0.45) target='mid';
        setCardSize(target);
        if(el){ el.style.height=''; el.style.maxHeight=''; el.classList.remove('fi-dragging'); }
      } else {
        if(el){ el.style.height=''; el.style.maxHeight=''; el.classList.remove('fi-dragging'); }
      }
      dragRef.current=null;
      cleanup();
    };
    const cleanup=()=>{
      window.removeEventListener('touchmove',onMove);
      window.removeEventListener('touchend',onUp);
      window.removeEventListener('touchcancel',onUp);
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('mouseup',onUp);
    };

    handle.addEventListener('touchstart',onDown,{passive:true});
    handle.addEventListener('mousedown',onDown);
    // Also attach to header zone for bigger swipe target
    const headerZone=document.querySelector('.fi-header-zone');
    if(headerZone){
      headerZone.addEventListener('touchstart',onDown,{passive:true});
      headerZone.addEventListener('mousedown',onDown);
    }
    return()=>{
      handle.removeEventListener('touchstart',onDown);
      handle.removeEventListener('mousedown',onDown);
      if(headerZone){
        headerZone.removeEventListener('touchstart',onDown);
        headerZone.removeEventListener('mousedown',onDown);
      }
      cleanup();
    };
  },[cardSize]);

  // Reset card size when selecting a new position
  useEffect(()=>{setCardSize('compact');},[i]);

  return(
    <div className={"fi fi-"+cardSize+" fi-sidepanel"} style={{width:'100%',height:'100%',background:'rgba(255,255,255,.98)',display:'flex',flexDirection:'column'}}>
      <div className="fi-handle" style={{display:'flex',justifyContent:'center',flexShrink:0}}>
        <div className="fi-handle-bar" style={{width:36,height:4,borderRadius:2,background:'#d2d2d7'}}/>
      </div>
      <div className="fi-header-zone" style={{padding:'4px 18px 8px',flexShrink:0,position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:2,right:12,width:28,height:28,borderRadius:'50%',border:'1px solid #e5e5ea',background:'#f5f5f7',fontSize:14,color:'#86868b',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:1}}>✕</button>
        <div style={{display:'flex',alignItems:'center',gap:12,paddingRight:34}}>
          <div style={{width:36,height:36,borderRadius:'50%',border:`2px solid ${cr.c}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,color:cr.c,flexShrink:0}}>{i}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:16,color:'#1d1d1f',fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label||<span style={{color:'#aeaeb2'}}>Не заполнено</span>}</div>
            <div style={{display:'flex',alignItems:'center',gap:4,marginTop:3,flexWrap:'wrap'}}>
              {ref.f&&<span style={{fontSize:9,color:'#6e6e73',textTransform:'uppercase',letterSpacing:0.5,fontWeight:700,marginRight:4}}>{ref.f}</span>}
              <Tag color={cr.c}>{cr.v}</Tag>
              <Tag color={pr.c}>{pr.n.split(' ')[0]}</Tag>
              <Tag color="#86868b">{isLong?'Долгое':'Короткое'}</Tag>
            </div>
          </div>
        </div>
      </div>
      <div ref={scrollRef} style={{flex:1,overflowY:'auto',padding:'0 18px 16px',position:'relative'}}>
        {/* Соседи — 3 кликабельных строки (Block 2.4) */}
        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12,paddingBottom:10,borderBottom:'1px solid #f0f0f2'}}>
          <button onClick={()=>onSel&&onSel((i+11)%12)} title='Перейти к предыдущей полке' style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#424245',background:'transparent',border:'none',padding:'4px 6px',borderRadius:6,cursor:'pointer',textAlign:'left',width:'100%'}} onMouseEnter={e=>e.currentTarget.style.background='#f5f5f7'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <span style={{color:'#86868b',fontSize:14,fontWeight:600,minWidth:14}}>←</span>
            <span style={{color:'#aeaeb2',fontSize:10,fontWeight:600,minWidth:14}}>{(i+11)%12}</span>
            <span style={{color:prevL?'#1d1d1f':'#c0c0c5',fontStyle:prevL?'normal':'italic'}}>{prevL||'—'}</span>
          </button>
          <button onClick={()=>onSel&&onSel((i+1)%12)} title='Перейти к следующей полке' style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#424245',background:'transparent',border:'none',padding:'4px 6px',borderRadius:6,cursor:'pointer',textAlign:'left',width:'100%'}} onMouseEnter={e=>e.currentTarget.style.background='#f5f5f7'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <span style={{color:'#86868b',fontSize:14,fontWeight:600,minWidth:14}}>→</span>
            <span style={{color:'#aeaeb2',fontSize:10,fontWeight:600,minWidth:14}}>{(i+1)%12}</span>
            <span style={{color:nextL?'#1d1d1f':'#c0c0c5',fontStyle:nextL?'normal':'italic'}}>{nextL||'—'}</span>
          </button>
          <button onClick={()=>onSel&&onSel(opp(i))} title='Перейти к противоположной полке' style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#424245',background:'transparent',border:'none',padding:'4px 6px',borderRadius:6,cursor:'pointer',textAlign:'left',width:'100%'}} onMouseEnter={e=>e.currentTarget.style.background='#fef8e7'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <span style={{color:'#ff9500',fontSize:14,fontWeight:600,minWidth:14}}>↔</span>
            <span style={{color:'#aeaeb2',fontSize:10,fontWeight:600,minWidth:14}}>{opp(i)}</span>
            <span style={{color:oppLabel?'#1d1d1f':'#c0c0c5',fontStyle:oppLabel?'normal':'italic'}}>{oppLabel||'—'}</span>
          </button>
          {overlay&&<div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#af52de',flexWrap:'wrap'}}>
            <span style={{fontWeight:600}}>⊕</span>
            <span style={{color:'#aeaeb2',fontSize:10,fontWeight:600,fontStyle:'italic'}}>{overlay.name||overlay.n||'наложение'}:</span>
            <span style={{color:overlayLabel?'#af52de':'#c0c0c5',fontStyle:overlayLabel?'normal':'italic'}}>{overlayLabel||'—'}</span>
          </div>}
        </div>
        <div style={{fontSize:13,color:'#424245',lineHeight:1.6,marginBottom:10,padding:'10px 12px',background:'var(--bg2)',borderRadius:10}}>
          {POS_DESC[i]}
        </div>
      {isEmpty&&onEdit&&<button onClick={onEdit} style={{width:'100%',padding:'9px 12px',marginBottom:10,background:'rgba(0,122,255,.06)',border:'1px dashed rgba(0,122,255,.35)',borderRadius:10,color:'#0071e3',fontSize:12,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
        <span style={{fontSize:14}}>✎</span>
        <span>Заполнить позицию {i}</span>
      </button>}
      {(poleVert||poleHoriz)&&(y.th||y.bh||y.lh||y.rh)&&<div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:10,padding:'8px 10px',background:'#faf7ff',borderRadius:8,border:'1px solid #ece3f7'}}>
        <div style={{fontSize:12,fontWeight:600,color:'#0058b8',marginBottom:4}}>Открыть в Ясне «{y.name}» →</div>
        {poleVert==='th'&&y.th&&<div style={{fontSize:11,color:'#424245'}}><span style={{color:'#86868b'}}>▲ ближе к верху:</span> <b>{y.th}</b></div>}
        {poleVert==='bh'&&y.bh&&<div style={{fontSize:11,color:'#424245'}}><span style={{color:'#86868b'}}>▼ ближе к низу:</span> <b>{y.bh}</b></div>}
        {poleHoriz==='lh'&&y.lh&&<div style={{fontSize:11,color:'#424245'}}><span style={{color:'#86868b'}}>◀ ближе к лево:</span> <b>{y.lh}</b></div>}
        {poleHoriz==='rh'&&y.rh&&<div style={{fontSize:11,color:'#424245'}}><span style={{color:'#86868b'}}>▶ ближе к право:</span> <b>{y.rh}</b></div>}
      </div>}
      {activeMech.length>0&&<div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:6}}>
        {activeMech.map((it,j)=><div key={j} style={{padding:'6px 10px',background:it.c+'08',borderRadius:8,borderLeft:`3px solid ${it.c}`,flexShrink:0}}>
          <div style={{fontSize:10,fontWeight:600,color:it.c,marginBottom:it.steps?4:1}}>{it.title}</div>
          {it.steps
            ?<div style={{display:'flex',flexDirection:'column',gap:2,marginTop:2}}>
              {it.steps.map((s,k)=><div key={k} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,padding:s.active?'3px 6px':'2px 6px',background:s.active?'#ffffff':'transparent',borderRadius:4,border:s.active?'1px solid '+it.c+'40':'1px solid transparent'}}>
                <span style={{fontSize:9,color:s.role.c,fontWeight:700,minWidth:22,padding:'1px 4px',background:s.role.c+'14',borderRadius:3,textAlign:'center'}}>{s.role.r}</span>
                <span style={{fontSize:9,color:'#86868b',minWidth:14}}>[{s.idx}]</span>
                <span style={{color:s.active?'#1d1d1f':'#424245',fontWeight:s.active?600:400,flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name||<span style={{color:'#c0c0c5',fontStyle:'italic'}}>—</span>}</span>
                <span style={{fontSize:9,color:'#aeaeb2'}}>{s.role.l}</span>
              </div>)}
            </div>
            :<div style={{fontSize:11,color:'#424245',lineHeight:1.45}}>{it.text}</div>
          }
        </div>)}
      </div>}
      {dimMech.length>0&&(collapseDim
        ?<div style={{padding:'6px 10px',background:'#fafafa',borderRadius:8,border:'1px dashed #e5e5ea',fontSize:10,color:'#aeaeb2',lineHeight:1.5,marginBottom:6}}>
          <span style={{fontWeight:600}}>Не входит в:</span> {dimMech.map(it=>it.title).join(' · ')}
        </div>
        :<div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:6}}>
          {dimMech.map((it,j)=><div key={'d'+j} style={{padding:'6px 10px',background:'#fafafa',borderRadius:8,borderLeft:'3px solid #e5e5ea',opacity:.55}}>
            <div style={{fontSize:10,fontWeight:600,color:'#aeaeb2',marginBottom:1}}>{it.title}</div>
            <div style={{fontSize:11,color:'#aeaeb2',lineHeight:1.45}}>{it.text}</div>
          </div>)}
        </div>
      )}
      </div>
      {scrollHint&&<div style={{position:'absolute',bottom:0,left:0,right:0,height:28,background:'linear-gradient(transparent,rgba(255,255,255,.95))',display:'flex',alignItems:'flex-end',justifyContent:'center',paddingBottom:4,pointerEvents:'none'}}>
        <span style={{fontSize:10,color:'#aeaeb2',animation:'bounce 1.5s infinite'}}>↓</span>
      </div>}
    </div>);
}

function OverlayLegend({y,overlay,onClear}){
  if(!overlay)return null;
  return(
    <div className="overlay-legend" style={{position:'absolute',top:50,right:12,background:'rgba(255,255,255,.95)',border:'1px solid rgba(0,0,0,.06)',borderRadius:12,padding:'10px 14px',backdropFilter:'blur(16px)',minWidth:180,zIndex:10}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <span style={{fontSize:10,color:'#6e6e73',textTransform:'uppercase',letterSpacing:1}}>Совмещение</span>
        <button onClick={onClear} style={{fontSize:14,color:'#6e6e73',padding:'0 4px'}}>✕</button>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
        <div style={{width:12,height:3,borderRadius:2,background:'rgba(0,122,255,.6)'}}/>
        <span style={{fontSize:11,color:'#1d1d1f'}}>{y.name}</span>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <div style={{width:12,height:3,borderRadius:2,background:'rgba(175,82,222,.5)'}}/>
        <span style={{fontSize:11,color:'#af52de',fontStyle:'italic'}}>{overlay.name||overlay.n}</span>
      </div>
    </div>);
}

function Editor({y,setY,onClose}){
  return(
    <div className='editor-panel' style={{position:'fixed',top:0,right:0,width:370,height:'100vh',background:'rgba(255,255,255,.98)',borderLeft:'1px solid rgba(0,0,0,.08)',zIndex:50,display:'flex',flexDirection:'column'}}>
      <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
        <h3 style={{fontFamily:'var(--serif)',fontSize:18,color:'#1d1d1f',fontWeight:600}}>Редактор</h3>
        <span style={{fontSize:11,color:'#34c759',fontWeight:500,letterSpacing:.3}}>● автосохранение</span>
      </div>
      <div style={{padding:'12px 18px',overflowY:'auto',flex:1}}>
        <input value={y.name} onChange={e=>setY({...y,name:e.target.value})} placeholder="Название"
          style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--border)',color:'#1d1d1f',padding:'9px 12px',borderRadius:7,fontFamily:'var(--serif)',fontSize:17,fontWeight:700,marginBottom:10,outline:'none'}}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:14}}>
          {[['th','▲ Верх'],['bh','▼ Низ'],['lh','◀ Лево'],['rh','▶ Право']].map(([k,ph])=>
            <input key={k} placeholder={ph} value={y[k]||''} onChange={e=>setY({...y,[k]:e.target.value})}
              style={{background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--txt)',padding:'5px 8px',borderRadius:5,fontSize:10,outline:'none'}}/>
          )}
        </div>
        {y.p.map((l,i)=>{const c=CR[gc(i)].c;return(
          <div key={i} style={{display:'flex',alignItems:'center',gap:7,marginBottom:5}}>
            <div style={{width:26,height:26,borderRadius:'50%',border:`2px solid ${c}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:c,flexShrink:0}}>{i}</div>
            <input value={l} onChange={e=>{const np=[...y.p];np[i]=e.target.value;setY({...y,p:np});}} placeholder={(REF[i]||{}).f||''}
              style={{flex:1,background:'var(--bg)',border:'1px solid var(--border)',color:'#1d1d1f',padding:'7px 10px',borderRadius:5,fontSize:12,outline:'none'}}
              onFocus={e=>e.target.style.borderColor=c} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
          </div>);})}
      </div>
      <div style={{padding:'12px 18px',borderTop:'1px solid var(--border)',display:'flex',gap:8,flexShrink:0,background:'#fafafa'}}>
        <button onClick={onClose} style={{flex:1,padding:'11px 14px',borderRadius:9,fontSize:14,fontWeight:600,background:'#0071e3',color:'#fff',border:'none',cursor:'pointer',boxShadow:'0 1px 3px rgba(0,113,227,.2)'}}>✓ Сохранить и закрыть</button>
      </div>
    </div>);
}

function OverlayPicker({currentName,overlay,onSelect,onClose}){
  const[q,setQ]=useState('');
  const filtered=T.filter(t=>t.n!==currentName&&t.n.toLowerCase().includes(q.toLowerCase()));
  const rubrikList=filtered.filter(t=>t.rubrik);
  const customList=filtered.filter(t=>t.custom&&!t.rubrik);
  const otherList=filtered.filter(t=>!t.rubrik&&!t.custom);

  const Card=({t})=>{const active=overlay&&overlay.name===t.n;return(
    <button key={t.id} onClick={()=>{onSelect({name:t.n,p:[...t.p]});onClose();}}
      style={{position:'relative',padding:'11px 14px',paddingLeft:t.rubrik?18:14,paddingRight:active?36:14,borderRadius:10,fontSize:14,textAlign:'left',
        background:active?'rgba(175,82,222,.12)':'#f5f5f7',
        color:active?'#af52de':'#1d1d1f',
        border:`1px solid ${active?'rgba(175,82,222,.4)':'transparent'}`,
        fontWeight:active?600:400,
        fontStyle:active?'italic':'normal',
        transition:'all .12s',cursor:'pointer',overflow:'hidden'}}>
      {t.rubrik&&<span style={{position:'absolute',left:0,top:0,bottom:0,width:3,background:'#30A060'}} title="Проверена"/>}
      {t.n}
      {active&&<span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'#af52de',fontSize:15,fontWeight:700}}>✓</span>}
    </button>);};

  const Section=({title,items})=>items.length===0?null:(
    <div style={{marginBottom:18}}>
      <div style={{fontSize:11,fontWeight:600,color:'#6e6e73',textTransform:'uppercase',letterSpacing:1,marginBottom:8,paddingLeft:4}}>{title} <span style={{color:'#aeaeb2',fontWeight:400}}>· {items.length}</span></div>
      <div className='picker-grid' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        {items.map(t=><Card key={t.id} t={t}/>)}
      </div>
    </div>);

  return(
    <div className="popup-overlay" style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(0,0,0,.25)',zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)'}} onClick={onClose}>
      <div className='picker-inner' style={{background:'rgba(255,255,255,.99)',border:'1px solid rgba(175,82,222,.15)',borderRadius:20,boxShadow:'0 20px 60px rgba(0,0,0,.15)',padding:0,width:'100%',maxWidth:600,height:'82vh',maxHeight:720,display:'flex',flexDirection:'column',overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
        {/* HEADER */}
        <div style={{padding:'18px 22px 14px',borderBottom:'1px solid #f0f0f2',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
            <div style={{flex:1,minWidth:0,paddingRight:10}}>
              <h3 style={{fontFamily:'var(--serif)',fontSize:20,color:'#af52de',fontWeight:700,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Совместить «{currentName}» с…</h3>
              <div style={{fontSize:12,color:'#86868b'}}>Выберите вторую Ясну — её подписи появятся вторым кольцом вокруг.</div>
            </div>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:'50%',background:'#f5f5f7',border:'none',fontSize:16,color:'#6e6e73',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</button>
          </div>
          {/* SEARCH */}
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#aeaeb2',fontSize:14,pointerEvents:'none'}}>🔍</span>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск по названию..."
              style={{width:'100%',padding:'9px 14px 9px 36px',borderRadius:10,border:'1px solid #d2d2d7',fontSize:16,fontFamily:'var(--sans)',outline:'none',background:'#fff',color:'#1d1d1f',boxSizing:'border-box'}}
              onFocus={e=>e.target.style.borderColor='#af52de'}
              onBlur={e=>e.target.style.borderColor='#d2d2d7'}/>
            {q&&<button onClick={()=>setQ('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',width:22,height:22,borderRadius:'50%',border:'none',background:'#e5e5ea',color:'#6e6e73',fontSize:11,cursor:'pointer'}}>✕</button>}
          </div>
        </div>
        {/* LIST */}
        <div style={{flex:1,overflowY:'auto',padding:'14px 22px 18px'}}>
          {filtered.length===0?
            <div style={{textAlign:'center',padding:'60px 20px',color:'#aeaeb2',fontSize:13}}>Ничего не найдено по запросу «{q}»</div>
            :<>
              <Section title="Проверенные" items={rubrikList}/>
              <Section title="Встречи (кастомные)" items={customList}/>
              <Section title="Прочие" items={otherList}/>
            </>}
        </div>
      </div>
    </div>);
}

function Picker({pinned,onTogglePin,onClear,onClose}){
  const[q,setQ]=useState('');
  const filtered=T.filter(t=>t.n.toLowerCase().includes(q.toLowerCase()));
  const starterList=filtered.filter(t=>t.starter);
  const additionalList=filtered.filter(t=>t.rubrik&&!t.starter);
  const customList=filtered.filter(t=>t.custom&&!t.rubrik);
  const otherList=filtered.filter(t=>!t.rubrik&&!t.custom);
  const pinnedCount=pinned.length;
  const total=T.length;

  const Card=({t})=>{const active=pinned.includes(t.id);return(
    <button key={t.id} onClick={()=>onTogglePin(t.id)}
      style={{position:'relative',padding:'11px 14px',paddingLeft:t.rubrik?18:14,paddingRight:active?36:14,borderRadius:10,fontSize:14,textAlign:'left',
        background:active?'#e6f0fa':'#f5f5f7',
        color:active?'#0071e3':'#1d1d1f',
        border:`1px solid ${active?'rgba(0,122,255,.4)':'transparent'}`,
        fontWeight:active?600:400,
        transition:'all .12s',
        cursor:'pointer',
        overflow:'hidden'}}>
      {t.starter&&<span style={{position:'absolute',left:0,top:0,bottom:0,width:3,background:'#0071e3'}} title="Стартовая Ясна"/>}
      {t.rubrik&&!t.starter&&<span style={{position:'absolute',left:0,top:0,bottom:0,width:3,background:'#30A060'}} title="Из рубрикатора Ясн"/>}
      {t.n}
      {active&&<span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'#0071e3',fontSize:15,fontWeight:700}}>✓</span>}
    </button>);};

  const Section=({title,subtitle,items,empty})=>items.length===0?(empty?null:null):(
    <div style={{marginBottom:18}}>
      <div style={{marginBottom:8,paddingLeft:4}}>
        <div style={{fontSize:11,fontWeight:600,color:'#6e6e73',textTransform:'uppercase',letterSpacing:1}}>{title} <span style={{color:'#aeaeb2',fontWeight:400}}>· {items.length}</span></div>
        {subtitle&&<div style={{fontSize:11,color:'#aeaeb2',marginTop:2,textTransform:'none',letterSpacing:0}}>{subtitle}</div>}
      </div>
      <div className='picker-grid' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        {items.map(t=><Card key={t.id} t={t}/>)}
      </div>
    </div>);

  return(
    <div className="popup-overlay" style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(0,0,0,.25)',zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)'}} onClick={onClose}>
      <div className='picker-inner' style={{background:'rgba(255,255,255,.99)',border:'1px solid rgba(0,0,0,.08)',borderRadius:20,boxShadow:'0 20px 60px rgba(0,0,0,.15)',padding:0,width:'100%',maxWidth:600,height:'82vh',maxHeight:720,display:'flex',flexDirection:'column',overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
        {/* HEADER */}
        <div style={{padding:'18px 22px 14px',borderBottom:'1px solid #f0f0f2',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
            <div>
              <h3 style={{fontFamily:'var(--serif)',fontSize:20,color:'#1d1d1f',fontWeight:700,marginBottom:2}}>Все Ясны</h3>
              <div style={{fontSize:12,color:'#86868b'}}>Выбрано <b style={{color:'#0071e3'}}>{pinnedCount}</b> из {total} · показываются во вкладках</div>
            </div>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:'50%',background:'#f5f5f7',border:'none',fontSize:16,color:'#6e6e73',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
          </div>
          {/* SEARCH */}
          <div style={{position:'relative',marginBottom:10}}>
            <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#aeaeb2',fontSize:14,pointerEvents:'none'}}>🔍</span>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск по названию..."
              style={{width:'100%',padding:'9px 14px 9px 36px',borderRadius:10,border:'1px solid #d2d2d7',fontSize:16,fontFamily:'var(--sans)',outline:'none',background:'#fff',color:'#1d1d1f'}}
              onFocus={e=>e.target.style.borderColor='#0071e3'}
              onBlur={e=>e.target.style.borderColor='#d2d2d7'}/>
            {q&&<button onClick={()=>setQ('')} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',width:22,height:22,borderRadius:'50%',border:'none',background:'#e5e5ea',color:'#6e6e73',fontSize:11,cursor:'pointer'}}>✕</button>}
          </div>
          {/* ACTIONS */}
          <div className="picker-actions" style={{display:'flex',gap:6,alignItems:'center'}}>
            {pinnedCount===total?
              <button onClick={onClear} style={{fontSize:11,color:'#0071e3',border:'1px solid rgba(0,122,255,.3)',padding:'4px 12px',borderRadius:12,background:'rgba(0,122,255,.08)',cursor:'pointer',fontWeight:600}}>✓ Все выбраны — снять</button>
              :<button onClick={()=>{T.forEach(t=>{if(!pinned.includes(t.id))onTogglePin(t.id);});}} style={{fontSize:11,color:'#0071e3',border:'1px solid rgba(0,122,255,.3)',padding:'4px 12px',borderRadius:12,background:'transparent',cursor:'pointer'}}>✓ Выбрать все</button>}
            {(()=>{const starterIds=T.filter(t=>t.starter).map(t=>t.id);const allStarterSelected=starterIds.every(id=>pinned.includes(id));return allStarterSelected?
              <button onClick={()=>{starterIds.forEach(id=>{if(pinned.includes(id))onTogglePin(id);});}} style={{fontSize:11,color:'#0071e3',border:'1px solid rgba(0,122,255,.3)',padding:'4px 12px',borderRadius:12,background:'rgba(0,122,255,.08)',cursor:'pointer',fontWeight:600}}>★ Стартовые — снять</button>
              :<button onClick={()=>{starterIds.forEach(id=>{if(!pinned.includes(id))onTogglePin(id);});}} style={{fontSize:11,color:'#0071e3',border:'1px solid rgba(0,122,255,.3)',padding:'4px 12px',borderRadius:12,background:'transparent',cursor:'pointer'}}>★ Только стартовые</button>;})()}
            {pinnedCount>0&&pinnedCount<total&&<button onClick={onClear} style={{fontSize:11,color:'#E8364F',border:'1px solid rgba(232,54,79,.3)',padding:'4px 12px',borderRadius:12,background:'transparent',cursor:'pointer'}}>Снять все</button>}
            <div style={{flex:1}}/>
            <span className="picker-legend" style={{fontSize:10,color:'#aeaeb2',display:'flex',alignItems:'center',gap:10}}>
              <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:3,height:14,background:'#0071e3',display:'inline-block',borderRadius:1}}/> стартовая</span>
              <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:3,height:14,background:'#30A060',display:'inline-block',borderRadius:1}}/> из рубрикатора</span>
            </span>
          </div>
        </div>
        {/* LIST */}
        <div style={{flex:1,overflowY:'auto',padding:'14px 22px 18px'}}>
          {filtered.length===0?
            <div style={{textAlign:'center',padding:'60px 20px',color:'#aeaeb2',fontSize:13}}>Ничего не найдено по запросу «{q}»</div>
            :<>
              <Section title="Стартовые" subtitle="Шесть Ясн для первого знакомства — самые наглядные и связанные с опытом" items={starterList}/>
              <Section title="Дополнительные" subtitle="Остальные Ясны для углубления" items={additionalList}/>
              <Section title="Встречи (кастомные)" items={customList}/>
              <Section title="Прочие" items={otherList}/>
            </>}
        </div>
      </div>
    </div>);
}


const GLOSS=[
  {id:'type',title:'Долгое и Короткое время',color:'#1d1d1f',
   what:'12 позиций Ясны чередуются: чётные (0,2,4,6,8,10) — долгие, «грани»; нечётные (1,3,5,7,9,11) — короткие, «углы» или «переломы».',
   why:'Мир устроен как дыхание: вдох (накопление) → выдох (перемена). Долгое время копит количество, короткое высвобождает — это закон «перехода количества в качество», один из Основных Законов Ясны.',
   how:'Долгое время — это процесс, состояние, зона. Оно длится, в нём ничего резко не меняется — только плавное накопление. Короткое время — это перелом, момент, вспышка. В нём количество, накопленное за долгое время, переходит в новое качество.',
   apply:'Поставьте на чётную позицию то, что длится (комната, процесс, состояние, накопление). На нечётную — то, что происходит мгновенно (событие, перелом, вспышка, переход).',
   example:'Ясна Суток: Ночь(долгая) → Первый Свет(момент) → Заря(долгая) → Проявление Света(момент). Ясна Кухни: Разделка(долгая) → Плита(момент) → Полуфабрикаты(долгие) → Специи(момент).',
   questions:['Этот элемент — длительный процесс или мгновенное событие?','Можно ли «растянуть» этот элемент во времени? Если да — он долгий.','В этом элементе что-то накапливается — или происходит скачок?'],
   mistakes:['Поставить событие (момент, вспышку) на чётную позицию. Например «Взрыв» на позицию 4.','Поставить длительный процесс на нечётную позицию. Например «Плавание» на позицию 3.'],
   related:['support','rhythm']},
  {id:'support',title:'Опорный Крест (Крест Бытия)',color:'#E8364F',positions:'0 · 3 · 6 · 9',
   what:'Четыре главные точки Ясны — скелет, на котором держится всё. Если их убрать — явление рассыпется. Добродетель креста — Надежда. Другие имена: Крест Бытия, Крест Надежды.',
   why:'Опорный Крест образован двумя главными осями: Линия Единства (вертикаль 0↔6) разделяет нарастание и спад, Линия Борьбы (горизонт 3↔9) разделяет свет и тьму. Их пересечение — опора мира.',
   how:'Позиция 0 — Сила Тьмы. Дно Чаши Тьмы, скрытое начало, основа. Позиция 3 — Проявление Света. Восход, победа света над тьмой, точка истины. Позиция 6 — Сила Света. Дно Чаши Света, вершина, чистый свет. Позиция 9 — Проявление Тьмы. Закат, победа тьмы, точка весов и розыгрыша.',
   apply:'Сначала заполните эти 4 позиции. Спросите: что является основой (0)? первым переломом, рождением (3)? вершиной (6)? итогом, закатом (9)? Если ответы не приходят — Ясна ещё не созрела.',
   example:'Суток: 0=Ночь, 3=Восход, 6=День, 9=Закат. Дома: 0=Прихожая, 3=Кухня, 6=Чулан, 9=Спальня. Кухни: 0=Вход, 3=Плита, 6=Стол для готовки, 9=Делим на порции.',
   questions:['Если убрать этот элемент — Ясна рассыпется?','Это одно из 4 самых важных состояний явления?','0 и 6 — антиподы по Линии Единства? 3 и 9 — антиподы по Линии Борьбы?'],
   mistakes:['Второстепенный элемент на опорной позиции.','0 и 6 не являются антиподами — полюсы выбраны неверно.','Забыли проверить ось 3↔9.'],
   related:['opp','type','halves']},
  {id:'right',title:'Крест Управления (Правый / Крест Исхода)',color:'#E8A834',positions:'1 · 4 · 7 · 10',
   what:'Четыре позиции — итоги, результаты, исходы. Каждая следует за Опорной и показывает, что получилось. Добродетель — Любовь. Другие имена: Тепловой Крест, Крест Победы, Крест Любви.',
   why:'Каждое опорное событие рождает следствие. 1 — исход из Тьмы (первый просвет). 4 — исход утреннего боя (Свет победил). 7 — исход труда (жар). 10 — исход вечернего боя (Тьма победила). Это Крест Результатов.',
   how:'0→1: Первый Свет — результат ожидания во Тьме (самый холод). 3→4: Подъём Солнца — результат победы Света. 6→7: Первая Тьма — результат дневного труда (самое тепло). 9→10: Вечерние Сумерки — результат вечернего боя (победа Тьмы).',
   apply:'Для каждой позиции спросите: это следствие того, что было на предыдущей Опорной? Если элемент не является результатом — он стоит не на своём месте.',
   example:'Суток: Ночь(0)→Первый Свет(1), Восход(3)→Подъём(4), День(6)→Первая Тьма(7). Кухни: Плита(3)→Полуфабрикаты(4), Стол для готовки(6)→Готовое блюдо(7).',
   questions:['Этот элемент — РЕЗУЛЬТАТ предыдущей Опорной?','Без предыдущей Опорной этот элемент потеряет смысл?'],
   mistakes:['Поставить причину вместо следствия.','Перепутать с Крестом Веры: Управления = результат, Веры = подготовка.'],
   related:['left','support','rhythm']},
  {id:'left',title:'Крест Веры (Левый / Крест Левит)',color:'#5B9CF6',positions:'2 · 5 · 8 · 11',
   what:'Четыре позиции — подготовка, настройка, ожидание. Каждая предшествует Опорной. Добродетель — Вера. Другие имена: Крест Духа, Крест Свежести.',
   why:'Перед каждым опорным событием — период веры и подготовки. 2 — вера в победу утреннего боя. 5 — вера в свои силы перед трудом. 8 — вера в жизнь и справедливость. 11 — вера в завтра.',
   how:'2→3: Утренняя Заря готовит к восходу (вера в победу Света). 5→6: Последняя Тьма готовит ко Дню (вера в свои силы). 8→9: Вечерний Закат готовит к Заходу (вера в жизнь). 11→0: Последний Свет готовит к Ночи (вера в новое завтра).',
   apply:'Для каждой позиции спросите: это готовит к тому, что будет на следующей опорной? Если элемент не готовит — он не на месте.',
   example:'Суток: Заря(2) готовит к Восходу(3). Последняя Тьма(5) готовит ко Дню(6). Закат(8) готовит к Заходу(9). Последний Свет(11) готовит к Ночи(0).',
   questions:['Этот элемент ГОТОВИТ к следующей Опорной?','Он несёт ожидание, предчувствие, настройку?'],
   mistakes:['Поставить результат вместо подготовки.','Левый Крест — самый тихий. Не должно быть ярких событий.'],
   related:['right','support','rhythm']},
  {id:'rhythm',title:'Ритм «Вера → Бой → Победа»',color:'#30A060',positions:'4 тройки: 2-3-4, 5-6-7, 8-9-10, 11-0-1',
   what:'Каждые три соседние позиции образуют мини-историю: Крест Веры → Опорный → Крест Управления. Подготовка → Действие → Итог.',
   why:'Любое событие проходит три фазы: вера (подготовка), бой (действие), победа или исход (итог). Это универсальный ритм жизни, повторяющийся четырежды за цикл.',
   how:'Тройка I: 2(Вера)→3(Бой)→4(Победа). Тройка II: 5→6→7. Тройка III: 8→9→10. Тройка IV: 11→0→1. В каждой тройке первый элемент — с Креста Веры (подготовка), второй — Опорный (бой/событие), третий — с Креста Управления (результат).',
   apply:'Прочитайте каждую тройку как историю. Если не получается связный рассказ из трёх слов — что-то стоит не на месте.',
   example:'Кухни: Специи(верим в рецепт) → Стол для готовки(работаем) → Готовое блюдо(результат!). Животных: Лошадь(несёт к бою) → Козлы(бодаются) → Корова(молоко — победа).',
   questions:['Тройка читается как мини-история: подготовка→действие→итог?','Можно ли поменять элементы местами? Если да — порядок неверен.'],
   mistakes:['Три элемента не связаны по смыслу.','Элемент Вера ярче элемента Бой — должно быть наоборот.'],
   related:['support','right','left']},
  {id:'she',title:'Земля ШЭ',color:'#C0943A',positions:'0 · 4 · 8',
   what:'Треугольник из трёх позиций, объединённых качеством устойчивости. Стихия — Земля. В звуках: «ШЕ» (глухой) или «ЭЛ» (звонкий).',
   why:'В каждом явлении есть три точки стабильности — то, на чём всё стоит. Они образуют невидимый фундамент.',
   how:'Позиция 0 — основа (Сила Тьмы, неподвижность). Позиция 4 — подъём (остывание воздуха при испарении, устойчивый ход вверх). Позиция 8 — спуск (устойчивое остывание к закату). Все три — долгие процессы, все устойчивы.',
   apply:'Три элемента треугольника должны быть похожи по духу: все про стабильность, надёжность, фундамент. Между ними должна чувствоваться связь.',
   example:'Суток: 0=Ночь, 4=Подъём, 8=Спуск — три спокойных процесса. Животных: 0=Свинья, 4=Корова, 8=Собака — все приземлённые, верные, земные.',
   questions:['Все три элемента (0,4,8) про устойчивость и фундамент?','Между ними чувствуется внутренняя связь?'],
   mistakes:['Один из трёх — про перемены (это Вода, не Земля).','Элемент яркий и острый (это Огонь, не Земля).'],
   related:['fo','tsi','ha','type']},
  {id:'fo',title:'Вода ФО',color:'#4090D8',positions:'1 · 5 · 9',
   what:'Треугольник из трёх позиций, объединённых качеством текучести и спада. Стихия — Вода. В звуках: «ФО» (глухой) или «ОМ» (звонкий).',
   why:'В каждом явлении есть три точки перемен — моменты, когда что-то утекает, перетекает, меняет форму.',
   how:'Позиция 1 — первый результат (Первый Свет, искра из тьмы). Позиция 5 — Последняя Тьма (переход к пику). Позиция 9 — Проявление Тьмы (весы заката). Все три — короткие переломы.',
   apply:'Три элемента должны быть похожи: все про движение, поток, перемену. Все текучие, все на переломе.',
   example:'Кухни: 1=Мойка (вода!), 5=Специи (сыпучие), 9=Делим на порции. Круговорота воды: 1=Родник, 5=Облако, 9=Касание воды.',
   questions:['Все три элемента (1,5,9) про движение и текучесть?','Все три — короткие переломные моменты?'],
   mistakes:['Один из трёх устойчивый и неизменный (это Земля, не Вода).'],
   related:['she','tsi','ha','type']},
  {id:'tsi',title:'Воздух ЦИ',color:'#70B8F0',positions:'2 · 6 · 10',
   what:'Треугольник из трёх позиций, объединённых качеством переходности и неустойчивого покоя. Стихия — Воздух. В звуках: «ЦИ» (глухой) или «ИНЬ» (звонкий).',
   why:'В каждом явлении есть три промежуточных состояния — ни то, ни сё, переход от одного к другому.',
   how:'Позиция 2 — Утренняя Заря (канал, нарастание неявного света). Позиция 6 — Светлый День (Сила Света, неустойчивый покой). Позиция 10 — Вечерние Сумерки (угасание). Все три — долгие, все переходные.',
   apply:'Три элемента должны быть воздушными, лёгкими, промежуточными. Это каналы и мосты между событиями.',
   example:'Суток: 2=Заря(переход), 6=День(неустойчивый покой), 10=Сумерки(переход). Кухни: 2=Рыбы (разделочный стол), 6=Стол для готовки, 10=Оценочный стол.',
   questions:['Все три элемента (2,6,10) промежуточные, переходные?','Они больше мосты между событиями, чем сами события?'],
   mistakes:['Один из трёх — яркое событие (это Огонь, не Воздух).','Один из трёх — твёрдая основа (это Земля, не Воздух).'],
   related:['she','fo','ha','type']},
  {id:'ha',title:'Огонь ХА',color:'#F06838',positions:'3 · 7 · 11',
   what:'Треугольник из трёх позиций, объединённых качеством роста и вспышки. Стихия — Огонь. В звуках: «ХА» (глухой) или «АНГ» (звонкий).',
   why:'В каждом явлении есть три момента взрыва — когда энергия бьёт фонтаном и всё меняется разом.',
   how:'Позиция 3 — Проявление Света (восход, главный огонь, рождение). Позиция 7 — Первая Тьма (пик жара, результат труда). Позиция 11 — Последний Свет (последний огонь, зола). Все три — короткие, все яркие.',
   apply:'Три элемента должны быть горячими, острыми, энергичными. Это моменты, когда что-то загорается, взрывается, проявляется.',
   example:'Суток: 3=Восход(огонь!), 7=Первая Тьма(жар), 11=Последний Свет(огонь). Кухни: 3=Плита(огонь!), 7=Готовое блюдо(горячее!), 11=Вынос блюд.',
   questions:['Все три элемента (3,7,11) яркие и энергичные?','Все три — моменты перемен, а не длительные процессы?'],
   mistakes:['Один из трёх спокойный и текучий (это Вода, не Огонь).','Элемент длительный и стабильный (это Земля, не Огонь).'],
   related:['she','fo','tsi','type']},
  {id:'opp',title:'Противоположности (Полные противостояния)',color:'#ff9500',positions:'0↔6, 1↔7, 2↔8, 3↔9, 4↔10, 5↔11',
   what:'Каждая позиция имеет зеркальную пару через центр диаграммы. Всего 6 пар полных противостояний — это главное свойство Ясны как «учения о двойственности».',
   why:'Мир построен на парах: свет и тьма, рост и спад, начало и конец. Ясна отражает это: каждая позиция имеет свой антипод точно напротив, через центр.',
   how:'0↔6: Сила Тьмы и Сила Света (Линия Единства). 3↔9: Проявление Света и Проявление Тьмы (Линия Борьбы) — также называется Истина и Розыгрыш, Стрелка и Планка Весов. 1↔7: Первый Свет (холод) и Первая Тьма (жар). 2↔8: Утренняя Заря и Вечерний Закат. 4↔10: Подъём и Сумерки (утренний и вечерний итог). 5↔11: Последняя Тьма и Последний Свет.',
   apply:'Заполнив одну позицию, сразу проверьте её антипод. Если 0=Прихожая, то 6 должен быть зеркальным (Чулан — центр дома). Если антипод не находится — элемент не на месте.',
   example:'Суток: Ночь↔День, Восход↔Закат. Дома: Прихожая↔Чулан (вход↔центр). Животных: Свинья↔Человек (низ↔верх). Кухни: Вход↔Стол для готовки.',
   questions:['Можете точно назвать, в чём именно пара противоположна?','Если поменять местами — Ясна сломается?'],
   mistakes:['Элементы похожи вместо того чтобы быть антиподами.','Противоположность случайная, а не зеркальная.'],
   related:['support','halves']},
  {id:'arcs',title:'Три дуги (Дуги Тепла)',color:'#9060D0',positions:'Дуга I: 1→5, Дуга II: 5→9, Дуга III: 9→1',
   what:'Круг делится на три дуги по 5 позиций. Каждая дуга — мини-цикл нагрева и остывания. В книге также называется «Три Дуги Тепла».',
   why:'Внутри большого цикла (12 позиций) живут три малых цикла. Как три волны внутри одного прилива. Каждая дуга повторяет полный путь от Воды к Огню и обратно.',
   how:'Каждая дуга проходит все 4 стихии по порядку: Вода (исток) → Воздух (нагрев/ЦИ) → Огонь (пик/ХА) → Земля (остывание/ШЭ) → Вода (конец). Дуга I: 1→2→3→4→5. Дуга II: 5→6→7→8→9. Дуга III: 9→10→11→0→1.',
   apply:'Прочитайте каждую дугу из 5 элементов как связную последовательность. Если один из пяти выбивается — он не на месте. Середина дуги (Огонь ХА) должна быть самым ярким элементом.',
   example:'Круговорота воды: Дуга I: Родник→Река→Поверхность→Пар→Облако (подъём воды). Дуга II: Облако→Перенос→Гроза→Дождь→Касание (путь обратно). Кухни: Дуга II: Специи→Стол для готовки→Готовое блюдо→Делим на порции→Оценочный стол.',
   questions:['5 элементов дуги читаются как плавная история?','Середина дуги (ХА) — самый яркий элемент из пяти?'],
   mistakes:['Элемент в середине дуги тусклее крайних — должно быть наоборот.','Дуга не читается как связная последовательность.'],
   related:['rhythm','she','fo','tsi','ha']},
  {id:'error89',title:'Системная ошибка 8↔9',color:'#D946EF',positions:'Основная: 8↔9, Зеркальная: 2↔3, Опорная: 0·3·6·9',
   what:'На границе позиций 8 и 9 встроена путаница — элемент 8 может «притворяться» 9 и наоборот. Это не ошибка составителя, а свойство мира.',
   why:'Русский язык кодирует это: ДЕВять содержит ДЕВА (8-я полочка), ВОСемь содержит ВЕС (Весы, 9-я полочка). Слова перепутаны специально — язык хранит память об ошибке. Девиация (отклонение стрелки весов) — от того же корня.',
   how:'Основная зона: 8↔9. Элементы могут быть спутаны. В Ясне Суток: на закате оптические иллюзии — солнце «ещё видно» хотя уже зашло. Зеркальная зона: 2↔3. Если найдена путаница 8↔9, ищи аналогичную в 2↔3. Четыре типа ошибок на Опорном кресте: 0=ошибка во сне, 3=просмотрел, 6=мираж, 9=ошибка измерения.',
   apply:'Посмотрите на элементы 8 и 9 вашей Ясны. Спросите: можно ли их перепутать? Если да — это ХОРОШИЙ знак, подтверждает правильность. Проверьте зеркально: есть ли путаница между 2 и 3? Определите 4 типа ошибок для каждой опоры.',
   example:'Дома: 8=Женская комната, 9=Спальня. Лазарет — лежишь (как в спальне/9), но не спишь (как в женской/8). Зеркально: 2=Столовая, 3=Кухня. Бар — по сути кухня/3, но стоит в столовой/2. Животных: 8=Собака, 9=Птицы. «Стая волков» и «стая птиц» — перепутаны, должно быть «свора собак».',
   questions:['Можно ли перепутать элементы на позициях 8 и 9?','Есть ли состояние, которое выглядит как 9, но по сути является 8?','Есть ли зеркальная путаница между 2 и 3?'],
   mistakes:['Игнорировать эту механику. В каждой Ясне ДОЛЖНА быть найдена зона путаницы 8↔9.','Считать путаницу ошибкой составления. Это свойство мира, а не баг.'],
   related:['support','opp','halves']},
  {id:'halves',title:'Четыре половины (зоны)',color:'#6366f1',positions:'Верх 4-8, Низ 10-2, Лево 1-5, Право 7-11',
   what:'Две главные оси Опорного креста делят круг на 4 зоны. Это НЕ противостояния (см. «Противоположности» — там пары точек), а визуальные половины, у которых есть общий характер.',
   why:'Линия Борьбы (горизонт 3↔9) делит мир на явное и скрытое. Линия Единства (вертикаль 0↔6) делит на нарастание и спад. Их пересечение даёт 4 зоны с одинаковым «настроением».',
   how:'Верх (Чаша Света, позиции 4-5-6-7-8) — явное, открытое, активное, дневное. Низ (Чаша Тьмы, 10-11-0-1-2) — скрытое, закрытое, пассивное, ночное. Лево (1-2-3-4-5) — нарастание, явный свет растёт. Право (7-8-9-10-11) — спад, свет убывает. Позиции 3 и 9 — сам горизонт (Линия Борьбы), точки перехода между верхом и низом.',
   apply:'Все верхние элементы должны быть про открытое и явное. Все нижние — про скрытое и тайное. Левые — про нарастание. Правые — про убывание. Если элемент не вписывается в свою зону — переместите его.',
   example:'Суток: Верх=День, Подъём, Закат (явное, видимое). Низ=Ночь, Заря, Сумерки (скрытое, неявное). Дома: Верх=Веранда, Амбар, Чулан, Детская, Женская (жилые). Низ=Кабинет, Санблок, Прихожая, Гостиная, Столовая (служебные/переходные).',
   questions:['Верхние элементы (4-8) про явное и открытое?','Нижние (10-2) про скрытое и неявное?','Левые (1-5) связаны с ростом? Правые (7-11) со спадом?'],
   mistakes:['Скрытый элемент стоит наверху (должен быть внизу).','Элемент роста стоит справа (должен быть слева).','Путать с Противоположностями: здесь зоны, а не пары.'],
   related:['support','opp']},
  {id:'names',title:'Имена Ясны',color:'#6e6e73',positions:'культурный слой',
   what:'У чертежа Ясны есть множество названий, каждое раскрывает свою грань. Понимать их — значит понимать, что одна и та же структура лежит в основе многих культурных символов.',
   why:'Разные имена — разные ракурсы одного и того же. В одной беседе удобно называть Ясну «Тарелочкой», в другой — «Диамантом» или «Орешком». Имя подсказывает, о каком свойстве сейчас идёт речь.',
   how:'Ясна (основное имя, от «ясный»). Матица / Матрица (суперпрограмма природы). Орешек Знания / Гранит Науки (шестиугольник, делённый горизонтом — с намёком на трудность изучения). Тарелочка / Блюдечко с голубой каёмочкой / Ясная Звезда / Путеводная Звезда / Турель (лучевая версия). Алмаз / Диамант / Бриллиант / Дамаск / Булат / Кристалл (двугранный меч с остриями на 3 и 9). Звезда Чисел / София / Вифлеемская Звезда / Орифметская Звезда (все три креста вместе). Зерно Познания, Двугранец, Дугранец.',
   apply:'Когда изучаете Ясну, обращайте внимание на имя — оно направляет мысль. «Алмаз» — думайте об остриях и гранях. «Тарелочка» — о полочках и раскладке. «София» — о единстве Надежды, Любви и Веры.',
   example:'«Разложить по полочкам» — изначально про Ясну (полочки = лучи). «Грызть гранит науки» — изучать шестиугольник Ясны. «Тарелочка с голубой каёмочкой» — Ясна с внешним ободом.',
   questions:['Какое имя Ясны лучше всего подходит к вашей задаче?','Видите ли вы в знакомых образах (алмаз, звезда, тарелочка) одну и ту же структуру?'],
   mistakes:['Считать разные имена разными объектами — это одна Ясна.'],
   related:['support','opp']},
  {id:'mb_zodiac',title:'Зодиак на Полках',color:'#7c3aed',positions:'все 12 (внешнее кольцо)',
   what:'12 знаков Зодиака как универсальное «адресное пространство» Ясны. Полка 0 = ♑ Козерог, 3 = ♈ Овен, 6 = ♋ Рак, 9 = ♎ Весы. Идём против часовой стрелки, как годовое колесо.',
   why:'Все 12-Полочные Ясны устроены одинаково: один и тот же знак отвечает за одинаковую роль в Сутках, Годе, Жизни, Двору, Растениях и т.д. Это превращает Зодиак в универсальный язык для сверки.',
   how:'Закрепите на Полке 0 знак ♑ Козерог (зимняя точка, минимум света). Дальше идите против часовой: 1=♒, 2=♓, 3=♈ (точка Овна — Утро/Весна/Рождение), 4=♉, 5=♊, 6=♋ (Рак — День/Лето/Зрелость), 7=♌, 8=♍, 9=♎ (Весы — Закат/Осень/Смерть-как-весы), 10=♏ (Скорпион), 11=♐.',
   apply:'Если ваше явление на Полке 6 не похоже на «летний максимум» — Полка 6 заполнена неверно. Сверьтесь со знаком: Полка 6 — Рак, точка изобилия, кульминации.',
   example:'Сутки: 0=Полночь(♑), 3=Восход(♈), 6=Полдень(♋), 9=Закат(♎). Жизнь: 0=Зачатие(♑), 3=Рождение(♈), 6=Зрелость(♋), 9=Старость(♎).',
   questions:['Каждая Полка совпадает по «режиму» с соответствующим знаком?','Идём против часовой стрелки (как годовое колесо)?'],
   mistakes:['Поставить летний образ на Полку 0 (там Козерог — зима).','Перепутать направление обхода с часовой стрелкой.'],
   related:['support','arcs','rhythm']},
  {id:'mb_scorpio_spider',title:'Скорпион↔Паук (верх↔низ)',color:'#dc2626',positions:'верх 4–8 vs низ 10–2; ось 3↔9 = Поле Боя',
   what:'Тело человека и любая 12-Полочная Ясна делятся горизонталью на две полусферы: верх (Полки 4–8) — Головной Паук = Сам = идея/контроль/мозг; низ (Полки 10–2) — Грудной Скорпион = Особа = тело/импульс/чакры. Между ними — Поле Боя на оси 3↔9.',
   why:'Это главный антропологический образ Жизни: вся внутренняя жизнь — постоянное противоборство Сама и Особы. Тот же закон работает в любом 12-Полочном явлении: верхняя половина — про намерение, нижняя — про реализацию.',
   how:'Поделите Ясну горизонталью 3↔9. Что выше — относится к плану, проекту, идее. Что ниже — к материи, действию, телу. Проверьте: Полка 6 (вершина) и Полка 0 (дно) находятся в «своих» зонах — 6 в Сам, 0 в Особе.',
   apply:'Если на Полку 6 (верх, Сам) случайно попадает «телесный» элемент (например, физическое усилие), а на Полку 0 — «идея» — половины перепутаны.',
   example:'Жизнь: верх = голова, нижняя половина = таз. Сутки: верх = День (свет, активность), низ = Ночь (тьма, покой). Кухня: верх = готовый продукт (план), низ = вход и сырьё.',
   questions:['Верх Полки соответствует идее/контролю?','Низ — телу/импульсу/материи?','На оси 3↔9 видно противоборство?'],
   mistakes:['Перепутать половины — поставить телесное наверх или идею вниз.','Игнорировать ось 3↔9 как точку противоборства.'],
   related:['halves','support','opp']},
  {id:'mb_mobius',title:'Замыкание ∞ (Лента Мёбиуса)',color:'#0891b2',positions:'Полка 11 → Полка 0 = Полка 12',
   what:'Структурный закон: цикл замыкается. Полка 11 переходит в Полку 0, которая одновременно является Полкой 12 — точкой завершения. Поэтому 0 и 12 — одно и то же место на круге.',
   why:'Без замыкания цикл рассыпается в линию. Мёбиус-связка делает Ясну действительно круговой: конец содержит зародыш начала. В Сутках Полночь → Утро. В Году Зима → Весна. В Жизни Смерть → Зачатие нового цикла.',
   how:'Проверьте, что Полка 11 содержит элемент, который естественно переходит в Полку 0. Если 11 — «остывание», то 0 — «новое накопление». Точка перелома между ними должна быть мгновенной (короткая → длинная).',
   apply:'Если Ясна выглядит как линейный список без замыкания — поправьте Полку 11, чтобы она готовила Полку 0.',
   example:'Сутки: 11=Последний Свет → 0=Ночь (новая тьма копит вновь). Жизнь: 11=Старость → 0=Зачатие нового. Кухня: 11=Меню/выдача → 0=Вход (новый посетитель).',
   questions:['Полка 11 готовит Полку 0?','Конец цикла осознан как начало следующего?'],
   mistakes:['Считать 11 «концом» без выхода в новый цикл.','Не оформить переход 11→0 как смысловой мост.'],
   related:['support','rhythm','arcs']},
  {id:'mb_accumulation',title:'Накопление → Переход',color:'#16a34a',positions:'длинные 0/3/6/9 копят → короткие переливают',
   what:'Закон перехода количества в качество, привязанный к 12-Полочной структуре. Длинные Полки (особенно опорные 0/3/6/9) копят материал/энергию/состояние. Короткие соседние Полки служат точками перелива — искрами, заслонками, переломами.',
   why:'Это объясняет, почему длинные и короткие Полки чередуются. Долгая фаза — резервуар; короткая фаза — клапан, через который накопленное прорывается в новую форму.',
   how:'Назовите для каждой длинной Полки: что именно копится? Затем для соседних коротких: какой именно «перелив» там происходит? Если ответы не приходят — длинная Полка не выполняет роль резервуара.',
   apply:'Полка 0 — глубокая тьма (копит холод/покой). Полка 1 — Искра (точка перелива в свет). Полка 2 — Утренняя Заря (плавное проявление накопленного света).',
   example:'Сутки: 0=Ночь(копит)→1=Искра(перелив)→2=Заря. Жизнь: 0=Зачатие(копит)→1=Рождение(перелив)→2=Имя.',
   questions:['На длинной Полке копится материал?','На короткой соседней — точка перелива?'],
   mistakes:['Длинная Полка без накопительной функции.','Короткая Полка без эффекта перелома.'],
   related:['type','rhythm']},
  {id:'mb_yasna2',title:'Ясна² — 144 Полки',color:'#a21caf',positions:'12 главных × 12 вложенных = 144',
   what:'Закон двойной вложенности. Каждая из 12 Полок Ясны может быть раскрыта в свою отдельную 12-Полочную Ясну. Итого получается 12×12 = 144 ячейки описания одного явления.',
   why:'Если 12 Полок недостаточно для описания явления — каждая Полка разворачивается в свою Ясну. Это даёт 144 «координаты» для разметки тонких подразделений. Подтверждается в Ясне Жизни через 144 Линии Тела (M-Ж-146): тело человека имеет ровно 144 разных названий складок и границ, что и есть Ясна² для тела.',
   how:'Возьмите конкретную Полку (например, Полку 6 = День в Сутках). Задайте: «А внутри Дня — какие 12 микро-фаз?» (Утро Дня, Полдень Дня, Полудень Дня, и т.д.). Каждая внешняя Полка получает свой внутренний цикл из 12 — структурно изоморфный главному.',
   apply:'Используется, когда явление слишком богатое для 12 Полок. Например, для тела человека: 12 главных Линий + у каждой 12 подразделений = 144 уникальных названия.',
   example:'Ясна Суток × Ясна Года = Ясна Жизни (12 Полок Сутoк × 12 Полок Года = 144 Полки Жизни). Тело: 12 главных Линий × 12 микро-Линий = 144 Линий Тела (M-Ж-146).',
   questions:['Можно ли каждую Полку этой Ясны развернуть в свою 12-Полочную Ясну?','Получится ли 144 осмысленных ячейки?'],
   mistakes:['Считать, что 12 Полок — предел описания.','Не различать главные и вложенные циклы.'],
   related:['support','rhythm','mb_zodiac']},


];



function Verification({y,vs,setVs,onClose}){
  const p=y.p||[];
  const[tab,setTab]=useState('fast');
  const[hidePassed,setHidePassed]=useState(false);
  const[openInfo,setOpenInfo]=useState(null);
  const[showIntro,setShowIntro]=useState(null);
  const[copyFeedback,setCopyFeedback]=useState('');
  const k=(id)=>y.name+'_'+id;
  const ans=(id,v)=>setVs(s=>({...s,[k(id)]:v}));
  const get=(id)=>vs[k(id)];

  const yasnaKeys=Object.keys(vs).filter(kk=>kk.startsWith(y.name+'_'));
  const hasAnyAnswer=yasnaKeys.length>0;

  useEffect(()=>{
    if(showIntro===null)setShowIntro(!hasAnyAnswer);
  },[]);

  const W={КРИТ:3,ВАЖ:2,ЖЕЛ:1};
  const scoreCount=(checks)=>{let pass=0,failed=0;checks.forEach(c=>{const v=get(c.id);if(v===true)pass++;else if(v===false)failed++});return{pass,failed,done:pass+failed,total:checks.length}};

  const emptyPos=[];
  for(let i=0;i<12;i++)if(!p[i])emptyPos.push(i);
  const hasEmpties=emptyPos.length>0;
  const lbl=(i)=>p[i]||'?';

  const Check=({id,weight,q,info,hint})=>{const v=get(id);const dim=hidePassed&&v===true;
    if(dim)return null;
    const wColor=weight==='КРИТ'?'#E8364F':weight==='ВАЖ'?'#E8A834':'#86868b';
    const isOpen=openInfo===id;
    return(
    <div data-check-id={id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 0',borderBottom:'1px solid #f0f0f2'}}>
      <div style={{display:'flex',gap:4,flexShrink:0,marginTop:1}}>
        <button onClick={()=>ans(id,v===true?null:true)} title="Да" style={{width:28,height:28,borderRadius:6,border:`1.5px solid ${v===true?'#30A060':'#d2d2d7'}`,background:v===true?'#30A06012':'#fff',fontSize:13,color:v===true?'#30A060':'#c7c7cc',cursor:'pointer',fontWeight:600}}>✓</button>
        <button onClick={()=>ans(id,v===false?null:false)} title="Нет" style={{width:28,height:28,borderRadius:6,border:`1.5px solid ${v===false?'#E8364F':'#d2d2d7'}`,background:v===false?'#E8364F12':'#fff',fontSize:13,color:v===false?'#E8364F':'#c7c7cc',cursor:'pointer',fontWeight:600}}>✗</button>
        <button onClick={()=>ans(id,v==='na'?null:'na')} title="Не применимо" style={{width:28,height:28,borderRadius:6,border:`1.5px solid ${v==='na'?'#86868b':'#d2d2d7'}`,background:v==='na'?'#86868b12':'#fff',fontSize:12,color:v==='na'?'#86868b':'#c7c7cc',cursor:'pointer',fontWeight:600}}>—</button>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:6,marginBottom:2}}>
          {weight&&<span style={{fontSize:9,fontWeight:700,color:wColor,padding:'1px 5px',border:`1px solid ${wColor}40`,borderRadius:3,letterSpacing:0.3,flexShrink:0,marginTop:2}}>{weight}</span>}
          <div style={{fontSize:13,color:'#1d1d1f',lineHeight:1.5,flex:1}}>{q}</div>
          {info&&<button onClick={()=>setOpenInfo(isOpen?null:id)} title="Подробнее"
            style={{width:20,height:20,borderRadius:'50%',border:'1.5px solid #c7c7cc',background:isOpen?'#0071e3':'#fff',color:isOpen?'#fff':'#86868b',fontSize:11,cursor:'pointer',fontWeight:700,flexShrink:0,marginTop:1,lineHeight:1,padding:0,fontFamily:'Georgia,serif',fontStyle:'italic'}}>i</button>}
        </div>
        {info&&isOpen&&<div style={{fontSize:12,color:'#424245',marginTop:6,padding:'8px 10px',background:'#f0f5ff',border:'1px solid #d4e4fb',borderRadius:6,lineHeight:1.55}} dangerouslySetInnerHTML={{__html:info.replace(/\*\*([^*]+)\*\*/g,'<b style="color:#1d1d1f">$1</b>')}}/>}
        {hint&&v===false&&<div style={{fontSize:11,color:'#c07800',marginTop:4,padding:'6px 10px',background:'#fff8e8',borderRadius:5,borderLeft:'2px solid #E8A834',lineHeight:1.5}}>💡 {hint}</div>}
      </div>
    </div>);};

  // ==================== ШАГ 0 — БЫСТРАЯ ПРОВЕРКА (7 пунктов) ====================
  // Прямая опора на канон Сутки № 88-97 + авторский алгоритм Год № 11-16
  const expressChecks=[
    {id:'ex_horizon',w:'КРИТ',
      q:'Линия Горизонта определена? Что в этом явлении противостоит чему?',
      info:'**Ясна Года №16:** «Построение Опорного Креста явления начинается с определения Горизонта этого явления.» В Ясне Суток это свет/тьма, в Ясне Года — тепло/холод, в Ясне Жизни — Сам/Особа.'},
    {id:'ex_kresty',w:'КРИТ',
      q:'Опорный Крест 0/3/6/9 — четыре опоры, без которых явление рассыпается?',
      info:'**Ясна Года №11:** «Построение Ясны какого-либо явления начинается с построения Опорного Креста этого явления.» **Ясна Года №12:** «Опорный Крест Явления есть Крест линии Горизонта этого явления и линии его Единения.»'},
    {id:'ex_twelve',w:'КРИТ',
      q:'Ровно 12 различных полок — не больше и не меньше?',
      info:'**Ясна Суток №88:** «Вот таким получилось полное описание суток. Всего двенадцать пунктов.» **Ясна Суток №90:** «Сутки есть двенадцать различных времён.»'},
    {id:'ex_alternation',w:'КРИТ',
      q:'Чередование 6 долгих + 6 коротких? Чётные (0,2,4,6,8,10) — долгие, нечётные (1,3,5,7,9,11) — короткие.',
      info:'**Ясна Суток №92:** «Сутки есть чередование шести долгих и шести коротких времён.»'},
    {id:'ex_closure',w:'КРИТ',
      q:'Цикл замыкается: Полка 11 переходит в Полку 0 = новое начало?',
      info:'**Ясна Суток №73:** «Откуда солнце ушло, туда и вернулось. Поэтому тринадцатый пункт в этом списке — это есть пункт первый.» **Ясна Года узел 8 №569–570:** Лента Мёбиуса.'},
    {id:'ex_param',w:'ВАЖ',
      q:'Один параметр для всех 12 полок (например, свет, тепло, возраст)?',
      info:'**Ясна Года №3:** «Закон устройства всех явлений природы.» Один параметр — то, что нарастает к Полке 6 и убывает к Полке 0.'},
    {id:'ex_unique',w:'ВАЖ',
      q:'Эта Ясна не повторяет уже существующую в той же области?',
      info:'**Ясна Года №5:** «внутреннее устройство всех вещей одинаково» — но каждая Ясна должна давать новую проекцию, не повторяя существующую.'}
  ];

  // ==================== I. ОПОРНЫЙ КРЕСТ — 6 проверок ====================
  // Год № 11-16 + Сутки узлы 4 и 7
  const krestChecks=[
    {id:'k_horizon_clear',w:'КРИТ',
      q:'Линия Горизонта видна явно? Можно показать, какие 2 точки лежат на ней.',
      info:'**Ясна Года №16:** «Опорный Крест начинается с определения Горизонта явления.» В Сутках — точка выхода и точка захода солнца.'},
    {id:'k_3_9_horizon',w:'КРИТ',
      q:`Полки 3 («${lbl(3)}») и 9 («${lbl(9)}») лежат на Линии Горизонта — главные точки противоборства?`,
      info:'**Ясна Суток №48–49:** «Точку выхода солнца поместим слева, точку захода — справа.» (3 = Восток, 9 = Запад). **Ясна Года №35:** Весеннее (3) и Осеннее (9) Равноденствия.'},
    {id:'k_unity_clear',w:'КРИТ',
      q:'Линия Единения определена — между точками минимума и максимума параметра?',
      info:'**Ясна Года №12:** «Опорный Крест есть Крест линии Горизонта и линии Единения.» **Ясна Суток узел 4, №249:** Линия Единства — вертикаль 0↔6.'},
    {id:'k_0_6_unity',w:'КРИТ',
      q:`Полки 0 («${lbl(0)}») и 6 («${lbl(6)}») — крайности параметра, антиподы по Линии Единения?`,
      info:'**Ясна Суток №249:** Линия Единства разделяет нарастание и спад. **Ясна Года №35:** Зимнее Солнцестояние (0=Юг, минимум) и Летнее Солнцестояние (6=Север, максимум).'},
    {id:'k_supports_essential',w:'КРИТ',
      q:'Если убрать любую из 4 опор (0, 3, 6, 9) — явление разваливается?',
      info:'**Ясна Суток №433–460:** Опорный Крест = Крест Бытия. **Ясна Года №14:** «Опорный Крест есть Закон Единства и Борьбы Противоположностей.» **Ясна Года №15:** «Крест Противостояния и Противовода».'},
    {id:'k_isomorphy',w:'ВАЖ',
      q:'Опоры совпадают с образцами трёх Ясн? 0 = Полночь / Зима / Зачатие · 3 = Утро / Весна / Рождение · 6 = Полдень / Лето / Зрелость · 9 = Закат / Осень / Старость',
      info:'**Ясна Года узел 6 №278:** «Шестиугольник Года имеет 12 пронумерованных точек, устроенных так же, как у Сутoк.» **Ясна Жизни узел 12 №952:** все три книги показывают одинаковое устройство — Сутки, Год и Жизнь.'}
  ];

  // ==================== II. 12 ПОЛОК — 9 проверок ====================
  // Сутки № 88-97 — самая компактная и однозначная формулировка
  const polkiChecks=[
    {id:'p_count',w:'КРИТ',
      q:'Ровно 12 элементов в круге?',
      info:'**Ясна Суток №88:** «Вот таким получилось полное описание суток. Всего двенадцать пунктов.»'},
    {id:'p_distinct',w:'КРИТ',
      q:'Все 12 различны — каждый отличается от других?',
      info:'**Ясна Суток №90:** «Сутки есть двенадцать различных времён.»'},
    {id:'p_alternation',w:'КРИТ',
      q:'Чередование длинного и короткого без исключений?',
      info:'**Ясна Суток №91:** «Времена сутки чередуются по длительности.» **Ясна Суток №92:** «Сутки есть чередование шести долгих и шести коротких времён.»'},
    {id:'p_each_property',w:'КРИТ',
      q:'Каждая полка имеет своё уникальное свойство?',
      info:'**Ясна Суток №93:** «Каждое время имеет своё собственное свойство.»'},
    {id:'p_each_event',w:'ВАЖ',
      q:'В каждой полке происходит конкретное событие?',
      info:'**Ясна Суток №94:** «В каждом из времён происходит некое событие.»'},
    {id:'p_long_smooth',w:'КРИТ',
      q:'Все 6 долгих полок (0,2,4,6,8,10) — времена плавных, медленных изменений обстановки?',
      info:'**Ясна Суток №95:** «Все долгие времена сутки есть времена медленных изменений общей обстановки.» На чертеже — стороны шестиугольника.',
      hint:'Если на чётной полке мгновенное событие — она не долгая. Переформулируйте.'},
    {id:'p_short_transition',w:'КРИТ',
      q:'Все 6 коротких полок (1,3,5,7,9,11) — переходы от одного долгого к следующему?',
      info:'**Ясна Суток №96:** «Все короткие времена есть времена быстрых изменений… короткие переходные времена от одного долгого времени к следующему.» На чертеже — углы шестиугольника.',
      hint:'Если на нечётной полке длительный процесс — она не короткая. Переформулируйте.'},
    {id:'p_short_distinct',w:'ВАЖ',
      q:'Все 6 коротких отличаются друг от друга смыслом происходящих событий?',
      info:'**Ясна Суток №97:** «Все короткие времена сутки отличаются друг от друга смыслом происходящих в них событий.»'},
    {id:'p_closure',w:'КРИТ',
      q:'Полка 11 → Полка 0 = переход в новый цикл (замыкание есть)?',
      info:'**Ясна Суток №73:** «Тринадцатый пункт в этом списке — это есть пункт первый. Правда, надо понимать, что это пункт первый следующих суток.» **Ясна Года узел 8 №569:** Змей Питон, заглотивший хвост — Лента Мёбиуса.'}
  ];

  // ==================== III. КРЕСТЫ + ПРАНЫ — 8 проверок ====================
  // Сутки узлы 7 (Кресты) и 8 (Праны) + Год узел 9 (порядок Пран)
  const krestyAndPranChecks=[
    {id:'kp_right',w:'КРИТ',
      q:`Крест Управления (1,4,7,10): «${lbl(1)}», «${lbl(4)}», «${lbl(7)}», «${lbl(10)}» — все результаты/исходы предыдущих опор?`,
      info:'**Ясна Суток №446–447, 502:** Крест Управления / Любви — следствия. 0→1, 3→4, 6→7, 9→10. Каждый элемент = результат предыдущего опорного.'},
    {id:'kp_left',w:'КРИТ',
      q:`Крест Веры (2,5,8,11): «${lbl(2)}», «${lbl(5)}», «${lbl(8)}», «${lbl(11)}» — все подготовки к следующим опорам?`,
      info:'**Ясна Суток №452, 499:** Крест Веры / Левит — подготовка. 2→3, 5→6, 8→9, 11→0. Каждый элемент готовит следующий опорный.'},
    {id:'kp_triples',w:'ВАЖ',
      q:'Все 4 тройки В→Б→П (2-3-4, 5-6-7, 8-9-10, 11-0-1) читаются как мини-истории «подготовка→действие→результат»?',
      info:'**Ясна Суток узел 7:** Ритм Вера→Бой→Победа. Каждая тройка — мини-цикл цикла. Прочитайте вслух — должна звучать как связное предложение.'},
    {id:'kp_she',w:'ВАЖ',
      q:`Земля ШЕ (0,4,8): «${lbl(0)}», «${lbl(4)}», «${lbl(8)}» — все устойчивые/тяжёлые/основа?`,
      info:'**Ясна Суток №631–633:** Земля ШЕ — устойчивые состояния вещества. **Ясна Года №739:** «Чередование Пран: ШЕ – ХА – ЦИ – ФО – ШЕ».'},
    {id:'kp_fo',w:'ВАЖ',
      q:`Вода ФО (1,5,9): «${lbl(1)}», «${lbl(5)}», «${lbl(9)}» — все текучие/спадающие/переходные?`,
      info:'**Ясна Суток узел 8:** Вода ФО — текучие, спадающие, ищущие низ. На Зодиаке: ♒ Водолей, ♊ Близнецы, ♎ Весы.'},
    {id:'kp_tsi',w:'ВАЖ',
      q:`Воздух ЦИ (2,6,10): «${lbl(2)}», «${lbl(6)}», «${lbl(10)}» — все промежуточные/парящие?`,
      info:'**Ясна Суток узел 8:** Воздух ЦИ — промежуточные, неустойчивый покой. На Зодиаке: ♓ Рыбы, ♋ Рак, ♏ Скорпион.'},
    {id:'kp_ha',w:'ВАЖ',
      q:`Огонь ХА (3,7,11): «${lbl(3)}», «${lbl(7)}», «${lbl(11)}» — все резкие/взрывные/яркие?`,
      info:'**Ясна Суток узел 8:** Огонь ХА — яркие, взрывные моменты. На Зодиаке: ♈ Овен, ♌ Лев, ♐ Стрелец.'},
    {id:'kp_arcs',w:'ЖЕЛ',
      q:'Три Дуги (1-2-3-4-5, 5-6-7-8-9, 9-10-11-0-1) — каждая описывает плавный полный поворот через 5 элементов?',
      info:'**Ясна Суток №899:** «Три Дуги времён сyтoк подобны друг другу. Все они подобны по смыслу. Во всех чередованиях Прав. Но всё-таки они различны по смыслу.»'}
  ];

  // ==================== IV. КОРПУСНЫЕ УНИВЕРСАЛЫ + ЦЕЛОЕ — 8 проверок ====================
  const wholeChecks=[
    {id:'w_isomorphy',w:'ВАЖ',
      q:'Опоры этой Ясны устроены так же, как в Ясне Суток / Года / Жизни? 0 = начало (минимум), 3 = восход, 6 = вершина (максимум), 9 = закат',
      info:'**Ясна Года №5:** «внутреннее устройство всех вещей в природе одинаково». **Ясна Года узел 6 №278:** «Шестиугольник Года устроен так же, как у Сутoк».'},
    {id:'w_mobius',w:'ВАЖ',
      q:'Замыкание (Лента Мёбиуса): Полка 11 готовит Полку 0 = 12 как один цикл?',
      info:'**Ясна Года узел 8 №569–570:** «Змей Питон, заглотивший хвост — древняя Лента Мёбиуса». **Ясна Жизни узел 12 №952:** Полка 0 = Зачатие нового цикла.'},
    {id:'w_accumulation',w:'ВАЖ',
      q:'Закон Накопление→Переход: длинные полки копят, соседние короткие — точки перелива?',
      info:'**Ясна Суток узел 5:** Закон скоростей света/тьмы — переход количества в качество. Долгая фаза — резервуар, короткая — клапан.'},
    {id:'w_chertyozh_yasna',w:'ЖЕЛ',
      q:'Понимаю, что чертёж — лишь начало; Ясна шире чертежа (учение о смыслах, именах, законах)?',
      info:'**Ясна Суток №121:** «Чертёж суток есть только самое начало построения Ясны суток.» **Ясна Суток №122:** «Ясна есть древнее славянское учение об устройстве всего мира.»'},
    {id:'w_param_unique',w:'КРИТ',
      q:'Параметр действительно ОДИН и тот же на всех 12 полках, нигде не «соскакивает» на другую шкалу?',
      info:'**Ясна Года №3:** Ясна как закон устройства одного явления. Параметр должен называться одним словом (свет, тепло, возраст, температура и т.д.).',
      hint:'Если параметр «гуляет» от полки к полке — Ясна построена по двум разным шкалам сразу.'},
    {id:'w_no_dup',w:'ВАЖ',
      q:'Эта Ясна не повторяет существующую в той же области?',
      info:'Каждая Ясна — это новый взгляд на явление. Откройте «+ ещё» и сравните, нет ли уже такой же.'},
    {id:'w_coherent',w:'ВАЖ',
      q:'Прочитав 12 полок подряд — получаю цельный образ явления?',
      info:'Простая проверка на цельность. Если после 12 полок остаётся ощущение разрозненности — не все полки на своих местах.'},
    {id:'w_explain',w:'ЖЕЛ',
      q:'Могу за 3 минуты объяснить эту Ясну не-эксперту, и он поймёт суть?',
      info:'Если объяснил просто — значит понял. Расскажите про параметр, 4 опоры, 2 главные пары противоположностей. Если не получается — формулировки слишком абстрактные.'}
  ];

  // ========== Aggregations ==========
  const fastScore=scoreCount(expressChecks);
  const krestScore=scoreCount(krestChecks);
  const polkiScore=scoreCount(polkiChecks);
  const kprScore=scoreCount(krestyAndPranChecks);
  const wholeScore=scoreCount(wholeChecks);

  const allChecks=[...expressChecks,...krestChecks,...polkiChecks,...krestyAndPranChecks,...wholeChecks];
  const critChecks=allChecks.filter(c=>c.w==='КРИТ');
  const vazhChecks=allChecks.filter(c=>c.w==='ВАЖ');
  const zhelChecks=allChecks.filter(c=>c.w==='ЖЕЛ');
  const critS=scoreCount(critChecks);
  const vazhS=scoreCount(vazhChecks);
  const zhelS=scoreCount(zhelChecks);

  // Verdict
  const expressDone=expressChecks.every(c=>get(c.id)!==undefined);
  const expressPassed=expressChecks.every(c=>{const v=get(c.id);return v===true||v==='na';});
  const allCritDone=critChecks.every(c=>get(c.id)!==undefined);
  const allCritPassed=critChecks.every(c=>{const v=get(c.id);return v===true||v==='na';});

  let status='Не начато',statusColor='#86868b',statusDesc='Начните с Шага 0 (Быстрая проверка) — 7 проверок ядра по правилам автора.';
  if(expressDone&&expressPassed&&!allCritDone){
    status='Шаг 0 ✓ Быстрая проверка пройдена';statusColor='#0071e3';
    statusDesc='Быстрая проверка пройдена. Для глубокой — пройдите Шаги 1–4.';
  }
  if(critS.failed>0){
    status='Не пройдена';statusColor='#E8364F';
    statusDesc=`Провалено ${critS.failed} критических. Структура Ясны не соответствует канону.`;
  }else if(vazhS.failed>0&&allCritDone){
    status='С оговорками';statusColor='#E8A834';
    statusDesc=`Все КРИТ пройдены, но ${vazhS.failed} ВАЖ нарушений. Безупречной — нет.`;
  }
  if(allCritDone&&allCritPassed&&vazhS.failed===0&&vazhS.done>0){
    status='Проверена ✓';statusColor='#30A060';
    statusDesc='Все критические и важные пройдены. Безупречно.';
  }

  const totalDone=critS.done+vazhS.done+zhelS.done;
  const totalCount=critChecks.length+vazhChecks.length+zhelChecks.length;
  const totalFailed=critS.failed+vazhS.failed+zhelS.failed;

  // Export
  const exportReport=()=>{
    const lines=[`# Проверка Ясны «${y.name}»`,'',`Статус: **${status}**`,`Прогресс: ${totalDone}/${totalCount} (${totalCount>0?Math.round(totalDone/totalCount*100):0}%)`,'',`КРИТ: ${critS.pass}/${critChecks.length}` + (critS.failed?` (провал ${critS.failed})`:''),`ВАЖ: ${vazhS.pass}/${vazhChecks.length}` + (vazhS.failed?` (провал ${vazhS.failed})`:''),`ЖЕЛ: ${zhelS.pass}/${zhelChecks.length}`,''];
    [['Шаг 0. Быстрая проверка',expressChecks],['Шаг 1. Опорный Крест',krestChecks],['Шаг 2. 12 Полок',polkiChecks],['Шаг 3. Кресты + Праны',krestyAndPranChecks],['Шаг 4. Целое',wholeChecks]].forEach(([name,checks])=>{
      lines.push(`## ${name}`);checks.forEach(c=>{const v=get(c.id);const m=v===true?'✓':v===false?'✗':v==='na'?'—':'·';lines.push(`- ${m} [${c.w||'—'}] ${c.q}`);});lines.push('');
    });
    const text=lines.join('\n');
    if(navigator.clipboard){navigator.clipboard.writeText(text).then(()=>{setCopyFeedback('Скопировано');setTimeout(()=>setCopyFeedback(''),2000);}).catch(()=>{setCopyFeedback('Ошибка');setTimeout(()=>setCopyFeedback(''),2000);});}
    else{setCopyFeedback('Буфер недоступен');setTimeout(()=>setCopyFeedback(''),2000);}
  };

  // Jump to next failed/unanswered
  const jumpToNextIssue=()=>{
    const order=['fast','krest','polki','kpr','whole'];
    const groups={fast:expressChecks,krest:krestChecks,polki:polkiChecks,kpr:krestyAndPranChecks,whole:wholeChecks};
    for(const t of order){
      const issue=groups[t].find(c=>{const v=get(c.id);return v===false||v===undefined;});
      if(issue){
        if(tab!==t)setTab(t);
        setTimeout(()=>{
          const el=document.querySelector(`[data-check-id="${issue.id}"]`);
          if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.animation='pulse 1.2s ease-in-out 2';setTimeout(()=>{if(el)el.style.animation=''},2500);}
        },120);
        return;
      }
    }
  };

  const TabBtn=({id,label,s})=><button onClick={()=>setTab(id)} style={{padding:'7px 12px',borderRadius:8,fontSize:12,fontWeight:tab===id?600:500,color:tab===id?'#0071e3':'#6e6e73',background:tab===id?'rgba(0,122,255,.08)':'transparent',border:'none',display:'flex',alignItems:'center',gap:6,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>
    <span>{label}</span>
    {s&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:8,background:tab===id?'rgba(0,122,255,.15)':'#f0f0f2',color:tab===id?'#0071e3':'#86868b',fontWeight:600}}>{s.done}/{s.total}</span>}
  </button>;

  // INTRO SCREEN
  if(showIntro===true){
    return(
      <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'#fff',zIndex:70,display:'flex',flexDirection:'column'}}>
        <div style={{padding:'12px 20px',borderBottom:'1px solid #f0f0f2',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:10,color:'#86868b',textTransform:'uppercase',letterSpacing:0.8,fontWeight:600,marginBottom:2}}>Проверка</div>
            <h2 style={{fontSize:18,fontWeight:700,color:'#1d1d1f',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{y.name}</h2>
          </div>
          <button onClick={onClose} style={{width:36,height:36,borderRadius:10,border:'1px solid #e5e5ea',background:'#fff',fontSize:16,color:'#424245',cursor:'pointer',flexShrink:0}}>✕</button>
        </div>
        <div className='fullpage-content' style={{flex:1,overflowY:'auto',padding:'24px 20px',maxWidth:680,margin:'0 auto',width:'100%'}}>
          <div style={{fontSize:24,fontWeight:700,color:'#1d1d1f',marginBottom:10,lineHeight:1.25}}>Проверка Ясны</div>
          <div style={{fontSize:14,color:'#6e6e73',lineHeight:1.6,marginBottom:16}}>
            Каждый вопрос — с прямой цитатой из книг «Ясна Суток / Ясна Года / Ясна Жизни». <b>Шаг 0 — Быстрая проверка</b>: 7 главных пунктов, ~3 минуты. <b>Шаги 1–4</b> — глубокая проверка по способу построения из книг.
          </div>

          {hasEmpties&&<div style={{padding:'12px 14px',background:'#fff8e8',border:'1px solid #E8A83440',borderRadius:10,marginBottom:20,fontSize:13,color:'#424245',lineHeight:1.55}}>
            <div style={{fontWeight:700,color:'#c07800',marginBottom:4}}>⚠ Не заполнены: {emptyPos.join(', ')}</div>
            Сначала заполните все 12 позиций в Редакторе.
          </div>}

          <div style={{fontSize:13,fontWeight:700,color:'#1d1d1f',marginBottom:10,textTransform:'uppercase',letterSpacing:0.5}}>Пять шагов проверки</div>

          <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
            <div style={{padding:'14px 16px',background:'rgba(0,122,255,.04)',borderRadius:12,borderLeft:'3px solid #0071e3'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'#0071e3',letterSpacing:1}}>ШАГ 0</span>
                <div style={{fontSize:15,fontWeight:600,color:'#1d1d1f'}}>Быстрая проверка · 7 пунктов · ~3 минуты</div>
              </div>
              <div style={{fontSize:13,color:'#6e6e73',lineHeight:1.55}}>Самое важное одной обоймой: Горизонт → Опорный Крест → 12 полок → чередование → замыкание → параметр → уникальность.</div>
            </div>
            <div style={{padding:'14px 16px',background:'#f5f5f7',borderRadius:12,borderLeft:'3px solid #6e6e73'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'#424245',letterSpacing:1}}>ШАГ 1</span>
                <div style={{fontSize:15,fontWeight:600,color:'#1d1d1f'}}>Опорный Крест ({krestChecks.length})</div>
              </div>
              <div style={{fontSize:13,color:'#6e6e73',lineHeight:1.55}}>Способ построения из Ясны Года, узел 1, пп. 11–16: Линия Горизонта × Линия Единения = 4 опоры (0/3/6/9).</div>
            </div>
            <div style={{padding:'14px 16px',background:'#f5f5f7',borderRadius:12,borderLeft:'3px solid #6e6e73'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'#424245',letterSpacing:1}}>ШАГ 2</span>
                <div style={{fontSize:15,fontWeight:600,color:'#1d1d1f'}}>12 Полок ({polkiChecks.length})</div>
              </div>
              <div style={{fontSize:13,color:'#6e6e73',lineHeight:1.55}}>Главные свойства полок из Ясны Суток, узел 2, пп. 88–97: 12 различных, 6 долгих + 6 коротких, у каждой свойство и событие, цикл замыкается.</div>
            </div>
            <div style={{padding:'14px 16px',background:'#f5f5f7',borderRadius:12,borderLeft:'3px solid #6e6e73'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'#424245',letterSpacing:1}}>ШАГ 3</span>
                <div style={{fontSize:15,fontWeight:600,color:'#1d1d1f'}}>Кресты + Праны ({krestyAndPranChecks.length})</div>
              </div>
              <div style={{fontSize:13,color:'#6e6e73',lineHeight:1.55}}>Кресты Управления и Веры, тройки Вера→Бой→Победа, 4 стихии и Три Дуги. Источники: Ясна Суток узлы 7–8 + Ясна Года узел 9.</div>
            </div>
            <div style={{padding:'14px 16px',background:'#f5f5f7',borderRadius:12,borderLeft:'3px solid #6e6e73'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'#424245',letterSpacing:1}}>ШАГ 4</span>
                <div style={{fontSize:15,fontWeight:600,color:'#1d1d1f'}}>Целое ({wholeChecks.length})</div>
              </div>
              <div style={{fontSize:13,color:'#6e6e73',lineHeight:1.55}}>Законы, общие для всех Ясн: одинаковое устройство, замыкание Мёбиуса, накопление→переход, общий параметр, цельный образ.</div>
            </div>
          </div>

          <div style={{fontSize:13,fontWeight:700,color:'#1d1d1f',marginBottom:10,textTransform:'uppercase',letterSpacing:0.5}}>Веса проверок</div>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:24}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#fff5f5',borderRadius:8,border:'1px solid #E8364F20'}}>
              <span style={{fontSize:10,fontWeight:700,color:'#E8364F',padding:'2px 6px',border:'1px solid #E8364F40',borderRadius:4,flexShrink:0}}>КРИТ</span>
              <span style={{fontSize:13,color:'#424245'}}>Без неё Ясна не считается верной. Цитата из книги всегда указана.</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#fff8e8',borderRadius:8,border:'1px solid #E8A83420'}}>
              <span style={{fontSize:10,fontWeight:700,color:'#E8A834',padding:'2px 6px',border:'1px solid #E8A83440',borderRadius:4,flexShrink:0}}>ВАЖ</span>
              <span style={{fontSize:13,color:'#424245'}}>Влияет на итог: «безупречно / с оговорками».</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#f5f5f7',borderRadius:8,border:'1px solid #d2d2d7'}}>
              <span style={{fontSize:10,fontWeight:700,color:'#86868b',padding:'2px 6px',border:'1px solid #86868b40',borderRadius:4,flexShrink:0}}>ЖЕЛ</span>
              <span style={{fontSize:13,color:'#424245'}}>Желательно, но не обязательно для итога.</span>
            </div>
          </div>

          <div style={{fontSize:13,fontWeight:700,color:'#1d1d1f',marginBottom:6,textTransform:'uppercase',letterSpacing:0.5}}>Подсказки</div>
          <ul style={{fontSize:13,color:'#424245',lineHeight:1.65,marginLeft:18,marginBottom:18}}>
            <li>Каждая проверка имеет кнопку <b>i</b> — раскрывает цитату из конкретного пункта книги.</li>
            <li>Кнопка «—» ставит «не применимо» (например, для абстрактных Ясн без явного Горизонта).</li>
            <li>Можно прятать пройденные через «Скрыть ✓» — фокус только на проблемах.</li>
            <li>Внизу — кнопка «📋 Отчёт» копирует протокол в буфер.</li>
          </ul>
        </div>
        <div style={{padding:'14px 20px',borderTop:'1px solid #f0f0f2',background:'#fff',flexShrink:0,boxShadow:'0 -4px 16px rgba(0,0,0,.04)'}}>
          <div style={{maxWidth:680,margin:'0 auto',display:'flex',gap:10,justifyContent:'flex-end',flexWrap:'wrap'}}>
            <button onClick={onClose} style={{fontSize:14,padding:'10px 18px',borderRadius:10,border:'1px solid #e5e5ea',background:'#fff',color:'#424245',cursor:'pointer'}}>Отмена</button>
            <button onClick={()=>setShowIntro(false)} style={{fontSize:14,fontWeight:600,padding:'10px 20px',borderRadius:10,border:'1px solid #0071e3',background:'#0071e3',color:'#fff',cursor:'pointer',flex:'1 1 auto',minWidth:200}}>Начать с Шага 0 (Быстро) →</button>
          </div>
        </div>
      </div>);
  }

  return(
    <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'#fff',zIndex:70,display:'flex',flexDirection:'column'}}>
      {/* HEADER */}
      <div className="verif-header" style={{display:'flex',alignItems:'center',padding:'12px 20px',borderBottom:'1px solid #f0f0f2',flexShrink:0,gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:10,color:'#86868b',textTransform:'uppercase',letterSpacing:0.8,fontWeight:600,marginBottom:2}}>Проверка</div>
          <h2 className="verif-title" style={{fontSize:18,fontWeight:700,color:'#1d1d1f',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{y.name}</h2>
        </div>
        <button onClick={()=>setShowIntro(true)} className="verif-help" title="Показать инструкцию" style={{width:36,height:36,borderRadius:10,border:'1px solid #e5e5ea',background:'#fff',fontSize:15,color:'#424245',cursor:'pointer',flexShrink:0,fontFamily:'Georgia,serif',fontStyle:'italic',fontWeight:700}}>?</button>
        <button onClick={onClose} className="verif-close" style={{width:36,height:36,borderRadius:10,border:'1px solid #e5e5ea',background:'#fff',fontSize:16,color:'#424245',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
      </div>

      {/* STATUS + PROGRESS */}
      <div className="verif-sub" style={{padding:'8px 20px',borderBottom:'1px solid #f0f0f2',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap'}}>
          <span style={{fontSize:13,color:statusColor,fontWeight:600}}>{status}</span>
          <span style={{fontSize:11,color:'#86868b'}}>
            <span style={{color:'#E8364F'}}>КРИТ {critS.pass}/{critChecks.length}</span>
            {' · '}<span style={{color:'#c07800'}}>ВАЖ {vazhS.pass}/{vazhChecks.length}</span>
            {' · '}<span>ЖЕЛ {zhelS.pass}/{zhelChecks.length}</span>
          </span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{flex:1,height:6,background:'#f0f0f2',borderRadius:3,overflow:'hidden',position:'relative'}}>
            <div style={{position:'absolute',top:0,left:0,height:'100%',width:(totalCount>0?((totalDone-totalFailed)/totalCount*100):0)+'%',background:'#30A060',transition:'width .3s'}}/>
            <div style={{position:'absolute',top:0,left:(totalCount>0?((totalDone-totalFailed)/totalCount*100):0)+'%',height:'100%',width:(totalCount>0?(totalFailed/totalCount*100):0)+'%',background:'#E8364F',transition:'width .3s'}}/>
          </div>
          <span style={{fontSize:11,color:'#86868b',fontWeight:600,minWidth:52,textAlign:'right'}}>{totalDone}/{totalCount}</span>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="verif-actions-row" style={{padding:'6px 20px 8px',borderBottom:'1px solid #f0f0f2',flexShrink:0,display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
        {(totalFailed>0||totalDone<totalCount)&&<button onClick={jumpToNextIssue} style={{fontSize:11,color:'#0071e3',padding:'5px 10px',border:'1px solid #0071e320',borderRadius:7,background:'rgba(0,122,255,.06)',cursor:'pointer',fontWeight:500,display:'flex',alignItems:'center',gap:4}}>
          <span>→</span><span>К следующему</span>
        </button>}
        <button onClick={()=>setHidePassed(v=>!v)} style={{fontSize:11,color:hidePassed?'#0071e3':'#6e6e73',padding:'5px 10px',border:`1px solid ${hidePassed?'#0071e3':'#e5e5ea'}`,borderRadius:7,background:hidePassed?'rgba(0,122,255,.06)':'#fff',cursor:'pointer',fontWeight:500}}>{hidePassed?'Показать все':'Скрыть ✓'}</button>
        {totalDone>0&&<button onClick={exportReport} style={{fontSize:11,color:'#424245',padding:'5px 10px',border:'1px solid #e5e5ea',borderRadius:7,background:'#fff',cursor:'pointer',fontWeight:500}}>{copyFeedback||'📋 Отчёт'}</button>}
        <div style={{flex:1}}/>
        <button onClick={()=>{if(confirm('Сбросить все ответы для этой Ясны?')){const keys=Object.keys(vs).filter(k=>k.startsWith(y.name+'_'));const nv={...vs};keys.forEach(k=>delete nv[k]);setVs(nv);setShowIntro(true);}}} style={{fontSize:11,color:'#E8364F',padding:'5px 10px',border:'1px solid #E8364F30',borderRadius:7,background:'#fff',cursor:'pointer'}}>Сбросить</button>
      </div>

      {/* TABS */}
      <div style={{display:'flex',gap:4,padding:'8px 20px',borderBottom:'1px solid #f0f0f2',flexShrink:0,overflowX:'auto'}}>
        <TabBtn id="fast" label="⚡ Шаг 0 · Быстро" s={fastScore}/>
        <TabBtn id="krest" label="Шаг 1 · Опорный Крест" s={krestScore}/>
        <TabBtn id="polki" label="Шаг 2 · 12 Полок" s={polkiScore}/>
        <TabBtn id="kpr" label="Шаг 3 · Кресты + Праны" s={kprScore}/>
        <TabBtn id="whole" label="Шаг 4 · Целое" s={wholeScore}/>
      </div>

      <div className='fullpage-content' style={{flex:1,overflowY:'auto',padding:'16px 20px',maxWidth:820,margin:'0 auto',width:'100%'}}>
        {hasEmpties&&<div style={{padding:'10px 14px',background:'#fff8e8',border:'1px solid #E8A83440',borderRadius:10,marginBottom:14,fontSize:12,color:'#424245',lineHeight:1.55}}>
          <div style={{fontWeight:700,color:'#c07800',marginBottom:4}}>⚠ Не заполнены позиции: {emptyPos.join(', ')}</div>
          Проверка достоверна только на полной Ясне. Сначала заполните все 12 позиций в Редакторе.
        </div>}

        <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#f5f5f7',borderRadius:10,marginBottom:14,fontSize:11,color:'#6e6e73',flexWrap:'wrap'}}>
          <span style={{fontWeight:600,color:'#424245'}}>Как отвечать:</span>
          <span style={{display:'inline-flex',alignItems:'center',gap:4}}><span style={{width:16,height:16,borderRadius:4,border:'1.5px solid #30A060',background:'#30A06012',color:'#30A060',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>✓</span>верно</span>
          <span style={{display:'inline-flex',alignItems:'center',gap:4}}><span style={{width:16,height:16,borderRadius:4,border:'1.5px solid #E8364F',background:'#E8364F12',color:'#E8364F',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>✗</span>неверно</span>
          <span style={{display:'inline-flex',alignItems:'center',gap:4}}><span style={{width:16,height:16,borderRadius:4,border:'1.5px solid #86868b',background:'#86868b12',color:'#86868b',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>—</span>n/a</span>
          <span style={{color:'#aeaeb2'}}>· нажмите <span style={{display:'inline-flex',width:14,height:14,borderRadius:'50%',border:'1px solid #c7c7cc',color:'#86868b',fontSize:9,alignItems:'center',justifyContent:'center',fontFamily:'Georgia,serif',fontStyle:'italic',fontWeight:700}}>i</span> чтобы увидеть цитату из книги</span>
        </div>

        {tab==='fast'&&<>
          <div style={{fontSize:12,color:'#1d4ed8',marginBottom:12,lineHeight:1.55,padding:'10px 12px',background:'rgba(0,122,255,.06)',borderRadius:8,borderLeft:'3px solid #0071e3'}}>
            <b>⚡ Шаг 0. Быстрая проверка</b> — 7 пунктов ядра. Прямой проход по канону: алгоритм Дианоме (Ясна Года №11–16) + свойства 12 полок (Ясна Суток №88–97) + замыкание (Ясна Суток №73). ~3 минуты.
          </div>
          <div style={{border:'1px solid #e5e5ea',borderRadius:10,padding:'4px 14px'}}>
            {expressChecks.map(c=><Check key={c.id} id={c.id} weight={c.w} q={c.q} info={c.info} hint={c.hint}/>)}
          </div>
          {expressDone&&expressPassed&&<div style={{marginTop:14,padding:'14px 16px',background:'rgba(0,113,227,.06)',border:'1px solid rgba(0,113,227,.3)',borderRadius:12,fontSize:13,color:'#1d4ed8',lineHeight:1.55}}>
            <b>Быстрая проверка пройдена ✓</b> — базовая структура соответствует канону. Для глубокой проверки → Шаг 1 (Опорный Крест) и далее.
          </div>}
        </>}

        {tab==='krest'&&<>
          <div style={{fontSize:12,color:'#6e6e73',marginBottom:12,lineHeight:1.55,padding:'9px 12px',background:'#f0f5ff',borderRadius:8}}>
            <b style={{color:'#0071e3'}}>Шаг 1. Опорный Крест</b> — авторский алгоритм построения Ясны (Ясна Года №11–16). Линия Горизонта × Линия Единения = 4 опоры (0/3/6/9).
          </div>
          <div style={{border:'1px solid #e5e5ea',borderRadius:10,padding:'4px 14px'}}>
            {krestChecks.map(c=><Check key={c.id} id={c.id} weight={c.w} q={c.q} info={c.info} hint={c.hint}/>)}
          </div>
        </>}

        {tab==='polki'&&<>
          <div style={{fontSize:12,color:'#6e6e73',marginBottom:12,lineHeight:1.55,padding:'9px 12px',background:'#f0f5ff',borderRadius:8}}>
            <b style={{color:'#0071e3'}}>Шаг 2. 12 Полок</b> — ключевые определения автора из Ясны Суток, узел 2, пункты 88–97. Самая короткая формулировка во всех трёх книгах.
          </div>
          <div style={{border:'1px solid #e5e5ea',borderRadius:10,padding:'4px 14px'}}>
            {polkiChecks.map(c=><Check key={c.id} id={c.id} weight={c.w} q={c.q} info={c.info} hint={c.hint}/>)}
          </div>
        </>}

        {tab==='kpr'&&<>
          <div style={{fontSize:12,color:'#6e6e73',marginBottom:12,lineHeight:1.55,padding:'9px 12px',background:'#f0f5ff',borderRadius:8}}>
            <b style={{color:'#0071e3'}}>Шаг 3. Кресты + Праны</b> — Кресты Управления и Веры, тройки Вера→Бой→Победа, 4 стихии (Земля/Вода/Воздух/Огонь). Ясна Суток узлы 7–8 + Ясна Года узел 9.
          </div>
          <div style={{border:'1px solid #e5e5ea',borderRadius:10,padding:'4px 14px'}}>
            {krestyAndPranChecks.map(c=><Check key={c.id} id={c.id} weight={c.w} q={c.q} info={c.info} hint={c.hint}/>)}
          </div>
        </>}

        {tab==='whole'&&<>
          <div style={{fontSize:12,color:'#6e6e73',marginBottom:12,lineHeight:1.55,padding:'9px 12px',background:'#f0f5ff',borderRadius:8}}>
            <b style={{color:'#0071e3'}}>Шаг 4. Целое</b> — общие для всех Ясн законы (одинаковое устройство, Лента Мёбиуса, Накопление→Переход) + проверка на цельность.
          </div>
          <div style={{border:'1px solid #e5e5ea',borderRadius:10,padding:'4px 14px',marginBottom:14}}>
            {wholeChecks.map(c=><Check key={c.id} id={c.id} weight={c.w} q={c.q} info={c.info} hint={c.hint}/>)}
          </div>

          <div style={{padding:'16px 20px',background:`linear-gradient(135deg,${statusColor}08,${statusColor}14)`,border:`1px solid ${statusColor}40`,borderRadius:14,marginTop:20}}>
            <div style={{fontSize:11,fontWeight:700,color:statusColor,letterSpacing:0.5,textTransform:'uppercase',marginBottom:6}}>Итоговый вердикт</div>
            <div style={{fontSize:18,fontWeight:700,color:'#1d1d1f',marginBottom:8}}>{status}</div>
            <div style={{fontSize:13,color:'#424245',lineHeight:1.6,marginBottom:10}}>{statusDesc}</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',fontSize:11,color:'#6e6e73'}}>
              <span><b style={{color:'#E8364F'}}>КРИТ:</b> {critS.pass}/{critChecks.length}{critS.failed>0?`, ${critS.failed} провалено`:''}</span>
              <span><b style={{color:'#E8A834'}}>ВАЖ:</b> {vazhS.pass}/{vazhChecks.length}</span>
              <span><b style={{color:'#86868b'}}>ЖЕЛ:</b> {zhelS.pass}/{zhelChecks.length}</span>
            </div>
          </div>
        </>}
      </div>
    </div>);
}




// ═══════════════════════════════════════════════════════════════════
// Yasna3DView — настоящий 3D через Three.js (prod)
// Премиум-сфера: 12 полок-планет на экваторе, N/S полюса,
// механики как платоновы тела (октаэдр, бипирамида, тетраэдр)
// ═══════════════════════════════════════════════════════════════════

function Yasna3DView({ y, af, sel, onSel, rotationOn, speedSec, drill, onDrill, subPolki }){
  const canvasRef = React.useRef(null);
  // На мобиле стартовый camDist больше — чтобы весь шар помещался в узкую portrait-область
  const initCamDist = (typeof window!=='undefined' && window.innerWidth <= 768) ? 820 : 560;
  const stateRef = React.useRef({
    camAzim: 0, camElev: 24, camDist: initCamDist,
    isDragging: false, lastX: 0, lastY: 0,
  });
  const sceneRefs = React.useRef(null);
  // Свежие props для animate-loop (избегаем stale closure)
  const liveRef = React.useRef({ rotationOn, speedSec, sel, drill, af });
  React.useEffect(()=>{ liveRef.current = { rotationOn, speedSec, sel, drill, af }; }, [rotationOn, speedSec, sel, drill, JSON.stringify(af||[])]);

  React.useEffect(()=>{
    if(typeof window==='undefined' || !window.THREE) return;
    const THREE = window.THREE;
    const canvas = canvasRef.current;
    if(!canvas) return;

    // Адаптация под устройство — экономим ресурсы на мобильных и слабых машинах
    const isMobile = window.innerWidth <= 768;
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const lowPerf = isMobile || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    const Q = lowPerf ? {
      pxRatio: 2,
      polkaSegW: 56, polkaSegH: 40,
      auraSegW: 20, auraSegH: 14,
      poleSegW: 32, poleSegH: 24,
      cageSegW: 28, cageSegH: 18,
      torusTubeSegs: 80, torusTube: 12,
      stars: 700,
    } : {
      pxRatio: 3,
      polkaSegW: 96, polkaSegH: 64,
      auraSegW: 32, auraSegH: 24,
      poleSegW: 48, poleSegH: 36,
      cageSegW: 40, cageSegH: 28,
      torusTubeSegs: 144, torusTube: 16,
      stars: 1500,
    };

    const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, Q.pxRatio));
    if(THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    // Кинематографический tone mapping
    if(THREE.ACESFilmicToneMapping !== undefined){
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.92;
    }

    const scene = new THREE.Scene();
    // Тёмно-сине-фиолетовый космический фон с лёгким градиентом
    scene.background = new THREE.Color(0x040614);
    scene.fog = new THREE.Fog(0x040614, 600, 2000);
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 5000);

    // ──────────────── Звёздное поле (1500 звёзд на дальней сфере) ────────────────
    {
      const starsGeom = new THREE.BufferGeometry();
      const positions = [];
      const colors = [];
      for(let i = 0; i < Q.stars; i++){
        const r = 1400 + Math.random() * 800;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        positions.push(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        );
        // Лёгкий разброс по цвету: голубоватые/белые/тёплые звёзды
        const t = Math.random();
        if(t < 0.1){ colors.push(0.9, 0.85, 1.0); }      // голубые
        else if(t < 0.25){ colors.push(1.0, 0.95, 0.85); } // тёплые
        else { colors.push(1.0, 1.0, 1.0); }              // белые
      }
      starsGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      starsGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const starsMat = new THREE.PointsMaterial({
        size: 2.8, sizeAttenuation: true, transparent: true, opacity: 0.92,
        vertexColors: true,
      });
      scene.add(new THREE.Points(starsGeom, starsMat));
    }
    // Туманность — лёгкое свечение на дальнем плане
    {
      const nebulaGeom = new THREE.SphereGeometry(1800, 32, 24);
      const nebulaMat = new THREE.MeshBasicMaterial({
        color: 0x2a1a4a, transparent: true, opacity: 0.18, side: THREE.BackSide,
      });
      scene.add(new THREE.Mesh(nebulaGeom, nebulaMat));
    }

    // ──────────────── Освещение (премиум-качество) ────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.32));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
    keyLight.position.set(3, 5, 4); scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x6088ee, 0.38);
    fillLight.position.set(-4, 2, -2); scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xffba88, 0.55);
    rimLight.position.set(0, -3, -5); scene.add(rimLight);
    scene.add(new THREE.HemisphereLight(0xc0d0ff, 0x202032, 0.18));
    // Простой env-map для качественных металлических отражений (без зависимостей)
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const skyScene = new THREE.Scene();
      skyScene.background = new THREE.Color(0x141828);
      const envMap = pmremGenerator.fromScene(skyScene, 0.02).texture;
      scene.environment = envMap;
      pmremGenerator.dispose();
    } catch(e) { /* env-map опционален */ }

    // ──────────────── Геометрия конструкции ────────────────
    const R = 200;
    const polkaR = 11;
    const POLE_Y = R * 0.65;
    const wheelGroup = new THREE.Group();
    scene.add(wheelGroup);

    const equatorPos = (i) => {
      const a = (270 - i*30) * Math.PI/180;
      return new THREE.Vector3(R*Math.cos(a), 0, -R*Math.sin(a));
    };
    const NORTH = new THREE.Vector3(0, POLE_Y, 0);
    const SOUTH = new THREE.Vector3(0, -POLE_Y, 0);

    const makeTube = (a, b, radius, material) => {
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      if(len < 0.1) return null;
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      const geom = new THREE.CylinderGeometry(radius, radius, len, 10, 1, false);
      const mesh = new THREE.Mesh(geom, material);
      mesh.position.copy(mid);
      const axis = new THREE.Vector3(0,1,0);
      const norm = dir.clone().normalize();
      const cross = new THREE.Vector3().crossVectors(axis, norm);
      const dot = axis.dot(norm);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if(cross.lengthSq() > 0.0001) mesh.setRotationFromAxisAngle(cross.normalize(), angle);
      return mesh;
    };

    // ──────────────── Каркасная сфера-обёртка ────────────────
    const cageGeom = new THREE.SphereGeometry(R+polkaR*1.5, Q.cageSegW, Q.cageSegH);
    const cageMat = new THREE.MeshBasicMaterial({ color:0x6068a0, wireframe:true, transparent:true, opacity:0.07 });
    const cageMesh = new THREE.Mesh(cageGeom, cageMat);
    wheelGroup.add(cageMesh);

    const equatorTube = new THREE.Mesh(
      new THREE.TorusGeometry(R, 0.7, Q.torusTube, Q.torusTubeSegs),
      new THREE.MeshStandardMaterial({ color:0xb8a8d8, opacity:0.75, transparent:true, metalness:0.7, roughness:0.25, emissive:0x4030a0, emissiveIntensity:0.10 })
    );
    equatorTube.rotation.x = Math.PI/2;
    wheelGroup.add(equatorTube);
    // Сохраняем ссылку для adaptive opacity (при многих активных механиках — приглушаем)


    for(let i=0; i<12; i+=3){
      const p = equatorPos(i);
      const meridianMat = new THREE.MeshBasicMaterial({ color:0xb8a8d8, transparent:true, opacity:0.20 });
      const t1 = makeTube(NORTH, p, 0.35, meridianMat); if(t1) wheelGroup.add(t1);
      const t2 = makeTube(p, SOUTH, 0.35, meridianMat); if(t2) wheelGroup.add(t2);
    }

    const pillar = makeTube(
      new THREE.Vector3(0, POLE_Y*1.05, 0),
      new THREE.Vector3(0, -POLE_Y*1.05, 0),
      0.9,
      new THREE.MeshStandardMaterial({ color:0x8a4dad, opacity:0.55, transparent:true, metalness:0.6, roughness:0.2, emissive:0x6c3a8e, emissiveIntensity:0.16 })
    );
    if(pillar) wheelGroup.add(pillar);

    const poleMat = new THREE.MeshStandardMaterial({
      color:0x8a4dad, roughness:0.18, metalness:0.7,
      emissive:0x8a4dad, emissiveIntensity:0.18,
    });
    const poleGeom = new THREE.SphereGeometry(polkaR*0.7, Q.poleSegW, Q.poleSegH);
    const northBall = new THREE.Mesh(poleGeom, poleMat);
    northBall.position.copy(NORTH); wheelGroup.add(northBall);
    const southBall = new THREE.Mesh(poleGeom, poleMat);
    southBall.position.copy(SOUTH); wheelGroup.add(southBall);

    const npLabel = makeTextSprite('Зенит', '#d8b8ff', 56, '600');
    npLabel.position.set(0, POLE_Y + polkaR*1.8, 0);
    npLabel.scale.set(80, 20, 1); wheelGroup.add(npLabel);
    const spLabel = makeTextSprite('Надир', '#d8b8ff', 56, '600');
    spLabel.position.set(0, -POLE_Y - polkaR*1.8, 0);
    spLabel.scale.set(80, 20, 1); wheelGroup.add(spLabel);

    // ──────────────── 12 шаров-полок ────────────────
    // Премиум-палитра планетных цветов:
    //   Опорный  — глубокий карминовый (как Марс)
    //   Управления — янтарь / золото (как Сатурн)
    //   Веры     — глубокий кобальт (как Нептун)
    const polkaColor = (i) => {
      if([0,3,6,9].includes(i)) return 0xb83547;       // Crimson Mars
      if([1,4,7,10].includes(i)) return 0xd4a23c;      // Saturn Amber
      return 0x4a7ec0;                                  // Neptune Cobalt
    };

    const polki = [];
    for(let i=0; i<12; i++){
      const pos = equatorPos(i);
      const baseColor = polkaColor(i);
      const planetMat = new THREE.MeshStandardMaterial({
        color: baseColor, roughness: 0.32, metalness: 0.55,
        emissive: baseColor, emissiveIntensity: 0.15,
      });
      const planet = new THREE.Mesh(new THREE.SphereGeometry(polkaR, Q.polkaSegW, Q.polkaSegH), planetMat);
      planet.position.copy(pos);
      planet.userData.polkaIdx = i;
      wheelGroup.add(planet);

      const auraMat = new THREE.MeshBasicMaterial({
        color: baseColor, transparent:true, opacity:0.16, side:THREE.BackSide
      });
      const aura = new THREE.Mesh(new THREE.SphereGeometry(polkaR*1.22, Q.auraSegW, Q.auraSegH), auraMat);
      planet.add(aura);

      // Цифра полки — высококонтрастная, читается с любого ракурса
      const num = makeDigitSprite(i, { size: 256, color: '#ffffff', stroke: 'rgba(15,8,30,0.95)', depthTest: false });
      num.position.set(0, 0, polkaR*0.05);  // прямо в центре, sprite всегда повёрнут к камере
      num.scale.set(polkaR*1.7, polkaR*1.7, 1);
      planet.add(num);

      const label = (y && y.p && y.p[i]) || '';
      if(label){
        // Полное название — без обрезки. Шрифт крупный + обводка + halo для контраста
        const lbl = makeLabelSprite(label, {
          fontSize: isMobile ? 72 : 64,
          weight: '700',
          color: '#ffffff',
          depthTest: false,  // всегда поверх — не скрывается за каркасом или полкой
        });
        const direction = pos.clone().normalize();
        const offsetMul = isMobile ? 4.4 : 3.8;
        const lblPos = pos.clone().add(direction.multiplyScalar(polkaR*offsetMul));
        lbl.position.copy(lblPos);
        lbl.position.y = isMobile ? 26 : 20;
        // World-height пропорциональна полке, ширина — по aspect-ratio canvas
        const lblH = isMobile ? 18 : 16;
        const lblW = lblH * lbl.userData.aspect;
        lbl.scale.set(lblW, lblH, 1);
        wheelGroup.add(lbl);
      }
      polki.push(planet);
    }

    // ──────────────── Mechanics — 3D-полиэдры ────────────────
    const mechGroup = new THREE.Group();
    wheelGroup.add(mechGroup);

    const tubeMat = (color, opacity) => new THREE.MeshStandardMaterial({
      color, transparent:true, opacity, metalness:0.7, roughness:0.15,
      emissive:color, emissiveIntensity:0.45,
      depthWrite: false,  // избегаем z-fighting между прозрачными трубками
    });

    function makeBipyramid(indices, color, opacity){
      const grp = new THREE.Group();
      const pts = indices.map(i => equatorPos(i));
      const mat = tubeMat(color, opacity);
      for(let k=0; k<pts.length; k++){
        const next = pts[(k+1) % pts.length];
        const t = makeTube(pts[k], next, 1.1, mat); if(t) grp.add(t);
        const tN = makeTube(pts[k], NORTH, 0.9, mat); if(tN) grp.add(tN);
        const tS = makeTube(pts[k], SOUTH, 0.9, mat); if(tS) grp.add(tS);
      }
      const apexGeom = new THREE.SphereGeometry(2.2, 16, 12);
      const apexMat = tubeMat(color, Math.min(opacity*1.5, 1));
      const apexN = new THREE.Mesh(apexGeom, apexMat); apexN.position.copy(NORTH); grp.add(apexN);
      const apexS = new THREE.Mesh(apexGeom.clone(), apexMat); apexS.position.copy(SOUTH); grp.add(apexS);
      return grp;
    }

    function makeTetrahedron(p1, p2, p3, p4, color, opacity){
      const grp = new THREE.Group();
      const mat = tubeMat(color, opacity);
      const edges = [[p1,p2],[p2,p3],[p3,p1],[p1,p4],[p2,p4],[p3,p4]];
      edges.forEach(([a,b])=>{ const t=makeTube(a,b,0.55,mat); if(t)grp.add(t); });
      return grp;
    }

    // ──────────────── Sub-Yasna (drill-down 3D) ────────────────
    // Группа вложенной мини-Ясны, появляется при drill !== null у позиции выбранной полки.
    const drillGroup = new THREE.Group();
    drillGroup.visible = false;
    drillGroup.scale.set(0.001, 0.001, 0.001);
    wheelGroup.add(drillGroup);

    const subPolkiArr = []; // sub-шары для raycasting
    const subPolkiLabels = [];

    // Палитра sub-полок — мягче основных, чтобы был контраст
    const subPolkaColor = (i) => {
      if([0,3,6,9].includes(i)) return 0xff6478;
      if([1,4,7,10].includes(i)) return 0xfac266;
      return 0x80aae0;
    };

    function buildDrillGroup(drillIdx, subData){
      // Очищаем старое — disposeм рекурсивно (защита от утечки текстур цифр)
      while(drillGroup.children.length){
        const c = drillGroup.children[0];
        c.traverse(node=>{
          if(node.geometry) node.geometry.dispose();
          if(node.material){
            const disp = (m)=>{
              if(m.map && typeof m.map.dispose === 'function') m.map.dispose();
              m.dispose();
            };
            if(Array.isArray(node.material)) node.material.forEach(disp); else disp(node.material);
          }
        });
        drillGroup.remove(c);
      }
      subPolkiArr.length = 0;
      subPolkiLabels.length = 0;
      if(drillIdx == null) return;

      // Размер мини-Ясны: компактный, не пересекается с основным экватором
      const subR = polkaR * 2.8;
      const subPolkaR = polkaR * 0.40;

      // Каркасная сфера (тонкая, для глубины)
      const subCage = new THREE.Mesh(
        new THREE.SphereGeometry(subR + subPolkaR*1.2, 18, 12),
        new THREE.MeshBasicMaterial({ color:0xa388e0, wireframe:true, transparent:true, opacity:0.18 })
      );
      drillGroup.add(subCage);

      // Экватор
      const subEquator = new THREE.Mesh(
        new THREE.TorusGeometry(subR, 0.4, 10, 64),
        new THREE.MeshStandardMaterial({ color:0xa388e0, opacity:0.7, transparent:true, metalness:0.6, roughness:0.3, emissive:0x6c4dad, emissiveIntensity:0.3 })
      );
      subEquator.rotation.x = Math.PI/2;
      drillGroup.add(subEquator);

      // Маленький столп вверх-вниз
      const subPoleY = subR * 0.65;
      const pillarMat = new THREE.MeshStandardMaterial({ color:0xb88de0, opacity:0.5, transparent:true, metalness:0.55, roughness:0.25, emissive:0x6c3a8e, emissiveIntensity:0.3 });
      const pillarGeom = new THREE.CylinderGeometry(0.4, 0.4, subPoleY*2.2, 8, 1, false);
      const subPillar = new THREE.Mesh(pillarGeom, pillarMat);
      drillGroup.add(subPillar);

      // 12 sub-полок-шариков на экваторе
      for(let i=0; i<12; i++){
        const a = (270 - i*30) * Math.PI/180;
        const px = subR*Math.cos(a), pz = -subR*Math.sin(a);
        const baseColor = subPolkaColor(i);
        const subMat = new THREE.MeshStandardMaterial({
          color: baseColor, roughness: 0.4, metalness: 0.45,
          emissive: baseColor, emissiveIntensity: 0.45,
        });
        const subBall = new THREE.Mesh(new THREE.SphereGeometry(subPolkaR, 32, 24), subMat);
        subBall.position.set(px, 0, pz);
        subBall.userData.subIdx = i;
        drillGroup.add(subBall);
        subPolkiArr.push(subBall);

        // Аура
        const subAura = new THREE.Mesh(
          new THREE.SphereGeometry(subPolkaR*1.4, 16, 12),
          new THREE.MeshBasicMaterial({ color: baseColor, transparent:true, opacity:0.32, side:THREE.BackSide })
        );
        subBall.add(subAura);

        // Номер
        const num = makeDigitSprite(i, { size: 192, color: '#ffffff', stroke: 'rgba(15,8,30,0.95)', depthTest: false });
        num.position.set(0, 0, subPolkaR*0.05);
        num.scale.set(subPolkaR*1.7, subPolkaR*1.7, 1);
        subBall.add(num);

        // Подпись sub-полки (если есть) — полный текст, обводка, всегда поверх
        const subLabel = subData && subData[i] ? subData[i] : '';
        if(subLabel){
          const lbl = makeLabelSprite(subLabel, { fontSize: 52, weight: '700', color: '#ffffff', depthTest: false });
          const dir = new THREE.Vector3(px, 0, pz).normalize();
          const lblPos = new THREE.Vector3(px, 0, pz).add(dir.multiplyScalar(subPolkaR*3.4));
          lblPos.y = 5;
          lbl.position.copy(lblPos);
          const subH = subPolkaR*1.4;
          lbl.scale.set(subH * lbl.userData.aspect, subH, 1);
          drillGroup.add(lbl);
          subPolkiLabels.push(lbl);
        }
      }

      // Полюса
      const subPoleMat = new THREE.MeshStandardMaterial({ color:0xb88de0, roughness:0.22, metalness:0.6, emissive:0xb88de0, emissiveIntensity:0.4 });
      const subPoleGeom = new THREE.SphereGeometry(subPolkaR*0.6, 24, 18);
      const subN = new THREE.Mesh(subPoleGeom, subPoleMat); subN.position.set(0, subPoleY, 0); drillGroup.add(subN);
      const subS = new THREE.Mesh(subPoleGeom.clone(), subPoleMat); subS.position.set(0, -subPoleY, 0); drillGroup.add(subS);

      // Заголовок полки сверху
      const titleText = (y && y.p && y.p[drillIdx]) ? `Полка ${drillIdx}: ${y.p[drillIdx].slice(0,18)}` : `Полка ${drillIdx}`;
      const title = makeTextSprite(titleText, '#e8d8ff', 60, '700');
      title.position.set(0, subPoleY + subPolkaR*2.6, 0);
      title.scale.set(180, 30, 1);
      drillGroup.add(title);

      // Позиционируем drillGroup в позиции выбранной полки
      const a0 = (270 - drillIdx*30) * Math.PI/180;
      drillGroup.position.set(R*Math.cos(a0), 0, -R*Math.sin(a0));
      // Отодвигаем наружу так, чтобы внутренний край мини-Ясны был СНАРУЖИ от экватора
      const dirOut = new THREE.Vector3(drillGroup.position.x, 0, drillGroup.position.z).normalize();
      drillGroup.position.add(dirOut.multiplyScalar(subR*1.1));
    }

    // Raycaster для hover-detect и click
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    function rebuildMechanics(active){
      // Disposeм геометрии и текстуры старых children (защита от утечки CanvasTexture)
      while(mechGroup.children.length){
        const ch = mechGroup.children[0];
        ch.traverse(node=>{
          if(node.geometry) node.geometry.dispose();
          if(node.material){
            const disp = (m)=>{
              if(m.map && typeof m.map.dispose === 'function') m.map.dispose();
              m.dispose();
            };
            if(Array.isArray(node.material)) node.material.forEach(disp); else disp(node.material);
          }
        });
        mechGroup.remove(ch);
      }
      mechGroup.userData.zodiacCoinsAnim = false;
      // Адаптивная видимость каркаса — приглушаем при многих активных механиках
      const N = (active||[]).length;
      cageMat.opacity = N === 0 ? 0.07 : N <= 2 ? 0.04 : 0.02;
      equatorTube.material.opacity = N === 0 ? 0.75 : N <= 2 ? 0.6 : 0.35;

      const crossDefs = [
        {id:'support', col:0xff3554, idx:[0,3,6,9]},
        {id:'right',   col:0xffc040, idx:[1,4,7,10]},
        {id:'left',    col:0x60aafc, idx:[2,5,8,11]},
      ];
      crossDefs.forEach(c=>{
        if(active.includes(c.id)) mechGroup.add(makeBipyramid(c.idx, c.col, 0.65));
      });

      const pranaDefs = [
        {id:'she', col:0xe0b048, idx:[0,4,8]},
        {id:'fo',  col:0x4ab0ff, idx:[1,5,9]},
        {id:'tsi', col:0x80d0ff, idx:[2,6,10]},
        {id:'ha',  col:0xff7848, idx:[3,7,11]},
      ];
      pranaDefs.forEach(p=>{
        if(active.includes(p.id)) mechGroup.add(makeBipyramid(p.idx, p.col, 0.6));
      });

      if(active.includes('opp')){
        const grp = new THREE.Group();
        const mat = tubeMat(0xffb030, 0.55);
        for(let i=0;i<6;i++){
          const t = makeTube(equatorPos(i), equatorPos(i+6), 0.4, mat);
          if(t) grp.add(t);
        }
        mechGroup.add(grp);
      }

      if(active.includes('rhythm')){
        const triples = [[2,3,4],[5,6,7],[8,9,10],[11,0,1]];
        const center = new THREE.Vector3(0,0,0);
        triples.forEach(tr=>{
          const [a,b,c] = tr.map(i=>equatorPos(i));
          mechGroup.add(makeTetrahedron(a,b,c,center, 0x30A060, 0.55));
        });
      }

      if(active.includes('arcs')){
        const arcsList = [[1,3,5],[5,7,9],[9,11,1]];
        const cols = [0x4090D8, 0x9060D0, 0x30A060];
        arcsList.forEach((arc,ai)=>{
          const [a,b,c] = arc.map(i=>equatorPos(i));
          const mid = b.clone(); mid.y = R * 0.18;
          const curve = new THREE.CatmullRomCurve3([a, mid, c]);
          const tubeGeom = new THREE.TubeGeometry(curve, 32, 0.9, 8, false);
          const m = new THREE.Mesh(tubeGeom, tubeMat(cols[ai], 0.7));
          mechGroup.add(m);
        });
      }

      if(active.includes('halves')){
        const upper = new THREE.Mesh(
          new THREE.SphereGeometry(R*1.02, 24, 12, 0, Math.PI*2, 0, Math.PI/2),
          new THREE.MeshBasicMaterial({ color:0xC9A030, wireframe:true, transparent:true, opacity:0.18 })
        );
        const lower = new THREE.Mesh(
          new THREE.SphereGeometry(R*1.02, 24, 12, 0, Math.PI*2, Math.PI/2, Math.PI/2),
          new THREE.MeshBasicMaterial({ color:0x6450C8, wireframe:true, transparent:true, opacity:0.18 })
        );
        mechGroup.add(upper); mechGroup.add(lower);
      }

      if(active.includes('error89')){
        const ringMat = new THREE.MeshBasicMaterial({ color:0xD946EF, transparent:true, opacity:0.7 });
        [8,9,2,3].forEach(i=>{
          const ring = new THREE.Mesh(new THREE.TorusGeometry(polkaR*1.7, 1.0, 8, 24), ringMat);
          ring.position.copy(equatorPos(i));
          ring.rotation.x = Math.PI/2;
          mechGroup.add(ring);
        });
        const cMat = tubeMat(0xD946EF, 0.45);
        const mid89 = equatorPos(8).clone().lerp(equatorPos(9), 0.5);
        const mid23 = equatorPos(2).clone().lerp(equatorPos(3), 0.5);
        const t = makeTube(mid89, mid23, 0.5, cMat); if(t) mechGroup.add(t);
      }

      if(active.includes('mb_zodiac')){
        const ZS=['♑','♒','♓','♈','♉','♊','♋','♌','♍','♎','♏','♐'];
        // 3D-монеты с гравированным знаком: цилиндр с малой толщиной,
        // металлический ободок + текстурированная грань (CanvasTexture с глифом)
        // Ориентируем ось цилиндра радиально наружу, чтобы лицевая грань смотрела на наблюдателя
        const coinR = polkaR*0.85;
        const coinThick = polkaR*0.28;
        const sideMat = new THREE.MeshStandardMaterial({
          color:0x6b21a8, metalness:0.85, roughness:0.22,
          emissive:0x4c1d95, emissiveIntensity:0.32,
        });
        ZS.forEach((sym, i)=>{
          // Текстура с глифом — рисуем на canvas
          const cv = document.createElement('canvas');
          cv.width = 256; cv.height = 256;
          const ctx = cv.getContext('2d');
          // Фон с радиальным градиентом (золото-фиолет)
          const grad = ctx.createRadialGradient(128,128,20, 128,128,140);
          grad.addColorStop(0, '#f5e9ff');
          grad.addColorStop(0.55, '#c5a8e8');
          grad.addColorStop(1, '#5b21a8');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(128,128,128,0,Math.PI*2); ctx.fill();
          // Тонкий ободок
          ctx.strokeStyle = 'rgba(255,255,255,.55)';
          ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(128,128,118,0,Math.PI*2); ctx.stroke();
          // Глиф
          ctx.font = 'bold 168px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Apple Color Emoji", sans-serif';
          ctx.fillStyle = '#3a0d6e';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // Лёгкая тень для объёма
          ctx.shadowColor = 'rgba(255,255,255,0.6)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = -2;
          ctx.fillText(sym, 128, 138);
          ctx.shadowColor = 'transparent';
          const tex = new THREE.CanvasTexture(cv);
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          if(THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
          const faceMat = new THREE.MeshStandardMaterial({
            map: tex, metalness: 0.3, roughness: 0.5,
            emissive: 0x6c3aad, emissiveIntensity: 0.38,
          });
          // Cylinder: [side, top(+Y), bottom(-Y)]
          const coinGeom = new THREE.CylinderGeometry(coinR, coinR, coinThick, 40, 1, false);
          const coin = new THREE.Mesh(coinGeom, [sideMat, faceMat, faceMat.clone()]);

          // Позиция: на радиусе чуть дальше полки, поднята над экватором
          const dir = equatorPos(i).clone().normalize();
          const pos = equatorPos(i).clone().add(dir.clone().multiplyScalar(polkaR*2.0));
          pos.y = polkaR*1.6;
          coin.position.copy(pos);

          // Ориентируем ось цилиндра по радиальному вектору (наружу),
          // чтобы лицевая грань смотрела от центра — её будет видно с любой стороны drag-камеры
          const axisFrom = new THREE.Vector3(0,1,0);
          const q = new THREE.Quaternion().setFromUnitVectors(axisFrom, dir);
          coin.setRotationFromQuaternion(q);

          // Лёгкое самовращение каждой монеты вокруг радиальной оси даёт «живой» 3D-эффект
          coin.userData.spinAxis = dir.clone();
          coin.userData.spinSpeed = 0.0004 + (i%3)*0.0001;

          mechGroup.add(coin);
        });
        // Регистрируем callback для самовращения монет в animate-loop
        mechGroup.userData.zodiacCoinsAnim = true;
      }

      if(active.includes('mb_scorpio_spider')){
        const top = new THREE.Mesh(
          new THREE.SphereGeometry(R*1.02, 32, 16, 0, Math.PI*2, 0, Math.PI/2),
          new THREE.MeshStandardMaterial({ color:0x2563eb, transparent:true, opacity:0.18, roughness:0.5, metalness:0.2, side:THREE.DoubleSide })
        );
        mechGroup.add(top);
        const bot = new THREE.Mesh(
          new THREE.SphereGeometry(R*1.02, 32, 16, 0, Math.PI*2, Math.PI/2, Math.PI/2),
          new THREE.MeshStandardMaterial({ color:0xdc2626, transparent:true, opacity:0.18, roughness:0.5, metalness:0.2, side:THREE.DoubleSide })
        );
        mechGroup.add(bot);
      }

      if(active.includes('mb_mobius')){
        const curve = new THREE.CatmullRomCurve3([
          equatorPos(11),
          new THREE.Vector3(R*0.5, -R*0.45, R*0.45),
          new THREE.Vector3(0, -R*0.6, R*0.65),
          new THREE.Vector3(-R*0.5, -R*0.45, R*0.45),
          equatorPos(1),
        ], false, 'catmullrom', 0.5);
        const tubeGeom = new THREE.TubeGeometry(curve, 80, 1.6, 12, false);
        const mat = new THREE.MeshStandardMaterial({
          color:0x14b8d4, transparent:true, opacity:0.95,
          roughness:0.18, metalness:0.65,
          emissive:0x14b8d4, emissiveIntensity:0.55,
        });
        mechGroup.add(new THREE.Mesh(tubeGeom, mat));
      }

      if(active.includes('mb_accumulation')){
        [0,3,6,9].forEach(i=>{
          const base = equatorPos(i);
          const apex = base.clone(); apex.y = R*0.35;
          const t = makeTube(base, apex, 1.2, tubeMat(0x22c850, 0.85)); if(t) mechGroup.add(t);
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(polkaR*1.4, 0.7, 8, 32),
            new THREE.MeshStandardMaterial({ color:0x22c850, transparent:true, opacity:0.85, metalness:0.6, roughness:0.2, emissive:0x22c850, emissiveIntensity:0.4 })
          );
          ring.position.copy(base); ring.rotation.x = Math.PI/2;
          mechGroup.add(ring);
        });
      }

      if(active.includes('mb_yasna2')){
        // Перформанс: 144 отдельных Mesh = 144 draw calls. Заменяем на InstancedMesh —
        // одна геометрия, один материал, 144 instance matrix = 1 draw call.
        const microMat = new THREE.MeshStandardMaterial({ color:0xa21caf, transparent:true, opacity:0.7, metalness:0.4, roughness:0.3, emissive:0xa21caf, emissiveIntensity:0.1 });
        const microGeom = new THREE.SphereGeometry(1.4, 10, 6); // меньше сегментов — у этих микро-шаров не нужна высокая детализация
        const instCount = 144;
        const instMesh = new THREE.InstancedMesh(microGeom, microMat, instCount);
        const dummy = new THREE.Object3D();
        let idx = 0;
        for(let i=0;i<12;i++){
          const center = equatorPos(i);
          for(let j=0;j<12;j++){
            const a = (270-j*30)*Math.PI/180;
            const localPos = new THREE.Vector3((polkaR+5)*Math.cos(a), 0, -(polkaR+5)*Math.sin(a));
            const microPos = center.clone().add(localPos);
            dummy.position.copy(microPos);
            dummy.updateMatrix();
            instMesh.setMatrixAt(idx++, dummy.matrix);
          }
        }
        instMesh.instanceMatrix.needsUpdate = true;
        mechGroup.add(instMesh);
      }
    }
    rebuildMechanics(af||[]);

    // ──────────────── Контролы ────────────────
    const updateCamera = () => {
      const { camAzim, camElev, camDist } = stateRef.current;
      const azR = camAzim*Math.PI/180, elR = camElev*Math.PI/180;
      camera.position.x = camDist*Math.cos(elR)*Math.sin(azR);
      camera.position.y = camDist*Math.sin(elR);
      camera.position.z = camDist*Math.cos(elR)*Math.cos(azR);
      camera.up.set(0,1,0);
      camera.lookAt(0,0,0);
    };

    const onPointerDown = (e)=>{
      stateRef.current.isDragging = true;
      stateRef.current.dragStartT = performance.now();
      stateRef.current.dragMoved = 0;
      stateRef.current.lastX = e.clientX; stateRef.current.lastY = e.clientY;
      canvas.style.cursor = 'grabbing'; e.preventDefault();
      // Pointer capture — drag не залипает если отпустить кнопку вне канваса
      if(e.pointerId != null && canvas.setPointerCapture){
        try { canvas.setPointerCapture(e.pointerId); } catch(_){}
      }
    };
    const onPointerMove = (e)=>{
      if(stateRef.current.isDragging){
        const dx = e.clientX - stateRef.current.lastX;
        const dy = e.clientY - stateRef.current.lastY;
        stateRef.current.dragMoved += Math.abs(dx) + Math.abs(dy);
        stateRef.current.camAzim -= dx*0.4;
        stateRef.current.camElev = Math.max(-89, Math.min(89, stateRef.current.camElev - dy*0.35));
        stateRef.current.lastX = e.clientX; stateRef.current.lastY = e.clientY;
      } else {
        // Hover-detect: меняем курсор на pointer когда наводимся на шар
        const rect = canvas.getBoundingClientRect();
        ndc.x = ((e.clientX-rect.left)/rect.width)*2 - 1;
        ndc.y = -((e.clientY-rect.top)/rect.height)*2 + 1;
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(polki);
        canvas.style.cursor = hits.length ? 'pointer' : 'grab';
      }
    };
    const onPointerUp = ()=>{
      stateRef.current.isDragging = false;
      canvas.style.cursor = 'grab';
      // dragMoved оставляем — onClick его проверит и сбросит
    };
    const onWheel = (e)=>{
      e.preventDefault();
      stateRef.current.camDist = Math.max(280, Math.min(1600, stateRef.current.camDist + e.deltaY*0.5));
    };

    // Touch pinch-to-zoom — отслеживаем 2 пальца
    let pinchActive = false, lastPinchDist = 0;
    const touchDist = (touches)=>{
      if(touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx*dx + dy*dy);
    };
    const onTouchStart = (e)=>{
      if(e.touches.length === 2){
        pinchActive = true;
        lastPinchDist = touchDist(e.touches);
        stateRef.current.isDragging = false; // отменяем drag во время pinch
        e.preventDefault();
      }
    };
    const onTouchMove = (e)=>{
      if(pinchActive && e.touches.length === 2){
        const d = touchDist(e.touches);
        const dz = (lastPinchDist - d) * 1.8; // знак: расхождение = zoom in
        stateRef.current.camDist = Math.max(280, Math.min(1600, stateRef.current.camDist + dz));
        lastPinchDist = d;
        e.preventDefault();
      }
    };
    const onTouchEnd = (e)=>{
      if(e.touches.length < 2){ pinchActive = false; }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, {passive:false});
    canvas.addEventListener('touchstart', onTouchStart, {passive:false});
    canvas.addEventListener('touchmove', onTouchMove, {passive:false});
    canvas.addEventListener('touchend', onTouchEnd);

    const raycaster_local = new THREE.Raycaster();
    const ndc_local = new THREE.Vector2();
    const onClick = (e)=>{
      if(stateRef.current.dragMoved > (isTouch ? 12 : 5)){
        stateRef.current.dragMoved = 0;
        return; // считаем что было drag — игнор
      }

      const rect = canvas.getBoundingClientRect();
      ndc_local.x = ((e.clientX-rect.left)/rect.width)*2 - 1;
      ndc_local.y = -((e.clientY-rect.top)/rect.height)*2 + 1;
      raycaster_local.setFromCamera(ndc_local, camera);
      const live = liveRef.current;
      // Если drill открыт — обработка кликов с приоритетом sub-полок
      if(live.drill != null && sceneRefs.current && sceneRefs.current.subPolki){
        // 1. Клик по sub-полке — визуальный pulse (без изменения state)
        const subHits = raycaster_local.intersectObjects(sceneRefs.current.subPolki);
        if(subHits.length){
          const ball = subHits[0].object;
          const origScale = ball.scale.x;
          ball.scale.set(origScale*1.4, origScale*1.4, origScale*1.4);
          setTimeout(()=>{ try{ ball.scale.set(origScale,origScale,origScale);}catch(e){} },280);
          return;
        }
        // 2. Клик по внешней полке — переключиться на её sub-Ясну
        const outerHits = raycaster_local.intersectObjects(polki);
        if(outerHits.length){
          const idx = outerHits[0].object.userData.polkaIdx;
          if(idx !== live.drill && typeof onDrill === 'function'){
            onDrill(idx);
          }
          return;
        }
        // 3. Клик по пустому фону — закрыть drill
        if(typeof onDrill === 'function') onDrill(null);
        return;
      }
      const hits = raycaster_local.intersectObjects(polki);
      if(hits.length){
        const idx = hits[0].object.userData.polkaIdx;
        // Если активна mb_yasna2 — вместо выбора открываем drill
        if((live.af||[]).includes('mb_yasna2') && typeof onDrill === 'function'){
          onDrill(idx);
        } else if(typeof onSel === 'function'){
          onSel(idx);
        }
      }
    };
    canvas.addEventListener('click', onClick);

    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if(!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w/h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement || canvas);

    let raf, lastT = performance.now();
    let pulsePhase = 0;
    const animate = (now)=>{
      const dt = now - lastT; lastT = now;
      const live = liveRef.current;
      // Вращение колеса (читаем свежие props через ref)
      if(live.rotationOn){
        const dir = live.rotationOn==='cw' ? -1 : 1;
        const speedDeg = 360 / ((live.speedSec||24) * 1000);
        wheelGroup.rotation.y += dir * dt * speedDeg * Math.PI/180;
      }
      // Selected polka — пульсация emissive + лёгкое увеличение
      pulsePhase += dt * 0.003;
      const drilling = live.drill != null;
      polki.forEach((p, i) => {
        if(drilling){
          // Если drill активен — выбранная полка скрывается (внутрь неё разворачивается мини-Ясна),
          // остальные приглушаются
          if(i === live.drill){
            p.scale.lerp(new THREE.Vector3(0.4,0.4,0.4), 0.12);
            p.material.emissiveIntensity = 0.08;
            p.material.opacity = 0.4;
            p.material.transparent = true;
          } else {
            p.scale.lerp(new THREE.Vector3(0.7,0.7,0.7), 0.12);
            p.material.emissiveIntensity = 0.10;
            p.material.opacity = 0.55;
            p.material.transparent = true;
          }
        } else {
          if(i === live.sel){
            const pulse = 0.5 + 0.4 * Math.sin(pulsePhase * 2);
            p.material.emissiveIntensity = pulse;
            p.scale.lerp(new THREE.Vector3(1.4,1.4,1.4), 0.1);
          } else {
            p.material.emissiveIntensity = 0.15;
            p.scale.lerp(new THREE.Vector3(1,1,1), 0.1);
          }
          p.material.opacity = 1;
          p.material.transparent = false;
        }
      });

      // Самовращение зодиакальных монет (если активны)
      if(mechGroup.userData.zodiacCoinsAnim){
        mechGroup.children.forEach(ch=>{
          if(ch.userData && ch.userData.spinAxis){
            ch.rotateOnAxis(ch.userData.spinAxis, ch.userData.spinSpeed * dt);
          }
        });
      }

      // Анимация drillGroup: появление/исчезновение через scale-lerp
      if(drilling){
        if(!drillGroup.visible) drillGroup.visible = true;
        drillGroup.scale.lerp(new THREE.Vector3(1,1,1), 0.12);
        drillGroup.rotation.y += dt * 0.0001; // лёгкое самовращение
        // Пульсация sub-sel
        subPolkiArr.forEach((sb, i)=>{
          if(i === live.sel){
            const pulse = 0.5 + 0.4 * Math.sin(pulsePhase * 2);
            sb.material.emissiveIntensity = pulse;
            sb.scale.lerp(new THREE.Vector3(1.4,1.4,1.4), 0.1);
          } else {
            sb.material.emissiveIntensity = 0.45;
            sb.scale.lerp(new THREE.Vector3(1,1,1), 0.1);
          }
        });
      } else {
        if(drillGroup.scale.x > 0.05){
          drillGroup.scale.lerp(new THREE.Vector3(0.001,0.001,0.001), 0.18);
        } else if(drillGroup.visible){
          drillGroup.visible = false;
        }
      }

      updateCamera();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    sceneRefs.current = { rebuildMechanics, buildDrillGroup, subPolki: subPolkiArr };

    return ()=>{
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('click', onClick);
      renderer.dispose();
      scene.traverse(o=>{
        if(o.geometry) o.geometry.dispose();
        if(o.material){
          const disposeMat = (m)=>{
            if(!m) return;
            // Disposem связанные текстуры (CanvasTexture от зодиак-монет, цифр, sprite-меток)
            if(m.map && typeof m.map.dispose === 'function') m.map.dispose();
            if(m.envMap && typeof m.envMap.dispose === 'function') m.envMap.dispose();
            m.dispose();
          };
          if(Array.isArray(o.material)) o.material.forEach(disposeMat); else disposeMat(o.material);
        }
      });
      // env-map не входит в scene-graph — disposeим вручную
      if(scene.environment && typeof scene.environment.dispose === 'function'){
        scene.environment.dispose();
      }
    };
  }, [y]);

  React.useEffect(()=>{
    if(sceneRefs.current && sceneRefs.current.rebuildMechanics){
      sceneRefs.current.rebuildMechanics(af||[]);
    }
  }, [JSON.stringify(af||[])]);

  // Перестроение drillGroup при смене drill / subPolki
  // Используем стабильный signature вместо JSON.stringify на каждый render
  const subPolkiSig = (subPolki||[]).join('|');
  React.useEffect(()=>{
    if(sceneRefs.current && sceneRefs.current.buildDrillGroup){
      sceneRefs.current.buildDrillGroup(drill, subPolki);
    }
  }, [drill, subPolkiSig]);

  return <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block',cursor:'grab',outline:'none',touchAction:'none'}}/>;
}

function makeTextSprite(text, color, fontSize, weight){
  const THREE = window.THREE;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = `${weight||'normal'} ${fontSize||64}px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map:tex, transparent:true });
  return new THREE.Sprite(mat);
}

// Универсальный label-sprite: автоматически подбирает ширину canvas под текст,
// рендерит обводку + halo для контраста на любом фоне, всегда поверх (depthTest:false).
// Возвращает Sprite вместе с aspect ratio для корректного world-scale.
function makeLabelSprite(text, opts){
  const THREE = window.THREE;
  const o = opts || {};
  const fontSize = o.fontSize || 64;
  const padding = Math.floor(fontSize * 0.6);
  const weight = o.weight || '700';
  const font = `${weight} ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif`;
  // Меряем ширину
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = font;
  const tw = Math.ceil(meas.measureText(text).width);
  const c = document.createElement('canvas');
  c.width = tw + padding*2;
  c.height = Math.floor(fontSize * 1.6) + padding;
  const ctx = c.getContext('2d');
  // Halo (тёмный градиент за текстом — для контраста на белых бликах сфер)
  if(o.halo !== false){
    const hg = ctx.createRadialGradient(c.width/2, c.height/2, fontSize*0.3, c.width/2, c.height/2, c.width/2);
    hg.addColorStop(0, 'rgba(8,4,20,0.62)');
    hg.addColorStop(0.55, 'rgba(8,4,20,0.30)');
    hg.addColorStop(1, 'rgba(8,4,20,0.0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Обводка
  ctx.lineWidth = Math.max(4, Math.floor(fontSize*0.10));
  ctx.strokeStyle = o.stroke || 'rgba(10,5,25,0.95)';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeText(text, c.width/2, c.height/2);
  // Заливка
  ctx.fillStyle = o.color || '#ffffff';
  ctx.fillText(text, c.width/2, c.height/2);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  if(THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  const mat = new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest: o.depthTest !== false, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.userData.aspect = c.width / c.height; // для корректного scale
  return sp;
}

// Спрайт цифры с обводкой — высокий контраст на любом фоне (для шаров-полок)
// Квадратный canvas, не растягивается, читается с любого ракурса
function makeDigitSprite(digit, opts){
  const THREE = window.THREE;
  const o = opts || {};
  const size = o.size || 256;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  // Лёгкое svечение/halo за цифрой (повышает контраст на ярких сферах)
  if(o.halo !== false){
    const halo = ctx.createRadialGradient(size/2, size/2, size*0.05, size/2, size/2, size*0.45);
    halo.addColorStop(0, 'rgba(0,0,0,0.55)');
    halo.addColorStop(0.6, 'rgba(0,0,0,0.18)');
    halo.addColorStop(1, 'rgba(0,0,0,0.0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(size/2, size/2, size*0.5, 0, Math.PI*2); ctx.fill();
  }
  const fontSize = o.fontSize || Math.floor(size*0.78);
  ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Тёмная обводка снаружи (контраст с белым шаром)
  ctx.lineWidth = Math.max(8, Math.floor(fontSize*0.12));
  ctx.strokeStyle = o.stroke || 'rgba(20,10,38,0.92)';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeText(String(digit), size/2, size/2 + size*0.02);
  // Заливка — белый/тёплый цвет
  ctx.fillStyle = o.color || '#ffffff';
  ctx.fillText(String(digit), size/2, size/2 + size*0.02);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  if(THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  // depthTest: false — цифра всегда поверх шара (не уйдёт за поверхность)
  const mat = new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest: o.depthTest !== false, depthWrite:false });
  const spr = new THREE.Sprite(mat);
  return spr;
}


// Expose to global namespace for lessons + app to use
window.YasnaCore = {
  CR, PR, REF, T, FL,
  Star, Yasna3DView, Info, OverlayLegend, Editor, OverlayPicker, Picker, Verification,
  POS_DESC, CROSS_CTX, PRANA_CTX, OPP_DESC, GLOSS
};
