import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { Financial } from '@/api/types';
import { useFinancial, useOnboardingStep } from '@/api/hooks';
import { LogoMark } from '@/components/Logo';
import { LangSwitch } from '@/components/layout/LangSwitch';
import { Button, ErrorState, PageSkeleton } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { Aside } from './Aside';
import { Stepper } from './Stepper';
import { StepCredits, type CreditMethod } from './StepCredits';
import { StepExpenses } from './StepExpenses';
import { StepIncomes } from './StepIncomes';
import { StepReview } from './StepReview';
import type { StepProps } from './shared';
import { dict } from './i18n';
import styles from './Onboarding.module.css';

const clampStep = (n: number) => Math.min(4, Math.max(1, Math.round(n) || 1));

/** /onboarding?step=1..4&method=manual — four steps that fill the financial profile. */
export default function OnboardingPage() {
  const t = useT(dict);
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const fin = useFinancial();
  const onboarding = useOnboardingStep();
  const [attention, setAttention] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const saveRef = useRef<(() => Promise<boolean>) | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const stepParam = Number(params.get('step'));
  const step = stepParam >= 1 && stepParam <= 4 ? clampStep(stepParam) : clampStep(fin.data?.onboarding_step ?? 1);
  const method: CreditMethod = params.get('method') === 'manual' ? 'manual' : 'report';
  const handedFile = (location.state as { uploadFile?: unknown } | null)?.uploadFile;
  const uploadFile = handedFile instanceof File ? handedFile : null;

  useEffect(() => {
    document.title = `${t.docTitle} · qorgan`;
  }, [t]);

  // New step: back to the top, focus on its heading (screen readers hear where they are).
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const goTo = useCallback((n: number) => setParams({ step: String(n) }), [setParams]);

  const advance = useCallback(
    async (to: number, latest?: Financial) => {
      const saved = (latest ?? fin.data)?.onboarding_step ?? 1;
      await onboarding.mutateAsync({ step: Math.max(saved, to) });
      goTo(to);
    },
    [fin.data, onboarding, goTo],
  );

  const registerSave = useCallback((fn: (() => Promise<boolean>) | null) => {
    saveRef.current = fn;
  }, []);

  const onFileTaken = useCallback(
    () => navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null }),
    [navigate, location.pathname, location.search],
  );

  const saveLater = async () => {
    setLeaving(true);
    const ok = saveRef.current ? await saveRef.current() : true;
    setLeaving(false);
    if (ok) navigate('/dashboard');
  };

  const f = fin.data;
  const props: StepProps | null = f ? { financial: f, goTo, advance, registerSave, headingRef } : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.brand}>
            <LogoMark size={32} />
            <span className={styles.brandWord}>qorgan</span>
          </span>
          <div className={styles.headerActions}>
            {fin.data && (
              <span className={styles.stepCount}>
                {t.stepOf.before}
                <b>{step}</b>
                {t.stepOf.after}
              </span>
            )}
            <LangSwitch compact />
            <Button variant="secondary" className={styles.saveLater} disabled={leaving} onClick={() => void saveLater()}>
              {t.saveLater}
            </Button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.lead}>{t.lead}</p>
        </div>

        {fin.isLoading && <PageSkeleton blocks={2} />}
        {fin.error && <ErrorState error={fin.error} onRetry={() => fin.refetch()} />}

        {f && props && (
          <>
            <Stepper
              step={step}
              done={[f.completeness.income, f.completeness.expenses, f.completeness.credits]}
              attention={attention && step === 3}
              onGo={goTo}
            />
            <div className={styles.layout}>
              <section className={styles.card} aria-label={t.steps[step - 1]}>
                {step === 1 && <StepIncomes key="s1" {...props} />}
                {step === 2 && <StepExpenses key="s2" {...props} />}
                {step === 3 && (
                  <StepCredits key="s3" {...props} initialMethod={method} uploadFile={uploadFile} onFileTaken={onFileTaken} onAttention={setAttention} />
                )}
                {step === 4 && <StepReview key="s4" {...props} />}
              </section>
              <Aside step={step} financial={f} attention={attention && step === 3} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
