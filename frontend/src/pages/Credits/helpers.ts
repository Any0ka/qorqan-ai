import { useCallback, useEffect, useRef, useState } from 'react';
import type { Credit, CreditType } from '@/api/types';
import type { Lang } from '@/i18n/I18nProvider';
import { dayMonth, daysBetween, fullDate, monthName, NBSP, toDate } from '@/lib/format';
import type { FilterGroup } from './i18n';

export const GROUPS: Record<Exclude<FilterGroup, 'all'>, CreditType[]> = {
  loan: ['cash_loan', 'auto_loan', 'mortgage', 'other'],
  installment: ['installment'],
  microloan: ['microloan'],
  credit_card: ['credit_card'],
};

export const CREDIT_TYPES: CreditType[] = ['cash_loan', 'installment', 'microloan', 'credit_card', 'auto_loan', 'mortgage', 'other'];

/** Russian status words agree with the type: «Активен» (кредит) / «Активна» (рассрочка). */
export const FEMININE: Record<CreditType, boolean> = {
  cash_loan: false,
  installment: true,
  microloan: false,
  credit_card: true,
  auto_loan: false,
  mortgage: true,
  other: false,
};

export function inGroup(c: Credit, g: FilterGroup) {
  return g === 'all' || GROUPS[g].includes(c.type);
}

export function today() {
  return new Date();
}

export function daysAgo(value: string) {
  return Math.max(daysBetween(toDate(value), today()), 0);
}

const KK_FORM = { nom: 'gen', attr: 'attr', loc: 'prep', dat: 'dat' } as const;

/** «20 декабря» (with the year when it is not the current one). Kazakh takes the case the phrase needs:
 * attr «14 қазандағы есеп», loc «14 қазанда жүктелген», dat «21 желтоқсанға дейін». */
export function dateIn(value: string, lang: Lang, form: keyof typeof KK_FORM = 'nom', withYear?: boolean) {
  const d = toDate(value);
  const year = withYear ?? d.getFullYear() !== today().getFullYear();
  if (lang === 'ru') return year ? fullDate(value, 'ru') : dayMonth(value, 'ru');
  return `${year ? `${d.getFullYear()} жылғы ` : ''}${d.getDate()}${NBSP}${monthName(value, 'kk', KK_FORM[form])}`;
}

/** «28.08». */
export function shortNumeric(value: string) {
  const d = toDate(value);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Keeps a callback's identity stable (the shared Dialog re-runs its focus effect when `onClose` changes). */
export function useStableCallback<A extends unknown[]>(fn: (...args: A) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}
