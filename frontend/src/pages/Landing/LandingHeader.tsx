import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { LogoMark } from '@/components/Logo';
import { LangSwitch } from '@/components/layout/LangSwitch';
import { Button } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { dict } from './i18n';
import { scrollBehavior } from './scroll';
import styles from './Landing.module.css';

const SECTIONS = ['how', 'benefits', 'example', 'trust'] as const;
/** Must match the CSS breakpoint where the full header nav appears. */
const FULL_NAV = '(min-width: 1200px)';
const MENU_ID = 'landing-menu';

/** «Войти» + «Начать», or a single «Открыть qorgan» when already signed in. */
function AuthActions({ block = false }: { block?: boolean }) {
  const t = useT(dict);
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return (
      <Button to="/dashboard" block={block}>
        {t.openApp}
      </Button>
    );
  }
  return (
    <>
      <Button to="/auth?mode=login" variant="secondary" block={block}>
        {t.login}
      </Button>
      <Button to="/auth?mode=register" block={block} className={styles.startBtn}>
        {t.start}
      </Button>
    </>
  );
}

/** Full nav from 1200 px; below that the nav (and on mobile the sign-in buttons) move into a disclosure menu. */
export function LandingHeader() {
  const t = useT(dict);
  const c = useT(common);
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const full = window.matchMedia(FULL_NAV);
    const onResize = () => full.matches && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    full.addEventListener('change', onResize);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      full.removeEventListener('change', onResize);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const links = SECTIONS.map((id) => (
    <a key={id} href={`#${id}`} className={styles.navLink}>
      {t.nav[id]}
    </a>
  ));

  return (
    <header
      ref={headerRef}
      className={styles.header}
      onBlur={(e) => {
        // Close when keyboard focus leaves the header so the open menu never covers the focused element.
        if (open && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <div className={styles.bar}>
        <Link to="/" replace aria-label={c.brandHome} className={styles.brand} onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}>
          <LogoMark size={34} />
          <span className={styles.wordmark}>qorgan</span>
        </Link>
        <nav aria-label={t.nav.label} className={styles.nav}>
          {links}
        </nav>
        <div className={styles.actions}>
          <LangSwitch />
          <div className={styles.barAuth}>
            <AuthActions />
          </div>
          <button
            ref={buttonRef}
            type="button"
            className={styles.menuBtn}
            aria-expanded={open}
            aria-controls={MENU_ID}
            aria-label={open ? t.menuClose : t.menuOpen}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? 'x' : 'menu'} size={22} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div
        id={MENU_ID}
        className={styles.menu}
        hidden={!open}
        onClick={(e) => {
          if ((e.target as Element).closest('a')) setOpen(false);
        }}
      >
        <div className={styles.menuInner}>
          <nav aria-label={t.nav.label} className={styles.menuNav}>
            {links}
          </nav>
          <div className={styles.menuAuth}>
            <AuthActions block />
          </div>
        </div>
      </div>
    </header>
  );
}
