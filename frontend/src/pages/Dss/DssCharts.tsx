import type { DssMatrix, DssResult } from '@/api/types';
import chart from '@/components/charts/charts.module.css';
import styles from './Dss.module.css';

const WSM = 'var(--data-1)';
const TOPSIS = 'var(--data-2)';
const CHANGED = '#c2410c';

/** Grouped bars: WSM score and TOPSIS closeness per alternative, ordered by WSM rank. */
export function ScoresChart({ rows, ariaLabel, legend }: { rows: DssResult['comparison']; ariaLabel: string; legend: { wsm: string; topsis: string } }) {
  const W = 640;
  const H = 240;
  const L = 36;
  const R = 628;
  const TOP = 20;
  const BOTTOM = 200;
  const group = (R - L) / rows.length;
  const bw = Math.min(28, group * 0.34);
  const y = (v: number) => BOTTOM - v * (BOTTOM - TOP);
  return (
    <>
      <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${W} ${H}`} className={chart.chart}>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <path d={`M${L} ${y(v)}H${R}`} stroke="var(--grid)" strokeWidth="1" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" className={chart.axis}>
              {v.toFixed(2)}
            </text>
          </g>
        ))}
        <path d={`M${L} ${BOTTOM}H${R}`} stroke="var(--axis)" strokeWidth="1" />
        {rows.map((r, i) => {
          const cx = L + group * (i + 0.5);
          const bars = [
            { x: cx - bw - 1, v: r.wsm_score, fill: WSM },
            { x: cx + 1, v: r.topsis_closeness, fill: TOPSIS },
          ];
          return (
            <g key={r.code}>
              {bars.map((b, j) => (
                <g key={j}>
                  <rect x={b.x} y={y(b.v)} width={bw} height={Math.max(BOTTOM - y(b.v), 0)} rx="3" fill={b.fill} />
                  <text x={b.x + bw / 2} y={y(b.v) - 5} textAnchor="middle" className={chart.axis}>
                    {b.v.toFixed(2)}
                  </text>
                </g>
              ))}
              <text x={cx} y={H - 18} textAnchor="middle" className={chart.value}>
                {r.code}
              </text>
            </g>
          );
        })}
      </svg>
      <div className={chart.legend}>
        <span>
          <i className={styles.swatch} style={{ background: WSM }} aria-hidden="true" />
          {legend.wsm}
        </span>
        <span>
          <i className={styles.swatch} style={{ background: TOPSIS }} aria-hidden="true" />
          {legend.topsis}
        </span>
      </div>
    </>
  );
}

/** Heatmap of the normalized matrix as a table: one hue, darker = closer to 1 (better). */
export function HeatmapTable({ matrix, keys, labels, codes }: { matrix: DssMatrix; keys: string[]; labels: Record<string, string>; codes: string[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.heat}`}>
        <thead>
          <tr>
            <th scope="col" />
            {keys.map((k) => (
              <th key={k} scope="col">
                {labels[k] ?? k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => (
            <tr key={code}>
              <th scope="row">{code}</th>
              {keys.map((k) => {
                const v = matrix[code]?.[k] ?? 0;
                return (
                  <td key={k} style={{ background: `rgba(61, 111, 182, ${(0.08 + v * 0.82).toFixed(2)})`, color: v > 0.6 ? '#fff' : 'var(--text)' }}>
                    {v.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Slope chart of ranks: WSM on the left, TOPSIS on the right, rank 1 at the top. */
export function RankSlope({ rows, ariaLabel, left, right }: { rows: DssResult['comparison']; ariaLabel: string; left: string; right: string }) {
  const n = rows.length;
  const W = 360;
  const rowH = 34;
  const TOP = 28;
  const H = TOP + rowH * n + 28;
  const X1 = 110;
  const X2 = 250;
  const y = (rank: number) => TOP + rowH * (rank - 0.5);
  return (
    <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${W} ${H}`} className={chart.chart}>
      <text x={X1} y={14} textAnchor="middle" className={chart.value}>
        {left}
      </text>
      <text x={X2} y={14} textAnchor="middle" className={chart.value}>
        {right}
      </text>
      <path d={`M${X1} ${TOP}V${TOP + rowH * n}M${X2} ${TOP}V${TOP + rowH * n}`} stroke="var(--axis)" strokeWidth="1" />
      {rows.map((r) => {
        const color = r.rank_diff ? CHANGED : WSM;
        return (
          <g key={r.code}>
            <path d={`M${X1} ${y(r.wsm_rank)}L${X2} ${y(r.topsis_rank)}`} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx={X1} cy={y(r.wsm_rank)} r="5" fill={color} stroke="#fff" strokeWidth="1.5" />
            <circle cx={X2} cy={y(r.topsis_rank)} r="5" fill={color} stroke="#fff" strokeWidth="1.5" />
            <text x={X1 - 12} y={y(r.wsm_rank) + 4} textAnchor="end" className={chart.value}>
              {r.code} ({r.wsm_rank})
            </text>
            <text x={X2 + 12} y={y(r.topsis_rank) + 4} className={chart.value}>
              ({r.topsis_rank}) {r.code}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
