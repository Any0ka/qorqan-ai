import { useRef, useState, type FormEvent } from 'react';
import type { CreditType } from '@/api/types';
import { useAddCredit } from '@/api/hooks';
import { Button, MoneyField, SelectField, TextField, useToast } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { SaveError } from './shared';
import { dict } from './i18n';
import styles from './Onboarding.module.css';

const TYPES: CreditType[] = ['cash_loan', 'installment', 'microloan', 'credit_card', 'auto_loan', 'mortgage', 'other'];

interface Form {
  organization: string;
  type: CreditType;
  balance: number | null;
  monthly: number | null;
  next: string;
  end: string;
}

const EMPTY: Form = { organization: '', type: 'cash_loan', balance: null, monthly: null, next: '', end: '' };

type Errors = Partial<Record<'organization' | 'balance' | 'monthly' | 'next' | 'end', string>>;

/** Inline «Новое обязательство»: organisation, type, balance, payment, next and (optional) last payment date. */
export function ManualCreditForm({ onCancel }: { onCancel?: () => void }) {
  const t = useT(dict);
  const c = useT(common);
  const tm = t.manual;
  const toast = useToast();
  const add = useAddCredit();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  // MoneyField keeps its own text while focused; remounting it clears the typed value after a reset.
  const [round, setRound] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (add.isPending) return;
    const next: Errors = {};
    if (!form.organization.trim()) next.organization = tm.errors.organization;
    if (!form.balance) next.balance = tm.errors.balance;
    if (!form.monthly) next.monthly = tm.errors.monthly;
    if (!form.next) next.next = tm.errors.nextDate;
    if (form.end && form.next && form.end < form.next) next.end = tm.errors.endDate;
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const organization = form.organization.trim();
    add.mutate(
      {
        organization,
        type: form.type,
        balance: form.balance ?? 0,
        monthly_payment: form.monthly ?? 0,
        next_payment_date: form.next || null,
        last_payment_date: form.end || null,
      },
      {
        onSuccess: () => {
          toast({ tone: 'success', text: tm.added(`${organization} · ${c.creditTypeShort[form.type]}`) });
          setForm(EMPTY);
          setRound((r) => r + 1);
          requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('input')?.focus());
        },
      },
    );
  };

  return (
    <form ref={formRef} aria-labelledby="manual-title" className={styles.manualForm} onSubmit={submit} noValidate>
      <h3 id="manual-title" className={styles.boxTitle}>
        {tm.title}
      </h3>
      <div className={styles.manualGrid} key={round}>
        <TextField
          label={tm.organization}
          placeholder={tm.organizationPlaceholder}
          autoComplete="organization"
          value={form.organization}
          error={errors.organization}
          onChange={(e) => set('organization', e.target.value)}
        />
        <SelectField
          label={tm.type}
          value={form.type}
          options={TYPES.map((v) => ({ value: v, label: c.creditType[v] }))}
          onChange={(e) => set('type', e.target.value as CreditType)}
        />
        <MoneyField label={tm.balance} value={form.balance} emptyAsNull error={errors.balance} invalidMessage={c.errors.money_letters} onChange={(v) => set('balance', v)} />
        <MoneyField label={tm.monthly} value={form.monthly} emptyAsNull error={errors.monthly} invalidMessage={c.errors.money_letters} onChange={(v) => set('monthly', v)} />
        <TextField label={tm.nextDate} type="date" value={form.next} error={errors.next} onChange={(e) => set('next', e.target.value)} />
        <TextField
          label={tm.endDate}
          badge={<span className={styles.optional}>· {c.optional}</span>}
          type="date"
          value={form.end}
          min={form.next || undefined}
          hint={tm.endHint}
          error={errors.end}
          onChange={(e) => set('end', e.target.value)}
        />
      </div>
      {add.error ? <SaveError error={add.error} /> : null}
      <div className={styles.manualActions}>
        <Button type="submit" icon="plus" disabled={add.isPending} aria-busy={add.isPending || undefined}>
          {tm.submit}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {tm.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}
