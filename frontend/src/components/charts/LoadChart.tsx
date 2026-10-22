import { monthName } from '@/lib/format';
import type { Lang } from '@/i18n/I18nProvider';
import styles from './charts.module.css';

interface LoadChartProps {
  series: Array<{ month: string; load: number }>;
  lang: Lang;
  ariaLabel: string;
  zoneLabels: { high: string; caution: string; stable: string };
  /** Optional dashed target line, e.g. 0.35 for the plan goal. */
  target?: { value: number; label: string };
}

const W = 460;
const H = 204;
const L = 40;
const R = 444;
const TOP = 16;
const BOTTOM = 160;

/** Debt load by month on top of the three qorgan zones (stable ≤30% · caution · high ≥45%). */
export function LoadChart({ series, lang, ariaLabel, zoneLabels, target }: LoadChartProps) {
  if (!series.length) return null;
  const maxLoad = Math.max(0.6, Math.ceil((Math.max(...series.map((s) => s.load)) + 0.05) * 10) / 10);
  const y = (v: number) => BOTTOM - (Math.min(v, maxLoad) / maxLoad) * (BOTTOM - TOP);
  const pad = 8;
  const x = (i: number) => (series.length === 1 ? (L + R) / 2 : L + pad + ((R - L - 2 * pad) * i) / (series.length - 1));
  const line = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.load).toFixed(1)}`).join('');
  const first = series[0];
  const last = series[series.length - 1];

  return (
    <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${W} ${H}`} className={styles.chart}>
      <rect x={L} y={TOP} width={R - L} height={y(0.45) - TOP} fill="var(--danger-tint)" fillOpacity="0.7" />
      <rect x={L} y={y(0.45)} width={R - L} height={y(0.3) - y(0.45)} fill="var(--warning-tint)" fillOpacity="0.7" />
      <rect x={L} y={y(0.3)} width={R - L} height={BOTTOM - y(0.3)} fill="var(--success-tint)" fillOpacity="0.55" />
      <path d={`M${L} ${BOTTOM}H${R}`} stroke="var(--axis)" strokeWidth="1" />
      <text x={L - 6} y={y(0.45) + 4} textAnchor="end" className={styles.axis}>45%</text>
      <text x={L - 6} y={y(0.3) + 4} textAnchor="end" className={styles.axis}>30%</text>
      <text x={L - 6} y={BOTTOM + 4} textAnchor="end" className={styles.axis}>0%</text>
      <text x={L + 8} y={TOP + 16} className={styles.zoneHigh}>{zoneLabels.high}</text>
      <text x={L + 56} y={y(0.3) - 4} className={styles.zoneCaution}>{zoneLabels.caution}</text>
      <text x={L + 8} y={BOTTOM - 10} className={styles.zoneStable}>{zoneLabels.stable}</text>
      {target && (
        <>
          <path d={`M${L} ${y(target.value)}H${R}`} stroke="var(--teal-700)" strokeWidth="1.5" strokeDasharray="5 5" />
          <text x={R - 4} y={y(target.value) - 6} textAnchor="end" className={styles.target}>{target.label}</text>
        </>
      )}
      <path d={line} fill="none" stroke="var(--data-1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {series.length > 1 && (
        <>
          <circle cx={x(0)} cy={y(first.load)} r="4" fill="var(--data-1)" />
          <text x={x(0) + 8} y={y(first.load) - 7} className={styles.value}>{Math.round(first.load * 100)}%</text>
        </>
      )}
      <circle cx={x(series.length - 1)} cy={y(last.load)} r="7" fill="#fff" />
      <circle cx={x(series.length - 1)} cy={y(last.load)} r="5" fill="var(--data-1)" />
      <text x={x(series.length - 1) - 16} y={y(last.load) - 8} textAnchor="end" className={styles.valueStrong}>
        {Math.round(last.load * 100)}%
      </text>
      <g textAnchor="middle" className={styles.axis}>
        {series.map((p, i) => (
          <text key={p.month} x={x(i)} y={BOTTOM + 22}>
            {monthName(p.month, lang, 'short')}
          </text>
        ))}
      </g>
    </svg>
  );
}
