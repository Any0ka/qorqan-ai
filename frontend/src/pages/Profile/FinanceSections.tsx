import { useFinancial, useLatestReport } from '@/api/hooks';
import type { Financial } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Button, DataList, EmptyState, ErrorState, Pill, Skeleton, ZoneBadge } from '@/components/ui';
import { common } from '@/i18n/common';
import { useLang, useT } from '@/i18n/I18nProvider';
import { dayMonth, money, percent, dayMonthWhen } from '@/lib/format';
import { SectionHead } from './SectionHead';
import { dict } from './i18n';
import styles from './Profile.module.css';

/** «Доходы и расходы»: what the assessments are built on, with links back into onboarding to edit. */
export function FinanceSection() {
  const t = useT(dict);
  const { data, isLoading, error, refetch } = useFinancial();
  return (
    <>
      <SectionHead title={t.sections.finance} intro={t.finance.intro} />
      {isLoading && (
        <div className={styles.row}>
          <Skeleton height={260} radius={18} style={{ flex: '1 1 300px' }} />
          <Skeleton height={260} radius={18} style={{ flex: '1 1 300px' }} />
        </div>
      )}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && <FinanceContent f={data} />}
    </>
  );
}

function FinanceContent({ f }: { f: Financial }) {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  const expenses = f.expenses.filter((e) => e.amount > 0);
  const updated = (iso: string | null) => (iso ? <p className={styles.muted}>{t.finance.updatedAt(dayMonth(iso, lang))}</p> : null);

  return (
    <>
      <div className={styles.row}>
        <section aria-labelledby="fin-income-title" className={`${styles.panel} ${styles.panelHalf}`}>
          <div className={styles.panelTop}>
            <h3 id="fin-income-title" className={styles.panelTitle}>
              {t.finance.incomes}
            </h3>
            {f.incomes.length > 0 && (
              <Button to="/onboarding?step=1" variant="secondary" size="sm" icon="pencil" aria-label={`${t.finance.edit}: ${t.finance.incomes}`}>
                {t.finance.edit}
              </Button>
            )}
          </div>
          {f.incomes.length === 0 ? (
            <EmptyState icon="coins" title={t.finance.noIncome} text={t.finance.noIncomeText}>
              <Button to="/onboarding?step=1">{t.finance.addIncome}</Button>
            </EmptyState>
          ) : (
            <>
              <DataList
                items={[
                  ...f.incomes.map((i) => ({
                    label: (
                      <span className={styles.labelStack}>
                        {i.source}
                        <span className={styles.muted}>{i.frequency === 'irregular' ? t.finance.irregular : t.finance.monthly}</span>
                      </span>
                    ),
                    value: money(i.amount),
                  })),
                  { label: t.finance.incomeTotal, value: money(f.income_total), strong: true },
                ]}
              />
              {updated(f.incomes_updated_at)}
            </>
          )}
        </section>

        <section aria-labelledby="fin-exp-title" className={`${styles.panel} ${styles.panelHalf}`}>
          <div className={styles.panelTop}>
            <h3 id="fin-exp-title" className={styles.panelTitle}>
              {t.finance.expenses}
            </h3>
            {f.expenses_set && (
              <Button to="/onboarding?step=2" variant="secondary" size="sm" icon="pencil" aria-label={`${t.finance.edit}: ${t.finance.expenses}`}>
                {t.finance.edit}
              </Button>
            )}
          </div>
          {!f.expenses_set ? (
            <EmptyState icon="list" title={t.finance.noExpenses} text={t.finance.noExpensesText}>
              <Button to="/onboarding?step=2">{t.finance.addExpenses}</Button>
            </EmptyState>
          ) : (
            <>
              <DataList
                items={[
                  ...expenses.map((e) => ({ label: e.label || t.finance.categories[e.category], value: money(e.amount) })),
                  { label: t.finance.expensesTotal, value: money(f.expenses_total), strong: true },
                ]}
              />
              {updated(f.expenses_updated_at)}
            </>
          )}
        </section>
      </div>

      {f.incomes.length > 0 && (
        <section aria-labelledby="fin-sum-title" className={styles.panel}>
          <div className={styles.panelTop}>
            <h3 id="fin-sum-title" className={styles.panelTitle}>
              {t.finance.summary}
            </h3>
            <ZoneBadge zone={f.zone} size="sm" />
          </div>
          <div className={styles.summaryRow}>
            <div className={styles.summaryList}>
              <DataList
                items={[
                  { label: t.finance.income, value: money(f.income_total) },
                  { label: t.finance.expensesRow, value: money(-f.expenses_total) },
                  { label: t.finance.payments, value: money(-f.payments_total) },
                  { label: t.finance.free, value: money(f.free), strong: true },
                ]}
              />
            </div>
            <div className={styles.loadBox}>
              <span className={styles.muted}>{t.finance.load}</span>
              <b className={styles.loadValue}>{percent(f.load)}</b>
              <span className={styles.muted}>{t.finance.loadNote}</span>
              <Button to="/credits" variant="link" iconRight="arrowRight">
                {t.finance.credits} · {c.credits(f.credits_count)}
              </Button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/** «Источники кредитных данных»: the latest credit report, report vs manual credits, auto-update. */
export function SourcesSection() {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  const report = useLatestReport();
  const financial = useFinancial();
  const r = report.data;
  const f = financial.data;

  return (
    <>
      <SectionHead title={t.sections.sources} intro={t.sources.intro} />
      {(report.isLoading || financial.isLoading) && <Skeleton height={220} radius={18} />}
      {report.error && <ErrorState error={report.error} onRetry={() => report.refetch()} />}

      {!report.isLoading && !report.error && (
        <section aria-labelledby="src-report-title" className={styles.panel}>
          <div className={styles.panelTop}>
            <h3 id="src-report-title" className={styles.panelTitle}>
              {t.sources.report}
            </h3>
          </div>
          {r ? (
            <>
              <div className={styles.fileRow}>
                <span aria-hidden="true" className={styles.fileIcon}>
                  <Icon name={r.status === 'processed' ? 'fileText' : 'fileX'} size={22} />
                </span>
                <span className={styles.fileText}>
                  <b>{r.filename}</b>
                  <span className={styles.muted}>
                    {t.sources.reportFrom(dayMonthWhen(r.uploaded_at, lang))}
                    {r.status === 'processed' && ` · ${t.sources.found(c.obligations(r.obligations.length))}`}
                  </span>
                  {r.status === 'failed' && r.error_code && <span className={styles.errorText}>{t.sources.errors[r.error_code]}</span>}
                </span>
                {r.status === 'processed' ? (
                  <Pill tone="success" icon="checkCircle" size="sm">
                    {t.sources.processed}
                  </Pill>
                ) : (
                  <Pill tone="danger" icon="alert" size="sm">
                    {t.sources.failed}
                  </Pill>
                )}
              </div>
              {f && (
                <DataList
                  items={[
                    { label: t.sources.fromReport, value: c.credits(f.credits_from_report) },
                    { label: t.sources.manual, value: c.credits(f.credits_manual) },
                  ]}
                />
              )}
              <div className={styles.actions}>
                <Button to="/onboarding?step=3" icon="upload">
                  {t.sources.upload}
                </Button>
                <Button to="/credits" variant="secondary">
                  {t.sources.openCredits}
                </Button>
              </div>
            </>
          ) : (
            <EmptyState icon="file" title={t.sources.noReport} text={t.sources.noReportText}>
              <Button to="/onboarding?step=3" icon="upload">
                {t.sources.uploadFirst}
              </Button>
              {f && f.credits_manual > 0 && (
                <Button to="/credits" variant="secondary">
                  {t.sources.openCredits} · {c.credits(f.credits_manual)}
                </Button>
              )}
            </EmptyState>
          )}
        </section>
      )}

      <section aria-labelledby="src-auto-title" className={`${styles.panel} ${styles.panelDashed}`}>
        <div className={styles.panelTop}>
          <h3 id="src-auto-title" className={`${styles.panelTitle} ${styles.titleMuted}`}>
            <Icon name="refresh" size={18} />
            {t.sources.auto}
          </h3>
          <Pill tone="neutral" size="sm">
            {t.sources.autoStatus}
          </Pill>
        </div>
        <p className={styles.bodyText}>{t.sources.autoText}</p>
      </section>
    </>
  );
}
