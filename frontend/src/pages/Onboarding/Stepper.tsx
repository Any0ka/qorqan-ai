import { Icon } from '@/components/Icon';
import { useT } from '@/i18n/I18nProvider';
import { dict } from './i18n';
import styles from './Onboarding.module.css';

interface Props {
  step: number;
  /** Saved data per step 1–3 (step 4 is the review). */
  done: [boolean, boolean, boolean];
  /** Step 3 shows «Нужно внимание» while the report could not be read. */
  attention: boolean;
  onGo: (step: number) => void;
}

/** Four steps: done steps are buttons back to them, the current one carries aria-current="step". */
export function Stepper({ step, done, attention, onGo }: Props) {
  const t = useT(dict);
  return (
    <ol aria-label={t.stepsLabel} className={styles.stepper}>
      {t.steps.map((title, i) => {
        const n = i + 1;
        const isDone = n < 4 && done[i];
        if (n === step) {
          const warn = attention && n === 3;
          return (
            <li key={n}>
              <div aria-current="step" className={`${styles.stepItem} ${styles.stepCurrent} ${warn ? styles.stepWarn : ''}`}>
                <span className={styles.stepCircle}>{n}</span>
                <span className={styles.stepText}>
                  <span className={styles.stepTitle}>{title}</span>
                  <span className={styles.stepState}>{warn ? t.stepState.attention : t.stepState.current}</span>
                </span>
              </div>
            </li>
          );
        }
        if (isDone || n < step) {
          return (
            <li key={n}>
              <button type="button" className={`${styles.stepItem} ${styles.stepDone} ${isDone ? '' : styles.stepSkipped}`} onClick={() => onGo(n)}>
                <span className={styles.stepCircle}>{isDone ? <Icon name="check" size={16} strokeWidth={2.6} /> : n}</span>
                <span className={styles.stepText}>
                  <span className={styles.stepTitle}>{title}</span>
                  <span className={styles.stepState}>{isDone ? t.stepState.done : t.stepState.skipped}</span>
                </span>
              </button>
            </li>
          );
        }
        return (
          <li key={n}>
            <div className={`${styles.stepItem} ${styles.stepTodo}`}>
              <span className={styles.stepCircle}>{n}</span>
              <span className={styles.stepText}>
                <span className={styles.stepTitle}>{title}</span>
                <span className={styles.stepState}>{t.stepState.todo}</span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
