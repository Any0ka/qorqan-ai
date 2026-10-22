import { useRecommendationAction } from '@/api/hooks';
import type { Plan, PlanRecommendation } from '@/api/types';
import { Icon, type IconName } from '@/components/Icon';
import { Button, Card, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useT } from '@/i18n/I18nProvider';
import { money } from '@/lib/format';
import { dict, type Strings } from './i18n';
import styles from './Plan.module.css';

type Status = Exclude<PlanRecommendation['status'], 'pending'>;
const STATUS: Record<Status, { tone: 'success' | 'teal' | 'neutral'; icon: IconName }> = {
  in_plan: { tone: 'success', icon: 'check' },
  accepted: { tone: 'success', icon: 'check' },
  reminder_on: { tone: 'teal', icon: 'bell' },
  dismissed: { tone: 'neutral', icon: 'eyeOff' },
};

function recoText(t: Strings, r: PlanRecommendation, plan: Plan): { title: string; text: string } | null {
  const x = t.reco;
  const s = (k: string) => (typeof r.params[k] === 'string' ? (r.params[k] as string) : null);
  switch (r.code) {
    case 'no_new_credit_until': {
      const month = s('month');
      if (!month) return null;
      return { title: x.noNewCredit(month), text: plan.progress.load >= 0.45 ? x.noNewCreditHigh : x.noNewCreditText };
    }
    case 'card_extra_payment': {
      const from = s('from');
      const until = s('until');
      if (!from || !until) return null;
      return { title: x.cardExtra(from, money(Number(r.params.amount) || 0)), text: x.cardExtraText(plan.progress.relief?.type ?? null, until) };
    }
    case 'update_income_monthly':
      return { title: x.updateIncome, text: x.updateIncomeText };
    default:
      return null;
  }
}

/** «Рекомендации qorgan AI»: accept / not now / remind, then the status instead of the buttons. */
export function RecommendationsCard({ plan }: { plan: Plan }) {
  const t = useT(dict);
  const c = useT(common);
  const toast = useToast();
  const act = useRecommendationAction();
  const x = t.reco;

  const items = plan.recommendations
    .map((r) => ({ r, copy: recoText(t, r, plan) }))
    .filter((i): i is { r: PlanRecommendation; copy: { title: string; text: string } } => i.copy !== null)
    .sort((a, b) => Number(a.r.status === 'dismissed') - Number(b.r.status === 'dismissed'));
  if (!items.length) return null;

  const run = (r: PlanRecommendation, action: 'accept' | 'dismiss' | 'remind') =>
    act.mutate(
      { id: r.id, action },
      {
        onSuccess: () => toast({ tone: 'success', text: x.done[action] }),
        onError: () => toast({ tone: 'error', text: c.saveFailed }),
      },
    );

  return (
    <Card aria-labelledby="ai-title" className={`${styles.pad24} ${styles.recoCard}`}>
      <div className={styles.aiHead}>
        <span aria-hidden="true" className={styles.aiBadge}>
          <Icon name="sparkle" size={18} strokeWidth={2} />
        </span>
        <h2 id="ai-title" className={styles.sectionTitle}>
          {x.title}
        </h2>
      </div>
      <ul className={styles.recoList}>
        {items.map(({ r, copy }) => {
          const busy = act.isPending && act.variables?.id === r.id;
          const status = r.status !== 'pending' ? STATUS[r.status] : null;
          return (
            <li key={r.id} className={`${styles.reco} ${r.status === 'dismissed' ? styles.recoDismissed : ''}`}>
              <b>{copy.title}</b>
              <span className={styles.recoText}>{copy.text}</span>
              <div className={styles.recoActions}>
                {r.actions.length > 0
                  ? r.actions.map((a) => (
                      <Button
                        key={a}
                        size="sm"
                        variant={a === 'accept' ? 'primary' : a === 'remind' ? 'secondary' : 'ghost'}
                        className={`${styles.smallBtn} ${a === 'dismiss' ? styles.dismissBtn : ''}`}
                        disabled={busy}
                        onClick={() => run(r, a)}
                      >
                        {x.actions[a]}
                      </Button>
                    ))
                  : status && (
                      <span className={`${styles.status} ${styles['status_' + status.tone]}`}>
                        <Icon name={status.icon} size={15} strokeWidth={2.4} />
                        {x.status[r.status as Status]}
                      </span>
                    )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
