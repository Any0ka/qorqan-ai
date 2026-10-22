import type { RiskLevel } from '@/api/types';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import styles from './Meter.module.css';

const clamp = (x: number) => Math.max(0, Math.min(1, x));

/** Debt-load bar with the 30% and 45% thresholds (Обзор, «Твое финансовое состояние»). */
export function LoadScale({
  load,
  label,
  legend,
  legendShort,
}: {
  load: number;
  label: string;
  legend: [string, string, string];
  /** Shorter labels for phones (M-Dashboard: «до 30%» · «» · «от 45% — высокая»). */
  legendShort?: [string, string, string];
}) {
  const tone = load >= 0.45 ? 'danger' : load > 0.3 ? 'warning' : 'success';
  return (
    <div role="img" aria-label={label} className={styles.loadScale}>
      <div className={`${styles.track} ${styles['track_' + tone]}`}>
        <div className={`${styles.fill} ${styles['fill_' + tone]}`} style={{ width: `${clamp(load) * 100}%` }} />
        <div className={styles.tick} style={{ left: '30%' }} />
        <div className={styles.tick} style={{ left: '45%' }} />
      </div>
      <div className={`${styles.legend} ${legendShort ? styles.legendWide : ''}`}>
        <span>{legend[0]}</span>
        <span>{legend[1]}</span>
        <span>{legend[2]}</span>
      </div>
      {legendShort && (
        <div className={`${styles.legend} ${styles.legendShort}`}>
          <span>{legendShort[0]}</span>
          <span>{legendShort[1]}</span>
          <span>{legendShort[2]}</span>
        </div>
      )}
    </div>
  );
}

/** Three-step risk scale: Низкий · Средний · Высокий, with the user's level highlighted. */
export function RiskScale({ risk, yours }: { risk: RiskLevel; yours: string }) {
  const t = useT(common);
  const levels: RiskLevel[] = ['low', 'medium', 'high'];
  const active = levels.indexOf(risk);
  return (
    <div role="img" aria-label={`${t.risk[risk]} — ${yours}`} className={styles.riskScale}>
      <div className={styles.segments}>
        {levels.map((l, i) => (
          <span key={l} className={`${styles.segment} ${styles['seg_' + l]} ${i === active ? styles.segActive : ''}`} />
        ))}
      </div>
      <div className={styles.segmentLabels}>
        {levels.map((l, i) => (
          <span key={l} className={i === active ? styles['label_' + l] : undefined}>
            {t.riskShort[l]}
            {i === active ? ` — ${yours}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Before/after bars with an optional threshold marker (Результат, «Сейчас и после»). */
export function CompareBars({
  title,
  rows,
  max,
  threshold,
  thresholdLabel,
  label,
}: {
  title: string;
  rows: Array<{ label: string; value: number; display: string; tone: 'neutral' | 'danger' | 'warning' | 'success' }>;
  max: number;
  threshold?: number;
  thresholdLabel?: string;
  label: string;
}) {
  const pos = (v: number) => `${clamp(v / max) * 100}%`;
  return (
    <div role="img" aria-label={label} className={styles.compare}>
      <p className={styles.compareTitle}>{title}</p>
      {rows.map((r) => (
        <div key={r.label} className={styles.compareRow}>
          <span className={styles.compareLabel}>{r.label}</span>
          <div className={styles.compareTrack}>
            <div className={`${styles.compareFill} ${styles['cf_' + r.tone]}`} style={{ width: pos(Math.max(r.value, 0)) }} />
            {threshold !== undefined && <div className={styles.compareTick} style={{ left: pos(threshold) }} />}
          </div>
          <b className={`${styles.compareValue} ${styles['cv_' + r.tone]}`}>{r.display}</b>
        </div>
      ))}
      {threshold !== undefined && thresholdLabel && (
        <div className={styles.compareRow}>
          <span className={styles.compareLabel} />
          <span className={styles.compareAxis}>
            <span style={{ left: pos(threshold) }}>{thresholdLabel}</span>
          </span>
          <span className={styles.compareValue} />
        </div>
      )}
    </div>
  );
}

/** Row of segments, e.g. "Погашено 2 из 5 платежей" or onboarding "2 из 3 шагов". */
export function Segments({ total, done, label, tone = 'navy' }: { total: number; done: number; label: string; tone?: 'navy' | 'success' | 'teal' }) {
  return (
    <div role="img" aria-label={label} className={styles.segRow}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`${styles.segItem} ${i < done ? styles['segOn_' + tone] : ''}`} />
      ))}
    </div>
  );
}

/** Thin progress bar for goals. */
export function ProgressBar({ value, label, tone = 'navy' }: { value: number; label: string; tone?: 'navy' | 'teal' | 'success' | 'warning' }) {
  return (
    <div role="img" aria-label={label} className={styles.progress}>
      <div className={`${styles.progressFill} ${styles['pf_' + tone]}`} style={{ width: `${clamp(value) * 100}%` }} />
    </div>
  );
}
