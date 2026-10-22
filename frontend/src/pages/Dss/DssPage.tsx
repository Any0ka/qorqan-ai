import { useEffect, useMemo, useState } from 'react';
import { useDssProblem, useDssRank } from '@/api/hooks';
import { ApiError } from '@/api/client';
import type { DssProblem, DssResult } from '@/api/types';
import { AppPage } from '@/components/layout/AppShell';
import { Alert, Button, Card, CardHeader, ErrorState, Kpi, MoneyField, PageSkeleton, Pill } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { money } from '@/lib/format';
import { HeatmapTable, RankSlope, ScoresChart } from './DssCharts';
import { dict } from './i18n';
import styles from './Dss.module.css';

type Weights = Record<string, number>;
type Matrix = Record<string, Record<string, number | null>>;

const DEFAULT_PRICE = 400_000;
const fmt = (n: number, digits = 3) => n.toFixed(digits).replace('.', ',');
const round2 = (n: number) => Math.round(n * 100) / 100;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** «Выбор банка»: the lab DSS (WSM + TOPSIS) on the user's own income and credits. */
export default function DssPage() {
  const t = useT(dict);
  const [price, setPrice] = useState<number | null>(DEFAULT_PRICE);
  const debouncedPrice = useDebounced(price && price >= 10_000 ? price : DEFAULT_PRICE, 400);
  const { data: problem, isLoading, error, refetch } = useDssProblem(debouncedPrice);

  return (
    <AppPage title={t.title} subtitle={t.subtitle} subtitleIcon="sliders">
      {isLoading && !problem && <PageSkeleton />}
      {error && !problem && <ErrorState error={error} onRetry={() => refetch()} />}
      {problem && <DssContent problem={problem} price={price} onPrice={setPrice} />}
    </AppPage>
  );
}

function DssContent({ problem, price, onPrice }: { problem: DssProblem; price: number | null; onPrice: (p: number | null) => void }) {
  const t = useT(dict);
  const keys = useMemo(() => problem.criteria.map((c) => c.key), [problem]);
  const codes = useMemo(() => problem.alternatives.map((a) => a.code), [problem]);
  const labels = useMemo(() => Object.fromEntries(problem.criteria.map((c) => [c.key, c.label])), [problem]);
  const titles = useMemo(() => Object.fromEntries(problem.alternatives.map((a) => [a.code, a.title])), [problem]);
  const defaultWeights = useMemo<Weights>(() => Object.fromEntries(problem.criteria.map((c) => [c.key, c.weight])), [problem]);

  const [weights, setWeights] = useState<Weights>(defaultWeights);
  const [matrix, setMatrix] = useState<Matrix>(problem.matrix);
  // A new problem (price or language changed) brings a new matrix; the user's weights survive.
  useEffect(() => setMatrix(problem.matrix), [problem.matrix]);

  const sum = round2(Object.values(weights).reduce((a, b) => a + b, 0));
  const sumOk = Math.abs(sum - 1) < 0.005;

  const rank = useDssRank();
  const { mutate } = rank;
  const [result, setResult] = useState<DssResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const input = useDebounced({ weights, matrix }, 250);
  useEffect(() => {
    const w = input.weights;
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    // Rounded sliders rarely sum to exactly 1; the server checks it strictly, so normalize what we send.
    const body = {
      criteria: problem.criteria.map((c) => ({ key: c.key, type: c.type, weight: total > 0 && Math.abs(total - 1) < 0.005 ? w[c.key] / total : w[c.key] })),
      matrix: input.matrix,
    };
    mutate(body, {
      onSuccess: (r) => {
        setResult(r);
        setErrors([]);
      },
      onError: (e) => {
        const list = e instanceof ApiError && Array.isArray(e.detail.errors) ? (e.detail.errors as unknown[]).map(String) : [String(e)];
        setErrors(list);
      },
    });
  }, [input, problem.criteria, mutate]);

  const setWeight = (key: string, value: number) => setWeights((w) => ({ ...w, [key]: value }));
  const normalize = () => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    if (total > 0) setWeights(Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, round2(v / total)])));
  };
  const setCell = (code: string, key: string, raw: string) =>
    setMatrix((m) => ({ ...m, [code]: { ...m[code], [key]: raw.trim() === '' ? null : Number(raw.replace(',', '.')) } }));

  const describe = (e: string) => {
    const [code, alt, rest] = e.split(':');
    const v = t.validation;
    if (code === 'weights_sum') return v.weights_sum((alt ?? '').replace('.', ','));
    if (code === 'missing_values') return v.missing_values(alt, (rest ?? '').split(',').map((k) => labels[k] ?? k).join(', '));
    if (code === 'not_numeric') return v.not_numeric(alt, labels[rest] ?? rest);
    if (code === 'cost_not_positive') return v.cost_not_positive(alt, labels[rest] ?? rest);
    return v.other(e);
  };

  const s = result?.summary;
  const base = problem.base;
  const violating = codes.filter((c) => (matrix[c]?.debt_load ?? 0) > base.max_load);

  return (
    <div className={styles.stack}>
      <p className={styles.intro}>{t.intro}</p>

      <Card>
        <CardHeader title={t.input.title} subtitle={t.input.source[base.source]} />
        <div className={styles.priceField}>
          <MoneyField label={t.input.price} value={price} onChange={onPrice} invalidMessage={t.input.priceInvalid} />
        </div>
        <dl className={styles.baseGrid}>
          <div>
            <dt>{t.input.income}</dt>
            <dd>{money(base.income)}</dd>
          </div>
          <div>
            <dt>{t.input.payments}</dt>
            <dd>{money(base.payments)}</dd>
          </div>
          <div>
            <dt>{t.input.loadNow}</dt>
            <dd>{fmt(base.load_now, 1)}%</dd>
          </div>
        </dl>
        <p className={styles.note}>
          {t.input.maxLoad(base.max_load)} · {t.demoNote}
        </p>
      </Card>

      <Card>
        <CardHeader title={t.weights.title} subtitle={t.weights.subtitle} />
        <div className={styles.weights}>
          {problem.criteria.map((c) => (
            <div key={c.key} className={styles.weight}>
              <label htmlFor={`w-${c.key}`} className={styles.weightLabel}>
                {c.label} <span className={styles.note}>({c.unit})</span>
              </label>
              <span className={styles.weightValue}>{fmt(weights[c.key] ?? 0, 2)}</span>
              <span className={styles.weightType}>
                {t.weights.type[c.type]} · {c.hint}
              </span>
              <input
                id={`w-${c.key}`}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={weights[c.key] ?? 0}
                onChange={(e) => setWeight(c.key, Number(e.target.value))}
                className={styles.range}
              />
            </div>
          ))}
        </div>
        <div className={styles.weightsFoot}>
          <span className={`${styles.sum} ${sumOk ? '' : styles.sumBad}`}>
            {t.weights.sum}: {fmt(sum, 2)}
          </span>
          <Button variant="secondary" size="sm" onClick={normalize} disabled={sum === 0 || sumOk}>
            {t.weights.normalize}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeights(defaultWeights)}>
            {t.weights.reset}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title={t.matrix.title} subtitle={t.matrix.subtitle} actions={<Button variant="ghost" size="sm" onClick={() => setMatrix(problem.matrix)}>{t.matrix.reset}</Button>} />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left' }}>
                  {t.matrix.alternative}
                </th>
                {problem.criteria.map((c) => (
                  <th key={c.key} scope="col">
                    {c.label}
                    <span className={styles.unit}>
                      {c.type} · {c.unit}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {problem.alternatives.map((a) => (
                <tr key={a.code} className={s?.wsm_winner === a.code ? styles.winner : undefined}>
                  <th scope="row">
                    {a.code} · {a.title}
                    <span className={styles.sub}>
                      {money(a.monthly_payment)} {t.matrix.monthly}
                    </span>
                  </th>
                  {problem.criteria.map((c) => (
                    <td key={c.key}>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        aria-label={`${a.code} ${c.label}`}
                        value={matrix[a.code]?.[c.key] ?? ''}
                        onChange={(e) => setCell(a.code, c.key, e.target.value)}
                        className={`${styles.cell} ${c.key === 'debt_load' && violating.includes(a.code) ? styles.cellBad : ''}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {violating.length > 0 && (
          <Alert tone="warning" icon="triangle">
            {t.matrix.constraint(base.max_load, violating.join(', '))}
            {violating.length === codes.length && ` ${t.matrix.constraintAll}`}
          </Alert>
        )}
      </Card>

      {errors.length > 0 && (
        <Alert tone="danger" icon="alert" title={t.validation.title} role="alert">
          <ul className={styles.why}>
            {errors.map((e) => (
              <li key={e}>{describe(e)}</li>
            ))}
          </ul>
        </Alert>
      )}

      {result && s && (
        <div className={`${styles.stack} ${rank.isPending ? styles.stale : ''}`} aria-busy={rank.isPending}>
          <section className={styles.kpis} aria-label={t.results.title}>
            <Kpi title={t.results.wsmWinner} icon="checkCircle" value={s.wsm_winner} note={titles[s.wsm_winner]} />
            <Kpi title={t.results.topsisWinner} icon="checkCircle" value={s.topsis_winner} note={titles[s.topsis_winner]} />
            <Kpi
              title={t.results.agree}
              icon="scales"
              value={s.same_winner ? t.results.sameWinner : t.results.differentWinner}
              note={`${t.results.rho}: ${fmt(s.spearman_rho)} · ${s.identical_ranking ? t.results.identical : t.results.differ(s.differing.join(', '))}`}
              noteTone={s.same_winner ? 'success' : 'warning'}
            />
          </section>

          <Card>
            <CardHeader title={t.table.title} />
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: 'left' }}>
                      {t.table.alternative}
                    </th>
                    <th scope="col">{t.table.wsmScore}</th>
                    <th scope="col">{t.table.wsmRank}</th>
                    <th scope="col">{t.table.topsisC}</th>
                    <th scope="col">{t.table.topsisRank}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.comparison.map((r) => (
                    <tr key={r.code} className={r.wsm_rank === 1 ? styles.winner : undefined}>
                      <th scope="row">
                        {r.code} · {titles[r.code]}
                      </th>
                      <td>{fmt(r.wsm_score)}</td>
                      <td className={styles.rankCell}>{r.wsm_rank}</td>
                      <td>{fmt(r.topsis_closeness)}</td>
                      <td className={styles.rankCell}>
                        {r.topsis_rank}
                        {r.rank_diff > 0 && (
                          <>
                            {' '}
                            <Pill tone="warning" size="xs">
                              {r.topsis_rank < r.wsm_rank ? '↑' : '↓'}
                              {r.rank_diff}
                            </Pill>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className={styles.charts}>
            <Card className={styles.chartCard}>
              <h3 className={styles.chartTitle}>{t.charts.scores}</h3>
              <ScoresChart rows={result.comparison} ariaLabel={t.charts.scoresAria} legend={{ wsm: t.charts.wsm, topsis: t.charts.topsis }} />
            </Card>
            <Card className={styles.chartCard}>
              <h3 className={styles.chartTitle}>{t.charts.ranks}</h3>
              <p className={styles.note}>{t.charts.ranksHint}</p>
              <RankSlope rows={result.comparison} ariaLabel={t.charts.ranks} left="WSM" right="TOPSIS" />
            </Card>
          </div>

          <Card className={styles.chartCard}>
            <h3 className={styles.chartTitle}>{t.charts.heatmap}</h3>
            <p className={styles.note}>{t.charts.heatmapHint}</p>
            <HeatmapTable matrix={result.normalized_linear} keys={keys} labels={labels} codes={codes} />
          </Card>

          <Card>
            <details className={styles.details}>
              <summary>{t.steps.title}</summary>
              <div>
                <h4 className={styles.chartTitle}>{t.steps.weighted}</h4>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col" />
                        {keys.map((k) => (
                          <th key={k} scope="col">
                            {labels[k]}
                          </th>
                        ))}
                        <th scope="col">{t.steps.dBest}</th>
                        <th scope="col">{t.steps.dWorst}</th>
                        <th scope="col">{t.steps.closeness}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.topsis.map((r) => (
                        <tr key={r.code}>
                          <th scope="row">{r.code}</th>
                          {keys.map((k) => (
                            <td key={k}>{fmt(result.weighted[r.code]?.[k] ?? 0, 4)}</td>
                          ))}
                          <td>{fmt(r.d_best, 4)}</td>
                          <td>{fmt(r.d_worst, 4)}</td>
                          <td className={styles.rankCell}>{fmt(r.closeness, 4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={styles.ideal}>
                  <b>{t.steps.best}:</b>
                  {keys.map((k) => (
                    <span key={k}>
                      {labels[k]} {fmt(result.ideal_best[k] ?? 0, 4)}
                    </span>
                  ))}
                </div>
                <div className={styles.ideal}>
                  <b>{t.steps.worst}:</b>
                  {keys.map((k) => (
                    <span key={k}>
                      {labels[k]} {fmt(result.ideal_worst[k] ?? 0, 4)}
                    </span>
                  ))}
                </div>
              </div>
            </details>
          </Card>

          <Card tone="muted">
            <CardHeader title={t.why.title} />
            <ol className={styles.why}>
              {t.why.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            <p className={styles.note}>{t.why.conclusion}</p>
            <p className={styles.note}>{t.taskType}</p>
          </Card>
        </div>
      )}
    </div>
  );
}
