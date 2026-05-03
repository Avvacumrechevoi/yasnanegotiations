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
const angDeg=i=>270-i*30;
const rad=d=>d*Math.PI/180;
const xy=(i,cx,cy,r)=>({x:cx+r*Math.cos(rad(angDeg(i))),y:cy-r*Math.sin(rad(angDeg(i)))});
const REF=[{f:'ВХОД / ОСНОВА',ex:'Ночь · Прихожая · Свинья'},{f:'ПЕРВЫЙ РЕЗУЛЬТАТ',ex:'Первый свет · Гостиная · Мойка'},{f:'КАНАЛ / ПОТОК',ex:'Заря · Столовая · Река'},{f:'ГЛАВНОЕ СОБЫТИЕ',ex:'Выход Солнца · Кухня · Плита'},{f:'ПОДЪЁМ / КУЛЬТУРА',ex:'Подъём · Веранда · Пар'},{f:'НАКОПИТЕЛЬ',ex:'Последняя тьма · Амбар · Облако'},{f:'ВЕРШИНА / ЦЕНТР',ex:'День · Чулан · Перенос'},{f:'ПИК / НАБЛЮДЕНИЕ',ex:'Первая тьма · Детская · Гроза'},{f:'ЗАЩИТА / СПУСК',ex:'Спуск · Женская · Дождь'},{f:'ОЦЕНКА / ВЕСЫ',ex:'Заход · Спальня · Касание'},{f:'УГАСАНИЕ',ex:'Сумерки · Кабинет · Стекание'},{f:'КОНЕЦ / ВЫХОД',ex:'Последний свет · Санблок · Лужа'}];
const T=[
  {id:'цветов',verified:true,starter:true,n:'Цветов радуги',rubrik:true,p:['Желтый','Оранжевый','Алый','Красный','Черный / Золотой','Фиолетовый','Синий','Голубой','Ультрамарин','Зеленый','Изумрудный','Салатовый']},
  {id:'суток',verified:true,starter:true,n:'Суток',rubrik:true,p:['Ночь','Искра','Утр.Заря, Рассвет','Утро','Восход','Утренний Салют','День','Первая тьма','Закат / Вечерняя Заря','Запад / Вечер Сутки','Сумерки','Вечерний Салют'],th:'День',bh:'Ночь'},
  {id:'знаки_з.',verified:true,starter:true,n:'Зодиака',rubrik:true,p:['Козерог','Водолей','Рыбы','Овен','Телец','Близнецы','Рак','Лев','Дева','Весы','Скорпион','Стрелец']},
  {id:'двора_животных',verified:true,n:'Животных',rubrik:true,p:['Свинья','Грызуны','Лошадь','Козлы / Бараны','Корова / Бык','Верблюд','Человек','Кошка / Дети','Собака','Птицы','Дракон','Змея']},
  {id:'двора',verified:true,n:'Двора (Постройки)',rubrik:true,p:['Ворота','Калитка','Конюшня','Козлы / бараны','Коровник','Амбар','Веранда','Лавка хозяина','Баня / дровник','Голубятник','Пчелы / мед','Туалет / Навозная куча']},
  {id:'дома',verified:true,starter:true,n:'Дома',rubrik:true,p:['Прихожая','Гостиная','Столовая','Кухня','Веранда','Амбар','Чулан','Детская','Женская комната','Общая спальня','Кабинет','Сан.Блок']},
  {id:'спальни',verified:true,n:'Спальни',rubrik:true,p:['Халат','Гантели / Вода','Зарядка','Одеяло или Сундук','Окно / Гобилен','шкаф с книгами','Бельевой Шкаф','Красный угол','Прикроват. Тумбочка','Кровать','Прикроват.Тумбочка','Светильник']},
  {id:'кухни',verified:true,starter:true,n:'Кухни',rubrik:true,p:['Вход / Фартук','Мойка','Разделочный стол','Плита','Стол полуфабрикатов','Шкаф специй / Книга рецептов','Стол для готовки','Готовое блюдо','Делим на порции','Оценочный стол','Шведский стол','Вынос блюд / Меню']},
  {id:'круговорота_воды',verified:true,starter:true,n:'Круговорота воды',rubrik:true,p:['Вода с землей-грязь','Болото / Ключ / Родник','Река','Поверхность водоема','Пар','Облако','Холод / переход-перенос','Гроза / Молния','Дождь','Касание воды','Стекание','Лужа (брызгает-стреляет)']},
  {id:'печи',verified:true,n:'Печи',rubrik:true,p:['Каналы подачи','Колосники','Объем топки (духовой шкаф','огнеупорная пластина','Лабиринт (воздуховоды в п','Камора (расшир.камера)','Труба','Догорел','Отапливаемый объем','Теплоупор','Кондиционер','Дверцы-заслоник / форточк']},
  {id:'дерева',verified:true,n:'Дерева',rubrik:true,p:['Корни','Косточка','Плод','Клетка (Рыльце)','Домен (Столбик)','Бахрома (Пестик)','Лепесток','','Лист','Ветка','Ствол','Пень']},
  {id:'заода_предприятия',verified:true,n:'Завода',rubrik:true,p:['Рекламный отдел','Отдел Кадров / Закупок / ','Рабочие','Плановый отдел (Нач.Цеха)','Констр.Бюро / Изобретател','Главный инж. / Склад / Тр','Директор / Управа','Хозяин / ОТК / СБ','Охрана Предприятия','Бухгалтерия','Юр. ОТдел','Готовая продукция / Отд.С']},
  {id:'удочки',verified:true,n:'Удочки',rubrik:true,p:['Поводок','Торец Удочки','Бедро УДочки','Первая рука (держит ниже)','Спина удочки','Вторая рука (выше держит ','Дуга','','Струна / Нерв','Поплавок','Отвес','Грузило / Дробина']},
  {id:'мирового_яйца',verified:true,n:'Мирового Яйца',rubrik:true,p:['Река','Заливные Луга','Редколесье','Лес (Чаща леса)','Опушка','Альпийские луга','Горная река / Роща','Скалы / Висячие сады','Вечные снега / Небо','Вершина горы / Небосвод','Спуск с горы / Небосклон','Обрывистый берег / Женски']},
  {id:'мирового_яйца_2',verified:true,n:'Мирового Яйца 2',rubrik:true,p:['Море','Выпас','Двор','Дом','Церковь / Сад','Храм','Школа / Терем','','Дворец / Небо','Палаты / Небосвод','Канада / Небосклон','Америка / Обрывистый бере']},
  {id:'колокольни',verified:true,n:'Колокольни',rubrik:true,p:['Река / Колодец','Луг / Подвал','Двор / Хозяйственный этаж','Дом','Церковь / Памятные вещи','Храм','Школа / Колокол','Малиновый звон','Дворец','Купол','Фонарь / Маяк','Золотая рыбка / Маковка к']},
  {id:'театра',verified:true,n:'Театра',rubrik:true,p:['Театральный коридор','Закулисье / Капустник','Замостье','Сцена / Мост','Подмостки / Авансцена / Э','Оркестровая яма / Рампа','Зрительный зал','Балкон','Знать / Дворяне','Царская Ложа','Дирекция театра','Гримерки']},
  {id:'месяцев',verified:true,n:'Месяцев',rubrik:true,p:['Январь / Стужень','Февраль / Лютый','Март / березень','Апрель / Квитень','Май / Маженья','Июнь / Травень','Июль / Червень-Липень','Август','Сентябрь / Вересень','Октябрь / Ружник / Костри','Ноябрь / Листопад','Декабрь / Грудень / Грубж']},
  {id:'головы',verified:true,n:'Головы',rubrik:true,p:['Шея','Грызло','Рот','Нос','Глаза','Лоб','Темя','Макушка','Коса','Ухо','Загивок','Задняя часть шеи']},
  {id:'тела',verified:true,n:'Тела',rubrik:true,p:['Ступни','Половые органы','Живот','Грудь','Лицо','Лоб','Волосы','Макушка / Внеш. коса','Внутр.сторона косы','Шея плечи','Спина','Ягодицы']},
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
];

function Star({yy,sel,onSel,hl,af=[],showOpp,overlay,mob}){
  const isMob=typeof window!=="undefined"&&window.innerWidth<=768;
  const p=yy.p||[];
  const S=900,W=700,cx=S/2,cy=W/2,R=215,nr=isMob?26:23,lr=R+60;
  const pts=Array.from({length:12},(_,i)=>xy(i,cx,cy,R))
  const lps=Array.from({length:12},(_,i)=>xy(i,cx,cy,lr))
  const olps=Array.from({length:12},(_,i)=>xy(i,cx,cy,lr+24))
  const ilps=Array.from({length:12},(_,i)=>xy(i,cx,cy,lr-16))
  const hasMech=af.length>0;
  const nc=i=>(hl&&!hl.includes(i))?'#e0e0e8':CR[gc(i)].c;
  const no=i=>(hl&&!hl.includes(i))?.15:1;
  const anch=i=>{const x=lps[i].x;return Math.abs(x-cx)<25?'middle':x<cx?'end':'start';};
  return(
    <svg viewBox={mob?`40 -10 820 720`:`0 0 ${S} ${W}`} style={{width:'100%',height:'100%'}}>
      <defs>
        <filter id="gw"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="ns"><feDropShadow dx="0" dy="1" stdDeviation="2.5" floodOpacity=".07"/></filter>
      </defs>
      <rect width={S} height={W} fill="#fff"/>
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
      
      {showOpp&&Array.from({length:6},(_,i)=><g key={`o${i}`}><line x1={pts[i].x} y1={pts[i].y} x2={pts[i+6].x} y2={pts[i+6].y} stroke="#ff9500" strokeWidth="1" opacity=".18" strokeDasharray="5 4"/><circle cx={(pts[i].x+pts[i+6].x)/2} cy={(pts[i].y+pts[i+6].y)/2} r="2" fill="#ff9500" opacity=".15"/></g>)}
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
      {af.includes('halves')&&<>
        {/* Top/Bottom: Чаша Света / Чаша Тьмы */}
        <path d={`M${pts[3].x},${pts[3].y} A${R},${R} 0 0,0 ${pts[9].x},${pts[9].y}`} fill="rgba(255,180,0,.08)" stroke="rgba(200,150,0,.45)" strokeWidth="2.5"/>
        <path d={`M${pts[9].x},${pts[9].y} A${R},${R} 0 0,0 ${pts[3].x},${pts[3].y}`} fill="rgba(80,100,200,.08)" stroke="rgba(80,100,200,.4)" strokeWidth="2.5"/>
        {/* Left/Right: Нарастание / Спад */}
        <path d={`M${pts[0].x},${pts[0].y} A${R},${R} 0 0,0 ${pts[6].x},${pts[6].y}`} fill="rgba(40,180,100,.05)" stroke="rgba(40,160,90,.25)" strokeWidth="1.2"/>
        <path d={`M${pts[6].x},${pts[6].y} A${R},${R} 0 0,0 ${pts[0].x},${pts[0].y}`} fill="rgba(180,80,180,.05)" stroke="rgba(160,70,160,.25)" strokeWidth="1.2"/>
        {/* Axes */}
        <line x1={pts[3].x} y1={pts[3].y} x2={pts[9].x} y2={pts[9].y} stroke="#86868b" strokeWidth="1" strokeDasharray="6 4" opacity=".25"/>
        <line x1={pts[0].x} y1={pts[0].y} x2={pts[6].x} y2={pts[6].y} stroke="#86868b" strokeWidth="1" strokeDasharray="6 4" opacity=".25"/>
        {/* Labels - darker */}
        <text x={cx} y={cy-R*.5} textAnchor="middle" fill="rgba(170,130,0,.6)" fontSize="11" fontFamily="var(--sans)" fontWeight="600">Чаша Света</text>
        <text x={cx} y={cy+R*.55} textAnchor="middle" fill="rgba(70,80,170,.5)" fontSize="11" fontFamily="var(--sans)" fontWeight="600">Чаша Тьмы</text>
        <text x={cx-R*.5} y={cy+6} textAnchor="middle" fill="rgba(40,140,80,.45)" fontSize="10" fontFamily="var(--sans)" fontWeight="500" transform={`rotate(-90 ${cx-R*.5} ${cy})`}>Нарастание ↑</text>
        <text x={cx+R*.5} y={cy+6} textAnchor="middle" fill="rgba(140,60,140,.4)" fontSize="10" fontFamily="var(--sans)" fontWeight="500" transform={`rotate(90 ${cx+R*.5} ${cy})`}>Спад ↓</text>
      </>}
      {/* Error 8↔9: zone of confusion */}
      {af.includes('error89')&&<>
        {/* Primary zone 8↔9 */}
        <path d={`M${pts[8].x},${pts[8].y} A${R},${R} 0 0,1 ${pts[9].x},${pts[9].y}`} fill="rgba(217,70,239,.06)" stroke="#D946EF" strokeWidth="4" strokeDasharray="8 4"/>
        <line x1={pts[8].x} y1={pts[8].y} x2={pts[9].x} y2={pts[9].y} stroke="#D946EF" strokeWidth="3" opacity=".5" strokeDasharray="6 4"/>

        {/* Mirror zone 2↔3 */}
        <path d={`M${pts[2].x},${pts[2].y} A${R},${R} 0 0,0 ${pts[3].x},${pts[3].y}`} fill="rgba(217,70,239,.03)" stroke="#D946EF" strokeWidth="2.5" strokeDasharray="6 4" opacity=".6"/>
        <line x1={pts[2].x} y1={pts[2].y} x2={pts[3].x} y2={pts[3].y} stroke="#D946EF" strokeWidth="2" opacity=".4" strokeDasharray="6 4"/>

        {/* 4 error types on support cross */}
        {[[0,'Ошибка во сне',0,nr+30],[3,'Просмотрел',(pts[2].x-pts[3].x)/2-70,(pts[2].y-pts[3].y)/2-12],[6,'Мираж',0,-nr-22],[9,'Ошибка измерения',(pts[8].x-pts[9].x)/2+70,(pts[8].y-pts[9].y)/2-12]].map(([idx,label,dx,dy])=>{
          const p=pts[idx];
          return<text key={`e${idx}`} x={p.x+dx} y={p.y+dy} textAnchor="middle" fill="#D946EF" fontSize="10" fontWeight="700" fontFamily="var(--sans)" opacity=".85" style={{pointerEvents:'none'}}>{label}</text>;
        })}
        {/* Connection line 8↔9 to 2↔3 showing mirror */}
        <line x1={(pts[8].x+pts[9].x)/2} y1={(pts[8].y+pts[9].y)/2} x2={(pts[2].x+pts[3].x)/2} y2={(pts[2].y+pts[3].y)/2} stroke="#D946EF" strokeWidth="1.5" opacity=".25" strokeDasharray="4 6"/>
      </>}

      {/* M-К-005 Зодиак: 12 знаков по Полкам как внешнее кольцо */}
      {af.includes('mb_zodiac')&&(()=>{
        const ZS=['♑','♒','♓','♈','♉','♊','♋','♌','♍','♎','♏','♐'];
        const ZN=['Козерог','Водолей','Рыбы','Овен','Телец','Близнецы','Рак','Лев','Дева','Весы','Скорпион','Стрелец'];
        const lr2=lr+30;
        return<g>
          <circle cx={cx} cy={cy} r={lr2+18} fill="none" stroke="#7c3aed" strokeWidth=".7" strokeDasharray="2 5" opacity=".55"/>
          {ZS.map((s,i)=>{const p=xy(i,cx,cy,lr2);const np=xy(i,cx,cy,lr2-30);
            return<g key={`z${i}`}>
              <circle cx={p.x} cy={p.y} r="14" fill="rgba(124,58,237,.07)" stroke="rgba(124,58,237,.35)" strokeWidth=".8"/>
              <text x={p.x} y={p.y+6.5} textAnchor="middle" fontSize="19" fontWeight="600" fill="#7c3aed">{s}</text>
              <text x={np.x} y={np.y} textAnchor="middle" fontSize="9" fill="#581c87" opacity=".75" fontWeight="500">{ZN[i]}</text>
            </g>;})}
        </g>;
      })()}

      {/* M-Ж-118 Скорпион↔Паук: верх=Сам, низ=Особа, ось 3↔9 = Поле Боя */}
      {af.includes('mb_scorpio_spider')&&<>
        <path d={`M${pts[3].x},${pts[3].y} A${R},${R} 0 0,1 ${pts[9].x},${pts[9].y} L${pts[3].x},${pts[3].y} Z`}
              fill="rgba(37,99,235,.08)" stroke="rgba(37,99,235,.4)" strokeWidth="1.2" strokeDasharray="6 4"/>
        <text x={cx} y={cy-R+22} textAnchor="middle" fontSize="13" fill="#1d4ed8" fontWeight="700">Головной Паук · Сам</text>
        <text x={cx} y={cy-R+38} textAnchor="middle" fontSize="10.5" fill="#1e3a8a" opacity=".75">верх · идея · мозг</text>
        <path d={`M${pts[3].x},${pts[3].y} A${R},${R} 0 0,0 ${pts[9].x},${pts[9].y} L${pts[3].x},${pts[3].y} Z`}
              fill="rgba(220,38,38,.08)" stroke="rgba(220,38,38,.4)" strokeWidth="1.2" strokeDasharray="6 4"/>
        <text x={cx} y={cy+R-30} textAnchor="middle" fontSize="13" fill="#b91c1c" fontWeight="700">Грудной Скорпион · Особа</text>
        <text x={cx} y={cy+R-14} textAnchor="middle" fontSize="10.5" fill="#7f1d1d" opacity=".75">низ · тело · импульс</text>
        <line x1={pts[3].x-26} y1={pts[3].y} x2={pts[9].x+26} y2={pts[9].y} stroke="#7c2d12" strokeWidth="2" strokeDasharray="3 4" opacity=".55"/>
        <rect x={cx-72} y={cy-12} width="144" height="24" rx="12" fill="#fff" stroke="#7c2d12" strokeWidth="1.4"/>
        <text x={cx} y={cy+5} textAnchor="middle" fontSize="11" fill="#7c2d12" fontWeight="700" letterSpacing="1.5">⟵ ПОЛЕ БОЯ ⟶</text>
      </>}

      {/* M-Г-050 Лента Мёбиуса: дуга 11→0=12→1, замыкание */}
      {af.includes('mb_mobius')&&(()=>{
        const arcD=`M${pts[11].x},${pts[11].y} Q${cx-100},${cy+R+90} ${cx},${cy+R+95} Q${cx+100},${cy+R+90} ${pts[1].x},${pts[1].y}`;
        return<g>
          <path d={arcD} fill="none" stroke="#0891b2" strokeWidth="3.5" strokeLinecap="round" opacity=".85"/>
          <path d={arcD} fill="none" stroke="#67e8f9" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="6 6" opacity=".7"/>
          <circle cx={pts[0].x} cy={pts[0].y+44} r="22" fill="#fff" stroke="#0891b2" strokeWidth="2"/>
          <text x={pts[0].x} y={pts[0].y+50} textAnchor="middle" fontSize="13" fill="#0891b2" fontWeight="800">0=12</text>
          <text x={cx-44} y={cy+R+72} fontSize="26" fill="#0891b2" fontWeight="600">∞</text>
          <text x={cx-22} y={cy+R+74} fontSize="11" fill="#0e7490" fontWeight="700">конец = новое начало</text>
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
          <text x={cx} y={cy+R+72} textAnchor="middle" fontSize="11" fill="#15803d" fontWeight="700" letterSpacing=".5">Длинная копит → перелив в соседние короткие</text>
        </g>;
      })()}

      {sel!==null&&<line x1={pts[sel].x} y1={pts[sel].y} x2={pts[opp(sel)].x} y2={pts[opp(sel)].y} stroke="#ff9500" strokeWidth="1.2" opacity=".2" strokeDasharray="5 3"/>}
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
      
      <circle cx={cx} cy={cy} r={22} fill="#fff" stroke="#d2d2d7" strokeWidth="1.2"/>
      <circle cx={cx} cy={cy} r={3} fill="#d2d2d7"/>
      <text x={cx} y={cy-2} textAnchor="middle" fill="rgba(0,0,0,.3)" fontSize="7" fontFamily="var(--sans)" fontWeight="600" letterSpacing="2">{(()=>{const n=(yy.name||'').toUpperCase();return n.length<=12?n:n.slice(0,11)+'…';})()}</text>
      <text x={cx} y={cy+7} textAnchor="middle" fill="rgba(0,0,0,.15)" fontSize="6" fontFamily="var(--sans)" letterSpacing="2">ЯСНА</text>
      {af.includes('halves')&&yy.th&&<text x={cx} y={34} textAnchor="middle" fill="rgba(0,0,0,.5)" fontSize="13" fontFamily="var(--sans)" fontWeight="600">{yy.th}</text>}
      {af.includes('halves')&&yy.bh&&<text x={cx} y={W-22} textAnchor="middle" fill="rgba(0,0,0,.5)" fontSize="13" fontFamily="var(--sans)" fontWeight="600">{yy.bh}</text>}
      {af.includes('halves')&&yy.lh&&<text x={20} y={cy} textAnchor="middle" fill="rgba(0,0,0,.5)" fontSize="13" fontFamily="var(--sans)" fontWeight="600" transform={`rotate(-90 20 ${cy})`}>{yy.lh}</text>}
      {af.includes('halves')&&yy.rh&&<text x={S-20} y={cy} textAnchor="middle" fill="rgba(0,0,0,.5)" fontSize="13" fontFamily="var(--sans)" fontWeight="600" transform={`rotate(90 ${S-20} ${cy})`}>{yy.rh}</text>}
      {pts.map((pt,i)=>{const isSel=sel===i,c=nc(i),o=no(i);return(
        <g key={i} onClick={()=>onSel(sel===i?null:i)} style={{cursor:'pointer'}}>
          <circle cx={pt.x} cy={pt.y} r={nr+14} fill="transparent" stroke="none"/>
          {isSel&&<circle cx={pt.x} cy={pt.y} r={nr+8} fill={c} opacity=".06" filter="url(#gw)"/>}
          <circle cx={pt.x} cy={pt.y} r={nr} fill="#fff" stroke={c} strokeWidth={isSel?2.5:1.8} opacity={o} filter="url(#ns)" style={{pointerEvents:'none'}}/>
          <text x={pt.x} y={pt.y+6} textAnchor="middle" fill={c} fontSize={isMob?(isSel?"22":"20"):(isSel?"16":"15")} fontWeight="700" fontFamily="var(--sans)" opacity={o} style={{pointerEvents:'none'}}>{i}</text>
        </g>);})}
      {!overlay&&lps.map((pt,i)=>{const lOrig=p[i]||'';if(!lOrig)return null;let dy=5;if(i===0)dy=16;if(i===6)dy=-7;
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
        const xOff=i===3?14:i===9?-14:i===4?8:i===8?-8:0;
        const fs=isMob?(sel===i?'25':'22'):(sel===i?'16':'14');
        const fsW=isMob?(sel===i?'22':'20'):(sel===i?'15':'13');if(parts){return<text key={`l${i}`} x={pt.x+xOff} y={pt.y+dy-9} textAnchor={anch(i)} fill={'#000'} fontSize={fsW} fontFamily="var(--serif)" fontWeight={sel===i?'700':'600'} style={{pointerEvents:'none'}}><tspan x={pt.x+xOff} dy="0">{parts[0]}</tspan><tspan x={pt.x+xOff} dy={isMob?22:16}>{parts[1]}</tspan></text>;}
        return<text key={`l${i}`} x={pt.x+xOff} y={pt.y+dy} textAnchor={anch(i)} fill={'#000'} fontSize={fs} fontFamily="var(--serif)" fontWeight={sel===i?'700':'600'} style={{pointerEvents:'none'}}>{l}</text>;})}
      {overlay&&<>
        {/* Outer orbit - more visible, solid thin line */}
        <circle cx={cx} cy={cy} r={lr+12} fill="none" stroke="rgba(147,51,234,.18)" strokeWidth="1" strokeDasharray="2 4"/>
        {/* Satellite dots on outer orbit showing overlay structure */}
        {Array.from({length:12},(_,i)=>{const op=xy(i,cx,cy,lr+12);return<circle key={`os${i}`} cx={op.x} cy={op.y} r="3" fill={sel===i?'#7c3aed':'#9333ea'} opacity={sel===i?.9:.5}/>;})}
        {/* Thin connector lines between inner point and outer satellite */}
        {Array.from({length:12},(_,i)=>{const op=xy(i,cx,cy,lr+12);return<line key={`oc${i}`} x1={pts[i].x} y1={pts[i].y} x2={op.x} y2={op.y} stroke="rgba(147,51,234,.15)" strokeWidth="1" strokeDasharray="2 3"/>;})}
        {/* Primary Yasna labels - inner ring */}
        {ilps.map((pt,i)=>{const l=p[i]||'';if(!l)return null;const a=angDeg(i);let dy=4;if(i===0)dy=12;if(i===6)dy=-5;return<text key={`p${i}`} x={pt.x} y={pt.y+dy} textAnchor={anch(i)} fill={sel===i?'#1d1d1f':'rgba(0,122,255,.8)'} fontSize={sel===i?"16":"14"} fontFamily="var(--serif)" fontWeight={sel===i?'700':'500'} style={{pointerEvents:'none'}}>{l}</text>;})}
        {/* Overlay Yasna labels - outer ring */}
        {olps.map((pt,i)=>{const l=(overlay.p||[])[i]||'';if(!l)return null;let dy=22;if(i===0)dy=34;if(i===6)dy=-22;if([3,9].includes(i))dy=26;if([2,10].includes(i))dy=26;if([4,8].includes(i))dy=34;if([1,11].includes(i))dy=28;if([5,7].includes(i))dy=24;return<text key={`o${i}`} x={pt.x} y={pt.y+dy} textAnchor={anch(i)} fill={sel===i?'#7c3aed':'#9333ea'} fontSize={sel===i?"17":"15"} fontFamily="var(--serif)" fontWeight={sel===i?'700':'500'} fontStyle="italic" style={{pointerEvents:'none'}}>{l}</text>;})}
      </>}
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

function Info({i,p,af=[],y={},overlay=null,onEdit,onClose}){
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
    <div className={"fi fi-"+cardSize} style={{position:'fixed',bottom:14,right:14,width:420,maxHeight:hasMech?'75vh':'55vh',background:'rgba(255,255,255,.97)',border:'1px solid #e5e5ea',borderRadius:16,backdropFilter:'blur(16px)',boxShadow:'0 4px 24px rgba(0,0,0,.08)',display:'flex',flexDirection:'column'}}>
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
        {/* Context strip moved into scroll area */}
        <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:10,paddingBottom:8,borderBottom:'1px solid #f0f0f2'}}>
          <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#6e6e73',flexWrap:'wrap',minHeight:16}}>
            <span style={{color:'#aeaeb2',fontSize:10,fontWeight:600}}>[{(i+11)%12}]</span>
            <span style={{color:prevL?'#424245':'#c0c0c5'}}>{prevL||<span style={{fontStyle:'italic'}}>—</span>}</span>
            <span style={{color:'#d2d2d7'}}>→</span>
            <span style={{color:'#1d1d1f',fontWeight:600}}>{label||'·'}</span>
            <span style={{color:'#d2d2d7'}}>→</span>
            <span style={{color:nextL?'#424245':'#c0c0c5'}}>{nextL||<span style={{fontStyle:'italic'}}>—</span>}</span>
            <span style={{color:'#aeaeb2',fontSize:10,fontWeight:600}}>[{(i+1)%12}]</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#6e6e73',flexWrap:'wrap'}}>
            <span style={{color:'#ff9500',fontWeight:600}}>↔</span>
            <span style={{color:'#aeaeb2',fontSize:10,fontWeight:600}}>[{opp(i)}]</span>
            <span style={{color:oppLabel?'#424245':'#c0c0c5',fontStyle:oppLabel?'normal':'italic'}}>{oppLabel||'—'}</span>
          </div>
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
        <div style={{fontSize:9,fontWeight:600,color:'#9060D0',textTransform:'uppercase',letterSpacing:0.5,marginBottom:2}}>В этой ясне «{y.name}»</div>
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
      <div style={{padding:'14px 18px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h3 style={{fontFamily:'var(--serif)',fontSize:18,color:'#1d1d1f',fontWeight:600}}>Редактор</h3>
        <button onClick={onClose} style={{fontSize:18,padding:'4px 8px'}}>✕</button>
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
      {t.rubrik&&<span style={{position:'absolute',left:0,top:0,bottom:0,width:3,background:'#30A060'}} title="Верифицирована"/>}
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
              <Section title="Верифицированные" items={rubrikList}/>
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
   why:'Все 12-Полочные Ясны изоморфны: один и тот же знак отвечает за одинаковый режим в Сутках, Годе, Жизни, Двору, Растениях и т.д. Это превращает Зодиак в универсальный язык для сверки.',
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


];



function Verification({y,vs,setVs,onClose}){
  const p=y.p||[];
  const[tab,setTab]=useState('pos');
  const[hidePassed,setHidePassed]=useState(false);
  const[openInfo,setOpenInfo]=useState(null);
  const[showIntro,setShowIntro]=useState(null); // null = auto-detect, false = skip, true = show
  const[copyFeedback,setCopyFeedback]=useState('');
  const k=(id)=>y.name+'_'+id;
  const ans=(id,v)=>setVs(s=>({...s,[k(id)]:v}));
  const get=(id)=>vs[k(id)];

  // Count how many answers this yasna has
  const yasnaKeys=Object.keys(vs).filter(kk=>kk.startsWith(y.name+'_'));
  const hasAnyAnswer=yasnaKeys.length>0;

  // Auto-show intro for fresh verification (null → true on first render if no answers)
  useEffect(()=>{
    if(showIntro===null)setShowIntro(!hasAnyAnswer);
  },[]);

  // Weight-based scoring: КРИТ=3, ВАЖ=2, ЖЕЛ=1
  const W={КРИТ:3,ВАЖ:2,ЖЕЛ:1};
  const scoreW=(checks)=>{let total=0,max=0,done=0,failed=0;checks.forEach(c=>{const w=W[c.w||'ВАЖ'];max+=w;const v=get(c.id);if(v===true){total+=w;done++}else if(v===false){failed++;done++}});return{total,max,pct:max>0?Math.round(total/max*100):0,done,failed,count:checks.length}};
  const scoreCount=(checks)=>{let pass=0,failed=0;checks.forEach(c=>{const v=get(c.id);if(v===true)pass++;else if(v===false)failed++});return{pass,failed,done:pass+failed,total:checks.length}};

  // Empty positions warning
  const emptyPos=[];
  for(let i=0;i<12;i++)if(!p[i])emptyPos.push(i);
  const hasEmpties=emptyPos.length>0;

  // Helper: safe label (empty -> italic placeholder in UI, '?' in template strings)
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
        {info&&isOpen&&<div style={{fontSize:12,color:'#424245',marginTop:6,padding:'8px 10px',background:'#f0f5ff',border:'1px solid #d4e4fb',borderRadius:6,lineHeight:1.55}}>{info}</div>}
        {hint&&v===false&&<div style={{fontSize:11,color:'#c07800',marginTop:4,padding:'6px 10px',background:'#fff8e8',borderRadius:5,borderLeft:'2px solid #E8A834',lineHeight:1.5}}>💡 {hint}</div>}
      </div>
    </div>);};

  // ========== LEVEL 1: POSITIONS ==========
  const posChecks=(i)=>{
    const isLong=i%2===0;const pr=PR[gp(i)];
    const pranaEl1=p[PR[gp(i)].p[0]]||'?';const pranaEl2=p[PR[gp(i)].p[2]]||'?';
    const pranaBrief={she:'Земля: устойчивое, тяжёлое',fo:'Вода: текучее, спадающее',tsi:'Воздух: промежуточное, парящее',ha:'Огонь: резкое, взрывное'};
    const checks=[
      {id:`p${i}_type`,w:'КРИТ',
        q:isLong?`«${lbl(i)}» — процесс или состояние, которое длится?`
                :`«${lbl(i)}» — момент, перелом, быстрый скачок?`,
        info:isLong?`Позиция ${i} — чётная, поэтому должна быть долгой (грань). На чётных стоят процессы, состояния, зоны — то, что можно «растянуть» во времени. Если элемент больше похож на скачок или вспышку — он не на своей полочке.`
                   :`Позиция ${i} — нечётная, поэтому должна быть короткой (угол). На нечётных стоят моменты, вспышки, переломы — то, что происходит мгновенно. Каждое нечётное — это качественный скачок из предыдущего чётного (Основной Закон, §290).`,
        hint:isLong?'Если это скорее момент — переставьте на соседнюю нечётную.':'Если это скорее процесс — переставьте на соседнюю чётную.'},
      {id:`p${i}_prana`,w:'КРИТ',
        q:`«${lbl(i)}» похоже по духу на «${pranaEl1}» и «${pranaEl2}»?`,
        info:`Позиция ${i} относится к Пране ${pr.n}. ${pranaBrief[gp(i)]}. Все три элемента одной Праны (позиции ${PR[gp(i)].p.join(', ')}) должны быть внутренне связаны одним характером. Если один из них выбивается — вероятно, он на чужой полочке.`,
        hint:'Три элемента одной Праны должны быть связаны. Проверьте соседние позиции той же стихии.'},
      {id:`p${i}_cross`,w:'КРИТ',
        q:gc(i)==='support'?`«${lbl(i)}» — одна из 4 главных опор всей Ясны?`
         :gc(i)==='right'?`«${lbl(i)}» — это исход из «${lbl((i+11)%12)}»?`
         :`«${lbl(i)}» готовит к тому, что будет на «${lbl((i+1)%12)}»?`,
        info:gc(i)==='support'?`Опорный Крест (позиции 0, 3, 6, 9) — фундамент Ясны. Если убрать любую из 4 опор, цикл рассыпается. Проверьте: без этого элемента остальные 11 теряют смысл?`
            :gc(i)==='right'?`Крест Управления (1, 4, 7, 10) — результаты опор. Формула связи: из-за того что было [опора], появилось [этот элемент]. Проверьте, что фраза «Из-за ${lbl((i+11)%12)} появился ${lbl(i)}» звучит естественно.`
            :`Крест Веры (2, 5, 8, 11) — подготовка к опорам. Формула связи: когда видим [этот элемент], впереди [следующая опора]. Это не только обещание, но настройка, вера, ожидание.`,
        hint:'Возможно, элемент на чужом кресте. Проверьте альтернативные позиции того же креста.'},
      {id:`p${i}_opp`,w:'КРИТ',
        q:`«${lbl(i)}» и «${lbl(opp(i))}» — настоящие антиподы?`,
        info:`Позиции ${i} и ${opp(i)} — полное противостояние (через центр диаграммы, §227). Они должны быть максимумом и минимумом одного параметра — на одной шкале, но на разных концах. Спросите: в чём именно они противоположны? Можете ли сформулировать одной фразой? Одно исключает другое?`,
        hint:'Ошибка может быть не здесь, а на антиподе (позиция ' + opp(i) + '). Проверьте обе полочки.'},
      {id:`p${i}_seq`,w:'ВАЖ',
        q:`Цепочка «${lbl((i+11)%12)}» → «${lbl(i)}» → «${lbl((i+1)%12)}» читается плавно?`,
        info:`Соседство — это плавность переходов. Для пары чётное→нечётное: накопленное должно переходить в качественный скачок. Для нечётное→чётное: скачок завершился, начинается новое накопление. Если где-то «спотыкаетесь» — проблема либо здесь, либо у соседа.`,
        hint:'Если спотыкается — возможно, виноват сосед. Проверьте позиции ' + ((i+11)%12) + ' и ' + ((i+1)%12) + '.'},
      {id:`p${i}_half`,w:'ВАЖ',
        q:[4,5,6,7,8].includes(i)?`«${lbl(i)}» — что-то явное, открытое, дневное?`
         :[10,11,0,1,2].includes(i)?`«${lbl(i)}» — что-то скрытое, закрытое, ночное?`
         :`«${lbl(i)}» — переломная точка на горизонте (Линия Борьбы)?`,
        info:[4,5,6,7,8].includes(i)?`Позиция ${i} в Чаше Света (верхняя половина, позиции 4-5-6-7-8). Здесь всё — явное, открытое, активное, дневное, «на поверхности».`
            :[10,11,0,1,2].includes(i)?`Позиция ${i} в Чаше Тьмы (нижняя половина, позиции 10-11-0-1-2). Здесь всё — скрытое, закрытое, пассивное, ночное, «под поверхностью».`
            :`Позиция ${i} — на горизонте (Линия Борьбы, §164). Это переломная точка между Чашами Света и Тьмы. На 3 — Проявление Света (Стрелка Весов, Истина). На 9 — Проявление Тьмы (Планка Весов, Розыгрыш).`,
        hint:'Если элемент по духу из противоположной зоны — место может быть на зеркальной позиции.'},
    ];
    // Лёгкие/Тяжёлые/Ожидания для долгих
    if([2,8].includes(i))checks.push({id:`p${i}_time`,w:'ВАЖ',
      q:`«${lbl(i)}» — время с ускорением (бодрый процесс)?`,
      info:`Позиции 2 и 8 — Лёгкие времена (§275). Параметр меняется с ускорением: заря разгорается всё быстрее, закат ускоряется к ночи. Элементы здесь должны ощущаться как «ускоряющиеся» по сравнению с соседями.`,
      hint:'Лёгкие времена — где параметр меняется с ускорением.'});
    if([4,10].includes(i))checks.push({id:`p${i}_time`,w:'ВАЖ',
      q:`«${lbl(i)}» — время с замедлением (давящий процесс)?`,
      info:`Позиции 4 и 10 — Тяжёлые времена (§276). Параметр меняется с замедлением: подъём солнца замедляется к зениту, сумерки замедляются к ночи. Элементы здесь должны ощущаться как «тяжелеющие», упирающиеся в предел.`,
      hint:'Тяжёлые времена — где параметр меняется с замедлением.'});
    if([0,6].includes(i))checks.push({id:`p${i}_time`,w:'ВАЖ',
      q:`«${lbl(i)}» — время покоя, где копится что-то невидимое?`,
      info:`Позиции 0 и 6 — Времена Ожидания (§277). Основной параметр не меняется: в Ночи свет на минимуме и стоит, в Дне свет на максимуме и стоит. Но копится что-то другое: в Ночи — холод, в Дне — жар. Элементы должны ощущаться как накопление при внешней неподвижности.`,
      hint:'В Ночи (0) и Дне (6) свет не меняется — накапливается холод/жар. Проверьте, что в вашем элементе есть скрытое накопление.'});
    // Системная ошибка 8↔9
    if(i===8)checks.push({id:`p${i}_err`,w:'КРИТ',
      q:`Что в «${lbl(8)}» можно перепутать с «${lbl(9)}»?`,
      info:`Системная ошибка 8↔9 — встроенное свойство мира (Урок 3 Суток): «Девятка ясно — есть ошибка. Во всех остальных яснах эта ошибка присутствует». Лингвистическое доказательство: ДЕ-ВЯТ-ь (9) содержит «ДЕВА» (на 8), ВО-С-ЕМЬ (8) содержит «ВЕС-» (Весы на 9). Пример из Ясны Дома: лазарет — лежишь как в спальне (9), но не спишь как в женской комнате (8).`,
      hint:'Путаница универсальна. Если не нашли — плохо искали. Спросите: что в вашей области новички часто путают?'});
    if(i===9)checks.push({id:`p${i}_err`,w:'КРИТ',
      q:`Что в «${lbl(9)}» может быть принято за «${lbl(8)}»?`,
      info:`Зеркальный вопрос к путанице 8↔9. Ищете то, что по сути относится к 8-й полочке, но внешне выглядит как 9. Если 8 и 9 правильно составлены, эта зона путаницы всегда находится.`});
    if(i===2)checks.push({id:`p${i}_mirror`,w:'ВАЖ',
      q:`Есть ли путаница между «${lbl(2)}» и «${lbl(3)}», похожая на 8↔9?`,
      info:`Зеркальная путаница 2↔3. Из Урока 4 Дома: если в 8-9 есть подмена, она должна быть и в 2-3. Пример из Ясны Дома: бар в столовой — по сути кухня (3), но стоит в столовой (2).`,
      hint:'Если нашли 8↔9, то 2↔3 тоже должно быть. Ищите зеркально.'});
    if(i===3)checks.push({id:`p${i}_mirror`,w:'ВАЖ',
      q:`Что в «${lbl(3)}» может проявляться как «${lbl(2)}»?`,
      info:`Зеркальный вопрос: ищете то, что по сути относится к 3-й полочке, но внешне выглядит как 2.`});
    // Типы ошибок Опорного
    if(i===0)checks.push({id:`p${i}_errtype`,w:'ЖЕЛ',
      q:`Тип ошибки «во сне»: что в «${lbl(0)}» может оказаться иллюзией покоя?`,
      info:`Опорный Крест несёт 4 типа заблуждений. На позиции 0 (покой, ночь, дно Чаши Тьмы) — «ошибка во сне». Что-то кажется реальным, но это приснилось, померещилось. Расширение методологии (из диаграммы 1x13).`});
    if(i===3)checks.push({id:`p${i}_errtype`,w:'ЖЕЛ',
      q:`Тип ошибки «просмотрел»: что на «${lbl(3)}» можно пропустить?`,
      info:`На позиции 3 (рождение, восход, Стрелка Весов) — ошибка «просмотрел». В момент яркого рождения легко не заметить детали. Расширение методологии (из диаграммы 1x13).`});
    if(i===6)checks.push({id:`p${i}_errtype`,w:'ЖЕЛ',
      q:`Тип ошибки «мираж»: что в «${lbl(6)}» может быть иллюзией?`,
      info:`На позиции 6 (вершина, максимум, Сила Света) — «мираж». На максимуме возникают иллюзии полноты: марево в день, иллюзия что ничего больше не нужно. Расширение методологии (из диаграммы 1x13).`});
    if(i===9)checks.push({id:`p${i}_errtype`,w:'ЖЕЛ',
      q:`Тип ошибки «измерения»: что на «${lbl(9)}» измеряется неточно?`,
      info:`На позиции 9 (завершение, закат, Планка Весов) — «ошибка измерения». Весы играют, стрелка девиации. Закат показывает то, чего нет (оптические обманы). Расширение методологии.`});
    return checks;
  };

  // ========== LEVEL 2: CONNECTIONS ==========
  const connChecks=[
    {id:'c_triI',w:'ВАЖ',g:'Тройки Ритма',
      q:`Тройка I: «${lbl(2)}» → «${lbl(3)}» → «${lbl(4)}». История?`,
      info:`Четыре тройки Ритма (§507-508): каждые 3 соседние полочки — мини-история «Вера → Бой → Победа». Вера (из Креста Веры) тихо готовит. Бой (Опорный) — самый яркий. Победа (Крест Управления) — явный результат.`,
      hint:'Если Вера громче Боя — переформулируйте Веру тише, как подготовку.'},
    {id:'c_triII',w:'ВАЖ',g:'Тройки Ритма',
      q:`Тройка II: «${lbl(5)}» → «${lbl(6)}» → «${lbl(7)}». История?`,
      info:`Вторая тройка Ритма. В Суток: Последняя Тьма → Светлый День → Первая Тьма.`},
    {id:'c_triIII',w:'ВАЖ',g:'Тройки Ритма',
      q:`Тройка III: «${lbl(8)}» → «${lbl(9)}» → «${lbl(10)}». История?`,
      info:`Третья тройка Ритма. В Суток: Спуск Солнца → Заход Солнца → Вечерние Сумерки. История поражения Света.`},
    {id:'c_triIV',w:'ВАЖ',g:'Тройки Ритма',
      q:`Тройка IV: «${lbl(11)}» → «${lbl(0)}» → «${lbl(1)}». История?`,
      info:`Четвёртая тройка Ритма. В Суток: Последний Свет → Тёмная Ночь → Первый Свет. Вера в завтра → покой ночи → искра утра.`},
    {id:'c_arcI',w:'ВАЖ',g:'Дуги Тепла',
      q:`Дуга I (утро): «${lbl(1)}»→«${lbl(2)}»→«${lbl(3)}»→«${lbl(4)}»→«${lbl(5)}». Плавно?`,
      info:`Три Дуги Тепла (§664-676). Каждая из 5 полочек: ФО (исток) → ЦИ (нагрев) → ХА (пик) → ШЭ (остывание) → ФО (конец). Середина (ХА) — самый яркий элемент дуги.`,
      hint:'Если середина тусклее краёв — проверьте позицию 3. Возможно там не самый яркий элемент.'},
    {id:'c_arcII',w:'ВАЖ',g:'Дуги Тепла',
      q:`Дуга II (день): «${lbl(5)}»→«${lbl(6)}»→«${lbl(7)}»→«${lbl(8)}»→«${lbl(9)}». Плавно?`,
      info:`Дневная дуга. Середина — позиция 7 (пик жара).`},
    {id:'c_arcIII',w:'ВАЖ',g:'Дуги Тепла',
      q:`Дуга III (ночь): «${lbl(9)}»→«${lbl(10)}»→«${lbl(11)}»→«${lbl(0)}»→«${lbl(1)}». Плавно?`,
      info:`Ночная дуга. Середина — позиция 11 (последняя вспышка).`},
    {id:'c_transup',w:'ВАЖ',g:'Переходы',
      q:`Путь 0→6: параметр плавно нарастает?`,
      info:`Левая половина цикла — фаза нарастания основного параметра. От минимума (0) через все промежуточные состояния до максимума (6). Каждый шаг должен усиливать параметр.`,
      hint:'Если где-то «рвётся» — найдите пару, которая спотыкается.'},
    {id:'c_trandown',w:'ВАЖ',g:'Переходы',
      q:`Путь 6→0: параметр плавно убывает?`,
      info:`Правая половина — фаза спада. От максимума (6) через промежуточные состояния до минимума (0). Каждый шаг должен ослаблять параметр.`},
    {id:'c_crossR',w:'ВАЖ',g:'Внутри крестов',
      q:`Крест Управления: все 4 связи (0→1, 3→4, 6→7, 9→10) читаются одинаково?`,
      info:`Проверка последовательности Креста Управления. Все 4 пары должны давать читаемую фразу «Из-за опоры появилось следствие». Если одна пара слабее других — там возможно ошибка.`},
    {id:'c_crossL',w:'ВАЖ',g:'Внутри крестов',
      q:`Крест Веры: все 4 связи (2→3, 5→6, 8→9, 11→0) читаются одинаково?`,
      info:`Проверка последовательности Креста Веры. Все 4 пары должны давать читаемую фразу «Видим подготовку — впереди опора». Если одна пара слабее — там возможно ошибка.`},
  ];

  // ========== LEVEL 3: MECHANICS ==========
  const mechChecks=[
    {id:'m_type',w:'КРИТ',g:'Типы',
      q:`Чётные (0,2,4,6,8,10) — все долгие, нечётные (1,3,5,7,9,11) — все короткие?`,
      info:`Основное правило Ясны. Чётные позиции — грани (долгие процессы, накопление). Нечётные — углы/переломы (короткие скачки). Ни одного исключения быть не должно.`},
    {id:'m_law',w:'КРИТ',g:'Типы',
      q:`Каждая пара «чётное → нечётное» — это накопление→скачок?`,
      info:`Основной Закон Ясны (§290): переход количества в качество. 6 пар [0→1, 2→3, 4→5, 6→7, 8→9, 10→11]. В каждой паре долгое копит — короткое скачком превращает в новое качество.`},
    {id:'m_she',w:'КРИТ',g:'Праны',
      q:`Земля (0,4,8): «${lbl(0)}», «${lbl(4)}», «${lbl(8)}» — все земные?`,
      info:`Треугольник Праны ШЭ/ЭЛ (§648-653). Три элемента — устойчивые, тяжёлые, как земля. Между ними должна чувствоваться общая «земная» связь.`,
      hint:'Возможно один из трёх на чужой полочке. Проверьте, где он мог бы стоять лучше.'},
    {id:'m_fo',w:'КРИТ',g:'Праны',
      q:`Вода (1,5,9): «${lbl(1)}», «${lbl(5)}», «${lbl(9)}» — все водные?`,
      info:`Треугольник Праны ФО/ОМ. Три элемента — текучие, спадающие, переходные, как вода, ищущая низ.`},
    {id:'m_tsi',w:'КРИТ',g:'Праны',
      q:`Воздух (2,6,10): «${lbl(2)}», «${lbl(6)}», «${lbl(10)}» — все воздушные?`,
      info:`Треугольник Праны ЦИ/ИНЬ. Три элемента — воздушные, промежуточные, с неустойчивым покоем, как воздух.`},
    {id:'m_ha',w:'КРИТ',g:'Праны',
      q:`Огонь (3,7,11): «${lbl(3)}», «${lbl(7)}», «${lbl(11)}» — все огненные?`,
      info:`Треугольник Праны ХА/АНГ. Три элемента — резкие, взрывные, огненные, моменты когда что-то загорается.`},
    {id:'m_support',w:'КРИТ',g:'Кресты',
      q:`Опорный: «${lbl(0)}», «${lbl(3)}», «${lbl(6)}», «${lbl(9)}» — 4 опоры, без которых Ясна рассыплется?`,
      info:`Опорный Крест / Крест Бытия (§250, §433). 4 главных опоры явления. Если убрать любую — остальные 8 элементов теряют смысл.`},
    {id:'m_right',w:'КРИТ',g:'Кресты',
      q:`Управления (1,4,7,10) — все результаты/исходы опор, с общим характером?`,
      info:`Крест Управления / Исхода / Любви (§446-447, §502). 4 элемента-следствия. Должны быть «по духу» близки (все про итоги, результаты, исходы).`},
    {id:'m_left',w:'КРИТ',g:'Кресты',
      q:`Веры (2,5,8,11) — все подготовки/ожидания перед опорами?`,
      info:`Крест Веры / Левит / Духа (§452, §499). 4 элемента-подготовки. Должны быть «по духу» близки (все про ожидание, настройку, веру).`},
    {id:'m_opp06',w:'КРИТ',g:'Оси',
      q:`Линия Единства: «${lbl(0)}» ↔ «${lbl(6)}» — абсолютные мин и макс?`,
      info:`Линия Единства (§249). Вертикальная ось. Разделяет нарастание и спад параметра. Полярная пара 0↔6 — самое важное в Ясне.`},
    {id:'m_opp39',w:'КРИТ',g:'Оси',
      q:`Линия Борьбы: «${lbl(3)}» ↔ «${lbl(9)}» — два горизонта?`,
      info:`Линия Борьбы (§164). Горизонтальная ось. Разделяет явный и неявный свет. На 3 — Стрелка Весов (Истина), на 9 — Планка Весов (Розыгрыш).`},
    {id:'m_opp_all',w:'КРИТ',g:'Противоположности',
      q:`Все 6 пар противоположностей работают как зеркала?`,
      info:`Полные противостояния (§227): 0↔6, 1↔7, 2↔8, 3↔9, 4↔10, 5↔11. Каждая пара должна быть зеркально симметричной относительно центра. Одно исключает другое.`},
    {id:'m_half_vert',w:'ВАЖ',g:'Зоны',
      q:`Чаша Света (4-8) всё явное, Чаша Тьмы (10-2) всё скрытое?`,
      info:`Две Чаши (§307-325). Верх — Чаша Неба/Света: явное, открытое, дневное. Низ — Чаша Земли/Тьмы: скрытое, закрытое, ночное.`},
    {id:'m_half_horiz',w:'ВАЖ',g:'Зоны',
      q:`Лево (1-5) — нарастание, право (7-11) — спад?`,
      info:`Вертикальное разделение. Левая половина — фаза роста основного параметра. Правая — фаза убывания.`},
    {id:'m_err89',w:'КРИТ',g:'Системная ошибка',
      q:`Зона путаницы 8↔9 найдена и описана?`,
      info:`Встроенное свойство мира (Урок 3 Суток). В каждой Ясне обязательно должна присутствовать зона, где элементы 8 и 9 могут быть перепутаны. Если не нашли — плохо искали.`,
      hint:'Если не нашли — вернитесь к полочкам 8 и 9. Спросите: что в вашей области часто путают?'},
    {id:'m_mirror',w:'ВАЖ',g:'Системная ошибка',
      q:`Зеркальная зона путаницы 2↔3 найдена?`,
      info:`Из Урока 4 Дома: если 8↔9 путаются, то и 2↔3 тоже. Ищите аналогичную зону подмены между подготовкой (2) и рождением (3).`},
    {id:'m_zodiac',w:'ВАЖ',g:'Расширенные',
      q:`Зодиак на полках: 0=♑Козерог, 3=♈Овен, 6=♋Рак, 9=♎Весы — режимы совпадают?`,
      info:`M-К-005 / M-Г-040. Все 12-Полочные Ясны изоморфны Зодиаку: один и тот же знак на одной и той же Полке отвечает за одинаковый режим в Сутках, Годе, Жизни, Двору и т.д. Опоры — это 4 кардинальных знака.`,
      hint:'Если на Полке 6 у вас явление, не похожее на «летний максимум» — Полка 6 заполнена неверно: там должен быть Рак, кульминация.'},
    {id:'m_scorpio_spider',w:'ВАЖ',g:'Расширенные',
      q:`Верх Полки (4–8) — про идею/контроль («Сам»), низ (10–2) — про тело/импульс («Особа»)?`,
      info:`M-Ж-118. Верхний полукруг = Головной Паук (план, мозг, контроль). Нижний полукруг = Грудной Скорпион (материя, импульс, реализация). На оси 3↔9 — «Поле Боя», точка противоборства.`,
      hint:'Если «телесное» оказалось в верхней половине, а «идея» — в нижней, половины перепутаны.'},
    {id:'m_mobius',w:'КРИТ',g:'Расширенные',
      q:`Полка 11 готовит Полку 0 — конец цикла является началом следующего?`,
      info:`M-Г-050. Лента Мёбиуса: 11 → 0 = 12. Если Ясна выглядит как линейный список без замыкания — она не Ясна, а перечень. Зима готовит Весну, Полночь — Утро, Смерть — Зачатие.`,
      hint:'Если 11 ощущается как «тупик», переформулируйте её так, чтобы она естественно перетекала в 0.'},
    {id:'m_accumulation',w:'ВАЖ',g:'Расширенные',
      q:`Длинные Полки (0/3/6/9) копят, а соседние короткие (1/2/4/5/7/8/10/11) переливают?`,
      info:`M-К-007. Закон Накопление→Переход. Долгая фаза — резервуар; короткая фаза — клапан. Если на длинной Полке мгновенное событие, а на короткой — длительный процесс, чередование сломано.`,
      hint:'Назовите вслух: что копится на каждой длинной Полке и какой именно перелив происходит на соседней короткой.'},
  ];

  // ========== LEVEL 4: HOLISTIC ==========
  const holiChecks=[
    {id:'h_types',w:'КРИТ',
      q:`Это ТИПЫ состояний, а не ПРОЦЕСС/хронология?`,
      info:`Ключевой критерий. Ясна — 12 одновременно существующих состояний, упорядоченных по параметру. Если получается «сначала А, потом Б, потом В» — это хронология, не Ясна. Признак процесса: элементы описаны как глаголы («светает»), а не существительные («Заря»).`,
      hint:'Если получаются глаголы — скорее всего процесс, не Ясна. Переформулируйте элементы как существительные.'},
    {id:'h_param',w:'КРИТ',
      q:`Основной параметр — один и тот же для всех 12 полочек?`,
      info:`Все 12 полочек должны быть упорядочены по ОДНОЙ шкале. В Суток — свет. В Атмосферы — нестабильность. В Облачности — открытость неба. Параметр можно назвать одним словом.`,
      hint:'Если параметр «гуляет» от полочки к полочке — Ясна построена по двум разным шкалам сразу.'},
    {id:'h_cycle',w:'КРИТ',
      q:`Переход 11→0 такой же естественный, как 0→1?`,
      info:`Цикл должен быть замкнут. Если последняя полочка (11) логично возвращается в первую (0) — замыкание работает. Если «рвётся» — возможно, неверно выбран 0 или 11.`,
      hint:'Если замыкание не работает — пересмотрите что у вас на 0 и 11.'},
    {id:'h_unique',w:'ВАЖ',
      q:`Ясна не дублирует ни одну из существующих?`,
      info:`Каждая верифицированная Ясна должна иметь уникальную предметную область. Если ваша Ясна повторяет Суток или Круговорот Воды другими словами — откажитесь от неё или найдите уникальный ракурс.`},
    {id:'h_refs',w:'ВАЖ',
      q:`Позиции 0, 3, 6, 9 согласованы с эталонами?`,
      info:`Во всех верифицированных Яснах на 0 — основа/минимум, на 3 — рождение, на 6 — вершина/максимум, на 9 — завершение. Проверьте что ваши опоры несут тот же структурный смысл. Откройте «+ ещё» и сверьте.`,
      hint:'Сверьтесь с Суток, Кухни, Дома, Круговорот Воды через меню «+ ещё».'},
    {id:'h_coherent',w:'ВАЖ',
      q:`При чтении всей Ясны возникает цельный образ явления?`,
      info:`После прочтения 12 полочек должна быть цельная картина. Если чувство разрозненности — что-то не собрано. Попробуйте прочитать вслух по кругу, тройки Ритма, дуги — где-то должно «зазвучать».`},
    {id:'h_explain',w:'ВАЖ',
      q:`Объясните не-эксперту за 3 минуты — поймёт?`,
      info:`Прагматический тест. Найдите человека, не знающего вашу тему. За 3 минуты расскажите про параметр, 4 опоры, 2 главные пары. Проверка: он может повторить суть своими словами?`,
      hint:'Если не получается — формулировки абстрактны или полюса слабые.'},
    {id:'h_immovable',w:'ЖЕЛ',
      q:`Нельзя поменять местами ни одну пару элементов без потери смысла?`,
      info:`Идеальная Ясна — та, где каждый элемент на единственно возможном месте. Попробуйте мысленно переставить пару — если становится «так же» или «лучше», один из двух стоял неверно.`},
  ];

  const allPosIds=Array.from({length:12},(_,i)=>posChecks(i)).flat();
  const posScore=scoreCount(allPosIds);
  const connScore=scoreCount(connChecks);
  const mechScore=scoreCount(mechChecks);
  const holiScore=scoreCount(holiChecks);

  const allChecks=[...allPosIds,...connChecks,...mechChecks,...holiChecks];
  const critChecks=allChecks.filter(c=>c.w==='КРИТ');
  const vazhChecks=allChecks.filter(c=>c.w==='ВАЖ');
  const zhelChecks=allChecks.filter(c=>c.w==='ЖЕЛ');
  const critS=scoreCount(critChecks);
  const vazhS=scoreCount(vazhChecks);
  const zhelS=scoreCount(zhelChecks);

  const critPct=critChecks.length>0?critS.pass/critChecks.length:0;
  const vazhPct=vazhChecks.length>0?vazhS.pass/vazhChecks.length:0;
  let status,statusColor,statusDesc;
  if(critS.failed>0||critPct<0.8){status='Не верифицирована';statusColor='#E8364F';statusDesc='Провалены критические пункты. Требует структурной правки.';}
  else if(critPct>=1&&vazhPct>=0.9){status='✦ Безупречно';statusColor='#30A060';statusDesc='Все критические и почти все важные пункты пройдены.';}
  else if(critPct>=1&&vazhPct>=0.7){status='✓ Верифицирована';statusColor='#30A060';statusDesc='Критические пройдены, большинство важных тоже.';}
  else if(critPct>=0.9){status='◇ С оговорками';statusColor='#E8A834';statusDesc='Критические почти все пройдены, есть замечания.';}
  else {status='Требует доработки';statusColor='#E8A834';statusDesc='Часть критических пунктов не пройдена.';}

  // Export to text report
  const exportReport=()=>{
    const lines=[];
    lines.push(`ВЕРИФИКАЦИЯ ЯСНЫ: ${y.name}`);
    lines.push(`Дата: ${new Date().toLocaleDateString('ru-RU')} ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`);
    lines.push(``);
    lines.push(`ИТОГ: ${status}`);
    lines.push(`${statusDesc}`);
    lines.push(`КРИТ: ${critS.pass}/${critChecks.length} пройдено${critS.failed>0?`, ${critS.failed} провалено`:''}`);
    lines.push(`ВАЖ:  ${vazhS.pass}/${vazhChecks.length} пройдено${vazhS.failed>0?`, ${vazhS.failed} провалено`:''}`);
    lines.push(`ЖЕЛ:  ${zhelS.pass}/${zhelChecks.length} пройдено`);
    lines.push(``);
    lines.push(`ЭЛЕМЕНТЫ ЯСНЫ:`);
    for(let i=0;i<12;i++)lines.push(`  ${i}: ${p[i]||'(не заполнено)'}`);
    lines.push(``);
    lines.push(`=== ПРОВАЛЕННЫЕ ПУНКТЫ ===`);
    let hasFailed=false;
    allChecks.forEach(c=>{if(get(c.id)===false){hasFailed=true;lines.push(`[${c.w||'ВАЖ'}] ✗ ${c.q}`);if(c.hint)lines.push(`    💡 ${c.hint}`);lines.push(``);}});
    if(!hasFailed)lines.push(`(нет проваленных пунктов)`);
    lines.push(``);
    lines.push(`=== НЕОТВЕЧЕННЫЕ ПУНКТЫ ===`);
    let hasUnanswered=false;
    allChecks.forEach(c=>{if(get(c.id)===undefined){hasUnanswered=true;lines.push(`[${c.w||'ВАЖ'}] ? ${c.q}`);}});
    if(!hasUnanswered)lines.push(`(все пункты отвечены)`);
    const report=lines.join('\n');
    if(navigator.clipboard){
      navigator.clipboard.writeText(report).then(()=>{
        setCopyFeedback('Скопировано в буфер');
        setTimeout(()=>setCopyFeedback(''),2000);
      }).catch(()=>{setCopyFeedback('Ошибка копирования');setTimeout(()=>setCopyFeedback(''),2000);});
    } else {
      setCopyFeedback('Буфер недоступен');
      setTimeout(()=>setCopyFeedback(''),2000);
    }
  };

  // Jump to next failed or unanswered check
  const jumpToNextIssue=()=>{
    const order=['pos','conn','mech','holi'];
    const groups={pos:allPosIds,conn:connChecks,mech:mechChecks,holi:holiChecks};
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

  const totalDone=critS.done+vazhS.done+zhelS.done;
  const totalCount=critChecks.length+vazhChecks.length+zhelChecks.length;
  const totalFailed=critS.failed+vazhS.failed+zhelS.failed;
  const progressPct=totalCount>0?Math.round(totalDone/totalCount*100):0;

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
            <div style={{fontSize:10,color:'#86868b',textTransform:'uppercase',letterSpacing:0.8,fontWeight:600,marginBottom:2}}>Верификация</div>
            <h2 style={{fontSize:18,fontWeight:700,color:'#1d1d1f',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{y.name}</h2>
          </div>
          <button onClick={onClose} style={{width:36,height:36,borderRadius:10,border:'1px solid #e5e5ea',background:'#fff',fontSize:16,color:'#424245',cursor:'pointer',flexShrink:0}}>✕</button>
        </div>
        <div className='fullpage-content' style={{flex:1,overflowY:'auto',padding:'24px 20px',maxWidth:680,margin:'0 auto',width:'100%'}}>
          <div style={{fontSize:24,fontWeight:700,color:'#1d1d1f',marginBottom:10,lineHeight:1.25}}>Проверим вашу Ясну по 4 уровням</div>
          <div style={{fontSize:14,color:'#6e6e73',lineHeight:1.6,marginBottom:16}}>
            Верификация подтверждает, что Ясна составлена по канонам метода и не противоречит другим верифицированным Яснам. Занимает ~20-30 минут при вдумчивом прохождении.
          </div>

          <button onClick={()=>setShowIntro(false)} style={{fontSize:13,color:'#0071e3',padding:'6px 0',border:'none',background:'transparent',cursor:'pointer',fontWeight:500,marginBottom:20,display:'inline-flex',alignItems:'center',gap:4}}>Пропустить инструкцию →</button>

          {hasEmpties&&<div style={{padding:'12px 14px',background:'#fff8e8',border:'1px solid #E8A83440',borderRadius:10,marginBottom:20,fontSize:13,color:'#424245',lineHeight:1.55}}>
            <div style={{fontWeight:700,color:'#c07800',marginBottom:4}}>⚠ Не заполнены: {emptyPos.join(', ')}</div>
            Сначала заполните все 12 позиций в Редакторе — без этого верификация неточна.
          </div>}

          <div style={{fontSize:13,fontWeight:700,color:'#1d1d1f',marginBottom:10,textTransform:'uppercase',letterSpacing:0.5}}>4 уровня, снизу вверх</div>

          <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
            <div style={{padding:'14px 16px',background:'#f5f5f7',borderRadius:12,borderLeft:'3px solid #0071e3'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'#0071e3'}}>1</span>
                <div style={{fontSize:15,fontWeight:600,color:'#1d1d1f'}}>Полочки ({allPosIds.length} проверок)</div>
              </div>
              <div style={{fontSize:13,color:'#6e6e73',lineHeight:1.55}}>Каждый элемент отдельно по 6–9 критериям: тип, стихия, крест, противоположность, соседство. Фундамент — сюда пойдёт больше всего времени.</div>
            </div>
            <div style={{padding:'14px 16px',background:'#f5f5f7',borderRadius:12,borderLeft:'3px solid #0071e3'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'#0071e3'}}>2</span>
                <div style={{fontSize:15,fontWeight:600,color:'#1d1d1f'}}>Связи ({connChecks.length} проверок)</div>
              </div>
              <div style={{fontSize:13,color:'#6e6e73',lineHeight:1.55}}>Как полочки работают в группе: 4 тройки Ритма (Вера→Бой→Победа), 3 Дуги Тепла, переходы нарастания и спада.</div>
            </div>
            <div style={{padding:'14px 16px',background:'#f5f5f7',borderRadius:12,borderLeft:'3px solid #0071e3'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'#0071e3'}}>3</span>
                <div style={{fontSize:15,fontWeight:600,color:'#1d1d1f'}}>Механики ({mechChecks.length} проверок)</div>
              </div>
              <div style={{fontSize:13,color:'#6e6e73',lineHeight:1.55}}>Структурные группы целиком: 4 Праны, 3 Креста, 2 Оси, Зоны, Системная ошибка 8↔9.</div>
            </div>
            <div style={{padding:'14px 16px',background:'#f5f5f7',borderRadius:12,borderLeft:'3px solid #0071e3'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:700,color:'#0071e3'}}>4</span>
                <div style={{fontSize:15,fontWeight:600,color:'#1d1d1f'}}>Цельность ({holiChecks.length} проверок)</div>
              </div>
              <div style={{fontSize:13,color:'#6e6e73',lineHeight:1.55}}>Ясна как система: замкнутость цикла, единый параметр, самостоятельность, согласованность с эталонами.</div>
            </div>
          </div>

          <div style={{fontSize:13,fontWeight:700,color:'#1d1d1f',marginBottom:10,textTransform:'uppercase',letterSpacing:0.5}}>Три приоритета ответов</div>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:24}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#fff5f5',borderRadius:8,border:'1px solid #E8364F20'}}>
              <span style={{fontSize:10,fontWeight:700,color:'#E8364F',padding:'2px 6px',border:'1px solid #E8364F40',borderRadius:4,flexShrink:0}}>КРИТ</span>
              <span style={{fontSize:13,color:'#424245'}}>Обязательно. Провал = Ясна не верифицируется.</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#fff8e8',borderRadius:8,border:'1px solid #E8A83420'}}>
              <span style={{fontSize:10,fontWeight:700,color:'#E8A834',padding:'2px 6px',border:'1px solid #E8A83440',borderRadius:4,flexShrink:0}}>ВАЖ</span>
              <span style={{fontSize:13,color:'#424245'}}>Влияет на итоговый статус (Безупречно / С оговорками).</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#f5f5f7',borderRadius:8,border:'1px solid #d2d2d7'}}>
              <span style={{fontSize:10,fontWeight:700,color:'#86868b',padding:'2px 6px',border:'1px solid #86868b40',borderRadius:4,flexShrink:0}}>ЖЕЛ</span>
              <span style={{fontSize:13,color:'#424245'}}>Бонус. На статус не влияет, но повышает качество.</span>
            </div>
          </div>

          <div style={{fontSize:13,fontWeight:700,color:'#1d1d1f',marginBottom:10,textTransform:'uppercase',letterSpacing:0.5}}>Советы</div>
          <ul style={{fontSize:13,color:'#424245',lineHeight:1.8,marginLeft:20,marginBottom:8}}>
            <li>На каждом вопросе есть <b style={{color:'#0071e3'}}>(i)</b> — разворачивает подробное пояснение с контекстом из книги.</li>
            <li>Если отвечаете <b style={{color:'#E8364F'}}>✗</b> — появится подсказка 💡 куда смотреть для исправления.</li>
            <li>Кнопка <b>«К следующему непройденному»</b> перепрыгнет к первому ✗ или неотвеченному пункту.</li>
            <li>Прогресс сохраняется автоматически. Можно вернуться позже.</li>
            <li>В конце можно экспортировать отчёт в буфер обмена.</li>
          </ul>
        </div>
        <div style={{padding:'14px 20px',borderTop:'1px solid #f0f0f2',background:'#fff',flexShrink:0,boxShadow:'0 -4px 16px rgba(0,0,0,.04)'}}>
          <div style={{maxWidth:680,margin:'0 auto',display:'flex',gap:10,justifyContent:'flex-end',flexWrap:'wrap'}}>
            <button onClick={onClose} style={{fontSize:14,padding:'10px 18px',borderRadius:10,border:'1px solid #e5e5ea',background:'#fff',color:'#424245',cursor:'pointer'}}>Отмена</button>
            <button onClick={()=>setShowIntro(false)} style={{fontSize:14,fontWeight:600,padding:'10px 20px',borderRadius:10,border:'1px solid #0071e3',background:'#0071e3',color:'#fff',cursor:'pointer',flex:'1 1 auto',minWidth:180}}>Начать проверку →</button>
          </div>
        </div>
      </div>);
  }



  return(
    <div style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'#fff',zIndex:70,display:'flex',flexDirection:'column'}}>
      {/* HEADER ROW 1 — title + close */}
      <div className="verif-header" style={{display:'flex',alignItems:'center',padding:'12px 20px',borderBottom:'1px solid #f0f0f2',flexShrink:0,gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:10,color:'#86868b',textTransform:'uppercase',letterSpacing:0.8,fontWeight:600,marginBottom:2}}>Верификация</div>
          <h2 className="verif-title" style={{fontSize:18,fontWeight:700,color:'#1d1d1f',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{y.name}</h2>
        </div>
        <button onClick={()=>setShowIntro(true)} className="verif-help" title="Показать инструкцию" style={{width:36,height:36,borderRadius:10,border:'1px solid #e5e5ea',background:'#fff',fontSize:15,color:'#424245',cursor:'pointer',flexShrink:0,fontFamily:'Georgia,serif',fontStyle:'italic',fontWeight:700}}>?</button>
        <button onClick={onClose} className="verif-close" style={{width:36,height:36,borderRadius:10,border:'1px solid #e5e5ea',background:'#fff',fontSize:16,color:'#424245',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
      </div>

      {/* HEADER ROW 2 — status + progress bar */}
      <div className="verif-sub" style={{padding:'8px 20px',borderBottom:'1px solid #f0f0f2',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap'}}>
          <span style={{fontSize:13,color:statusColor,fontWeight:600}}>{status}</span>
          <span style={{fontSize:11,color:'#86868b'}}>
            <span style={{color:'#E8364F'}}>КРИТ {critS.pass}/{critChecks.length}</span>
            {' · '}
            <span style={{color:'#c07800'}}>ВАЖ {vazhS.pass}/{vazhChecks.length}</span>
            {' · '}
            <span>ЖЕЛ {zhelS.pass}/{zhelChecks.length}</span>
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

      {/* HEADER ROW 3 — action buttons */}
      <div className="verif-actions-row" style={{padding:'6px 20px 8px',borderBottom:'1px solid #f0f0f2',flexShrink:0,display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
        {(totalFailed>0||totalDone<totalCount)&&<button onClick={jumpToNextIssue} style={{fontSize:11,color:'#0071e3',padding:'5px 10px',border:'1px solid #0071e320',borderRadius:7,background:'rgba(0,122,255,.06)',cursor:'pointer',fontWeight:500,display:'flex',alignItems:'center',gap:4}}>
          <span>→</span><span>К следующему</span>
        </button>}
        <button onClick={()=>setHidePassed(v=>!v)} style={{fontSize:11,color:hidePassed?'#0071e3':'#6e6e73',padding:'5px 10px',border:`1px solid ${hidePassed?'#0071e3':'#e5e5ea'}`,borderRadius:7,background:hidePassed?'rgba(0,122,255,.06)':'#fff',cursor:'pointer',fontWeight:500}}>{hidePassed?'Показать все':'Скрыть ✓'}</button>
        {totalDone>0&&<button onClick={exportReport} style={{fontSize:11,color:'#424245',padding:'5px 10px',border:'1px solid #e5e5ea',borderRadius:7,background:'#fff',cursor:'pointer',fontWeight:500}}>
          {copyFeedback||'📋 Отчёт'}
        </button>}
        <div style={{flex:1}}/>
        <button onClick={()=>{if(confirm('Сбросить все ответы для этой Ясны?')){const keys=Object.keys(vs).filter(k=>k.startsWith(y.name+'_'));const nv={...vs};keys.forEach(k=>delete nv[k]);setVs(nv);setShowIntro(true);}}} style={{fontSize:11,color:'#E8364F',padding:'5px 10px',border:'1px solid #E8364F30',borderRadius:7,background:'#fff',cursor:'pointer'}}>Сбросить</button>
      </div>

      {/* TABS */}
      <div style={{display:'flex',gap:4,padding:'8px 20px',borderBottom:'1px solid #f0f0f2',flexShrink:0,overflowX:'auto'}}>
        <TabBtn id="pos" label="1. Полочки" s={posScore}/>
        <TabBtn id="conn" label="2. Связи" s={connScore}/>
        <TabBtn id="mech" label="3. Механики" s={mechScore}/>
        <TabBtn id="holi" label="4. Цельность" s={holiScore}/>
      </div>

      <div className='fullpage-content' style={{flex:1,overflowY:'auto',padding:'16px 20px',maxWidth:820,margin:'0 auto',width:'100%'}}>

        {hasEmpties&&<div style={{padding:'10px 14px',background:'#fff8e8',border:'1px solid #E8A83440',borderRadius:10,marginBottom:14,fontSize:12,color:'#424245',lineHeight:1.55}}>
          <div style={{fontWeight:700,color:'#c07800',marginBottom:4}}>⚠ Не заполнены позиции: {emptyPos.join(', ')}</div>
          Верификация достоверна только на полной Ясне. Сначала заполните все 12 позиций в Редакторе.
        </div>}

        <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#f5f5f7',borderRadius:10,marginBottom:14,fontSize:11,color:'#6e6e73',flexWrap:'wrap'}}>
          <span style={{fontWeight:600,color:'#424245'}}>Как отвечать:</span>
          <span style={{display:'inline-flex',alignItems:'center',gap:4}}><span style={{width:16,height:16,borderRadius:4,border:'1.5px solid #30A060',background:'#30A06012',color:'#30A060',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>✓</span>верно</span>
          <span style={{display:'inline-flex',alignItems:'center',gap:4}}><span style={{width:16,height:16,borderRadius:4,border:'1.5px solid #E8364F',background:'#E8364F12',color:'#E8364F',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>✗</span>неверно</span>
          <span style={{display:'inline-flex',alignItems:'center',gap:4}}><span style={{width:16,height:16,borderRadius:4,border:'1.5px solid #86868b',background:'#86868b12',color:'#86868b',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700}}>—</span>n/a</span>
          <span style={{color:'#aeaeb2'}}>· нажмите <span style={{display:'inline-flex',width:14,height:14,borderRadius:'50%',border:'1px solid #c7c7cc',color:'#86868b',fontSize:9,alignItems:'center',justifyContent:'center',fontFamily:'Georgia,serif',fontStyle:'italic',fontWeight:700}}>i</span> для пояснения</span>
        </div>

        {tab==='pos'&&<>
          <div style={{fontSize:12,color:'#6e6e73',marginBottom:12,lineHeight:1.55,padding:'9px 12px',background:'#f0f5ff',borderRadius:8}}>
            <b style={{color:'#0071e3'}}>Уровень 1 — Полочки.</b> Каждый из 12 элементов проверяется отдельно. Это фундамент — если ошибка здесь, выше только разрастётся.
          </div>
          {Array.from({length:12},(_,i)=>{
            const checks=posChecks(i);const s=scoreCount(checks);
            const allDone=s.done===s.total;const allPass=s.pass===s.total;
            if(hidePassed&&allPass&&allDone)return null;
            const cr=CR[gc(i)];
            return(
              <div key={i} style={{marginBottom:10,border:'1px solid #e5e5ea',borderRadius:12,overflow:'hidden'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:allPass&&allDone?'#f0fff5':s.failed>0?'#fff5f5':'#fafafa'}}>
                  <div style={{width:28,height:28,borderRadius:'50%',border:`2px solid ${cr.c}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:cr.c,flexShrink:0}}>{i}</div>
                  <div style={{flex:1,fontSize:14,fontWeight:600,color:'#1d1d1f',minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p[i]||<span style={{color:'#aeaeb2',fontStyle:'italic'}}>Не заполнено</span>}</div>
                  <div style={{fontSize:11,color:allPass?'#30A060':s.failed>0?'#E8364F':'#86868b',fontWeight:600,flexShrink:0}}>{s.pass}/{s.total}</div>
                </div>
                <div style={{padding:'4px 14px 8px'}}>
                  {checks.map(c=><Check key={c.id} id={c.id} weight={c.w} q={c.q} info={c.info} hint={c.hint}/>)}
                </div>
              </div>);
          })}
        </>}

        {tab==='conn'&&<>
          <div style={{fontSize:12,color:'#6e6e73',marginBottom:12,lineHeight:1.55,padding:'9px 12px',background:'#f0f5ff',borderRadius:8}}>
            <b style={{color:'#0071e3'}}>Уровень 2 — Связи.</b> Как полочки работают в группе: соседство, тройки Ритма, Дуги Тепла, переходы.
          </div>
          {['Тройки Ритма','Дуги Тепла','Переходы','Внутри крестов'].map(g=>{
            const groupChecks=connChecks.filter(c=>c.g===g);
            const s=scoreCount(groupChecks);
            const visibleCount=hidePassed?groupChecks.filter(c=>get(c.id)!==true).length:groupChecks.length;
            if(visibleCount===0)return null;
            return(
              <div key={g} style={{marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,paddingLeft:4}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#424245',textTransform:'uppercase',letterSpacing:0.5}}>{g}</div>
                  <div style={{fontSize:11,color:'#86868b'}}>{s.pass}/{s.total}</div>
                </div>
                <div style={{border:'1px solid #e5e5ea',borderRadius:10,padding:'4px 14px'}}>
                  {groupChecks.map(c=><Check key={c.id} id={c.id} weight={c.w} q={c.q} info={c.info} hint={c.hint}/>)}
                </div>
              </div>);
          })}
        </>}

        {tab==='mech'&&<>
          <div style={{fontSize:12,color:'#6e6e73',marginBottom:12,lineHeight:1.55,padding:'9px 12px',background:'#f0f5ff',borderRadius:8}}>
            <b style={{color:'#0071e3'}}>Уровень 3 — Механики.</b> Структурные группы: Типы, Праны, Кресты, Оси, Зоны, Системная ошибка.
          </div>
          {['Типы','Праны','Кресты','Оси','Противоположности','Зоны','Системная ошибка'].map(g=>{
            const groupChecks=mechChecks.filter(c=>c.g===g);
            if(groupChecks.length===0)return null;
            const s=scoreCount(groupChecks);
            const visibleCount=hidePassed?groupChecks.filter(c=>get(c.id)!==true).length:groupChecks.length;
            if(visibleCount===0)return null;
            return(
              <div key={g} style={{marginBottom:14}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,paddingLeft:4}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#424245',textTransform:'uppercase',letterSpacing:0.5}}>{g}</div>
                  <div style={{fontSize:11,color:'#86868b'}}>{s.pass}/{s.total}</div>
                </div>
                <div style={{border:'1px solid #e5e5ea',borderRadius:10,padding:'4px 14px'}}>
                  {groupChecks.map(c=><Check key={c.id} id={c.id} weight={c.w} q={c.q} info={c.info} hint={c.hint}/>)}
                </div>
              </div>);
          })}
        </>}

        {tab==='holi'&&<>
          <div style={{fontSize:12,color:'#6e6e73',marginBottom:12,lineHeight:1.55,padding:'9px 12px',background:'#f0f5ff',borderRadius:8}}>
            <b style={{color:'#0071e3'}}>Уровень 4 — Цельность.</b> Ясна как единая система. Финальная проверка перед присвоением статуса.
          </div>
          <div style={{border:'1px solid #e5e5ea',borderRadius:10,padding:'4px 14px',marginBottom:14}}>
            {holiChecks.map(c=><Check key={c.id} id={c.id} weight={c.w} q={c.q} info={c.info} hint={c.hint}/>)}
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


// Expose to global namespace for lessons + app to use
window.YasnaCore = {
  CR, PR, REF, T, FL,
  Star, Info, OverlayLegend, Editor, OverlayPicker, Picker, Verification,
  POS_DESC, CROSS_CTX, PRANA_CTX, OPP_DESC, GLOSS
};
