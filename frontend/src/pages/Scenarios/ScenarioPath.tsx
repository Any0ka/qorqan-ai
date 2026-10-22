import type { PathStep } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui';
import { useLang, useT } from '@/i18n/I18nProvider';
import { money, monthName, monthYear, percent, toDate } from '@/lib/format';
import { cap, dict, type Noun } from './i18n';
import styles from './Scenarios.module.css';

/** «Рекомендуемый путь»: timeline of the save-up scenario. */
export function ScenarioPath({ path, noun, onAdd, adding }: { path: PathStep[]; noun: Noun; onAdd: () => void; adding: boolean }) {
  const t = useT(dict);
  const { lang } = useLang();
  const p = t.path;
  const today = new Date();

  const period = (from: Date, to: string) => {
    const sameYear = from.getFullYear() === toDate(to).getFullYear();
    return sameYear ? p.period(monthName(from, lang), monthName(to, lang)) : p.period(monthYear(from, lang), monthYear(to, lang));
  };

  const content = (s: PathStep): { when: string; title: string; text: string } => {
    switch (s.code) {
      case 'close_and_save':
        return {
          when: period(today, s.until),
          title: p.closeTitle(s.credit_type),
          text: s.saving > 0 ? p.closeText(money(s.saving), monthName(s.saved_by, lang, 'dat'), money(s.saved)) : p.closeTextNoSaving,
        };
      case 'save_more':
        return { when: p.moreWhen(monthName(s.from, lang, 'abl')), title: p.moreTitle(percent(s.load)), text: p.moreText(money(s.freed), s.extra, money(s.saving)) };
      case 'save_monthly':
        return { when: p.monthlyWhen, title: p.monthlyTitle(money(s.saving)), text: p.monthlyText };
      case 'buy':
        return { when: cap(monthYear(s.month, lang)), title: p.buyTitle(money(s.price)), text: p.buyText(money(s.free)) };
    }
  };

  return (
    <section aria-labelledby="path-title" className={`${styles.section} ${styles.path}`}>
      <div className={styles.headStack}>
        <p className={styles.eyebrow}>{p.eyebrow}</p>
        <h2 id="path-title" className={styles.h2}>
          {p.title(noun)}
        </h2>
      </div>
      <ol className={styles.timeline}>
        {path.map((s, i) => {
          const final = s.code === 'buy';
          const c = content(s);
          return (
            <li key={`${s.code}-${i}`} className={styles.step}>
              <div className={styles.stepRail}>
                <span aria-hidden="true" className={final ? styles.stepDotFinal : styles.stepDot}>
                  {final ? <Icon name="check" size={15} strokeWidth={2.6} /> : i + 1}
                </span>
                {i < path.length - 1 && <span aria-hidden="true" className={styles.stepLine} />}
              </div>
              <div className={styles.stepBody}>
                <p className={styles.stepWhen}>{c.when}</p>
                <p className={styles.stepTitle}>{c.title}</p>
                <p className={styles.stepText}>{c.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <Button block className={`${styles.pushDown} ${styles.pathBtn}`} onClick={onAdd} disabled={adding}>
        {p.add}
      </Button>
    </section>
  );
}
