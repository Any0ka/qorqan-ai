import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { num, parseMoney } from '@/lib/format';
import { Icon } from '../Icon';
import styles from './Field.module.css';

interface FieldShellProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  labelAction?: ReactNode;
  className?: string;
}

/** Label + control + hint/error, laid out as in the design (label 15/600, gap 10). */
export function FieldShell({ id, label, hint, error, badge, children, labelAction, className }: FieldShellProps) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {badge}
        </label>
        {labelAction}
      </div>
      {children}
      {error ? (
        <p id={`${id}-err`} className={styles.error} role="alert">
          <Icon name="alert" size={16} />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className={styles.hint}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function describedBy(id: string, hint?: ReactNode, error?: ReactNode) {
  return error ? `${id}-err` : hint ? `${id}-hint` : undefined;
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'prefix'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  badge?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  labelAction?: ReactNode;
  fieldClassName?: string;
}

export function TextField({ label, hint, error, badge, prefix, suffix, labelAction, fieldClassName, ...input }: TextFieldProps) {
  const id = useId();
  const control = (
    <input
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error)}
      {...input}
      className={prefix || suffix ? styles.bareInput : `${styles.input} ${error ? styles.invalid : ''}`}
    />
  );
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} badge={badge} labelAction={labelAction} className={fieldClassName}>
      {prefix || suffix ? (
        <div className={`${styles.affixBox} ${error ? styles.invalid : ''}`}>
          {prefix && <span className={styles.prefix} aria-hidden="true">{prefix}</span>}
          {control}
          {suffix && <span className={styles.suffix}>{suffix}</span>}
        </div>
      ) : (
        control
      )}
    </FieldShell>
  );
}

interface MoneyFieldProps extends Omit<TextFieldProps, 'value' | 'onChange' | 'type' | 'inputMode'> {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Message shown when the text can't be read as a sum. */
  invalidMessage: string;
  suffixText?: string;
  emptyAsNull?: boolean;
}

/** Amount input: shows "840 000", accepts digits and spaces, reports letters as an error next to the field. */
export function MoneyField({ value, onChange, invalidMessage, suffixText = '₸', emptyAsNull = false, error, ...rest }: MoneyFieldProps) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === null || value === undefined ? '' : num(value));
  const parsed = text === null ? value : parseMoney(text);
  const invalid = text !== null && parsed === null;
  return (
    <TextField
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={shown}
      suffix={suffixText ? <span aria-hidden="true">{suffixText}</span> : undefined}
      error={invalid ? invalidMessage : error}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const p = parseMoney(raw);
        if (p !== null) onChange(emptyAsNull && raw.trim() === '' ? null : p);
      }}
      onBlur={() => {
        if (!invalid) setText(null);
      }}
    />
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: Array<{ value: string; label: string }>;
  fieldClassName?: string;
}

export function SelectField({ label, hint, error, options, fieldClassName, ...select }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={fieldClassName}>
      <div className={styles.selectWrap}>
        <select id={id} aria-describedby={describedBy(id, hint, error)} className={styles.select} {...select}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={18} className={styles.selectIcon} />
      </div>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: ReactNode;
  hint?: ReactNode;
  hideLabel?: boolean;
}

export function TextAreaField({ label, hint, hideLabel, ...rest }: TextAreaFieldProps) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : styles.label}>
        {label}
      </label>
      <textarea id={id} className={styles.textarea} {...rest} />
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}

/** Checkbox with a rich label (consents, report confirmation). */
export function Checkbox({ label, ...input }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode }) {
  return (
    <label className={styles.checkbox}>
      <input type="checkbox" {...input} />
      <span>{label}</span>
    </label>
  );
}

/** Grid of large radio cards (Вид финансирования, способ добавления кредитов). */
export function RadioCards<V extends string>({
  legend,
  name,
  value,
  onChange,
  options,
  min = 160,
  hideLegend,
}: {
  legend: ReactNode;
  name: string;
  value: V;
  onChange: (v: V) => void;
  options: Array<{ value: V; title: ReactNode; description?: ReactNode; disabled?: boolean; tag?: ReactNode }>;
  min?: number;
  hideLegend?: boolean;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={hideLegend ? 'visually-hidden' : styles.legend}>{legend}</legend>
      <div className={styles.radioCards} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))` }}>
        {options.map((o) => (
          <label key={o.value} className={`${styles.radioCard} ${value === o.value ? styles.radioCardOn : ''} ${o.disabled ? styles.radioCardOff : ''}`}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} disabled={o.disabled} onChange={() => onChange(o.value)} />
            <span className={styles.radioText}>
              {o.tag}
              <span className={styles.radioTitle}>{o.title}</span>
              {o.description && <span className={styles.radioDesc}>{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Segmented radio group (Срок: 3 · 6 · 12 · 24). */
export function Segmented<V extends string>({
  legend,
  name,
  value,
  onChange,
  options,
  hideLegend,
  size = 'md',
}: {
  legend: ReactNode;
  name: string;
  value: V;
  onChange: (v: V) => void;
  options: Array<{ value: V; label: ReactNode }>;
  hideLegend?: boolean;
  size?: 'sm' | 'md';
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={hideLegend ? 'visually-hidden' : styles.legend}>{legend}</legend>
      <div className={`${styles.segmented} ${styles['seg_' + size]}`}>
        {options.map((o) => (
          <label key={o.value} className={`${styles.segOption} ${value === o.value ? styles.segOn : ''}`}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Toggle buttons (aria-pressed): quick picks, filters, view switch. */
export function ToggleGroup<V extends string>({
  label,
  value,
  onChange,
  options,
  variant = 'chips',
}: {
  label: string;
  value: V;
  onChange: (v: V) => void;
  options: Array<{ value: V; label: ReactNode }>;
  variant?: 'chips' | 'tabs';
}) {
  return (
    <div role="group" aria-label={label} className={variant === 'chips' ? styles.chips : styles.tabs}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          className={variant === 'chips' ? styles.chip : styles.tab}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** On/off switch built on a real checkbox (role="switch"). */
export function Switch({
  label,
  description,
  checked,
  onChange,
  disabled,
  stateLabel,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  stateLabel?: ReactNode;
}) {
  return (
    <label className={`${styles.switchRow} ${disabled ? styles.switchDisabled : ''}`}>
      <span className={styles.switchText}>
        <span className={styles.switchLabel}>{label}</span>
        {description && <span className={styles.switchDesc}>{description}</span>}
      </span>
      {stateLabel && <span className={styles.switchState}>{stateLabel}</span>}
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden="true" className={styles.switchTrack}>
        <span className={styles.switchThumb} />
      </span>
    </label>
  );
}
