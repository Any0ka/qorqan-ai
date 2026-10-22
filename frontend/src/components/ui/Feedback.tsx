import type { CSSProperties, ReactNode } from 'react';
import { ApiError } from '@/api/client';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { Icon, type IconName } from '../Icon';
import { Button } from './Button';
import type { Tone } from './Badge';
import styles from './Feedback.module.css';

/** Grey placeholder shaped like the content it replaces. */
export function Skeleton({ height = 16, width = '100%', radius = 8, style }: { height?: number | string; width?: number | string; radius?: number; style?: CSSProperties }) {
  return <span aria-hidden="true" className={styles.skeleton} style={{ height, width, borderRadius: radius, ...style }} />;
}

/** Page-level skeleton: header line plus a few blocks. */
export function PageSkeleton({ blocks = 3 }: { blocks?: number }) {
  const t = useT(common);
  return (
    <div aria-busy="true" aria-label={t.loading} className={styles.pageSkeleton}>
      <Skeleton height={180} radius={20} />
      <div className={styles.skeletonRow}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={112} radius={16} />
        ))}
      </div>
      {Array.from({ length: blocks - 1 }, (_, i) => (
        <Skeleton key={i} height={220} radius={20} />
      ))}
    </div>
  );
}

/** «Не удалось загрузить …» — what happened, what to do, support code in small print. */
export function ErrorState({ title, error, onRetry, compact }: { title?: string; error?: unknown; onRetry?: () => void; compact?: boolean }) {
  const t = useT(common);
  const status = error instanceof ApiError ? error.status : 0;
  const code = `QG-${status === 0 ? '0000' : 5000 + status}`;
  const text = error instanceof ApiError && error.code === 'network' ? t.errors.network : t.loadError.text;
  return (
    <div role="alert" className={`${styles.errorState} ${compact ? styles.compact : ''}`}>
      <span className={styles.errorIcon} aria-hidden="true">
        <Icon name="alert" size={24} />
      </span>
      <b className={styles.errorTitle}>{title ?? t.loadError.title}</b>
      <p className={styles.errorText}>{text}</p>
      {onRetry && (
        <Button variant="secondary" icon="refresh" onClick={onRetry}>
          {t.retry}
        </Button>
      )}
      <span className={styles.errorCode}>{t.loadError.code(code)}</span>
    </div>
  );
}

/** Empty state always offers the next action. */
export function EmptyState({ icon = 'search', title, text, children }: { icon?: IconName; title: ReactNode; text?: ReactNode; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <Icon name={icon} size={24} />
      </span>
      <b className={styles.emptyTitle}>{title}</b>
      {text && <p className={styles.emptyText}>{text}</p>}
      {children && <div className={styles.emptyActions}>{children}</div>}
    </div>
  );
}

/** Inline message box (warnings, info, success, errors next to an action). */
export function Alert({
  tone = 'neutral',
  icon,
  title,
  children,
  actions,
  role,
  className,
}: {
  tone?: Tone;
  icon?: IconName;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  role?: 'alert' | 'status';
  className?: string;
}) {
  const defaultIcon: Record<Tone, IconName> = { success: 'checkCircle', warning: 'triangle', danger: 'octagon', neutral: 'info', teal: 'sparkle', navy: 'info' };
  return (
    <div role={role} className={[styles.alert, styles['alert_' + tone], className].filter(Boolean).join(' ')}>
      <span className={styles.alertIcon} aria-hidden="true">
        <Icon name={icon ?? defaultIcon[tone]} size={20} />
      </span>
      <div className={styles.alertBody}>
        {title && <b className={styles.alertTitle}>{title}</b>}
        {children && <div className={styles.alertText}>{children}</div>}
        {actions && <div className={styles.alertActions}>{actions}</div>}
      </div>
    </div>
  );
}

/** Small-print legal note at the bottom of assessment screens. */
export function Disclaimer({ children }: { children?: ReactNode }) {
  const t = useT(common);
  return <p className={styles.disclaimer}>{children ?? t.disclaimer}</p>;
}

/** Definition list of label → value rows with dividers. */
export function DataList({ items, dense }: { items: Array<{ label: ReactNode; value: ReactNode; extra?: ReactNode; strong?: boolean }>; dense?: boolean }) {
  return (
    <dl className={`${styles.dataList} ${dense ? styles.dense : ''}`}>
      {items.map((it, i) => (
        <div key={i} className={`${styles.dataRow} ${it.strong ? styles.dataStrong : ''}`}>
          <dt>{it.label}</dt>
          <dd>{it.value}</dd>
          {it.extra}
        </div>
      ))}
    </dl>
  );
}

/** KPI tile: title + icon, big number, note. */
export function Kpi({
  title,
  icon,
  value,
  note,
  noteTone,
  noteIcon,
  dashed,
  muted,
}: {
  title: ReactNode;
  icon?: IconName;
  value: ReactNode;
  note?: ReactNode;
  noteTone?: 'danger' | 'warning' | 'success';
  noteIcon?: IconName;
  dashed?: 'neutral' | 'warning';
  muted?: boolean;
}) {
  return (
    <article className={`${styles.kpi} ${dashed ? styles['kpiDashed_' + dashed] : ''}`}>
      <div className={styles.kpiHead}>
        <h3 className={styles.kpiTitle}>{title}</h3>
        {icon && (
          <span aria-hidden="true" className={styles.kpiIcon}>
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>
      <p className={`${styles.kpiValue} ${muted ? styles.kpiMuted : ''}`}>{value}</p>
      {note && (
        <p className={`${styles.kpiNote} ${noteTone ? styles['note_' + noteTone] : ''}`}>
          {noteIcon && <Icon name={noteIcon} size={14} strokeWidth={2.2} />}
          {note}
        </p>
      )}
    </article>
  );
}
