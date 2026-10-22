import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { useChecks, useMe, useUpdateMe } from '@/api/hooks';
import type { Me } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Button, EmptyState, ErrorState, RiskBadge, Skeleton, TextField, ToggleGroup, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useLang, useT } from '@/i18n/I18nProvider';
import { dayMonth, money } from '@/lib/format';
import { SectionHead } from './SectionHead';
import { dict } from './i18n';
import styles from './Profile.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** «Личная информация»: name, surname, email; the phone is the login and changes only via support. */
export function PersonalSection() {
  const t = useT(dict);
  const { data: me, isLoading, error, refetch } = useMe();
  return (
    <>
      <SectionHead title={t.sections.personal} intro={t.personal.intro} />
      {isLoading && <Skeleton height={320} radius={18} />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {me && <PersonalForm key={me.id} me={me} />}
    </>
  );
}

function PersonalForm({ me }: { me: Me }) {
  const t = useT(dict);
  const c = useT(common);
  const toast = useToast();
  const update = useUpdateMe();
  const [name, setName] = useState(me.name);
  const [surname, setSurname] = useState(me.surname ?? '');
  const [email, setEmail] = useState(me.email ?? '');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = {
      name: name.trim() ? undefined : t.personal.nameRequired,
      email: email.trim() && !EMAIL_RE.test(email.trim()) ? t.personal.emailInvalid : undefined,
    };
    setErrors(next);
    if (next.name || next.email) return;
    update.mutate(
      { name: name.trim(), surname: surname.trim() || null, email: email.trim() || null },
      {
        onSuccess: () => toast({ tone: 'success', text: t.personal.saved }),
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'email_taken') setErrors({ email: c.errors.email_taken });
          else toast({ tone: 'error', text: c.saveFailed });
        },
      },
    );
  };

  return (
    <form className={`${styles.panel} ${styles.form}`} onSubmit={submit} noValidate>
      <div className={styles.formGrid}>
        <TextField label={t.personal.name} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="given-name" maxLength={80} required />
        <TextField label={t.personal.surname} value={surname} onChange={(e) => setSurname(e.target.value)} autoComplete="family-name" maxLength={80} />
      </div>
      <TextField
        label={t.personal.email}
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        hint={t.personal.emailHint}
        autoComplete="email"
      />
      <TextField
        label={t.personal.phone}
        value={me.phone_masked}
        readOnly
        hint={
          <>
            {t.personal.phoneHint} <Link to="?section=help">{t.personal.support}</Link>
          </>
        }
        suffix={<Icon name="lock" size={18} aria-hidden="true" />}
      />
      <div className={styles.formFoot}>
        <Button type="submit" disabled={update.isPending}>
          {t.personal.save}
        </Button>
        <span className={styles.muted}>{t.personal.since(me.created_at)}</span>
      </div>
    </form>
  );
}

/** «История оценок»: every purchase check, saved ones marked. */
export function HistorySection() {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  const [filter, setFilter] = useState<'all' | 'saved'>('all');
  const { data, isLoading, error, refetch } = useChecks(filter === 'saved');
  return (
    <>
      <SectionHead title={t.sections.history} intro={t.checks.intro} />
      <ToggleGroup
        label={t.checks.filter}
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t.checks.all },
          { value: 'saved', label: t.checks.saved },
        ]}
      />
      {isLoading && (
        <div className={styles.stack}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={76} radius={16} />
          ))}
        </div>
      )}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <EmptyState icon="scales" title={filter === 'saved' ? t.checks.emptySaved : t.checks.empty} text={t.checks.emptyText}>
          <Button to="/check" iconRight="arrowRight">
            {t.checks.check}
          </Button>
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <ul className={styles.checks}>
          {data.map((a) => (
            <li key={a.id}>
              <Link to={`/result/${a.id}`} className={styles.checkLink}>
                <span className={styles.checkMain}>
                  <span className={styles.checkTitle}>
                    {a.purchase.title}
                    {a.saved && (
                      <span className={styles.savedMark}>
                        <Icon name="bookmark" size={14} strokeWidth={2} />
                        {t.checks.savedMark}
                      </span>
                    )}
                  </span>
                  <span className={styles.checkMeta}>
                    {dayMonth(a.created_at, lang)} · {money(a.purchase.price)} · {money(a.monthly_payment)}
                    {t.checks.perMonth}
                    {a.purchase.term_months > 0 && a.purchase.kind !== 'own' ? ` · ${c.monthsShort(a.purchase.term_months)}` : ''}
                  </span>
                </span>
                <RiskBadge risk={a.risk} size="sm" />
                <Icon name="chevronRight" size={18} strokeWidth={2} className={styles.chevron} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
