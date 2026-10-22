import { useEffect, useRef, useState } from 'react';
import { useMarkClosed } from '@/api/hooks';
import type { Credit, CreditsResponse } from '@/api/types';
import { Icon, type IconName } from '@/components/Icon';
import { Button, ConfirmDialog, IconButton, ProgressBar, Segments, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useLang, useT } from '@/i18n/I18nProvider';
import { money, percent } from '@/lib/format';
import { dateIn, daysAgo, FEMININE, useStableCallback } from './helpers';
import { dict } from './i18n';
import styles from './Credits.module.css';

const SCHEDULE_PREVIEW = 3;

interface Props {
  credit: Credit;
  report: CreditsResponse['report'];
  /** The panel sits under the list (tablet/mobile): bring it into view when it opens. */
  scrollIntoView: boolean;
  onClose: () => void;
  onEdit: () => void;
  onClosed: () => void;
}

/** Detail panel of one obligation (aside on desktop, section under the list on smaller screens). */
export function CreditDetail({ credit: r, report, scrollIntoView, onClose, onEdit, onClosed }: Props) {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  const toast = useToast();
  const markClosed = useMarkClosed();
  const [confirm, setConfirm] = useState(false);
  const [allSchedule, setAllSchedule] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const closeConfirm = useStableCallback(() => setConfirm(false));

  useEffect(() => {
    if (!scrollIntoView) return;
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    headingRef.current?.focus({ preventScroll: true });
    // Only when a credit is opened, not on every layout change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const soon = r.flags.includes('due_soon') && r.days_until_next !== null;
  const when = soon ? c.inDays(r.days_until_next!) : '';
  const note: { tone: 'warning' | 'danger' | 'neutral' | 'success'; icon: IconName; title: string; text: string } | null =
    r.status === 'overdue'
      ? { tone: 'danger', icon: 'octagon', title: t.status.overdue(r.overdue_days), text: t.detail.noteOverdue(r.next_payment_date ? dateIn(r.next_payment_date, lang, 'attr') : '—') }
      : r.status === 'attention'
        ? { tone: 'warning', icon: 'triangle', title: t.status.attention, text: soon ? t.detail.noteExpensiveSoon(when) : t.detail.noteExpensive }
        : r.status === 'closed'
          ? { tone: 'success', icon: 'checkCircle', title: FEMININE[r.type] ? t.status.closedF : t.status.closedM, text: t.detail.closedNote }
          : soon
            ? { tone: 'neutral', icon: 'clock', title: t.detail.soonTitle, text: t.detail.noteSoon(when) }
            : null;

  const isCard = r.is_minimum_payment;
  const details: Array<{ label: string; value: string; warn?: boolean }> = [
    { label: isCard ? t.detail.minimum : t.detail.monthly, value: money(r.monthly_payment) },
  ];
  if (r.original_amount) details.push({ label: t.detail.original, value: money(r.original_amount) });
  if (r.end_date) {
    const until = dateIn(r.end_date, lang, 'dat');
    details.push({ label: t.detail.term, value: r.payments_total ? t.detail.termValue(c.monthsShort(r.payments_total), until) : t.detail.until(until) });
  }
  if (r.overpayment !== null)
    details.push({
      label: t.detail.overpayment,
      value: r.overpayment_rate !== null && r.overpayment > 0 ? `${money(r.overpayment)} · ${percent(r.overpayment_rate)}` : money(r.overpayment),
      warn: r.flags.includes('most_expensive'),
    });
  if (r.rate !== null) details.push({ label: t.detail.rate, value: t.detail.rateValue(String(r.rate).replace('.', ',')) });

  const schedule = allSchedule ? r.schedule : r.schedule.slice(0, SCHEDULE_PREVIEW);
  const hidden = r.schedule.length - SCHEDULE_PREVIEW;
  const firstTone = r.status === 'overdue' ? styles.slotDanger : soon ? styles.slotWarn : styles.slotFirst;

  const reportDate = report && report.id === r.report_id ? report.uploaded_at : r.created_at;
  const sourceText =
    r.source === 'manual'
      ? t.detail.sourceManual(dateIn(r.created_at, lang, 'loc', true))
      : r.corrected_manually
        ? t.detail.sourceCorrected(dateIn(reportDate, lang, 'attr', true))
        : t.detail.sourceReport(dateIn(reportDate, lang, 'loc', true));

  const close = () =>
    markClosed.mutate(r.id, {
      onSuccess: () => {
        setConfirm(false);
        toast({ tone: 'success', text: t.detail.closedToast(r.organization) });
        onClosed();
      },
      onError: () => toast({ tone: 'error', text: c.saveFailed }),
    });

  return (
    <aside ref={ref} aria-labelledby="detail-title" className={styles.detail}>
      <div className={styles.detailHead}>
        <div>
          <h2 id="detail-title" ref={headingRef} tabIndex={-1} className={styles.detailTitle}>
            {r.organization}
          </h2>
          <p className={styles.detailType}>{c.creditType[r.type]}</p>
        </div>
        <IconButton icon="x" label={t.detail.close} onClick={onClose} />
      </div>

      {note && (
        <div className={`${styles.note} ${styles['box_' + note.tone]}`}>
          <span className={styles.noteTitle}>
            <Icon name={note.icon} size={16} strokeWidth={2.2} />
            {note.title}
          </span>
          <p className={styles.noteText}>{note.text}</p>
        </div>
      )}

      <div className={styles.balance}>
        <span>{t.detail.balance}</span>
        <b>{money(r.balance)}</b>
      </div>

      {r.payments_total ? (
        <div className={styles.progress}>
          {r.payments_total <= 24 ? (
            <Segments total={r.payments_total} done={Math.min(r.payments_made, r.payments_total)} label={t.detail.paid(r.payments_made, r.payments_total)} />
          ) : (
            <ProgressBar value={r.payments_made / r.payments_total} label={t.detail.paid(r.payments_made, r.payments_total)} />
          )}
          <span aria-hidden="true" className={styles.progressLabel}>
            {t.detail.paid(r.payments_made, r.payments_total)}
          </span>
        </div>
      ) : null}

      <dl className={styles.dl}>
        {details.map((d) => (
          <div key={d.label}>
            <dt>{d.label}</dt>
            <dd className={d.warn ? styles.textWarning : undefined}>{d.value}</dd>
          </div>
        ))}
      </dl>

      {r.schedule.length > 0 && (
        <div className={styles.schedule}>
          <h3>{t.detail.schedule}</h3>
          <ol id={`schedule-${r.id}`}>
            {schedule.map((item, i) => {
              const date = dateIn(item.date, lang);
              return (
                <li key={item.date} className={i === 0 ? firstTone : undefined}>
                  {i === 0 ? (
                    <span>
                      <b>{date}</b>
                      {r.days_until_next !== null && (
                        <span className={r.status === 'overdue' ? styles.textDanger : soon ? styles.textWarning : styles.muted}>
                          {' · '}
                          {r.status === 'overdue' ? t.status.overdue(r.overdue_days).toLowerCase() : c.inDays(r.days_until_next)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span>{item.last ? `${date} · ${t.detail.last}` : date}</span>
                  )}
                  {i === 0 ? <b className={styles.nowrap}>{money(item.amount)}</b> : <span className={styles.nowrap}>{money(item.amount)}</span>}
                </li>
              );
            })}
          </ol>
          {hidden > 0 && (
            <Button variant="link" size="sm" aria-expanded={allSchedule} aria-controls={`schedule-${r.id}`} onClick={() => setAllSchedule((v) => !v)}>
              {allSchedule ? t.detail.showLess : t.detail.showMore(hidden)}
            </Button>
          )}
        </div>
      )}

      <p className={`${styles.source} ${r.stale ? styles.sourceStale : ''}`}>
        <Icon name={r.stale ? 'triangle' : 'file'} size={16} />
        <span>
          {sourceText} {t.detail.updated(c.daysAgo(daysAgo(r.data_as_of)))}
          {r.stale && ` ${t.detail.staleNote}`}
        </span>
      </p>

      <div className={styles.detailActions}>
        <Button variant="secondary" icon="pencil" block className={styles.tallBtn} onClick={onEdit}>
          {t.detail.edit}
        </Button>
        {r.status !== 'closed' && (
          <Button
            variant="secondary"
            icon="sparkle"
            block
            className={`${styles.tallBtn} ${styles.aiBtn}`}
            to={`/ai?q=${encodeURIComponent(t.detail.aiQuestion(t.typeAccOrg[r.type], r.organization))}`}
          >
            {t.detail.askAi}
          </Button>
        )}
        {r.status !== 'closed' && (
          <Button variant="ghost" block className={styles.quietBtn} onClick={() => setConfirm(true)}>
            {t.detail.markClosed}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={closeConfirm}
        onConfirm={close}
        title={t.detail.closeTitle(r.organization)}
        text={t.detail.closeText}
        confirmLabel={t.detail.closeConfirm}
        cancelLabel={t.detail.keep}
        busy={markClosed.isPending}
        danger={false}
      />
    </aside>
  );
}
