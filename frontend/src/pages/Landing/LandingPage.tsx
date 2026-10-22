import { useEffect, type MouseEvent } from 'react';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { Hero } from './Hero';
import { dict } from './i18n';
import { LandingFooter } from './LandingFooter';
import { LandingHeader } from './LandingHeader';
import { jumpTo } from './scroll';
import { Benefits, Example, FinalCta, HowItWorks, Positioning, Trust } from './Sections';
import styles from './Landing.module.css';

/** Public landing «/». Static marketing page: the preview cards are illustrations with demo numbers, no API calls. */
export default function LandingPage() {
  const t = useT(dict);
  const c = useT(common);

  useEffect(() => {
    document.title = t.docTitle;
  }, [t.docTitle]);

  // The page is lazy-loaded, so the browser's own jump to `/#trust` happens before the target exists.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, []);

  /** In-page anchors (header, hero, footer, skip link): smooth scroll unless reduced motion, focus the target. */
  const onAnchorClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = (e.target as Element).closest('a')?.getAttribute('href');
    if (!href || !href.startsWith('#') || href.length < 2) return;
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    e.preventDefault();
    jumpTo(target);
    // Keep React Router's history state; only the fragment changes.
    window.history.replaceState(window.history.state, '', href);
  };

  return (
    <div className={styles.page} onClick={onAnchorClick}>
      <a href="#main" className={styles.skip}>
        {c.skipToContent}
      </a>
      <LandingHeader />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Positioning />
        <HowItWorks />
        <Benefits />
        <Example />
        <Trust />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
