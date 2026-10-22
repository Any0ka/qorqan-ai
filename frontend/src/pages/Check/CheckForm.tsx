import type { ReactNode, RefObject } from 'react';
import type { CheckPreview, FinancingKind } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Alert, Button, MoneyField, RadioCards, Segmented, SelectField, TextField, ToggleGroup } from '@/components/ui';
import { common } from '@/i18n/common';
import { useT } from '@/i18n/I18nProvider';
import { money, percent } from '@/lib/format';
import { KINDS, QUICK, TERMS, termMonths, type CheckForm, type FieldError, type TermChoice } from './form';
import { dict } from './i18n';
import styles from './Check.module.css';

export interface FormProps {
  form: CheckForm;
  set: (patch: Partial<CheckForm>) => void;
  /** Errors to show (only after the first submit attempt). */
  errors: FieldError[];
  preview: CheckPreview | null;
  submitError: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onClear: () => void;
  formRef: RefObject<HTMLFormElement>;
}

const PRESET_TITLES = new Set(Object.values(dict).flatMap((d) => Object.values(d.form.categories)));

function useMonthly(form: CheckForm, preview: CheckPreview | null) {
  const t = useT(dict);
  const auto = form.monthly === null;
  const value = auto ? (preview?.monthly_auto ? preview.monthly_payment : null) : form.monthly;
  let hint: string = t.form.monthlyManual;
  if (auto) {
    if (preview?.monthly_auto && form.price) {
      const financed = preview.total_cost - form.down;
      const principal = form.price - form.down;
      const markup = principal > 0 ? (financed - form.fees) / principal - 1 : 0;
      hint = t.form.monthlyAuto(money(financed), termMonths(form) ?? 12, markup > 0.004 ? percent(markup) : null);
    } else hint = t.form.monthlyWaiting;
  }
  return { auto, value, hint };
}

function SaveError({ onRetry }: { onRetry: () => void }) {
  const t = useT(dict);
  return (
    <Alert tone="danger" role="alert" className={styles.saveError}>
      <span className={styles.saveErrorText}>
        {t.form.saveErrorBefore}
        <button type="button" className={styles.inlineRetry} onClick={onRetry}>
          {t.form.saveErrorRetry}
        </button>
        .
      </span>
    </Alert>
  );
}

function FormShell({ formRef, onSubmit, className, labelledBy, children }: Pick<FormProps, 'formRef' | 'onSubmit'> & { className: string; labelledBy: string; children: ReactNode }) {
  return (
    <form
      ref={formRef}
      noValidate
      aria-labelledby={labelledBy}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

/** «Параметры нового обязательства» — the full form of /check. */
export function FullForm(props: FormProps) {
  const { form, set, errors, preview, submitError, submitting, onSubmit, onClear } = props;
  const t = useT(dict);
  const c = useT(common);
  const f = t.form;
  const own = form.kind === 'own';
  const monthly = useMonthly(form, preview);

  const pick = (cat: string) => {
    const category = cat as CheckForm['category'];
    const keepTitle = form.title.trim() !== '' && !PRESET_TITLES.has(form.title.trim());
    set({ category, title: cat === 'other' ? (keepTitle ? form.title : '') : f.categories[cat as keyof typeof f.categories] });
  };

  return (
    <FormShell {...props} className={styles.formCard} labelledBy="form-title">
      <div className={styles.formHead}>
        <h2 id="form-title" className={styles.formTitle}>
          {f.title}
        </h2>
        <p className={styles.formSubtitle}>{f.subtitle}</p>
      </div>

      <div className={styles.fieldGroup}>
        <TextField label={f.what} name="title" value={form.title} placeholder={f.whatPlaceholder} maxLength={120} onChange={(e) => set({ title: e.target.value })} />
        <ToggleGroup<string> label={f.quick} value={form.category ?? ''} onChange={pick} options={QUICK.map((q) => ({ value: q, label: f.categories[q] }))} />
      </div>

      <MoneyField
        label={f.price}
        name="price"
        value={form.price}
        emptyAsNull
        invalidMessage={c.errors.money_letters}
        error={errors.includes('price') ? f.priceRequired : undefined}
        onChange={(v) => set({ price: v })}
      />

      <RadioCards<FinancingKind>
        legend={f.kind}
        name="kind"
        value={form.kind}
        onChange={(kind) => set({ kind })}
        options={KINDS.map((k) => ({ value: k, title: f.kinds[k].title, description: f.kinds[k].description }))}
      />

      {!own && (
        <div className={styles.pairRow}>
          <MoneyField
            label={f.down}
            name="down"
            value={form.down}
            fieldClassName={styles.downField}
            invalidMessage={c.errors.money_letters}
            error={errors.includes('down') ? f.downTooBig : undefined}
            onChange={(v) => set({ down: v ?? 0 })}
          />
          <div className={styles.termField}>
            <Segmented<TermChoice>
              legend={f.term}
              name="term"
              value={form.term}
              onChange={(term) => set({ term })}
              options={TERMS.map((v) => ({ value: v, label: v === 'other' ? f.termOther : f.termOption(Number(v)) }))}
            />
            {form.term === 'other' && (
              <TextField
                label={f.customTerm}
                name="customTerm"
                inputMode="numeric"
                autoComplete="off"
                value={form.customTerm}
                error={errors.includes('term') ? f.customTermError : undefined}
                onChange={(e) => set({ customTerm: e.target.value.replace(/\D/g, '').slice(0, 3) })}
              />
            )}
          </div>
        </div>
      )}

      {!own && (
        <MoneyField
          label={f.monthly}
          name="monthly"
          value={monthly.value}
          emptyAsNull
          suffixText={f.monthlySuffix}
          invalidMessage={c.errors.money_letters}
          hint={
            <>
              <Icon name="info" size={16} className={styles.hintIcon} />
              {monthly.hint}
            </>
          }
          labelAction={
            !monthly.auto && (
              <button type="button" className={styles.resetLink} onClick={() => set({ monthly: null })}>
                <Icon name="refresh" size={16} />
                {f.monthlyReset}
              </button>
            )
          }
          onChange={(v) => set({ monthly: v })}
        />
      )}

      <MoneyField
        label={
          <>
            {f.fees} <span className={styles.optional}>{f.optional}</span>
          </>
        }
        name="fees"
        value={form.fees}
        hint={f.feesHint}
        invalidMessage={c.errors.money_letters}
        onChange={(v) => set({ fees: v ?? 0 })}
      />

      <div className={styles.submitArea}>
        {submitError && <SaveError onRetry={onSubmit} />}
        <div className={styles.submitRow}>
          <Button type="submit" size="xl" iconRight="arrowRight" disabled={submitting}>
            {f.submit}
          </Button>
          <Button variant="secondary" size="xl" className={styles.clearBtn} onClick={onClear} disabled={submitting}>
            {f.clear}
          </Button>
        </div>
        <p className={styles.small}>{f.disclaimer}</p>
      </div>
    </FormShell>
  );
}

/** Check-AI: the same form in a compact grid with selects instead of cards. */
export function CompactForm(props: FormProps) {
  const { form, set, errors, preview, submitError, submitting, onSubmit } = props;
  const t = useT(dict);
  const c = useT(common);
  const f = t.form;
  const k = t.compact;
  const own = form.kind === 'own';
  const monthly = useMonthly(form, preview);

  return (
    <FormShell {...props} className={styles.compactCard} labelledBy="f-title">
      <h2 id="f-title" className={styles.formTitle}>
        {f.title}
      </h2>
      <div className={styles.compactGrid}>
        <TextField label={f.what} name="title" value={form.title} placeholder={f.whatPlaceholder} maxLength={120} onChange={(e) => set({ title: e.target.value })} />
        <MoneyField
          label={k.price}
          name="price"
          value={form.price}
          emptyAsNull
          suffixText=""
          invalidMessage={c.errors.money_letters}
          error={errors.includes('price') ? f.priceRequired : undefined}
          onChange={(v) => set({ price: v })}
        />
        <SelectField
          label={k.kind}
          name="kind"
          value={form.kind}
          onChange={(e) => set({ kind: e.target.value as FinancingKind })}
          options={KINDS.map((v) => ({ value: v, label: f.kinds[v].title }))}
        />
        {!own && (
          <SelectField
            label={k.term}
            name="term"
            value={form.term}
            onChange={(e) => set({ term: e.target.value as TermChoice })}
            options={TERMS.map((v) => ({ value: v, label: v === 'other' ? k.termOther : k.termOption(Number(v)) }))}
          />
        )}
        {!own && form.term === 'other' && (
          <TextField
            label={f.customTerm}
            name="customTerm"
            inputMode="numeric"
            autoComplete="off"
            value={form.customTerm}
            error={errors.includes('term') ? f.customTermError : undefined}
            onChange={(e) => set({ customTerm: e.target.value.replace(/\D/g, '').slice(0, 3) })}
          />
        )}
        {!own && (
          <MoneyField
            label={k.down}
            name="down"
            value={form.down}
            suffixText=""
            invalidMessage={c.errors.money_letters}
            error={errors.includes('down') ? f.downTooBig : undefined}
            onChange={(v) => set({ down: v ?? 0 })}
          />
        )}
        {!own && (
          <MoneyField
            label={k.monthly}
            name="monthly"
            value={monthly.value}
            emptyAsNull
            suffixText=""
            invalidMessage={c.errors.money_letters}
            hint={monthly.auto && monthly.value !== null ? k.monthlyAuto : undefined}
            labelAction={
              !monthly.auto && (
                <button type="button" className={styles.resetLink} onClick={() => set({ monthly: null })} aria-label={f.monthlyReset}>
                  <Icon name="refresh" size={16} />
                </button>
              )
            }
            onChange={(v) => set({ monthly: v })}
          />
        )}
        <MoneyField label={k.fees} name="fees" value={form.fees} suffixText="" invalidMessage={c.errors.money_letters} onChange={(v) => set({ fees: v ?? 0 })} />
      </div>
      {submitError && <SaveError onRetry={onSubmit} />}
      <div className={styles.compactSubmit}>
        <Button type="submit" size="lg" iconRight="arrowRight" disabled={submitting} className={styles.compactSubmitBtn}>
          {f.submit}
        </Button>
        <p className={styles.small}>{f.disclaimer}</p>
      </div>
    </FormShell>
  );
}
