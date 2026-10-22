import { useId, useState, type FormEvent } from 'react';
import { useAddCredit, useDeleteCredit, useUpdateCredit } from '@/api/hooks';
import { ApiError } from '@/api/client';
import type { Credit, CreditInput, CreditPatch, CreditsResponse, CreditType } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Alert, Button, ConfirmDialog, Dialog, MoneyField, SelectField, TextField, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useLang, useT } from '@/i18n/I18nProvider';
import { money, percent } from '@/lib/format';
import { CREDIT_TYPES, dateIn, useStableCallback } from './helpers';
import { dict } from './i18n';
import styles from './Credits.module.css';

interface Props {
  open: boolean;
  /** Absent → «Добавить обязательство». */
  credit?: Credit;
  report: CreditsResponse['report'];
  initialOrg: string;
  onClose: () => void;
  onDeleted: () => void;
  onAdded: (id: string) => void;
}

/** Credit-Edit dialog («Исправить данные · …») and the same form for a new manual obligation. */
export function CreditFormDialog(props: Props) {
  if (!props.open) return null;
  return <FormDialog key={props.credit?.id ?? 'new'} {...props} />;
}

interface FormState {
  organization: string;
  type: CreditType;
  balance: number | null;
  monthly_payment: number | null;
  next_payment_date: string;
  last_payment_date: string;
  original_amount: number | null;
  rate: string;
}

type MoneyKey = 'balance' | 'monthly_payment' | 'original_amount';

const initial = (c: Credit | undefined, org: string): FormState => ({
  organization: c?.organization ?? org,
  type: c?.type ?? 'cash_loan',
  balance: c?.balance ?? null,
  monthly_payment: c?.monthly_payment ?? null,
  next_payment_date: c?.next_payment_date ?? '',
  last_payment_date: c?.last_payment_date ?? '',
  original_amount: c?.original_amount ?? null,
  rate: c?.rate !== null && c?.rate !== undefined ? String(c.rate).replace('.', ',') : '',
});

/** "45,5" → 45.5 · "" → null · anything else → NaN. */
function parseRate(s: string): number | null {
  const v = s.trim().replace(/\s|%/g, '').replace(',', '.');
  if (!v) return null;
  if (!/^\d+(\.\d+)?$/.test(v)) return NaN;
  const n = Number(v);
  return n > 1000 ? NaN : n;
}

function FormDialog({ credit, report, initialOrg, onClose, onDeleted, onAdded }: Props) {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  const toast = useToast();
  const formId = useId();
  const update = useUpdateCredit();
  const add = useAddCredit();
  const del = useDeleteCredit();
  const [f, setF] = useState<FormState>(() => initial(credit, initialOrg));
  const [submitted, setSubmitted] = useState(false);
  const [rateTouched, setRateTouched] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const closeConfirm = useStableCallback(() => setConfirm(false));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const rate = parseRate(f.rate);
  const errors = {
    organization: submitted && !f.organization.trim() ? t.form.errOrg : undefined,
    balance: submitted && f.balance === null ? t.form.errAmount : undefined,
    monthly_payment: submitted && f.monthly_payment === null ? t.form.errAmount : undefined,
    rate: (submitted || rateTouched) && Number.isNaN(rate) ? t.form.errRate : undefined,
  };

  const reportDate = credit && report && report.id === credit.report_id ? report.uploaded_at : credit?.created_at;
  const description = !credit
    ? t.form.descAdd
    : credit.source === 'report'
      ? t.form.descReport(dateIn(reportDate!, lang, 'attr'))
      : t.form.descManual(dateIn(credit.created_at, lang, 'loc'));

  /** «изменено» + «В отчёте: X» when the field differs from the credit report. */
  const reportHint = (field: MoneyKey) => {
    if (!credit || credit.source !== 'report') return {};
    const rv = credit.report_values[field];
    const original = typeof rv === 'number' ? rv : credit[field];
    if (original === null || original === undefined || original === f[field]) return {};
    return { badge: <span className={styles.badge}>{t.form.changed}</span>, hint: t.form.inReport(money(original)) };
  };

  const fail = (e: unknown) => setSaveError(e instanceof ApiError && e.code === 'validation' ? t.form.errValidation : c.saveFailed);
  const pending = update.isPending || add.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setSaveError(null);
    if (!f.organization.trim() || f.balance === null || f.monthly_payment === null || Number.isNaN(rate)) return;
    const org = f.organization.trim();
    if (credit) {
      const body: CreditPatch = {};
      if (org !== credit.organization) body.organization = org;
      if (f.type !== credit.type) body.type = f.type;
      if (f.balance !== credit.balance) body.balance = f.balance;
      if (f.monthly_payment !== credit.monthly_payment) body.monthly_payment = f.monthly_payment;
      if (f.next_payment_date !== (credit.next_payment_date ?? '')) body.next_payment_date = f.next_payment_date || null;
      if (f.last_payment_date !== (credit.last_payment_date ?? '')) body.last_payment_date = f.last_payment_date || null;
      if (f.original_amount !== credit.original_amount) body.original_amount = f.original_amount;
      if (rate !== credit.rate) body.rate = rate;
      if (Object.keys(body).length === 0) return onClose();
      update.mutate(
        { id: credit.id, ...body },
        {
          onSuccess: (res) => {
            toast({ tone: 'success', text: t.form.savedToast(percent(res.recalculated?.load ?? 0)) });
            onClose();
          },
          onError: fail,
        },
      );
    } else {
      const body: CreditInput = {
        organization: org,
        type: f.type,
        balance: f.balance,
        monthly_payment: f.monthly_payment,
        next_payment_date: f.next_payment_date || null,
        last_payment_date: f.last_payment_date || null,
        original_amount: f.original_amount,
        rate,
        is_minimum_payment: f.type === 'credit_card',
      };
      add.mutate(body, {
        onSuccess: (res) => {
          toast({ tone: 'success', text: t.form.addedToast });
          onAdded(res.id);
        },
        onError: fail,
      });
    }
  };

  const remove = () =>
    credit &&
    del.mutate(credit.id, {
      onSuccess: () => {
        setConfirm(false);
        toast({ tone: 'success', text: t.form.deletedToast });
        onDeleted();
      },
      onError: () => {
        setConfirm(false);
        toast({ tone: 'error', text: c.saveFailed });
      },
    });

  const footer = (
    <div className={styles.dlgFooter}>
      {credit && (
        <Button variant="ghost" icon="trash" className={styles.deleteBtn} onClick={() => setConfirm(true)}>
          {t.form.delete}
        </Button>
      )}
      <div className={styles.dlgFooterRight}>
        <Button variant="secondary" onClick={onClose}>
          {c.cancel}
        </Button>
        <Button type="submit" form={formId} disabled={pending}>
          {credit ? t.form.save : t.form.create}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open onClose={onClose} title={credit ? t.form.editTitle(credit.organization) : t.form.addTitle} description={description} footer={footer}>
      <form id={formId} className={styles.formGrid} onSubmit={submit} noValidate>
        <TextField
          label={t.form.org}
          value={f.organization}
          placeholder={t.form.orgPlaceholder}
          maxLength={80}
          autoComplete="organization"
          error={errors.organization}
          onChange={(e) => set('organization', e.target.value)}
        />
        <SelectField
          label={t.form.type}
          value={f.type}
          onChange={(e) => set('type', e.target.value as CreditType)}
          options={CREDIT_TYPES.map((type) => ({ value: type, label: c.creditType[type] }))}
        />
        <MoneyField
          label={t.form.balance}
          value={f.balance}
          emptyAsNull
          onChange={(v) => set('balance', v)}
          invalidMessage={c.errors.money_letters}
          error={errors.balance}
          {...reportHint('balance')}
        />
        <MoneyField
          label={f.type === 'credit_card' ? t.form.minimum : t.form.monthly}
          value={f.monthly_payment}
          emptyAsNull
          onChange={(v) => set('monthly_payment', v)}
          invalidMessage={c.errors.money_letters}
          error={errors.monthly_payment}
          {...reportHint('monthly_payment')}
        />
        <TextField label={t.form.next} type="date" value={f.next_payment_date} onChange={(e) => set('next_payment_date', e.target.value)} />
        <TextField label={t.form.last} type="date" value={f.last_payment_date} onChange={(e) => set('last_payment_date', e.target.value)} />
        <MoneyField
          label={t.form.original}
          value={f.original_amount}
          emptyAsNull
          onChange={(v) => set('original_amount', v)}
          invalidMessage={c.errors.money_letters}
          {...reportHint('original_amount')}
        />
        <TextField
          label={
            <>
              {t.form.rate} <span className={styles.optional}>{t.form.rateOptional}</span>
            </>
          }
          inputMode="decimal"
          autoComplete="off"
          placeholder={t.form.ratePlaceholder}
          value={f.rate}
          error={errors.rate}
          onChange={(e) => set('rate', e.target.value)}
          onBlur={() => setRateTouched(true)}
        />
      </form>
      <p className={styles.formNote}>
        <Icon name="info" size={18} />
        {t.form.note}
      </p>
      {saveError && (
        <Alert tone="danger" role="alert">
          {saveError}
        </Alert>
      )}
      {credit && (
        <ConfirmDialog
          open={confirm}
          onClose={closeConfirm}
          onConfirm={remove}
          title={t.form.deleteTitle(credit.organization)}
          text={t.form.deleteText}
          confirmLabel={t.form.deleteConfirm}
          cancelLabel={t.detail.keep}
          busy={del.isPending}
        />
      )}
    </Dialog>
  );
}
