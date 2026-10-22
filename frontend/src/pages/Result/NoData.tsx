import { Link } from 'react-router-dom';
import type { Assessment, Financial } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Button, RiskBadge } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { money, percent } from '@/lib/format';
import { Rich } from '@/pages/Check/Rich';
import { dict } from './i18n';
import { termOf } from './Parts';
import styles from './Result.module.css';

interface Item {
  key: string;
  title: string;
  text: string;
  done: boolean;
  links?: Array<{ label: string; to: string }>;
}

/** INSUFFICIENT (Result-NoData): no risk level, what is missing and what we can already say. */
export function NoDataResult({ a, financial }: { a: Assessment; financial?: Financial }) {
  const t = useT(dict);
  const N = t.noData;
  const has = (k: 'income' | 'expenses' | 'credits') => !a.missing.includes(k);
  const term = termOf(a);
  const share = a.reasons.find((r) => r.code === 'new_payment_share');
  const rest = a.missing.filter((m): m is 'expenses' | 'credits' => m !== 'income');

  const items: Item[] = [
    {
      key: 'income',
      title: N.income,
      done: has('income'),
      text: has('income') ? N.incomeSet(financial ? money(financial.income_total) : null) : N.incomeMissing,
      links: [{ label: N.addIncome, to: '/onboarding' }],
    },
    {
      key: 'expenses',
      title: N.expenses,
      done: has('expenses'),
      text: has('expenses') ? N.expensesSet(financial ? money(financial.expenses_total) : null) : N.expensesMissing,
      links: [{ label: N.addExpenses, to: '/onboarding' }],
    },
    {
      key: 'credits',
      title: N.credits,
      done: has('credits'),
      text: has('credits') ? N.creditsSet(financial?.credits_count ?? 0) : N.creditsMissing,
      links: [
        { label: N.upload, to: '/onboarding' },
        { label: N.manual, to: '/onboarding' },
      ],
    },
    { key: 'purchase', title: N.purchase, done: true, text: N.purchaseValue(a.purchase.title, money(a.purchase.price), term) },
  ];

  return (
    <>
      <section aria-labelledby="verdict-title" className={styles.hero}>
        <div className={styles.heroMain}>
          <RiskBadge risk="insufficient" size="lg" />
          <div className={styles.heroText}>
            <h2 id="verdict-title" className={styles.verdictTitle}>
              {t.verdict.insufficient}
            </h2>
            <p className={styles.lead}>{t.verdict.insufficientLead}</p>
          </div>
          <div role="img" aria-label={t.verdict.scaleNoneAria} className={styles.greyScale}>
            <div>
              <span />
              <span />
              <span />
            </div>
            <span>{t.verdict.scaleNone}</span>
          </div>
          <div className={styles.ctaRow}>
            <Button to="/onboarding" size="xl" iconRight="arrowRight">
              {t.cta.addData}
            </Button>
            <Button to={`/check?from=${a.id}`} variant="secondary" size="xl" className={styles.secondaryCta}>
              {t.cta.changeParams}
            </Button>
          </div>
        </div>
        <div className={styles.needCol}>
          <h3 className={styles.needTitle}>{N.needTitle}</h3>
          <ul className={styles.needList}>
            {items.map((it) => (
              <li key={it.key} className={it.done ? styles.needDone : styles.needMissing}>
                <Icon name={it.done ? 'checkCircle' : 'alert'} size={20} strokeWidth={2} />
                <span className={styles.needText}>
                  <b>{it.title}</b>
                  <span className={styles.muted2}>{it.text}</span>
                  {!it.done && it.links && (
                    <span className={styles.needLinks}>
                      {it.links.map((l) => (
                        <Link key={l.label} to={l.to}>
                          {l.label}
                        </Link>
                      ))}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="k-title" className={styles.canSay}>
        <div className={styles.canSayText}>
          <h2 id="k-title" className={styles.canSayTitle}>
            {N.canSay}
          </h2>
          <p>
            <Rich
              text={share && rest.length ? N.canSayText(money(share.params.monthly), percent(share.params.share), rest) : N.noIncomeText(money(a.monthly_payment))}
              boldClass="nowrap"
            />
          </p>
        </div>
        <Link to={`/ai?q=${encodeURIComponent(N.whyQuestion)}`} className={styles.whyLink}>
          <Icon name="sparkle" size={18} strokeWidth={2} />
          {N.whyData}
        </Link>
      </section>
    </>
  );
}
