import { monthName } from '@/lib/format';
import type { Lang } from '@/i18n/I18nProvider';
import styles from './charts.module.css';

export interface DebtPoint {
  month: string;
  debt: number;
  kind: 'actual' | 'forecast';
  event?: string | null;
  event_amount?: number | null;
}

interface DebtChartProps {
  series: DebtPoint[];
  lang: Lang;
  ariaLabel: string;
  todayLabel: string;
  /** Label for an event marker, e.g. "Рассрочка +525 тыс." */
  eventLabel?: (p: DebtPoint) => string | null;
  /** "3,45 млн ₸" */
  formatValue: (n: number) => string;
  /** "4,0 млн" */
  formatAxis: (n: number) => string;
}

const W = 680;
const H = 252;
const L = 48;
const R = 664;
const TOP = 16;
const BOTTOM = 216;

/** Debt over time: solid line for actual months, dashed for the forecast, a "today" marker between. */
export function DebtChart({ series, lang, ariaLabel, todayLabel, eventLabel, formatValue, formatAxis }: DebtChartProps) {
  if (series.length < 2) return null;
  const values = series.map((p) => p.debt);
  const step = 500_000;
  let lo = Math.floor(Math.min(...values) / step) * step;
  let hi = Math.ceil(Math.max(...values) / step) * step;
  if (hi === lo) hi = lo + step;
  if ((hi - lo) / step < 3) lo = Math.max(0, hi - 3 * step);
  // Leave headroom at the top for labels.
  const yMax = hi + (hi - lo) * 0.08;
  const yMin = lo - (hi - lo) * 0.08;
  const x = (i: number) => L + ((R - L) * i) / (series.length - 1);
  const y = (v: number) => BOTTOM - ((v - yMin) / (yMax - yMin)) * (BOTTOM - TOP);
  const ticks: number[] = [];
  for (let v = hi; v >= lo; v -= step) ticks.push(v);

  const lastActual = series.reduce((acc, p, i) => (p.kind === 'actual' ? i : acc), 0);
  const actual = series.slice(0, lastActual + 1);
  const forecast = series.slice(lastActual);
  const path = (pts: DebtPoint[], offset: number) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i + offset).toFixed(1)} ${y(p.debt).toFixed(1)}`).join('');
  const area = `${path(actual, 0)}L${x(lastActual).toFixed(1)} ${BOTTOM}L${L} ${BOTTOM}Z`;
  const last = series[series.length - 1];
  const now = series[lastActual];

  return (
    <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${W} ${H}`} className={styles.chart}>
      {ticks.map((v) => (
        <g key={v}>
          <path d={`M${L} ${y(v)}H${R}`} stroke="var(--grid)" strokeWidth="1" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" className={styles.axis}>
            {formatAxis(v)}
          </text>
        </g>
      ))}
      <path d={`M${L} ${BOTTOM}H${R}`} stroke="var(--axis)" strokeWidth="1" />
      {lastActual < series.length - 1 && (
        <>
          <path d={`M${x(lastActual)} ${TOP}V${BOTTOM}`} stroke="var(--axis)" strokeWidth="1" />
          <text x={x(lastActual) + 4} y={BOTTOM - 8} className={styles.axis}>
            {todayLabel}
          </text>
        </>
      )}
      <path d={area} fill="var(--data-1)" fillOpacity="0.1" />
      <path d={path(actual, 0)} fill="none" stroke="var(--data-1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {forecast.length > 1 && (
        <path d={path(forecast, lastActual)} fill="none" stroke="var(--data-1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 6" />
      )}
      {series.map((p, i) => {
        const text = p.event && eventLabel ? eventLabel(p) : null;
        if (!text) return null;
        const left = i > series.length / 2;
        return (
          <g key={`e${i}`}>
            <circle cx={x(i)} cy={y(p.debt)} r="5" fill="#fff" stroke="var(--data-1)" strokeWidth="2.5" />
            <text x={x(i) + (left ? -8 : 8)} y={y(p.debt) - 14 - (i % 2) * 4} textAnchor={left ? 'end' : i % 2 ? 'start' : 'end'} className={styles.note}>
              {text}
            </text>
          </g>
        );
      })}
      <circle cx={x(lastActual)} cy={y(now.debt)} r="7" fill="#fff" />
      <circle cx={x(lastActual)} cy={y(now.debt)} r="5" fill="var(--data-1)" />
      <text x={x(lastActual) + 10} y={y(now.debt) - 10} className={styles.valueStrong}>
        {formatValue(now.debt)}
      </text>
      {lastActual < series.length - 1 && (
        <>
          <circle cx={x(series.length - 1)} cy={y(last.debt)} r="4.5" fill="var(--data-1)" />
          <text x={x(series.length - 1) - 4} y={y(last.debt) - 28} textAnchor="end" className={styles.value}>
            {formatValue(last.debt)}
          </text>
        </>
      )}
      <g textAnchor="middle" className={styles.axis}>
        {series.map((p, i) => (
          <text key={p.month} x={x(i)} y={H - 14}>
            {monthName(p.month, lang, 'short')}
          </text>
        ))}
      </g>
    </svg>
  );
}

/** Legend: solid "Факт" and dashed "Прогноз". */
export function DebtLegend({ actual, forecast }: { actual: string; forecast: string }) {
  return (
    <div className={styles.legend}>
      <span>
        <svg width="24" height="8" viewBox="0 0 24 8" aria-hidden="true">
          <path d="M1 4h22" stroke="var(--data-1)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        {actual}
      </span>
      <span>
        <svg width="24" height="8" viewBox="0 0 24 8" aria-hidden="true">
          <path d="M1 4h22" stroke="var(--data-1)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 4" />
        </svg>
        {forecast}
      </span>
    </div>
  );
}
