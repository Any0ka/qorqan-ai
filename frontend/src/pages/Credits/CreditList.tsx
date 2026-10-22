import type { MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Credit, CreditsResponse } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Button, ErrorState, Pill, ToggleGroup } from '@/components/ui';
import { common } from '@/i18n/common';
import { useLang, useT } from '@/i18n/I18nProvider';
import { dayMonth, dayMonthShort, money, percent } from '@/lib/format';
import { dateIn, FEMININE, GROUPS, shortNumeric } from './helpers';
import { dict, type FilterGroup } from './i18n';
import styles from './Credits.module.css';

export type Sort = 'next_payment' | 'balance' | 'payment';

interface Props {
  rows: Credit[];
  summary: CreditsResponse['summary'];
  showFresh: boolean;
  search: string;
  onSearch: (v: string) => void;
  query: string;
  sort: Sort;
  onSort: (s: Sort) => void;
  group: FilterGroup;
  onGroup: (g: FilterGroup) => void;
  selectedId: string | null;
  hrefFor: (id: string) => string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  fetching: boolean;
  error: unknown;
  onRetry: () => void;
}

export function StatusPill({ credit, short = false }: { credit: Credit; short?: boolean }) {
  const t = useT(dict);
  const size = short ? 'xs' : 'sm';
  if (credit.status === 'overdue')
    return (
      <Pill tone="danger" icon="octagon" size={size} className={styles.pillStrong}>
        {t.status.overdue(credit.overdue_days)}
      </Pill>
    );
  if (credit.status === 'attention')
    return (
      <Pill tone="warning" icon="triangle" size={size}>
        {short ? t.status.attentionShort : t.status.attention}
      </Pill>
    );
  const f = FEMININE[credit.type];
  if (credit.status === 'closed')
    return (
      <Pill tone="success" icon="checkCircle" size={size}>
        {f ? t.status.closedF : t.status.closedM}
      </Pill>
    );
  return (
    <span className={`${styles.activePill} ${short ? styles.activePillXs : ''}`}>
      <span aria-hidden="true" className={styles.activeDot} />
      {f ? t.status.activeF : t.status.activeM}
    </span>
  );
}

/** «Обязательства»: toolbar, type chips, table (desktop/tablet) or cards (mobile). */
export function CreditList(p: Props) {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  const navigate = useNavigate();
  const s = p.summary;

  const groupCount = (g: FilterGroup) => (g === 'all' ? s.count : GROUPS[g].reduce((n, type) => n + (s.counts_by_type[type] ?? 0), 0));
  const groups = (['all', 'loan', 'installment', 'microloan', 'credit_card'] as FilterGroup[]).filter((g) => g === 'all' || groupCount(g) > 0);
  const groupLabel = (g: FilterGroup) => {
    const short = g === 'credit_card' ? t.list.groupsShort.credit_card : null;
    const n = groupCount(g);
    return short ? (
      <>
        <span className={styles.wideOnly}>{`${t.list.groups[g]} · ${n}`}</span>
        <span className={styles.narrowOnly}>{`${short} · ${n}`}</span>
      </>
    ) : (
      `${t.list.groups[g]} · ${n}`
    );
  };

  const totalBalance = p.rows.reduce((n, r) => n + r.balance, 0);
  const totalPayments = p.rows.reduce((n, r) => n + r.monthly_payment, 0);
  const share = s.monthly_payments > 0 ? (s.load * totalPayments) / s.monthly_payments : 0;
  const oldest = s.oldest_data;
  const ariaSort = (col: Sort) => (p.sort === col ? (col === 'next_payment' ? 'ascending' : 'descending') : undefined);
  const sortIcon = (col: Sort) => (p.sort === col ? <Icon name="arrowDown" size={14} strokeWidth={2} /> : null);

  const source = (r: Credit, short = false) =>
    r.source === 'manual' ? (short ? t.list.manualShort : t.list.manual) : r.corrected_manually ? t.list.corrected : t.list.fromReport;

  const rowClick = (e: MouseEvent, id: string) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    navigate(p.hrefFor(id));
  };

  const nextCell = (r: Credit) => {
    if (!r.next_payment_date) return '—';
    const d = dayMonthShort(r.next_payment_date, lang);
    if (r.status === 'overdue') return <span className={styles.textDanger}>{`${d} · ${t.list.passed}`}</span>;
    if (r.flags.includes('due_soon') && r.days_until_next !== null)
      return (
        <>
          <span className={styles.textWarning}>{d}</span> <span className={styles.muted}>· {c.inDays(r.days_until_next)}</span>
        </>
      );
    return d;
  };

  const cardFoot = (r: Credit) => {
    if (!r.next_payment_date) return null;
    const d = dayMonth(r.next_payment_date, lang);
    if (r.status === 'overdue') return <span className={`${styles.cardFoot} ${styles.textDanger}`}>{t.list.overdueOn(dateIn(r.next_payment_date, lang, 'attr'), r.overdue_days)}</span>;
    if (r.flags.includes('due_soon') && r.days_until_next !== null) {
      const parts = [d, c.inDays(r.days_until_next), ...(r.flags.includes('most_expensive') ? [t.list.mostExpensive] : [])];
      return <span className={`${styles.cardFoot} ${styles.textWarning}`}>{parts.join(' · ')}</span>;
    }
    return <span className={styles.cardFoot}>{t.list.nextOn(d)}</span>;
  };

  const empty = p.rows.length === 0;

  return (
    <section aria-labelledby="list-title" className={styles.listCard}>
      <div className={styles.listHead}>
        <h2 id="list-title" className={styles.listTitle}>
          {p.showFresh && oldest ? t.list.titleAsOf(dateIn(oldest, lang, 'attr')) : t.list.title}
        </h2>
        <div className={styles.headActions}>
          <Button variant="secondary" icon="upload" to="/onboarding?step=3" className={styles.compactBtn}>
            {t.list.refresh}
          </Button>
          <Button icon="plus" onClick={p.onAdd} className={styles.compactBtn}>
            {t.list.add}
          </Button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Icon name="search" size={18} />
          <input type="search" aria-label={t.list.search} placeholder={t.list.search} value={p.search} onChange={(e) => p.onSearch(e.target.value)} />
        </div>
        <label htmlFor="credits-sort" className="visually-hidden">
          {t.list.sort}
        </label>
        <select id="credits-sort" className={styles.select} value={p.sort} onChange={(e) => p.onSort(e.target.value as Sort)}>
          <option value="next_payment">{t.list.sortNext}</option>
          <option value="balance">{t.list.sortBalance}</option>
          <option value="payment">{t.list.sortPayment}</option>
        </select>
      </div>

      {groups.length > 2 && (
        <div className={styles.chipsWrap}>
          <ToggleGroup label={t.list.filter} value={p.group} onChange={p.onGroup} options={groups.map((g) => ({ value: g, label: groupLabel(g) }))} />
        </div>
      )}

      {p.error ? (
        <div className={styles.listPad}>
          <ErrorState compact error={p.error} onRetry={p.onRetry} />
        </div>
      ) : empty ? (
        <div className={styles.noResults} role="status">
          <b>{p.query ? t.list.emptyTitle(p.query) : t.list.emptyGroup}</b>
          {p.query && <span>{t.list.emptyText}</span>}
          {p.query ? (
            <Button variant="secondary" size="sm" onClick={p.onAdd}>
              {t.list.addManual}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => p.onGroup('all')}>
              {t.list.showAll}
            </Button>
          )}
        </div>
      ) : (
        <div className={p.fetching ? styles.refreshing : undefined} aria-busy={p.fetching || undefined}>
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${p.showFresh ? styles.tableWide : ''}`}>
              <caption className="visually-hidden">{t.list.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.list.colOrg}</th>
                  <th scope="col" className={styles.num} aria-sort={ariaSort('balance')}>
                    <span className={styles.thInner}>
                      {t.list.colBalance}
                      {sortIcon('balance')}
                    </span>
                  </th>
                  <th scope="col" className={styles.num} aria-sort={ariaSort('payment')}>
                    <span className={styles.thInner}>
                      {t.list.colPayment}
                      {sortIcon('payment')}
                    </span>
                  </th>
                  <th scope="col" aria-sort={ariaSort('next_payment')}>
                    <span className={styles.thInner}>
                      {t.list.colNext}
                      {sortIcon('next_payment')}
                    </span>
                  </th>
                  {p.showFresh && <th scope="col">{t.list.colFresh}</th>}
                  <th scope="col">{t.list.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {p.rows.map((r) => {
                  const selected = r.id === p.selectedId;
                  return (
                    <tr
                      key={r.id}
                      onClick={(e) => rowClick(e, r.id)}
                      className={`${styles.row} ${selected ? styles.rowSelected : r.status === 'overdue' ? styles.rowOverdue : ''}`}
                    >
                      <td>
                        <Link to={p.hrefFor(r.id)} aria-current={selected ? 'true' : undefined} className={styles.orgLink}>
                          <span className={styles.orgName}>{r.organization}</span>
                          <span className={styles.orgSub}>{`${c.creditType[r.type]} · ${source(r)}`}</span>
                        </Link>
                      </td>
                      <td className={`${styles.num} ${styles.strong}`}>{money(r.balance)}</td>
                      <td className={styles.num}>
                        {money(r.monthly_payment)}
                        {r.is_minimum_payment && <span className={styles.muted}> {t.list.min}</span>}
                      </td>
                      <td className={styles.nowrap}>{nextCell(r)}</td>
                      {p.showFresh && (
                        <td className={`${styles.nowrap} ${r.stale ? styles.textWarningSoft : styles.textSuccess}`}>
                          {`${shortNumeric(r.data_as_of)} · ${r.stale ? t.list.stale : t.list.fresh}`}
                        </td>
                      )}
                      <td>
                        <StatusPill credit={r} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{t.list.total}</th>
                  <td className={styles.num}>{money(totalBalance)}</td>
                  <td className={styles.num}>{money(totalPayments)}</td>
                  <td colSpan={p.showFresh ? 3 : 2} className={styles.muted}>
                    {t.list.ofIncome(percent(share))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <ul className={styles.cards}>
            {p.rows.map((r) => {
              const selected = r.id === p.selectedId;
              const tone = r.status === 'overdue' ? styles.cardDanger : r.status === 'attention' ? styles.cardWarn : '';
              return (
                <li key={r.id}>
                  <Link to={p.hrefFor(r.id)} aria-current={selected ? 'true' : undefined} className={`${styles.card} ${tone} ${selected ? styles.cardSelected : ''}`}>
                    <span className={styles.cardTop}>
                      <span className={styles.cardName}>
                        <b>{r.organization}</b>
                        <span>{r.source === 'manual' || r.corrected_manually ? `${c.creditType[r.type]} · ${source(r, true)}` : c.creditType[r.type]}</span>
                      </span>
                      <StatusPill credit={r} short />
                    </span>
                    <span className={styles.cardNums}>
                      <span>
                        {t.list.balance}
                        <b>{money(r.balance)}</b>
                      </span>
                      <span>
                        {r.is_minimum_payment ? t.list.minPayment : t.list.payment}
                        <b>{money(r.monthly_payment)}</b>
                      </span>
                    </span>
                    {cardFoot(r)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
