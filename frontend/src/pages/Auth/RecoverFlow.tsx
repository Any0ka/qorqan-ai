import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { VerificationStarted } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { errorCode, useRecover } from './authApi';
import { CodeStep } from './CodeStep';
import { Field, FormError, PhoneInput, useErrorText, useFocusInvalid } from './fields';
import { dict } from './i18n';
import styles from './Auth.module.css';

/** «Восстановление доступа»: phone → SMS code + new password → overview. */
export function RecoverFlow({ onToLogin }: { onToLogin: () => void }) {
  const t = useT(dict);
  const c = useT(common);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const errText = useErrorText();
  const recover = useRecover();
  const [formRef, focusInvalid] = useFocusInvalid();
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ phone?: string; form?: string }>({});
  const [verification, setVerification] = useState<VerificationStarted | null>(null);
  // Back from the code step: focus returns to the number the user wants to change.
  const [backFromCode, setBackFromCode] = useState(false);

  if (verification) {
    return (
      <CodeStep
        purpose="recover"
        verification={verification}
        onResent={setVerification}
        onBack={() => {
          setVerification(null);
          setBackFromCode(true);
        }}
        onDone={(session) => {
          signIn(session);
          navigate('/dashboard', { replace: true });
        }}
      />
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (recover.isPending) return;
    if (phone.length !== 10) {
      setErrors({ phone: c.errors.phone_invalid });
      return focusInvalid();
    }
    setErrors({});
    recover.mutate(
      { phone: `+7${phone}` },
      {
        onSuccess: setVerification,
        onError: (err) => {
          const code = errorCode(err);
          setErrors(code === 'phone_invalid' ? { phone: errText(code) } : { form: errText(code) });
          focusInvalid();
        },
      },
    );
  };

  return (
    <form ref={formRef} aria-labelledby="rec-title" className={styles.form} onSubmit={submit} noValidate>
      <button type="button" className={styles.backLink} onClick={onToLogin}>
        <Icon name="chevronLeft" size={18} strokeWidth={2} />
        {t.recover.back}
      </button>
      <div className={styles.heading}>
        <h1 id="rec-title" className={styles.title} tabIndex={-1}>
          {t.recover.title}
        </h1>
        <p className={styles.lead}>{t.recover.lead}</p>
      </div>
      <Field label={t.phone} error={errors.phone}>
        {(a11y) => <PhoneInput a11y={a11y} value={phone} onChange={setPhone} invalid={!!errors.phone} autoFocus={backFromCode} autoComplete="tel-national" />}
      </Field>
      <FormError>{errors.form}</FormError>
      <Button type="submit" size="xl" block disabled={recover.isPending} aria-busy={recover.isPending || undefined}>
        {t.recover.submit}
      </Button>
    </form>
  );
}
