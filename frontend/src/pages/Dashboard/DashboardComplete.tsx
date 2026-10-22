import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Dashboard } from '@/api/types';
import { DebtChart, DebtLegend, type DebtPoint } from '@/components/charts/DebtChart';
import { LoadChart } from '@/components/charts/LoadChart';
import { Icon } from '@/components/Icon';
import { Button, Card, CardHeader, Kpi, LoadScale, Pill, Row, TileGrid, ToggleGroup, ZoneBadge } from '@/components/ui';
import { common } from '@/i18n/common';
import { useLang, useT } from '@/i18n/I18nProvider';
import { dayMonth, dayMonthShort, millions, money, monthName, monthYear, num, percent, thousands, toDate } from '@/lib/format';
import { dict } from './i18n';
import styles from './Dashboard.module.css';

export function DashboardComplete({ data }: { data: Dashboard }) {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  const m = data.metrics;
  const loadPct = Math.round(m.load * 100);
  const hasCredits = m.credits_count > 0;

  const events = t.state.events(
    data.debt_series
      .filter((p) => p.event === 'installment_added' || p.event === 'microloan_added')
      .map((p) => ({ kind: p.event === 'installment_added' ? ('installment' as const) : ('micro' as const), month: monthName(p.month, lang, 'attr') })),
  );

  return (
    <>
      <Row>
        <Card flex="2 560px" pad="md" aria-labelledby="state-title" style={{ gap: 20 }}>
          <div className={styles.cardTop}>
            <h2 id="state-title" className={styles.mutedTitle}>
              {t.state.title}
            </h2>
            <ZoneBadge zone={m.zone} />
          </div>
          <div className={styles.bigRow}>
            <p className={styles.bigNumber}>{percent(m.load)}</p>
            <p className={styles.bigLead}>{hasCredits ? t.state.lead : t.state.noCredits}</p>
          </div>
          <LoadScale load={m.load} label={t.state.scaleLabel(loadPct)} legend={t.state.legend} legendShort={t.state.legendShort} />
          <div className={styles.stateFoot}>
            {data.load_change && data.load_change.pp !== 0 ? (
              <p className={styles.trend}>
                <Icon name={data.load_change.pp > 0 ? 'trendUp' : 'trendDown'} size={18} className={data.load_change.pp > 0 ? styles.trendBad : styles.trendGood} />
                {t.state.change(data.load_change.pp, monthName(data.load_change.since, lang, 'abl'), data.load_change.pp > 0 ? events : '')}
              </p>
            ) : (
              <span />
            )}
            <details className={styles.details}>
              <summary>{t.state.howTitle}</summary>
              <p>{t.state.how(money(m.monthly_payments), money(m.income), percent(m.load))}</p>
            </details>
          </div>
        </Card>

        <Card tone="navy" flex="1 320px" aria-labelledby="check-title">
          <span aria-hidden="true" className={styles.navyIcon}>
            <Icon name="scales" size={26} />
          </span>
          <h2 id="check-title" className={styles.navyTitle}>
            {t.check.title}
          </h2>
          <p className={styles.navyText}>{t.check.text}</p>
          <Button to="/check" variant="white" size="lg" iconRight="arrowRight" block className={styles.pushDown}>
            {t.check.cta}
          </Button>
          <p className={styles.navyNote}>{t.check.note}</p>
        </Card>
      </Row>

      <TileGrid label={t.kpi.label}>
        <Kpi title={t.kpi.debt} icon="card" value={money(m.total_debt)} note={c.obligations(m.credits_count)} />
        <Kpi title={t.kpi.payments} icon="calendar" value={money(m.monthly_payments)} note={t.kpi.paymentsNote(money(m.income))} />
        <Kpi
          title={t.kpi.load}
          icon="gauge"
          value={percent(m.load)}
          note={data.load_change ? t.kpi.loadSince(c.pp(data.load_change.pp), monthName(data.load_change.since, lang, 'abl')) : undefined}
          noteTone={data.load_change && data.load_change.pp > 0 ? 'danger' : 'success'}
          noteIcon={data.load_change && data.load_change.pp > 0 ? 'arrowUp' : 'arrowDown'}
        />
        <Kpi title={t.kpi.free} icon="coins" value={money(m.free)} note={t.kpi.freeNote} />
      </TileGrid>

      <Row>
        {data.recommendation && (
          <Card flex="2 560px" aria-labelledby="reco-title" className={styles.reco}>
            <span aria-hidden="true" className={styles.recoIcon}>
              <Icon name="shieldAlert" size={26} />
            </span>
            <div className={styles.recoBody}>
              <p className={styles.eyebrowNavy}>{t.reco.eyebrow}</p>
              <h2 id="reco-title" className={styles.recoTitle}>
                {data.recommendation.code === 'refrain_new_credit' ? t.reco.refrain : data.recommendation.code === 'careful_new_credit' ? t.reco.careful : t.reco.stable}
              </h2>
              <p className={styles.bodyText}>
                {data.relief && data.recommendation.code !== 'stable_keep_reserve'
                  ? t.reco.relief(data.relief.organization, c.creditTypePoss[data.relief.type], data.relief.remaining ?? 0, percent(data.relief.load_after))
                  : t.reco.freeText(money(m.free))}
              </p>
              <div className={styles.actions}>
                <Button to="/plan">{t.reco.seePlan}</Button>
                {data.relief && (
                  <Button to={`/credits?id=${data.relief.credit_id}`} variant="secondary">
                    {t.reco.openCredit(c.creditTypeAcc[data.relief.type])}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}
        <AiCard questions={[t.ai.q1, t.ai.q2]} title={t.ai.title} open={t.ai.open} />
      </Row>

      {hasCredits && (
        <Row>
          <DebtCard data={data} />
          <UpcomingCard data={data} />
        </Row>
      )}

      {hasCredits && (
        <Row>
          <Card flex="1 440px" aria-labelledby="split-title" style={{ gap: 18 }}>
            <CardHeader id="split-title" title={t.split.title} subtitle={t.split.subtitle(money(m.monthly_payments), c.obligations(m.credits_count))} />
            <ul className={styles.split}>
              {data.split.map((s) => (
                <li key={s.credit_id}>
                  <div className={styles.splitHead}>
                    <span className={styles.splitName}>
                      {s.organization} · {c.creditTypeLower[s.type]}
                      {s.most_expensive && (
                        <Pill tone="warning" icon="triangle" size="xs">
                          {t.split.mostExpensive}
                        </Pill>
                      )}
                    </span>
                    <span className={styles.splitValue}>
                      <b>{money(s.amount)}</b> · {percent(s.share)}
                    </span>
                  </div>
                  <div
                    className={`${styles.splitBar} ${s.most_expensive ? styles.splitBarWarn : ''}`}
                    style={{ width: `${(s.amount / Math.max(...data.split.map((x) => x.amount))) * 100}%` }}
                  />
                </li>
              ))}
            </ul>
          </Card>
          <Card flex="1 440px" aria-labelledby="load-title">
            <CardHeader id="load-title" title={t.loadHistory.title} subtitle={t.loadHistory.subtitle} />
            <LoadChart
              series={data.load_series}
              lang={lang}
              zoneLabels={t.loadHistory.zones}
              ariaLabel={t.loadHistory.aria(data.load_series.map((p) => `${monthName(p.month, lang)} ${percent(p.load)}`).join(', '))}
            />
            {data.relief && data.relief.end_date && (
              <p className={styles.bodyTextSm}>
                {t.loadHistory.hint(c.creditTypeAcc[data.relief.type], monthName(data.relief.end_date, lang, 'dat'), percent(data.relief.load_after))}
                <Link to="/plan" className={styles.strongLink}>
                  {t.loadHistory.openPlan}
                </Link>
              </p>
            )}
          </Card>
        </Row>
      )}
    </>
  );
}

export function AiCard({ title, questions, open, text }: { title: string; questions: string[]; open: string; text?: string }) {
  return (
    <Card tone="teal" flex="1 320px" aria-labelledby="ai-title" style={{ gap: 14 }}>
      <div className={styles.aiHead}>
        <span aria-hidden="true" className={styles.aiBadge}>
          <Icon name="sparkle" size={18} strokeWidth={2} />
        </span>
        <span className={styles.aiName}>qorgan AI</span>
      </div>
      <h2 id="ai-title" className={styles.aiTitle}>
        {title}
      </h2>
      {text && <p className={styles.bodyTextSm}>{text}</p>}
      <div className={styles.aiQuestions}>
        {questions.map((q) => (
          <Button key={q} variant="aiChip" to={`/ai?q=${encodeURIComponent(q)}`}>
            {q}
          </Button>
        ))}
      </div>
      <Button to="/ai" variant="teal">
        {open}
      </Button>
    </Card>
  );
}

function DebtCard({ data }: { data: Dashboard }) {
  const t = useT(dict);
  const { lang } = useLang();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const series = data.debt_series as DebtPoint[];
  const first = series[0];
  const last = series[series.length - 1];
  const now = [...series].reverse().find((p) => p.kind === 'actual');
  const eventText = (p: DebtPoint) =>
    p.event === 'installment_added' ? t.debt.eventInstallment(thousands(p.event_amount ?? 0, lang)) : p.event === 'microloan_added' ? t.debt.eventMicro(thousands(p.event_amount ?? 0, lang)) : null;
  const rows = series.filter((p, i) => p.event || p === now || i === 0 || i === series.length - 1 || (p.kind === 'forecast' && i % 2 === 0));

  return (
    <Card flex="2 560px" aria-labelledby="debt-title">
      <CardHeader
        id="debt-title"
        title={t.debt.title}
        subtitle={t.debt.period(monthYear(first.month, lang), monthYear(last.month, lang))}
        actions={
          <ToggleGroup
            variant="tabs"
            label={t.debt.view}
            value={view}
            onChange={setView}
            options={[
              { value: 'chart', label: t.debt.chart },
              { value: 'table', label: t.debt.table },
            ]}
          />
        }
      />
      {view === 'chart' ? (
        <>
          <DebtLegend actual={t.debt.actual} forecast={t.debt.forecast} />
          <DebtChart
            series={series}
            lang={lang}
            todayLabel={t.debt.today}
            eventLabel={eventText}
            formatValue={(n) => `${millions(n, lang)} ₸`}
            formatAxis={(n) => millions(n, lang, 1)}
            ariaLabel={t.debt.aria(money(now?.debt ?? 0), `${monthYear(last.month, lang)}: ${money(last.debt)}`)}
          />
        </>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>{t.debt.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{t.debt.month}</th>
                <th scope="col" className={styles.num}>
                  {t.debt.sum}
                </th>
                <th scope="col">{t.debt.event}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.month} className={p === now ? styles.rowStrong : undefined}>
                  <td>{monthYear(p.month, lang).replace(/^./, (ch) => ch.toUpperCase())}</td>
                  <td className={styles.num}>{num(p.debt)}</td>
                  <td className={styles.muted}>
                    {p === now ? t.debt.now : p.kind === 'forecast' ? t.debt.forecastRow : eventText(p) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function UpcomingCard({ data }: { data: Dashboard }) {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  const items = data.upcoming.slice(0, 5);
  const total = items.reduce((s, u) => s + u.amount, 0);
  return (
    <Card flex="1 320px" aria-labelledby="next-title" style={{ gap: 14 }}>
      <div className={styles.cardTop}>
        <h2 id="next-title" className={styles.sectionTitle}>
          {t.upcoming.title}
        </h2>
        <Link to="/credits" className={styles.headLink}>
          {t.upcoming.all}
        </Link>
      </div>
      {items.length === 0 ? (
        <p className={styles.bodyTextSm}>{t.upcoming.empty}</p>
      ) : (
        <ol className={styles.upcoming}>
          {items.map((u) => {
            const soon = u.days_until <= 3;
            const d = toDate(u.date);
            return (
              <li key={u.credit_id}>
                <Link to={`/credits?id=${u.credit_id}`} className={styles.upcomingLink}>
                  <span className={`${styles.dateBox} ${soon ? styles.dateBoxSoon : ''}`}>
                    <b>{d.getDate()}</b>
                    <span>{dayMonthShort(u.date, lang).split(/\s| /)[1]}</span>
                  </span>
                  <span className={styles.upcomingText}>
                    <span className={styles.upcomingName}>
                      {u.organization} · {c.creditTypeShort[u.type]}
                    </span>
                    <span className={soon ? styles.soon : styles.muted}>
                      {soon && <Icon name="clock" size={14} strokeWidth={2} />}
                      {u.days_until < 0 ? c.daysAgo(-u.days_until) : u.is_minimum ? t.upcoming.minimum : c.inDays(u.days_until)}
                    </span>
                  </span>
                  <b className={styles.upcomingAmount}>{money(u.amount)}</b>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {items.length > 0 && (
        <p className={styles.totalRow}>
          <span>{t.upcoming.total(dayMonth(items[items.length - 1].date, lang))}</span>
          <b>{money(total)}</b>
        </p>
      )}
    </Card>
  );
}
