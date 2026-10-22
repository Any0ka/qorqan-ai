import { Fragment, type ReactNode } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { Icon, type IconName } from '@/components/Icon';
import { Button, Pill } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { money, num, percent } from '@/lib/format';
import { DEMO } from './demo';
import { dict } from './i18n';
import styles from './Landing.module.css';

/** Renders `**bold**` fragments of a dictionary string. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

function SectionHead({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div className={styles.head}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 id={id} className={styles.h2}>
        {title}
      </h2>
    </div>
  );
}

export function Positioning() {
  const t = useT(dict).band;
  return (
    <section aria-label={t.label} className={styles.band}>
      <div className={styles.bandInner}>
        <p className={styles.bandLead}>
          {t.lead} <span className={styles.bandAccent}>{t.accent}</span>
        </p>
        <p className={styles.bandText}>{t.text}</p>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ how it works

function Step({ n, title, text, children }: { n: string; title: string; text: string; children: ReactNode }) {
  return (
    <li className={styles.step}>
      <span aria-hidden="true" className={styles.stepNum}>
        {n}
      </span>
      <h3 className={styles.stepTitle}>{title}</h3>
      <p className={styles.stepText}>{text}</p>
      {children}
    </li>
  );
}

export function HowItWorks() {
  const t = useT(dict).how;
  const c = useT(common);
  const perMonth = (n: number) => `${money(n)}${c.perMonthShort}`;
  return (
    <section id="how" aria-labelledby="how-title" className={`${styles.section} ${styles.tinted}`}>
      <div className={styles.sectionInner}>
        <SectionHead id="how-title" eyebrow={t.eyebrow} title={t.title} />
        <ol className={styles.steps}>
          <Step n="01" title={t.step1.title} text={t.step1.text}>
            <div aria-hidden="true" className={styles.mock}>
              {t.step1.rows.map((label, i) => (
                <div key={label} className={`${styles.mockRow} ${i === 1 ? styles.notMobile : ''}`}>
                  <span>{label}</span>
                  <b>{perMonth(DEMO.stepCredits[i])}</b>
                </div>
              ))}
            </div>
          </Step>
          <Step n="02" title={t.step2.title} text={t.step2.text}>
            <div aria-hidden="true" className={styles.mock}>
              <div className={`${styles.mockRow} ${styles.mockField}`}>
                <span>{t.step2.price}</span>
                <b>{money(DEMO.price)}</b>
              </div>
              <div className={`${styles.mockRow} ${styles.mockField}`}>
                <span>{t.step2.term}</span>
                <b>{c.months(DEMO.term)}</b>
              </div>
              <div className={`${styles.mockRow} ${styles.mockField} ${styles.notMobile}`}>
                <span>{t.step2.payment}</span>
                <b>{perMonth(DEMO.newPayment)}</b>
              </div>
            </div>
          </Step>
          <Step n="03" title={t.step3.title} text={t.step3.text}>
            <div aria-hidden="true" className={`${styles.mock} ${styles.mockResult}`}>
              <Pill tone="danger" icon="octagon" size="sm">
                {c.risk.high}
              </Pill>
              <p className={styles.mockResultTitle}>{t.step3.loadGrows(percent(DEMO.load), percent(DEMO.loadAfter))}</p>
              <p className={`${styles.mockResultText} ${styles.notMobile}`}>{t.step3.noFree(money(DEMO.freeAfter))}</p>
            </div>
          </Step>
        </ol>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ benefits

function TileIcon({ name }: { name: IconName }) {
  return (
    <span className={styles.tileIcon}>
      <Icon name={name} size={24} />
    </span>
  );
}

function Tile({ icon, title, text, ai = false }: { icon: IconName; title: string; text: string; ai?: boolean }) {
  return (
    <article className={`${styles.tile} ${ai ? styles.tileAi : ''}`}>
      <TileIcon name={icon} />
      <div className={styles.tileBody}>
        <h3 className={styles.tileTitle}>{title}</h3>
        <p className={styles.tileText}>{text}</p>
      </div>
    </article>
  );
}

function DebtOverview() {
  const t = useT(dict).benefits.overview;
  return (
    <div aria-hidden="true" className={styles.overview}>
      <div className={styles.overviewTop}>
        <div className={styles.kpi}>
          <span>{t.total}</span>
          <b>{money(DEMO.totalDebt)}</b>
        </div>
        <div className={`${styles.kpi} ${styles.kpiEnd}`}>
          <span>{t.perMonth}</span>
          <b>{money(DEMO.payments)}</b>
        </div>
      </div>
      <div className={styles.bars}>
        {DEMO.split.map((s) => (
          <div key={s.key} className={styles.barRow}>
            <span className={styles.barLabel}>{t.split[s.key]}</span>
            <span
              className={`${styles.bar} ${s.key === 'micro' ? styles.barWarn : ''}`}
              style={{ width: `${(s.monthly / DEMO.splitScale) * 100}%` }}
            />
            <span className={styles.barValue}>{num(s.monthly)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Benefits() {
  const t = useT(dict).benefits;
  return (
    <section id="benefits" aria-labelledby="benefits-title" className={styles.section}>
      <div className={styles.sectionInner}>
        <SectionHead id="benefits-title" eyebrow={t.eyebrow} title={t.title} />
        <div className={styles.tiles}>
          <article className={`${styles.tile} ${styles.tileWide}`}>
            <div className={styles.wideBody}>
              <TileIcon name="card" />
              <h3 className={styles.tileTitle}>{t.overview.title}</h3>
              <p className={styles.tileText}>{t.overview.text}</p>
            </div>
            <DebtOverview />
          </article>
          <Tile icon="scales" title={t.risks.title} text={t.risks.text} />
          <Tile icon="aiChat" title={t.ai.title} text={t.ai.text} ai />
          <Tile icon="branches" title={t.alternatives.title} text={t.alternatives.text} />
          <Tile icon="route" title={t.plan.title} text={t.plan.text} />
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ example

export function Example() {
  const t = useT(dict).example;
  const c = useT(common);
  const facts: Array<[string, number]> = [
    [t.facts.income, DEMO.income],
    [t.facts.expenses, DEMO.expenses],
    [t.facts.payments, DEMO.payments],
    [t.facts.newPayment, DEMO.newPayment],
  ];
  const reasons = [t.reason1(percent(DEMO.load)), t.reason2(money(DEMO.freeAfter)), t.reason3];
  return (
    <section id="example" aria-labelledby="example-title" className={`${styles.section} ${styles.tinted}`}>
      <div className={`${styles.sectionInner} ${styles.exampleInner}`}>
        <div className={styles.exampleText}>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h2 id="example-title" className={styles.h2}>
            {t.title(money(DEMO.price), DEMO.term)}
          </h2>
          <p className={styles.exampleLead}>{t.lead(money(DEMO.income), money(DEMO.payments))}</p>
          <dl className={styles.facts}>
            {facts.map(([label, value]) => (
              <div key={label} className={styles.fact}>
                <dt>{label}</dt>
                <dd>{money(value)}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.note}>{t.note}</p>
        </div>

        <article aria-label={t.cardLabel} className={styles.verdict}>
          <Pill tone="danger" icon="octagon">
            {c.risk.high}
          </Pill>
          <h3 className={styles.verdictH}>{t.verdict}</h3>
          <ol className={styles.reasons}>
            {reasons.map((reason, i) => (
              <li key={i}>
                <span aria-hidden="true" className={styles.reasonNum}>
                  {i + 1}
                </span>
                {reason}
              </li>
            ))}
          </ol>
          <div className={styles.safer}>
            <p className={styles.saferTitle}>{t.saferTitle}</p>
            <p className={styles.saferText}>
              <Rich text={t.saferText(DEMO.saferInMonths, percent(DEMO.saferLoad))} />
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ trust

const TRUST: Array<{ key: 'data' | 'access' | 'notLender' | 'info'; icon: IconName }> = [
  { key: 'data', icon: 'fileText' },
  { key: 'access', icon: 'sliders' },
  { key: 'notLender', icon: 'shieldX' },
  { key: 'info', icon: 'info' },
];

export function Trust() {
  const t = useT(dict).trust;
  return (
    <section id="trust" aria-labelledby="trust-title" className={styles.section}>
      <div className={styles.sectionInner}>
        <SectionHead id="trust-title" eyebrow={t.eyebrow} title={t.title} />
        <div className={styles.trustGrid}>
          {TRUST.map(({ key, icon }) => (
            <article key={key} className={styles.trustCard}>
              <Icon name={icon} size={28} className={styles.trustIcon} />
              <div className={styles.trustBody}>
                <h3 className={styles.trustTitle}>{t[key].title}</h3>
                <p className={styles.trustText}>{t[key].text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ final CTA

export function FinalCta() {
  const t = useT(dict).cta;
  const { isAuthenticated } = useAuth();
  return (
    <section aria-labelledby="cta-title" className={styles.ctaSection}>
      <div className={styles.ctaInner}>
        <div className={styles.ctaBand}>
          <div className={styles.ctaText}>
            <h2 id="cta-title" className={styles.ctaTitle}>
              {t.title}
            </h2>
            <p className={styles.ctaLead}>{t.text}</p>
          </div>
          <Button to={isAuthenticated ? '/dashboard' : '/auth?mode=register'} variant="white" size="xl" iconRight="arrowRight" className={styles.ctaBtn}>
            {t.button}
          </Button>
        </div>
      </div>
    </section>
  );
}
