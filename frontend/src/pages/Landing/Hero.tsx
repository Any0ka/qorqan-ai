import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { Button, Pill } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { money, num, percent } from '@/lib/format';
import { DEMO } from './demo';
import { dict } from './i18n';
import styles from './Landing.module.css';

export function Hero() {
  const t = useT(dict);
  const { isAuthenticated } = useAuth();
  return (
    <section aria-labelledby="hero-title" className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroText}>
          <p className={styles.heroBadge}>
            <Icon name="sparkles" size={18} />
            {t.hero.badge}
          </p>
          <h1 id="hero-title" className={styles.h1}>
            {t.hero.title}
          </h1>
          <p className={styles.heroLead}>{t.hero.lead}</p>
          <div className={styles.heroCtas}>
            <Button to={isAuthenticated ? '/dashboard' : '/auth?mode=register'} size="xl" iconRight="arrowRight" className={styles.cta}>
              {t.hero.cta}
            </Button>
            <Button href="#how" variant="secondary" size="xl" className={`${styles.cta} ${styles.ctaSecondary}`}>
              {t.hero.how}
            </Button>
            {!isAuthenticated && (
              <p className={styles.haveAccount}>
                {t.hero.haveAccount} <Link to="/auth?mode=login">{t.login}</Link>
              </p>
            )}
          </div>
          <ul className={styles.assurances}>
            <li>
              <Icon name="shield" size={20} />
              {t.hero.notLender}
            </li>
            <li>
              <Icon name="lock" size={20} />
              {t.hero.yourData}
            </li>
          </ul>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}

/** Two overlapping illustrative cards on a shield silhouette; demo numbers only. */
function HeroPreview() {
  const t = useT(dict).preview;
  const c = useT(common);
  return (
    <figure className={styles.preview}>
      <svg aria-hidden="true" viewBox="0 0 400 440" preserveAspectRatio="xMidYMid meet" className={styles.previewShield}>
        <path d="M200 16c70 0 133 21 182 49v154c0 109-76 193-182 231C94 412 18 328 18 219V65C67 37 130 16 200 16z" fill="currentColor" />
      </svg>
      <div className={styles.previewGrid}>
        <div className={styles.stateCard}>
          <div className={styles.cardHead}>
            <span className={styles.stateTitle}>{t.stateTitle}</span>
            <Pill tone="danger" icon="octagon" size="sm" className={styles.stateBadge}>
              {t.highLoad}
            </Pill>
          </div>
          <div className={styles.loadRow}>
            <span className={styles.bigPercent}>{percent(DEMO.load)}</span>
            <span className={styles.loadLead}>{t.loadLead}</span>
          </div>
          <div aria-hidden="true" className={styles.scale}>
            <div className={styles.scaleTrack}>
              <div className={styles.scaleFill} style={{ width: percent(DEMO.load) }} />
              <div className={`${styles.scaleMark} ${styles.at30}`} />
              <div className={`${styles.scaleMark} ${styles.at45}`} />
            </div>
            <div className={styles.scaleLabels}>
              <span>0%</span>
              <span className={styles.at30}>30%</span>
              <span className={styles.at45}>45%</span>
              <span>100%</span>
            </div>
          </div>
          <div className={styles.stateStats}>
            <span>
              {t.payments} <b>{money(DEMO.payments)}</b>
            </span>
            <span>
              {t.free} <b>{money(DEMO.free)}</b>
            </span>
          </div>
        </div>

        <div className={styles.verdictCard}>
          <div className={styles.cardHead}>
            <Pill tone="danger" icon="octagon" size="sm">
              {c.risk.high}
            </Pill>
            <span className={styles.purchase}>{t.purchase(DEMO.term)}</span>
          </div>
          <p className={styles.verdictTitle}>{t.verdict}</p>
          <div className={styles.compare}>
            <span>{t.monthlyPayments}</span>
            <Change from={num(DEMO.payments)} to={money(DEMO.paymentsAfter)} />
            <span>{t.load}</span>
            <Change from={percent(DEMO.load)} to={percent(DEMO.loadAfter)} />
            <span>{t.freeFunds}</span>
            <Change from={num(DEMO.free)} to={money(DEMO.freeAfter)} negative={DEMO.freeAfter < 0} />
          </div>
          <p className={styles.altNote}>
            <Icon name="sparkle" size={18} />
            {t.safer(DEMO.saferInMonths)}
          </p>
        </div>
      </div>
      <figcaption className={styles.caption}>{t.caption}</figcaption>
    </figure>
  );
}

function Change({ from, to, negative = false }: { from: string; to: string; negative?: boolean }) {
  return (
    <span className={styles.change}>
      {from} <span className={styles.arrow}>→</span> <b className={negative ? styles.negative : undefined}>{to}</b>
    </span>
  );
}
