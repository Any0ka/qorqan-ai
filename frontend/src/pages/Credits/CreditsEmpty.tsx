import type { CreditsResponse } from '@/api/types';
import { Button } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { money, percent } from '@/lib/format';
import { Tile } from './SummaryTiles';
import { dict } from './i18n';
import styles from './Credits.module.css';

/** Credits-Empty: zero tiles and the «no active credits» card with the next actions. */
export function CreditsEmpty({ summary, onAdd }: { summary: CreditsResponse['summary']; onAdd: () => void }) {
  const t = useT(dict);
  return (
    <>
      <section aria-label={t.summary.label}>
        <dl className={`${styles.tiles} ${styles.emptyTiles}`}>
          <Tile label={t.summary.debt} value={money(summary.total_debt)} />
          <Tile label={t.summary.count} value={String(summary.count)} />
          <Tile label={t.summary.payments} value={money(summary.monthly_payments)} />
          <Tile label={t.summary.load} value={percent(summary.load)} note={t.summary.stable} noteTone="success" />
        </dl>
      </section>
      <section aria-labelledby="e-title" className={styles.emptyCard}>
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <circle cx="60" cy="60" r="56" fill="var(--navy-50)" />
          <path
            d="M60 26c11 0 21 3.2 28.6 7.6v23.6c0 17-11.8 30.2-28.6 36.2C43.2 87.4 31.4 74.2 31.4 57.2V33.6C39 29.2 49 26 60 26z"
            fill="#fff"
            stroke="var(--navy-800)"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M47.5 59.5l8.5 8.5 16.5-17" stroke="var(--success)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 id="e-title" className={styles.emptyTitle}>
          {t.empty.title}
        </h2>
        <p className={styles.emptyText}>{t.empty.text}</p>
        <div className={styles.emptyActions}>
          <Button to="/check" size="lg">
            {t.empty.check}
          </Button>
          <Button variant="secondary" size="lg" icon="plus" className={styles.semibold} onClick={onAdd}>
            {t.empty.add}
          </Button>
        </div>
        <p className={styles.emptyHint}>{t.empty.hint}</p>
      </section>
    </>
  );
}
