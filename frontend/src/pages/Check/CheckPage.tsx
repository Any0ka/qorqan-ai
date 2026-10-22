import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCheck, useCreateCheck, useFinancial } from '@/api/hooks';
import { Icon } from '@/components/Icon';
import { AppPage } from '@/components/layout/AppShell';
import { Button } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { money } from '@/lib/format';
import { AiPanel } from './AiPanel';
import { Calculating, STEP_MS } from './Calculating';
import { CompactForm, FullForm, type FormProps } from './CheckForm';
import { EMPTY_FORM, fromPurchase, isFormState, lowerFirst, termMonths, toPurchase, validate, type CheckForm } from './form';
import { dict } from './i18n';
import { PreviewCard } from './PreviewCard';
import { latestUpdate, SituationCard, SituationChips, SituationSummary } from './Situation';
import { usePreview } from './usePreview';
import styles from './Check.module.css';

const MIN_CALC_MS = STEP_MS * 4;

/** «Проверить решение» (/check) and the same form with the qorgan AI panel (/check?ai=1). */
export default function CheckPage() {
  const t = useT(dict);
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ai = params.get('ai') === '1';
  const fromId = params.get('from');

  const routed = (location.state as { form?: unknown } | null)?.form;
  const initial = isFormState(routed) ? routed : null;
  const [form, setForm] = useState<CheckForm>(initial ?? EMPTY_FORM);
  const [formKey, setFormKey] = useState(0);
  const prefilled = useRef(!!initial);
  const from = useCheck(fromId && !initial ? fromId : undefined);
  useEffect(() => {
    if (prefilled.current || !from.data) return;
    prefilled.current = true;
    setForm(fromPurchase(from.data.purchase));
    setFormKey((k) => k + 1);
  }, [from.data]);

  const set = useCallback((patch: Partial<CheckForm>) => setForm((f) => ({ ...f, ...patch })), []);
  const fin = useFinancial();
  const purchase = useMemo(() => toPurchase(form, t.form.defaultTitle), [form, t]);
  const preview = usePreview(purchase);

  const [showErrors, setShowErrors] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const create = useCreateCheck();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const errors = validate(form);
  const focusInvalid = () => requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());

  const submit = () => {
    setShowErrors(true);
    if (errors.length > 0 || !purchase || formRef.current?.querySelector('[aria-invalid="true"]')) {
      focusInvalid();
      return;
    }
    setSubmitError(false);
    setCalculating(true);
    const startedAt = Date.now();
    create.mutate(purchase, {
      onSuccess: (a) => {
        timer.current = window.setTimeout(() => navigate(`/result/${a.id}`), Math.max(0, MIN_CALC_MS - (Date.now() - startedAt)));
      },
      onError: () => {
        setCalculating(false);
        setSubmitError(true);
      },
    });
  };

  const clear = () => {
    setForm(EMPTY_FORM);
    setFormKey((k) => k + 1);
    setShowErrors(false);
    setSubmitError(false);
  };

  const linkState = { form };
  const formProps: FormProps = {
    form,
    set,
    errors: showErrors ? errors : [],
    preview: preview.data,
    submitError,
    submitting: calculating,
    onSubmit: submit,
    onClear: clear,
    formRef,
  };

  const updated = fin.data ? latestUpdate(fin.data) : null;
  const subtitle = updated ? (
    <>
      {t.updated(updated)} · <Link to="/profile?section=finance">{t.refresh}</Link>
    </>
  ) : undefined;
  const credits = fin.data?.credits_count ?? 0;

  if (ai) {
    const title = form.title.trim();
    const term = termMonths(form) ?? 12;
    const context = purchase
      ? t.panel.context([title ? lowerFirst(title) : null, money(purchase.price), t.panel.kindContext[purchase.kind](term)].filter(Boolean).join(' · '))
      : t.panel.contextEmpty;
    return (
      <AppPage
        title={t.title}
        subtitle={subtitle}
        bare
        headerExtra={
          <Link to="/check" state={linkState} className={styles.hideAi}>
            <Icon name="chat" size={18} />
            {t.panel.hide}
          </Link>
        }
      >
        <div className={styles.aiLayout}>
          <main className={styles.aiMain}>
            {!fin.error && <SituationChips data={fin.data} />}
            {calculating ? (
              <div className={styles.compactCard}>
                <Calculating credits={credits} compact />
              </div>
            ) : (
              <CompactForm key={formKey} {...formProps} />
            )}
          </main>
          <AiPanel
            purchase={purchase}
            context={context}
            linkState={linkState}
            onLeave={() => navigate({ search: location.search }, { replace: true, state: linkState })}
          />
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage title={t.title} subtitle={subtitle}>
      <p className={styles.intro}>{t.intro}</p>
      <div className={styles.mobileOnly}>
        <SituationSummary data={fin.data} />
      </div>
      {from.isLoading && (
        <p role="status" className={styles.small}>
          {t.form.loadingFrom}
        </p>
      )}
      <div className={styles.layout}>
        {calculating ? (
          <div className={styles.formCard}>
            <Calculating credits={credits} />
          </div>
        ) : (
          <FullForm key={formKey} {...formProps} />
        )}
        <div className={styles.side}>
          <div className={styles.desktopOnly}>
            <SituationCard data={fin.data} isLoading={fin.isLoading} error={fin.error} onRetry={() => fin.refetch()} />
          </div>
          <PreviewCard data={preview.data} kind={form.kind} hasPrice={!!purchase} pending={preview.pending} />
          <section aria-label={t.aiCard.label} className={styles.aiCard}>
            <span aria-hidden="true" className={styles.aiAvatar}>
              <Icon name="sparkle" size={18} strokeWidth={2} />
            </span>
            <div className={styles.aiCardBody}>
              <p className={styles.aiCardTitle}>{t.aiCard.title}</p>
              <p className={styles.bodySm}>{t.aiCard.text}</p>
              <Button variant="link" to="/check?ai=1" state={linkState} className={styles.selfStart}>
                {t.aiCard.cta}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </AppPage>
  );
}
