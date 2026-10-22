import { useMarkPaid } from '@/api/hooks';
import type { Plan } from '@/api/types';
import { Button, Card, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useLang, useT } from '@/i18n/I18nProvider';
import { dayMonth, money, percent } from '@/lib/format';
import { dict } from './i18n';
import styles from './Plan.module.css';

const pos = (x: number) => `${Math.max(0, Math.min(1, x)) * 100}%`;
const pct = (x: number) => Math.round(x * 100);

/** «Общий прогресс»: debt since the plan started, load now vs the target and the path to it. */
export function ProgressCard({ plan }: { plan: Plan }) {
  const t = useT(dict);
  const p = plan.progress;
  const pr = t.progress;

  const change = p.debt_change;
  const path = p.load_path;
  const points = path.filter((x, i) => i === 0 || pct(x.load) !== pct(path[i - 1].load));
  const reachedNow = p.load <= p.target_load;
  const reach = !reachedNow && p.target_month ? path.find((x) => x.month === p.target_month) ?? null : null;
  const reduce = plan.goals.find((g) => g.kind === 'reduce_load');
  const startLoad = typeof reduce?.params.start_load === 'number' ? (reduce.params.start_load as number) : null;
  const relief = p.relief?.end_date && p.relief.load_after < p.load ? { type: p.relief.type, end: p.relief.end_date, load: p.relief.load_after } : null;

  const explain = pr.explain({
    notYet: startLoad !== null && pct(p.load) >= pct(startLoad),
    within: reachedNow,
    target: p.target_load,
    relief,
    reach: reach ? { month: reach.month, load: reach.load } : null,
  });

  return (
    <Card flex="2 560px" aria-labelledby="prog-title" className={`${styles.pad28} ${styles.progressCard}`}>
      <h2 id="prog-title" className={styles.mutedTitle}>
        {pr.title}
      </h2>
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>{change < 0 ? pr.debtDown : change > 0 ? pr.debtUp : pr.debtSame}</span>
          <span className={styles.metricValue}>{money(change, { signed: true })}</span>
          <span className={styles.metricNote}>{pr.debtNote(p.start_debt, p.debt, plan.started_at ? pr.period(p.months_since_start) : null)}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>{pr.load}</span>
          <span className={styles.metricValue}>{percent(p.load)}</span>
          <span className={styles.metricNote}>{pr.target(percent(p.target_load))}</span>
        </div>
      </div>
      <LoadPath
        load={p.load}
        target={p.target_load}
        label={pr.pathAria(points, p.target_load, reach?.month ?? null, reachedNow)}
        targetText={pr.targetMark(percent(p.target_load))}
        nowText={pr.nowMark(percent(p.load))}
      />
      <p className={styles.explain}>{explain}</p>
    </Card>
  );
}

/** Bar on a 0–100% scale: the target zone, the part of the load above the target, markers for both. */
function LoadPath({ load, target, label, targetText, nowText }: { load: number; target: number; label: string; targetText: string; nowText: string }) {
  const over = load > target;
  const close = Math.abs(load - target) < 0.1;
  return (
    <div role="img" aria-label={label} className={styles.lp}>
      <div className={styles.lpTrack}>
        {over && <div className={`${styles.lpOver} ${load < 0.45 ? styles.lpOverWarn : ''}`} style={{ left: pos(target), width: pos(load - target) }} />}
        <div className={styles.lpZone} style={{ width: pos(target) }} />
        {!over && <div className={styles.lpFill} style={{ width: pos(load) }} />}
        <div className={styles.lpTick} style={{ left: pos(target) }} />
      </div>
      <div aria-hidden="true" className={`${styles.lpLabels} ${close ? styles.lpStacked : ''}`}>
        <span className={styles.lpTargetLabel} style={{ left: pos(target), transform: `translateX(${target > 0.85 ? -100 : -50}%)` }}>
          {targetText}
        </span>
        <span className={styles.lpNowLabel} style={{ left: pos(load), transform: `translateX(${load > 0.85 ? -100 : -20}%)` }}>
          {nowText}
        </span>
      </div>
    </div>
  );
}

/** Navy «Следующий шаг» card: the nearest payment and «Отметить как оплачено». */
export function NextStepCard({ step }: { step: Plan['next_step'] }) {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  const toast = useToast();
  const markPaid = useMarkPaid();
  const n = t.next;

  return (
    <Card tone="navy" flex="1 300px" gap={14} aria-labelledby="next-title" className={styles.pad28}>
      <p className={styles.nextEyebrow}>{n.eyebrow}</p>
      {step ? (
        <>
          <h2 id="next-title" className={styles.nextTitle}>
            {n.title(step.type, step.organization)}
          </h2>
          <p className={styles.nextAmount}>{money(step.amount)}</p>
          <p className={styles.nextWhen}>
            {dayMonth(step.date, lang)} · {step.days_until < 0 ? n.overdue(-step.days_until) : c.inDays(step.days_until)}
          </p>
          <Button
            variant="white"
            size="lg"
            block
            className={styles.pushDown}
            disabled={markPaid.isPending}
            onClick={() =>
              markPaid.mutate(step.credit_id, {
                onSuccess: () => toast({ tone: 'success', text: n.paid }),
                onError: () => toast({ tone: 'error', text: c.saveFailed }),
              })
            }
          >
            {n.markPaid}
          </Button>
        </>
      ) : (
        <>
          <h2 id="next-title" className={styles.nextTitle}>
            {n.noneTitle}
          </h2>
          <p className={styles.nextWhen}>{n.noneText}</p>
          <Button to="/credits" variant="white" size="lg" block className={styles.pushDown}>
            {c.nav.credits}
          </Button>
        </>
      )}
    </Card>
  );
}
