import type { CreditsResponse } from '@/api/types';
import { common } from '@/i18n/common';
import { useLang, useT } from '@/i18n/I18nProvider';
import { dayMonth, dayMonthShort, money } from '@/lib/format';
import { dict } from './i18n';
import styles from './Credits.module.css';

type Summary = CreditsResponse['summary'];

export function Tile({ label, value, note, noteTone }: { label: string; value: string; note?: string; noteTone?: 'warning' | 'danger' | 'success' }) {
  return (
    <div className={styles.tile}>
      <dt className={styles.tileLabel}>{label}</dt>
      <dd className={styles.tileValue}>{value}</dd>
      {note && <dd className={`${styles.tileNote} ${noteTone ? styles['note_' + noteTone] : ''}`}>{note}</dd>}
    </div>
  );
}

/** Four tiles on desktop/tablet, one compact card on mobile (M-Credits). */
export function SummaryTiles({ summary: s }: { summary: Summary }) {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  const next = s.next_payment;
  const nextTone = next ? (next.days_until < 0 ? 'danger' : next.days_until <= 3 ? 'warning' : undefined) : undefined;
  const nextWhen = next ? (next.days_until < 0 ? t.summary.overdue(-next.days_until) : c.inDays(next.days_until)) : '';

  return (
    <section aria-label={t.summary.label}>
      <dl className={`${styles.tiles} ${styles.desktopTiles}`}>
        <Tile label={t.summary.debt} value={money(s.total_debt)} />
        <Tile label={t.summary.count} value={String(s.count)} />
        <Tile label={t.summary.payments} value={money(s.monthly_payments)} />
        <Tile
          label={t.summary.next}
          value={next ? dayMonth(next.date, lang) : '—'}
          note={next ? t.summary.nextNote(next.organization, money(next.amount), nextWhen) : undefined}
          noteTone={nextTone}
        />
      </dl>
      <div className={styles.mSummary}>
        <dl className={styles.mTotal}>
          <dt>{t.summary.debt}</dt>
          <dd>{money(s.total_debt)}</dd>
        </dl>
        <dl className={styles.mGrid}>
          <div>
            <dt>{t.summary.mActive}</dt>
            <dd>{s.count}</dd>
          </div>
          <div>
            <dt>{t.summary.mMonthly}</dt>
            <dd>{money(s.monthly_payments)}</dd>
          </div>
          <div>
            <dt>{t.summary.mNext}</dt>
            <dd className={nextTone ? styles['note_' + nextTone] : undefined}>{next ? dayMonthShort(next.date, lang) : '—'}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
