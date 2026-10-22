import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { useLogin } from './authApi';
import { Field, FormError, PasswordInput, TextInput, useErrorText, useFocusInvalid } from './fields';
import { dict } from './i18n';
import styles from './Auth.module.css';

const DEMO_PASSWORD = 'qorgan2026';

type Errors = Partial<Record<'login' | 'password' | 'form', string>>;

/** «С возвращением»: phone or email + password → `next` or the overview. */
export function LoginForm({ next, onToRegister, onToRecover }: { next: string | null; onToRegister: () => void; onToRecover: () => void }) {
  const t = useT(dict);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const errText = useErrorText();
  const login = useLogin();
  const [formRef, focusInvalid] = useFocusInvalid();
  const [ident, setIdent] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const run = (body: { login: string; password: string }) =>
    login.mutate(body, {
      onSuccess: (session: Session) => {
        signIn(session);
        navigate(next ?? '/dashboard', { replace: true });
      },
      onError: (err) => setErrors({ form: errText(err) }),
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (login.isPending) return;
    const nextErrors: Errors = {};
    if (!ident.trim()) nextErrors.login = errText('login_required');
    if (!password) nextErrors.password = errText('password_required');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return focusInvalid();
    run({ login: ident.trim(), password });
  };

  return (
    <>
      <form ref={formRef} aria-labelledby="login-title" className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.heading}>
          <h1 id="login-title" className={styles.title} tabIndex={-1}>
            {t.login.title}
          </h1>
          <p className={styles.lead}>{t.login.lead}</p>
        </div>

        <Field label={t.login.id} error={errors.login}>
          {(a11y) => (
            <TextInput a11y={a11y} type="text" autoComplete="username" value={ident} invalid={!!errors.login} onChange={(e) => setIdent(e.target.value)} />
          )}
        </Field>

        <Field
          label={t.password}
          error={errors.password}
          labelAction={
            <button type="button" className={styles.forgot} onClick={onToRecover}>
              {t.login.forgot}
            </button>
          }
        >
          {(a11y) => <PasswordInput a11y={a11y} value={password} onChange={setPassword} autoComplete="current-password" invalid={!!errors.password} />}
        </Field>

        <FormError>{errors.form}</FormError>
        <Button type="submit" size="xl" block disabled={login.isPending} aria-busy={login.isPending || undefined}>
          {t.login.submit}
        </Button>
        <p className={styles.switch}>
          {t.login.noAccount}{' '}
          <button type="button" className={styles.textButton} onClick={onToRegister}>
            {t.login.toRegister}
          </button>
        </p>
      </form>

      {import.meta.env.DEV && (
        <details className={styles.demo}>
          <summary>{t.demo.title}</summary>
          <p className={styles.muted}>{t.demo.note}</p>
          <ul>
            {t.demo.accounts.map((a) => (
              <li key={a.phone}>
                <button
                  type="button"
                  className={styles.demoButton}
                  disabled={login.isPending}
                  aria-label={`${t.demo.loginAs(a.name)}: ${a.phone}, ${a.text}`}
                  onClick={() => {
                    setIdent(a.phone);
                    setPassword(DEMO_PASSWORD);
                    setErrors({});
                    run({ login: a.phone, password: DEMO_PASSWORD });
                  }}
                >
                  <b>{a.name}</b>
                  <span className="tabular">{a.phone}</span>
                  <span className={styles.muted}>{a.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
