import { useNavigate } from 'react-router-dom';
import { useAddScenarioToPlan } from '@/api/hooks';
import type { OptionCode, PurchaseCategory, ScenariosResponse } from '@/api/types';
import { Icon, type IconName } from '@/components/Icon';
import { Alert, Button, RISK_ICON, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useT } from '@/i18n/I18nProvider';
import { percent } from '@/lib/format';
import { ScenarioBuilder } from './ScenarioBuilder';
import { ScenarioCompare } from './ScenarioCompare';
import { ScenarioPath } from './ScenarioPath';
import { dict, purchaseNoun } from './i18n';
import styles from './Scenarios.module.css';

export type ScenarioData = NonNullable<ScenariosResponse['scenarios']>;
export type CheckRef = NonNullable<ScenariosResponse['check']>;

const CATEGORY_ICON: Partial<Record<PurchaseCategory, IconName>> = { smartphone: 'phone' };

export function ScenariosContent({ check, data }: { check: CheckRef; data: ScenarioData }) {
  const t = useT(dict);
  const c = useT(common);
  const navigate = useNavigate();
  const toast = useToast();
  const add = useAddScenarioToPlan();

  const p = data.purchase;
  const noun = purchaseNoun(t, p);
  const closing = data.options.find((o) => o.closing_credit)?.closing_credit ?? null;
  const laterMonths = data.options.find((o) => o.code === 'wait')?.months_until_purchase ?? closing?.remaining_payments ?? 3;
  const insufficient = check.risk === 'insufficient' || data.base.income <= 0;
  const a = data.assumptions;

  const addToPlan = (option: OptionCode) =>
    add.mutate(
      { check_id: check.id, option },
      {
        onSuccess: () => {
          toast({ tone: 'success', text: t.added });
          navigate('/plan');
        },
        onError: () => toast({ tone: 'error', text: c.saveFailed }),
      },
    );

  return (
    <>
      <div className={styles.goalBar}>
        <div className={styles.goalInfo}>
          <span aria-hidden="true" className={styles.goalIcon}>
            <Icon name={CATEGORY_ICON[p.category] ?? 'target'} size={22} />
          </span>
          <div className={styles.goalText}>
            <p className={styles.goalTitle}>{t.goal.title(noun.nom)}</p>
            <p className={styles.goalSub}>
              {t.goal.original(p.kind, p.term_months, p.price)} ·{' '}
              <span className={`${styles.riskWord} ${styles['risk_' + check.risk]}`}>
                <Icon name={RISK_ICON[check.risk]} size={14} strokeWidth={2.2} />
                {c.risk[check.risk].toLowerCase()}
              </span>
            </p>
          </div>
        </div>
        <Button to={`/check?from=${check.id}`} variant="secondary">
          {t.goal.change}
        </Button>
      </div>

      {insufficient && (
        <Alert
          tone="warning"
          title={t.insufficient.title}
          actions={
            <Button to="/onboarding" variant="link">
              {t.insufficient.cta}
            </Button>
          }
        >
          {t.insufficient.text}
        </Alert>
      )}

      <ScenarioCompare check={check} data={data} noun={noun} onChoose={addToPlan} adding={add.isPending} />

      <div className={styles.lower}>
        <ScenarioBuilder data={data} closingType={closing?.type ?? null} laterMonths={laterMonths} />
        {data.path && data.path.length > 0 && (
          <ScenarioPath path={data.path} noun={noun} onAdd={() => addToPlan(data.recommended ?? 'save')} adding={add.isPending} />
        )}
      </div>

      <p className={styles.footnote}>
        {t.footnote(percent(a.installment_markup_24), Math.round(a.credit_markup_min * 100), percent(a.credit_markup_max))}
      </p>
    </>
  );
}
