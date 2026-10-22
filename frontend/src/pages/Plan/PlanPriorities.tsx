import type { CreditType, Plan } from '@/api/types';
import { Card } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { money } from '@/lib/format';
import { dict, KEEP_ORDER } from './i18n';
import styles from './Plan.module.css';

type Priority = Plan['priorities'][number];

interface Item {
  key: string;
  rank: string;
  name: string;
  date: string;
  dateClass?: string;
  text: string;
  active: boolean;
}

/** «Что гасить в первую очередь». Consecutive «keep the schedule» debts are merged into one row («4–5»). */
export function PrioritiesCard({ priorities, cardUntil }: { priorities: Priority[]; cardUntil: string | null }) {
  const t = useT(dict);
  const p = t.prio;

  const groups: Priority[][] = [];
  for (const item of priorities) {
    const prev = groups[groups.length - 1];
    if (prev && item.advice === 'keep_schedule' && prev[0].advice === 'keep_schedule') prev.push(item);
    else groups.push([item]);
  }

  const items: Item[] = groups.map((g, gi) => {
    const first = g[0];
    if (first.advice === 'keep_schedule') {
      const types = [...new Set(g.map((x) => x.type))].sort((a, b) => KEEP_ORDER.indexOf(a) - KEEP_ORDER.indexOf(b));
      return {
        key: first.credit_id,
        rank: g.length > 1 ? `${first.rank}–${g[g.length - 1].rank}` : String(first.rank),
        name: g.length > 1 ? p.group(types) : p.name(first.organization, first.type),
        date: p.onSchedule,
        text: p.keep(types),
        active: false,
      };
    }
    const base = { key: first.credit_id, rank: String(first.rank), name: p.name(first.organization, first.type) };
    switch (first.advice) {
      case 'pay_on_schedule_close':
        return {
          ...base,
          date: first.end_date ? p.until(first.end_date) : p.onSchedule,
          dateClass: first.end_date ? styles.dateWarn : undefined,
          text: p.closeFirst(first.remaining),
          active: true,
        };
      case 'pay_above_minimum': {
        const until = first.type === 'credit_card' ? cardUntil : null;
        return {
          ...base,
          date: until ? p.untilMonth(until) : first.end_date ? p.until(first.end_date) : p.onSchedule,
          dateClass: until || first.end_date ? styles.dateStrong : undefined,
          text: p.aboveMin(money(first.extra ?? 0), first.extra_from),
          active: true,
        };
      }
      default: {
        const prev: CreditType | null = gi > 0 ? groups[gi - 1][0].type : null;
        return { ...base, date: p.onSchedule, text: p.earlyLater(prev), active: false };
      }
    }
  });

  return (
    <Card flex="1 460px" aria-labelledby="prio-title" className={`${styles.pad24} ${styles.prioCard}`}>
      <h2 id="prio-title" className={styles.sectionTitle}>
        {p.title}
      </h2>
      <p className={`${styles.hint} ${styles.prioSubtitle}`}>{p.subtitle}</p>
      <ol className={styles.prio}>
        {items.map((it) => (
          <li key={it.key}>
            <span className={`${styles.rank} ${it.active ? styles.rankOn : ''} ${it.rank.length > 2 ? styles.rankRange : ''}`}>{it.rank}</span>
            <div className={styles.prioBody}>
              <div className={styles.prioHead}>
                <b>{it.name}</b>
                <span className={`${styles.prioDate} ${it.dateClass ?? ''}`}>{it.date}</span>
              </div>
              <span className={styles.prioText}>{it.text}</span>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
