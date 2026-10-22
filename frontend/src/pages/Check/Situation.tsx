import { Link } from 'react-router-dom';
import type { Financial } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Button, ErrorState, Skeleton, ZONE_ICON, ZoneBadge } from '@/components/ui';
import { common } from '@/i18n/common';
import { useT } from '@/i18n/I18nProvider';
import { money, percent } from '@/lib/format';
import { dict } from './i18n';
import { Rich } from './Rich';
import styles from './Check.module.css';

export function latestUpdate(f: Financial): string | null {
  const dates = [f.incomes_updated_at, f.expenses_updated_at].filter((d): d is string => !!d);
  return dates.length ? dates.sort().at(-1)! : null;
}

const loadTone = (load: number) => (load >= 0.45 ? 'danger' : load > 0.3 ? 'warning' : 'success');

/** Thin load bar with the 30% and 45% ticks, as in «Твоя ситуация сейчас». */
function LoadMeter({ load }: { load: number }) {
  const t = useT(dict);
  const tone = loadTone(load);
  return (
    <div role="img" aria-label={t.situation.loadAria(percent(load))} className={styles.meter}>
      <div className={styles.meterHead}>
        <span>{t.situation.load}</span>
        <b>{percent(load)}</b>
      </div>
      <div className={`${styles.meterTrack} ${styles['track_' + tone]}`}>
        <div className={`${styles.meterFill} ${styles['fill_' + tone]}`} style={{ width: `${Math.min(load, 1) * 100}%` }} />
        <div className={styles.meterTick} style={{ left: '30%' }} />
        <div className={styles.meterTick} style={{ left: '45%' }} />
      </div>
    </div>
  );
}

export function SituationCard({ data, isLoading, error, onRetry }: { data?: Financial; isLoading: boolean; error: unknown; onRetry: () => void }) {
  const t = useT(dict);
  if (isLoading) {
    return (
      <section className={styles.sideCard} aria-busy="true">
        <Skeleton height={26} width="60%" />
        <Skeleton height={150} />
        <Skeleton height={26} />
      </section>
    );
  }
  if (error || !data) {
    return (
      <section className={styles.sideCard}>
        <ErrorState compact error={error} onRetry={onRetry} />
      </section>
    );
  }
  if (data.completeness.missing.length > 0) return <MissingCard data={data} />;
  const date = latestUpdate(data);
  return (
    <section aria-labelledby="now-title" className={styles.sideCard}>
      <div className={styles.sideHead}>
        <h2 id="now-title" className={styles.sideTitle}>
          {t.situation.title}
        </h2>
        <ZoneBadge zone={data.zone} size="sm" short />
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>{t.situation.income}</dt>
          <dd>{money(data.income_total)}</dd>
        </div>
        <div>
          <dt>{t.situation.expenses}</dt>
          <dd>{money(data.expenses_total)}</dd>
        </div>
        <div>
          <dt>
            {t.situation.payments} <span className={styles.muted}>· {data.credits_count}</span>
          </dt>
          <dd>{money(data.payments_total)}</dd>
        </div>
        <div className={styles.factStrong}>
          <dt>{t.situation.free}</dt>
          <dd className={data.free < 0 ? styles.negative : undefined}>{money(data.free)}</dd>
        </div>
      </dl>
      <LoadMeter load={data.load} />
      {date && (
        <p className={styles.small}>
          {t.situation.dataFrom(date)} · <Link to="/profile?section=finance">{t.situation.edit}</Link>
        </p>
      )}
    </section>
  );
}

function MissingCard({ data }: { data: Financial }) {
  const t = useT(dict);
  return (
    <section aria-labelledby="missing-title" className={`${styles.sideCard} ${styles.missingCard}`}>
      <div className={styles.sideHead}>
        <h2 id="missing-title" className={styles.sideTitle}>
          {t.missing.title}
        </h2>
      </div>
      <p className={styles.bodySm}>{t.missing.text}</p>
      <ul className={styles.missingList}>
        {(['income', 'expenses', 'credits'] as const).map((k) => {
          const done = !data.completeness.missing.includes(k);
          return (
            <li key={k} className={done ? styles.missingDone : undefined}>
              <Icon name={done ? 'checkCircle' : 'alert'} size={20} strokeWidth={2} className={done ? styles.iconDone : styles.iconMissing} />
              <span>
                <b>{t.missing.items[k].title}</b>
                {!done && <span className={styles.muted}>{t.missing.items[k].text}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <Button to="/onboarding" variant="secondary" iconRight="arrowRight" className={styles.selfStart}>
        {t.missing.cta}
      </Button>
    </section>
  );
}

/** Mobile: one collapsible line instead of the side card (M-Check). */
export function SituationSummary({ data }: { data?: Financial }) {
  const t = useT(dict);
  if (!data) return null;
  if (data.completeness.missing.length > 0) {
    return (
      <p className={styles.summaryMissing}>
        <Icon name="triangle" size={18} />
        <span>
          {t.missing.chip} <Link to="/onboarding">{t.missing.cta}</Link>
        </span>
      </p>
    );
  }
  return (
    <details className={styles.summary}>
      <summary>
        <span>
          <Rich text={t.situation.summary(percent(data.load), money(data.free))} boldClass={data.zone === 'high' ? styles.negative : undefined} />
        </span>
        <Icon name="chevronDown" size={18} strokeWidth={2} className={styles.summaryChevron} />
      </summary>
      <p>{t.situation.summaryDetails(money(data.income_total), money(data.expenses_total), money(data.payments_total), data.credits_count)}</p>
    </details>
  );
}

/** Check-AI: compact row of the current numbers. */
export function SituationChips({ data }: { data?: Financial }) {
  const t = useT(dict);
  const c = useT(common);
  if (!data) return <Skeleton height={50} radius={16} />;
  if (data.completeness.missing.length > 0) {
    return (
      <p className={styles.chipsMissing}>
        <Icon name="triangle" size={18} />
        <span>
          {t.missing.chip} <Link to="/onboarding">{t.missing.cta}</Link>
        </span>
      </p>
    );
  }
  const tone = loadTone(data.load);
  return (
    <ul aria-label={t.situation.chips.label} className={styles.chipsRow}>
      <li>
        {t.situation.chips.income} <b>{money(data.income_total)}</b>
      </li>
      <li>
        {t.situation.chips.expenses} <b>{money(data.expenses_total)}</b>
      </li>
      <li>
        {t.situation.chips.payments} <b>{money(data.payments_total)}</b>
      </li>
      <li>
        {t.situation.chips.free} <b className={data.free < 0 ? styles.negative : undefined}>{money(data.free)}</b>
      </li>
      <li className={styles.chipLoad}>
        {t.situation.chips.load} <b className={styles['text_' + tone]}>{percent(data.load)}</b>
        <Icon name={ZONE_ICON[data.zone]} size={14} strokeWidth={2.4} label={c.zoneShort[data.zone]} className={styles['text_' + tone]} />
      </li>
    </ul>
  );
}
