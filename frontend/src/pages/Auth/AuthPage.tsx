import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Icon, type IconName } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { LangSwitch } from '@/components/layout/LangSwitch';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { safeNext } from './authApi';
import { LoginForm } from './LoginForm';
import { RecoverFlow } from './RecoverFlow';
import { RegisterFlow } from './RegisterFlow';
import { dict } from './i18n';
import styles from './Auth.module.css';

type Mode = 'register' | 'login' | 'recover';
const MODES: Mode[] = ['register', 'login', 'recover'];
const TABS: Array<'login' | 'register'> = ['login', 'register'];

/** /auth?mode=register|login|recover&next=… — split screen: form on the left, navy promo on the right. */
export default function AuthPage() {
  const t = useT(dict);
  const c = useT(common);
  const { isAuthenticated } = useAuth();
  // Only an account that was signed in on arrival is bounced; a fresh sign-in navigates by itself.
  const [authedOnArrival] = useState(isAuthenticated);
  const [params, setParams] = useSearchParams();
  const raw = params.get('mode') as Mode | null;
  const mode: Mode = raw && MODES.includes(raw) ? raw : 'register';
  const next = safeNext(params.get('next'));
  const [codeStep, setCodeStep] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const focusHeading = useRef(false);

  const setMode = useCallback(
    (m: Mode) => {
      setCodeStep(false);
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('mode', m);
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // Text links between modes («Забыли пароль?», «Ко входу»…) move focus to the new heading; tabs keep it.
  const switchTo = useCallback(
    (m: Mode) => {
      focusHeading.current = true;
      setMode(m);
    },
    [setMode],
  );
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    panelRef.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [mode]);

  useEffect(() => {
    document.title = `${t.docTitle[mode]} · qorgan`;
  }, [mode, t]);

  if (authedOnArrival) return <Navigate to="/dashboard" replace />;

  const showTabs = (mode === 'register' || mode === 'login') && !codeStep;

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, 'login' | 'register'> = {
      Home: TABS[0],
      End: TABS[TABS.length - 1],
      ArrowLeft: mode === 'login' ? 'register' : 'login',
      ArrowRight: mode === 'login' ? 'register' : 'login',
    };
    const target = keys[e.key];
    if (!target) return;
    e.preventDefault();
    setMode(target);
    tabRefs.current[target]?.focus();
  };

  const flow =
    mode === 'login' ? (
      <LoginForm next={next} onToRegister={() => switchTo('register')} onToRecover={() => switchTo('recover')} />
    ) : mode === 'recover' ? (
      <RecoverFlow onToLogin={() => switchTo('login')} />
    ) : (
      <RegisterFlow onToLogin={() => switchTo('login')} onCodeStep={setCodeStep} />
    );

  return (
    <div className={styles.page}>
      <div className={styles.formSide}>
        <header className={styles.top}>
          <Logo label={c.brandHome} />
          <LangSwitch />
        </header>

        <main className={styles.center}>
          <div className={styles.column}>
            {showTabs && (
              <div role="tablist" aria-label={t.tabsLabel} className={styles.tabs}>
                {TABS.map((m) => (
                  <button
                    key={m}
                    ref={(el) => {
                      tabRefs.current[m] = el;
                    }}
                    id={`auth-tab-${m}`}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    aria-controls="auth-panel"
                    tabIndex={mode === m ? 0 : -1}
                    className={styles.tab}
                    onClick={() => setMode(m)}
                    onKeyDown={onTabKey}
                  >
                    {m === 'login' ? t.tabLogin : t.tabRegister}
                  </button>
                ))}
              </div>
            )}
            {/* Same element in every mode, so the flow keeps its state when the tabs hide for the code step. */}
            <div
              ref={panelRef}
              role={showTabs ? 'tabpanel' : undefined}
              id={showTabs ? 'auth-panel' : undefined}
              aria-labelledby={showTabs ? `auth-tab-${mode}` : undefined}
              className={styles.panel}
            >
              {flow}
            </div>
          </div>
        </main>

        <footer className={styles.footer}>
          <span>{c.footer}</span>
          <Link to="/help">{t.footerHelp}</Link>
          <Link to="/terms">{t.footerTerms}</Link>
        </footer>
      </div>

      <Promo />
    </div>
  );
}

const PROMO_ICONS: IconName[] = ['card', 'scales', 'branches'];

function Promo() {
  const t = useT(dict);
  const p = t.promo;
  return (
    <section aria-labelledby="why-title" className={styles.promo}>
      <div className={styles.promoHead}>
        <p className={styles.promoEyebrow}>{p.eyebrow}</p>
        <h2 id="why-title" className={styles.promoTitle}>
          {p.title}
        </h2>
      </div>
      <ul className={styles.promoList}>
        {p.points.map((text, i) => (
          <li key={text}>
            <span aria-hidden="true" className={styles.promoIcon}>
              <Icon name={PROMO_ICONS[i]} size={20} />
            </span>
            {text}
          </li>
        ))}
      </ul>
      <div aria-hidden="true" className={styles.promoCard}>
        <span className={styles.promoBadge}>
          <Icon name="triangle" size={14} strokeWidth={2.2} />
          {p.cardBadge}
        </span>
        <p className={styles.promoCardTitle}>{p.cardTitle}</p>
        <p className={styles.promoCardText}>{p.cardText}</p>
      </div>
      <p className={styles.promoNote}>{p.note}</p>
    </section>
  );
}
