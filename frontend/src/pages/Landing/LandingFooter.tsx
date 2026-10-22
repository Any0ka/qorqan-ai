import { Link } from 'react-router-dom';
import { LogoMark } from '@/components/Logo';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { dict } from './i18n';
import styles from './Landing.module.css';

/** There are no public terms/privacy pages yet; these paths are where they are expected to live. */
const TERMS_PATH = '/terms';
const PRIVACY_PATH = '/privacy';
const HELP_PATH = '/help';

export function LandingFooter() {
  const t = useT(dict).footer;
  const c = useT(common);
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerTop}>
          <div className={styles.footerAbout}>
            <span className={styles.footerBrand}>
              <LogoMark size={28} />
              <span className={styles.footerWord}>qorgan</span>
            </span>
            <p className={styles.footerTagline}>{t.tagline}</p>
          </div>
          <nav aria-label={t.navLabel} className={styles.footerNav}>
            <a href="#how" className={styles.footerLink}>
              {t.how}
            </a>
            <a href="#trust" className={styles.footerLink}>
              {t.trust}
            </a>
            <Link to={TERMS_PATH} className={styles.footerLink}>
              {t.terms}
            </Link>
            <Link to={PRIVACY_PATH} className={styles.footerLink}>
              {t.privacy}
            </Link>
            <Link to={HELP_PATH} className={styles.footerLink}>
              {t.help}
            </Link>
          </nav>
        </div>
        <div className={styles.footerBottom}>
          <p className={styles.footerNote}>{t.disclaimer}</p>
          <p>{c.footer}</p>
        </div>
      </div>
    </footer>
  );
}
