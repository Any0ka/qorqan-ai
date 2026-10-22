import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '@/api/client';
import type { Session, VerificationStarted } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { passwordOk, useRecoverConfirm, useResend, useVerify } from './authApi';
import { CODE_LENGTH, CodeInputs, Field, FormError, PasswordInput, PasswordRule, useErrorText } from './fields';
import { dict } from './i18n';
import styles from './Auth.module.css';

const CODE_ERRORS = new Set(['code_invalid', 'code_expired', 'too_many_attempts', 'code_incomplete']);
/** After these the old code is useless, so a new one may be requested right away. */
const RESEND_NOW = new Set(['code_expired', 'too_many_attempts']);

function useCountdown(seconds: number, key: string): number {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const started = Date.now();
    setLeft(seconds);
    const id = window.setInterval(() => {
      const l = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(l);
      if (l === 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [seconds, key]);
  return left;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

interface Props {
  purpose: 'register' | 'recover';
  verification: VerificationStarted;
  onResent: (v: VerificationStarted) => void;
  onBack: () => void;
  onDone: (session: Session) => void;
}

/** «Введи код из SMS»: 4 digits, resend countdown; for recovery also the new password. */
export function CodeStep({ purpose, verification, onResent, onBack, onDone }: Props) {
  const t = useT(dict);
  const c = useT(common);
  const errText = useErrorText();
  const verify = useVerify();
  const confirm = useRecoverConfirm();
  const resend = useResend();
  const [code, setCode] = useState<string[]>(() => Array(CODE_LENGTH).fill(''));
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ code?: string; password?: string; form?: string }>({});
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const left = useCountdown(verification.resend_after, verification.verification_id);
  const pending = verify.isPending || confirm.isPending;
  const canResend = (left === 0 || (lastCode !== null && RESEND_NOW.has(lastCode))) && !resend.isPending;

  const fail = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : 'unknown';
    setLastCode(code);
    if (CODE_ERRORS.has(code)) {
      const attempts = err instanceof ApiError && typeof err.detail.attempts_left === 'number' ? err.detail.attempts_left : null;
      setErrors({ code: [errText(code), attempts !== null && attempts > 0 ? t.code.attemptsLeft(attempts) : ''].join(' ').trim() });
    } else if (code === 'password_weak') setErrors({ password: errText(code) });
    else setErrors({ form: errText(code) });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const value = code.join('');
    const next: typeof errors = {};
    if (value.length < CODE_LENGTH) next.code = errText('code_incomplete');
    if (purpose === 'recover' && !passwordOk(password)) next.password = c.errors.password_weak;
    setErrors(next);
    setStatus('');
    if (next.code || next.password) return;
    const opts = { onSuccess: onDone, onError: fail };
    if (purpose === 'register') verify.mutate({ verification_id: verification.verification_id, code: value }, opts);
    else confirm.mutate({ verification_id: verification.verification_id, code: value, new_password: password }, opts);
  };

  const doResend = () =>
    resend.mutate(
      { verification_id: verification.verification_id },
      {
        onSuccess: (v) => {
          onResent(v);
          setCode(Array(CODE_LENGTH).fill(''));
          setErrors({});
          setLastCode(null);
          setStatus(t.code.resent);
        },
        onError: (err) => setErrors({ form: errText(err) }),
      },
    );

  return (
    <form aria-labelledby="code-title" className={styles.form} onSubmit={submit} noValidate>
      <button type="button" className={styles.backLink} onClick={onBack}>
        <Icon name="chevronLeft" size={18} strokeWidth={2} />
        {t.code.back}
      </button>
      <div className={styles.heading}>
        <h1 id="code-title" className={styles.title}>
          {t.code.title}
        </h1>
        <p className={styles.lead}>{t.code.sentTo(verification.phone_masked)}</p>
      </div>

      <div className={styles.field}>
        <CodeInputs value={code} onChange={setCode} invalid={!!errors.code} describedBy={errors.code ? 'code-err' : undefined} />
        {errors.code && (
          <p id="code-err" className={styles.error} role="alert">
            <Icon name="alert" size={16} />
            {errors.code}
          </p>
        )}
      </div>

      {verification.dev_code && (
        <p className={styles.devHint}>
          <b>{t.code.devLabel}</b> {t.code.devHint} <code>{verification.dev_code}</code>
        </p>
      )}

      <div className={styles.resendRow}>
        {canResend ? (
          <button type="button" className={styles.textButton} onClick={doResend}>
            {t.code.resend}
          </button>
        ) : (
          <p className={styles.muted}>{t.code.resendIn(clock(left))}</p>
        )}
        <p role="status" className={styles.statusText}>
          {status}
        </p>
      </div>

      {purpose === 'recover' && (
        <Field label={t.code.newPassword} error={errors.password} hint={<PasswordRule ok={passwordOk(password)} />}>
          {(a11y) => <PasswordInput a11y={a11y} value={password} onChange={setPassword} autoComplete="new-password" invalid={!!errors.password} />}
        </Field>
      )}

      <FormError>{errors.form}</FormError>
      <Button type="submit" size="xl" block disabled={pending} aria-busy={pending || undefined}>
        {purpose === 'register' ? t.code.submit : t.code.submitRecover}
      </Button>
    </form>
  );
}
