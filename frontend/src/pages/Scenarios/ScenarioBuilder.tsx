import { useEffect, useState } from 'react';
import { useCustomScenario } from '@/api/hooks';
import type { CreditType, CustomScenarioInput, ScenarioOption } from '@/api/types';
import { Button, RiskBadge, SelectField, Skeleton } from '@/components/ui';
import { common } from '@/i18n/common';
import { useT } from '@/i18n/I18nProvider';
import { money, percent } from '@/lib/format';
import type { ScenarioData } from './ScenariosContent';
import { dict } from './i18n';
import styles from './Scenarios.module.css';

const TERMS = [6, 12, 24];
const roundTo = (x: number, step: number) => Math.round(x / step) * step;

/** Price choices like the design: cheaper model · a round middle · the original price. */
function priceSteps(cheap: number, original: number): number[] {
  const mid = (cheap + original) / 2;
  const roundMid = Math.floor(mid / 100_000) * 100_000;
  const middle = roundMid > cheap && roundMid < original ? roundMid : roundTo(mid, 10_000);
  return [...new Set([cheap, middle, original])].filter((p) => p > 0).sort((a, b) => a - b);
}

/** «Собери свой вариант»: every change is recalculated by the API (POST /scenarios/custom). */
export function ScenarioBuilder({ data, closingType, laterMonths }: { data: ScenarioData; closingType: CreditType | null; laterMonths: number }) {
  const t = useT(dict);
  const c = useT(common);
  const b = t.builder;
  const original = data.purchase.price;
  const cheap = data.options.find((o) => o.code === 'cheaper')?.price ?? Math.max(Math.floor((original * 0.5) / 10_000) * 10_000, 10_000);
  const prices = priceSteps(cheap, original);
  const downStep = Math.max(roundTo(original * 0.12, 10_000), 10_000);

  const [form, setForm] = useState<CustomScenarioInput>(() => ({
    price: cheap,
    method: data.purchase.kind === 'credit' ? 'credit' : 'installment',
    term_months: TERMS.includes(data.purchase.term_months) ? data.purchase.term_months : 12,
    down_payment: 0,
    start: closingType ? 'later' : 'now',
  }));
  const downs = [0, downStep, downStep * 2].filter((d) => d === 0 || d < form.price);

  const { mutate, isPending, isError } = useCustomScenario();
  const [result, setResult] = useState<ScenarioOption | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => mutate(form, { onSuccess: setResult }), 250);
    return () => window.clearTimeout(id);
  }, [form, attempt, mutate]);

  const set = <K extends keyof CustomScenarioInput>(key: K, value: CustomScenarioInput[K]) =>
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (next.down_payment >= next.price) next.down_payment = 0;
      return next;
    });

  const save = form.method === 'save';
  const shown = result && (result.code === 'save') === save ? result : null;

  return (
    <section aria-labelledby="builder-title" className={`${styles.section} ${styles.builder}`}>
      <div className={styles.headStack}>
        <h2 id="builder-title" className={styles.h2}>
          {b.title}
        </h2>
        <p className={styles.lead}>{b.subtitle}</p>
      </div>

      <div className={styles.builderGrid}>
        <SelectField
          label={b.price}
          fieldClassName={styles.builderField}
          value={String(form.price)}
          onChange={(e) => set('price', Number(e.target.value))}
          options={prices.map((p) => ({
            value: String(p),
            label: p === original ? b.originalOption(money(p)) : p === cheap ? b.cheaperOption(money(p)) : money(p),
          }))}
        />
        <SelectField
          label={b.method}
          fieldClassName={styles.builderField}
          value={form.method}
          onChange={(e) => set('method', e.target.value as CustomScenarioInput['method'])}
          options={(['installment', 'credit', 'save'] as const).map((m) => ({ value: m, label: b.methods[m] }))}
        />
        <SelectField
          label={b.term}
          fieldClassName={styles.builderField}
          value={String(form.term_months)}
          disabled={save}
          onChange={(e) => set('term_months', Number(e.target.value))}
          options={TERMS.map((n) => ({ value: String(n), label: b.termOption(n) }))}
        />
        <SelectField
          label={b.down}
          fieldClassName={styles.builderField}
          value={String(form.down_payment)}
          onChange={(e) => set('down_payment', Number(e.target.value))}
          options={downs.map((d) => ({ value: String(d), label: d === 0 ? b.noDown : money(d) }))}
        />
        <SelectField
          label={b.start}
          fieldClassName={styles.builderField}
          value={form.start}
          disabled={save}
          onChange={(e) => set('start', e.target.value as CustomScenarioInput['start'])}
          options={[
            { value: 'now', label: b.startNow },
            { value: 'later', label: b.startLater(laterMonths) },
          ]}
        />
      </div>

      <div aria-live="polite" aria-busy={isPending} className={styles.result}>
        <div className={styles.resultHead}>
          <p className={styles.resultTitle}>{b.result}</p>
          <span className={styles.resultStatus}>
            {isPending && shown && <span className={styles.pending}>{b.pending}</span>}
            {shown && <RiskBadge risk={shown.risk} />}
          </span>
        </div>
        {isError && !isPending ? (
          <p className={styles.advice} role="alert">
            {b.failed}{' '}
            <Button variant="link" onClick={() => setAttempt((n) => n + 1)}>
              {c.retry}
            </Button>
          </p>
        ) : shown ? (
          <>
            <dl className={`${styles.resultList} ${isPending ? styles.stale : ''}`}>
              <div>
                <dt>{save ? b.saveMonthly : b.pay}</dt>
                <dd>{money(save ? shown.saving_monthly ?? 0 : shown.monthly_payment)}</dd>
              </div>
              <div>
                <dt>{b.load}</dt>
                <dd>{percent(shown.load)}</dd>
              </div>
              <div>
                <dt>{b.free}</dt>
                <dd className={shown.free < 0 ? styles.bad : undefined}>{money(shown.free)}</dd>
              </div>
              <div>
                <dt>{b.total}</dt>
                <dd>{money(shown.total_cost)}</dd>
              </div>
              <div>
                <dt>{b.purchase}</dt>
                <dd>
                  {shown.months_until_purchase === null ? b.never : shown.months_until_purchase === 0 ? b.now : b.inMonths(shown.months_until_purchase)}
                </dd>
              </div>
            </dl>
            {shown.advice && <p className={styles.advice}>{t.advice(shown.advice, shown.closing_credit?.type ?? closingType)}</p>}
          </>
        ) : (
          <Skeleton height={140} radius={12} />
        )}
      </div>
    </section>
  );
}
