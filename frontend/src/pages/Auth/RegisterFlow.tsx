import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { VerificationStarted } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui';
import { useLang, useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { errorCode, passwordOk, useRegister } from './authApi';
import { CodeStep } from './CodeStep';
import { Field, FormError, PasswordInput, PasswordRule, PhoneInput, TextInput, useErrorText, useFocusInvalid } from './fields';
import { dict } from './i18n';
import styles from './Auth.module.css';

type Errors = Partial<Record<'name' | 'phone' | 'password' | 'consents' | 'form', string>>;

/** Registration form → SMS code → onboarding. */
export function RegisterFlow({ onToLogin, onCodeStep }: { onToLogin: () => void; onCodeStep: (active: boolean) => void }) {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const errText = useErrorText();
  const register = useRegister();
  const [formRef, focusInvalid] = useFocusInvalid();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [consents, setConsents] = useState({ terms: false, personal_data: false, marketing: false });
  const [errors, setErrors] = useState<Errors>({});
  const [verification, setVerification] = useState<VerificationStarted | null>(null);
  // Back from the code step: focus returns to the number the user wants to change.
  const [backFromCode, setBackFromCode] = useState(false);

  useEffect(() => onCodeStep(!!verification), [verification, onCodeStep]);

  if (verification) {
    return (
      <CodeStep
        purpose="register"
        verification={verification}
        onResent={setVerification}
        onBack={() => {
          setVerification(null);
          setBackFromCode(true);
        }}
        onDone={(session) => {
          signIn(session);
          navigate('/onboarding', { replace: true });
        }}
      />
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (register.isPending) return;
    const next: Errors = {};
    if (!name.trim()) next.name = errText('name_required');
    if (phone.length !== 10) next.phone = c.errors.phone_invalid;
    if (!passwordOk(password)) next.password = c.errors.password_weak;
    if (!consents.terms || !consents.personal_data) next.consents = c.errors.consents_required;
    setErrors(next);
    if (Object.keys(next).length) return focusInvalid();
    register.mutate(
      { name: name.trim(), phone: `+7${phone}`, password, consents, language: lang },
      {
        onSuccess: setVerification,
        onError: (err) => {
          const code = errorCode(err);
          const field = code === 'phone_invalid' || code === 'phone_taken' ? 'phone' : code === 'password_weak' ? 'password' : code === 'consents_required' ? 'consents' : 'form';
          setErrors({ [field]: errText(code) });
          focusInvalid();
        },
      },
    );
  };

  const consent = (key: keyof typeof consents, label: string, required: boolean) => (
    <label className={styles.checkbox}>
      <input
        type="checkbox"
        checked={consents[key]}
        aria-invalid={required && errors.consents && !consents[key] ? true : undefined}
        aria-describedby={required && errors.consents ? 'consents-err' : undefined}
        onChange={(e) => setConsents((s) => ({ ...s, [key]: e.target.checked }))}
      />
      <span>
        {label} <span className={styles.muted}>{required ? t.register.required : t.register.optional}</span>
      </span>
    </label>
  );

  return (
    <form ref={formRef} aria-labelledby="reg-title" className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.heading}>
        <h1 id="reg-title" className={styles.title} tabIndex={-1}>
          {t.register.title}
        </h1>
        <p className={styles.lead}>{t.register.lead}</p>
      </div>

      <Field label={t.register.name} error={errors.name}>
        {(a11y) => <TextInput a11y={a11y} type="text" autoComplete="given-name" value={name} invalid={!!errors.name} onChange={(e) => setName(e.target.value)} />}
      </Field>

      <Field label={t.phone} error={errors.phone}>
        {(a11y) => <PhoneInput a11y={a11y} value={phone} onChange={setPhone} invalid={!!errors.phone} autoFocus={backFromCode} />}
      </Field>

      <Field label={t.password} error={errors.password} hint={<PasswordRule ok={passwordOk(password)} />}>
        {(a11y) => <PasswordInput a11y={a11y} value={password} onChange={setPassword} autoComplete="new-password" invalid={!!errors.password} />}
      </Field>

      <fieldset className={styles.consents}>
        <legend className={styles.legend}>{t.register.consents}</legend>
        {consent('terms', t.register.terms, true)}
        {consent('personal_data', t.register.personalData, true)}
        {consent('marketing', t.register.marketing, false)}
        {errors.consents && (
          <p id="consents-err" className={styles.error} role="alert">
            <Icon name="alert" size={16} />
            {errors.consents}
          </p>
        )}
        <p className={styles.consentsNote}>
          {t.register.docsLabel}{' '}
          <a href="/terms" target="_blank" rel="noopener">
            {t.register.termsLink}
            <span className="visually-hidden"> {t.register.newTab}</span>
          </a>
          {' · '}
          <a href="/privacy" target="_blank" rel="noopener">
            {t.register.privacyLink}
            <span className="visually-hidden"> {t.register.newTab}</span>
          </a>
        </p>
        <p className={styles.consentsNote}>{t.register.consentsNote}</p>
      </fieldset>

      <FormError>{errors.form}</FormError>
      <Button type="submit" size="xl" block disabled={register.isPending} aria-busy={register.isPending || undefined}>
        {t.register.submit}
      </Button>
      <p className={styles.switch}>
        {t.register.haveAccount}{' '}
        <button type="button" className={styles.textButton} onClick={onToLogin}>
          {t.register.toLogin}
        </button>
      </p>
    </form>
  );
}
