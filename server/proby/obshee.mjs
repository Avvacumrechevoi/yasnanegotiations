/* Общее для проб ленты: где лежат страницы площадок и как их читать.

   По умолчанию — синтетические страницы из репозитория (server/proby/stranicy,
   собираются server/proby/stranicy/sozdat.mjs): настоящая разметка Телеграма,
   выдуманные тексты, свои JPEG. Поэтому пробы идут в чистом окружении и в CI,
   без сети и без чужих файлов.

   Переменная LENTA_STRANICY оставлена как возможность прогнать те же проверки
   на живых страницах, сохранённых с площадок:
       LENTA_STRANICY=~/lenta node server/proby/proba-razbor.mjs
   Имена файлов там могут отличаться, поэтому картинки ищутся первым
   подходящим именем (см. первыйФайл). */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ЗДЕСЬ = dirname(fileURLToPath(import.meta.url));

/* Синтетические страницы, которые лежат в репозитории. */
export const СВОИ_СТРАНИЦЫ = join(ЗДЕСЬ, 'stranicy');
/* Каталог, из которого проба читает страницы на этом прогоне. */
export const СТРАНИЦЫ = process.env.LENTA_STRANICY ? resolve(process.env.LENTA_STRANICY) : СВОИ_СТРАНИЦЫ;
/* Прогон на своих страницах: только тогда имеет смысл сверять поломанные
   варианты с файлами — у чужого каталога их нет. */
export const своиСтраницы = СТРАНИЦЫ === СВОИ_СТРАНИЦЫ;

export const есть = (имя) => existsSync(join(СТРАНИЦЫ, имя));
export const файл = (имя) => readFileSync(join(СТРАНИЦЫ, имя));
export const страница = (имя) => файл(имя).toString('utf8');

/* Первое из имён, которое нашлось: свои картинки называются иначе, чем
   сохранённые в разведке. */
export function первыйФайл(...имена) {
  for (const имя of имена) if (есть(имя)) return файл(имя);
  throw new Error('нет ни одного из файлов ' + имена.join(', ') + ' в ' + СТРАНИЦЫ);
}

/* Проверка перед началом: без страниц проба не имеет смысла. Выход 2 —
   «нечего проверять», отдельно от 1 («проверки провалились»). */
export function нуженКаталог(...обязательные) {
  const нет = обязательные.filter((имя) => !есть(имя));
  if (!нет.length) return;
  console.error('в каталоге страниц ' + СТРАНИЦЫ + ' не хватает: ' + нет.join(', '));
  console.error(своиСтраницы
    ? 'собери их: node server/proby/stranicy/sozdat.mjs'
    : 'сними LENTA_STRANICY, чтобы взять синтетические страницы из репозитория');
  process.exit(2);
}
