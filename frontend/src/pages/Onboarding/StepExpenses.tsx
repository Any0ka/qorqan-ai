import { useEffect, useRef, useState } from 'react';
import type { ExpenseCategory, Financial } from '@/api/types';
import { useSaveExpenses } from '@/api/hooks';
import { MoneyField } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { money } from '@/lib/format';
import { StepFooter, StepHeading, type StepProps } from './shared';
import { dict } from './i18n';
import styles from './Onboarding.module.css';

const CATEGORIES: ExpenseCategory[] = ['rent', 'utilities', 'food', 'transport', 'telecom', 'other'];

type Values = Record<ExpenseCategory, number | null>;

function initialValues(f: Financial): Values {
  const v = Object.fromEntries(CATEGORIES.map((cat) => [cat, null])) as Values;
  if (!f.expenses_set) return v;
  for (const e of f.expenses) v[e.category] = (v[e.category] ?? 0) + e.amount;
  // An empty «Другое» shows its placeholder rather than "0".
  if (!v.other) v.other = null;
  return v;
}

/** Step 2 — «Обязательные расходы»: six categories and a live total. */
export function StepExpenses({ financial, goTo, advance, registerSave, headingRef }: StepProps) {
  const t = useT(dict);
  const c = useT(common);
  const te = t.expenses;
  const save = useSaveExpenses();
  const [values, setValues] = useState<Values>(() => initialValues(financial));
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const labels = useRef(Object.fromEntries(financial.expenses.map((e) => [e.category, e.label])) as Partial<Record<ExpenseCategory, string | null>>);

  const total = CATEGORIES.reduce((s, cat) => s + (values[cat] ?? 0), 0);

  const submit = async (strict: boolean): Promise<boolean> => {
    if (busy) return false;
    setError(null);
    setBusy(true);
    try {
      const latest = await save.mutateAsync(CATEGORIES.map((cat) => ({ category: cat, label: labels.current[cat] ?? null, amount: values[cat] ?? 0 })));
      dirty.current = false;
      if (strict) await advance(3, latest);
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
      <StepHeading headingRef={headingRef} title={te.title} lead={te.lead} />

      <div className={styles.expenseGrid}>
        {CATEGORIES.map((cat) => (
          <MoneyField
            key={cat}
            label={te.labels[cat]}
            value={values[cat]}
            emptyAsNull
            placeholder={cat === 'other' ? te.otherPlaceholder : '0'}
            invalidMessage={c.errors.money_letters}
            onChange={(v) => {
              dirty.current = true;
              setValues((s) => ({ ...s, [cat]: v }));
            }}
          />
        ))}
      </div>

      <p className={styles.total}>
        <span>{te.total}</span>
        <b aria-live="polite" className="tabular">
          {money(total)}
        </b>
      </p>

      <StepFooter onBack={() => goTo(1)} onNext={() => void submit(true)} pending={busy} error={error} />
    </>
  );
}
