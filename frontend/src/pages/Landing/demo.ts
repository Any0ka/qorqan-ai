/**
 * Illustrative numbers for the landing previews («Пример интерфейса · данные условные»).
 * Not user data: derived the same way the backend derives them, so every card stays consistent.
 */
const split = [
  { key: 'auto', monthly: 58_000 },
  { key: 'loan', monthly: 52_000 },
  { key: 'micro', monthly: 45_000 },
  { key: 'installment', monthly: 35_000 },
  { key: 'card', monthly: 20_000 },
] as const;

export type SplitKey = (typeof split)[number]['key'];

const income = 450_000;
const expenses = 175_000;
const payments = split.reduce((sum, s) => sum + s.monthly, 0);
const price = 840_000;
const term = 12;
const newPayment = price / term;
const microloan = split.find((s) => s.key === 'micro')!.monthly;

export const DEMO = {
  income,
  expenses,
  payments,
  price,
  term,
  newPayment,
  paymentsAfter: payments + newPayment,
  load: payments / income,
  loadAfter: (payments + newPayment) / income,
  free: income - expenses - payments,
  freeAfter: income - expenses - payments - newPayment,
  totalDebt: 3_450_000,
  /** The safer path: close the microloan first, buy a simpler model later without a new debt. */
  saferInMonths: 9,
  saferLoad: (payments - microloan) / income,
  /** Step 1 mock rows: «Банк A · кредит», «Банк B · рассрочка», «МФО C · микрокредит». */
  stepCredits: [52_000, 35_000, 45_000] as const,
  split,
  /** Bar length of the payment split is monthly ÷ this. */
  splitScale: 100_000,
};
