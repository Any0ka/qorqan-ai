import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStep } from '@/api/hooks';
import { Icon } from '@/components/Icon';
import { ZONE_ICON } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { money, percent } from '@/lib/format';
import { StepFooter, StepHeading, type StepProps } from './shared';
import { dict } from './i18n';
import styles from './Onboarding.module.css';

/** Step 4 — «Проверь свою финансовую картину»: totals with «Изменить», preliminary load zone, finish. */
export function StepReview({ financial: f, goTo, headingRef }: StepProps) {
  const t = useT(dict);
  const tr = t.review;
  const navigate = useNavigate();
  const finish = useOnboardingStep();
  const [error, setError] = useState<unknown>(null);
  const complete = f.completeness.state === 'complete';

  const paymentsLabel = f.credits_count > 0 ? tr.payments(f.credits_count) : tr.paymentsNone;
  const rows = [
    { label: tr.income, value: f.completeness.income ? money(f.income_total) : '—', step: 1 },
    { label: tr.expenses, value: f.completeness.expenses ? money(f.expenses_total) : '—', step: 2 },
    {
      label: paymentsLabel,
      value: f.credits_count > 0 || f.no_credits ? money(f.payments_total) : '—',
      note: f.credits_count > 0 ? null : f.no_credits ? tr.noCredits : tr.notAdded,
      step: 3,
    },
  ];

  const done = () => {
    setError(null);
    finish.mutate(
      { step: 4, completed: true },
      {
        onSuccess: () => navigate('/dashboard'),
        onError: setError,
      },
    );
  };

  return (
    <>
      <StepHeading headingRef={headingRef} title={tr.title} lead={tr.lead} />

      <dl className={styles.summary}>
        {rows.map((r) => (
          <div key={r.step} className={styles.summaryTile}>
            <dt>{r.label}</dt>
            <dd className="tabular">{r.value}</dd>
            {r.note && <span className={styles.summaryNote}>{r.note}</span>}
            <button type="button" className={styles.editButton} aria-label={tr.editAria(r.label)} onClick={() => goTo(r.step)}>
              {tr.edit}
            </button>
          </div>
        ))}
        <div className={`${styles.summaryTile} ${styles.summaryAuto}`}>
          <dt>{tr.free}</dt>
          <dd className="tabular">{complete || f.completeness.expenses ? money(f.free) : '—'}</dd>
          <span className={styles.summaryNote}>{tr.auto}</span>
        </div>
      </dl>

      <div aria-live="polite">
        {complete ? (
          <div className={`${styles.zoneNote} ${styles['zone_' + f.zone]}`}>
            <Icon name={ZONE_ICON[f.zone]} size={22} strokeWidth={2} />
            <div>
              <p className={styles.zoneTitle}>{tr.zoneTitle[f.zone]}</p>
              <p className={styles.zoneText}>
                {f.payments_total > 0 ? tr.zoneText[f.zone](percent(f.load)) : tr.zoneNoCredits}
                {f.free < 0 && ` ${tr.freeNegative(money(-f.free))}`}
              </p>
            </div>
          </div>
        ) : (
          <div className={`${styles.zoneNote} ${styles.zone_none}`}>
            <Icon name="questionDashed" size={22} strokeWidth={2} />
            <div>
              <p className={styles.zoneTitle}>{tr.incompleteTitle}</p>
              <p className={styles.zoneText}>{tr.incompleteText(f.completeness.missing.map((m) => tr.missing[m]).join(', '))}</p>
            </div>
          </div>
        )}
      </div>

      <StepFooter onBack={() => goTo(3)} onNext={done} nextLabel={tr.finish} pending={finish.isPending} error={error} />
    </>
  );
}
