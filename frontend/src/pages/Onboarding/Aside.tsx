import { Link } from 'react-router-dom';
import type { Financial } from '@/api/types';
import { Icon } from '@/components/Icon';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { money } from '@/lib/format';
import { dict } from './i18n';
import styles from './Onboarding.module.css';

/** «Зачем это нужно» (or PDF help after a failed report), «Уже указано», «Данные под твоим контролем». */
export function Aside({ step, financial: f, attention }: { step: number; financial: Financial; attention: boolean }) {
  const t = useT(dict);
  const c = useT(common);
  const a = t.aside;

  /** Saved value, or where it will be filled in. */
  const pending = (forStep: number) => <span className={styles.filledPending}>{step === forStep ? a.filling : a.stepN(forStep)}</span>;
  const rows = [
    { label: a.income, value: f.completeness.income ? <b className="tabular">{money(f.income_total)}</b> : pending(1) },
    { label: a.expenses, value: f.completeness.expenses ? <b className="tabular">{money(f.expenses_total)}</b> : pending(2) },
    {
      label: a.credits,
      value:
        f.credits_count > 0 ? (
          <b className="tabular">
            {f.credits_count} · {money(f.payments_total)}
            {c.perMonthShort}
          </b>
        ) : f.no_credits ? (
          <b>{a.none}</b>
        ) : (
          pending(3)
        ),
    },
  ];

  return (
    <aside className={styles.aside}>
      {attention ? (
        <section aria-labelledby="pdf-title" className={styles.asideCard}>
          <h2 id="pdf-title" className={styles.asideTitle}>
            {a.pdfTitle}
          </h2>
          <p className={styles.asideTextSm}>{a.pdfText}</p>
          <Link to="/ai" className={styles.aiLink}>
            <Icon name="sparkle" size={16} />
            {a.askAi}
          </Link>
        </section>
      ) : (
        <section aria-labelledby="why-title" className={styles.asideCard}>
          <h2 id="why-title" className={styles.asideTitle}>
            {a.whyTitle}
          </h2>
          <p className={styles.asideText}>{a.why[step - 1]}</p>
        </section>
      )}

      <section aria-labelledby="filled-title" className={`${styles.asideCard} ${styles.filled}`}>
        <h2 id="filled-title" className={styles.asideTitle}>
          {a.filledTitle}
        </h2>
        <dl>
          {rows.map((r) => (
            <div key={r.label} className={styles.filledRow}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="ctrl-title" className={styles.control}>
        <span aria-hidden="true" className={styles.controlIcon}>
          <Icon name="lock" size={20} />
        </span>
        <div>
          <h2 id="ctrl-title" className={styles.controlTitle}>
            {a.controlTitle}
          </h2>
          <p className={styles.asideTextSm}>{a.controlText}</p>
        </div>
      </section>
    </aside>
  );
}
