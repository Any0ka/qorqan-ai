import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { LangSwitch } from '@/components/layout/LangSwitch';
import { Button } from '@/components/ui';
import { useAuth } from '@/auth/AuthProvider';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { dict, type LegalKind } from './i18n';
import styles from './Legal.module.css';

/** Public pages linked from the landing footer and registration: terms, privacy, help. */
export default function LegalPage({ kind }: { kind: LegalKind }) {
  const t = useT(dict);
  const c = useT(common);
  const { isAuthenticated } = useAuth();
  const page = t.pages[kind];

  useEffect(() => {
    document.title = `${page.title} · qorgan`;
    window.scrollTo(0, 0);
  }, [page.title]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Logo to="/" label={c.brandHome} />
        <div className={styles.headerActions}>
          <LangSwitch />
          <Button to={isAuthenticated ? '/dashboard' : '/auth?mode=login'} variant="secondary">
            {isAuthenticated ? t.toApp : t.login}
          </Button>
        </div>
      </header>
      <main id="main" className={styles.main}>
        <nav aria-label={t.navLabel} className={styles.tabs}>
          {(['terms', 'privacy', 'help'] as const).map((k) => (
            <Link key={k} to={`/${k}`} aria-current={k === kind ? 'page' : undefined} className={styles.tab}>
              {t.pages[k].title}
            </Link>
          ))}
        </nav>
        <h1 className={styles.title}>{page.title}</h1>
        <p className={styles.lead}>{page.lead}</p>
        {kind === 'help' ? (
          <div className={styles.faq}>
            {t.faq.map((f) => (
              <details key={f.q} className={styles.faqItem}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        ) : (
          <>
            {page.sections.map((s) => (
              <section key={s.title} className={styles.section}>
                <h2>{s.title}</h2>
                <p>{s.text}</p>
              </section>
            ))}
            <p className={styles.pending}>{t.pending}</p>
          </>
        )}
        <p className={styles.footer}>{c.footer}</p>
      </main>
    </div>
  );
}
