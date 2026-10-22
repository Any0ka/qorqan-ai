import type { AppNotification, CreditType, NotificationCategory } from '@/api/types';
import type { IconName } from '@/components/Icon';
import type { CommonStrings } from '@/i18n/common';
import type { Lang } from '@/i18n/I18nProvider';
import { dayMonth, money, monthName, percent, toDate } from '@/lib/format';
import type { NotificationStrings } from './i18n';

export type TileTone = 'warning' | 'navy' | 'teal' | 'danger' | 'success';

const BY_CODE: Record<string, { icon: IconName; tone: TileTone }> = {
  payment_due_soon: { icon: 'clock', tone: 'warning' },
  payments_higher_next_month: { icon: 'calendar', tone: 'navy' },
  plan_recommendation_new: { icon: 'sparkle', tone: 'teal' },
  load_high_streak: { icon: 'octagon', tone: 'danger' },
  confirm_irregular_income: { icon: 'refresh', tone: 'navy' },
  goal_progress: { icon: 'target', tone: 'success' },
  report_processed: { icon: 'file', tone: 'navy' },
};

const BY_CATEGORY: Record<NotificationCategory, { icon: IconName; tone: TileTone }> = {
  payment: { icon: 'calendar', tone: 'navy' },
  load: { icon: 'gauge', tone: 'navy' },
  data: { icon: 'refresh', tone: 'navy' },
  goal: { icon: 'target', tone: 'success' },
  recommendation: { icon: 'sparkle', tone: 'teal' },
};

export const visual = (n: AppNotification) => BY_CODE[n.code] ?? BY_CATEGORY[n.category] ?? { icon: 'bell' as IconName, tone: 'navy' as TileTone };

const isType = (v: unknown): v is CreditType =>
  typeof v === 'string' && ['cash_loan', 'installment', 'microloan', 'credit_card', 'auto_loan', 'mortgage', 'other'].includes(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const date = (v: unknown, lang: Lang) => (str(v) && !Number.isNaN(toDate(v as string).getTime()) ? dayMonth(v as string, lang) : null);
const month = (v: unknown, lang: Lang, form: 'prep' | 'dat' | 'abl' | 'nom') =>
  str(v) && !Number.isNaN(toDate(v as string).getTime()) ? monthName(v as string, lang, form) : null;

/** Title and body of a notification in the current language. Unknown codes fall back to the category name. */
export function renderNotification(n: AppNotification, t: NotificationStrings, c: CommonStrings, lang: Lang): { title: string; body: string | null } {
  const p = n.params ?? {};
  switch (n.code) {
    case 'payment_due_soon': {
      const days = num(p.days);
      const type = isType(p.credit_type) ? p.credit_type : 'other';
      const when = days !== null ? c.inDays(days) : date(p.date, lang) ?? '';
      return {
        title: t.paymentDue.title(when, t.typeDat[type]),
        body: str(p.organization) && num(p.amount) !== null ? t.paymentDue.body(p.organization, money(p.amount), date(p.date, lang) ?? '') : null,
      };
    }
    case 'payments_higher_next_month': {
      const created = toDate(n.created_at);
      const next = new Date(created.getFullYear(), created.getMonth() + 1, 1);
      const [extra, total, usual] = [num(p.extra), num(p.total), num(p.usual)];
      const body =
        extra !== null && total !== null && usual !== null
          ? (p.reason === 'auto_insurance' ? t.paymentsHigher.bodyInsurance : t.paymentsHigher.body)(money(extra), money(total), money(usual))
          : null;
      return { title: t.paymentsHigher.title(monthName(next, lang, 'prep')), body };
    }
    case 'plan_recommendation_new': {
      const [amount, until, from] = [num(p.amount), month(p.until, lang, 'dat'), month(p.from, lang, 'abl')];
      const type = isType(p.credit_type) ? p.credit_type : 'credit_card';
      return {
        title: t.planReco.title,
        body: amount !== null && until && from ? t.planReco.body(c.creditTypeAcc[type], until, money(amount), from) : t.planReco.bodyGeneric,
      };
    }
    case 'load_high_streak': {
      const load = num(p.load);
      return { title: t.loadStreak.title(num(p.months) ?? 0), body: load !== null ? t.loadStreak.body(percent(load)) : null };
    }
    case 'confirm_irregular_income':
      return {
        title: t.irregularIncome.title(str(p.source) ?? '—'),
        body: t.irregularIncome.body(monthName(n.created_at, lang, 'nom')),
      };
    case 'goal_progress': {
      const [done, total] = [num(p.done) ?? 0, num(p.total) ?? 0];
      const org = str(p.organization) ?? '';
      // Older records carry no credit type; microfinance organisations are the only microloan lenders.
      const type = isType(p.credit_type) ? p.credit_type : /^(МФО|МҚҰ)/i.test(org) ? 'microloan' : null;
      const title = p.goal === 'close_credit' ? t.goal.closeTitle(type ? c.creditTypeAcc[type] : null, org, done, total) : t.goal.title(done, total);
      const left = Math.max(total - done, 0);
      const body = total ? (left === 0 ? t.goal.done : t.goal.body(t.goal.left(left), date(p.last_date, lang))) : null;
      return { title, body };
    }
    case 'report_processed': {
      const [found, manual] = [num(p.found) ?? 0, num(p.manual) ?? 0];
      return { title: t.report.title, body: [t.report.found(found), manual > 0 ? t.report.manual(manual) : ''].filter(Boolean).join(' ') };
    }
    default:
      return { title: `${t.fallbackTitle} · ${t.tabs[n.category] ?? ''}`.replace(/ · $/, ''), body: null };
  }
}
