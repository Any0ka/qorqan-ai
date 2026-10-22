import type { Plan } from '@/api/types';
import { DebtChart, DebtLegend, type DebtPoint } from '@/components/charts/DebtChart';
import { Card } from '@/components/ui';
import { useLang, useT } from '@/i18n/I18nProvider';
import { millions, monthYear } from '@/lib/format';
import { dict } from './i18n';
import styles from './Plan.module.css';

const monthKey = (d: string) => d.slice(0, 7);

/** «Прогноз задолженности по плану»: today's debt, then the month-by-month forecast with credit closings marked. */
export function ForecastCard({ plan, cardUntil }: { plan: Plan; cardUntil: string | null }) {
  const t = useT(dict);
  const { lang } = useLang();
  const f = t.forecast;
  const fc = plan.forecast;
  const index = new Map(fc.map((p, i) => [monthKey(p.month), i]));

  const events: Array<{ i: number; month: string; label: string }> = [];
  for (const p of plan.priorities) {
    const end = p.end_date ?? (p.type === 'credit_card' ? cardUntil : null);
    const i = end ? index.get(monthKey(end)) : undefined;
    if (!i) continue;
    const label = f.closed[p.type];
    if (!events.some((e) => e.i === i && e.label === label)) events.push({ i, month: fc[i].month, label });
  }
  events.sort((a, b) => a.i - b.i);

  // Markers near the right edge would collide with the end-value label, so those stay in the text alternative only.
  const labels = new Map<number, string>();
  for (const e of events) if (e.i <= fc.length - 3) labels.set(e.i, labels.has(e.i) ? `${labels.get(e.i)} · ${e.label}` : e.label);

  const series: DebtPoint[] = fc.map((p, i) => ({ month: p.month, debt: p.debt, kind: i === 0 ? 'actual' : 'forecast', event: labels.get(i) ?? null }));
  const first = fc[0];
  const last = fc[fc.length - 1];
  const fmt = (n: number) => `${millions(n, lang)} ₸`;

  return (
    <Card aria-labelledby="fc-title" className={`${styles.pad24} ${styles.fcCard}`}>
      <div className={styles.cardHead}>
        <h2 id="fc-title" className={styles.sectionTitle}>
          {f.title}
        </h2>
        <p className={styles.hint}>{f.period(monthYear(first.month, lang), monthYear(last.month, lang))}</p>
      </div>
      <DebtLegend actual={f.actual} forecast={f.forecast} />
      <DebtChart
        series={series}
        lang={lang}
        todayLabel={f.today}
        eventLabel={(p) => p.event ?? null}
        formatValue={fmt}
        formatAxis={(n) => millions(n, lang, 1)}
        ariaLabel={f.aria(fmt(first.debt), fmt(last.debt), last.month, events)}
      />
    </Card>
  );
}
