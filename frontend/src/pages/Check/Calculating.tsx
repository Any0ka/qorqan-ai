import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useT } from '@/i18n/I18nProvider';
import { dict } from './i18n';
import styles from './Check.module.css';

export const STEP_MS = 300;

/** «qorgan считает оценку» — the steps show what is being taken into account (System-States). */
export function Calculating({ credits, compact }: { credits: number; compact?: boolean }) {
  const t = useT(dict);
  const steps = t.calculating.steps(credits);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setActive((a) => Math.min(a + 1, steps.length - 1)), STEP_MS);
    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <div role="status" className={`${styles.calculating} ${compact ? styles.calculatingCompact : ''}`}>
      <div className={styles.calcHead}>
        <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" className={styles.spinner}>
          <circle cx="18" cy="18" r="14" fill="none" stroke="var(--border)" strokeWidth="4" />
          <path d="M18 4a14 14 0 0 1 14 14" fill="none" stroke="var(--navy-800)" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <b>{t.calculating.title}</b>
      </div>
      <ol className={styles.calcSteps}>
        {steps.map((s, i) => (
          <li key={s} className={i < active ? styles.stepDone : i === active ? styles.stepActive : styles.stepTodo} aria-current={i === active ? 'step' : undefined}>
            {i < active ? (
              <Icon name="checkCircle" size={18} strokeWidth={2.2} />
            ) : i === active ? (
              <Icon name="circleDashed" size={18} strokeWidth={2.2} />
            ) : (
              <Icon name="circle" size={18} strokeWidth={2.2} />
            )}
            {s}
          </li>
        ))}
      </ol>
      <p className={styles.calcNote}>{t.calculating.note}</p>
    </div>
  );
}
