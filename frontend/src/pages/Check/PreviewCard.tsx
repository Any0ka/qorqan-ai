import type { CheckPreview, FinancingKind } from '@/api/types';
import { useT } from '@/i18n/I18nProvider';
import { money, num, percent } from '@/lib/format';
import { dict } from './i18n';
import { Rich } from './Rich';
import styles from './Check.module.css';

function freeTone(free: number, income: number) {
  if (free < 0 || (income > 0 && free / income < 0.1)) return styles.negative;
  if (income > 0 && free / income < 0.2) return styles.text_warning;
  return styles.strongNavy;
}

/** «Предварительно» — live numbers under the form; announced politely when they change. */
export function PreviewCard({ data, kind, hasPrice, pending }: { data: CheckPreview | null; kind: FinancingKind; hasPrice: boolean; pending: boolean }) {
  const t = useT(dict);
  const p = t.preview;
  let body: React.ReactNode;
  if (!hasPrice || !data) {
    body = <p className={styles.previewText}>{p.empty}</p>;
  } else if (kind === 'own') {
    body = <p className={styles.previewText}>{data.before.income > 0 ? <Rich text={p.own(money(data.before.payments), percent(data.before.load))} /> : p.incomplete}</p>;
  } else if (data.before.income <= 0) {
    body = (
      <p className={styles.previewText}>
        <Rich text={p.noIncome(money(data.monthly_payment))} boldClass="nowrap" />
      </p>
    );
  } else {
    body = (
      <>
        <p className={styles.previewText}>
          <Rich text={p.share(money(data.monthly_payment), percent(data.new_payment_share))} boldClass="nowrap" />
          {data.complete && (
            <>
              {' '}
              <Rich text={p.paymentsAfter(money(data.after.payments))} boldClass="nowrap" />
            </>
          )}
        </p>
        {data.complete && (
          <div className={styles.previewFree}>
            <span className={styles.muted2}>{p.free}</span>
            <span className="nowrap tabular">
              {num(data.before.free)} <span className={styles.muted}>→</span>{' '}
              <b className={freeTone(data.after.free, data.after.income)}>{money(data.after.free)}</b>
            </span>
          </div>
        )}
      </>
    );
  }
  return (
    <section aria-labelledby="pre-title" className={styles.previewCard} aria-busy={pending || undefined}>
      <h2 id="pre-title" className={styles.previewTitle}>
        {p.title}
      </h2>
      <div aria-live="polite" className={`${styles.previewBody} ${pending && data ? styles.stale : ''}`}>
        {body}
      </div>
      {hasPrice && data && <p className={styles.small2}>{data.complete || kind === 'own' ? p.note : p.incomplete}</p>}
    </section>
  );
}
