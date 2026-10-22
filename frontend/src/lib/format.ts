import type { Lang } from '@/i18n/I18nProvider';

export const NBSP = ' ';
export const MINUS = '−';

/** 3450000 → "3 450 000" (non-breaking spaces, as the design system requires). */
export function num(n: number): string {
  const v = Math.round(Math.abs(n));
  return (n < 0 && v !== 0 ? MINUS : '') + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** 3450000 → "3 450 000 ₸"; -5000 → "−5 000 ₸". `signed` adds "+" to positives. */
export function money(n: number, opts: { signed?: boolean } = {}): string {
  const sign = opts.signed && n > 0 ? '+' : '';
  return `${sign}${num(n)}${NBSP}₸`;
}

/** 0.4667 → "47%". */
export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** Whole percentage points: 0.62, 0.47 → 15. */
export function pointsDiff(a: number, b: number): number {
  return Math.round(a * 100) - Math.round(b * 100);
}

/** 3450000 → "3,45 млн" / "3,45 млн" (kk uses the same abbreviation). */
export function millions(n: number, lang: Lang, digits = 2): string {
  const v = (n / 1_000_000).toFixed(digits).replace('.', ',');
  return `${v}${NBSP}${lang === 'kk' ? 'млн' : 'млн'}`;
}

/** 525000 → "525 тыс." / "525 мың". */
export function thousands(n: number, lang: Lang): string {
  return `${num(Math.round(n / 1000))}${NBSP}${lang === 'kk' ? 'мың' : 'тыс.'}`;
}

/** Parse what the user typed into a money field. Returns null when it holds anything but digits/spaces. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[\s  ₸]/g, '');
  if (cleaned === '') return 0;
  if (!/^\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

// ------------------------------------------------------------------ dates

const MONTHS = {
  ru: {
    gen: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    nom: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
    short: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    prep: ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'],
    /** "с мая" */
    abl: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    /** "в июле" (used attributively) */
    attr: ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'],
    /** "к декабрю" */
    dat: ['январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню', 'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю'],
  },
  kk: {
    gen: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
    nom: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
    short: ['қаң', 'ақп', 'нау', 'сәу', 'мам', 'мау', 'шіл', 'там', 'қыр', 'қаз', 'қар', 'жел'],
    prep: ['қаңтарда', 'ақпанда', 'наурызда', 'сәуірде', 'мамырда', 'маусымда', 'шілдеде', 'тамызда', 'қыркүйекте', 'қазанда', 'қарашада', 'желтоқсанда'],
    /** "мамырдан бері" */
    abl: ['қаңтардан', 'ақпаннан', 'наурыздан', 'сәуірден', 'мамырдан', 'маусымнан', 'шілдеден', 'тамыздан', 'қыркүйектен', 'қазаннан', 'қарашадан', 'желтоқсаннан'],
    /** "шілдедегі" */
    attr: ['қаңтардағы', 'ақпандағы', 'наурыздағы', 'сәуірдегі', 'мамырдағы', 'маусымдағы', 'шілдедегі', 'тамыздағы', 'қыркүйектегі', 'қазандағы', 'қарашадағы', 'желтоқсандағы'],
    /** "желтоқсанға дейін" */
    dat: ['қаңтарға', 'ақпанға', 'наурызға', 'сәуірге', 'мамырға', 'маусымға', 'шілдеге', 'тамызға', 'қыркүйекке', 'қазанға', 'қарашаға', 'желтоқсанға'],
  },
} as const;

/** Accepts "2026-10-21", "2026-10-21T12:00:00" or a Date. Date-only strings are read as local dates. */
export function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

export type MonthForm = 'gen' | 'nom' | 'short' | 'prep' | 'abl' | 'attr' | 'dat';

/** Month name in a grammatical form: nom «май/мамыр», gen «мая», prep «мае/мамырда»,
 * abl «(с) мая / мамырдан», attr «(в) мае / мамырдағы», dat «(к) маю / мамырға», short «май/мам». */
export function monthName(value: string | Date, lang: Lang, form: MonthForm = 'nom'): string {
  return MONTHS[lang][form][toDate(value).getMonth()];
}

/** "20 октября" / "20 қазан". */
export function dayMonth(value: string | Date, lang: Lang): string {
  const d = toDate(value);
  return `${d.getDate()}${NBSP}${MONTHS[lang].gen[d.getMonth()]}`;
}

/** "когда?": "15 октября" / "15 қазанда" (Kazakh needs the locative case). */
export function dayMonthWhen(value: string | Date, lang: Lang): string {
  const d = toDate(value);
  return `${d.getDate()}${NBSP}${MONTHS[lang][lang === 'kk' ? 'prep' : 'gen'][d.getMonth()]}`;
}

/** "20 окт" / "20 қаз". */
export function dayMonthShort(value: string | Date, lang: Lang): string {
  const d = toDate(value);
  return `${d.getDate()}${NBSP}${MONTHS[lang].short[d.getMonth()]}`;
}

/** "14 октября 2026" / "2026 жылғы 14 қазан". */
export function fullDate(value: string | Date, lang: Lang): string {
  const d = toDate(value);
  return lang === 'kk'
    ? `${d.getFullYear()} жылғы ${d.getDate()} ${MONTHS.kk.gen[d.getMonth()]}`
    : `${d.getDate()} ${MONTHS.ru.gen[d.getMonth()]} ${d.getFullYear()}`;
}

/** "май 2026" / "2026 мамыр". */
export function monthYear(value: string | Date, lang: Lang): string {
  const d = toDate(value);
  return lang === 'kk' ? `${d.getFullYear()} ${MONTHS.kk.nom[d.getMonth()]}` : `${MONTHS.ru.nom[d.getMonth()]} ${d.getFullYear()}`;
}

/** "14.10.2026". */
export function numericDate(value: string | Date): string {
  const d = toDate(value);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

/** "09:00". */
export function time(value: string | Date): string {
  const d = toDate(value);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

// ------------------------------------------------------------------ plurals

/** Russian plural: plural(3, ['день', 'дня', 'дней']) → 'дня'. */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const n100 = Math.abs(n) % 100;
  const n10 = n100 % 10;
  if (n100 > 10 && n100 < 20) return forms[2];
  if (n10 === 1) return forms[0];
  if (n10 >= 2 && n10 <= 4) return forms[1];
  return forms[2];
}
