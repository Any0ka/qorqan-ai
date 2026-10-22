import { useEffect, useRef, useState } from 'react';
import type { IncomeFrequency } from '@/api/types';
import { useSaveIncomes } from '@/api/hooks';
import { Icon } from '@/components/Icon';
import { IconButton, MoneyField, SelectField, TextField } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { money } from '@/lib/format';
import { StepFooter, StepHeading, type StepProps } from './shared';
import { dict } from './i18n';
import styles from './Onboarding.module.css';

interface IncomeRow {
  key: string;
  id?: string;
  source: string;
  amount: number | null;
  frequency: IncomeFrequency;
}

let seq = 0;
const newKey = () => `n${++seq}`;

/** Step 1 — «Сколько ты получаешь в месяц?»: rows of source · amount · frequency with a live total. */
export function StepIncomes({ financial, advance, registerSave, headingRef }: StepProps) {
  const t = useT(dict);
  const c = useT(common);
  const ti = t.incomes;
  const save = useSaveIncomes();
  const [rows, setRows] = useState<IncomeRow[]>(() =>
    financial.incomes.length
      ? financial.incomes.map((i) => ({ key: i.id, id: i.id, source: i.source, amount: i.amount, frequency: i.frequency }))
      : [{ key: newKey(), source: ti.defaultSource, amount: null, frequency: 'monthly' }],
  );
  const [errors, setErrors] = useState<{ rows: Record<string, string>; total?: string }>({ rows: {} });
  const [error, setError] = useState<unknown>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);

  const total = rows.reduce((s, r) => s + (r.amount ?? 0), 0);

  const update = (key: string, patch: Partial<IncomeRow>) => {
    dirty.current = true;
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  /** `strict` (the «Далее» button) also requires at least one income. */
  const submit = async (strict: boolean): Promise<boolean> => {
    if (busy) return false;
    const rowErrors: Record<string, string> = {};
    for (const r of rows) if ((r.amount ?? 0) > 0 && !r.source.trim()) rowErrors[r.key] = ti.sourceRequired;
    const totalError = strict && total <= 0 ? ti.incomeRequired : undefined;
    setErrors({ rows: rowErrors, total: totalError });
    if (Object.keys(rowErrors).length || totalError) return false;
    setError(null);
    setBusy(true);
    try {
      const latest = await save.mutateAsync(
        rows.filter((r) => (r.amount ?? 0) > 0).map((r) => ({ id: r.id, source: r.source.trim(), amount: r.amount ?? 0, frequency: r.frequency })),
      );
      dirty.current = false;
      if (strict) await advance(2, latest);
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    registerSave(() => (dirty.current ? submit(false) : Promise.resolve(true)));
    return () => registerSave(null);
  });

  return (
    <>
      <StepHeading headingRef={headingRef} title={ti.title} lead={ti.lead} />

      <div className={styles.incomeRows}>
        {rows.map((r, i) => (
          <div key={r.key} role="group" aria-label={ti.rowLabel(i + 1)} className={styles.incomeRow}>
            <TextField
              label={ti.source}
              fieldClassName={styles.colSource}
              value={r.source}
              placeholder={ti.sourcePlaceholder}
              autoComplete="off"
              autoFocus={focusKey === r.key}
              error={errors.rows[r.key]}
              onChange={(e) => update(r.key, { source: e.target.value })}
            />
            <MoneyField
              label={ti.amount}
              fieldClassName={styles.colAmount}
              value={r.amount}
              emptyAsNull
              invalidMessage={c.errors.money_letters}
              onChange={(v) => update(r.key, { amount: v })}
            />
            <SelectField
              label={ti.frequency}
              fieldClassName={styles.colFreq}
              value={r.frequency}
              options={[
                { value: 'monthly', label: ti.monthly },
                { value: 'irregular', label: ti.irregular },
              ]}
              onChange={(e) => update(r.key, { frequency: e.target.value as IncomeFrequency })}
            />
            {rows.length > 1 && (
              <span className={styles.rowRemove}>
                <IconButton
                  icon="trash"
                  label={ti.remove(r.source.trim())}
                  onClick={() => {
                    dirty.current = true;
                    setRows((rs) => rs.filter((x) => x.key !== r.key));
                  }}
                />
              </span>
            )}
          </div>
        ))}
        <button
          type="button"
          className={styles.dashedButton}
          onClick={() => {
            const key = newKey();
            dirty.current = true;
            setFocusKey(key);
            setRows((rs) => [...rs, { key, source: '', amount: null, frequency: 'monthly' }]);
          }}
        >
          <Icon name="plus" size={18} strokeWidth={2} />
          {ti.add}
        </button>
      </div>

      <div className={styles.totalWrap}>
        <p className={styles.total}>
          <span>{ti.total}</span>
          <b aria-live="polite" className="tabular">
            {money(total)}
          </b>
        </p>
        {errors.total && (
          <p className={styles.fieldError} role="alert">
            <Icon name="alert" size={16} />
            {errors.total}
          </p>
        )}
      </div>
      <p className={styles.note}>{ti.irregularNote}</p>

      <StepFooter onNext={() => void submit(true)} pending={busy} error={error} />
    </>
  );
}
