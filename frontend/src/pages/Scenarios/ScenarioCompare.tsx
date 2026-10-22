import { useCallback, useState, type ReactNode } from 'react';
import type { OptionCode, ScenarioOption } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Button, DataList, Dialog, RiskBadge } from '@/components/ui';
import { common } from '@/i18n/common';
import { useT } from '@/i18n/I18nProvider';
import { money, percent } from '@/lib/format';
import type { CheckRef, ScenarioData } from './ScenariosContent';
import { dict, type Noun } from './i18n';
import styles from './Scenarios.module.css';

interface Row {
  key: string;
  label: string;
  cell: (o: ScenarioOption) => ReactNode;
  bad?: (o: ScenarioOption) => boolean;
  nowrap?: boolean;
}

/** «N способов получить …»: table on tablet/desktop, a stack of cards on mobile. */
export function ScenarioCompare({
  check,
  data,
  noun,
  onChoose,
  adding,
}: {
  check: CheckRef;
  data: ScenarioData;
  noun: Noun;
  onChoose: (code: OptionCode) => void;
  adding: boolean;
}) {
  const t = useT(dict);
  const c = useT(common);
  const [details, setDetails] = useState<ScenarioOption | null>(null);
  const closeDetails = useCallback(() => setDetails(null), []);
  const options = data.options;
  const original = options.find((o) => o.code === 'original') ?? options[0];
  const isSave = (o: ScenarioOption) => o.code === 'save';
  const r = t.table.rows;

  const when = (o: ScenarioOption) =>
    o.months_until_purchase === null ? t.table.notFeasible : o.months_until_purchase === 0 ? t.table.now : t.table.inMonths(o.months_until_purchase);

  const rows: Row[] = [
    { key: 'total', label: r.total, cell: (o) => money(o.total_cost), nowrap: true },
    {
      key: 'monthly',
      label: r.monthly,
      cell: (o) =>
        isSave(o) ? (
          <>
            <b className={styles.nowrap}>{money(0)}</b> <span className={styles.sub}>{t.table.saving(money(o.saving_monthly ?? 0))}</span>
          </>
        ) : (
          money(o.monthly_payment)
        ),
      nowrap: false,
    },
    { key: 'load', label: r.load, cell: (o) => percent(o.load), bad: (o) => o.load >= 0.45, nowrap: true },
    {
      key: 'free',
      label: r.free,
      cell: (o) =>
        isSave(o) ? (
          <>
            <b className={styles.nowrap}>{money(o.free)}</b> <span className={styles.sub}>{t.table.afterSaving}</span>
          </>
        ) : (
          money(o.free)
        ),
      bad: (o) => o.free < 0,
    },
    { key: 'when', label: r.when, cell: when },
    { key: 'risk', label: r.risk, cell: (o) => <RiskBadge risk={o.risk} size="sm" label={c.riskShort[o.risk]} /> },
  ];

  const badge = (
    <span className={styles.recBadge}>
      <Icon name="check" size={12} strokeWidth={2.6} />
      {t.table.recommended}
    </span>
  );

  const action = (o: ScenarioOption) => {
    const title = t.option.title(o);
    if (o.code === 'original')
      return (
        <Button to={`/result/${check.id}`} variant="secondary" className={styles.tableBtn} aria-label={t.table.moreAbout(title)}>
          {t.table.more}
        </Button>
      );
    if (o.recommended)
      return (
        <Button variant="teal" className={styles.tableBtn} onClick={() => onChoose(o.code)} disabled={adding}>
          {t.table.choose}
        </Button>
      );
    return (
      <Button variant="secondary" className={styles.tableBtn} onClick={() => setDetails(o)} aria-label={t.table.moreAbout(title)}>
        {t.table.more}
      </Button>
    );
  };

  const cellClass = (row: Row, o: ScenarioOption) =>
    [row.nowrap && styles.nowrap, row.bad?.(o) && styles.bad, o.recommended && styles.rec].filter(Boolean).join(' ') || undefined;

  const mobileOrder = [...options].sort((a, b) => Number(b.recommended) - Number(a.recommended));

  return (
    <section aria-labelledby="table-title" className={styles.section}>
      <div className={styles.tableHead}>
        <h2 id="table-title" className={styles.h2Lg}>
          {t.table.title(options.length, noun)}
        </h2>
        <p className={styles.lead}>{t.table.base(money(data.base.income), money(data.base.expenses), money(data.base.payments))}</p>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="visually-hidden">{t.table.caption}</caption>
          <thead>
            <tr>
              <td className={styles.corner} />
              {options.map((o) => (
                <th key={o.code} scope="col" className={o.recommended ? styles.recHead : undefined}>
                  {o.recommended && badge}
                  <span className={styles.colTitle}>{t.option.title(o)}</span>
                  <span className={styles.colDesc}>{t.option.desc(o)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.key} className={i === rows.length - 1 ? styles.lastRow : undefined}>
                <th scope="row">{row.label}</th>
                {options.map((o) => (
                  <td key={o.code} className={cellClass(row, o)}>
                    {row.cell(o)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className={styles.actionsRow}>
              <td />
              {options.map((o) => (
                <td key={o.code} className={o.recommended ? styles.rec : undefined}>
                  {action(o)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <ul className={styles.cards} aria-label={t.table.caption}>
        {mobileOrder.map((o) => (
          <li key={o.code} className={`${styles.optCard} ${o.recommended ? styles.optCardRec : ''}`}>
            {o.recommended && badge}
            <div className={styles.optHead}>
              <h3 className={styles.colTitle}>{t.option.title(o)}</h3>
              <p className={styles.colDesc}>{t.option.desc(o)}</p>
            </div>
            <dl className={styles.optList}>
              {rows.map((row) => (
                <div key={row.key}>
                  <dt>{row.label}</dt>
                  <dd className={row.bad?.(o) ? styles.bad : undefined}>{row.cell(o)}</dd>
                </div>
              ))}
            </dl>
            {action(o)}
          </li>
        ))}
      </ul>

      {details && (
        <OptionDialog option={details} original={original} onClose={closeDetails} onAdd={() => onChoose(details.code)} adding={adding} when={when(details)} />
      )}
    </section>
  );
}

function OptionDialog({
  option: o,
  original,
  onClose,
  onAdd,
  adding,
  when,
}: {
  option: ScenarioOption;
  original: ScenarioOption;
  onClose: () => void;
  onAdd: () => void;
  adding: boolean;
  when: string;
}) {
  const t = useT(dict);
  const c = useT(common);
  const r = t.table.rows;
  const save = o.code === 'save';
  return (
    <Dialog
      open
      onClose={onClose}
      title={t.option.title(o)}
      description={t.option.desc(o)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {c.close}
          </Button>
          <Button onClick={onAdd} disabled={adding}>
            {t.table.addToPlan}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <RiskBadge risk={o.risk} />
        <p className={styles.bodyText}>{t.option.explain(o, original)}</p>
        <DataList
          items={[
            { label: r.total, value: money(o.total_cost) },
            save ? { label: t.builder.saveMonthly, value: money(o.saving_monthly ?? 0) } : { label: r.monthly, value: money(o.monthly_payment) },
            { label: t.table.allPayments, value: money(o.payments) },
            { label: r.load, value: percent(o.load) },
            { label: r.free, value: money(o.free) },
            { label: r.when, value: when },
            { label: t.table.newDebt, value: o.new_debt ? t.table.yes : t.table.no },
          ]}
        />
      </div>
    </Dialog>
  );
}
