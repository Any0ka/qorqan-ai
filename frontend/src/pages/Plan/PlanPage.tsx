import { useCallback, useState } from 'react';
import { useDashboard, usePlan } from '@/api/hooks';
import type { Plan } from '@/api/types';
import { Icon } from '@/components/Icon';
import { AppPage } from '@/components/layout/AppShell';
import { Button, Card, ErrorState, PageSkeleton, Row } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { ForecastCard } from './PlanForecast';
import { AddGoalDialog, GoalsCard } from './PlanGoals';
import { PrioritiesCard } from './PlanPriorities';
import { NextStepCard, ProgressCard } from './PlanProgress';
import { RecommendationsCard } from './PlanRecommendations';
import { dict } from './i18n';
import styles from './Plan.module.css';

/** «Финансовый план»: progress, next payment, debt forecast, repayment order, goals and recommendations. */
export default function PlanPage() {
  const t = useT(dict);
  const { data, isLoading, error, refetch } = usePlan();
  const subtitle = data ? t.subtitle(data.started_at, data.recalculated_at) : '';

  return (
    <AppPage title={t.title} subtitle={subtitle || null}>
      {isLoading && <PageSkeleton />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && <PlanContent plan={data} />}
    </AppPage>
  );
}

function PlanContent({ plan }: { plan: Plan }) {
  const [adding, setAdding] = useState(false);
  const openAdd = useCallback(() => setAdding(true), []);
  const closeAdd = useCallback(() => setAdding(false), []);
  const hasCredits = plan.priorities.length > 0;
  // The card's payoff month comes from the «+20 000 ₸ over the minimum» recommendation unless it was turned down.
  const cardRec = plan.recommendations.find((r) => r.code === 'card_extra_payment' && r.status !== 'dismissed');
  const cardUntil = typeof cardRec?.params.until === 'string' ? (cardRec.params.until as string) : null;

  return (
    <>
      {hasCredits ? (
        <Row>
          <ProgressCard plan={plan} />
          <NextStepCard step={plan.next_step} />
        </Row>
      ) : (
        <PlanEmpty onAddGoal={openAdd} />
      )}

      {hasCredits && plan.forecast.length > 1 && <ForecastCard plan={plan} cardUntil={cardUntil} />}

      {(hasCredits || plan.goals.length > 0) && (
        <Row style={{ alignItems: 'flex-start' }}>
          {hasCredits && <PrioritiesCard priorities={plan.priorities} cardUntil={cardUntil} />}
          <GoalsCard goals={plan.goals} onAdd={openAdd} />
        </Row>
      )}

      <RecommendationsCard plan={plan} />

      {adding && <AddGoalDialog onClose={closeAdd} />}
    </>
  );
}

/** No credits yet: either the profile isn't filled in, or there is simply no debt. */
function PlanEmpty({ onAddGoal }: { onAddGoal: () => void }) {
  const t = useT(dict);
  const e = t.empty;
  const { data: dashboard } = useDashboard();
  const noDebt = dashboard?.state === 'complete';
  return (
    <Card pad="lg" radius="hero" aria-labelledby="plan-empty-title" className={styles.empty}>
      <span aria-hidden="true" className={styles.emptyIcon}>
        <Icon name={noDebt ? 'shield' : 'route'} size={26} />
      </span>
      <div className={styles.emptyBody}>
        <h2 id="plan-empty-title" className={styles.emptyTitle}>
          {noDebt ? e.noDebtTitle : e.noDataTitle}
        </h2>
        <p className={styles.emptyText}>{noDebt ? e.noDebtText : e.noDataText}</p>
        <div className={styles.emptyActions}>
          {noDebt ? (
            <Button icon="plus" onClick={onAddGoal}>
              {e.addGoal}
            </Button>
          ) : (
            <Button to="/onboarding" iconRight="arrowRight">
              {e.fill}
            </Button>
          )}
          <Button to="/check" variant="secondary">
            {e.check}
          </Button>
          {!noDebt && (
            <Button variant="ghost" icon="plus" onClick={onAddGoal}>
              {e.addGoal}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
