import { useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { errorCode } from './authApi';
import { dict } from './i18n';
import styles from './Auth.module.css';

/** Turns an error code (ours or the API's) into a sentence for the user. */
export function useErrorText() {
  const t = useT(dict);
  const c = useT(common);
  return (codeOrError: unknown) => {
    const code = typeof codeOrError === 'string' ? codeOrError : errorCode(codeOrError);
    return t.errors[code] ?? c.errors[code] ?? c.errors.unknown;
  };
}

/** After a rejected submit, move focus to the first field marked invalid. */
export function useFocusInvalid() {
  const ref = useRef<HTMLFormElement>(null);
  const focusInvalid = () =>
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  return [ref, focusInvalid] as const;
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className={styles.error} role="alert">
      <Icon name="alert" size={16} />
      {children}
    </p>
  );
}

/** Save/submit error shown above the action button (System-States: «ошибка сохранения — над кнопкой»). */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className={styles.formError} role="alert">
      <Icon name="alert" size={18} />
      <span>{children}</span>
    </div>
  );
}

interface FieldProps {
  label: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  labelAction?: ReactNode;
  children: (a11y: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode;
}

/** Label + control + error/hint, sized as on the Auth board (label 14/600, gap 8). */
export function Field({ label, error, hint, labelAction, children }: FieldProps) {
  const id = useId();
  const described = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {labelAction}
      </div>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': described })}
      {hint && <div id={`${id}-hint`}>{hint}</div>}
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
    </div>
  );
}

type A11y = Parameters<FieldProps['children']>[0];

export function TextInput({ a11y, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { a11y: A11y; invalid?: boolean }) {
  return <input {...a11y} {...rest} className={`${styles.input} ${invalid ? styles.invalid : ''}`} />;
}

// ------------------------------------------------------------------ phone

/** "7012345678" → "701 234 56 78". */
export function formatPhone(digits: string): string {
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)].filter(Boolean).join(' ');
}

/** Digits after +7: drops a leading 7/8 country code when a full number was pasted or autofilled. */
function nationalDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
  return d.slice(0, 10);
}

/** Phone input with a fixed "+7" prefix. Holds the 10 national digits; shows them as "701 234 56 78". */
export function PhoneInput({
  a11y,
  value,
  onChange,
  invalid,
  autoFocus,
  autoComplete = 'tel-national',
}: {
  a11y: A11y;
  value: string;
  onChange: (digits: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const caretDigits = useRef<number | null>(null);
  const shown = formatPhone(value);

  // Keep the caret after the same number of digits once spaces are re-inserted.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caretDigits.current === null || document.activeElement !== el) return;
    let pos = 0;
    let seen = 0;
    while (pos < shown.length && seen < caretDigits.current) {
      if (/\d/.test(shown[pos])) seen++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
    caretDigits.current = null;
  }, [shown]);

  return (
    <div className={`${styles.phoneBox} ${invalid ? styles.invalid : ''}`}>
      <span aria-hidden="true" className={styles.phonePrefix}>
        +7
      </span>
      <input
        ref={ref}
        {...a11y}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        placeholder="700 000 00 00"
        className={styles.bareInput}
        value={shown}
        onChange={(e) => {
          const raw = e.target.value;
          const all = raw.replace(/\D/g, '');
          const caret = e.target.selectionStart ?? raw.length;
          if (all === value && raw.length < shown.length) {
            // Only a space was erased: erase the digit next to it instead, or the caret could never cross a gap.
            const before = raw.slice(0, caret).replace(/\D/g, '').length;
            const cut = (e.nativeEvent as InputEvent).inputType === 'deleteContentForward' ? before : before - 1;
            if (cut < 0 || cut >= value.length) return;
            caretDigits.current = cut;
            onChange(value.slice(0, cut) + value.slice(cut + 1));
            return;
          }
          // A jump of several digits at once is a paste/autofill: it may carry the country code.
          const digits = all.length - value.length > 1 ? nationalDigits(raw) : all.slice(0, 10);
          caretDigits.current = raw.slice(0, caret).replace(/\D/g, '').length;
          onChange(digits);
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------ password

export function PasswordInput({
  a11y,
  value,
  onChange,
  autoComplete,
  invalid,
}: {
  a11y: A11y;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'new-password' | 'current-password';
  invalid?: boolean;
}) {
  const t = useT(dict);
  const [visible, setVisible] = useState(false);
  return (
    <div className={`${styles.passwordBox} ${invalid ? styles.invalid : ''}`}>
      <input
        {...a11y}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        className={styles.bareInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className={styles.eye} aria-label={visible ? t.passwordHide : t.passwordShow} onClick={() => setVisible((v) => !v)}>
        <Icon name={visible ? 'eyeOff' : 'eye'} size={20} />
      </button>
    </div>
  );
}

/** «Не меньше 8 символов и хотя бы одна цифра» — turns into a check once satisfied. */
export function PasswordRule({ ok }: { ok: boolean }) {
  const t = useT(dict);
  return (
    <p className={`${styles.rule} ${ok ? styles.ruleOk : ''}`}>
      <Icon name={ok ? 'check' : 'info'} size={14} strokeWidth={ok ? 2.4 : 2} />
      {ok && <span className="visually-hidden">{t.passwordRuleOk}</span>}
      {t.passwordRule}
    </p>
  );
}

// ------------------------------------------------------------------ SMS code

export const CODE_LENGTH = 4;

/** Four one-digit boxes: auto-advance, Backspace goes back, a pasted code fills every box. */
export function CodeInputs({ value, onChange, invalid, describedBy }: { value: string[]; onChange: (v: string[]) => void; invalid?: boolean; describedBy?: string }) {
  const t = useT(dict);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const focus = (i: number) => refs.current[Math.max(0, Math.min(CODE_LENGTH - 1, i))]?.focus();

  const fill = (from: number, digits: string) => {
    const next = [...value];
    digits
      .slice(0, CODE_LENGTH - from)
      .split('')
      .forEach((d, k) => (next[from + k] = d));
    onChange(next);
    focus(from + digits.length);
  };

  return (
    <fieldset className={styles.codeFieldset} aria-describedby={describedBy}>
      <legend className="visually-hidden">{t.code.legend}</legend>
      <div className={styles.codeRow}>
        {value.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            aria-label={t.code.digit(i + 1)}
            aria-invalid={invalid || undefined}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            autoFocus={i === 0}
            maxLength={i === 0 ? CODE_LENGTH : 1}
            className={`${styles.codeInput} ${invalid ? styles.invalid : ''}`}
            value={d}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '');
              if (digits) {
                // Several digits at once (one-time-code autofill into the first box) spread over the next boxes.
                fill(i, digits);
              } else {
                const next = [...value];
                next[i] = '';
                onChange(next);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !value[i] && i > 0) {
                e.preventDefault();
                const next = [...value];
                next[i - 1] = '';
                onChange(next);
                focus(i - 1);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                focus(i - 1);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                focus(i + 1);
              }
            }}
            onPaste={(e) => {
              const digits = e.clipboardData.getData('text').replace(/\D/g, '');
              if (!digits) return;
              e.preventDefault();
              fill(digits.length >= CODE_LENGTH ? 0 : i, digits);
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
