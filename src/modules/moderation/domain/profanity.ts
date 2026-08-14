/**
 * Фильтр недопустимых слов для имён, ников и названий.
 *
 * Три списка вместо одного — потому что риски разные:
 * — корни мата ищутся подстрокой: обойти их пробелами и точками нельзя,
 *   а ложные срабатывания у них редки;
 * — оскорбления по национальности и религиозные имена ищутся по словам:
 *   подстрокой «хач» поймала бы Махачкалу, а «жид» — жидкость;
 * — самые скользкие слова сверяются с целым словом целиком.
 *
 * Домен ничего не знает про Zod и React: на вход строка, на выход ответ.
 */

/**
 * Латиница и цифры, которыми обычно маскируют кириллицу.
 * «ё» сводим к «е»: иначе «хуёвый» проходил бы мимо корня «хуе».
 */
const TO_CYRILLIC: Record<string, string> = {
  ё: 'е',
  a: 'а',
  b: 'в',
  c: 'с',
  e: 'е',
  h: 'н',
  k: 'к',
  m: 'м',
  o: 'о',
  p: 'р',
  t: 'т',
  x: 'х',
  y: 'у',
  '0': 'о',
  '1': 'и',
  '3': 'з',
  '4': 'ч',
  '6': 'б',
  '9': 'я',
  '@': 'а',
  $: 'с',
};

/** Кириллица и цифры, которыми маскируют латиницу. */
const TO_LATIN: Record<string, string> = {
  а: 'a',
  в: 'b',
  с: 'c',
  е: 'e',
  к: 'k',
  м: 'm',
  н: 'h',
  о: 'o',
  р: 'p',
  т: 't',
  у: 'y',
  х: 'x',
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '@': 'a',
  $: 's',
};

/** Корни мата: ищутся подстрокой в склеенном тексте. */
const CYRILLIC_ROOTS = [
  'хуй',
  'хуе',
  'хуя',
  'хуи',
  'хую',
  'пизд',
  'ебал',
  'ебан',
  'ебат',
  'ебуч',
  'ебло',
  'ебли',
  'ебну',
  'бляд',
  'блят',
  'мудак',
  'мудил',
  'пидор',
  'пидар',
  'педик',
  'залуп',
  'дроч',
  'шлюх',
  'гондон',
  'гандон',
  'говн',
  'жоп',
  'срак',
] as const;

/** То же самое латиницей — и мат по-английски, и транслит русского. */
const LATIN_ROOTS = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'whore',
  'nigger',
  'asshole',
  'faggot',
  'blyat',
  'blyad',
  'pizdec',
  'pizda',
  'mudak',
  'pidor',
  'huesos',
] as const;

/**
 * Слова, недопустимые в начале слова: оскорбления по национальности,
 * религиозные имена, экстремистские отсылки.
 */
const WORD_PREFIXES = [
  'негр',
  'ниггер',
  'чурк',
  'чурбан',
  'узкоглаз',
  'хохол',
  'кацап',
  'москал',
  'жидяр',
  'нацист',
  'нацизм',
  'фашист',
  'гитлер',
  'иисус',
  'христос',
  'аллах',
  'мухаммад',
  'мухаммед',
  'магомет',
  'пророк',
  'будда',
  'яхве',
  'кришна',
  'jesus',
  'christ',
  'allah',
  'muhammad',
  'mohammed',
  'buddha',
  'krishna',
  'prophet',
  'hitler',
  'nazi',
] as const;

/** Слова, которые ловим только целиком: рядом живут безобидные соседи. */
const EXACT_WORDS = [
  'жид',
  'жиды',
  'жидов',
  'жиду',
  'хач',
  'хачи',
  'хача',
  'сука',
  'суки',
  'сукин',
  'даун',
  'дауны',
  'дебил',
  'kike',
] as const;

function mapChars(text: string, table: Record<string, string>): string {
  let out = '';
  for (const char of text) out += table[char] ?? char;
  return out;
}

/** Только буквы нужного алфавита: пробелы, точки и подчёркивания не спасают. */
function keepLetters(text: string, pattern: RegExp): string {
  return text
    .split('')
    .filter((char) => pattern.test(char))
    .join('');
}

/** «хуууй» → «хуй»: растянутые буквы тоже не маскировка. */
function collapseRuns(text: string): string {
  let out = '';
  for (const char of text) {
    if (out.at(-1) !== char) out += char;
  }
  return out;
}

/** Слова текста в нижнем регистре; разделителем считается всё, кроме букв. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((word) => word !== '');
}

/**
 * Нашлось недопустимое слово? Возвращает найденный корень —
 * он удобен в тестах и логах, наружу пользователю не показывается.
 */
export function findForbidden(text: string): string | null {
  const lower = text.toLowerCase();

  const cyrillic = keepLetters(mapChars(lower, TO_CYRILLIC), /[а-яё]/);
  const latin = keepLetters(mapChars(lower, TO_LATIN), /[a-z]/);
  const cyrillicRuns = collapseRuns(cyrillic);
  const latinRuns = collapseRuns(latin);

  for (const root of CYRILLIC_ROOTS) {
    if (cyrillic.includes(root) || cyrillicRuns.includes(root)) return root;
  }
  for (const root of LATIN_ROOTS) {
    if (latin.includes(root) || latinRuns.includes(root)) return root;
  }

  for (const word of words(lower)) {
    const collapsed = collapseRuns(word);
    for (const prefix of WORD_PREFIXES) {
      if (word.startsWith(prefix) || collapsed.startsWith(prefix)) return prefix;
    }
    for (const exact of EXACT_WORDS) {
      if (word === exact || collapsed === exact) return exact;
    }
  }

  return null;
}

/** Текст можно показывать другим людям. */
export function isClean(text: string): boolean {
  return findForbidden(text) === null;
}
