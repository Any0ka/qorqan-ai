import { useMarkPaid } from '@/api/hooks';
import type { Credit, CreditsResponse } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Button, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useLang, useT } from '@/i18n/I18nProvider';
import { money } from '@/lib/format';
import { dateIn, daysAgo } from './helpers';
import { dict } from './i18n';
import styles from './Credits.module.css';

/** Overdue payment (red, role=alert) and stale data (amber) blocks from Credits-Overdue. */
export function CreditAlerts({ items, report, onEdit }: { items: Credit[]; report: CreditsResponse['report']; onEdit: (id: string) => void }) {
  const overdue = items.filter((c) => c.status === 'overdue').sort((a, b) => b.overdue_days - a.overdue_days);
  const stale = items.filter((c) => c.stale);
  return (
    <>
      {overdue.length > 0 && <OverdueAlert credit={overdue[0]} others={overdue.slice(1)} />}
      {stale.length > 0 && <StaleAlert stale={stale} report={report} onEdit={onEdit} />}
    </>
  );
}

function OverdueAlert({ credit, others }: { credit: Credit; others: Credit[] }) {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  const toast = useToast();
  const markPaid = useMarkPaid();
  const mfo = credit.type === 'microloan';
  const paid = () =>
    markPaid.mutate(credit.id, {
      onSuccess: () => toast({ tone: 'success', text: t.overdue.paidToast(credit.organization) }),
      onError: () => toast({ tone: 'error', text: c.saveFailed }),
    });

  return (
    <section role="alert" aria-labelledby="od-title" className={styles.overdue}>
      <div className={styles.overdueMain}>
        <span aria-hidden="true" className={styles.overdueIcon}>
          <Icon name="octagon" size={24} />
        </span>
        <div className={styles.overdueBody}>
          <h2 id="od-title" className={styles.overdueTitle}>
            {t.overdue.title(t.typeDat[credit.type], credit.overdue_days)}
          </h2>
          <p className={styles.overdueText}>
            {t.overdue.text(credit.organization, money(credit.monthly_payment), credit.next_payment_date ? dateIn(credit.next_payment_date, lang, 'loc') : '—')}
          </p>
          {others.length > 0 && <p className={styles.overdueText}>{t.overdue.more(others.map((o) => o.organization).join(', '))}</p>}
          <div className={styles.alertActions}>
            <Button size="lg" onClick={paid} disabled={markPaid.isPending}>
              {t.overdue.markPaid}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              icon="sparkle"
              className={styles.aiBtn}
              to={`/ai?q=${encodeURIComponent(t.overdue.question(credit.organization))}`}
            >
              {mfo ? t.overdue.negotiateMfo : t.overdue.negotiateBank}
            </Button>
          </div>
        </div>
      </div>
      <div className={styles.steps}>
        <h3>{t.overdue.stepsTitle}</h3>
        <ol>
          <li>{t.overdue.step1}</li>
          <li>{mfo ? t.overdue.step2Mfo : t.overdue.step2Bank}</li>
          <li>
            <b>{t.overdue.step3Strong}</b>
            {t.overdue.step3Rest}
          </li>
        </ol>
      </div>
    </section>
  );
}

function StaleAlert({ stale, report, onEdit }: { stale: Credit[]; report: CreditsResponse['report']; onEdit: (id: string) => void }) {
  const t = useT(dict);
  const c = useT(common);
  const fromReport = report && stale.some((x) => x.source === 'report');
  const oldest = stale.map((x) => x.data_as_of).sort()[0];
  const ago = c.daysAgo(daysAgo(fromReport ? report.uploaded_at : oldest));
  return (
    <section aria-labelledby="st-title" className={styles.stale}>
      <div className={styles.staleMain}>
        <Icon name="refresh" size={22} />
        <div>
          <h2 id="st-title" className={styles.staleTitle}>
            {t.stale.title}
          </h2>
          <p className={styles.staleText}>{fromReport ? t.stale.textReport(ago) : t.stale.textManual(ago)}</p>
        </div>
      </div>
      <div className={styles.staleActions}>
        <Button to="/onboarding?step=3">{t.stale.upload}</Button>
        <Button variant="secondary" className={styles.staleBtn} onClick={() => onEdit(stale[0].id)}>
          {t.stale.manual}
        </Button>
      </div>
    </section>
  );
}

export function OverdueFootnote() {
  const t = useT(dict);
  return <p className={styles.footnote}>{t.overdue.footnote}</p>;
}
