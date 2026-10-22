import type { FinancingKind, Purchase, PurchaseCategory } from '@/api/types';

export type TermChoice = '3' | '6' | '12' | '24' | 'other';
export const TERMS: TermChoice[] = ['3', '6', '12', '24', 'other'];
export const KINDS: FinancingKind[] = ['credit', 'installment', 'microloan', 'credit_card', 'own'];
export const QUICK: Array<Exclude<PurchaseCategory, 'laptop'>> = ['smartphone', 'appliances', 'furniture', 'car', 'other'];

/** What the user typed on «Проверить решение». `monthly === null` → qorgan calculates the payment. */
export interface CheckForm {
  title: string;
  category: PurchaseCategory | null;
  price: number | null;
  kind: FinancingKind;
  down: number;
  term: TermChoice;
  customTerm: string;
  monthly: number | null;
  fees: number;
}

export const EMPTY_FORM: CheckForm = {
  title: '',
  category: null,
  price: null,
  kind: 'installment',
  down: 0,
  term: '12',
  customTerm: '',
  monthly: null,
  fees: 0,
};

export function termMonths(f: CheckForm): number | null {
  if (f.term !== 'other') return Number(f.term);
  const n = Number(f.customTerm.trim());
  return Number.isInteger(n) && n >= 1 && n <= 360 ? n : null;
}

export type FieldError = 'price' | 'down' | 'term';

export function validate(f: CheckForm): FieldError[] {
  const errors: FieldError[] = [];
  if (!f.price || f.price <= 0) errors.push('price');
  if (f.kind !== 'own') {
    if (f.price && f.down >= f.price) errors.push('down');
    if (termMonths(f) === null) errors.push('term');
  }
  return errors;
}

/** The body for /checks and /checks/preview; null while the form can't be calculated yet. */
export function toPurchase(f: CheckForm, fallbackTitle: string): Purchase | null {
  const term = termMonths(f);
  if (!f.price || f.price <= 0 || (f.kind !== 'own' && term === null)) return null;
  const own = f.kind === 'own';
  return {
    title: f.title.trim() || fallbackTitle,
    category: f.category ?? 'other',
    price: f.price,
    kind: f.kind,
    down_payment: own ? 0 : Math.min(f.down, f.price),
    term_months: term ?? 12,
    monthly_payment: own ? null : f.monthly,
    fees: f.fees,
  };
}

export function fromPurchase(p: Purchase): CheckForm {
  const preset = TERMS.includes(String(p.term_months) as TermChoice) && p.term_months !== 0;
  return {
    title: p.title,
    category: p.category,
    price: p.price,
    kind: p.kind,
    down: p.down_payment,
    term: preset ? (String(p.term_months) as TermChoice) : 'other',
    customTerm: preset ? '' : String(p.term_months),
    monthly: p.monthly_payment,
    fees: p.fees,
  };
}

/** "Смартфон" → "смартфон", but keeps "iPhone", "LG …" as typed. */
export function lowerFirst(s: string): string {
  if (s.length < 2 || s[1] !== s[1].toLowerCase()) return s;
  return s[0].toLowerCase() + s.slice(1);
}

export function isFormState(x: unknown): x is CheckForm {
  return !!x && typeof x === 'object' && 'kind' in x && 'term' in x && 'price' in x;
}
