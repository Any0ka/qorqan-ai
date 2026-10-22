import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Assessment, FinanceSnapshot, Reason } from '@/api/types';
import { Icon, type IconName } from '@/components/Icon';
import { Button, CompareBars, RiskBadge, RiskScale } from '@/components/ui';
import { common } from '@/i18n/common';
import { useT } from '@/i18n/I18nProvider';
import { money, num, percent, pointsDiff } from '@/lib/format';
import { lowerFirst } from '@/pages/Check/form';
import { Rich } from '@/pages/Check/Rich';
import { dict } from './i18n';
import { ChangePanel, JumpLink, shortDate, type ChangeItem } from './Parts';
import styles from './Result.module.css';

type Strings = (typeof dict)['ru'];
type Tone = 'danger' | 'warning' | 'success' | 'neutral';
type Snap = { before: FinanceSnapshot; after: FinanceSnapshot };

const riskTone = (a: Assessment): Tone => (a.risk === 'high' ? 'danger' : a.risk === 'medium' ? 'warning' : 'success');

// ------------------------------------------------------------------ verdict

function Hero({ a, s }: { a: Assessment; s: Snap }) {
  const t = useT(dict);
  const kind = a.purchase.kind;
  const { before, after } = s;
  const scenarios = `/scenarios?check=${a.id}`;
  const change = `/check?from=${a.id}`;

  const title = a.risk === 'high' ? t.verdict.high[kind] : a.risk === 'medium' ? t.verdict.medium : t.verdict.low;
  const lead = a.risk === 'high' ? t.verdict.highLead : a.risk === 'medium' ? (kind === 'own' ? t.verdict.mediumOwnLead : t.verdict.mediumLead) : t.verdict.lowLead;
  const safe = a.risk === 'high' ? '' : ` · ${t.change.safeUpTo}`;
  const freeTone = a.risk === 'high' ? 'danger' : a.risk === 'medium' ? 'warning' : 'navy';

  const items: ChangeItem[] = [
    {
      label: t.change.freeLeft,
      value: money(after.free),
      unit: a.risk === 'high' ? t.change.perMonth : undefined,
      sub: t.change.now(money(before.free)),
      tone: freeTone,
    },
    { label: t.change.loadGoes, value: percent(after.load), unit: t.change.ofIncome || undefined, sub: t.change.now(percent(before.load)) + safe },
  ];
  if (a.risk === 'high') {
    items.push({ label: t.change.payments, value: money(after.payments), unit: t.change.perMonth, sub: t.change.now(money(before.payments)) });
  }
  const afterTerm = a.reasons.find((r) => r.code === 'after_term');
  if (a.risk === 'low' && afterTerm) {
    items.push({
      label: t.change.afterTermLabel(afterTerm.params.months),
      value: t.change.afterTermValue[kind],
      sub: t.change.afterTermSub(percent(afterTerm.params.load)),
      small: true,
    });
  }

  return (
    <section aria-labelledby="verdict-title" className={styles.hero}>
      <div className={styles.heroMain}>
        <RiskBadge risk={a.risk} size="lg" />
        <div className={styles.heroText}>
          <h2 id="verdict-title" className={styles.verdictTitle}>
            {title}
          </h2>
          <p className={styles.lead}>{lead}</p>
        </div>
        <RiskScale risk={a.risk} yours={t.yours} />
        <div className={styles.ctaRow}>
          {a.risk === 'high' && (
            <Button to={scenarios} size="xl" iconRight="arrowRight">
              {t.cta.findAlt}
            </Button>
          )}
          {a.risk === 'medium' && (
            <Button to={scenarios} size="xl" iconRight="arrowRight">
              {t.cta.considerAlts}
            </Button>
          )}
          {a.risk === 'low' && (
            <JumpLink target="details" className={styles.primaryLink}>
              {t.cta.seeDetails}
            </JumpLink>
          )}
          {a.risk === 'low' ? (
            <Button to={scenarios} variant="secondary" size="xl" className={styles.secondaryCta}>
              {t.cta.compareScenarios}
            </Button>
          ) : (
            <Button to={change} variant="secondary" size="xl" className={styles.secondaryCta}>
              {t.cta.changeTerms}
            </Button>
          )}
        </div>
        {a.risk === 'high' && (
          <div className={styles.heroLinks}>
            <JumpLink target="calc" className={styles.iconLink}>
              <Icon name="calculator" size={18} />
              {t.cta.seeCalc}
            </JumpLink>
            <Link to="/plan" className={styles.iconLink}>
              <Icon name="route" size={18} />
              {t.cta.makePlan}
            </Link>
          </div>
        )}
        {a.risk !== 'medium' && (
          <p className={styles.note}>
            <Icon name="info" size={18} />
            {a.risk === 'high' ? t.highNote(kind) : t.lowNote}
          </p>
        )}
      </div>
      <ChangePanel title={a.risk === 'low' ? t.change.titleLow : t.change.title(kind)} items={items} />
    </section>
  );
}

// ------------------------------------------------------------------ reasons

function reasonCopy(r: Reason, t: Strings, c: (typeof common)['ru']): { title: string; text: string; tag?: ReactNode } | null {
  const p = r.params;
  const R = t.reasons;
  switch (r.code) {
    case 'load_already_high':
      return { title: R.load_already_high.title(percent(p.load)), text: R.load_already_high.text(percent(p.safe)), tag: R.load_already_high.tag(percent(p.high)) };
    case 'load_becomes_high':
      return { title: R.load_becomes_high.title(percent(p.load)), text: R.load_becomes_high.text(percent(p.high)), tag: R.load_becomes_high.tag(percent(p.high)) };
    case 'free_negative':
      return { title: R.free_negative.title, text: R.free_negative.text(money(Math.abs(p.free))), tag: R.free_negative.tag };
    case 'free_too_low':
      return { title: R.free_too_low.title, text: R.free_too_low.text(money(p.free)), tag: R.free_too_low.tag(percent(p.share)) };
    case 'borrow_to_pay':
      return {
        title: R.borrow_to_pay.title,
        text: R.borrow_to_pay.text(c.creditTypeLower[p.credit_type as keyof typeof c.creditTypeLower] ?? c.creditTypeLower.other),
        tag: (
          <Link to={`/credits?id=${p.credit_id}`} className={styles.reasonTagLink}>
            {R.borrow_to_pay.tag(p.organization, p.remaining ?? null)}
          </Link>
        ),
      };
    case 'long_commitment':
      return { title: R.long_commitment.title(p.months), text: R.long_commitment.text(p.months, percent(p.load)), tag: R.long_commitment.tag(p.months) };
    case 'load_caution':
      return { title: R.load_caution.title, text: R.load_caution.text(percent(p.load), percent(p.safe)) };
    case 'free_drop':
      return { title: R.free_drop.title(money(p.delta)), text: R.free_drop.text(money(p.free)) };
    default:
      return null;
  }
}

function Reasons({ a }: { a: Assessment }) {
  const t = useT(dict);
  const c = useT(common);
  const high = a.risk === 'high';
  const cards = a.reasons.map((r) => reasonCopy(r, t, c)).filter((x): x is NonNullable<typeof x> => !!x);
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="why-title" className={styles.block}>
      <h2 id="why-title" className={styles.h2}>
        {high ? t.why : t.factors}
      </h2>
      <ol className={styles.reasons}>
        {cards.map((r, i) => (
          <li key={i} className={styles.reason}>
            <span aria-hidden="true" className={`${styles.reasonNum} ${high ? styles.num_danger : styles.num_warning}`}>
              {i + 1}
            </span>
            <div className={styles.reasonBody}>
              <h3 className={styles.reasonTitle}>{r.title}</h3>
              <p className={styles.reasonText}>{r.text}</p>
              {high && r.tag && (typeof r.tag === 'string' ? <span className={styles.reasonTag}>{r.tag}</span> : r.tag)}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ------------------------------------------------------------------ now vs after

function CompareTable({ a, s }: { a: Assessment; s: Snap }) {
  const t = useT(dict);
  const c = useT(common);
  const { before, after } = s;
  const tone = a.risk === 'high' ? styles.diffDanger : a.risk === 'medium' ? styles.diffWarning : undefined;
  const rows = [
    { label: t.compare.payments, short: t.compare.paymentsShort, now: money(before.payments), nowShort: num(before.payments), after: money(after.payments), diff: money(after.payments - before.payments, { signed: true }) },
    { label: t.compare.load, short: t.compare.loadShort, now: percent(before.load), nowShort: percent(before.load), after: percent(after.load), diff: c.pp(pointsDiff(after.load, before.load)) },
    { label: t.compare.free, short: t.compare.freeShort, now: money(before.free), nowShort: num(before.free), after: money(after.free), diff: money(after.free - before.free, { signed: true }), negative: after.free < 0 },
  ];
  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t.compare.metric}</th>
              <th scope="col">{t.compare.now}</th>
              <th scope="col">{t.compare.after(a.purchase.kind)}</th>
              <th scope="col">{t.compare.diff}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td>{r.now}</td>
                <td className={`${styles.strongCell} ${r.negative ? styles.negative : ''}`}>{r.after}</td>
                <td className={tone}>{r.diff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className={styles.stacked}>
        {rows.map((r) => (
          <div key={r.label}>
            <dt>{r.short}</dt>
            <dd>
              {r.nowShort} → <b className={r.negative ? styles.negative : undefined}>{r.after}</b>
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/** Free money before/after with a 0 marker when one of the values is negative. */
function FreeBars({ before, after, tone }: { before: number; after: number; tone: Tone }) {
  const t = useT(dict);
  const neg = Math.max(0, -Math.min(before, after));
  const pos = Math.max(0, before, after);
  const zero = neg > 0 ? Math.min(0.5, Math.max(0.12, neg / (pos + neg))) : 0;
  const scale = Math.max(pos / (1 - zero), neg > 0 ? neg / zero : 0) || 1;
  const bar = (v: number) =>
    v >= 0 ? { left: `${zero * 100}%`, width: `${(v / scale) * 100}%` } : { left: `${(zero - -v / scale) * 100}%`, width: `${(-v / scale) * 100}%` };
  const rows = [
    { label: t.compare.nowShort, value: before, tone: 'neutral' as Tone },
    { label: t.compare.afterShort, value: after, tone },
  ];
  return (
    <div role="img" aria-label={t.compare.freeAria(money(before), money(after))} className={styles.bars}>
      <p className={styles.barsTitle}>{t.compare.freeTitle}</p>
      {rows.map((r) => (
        <div key={r.label} className={styles.barRow}>
          <span className={styles.barLabel}>{r.label}</span>
          <div className={styles.barTrack}>
            {neg > 0 && <div className={styles.zeroLine} style={{ left: `${zero * 100}%` }} />}
            <div className={`${styles.barFill} ${styles['bf_' + r.tone]} ${r.value < 0 ? styles.barNeg : ''}`} style={bar(r.value)} />
          </div>
          <b className={`${styles.barValue} ${r.value < 0 || (r.tone !== 'neutral' && r.tone !== 'success') ? styles['bv_' + r.tone] : ''}`}>{money(r.value)}</b>
        </div>
      ))}
      {neg > 0 && (
        <div className={styles.barRow}>
          <span className={styles.barLabel} />
          <span className={styles.barAxis}>
            <span style={{ left: `${zero * 100}%` }}>{money(0)}</span>
          </span>
          <span className={styles.barValue} />
        </div>
      )}
    </div>
  );
}

function LoadBars({ a, s }: { a: Assessment; s: Snap }) {
  const t = useT(dict);
  const high = a.risk === 'high';
  return (
    <CompareBars
      title={t.compare.loadTitle}
      label={t.compare.loadAria(percent(s.before.load), percent(s.after.load), high)}
      max={Math.max(1, s.before.load, s.after.load)}
      threshold={high ? 0.45 : 0.3}
      thresholdLabel={high ? t.compare.threshold45 : t.compare.safe30}
      rows={[
        { label: t.compare.nowShort, value: s.before.load, display: percent(s.before.load), tone: 'neutral' },
        { label: t.compare.afterShort, value: s.after.load, display: percent(s.after.load), tone: riskTone(a) },
      ]}
    />
  );
}

function CompareSection({ a, s }: { a: Assessment; s: Snap }) {
  const t = useT(dict);
  const title = t.compare.title(a.purchase.kind);
  if (a.risk === 'medium') {
    return (
      <section aria-labelledby="compare-title" className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 id="compare-title" className={styles.h2}>
            {title}
          </h2>
          <JumpLink target="calc" className={styles.headLink}>
            {t.cta.seeCalc}
          </JumpLink>
        </div>
        <div className={styles.barsRow}>
          <LoadBars a={a} s={s} />
          <FreeBars before={s.before.free} after={s.after.free} tone="warning" />
        </div>
      </section>
    );
  }
  return (
    <section aria-labelledby="compare-title" className={styles.panel}>
      <h2 id="compare-title" className={styles.h2}>
        {title}
      </h2>
      <div className={styles.compareRow}>
        <div className={styles.compareTable}>
          <CompareTable a={a} s={s} />
        </div>
        <div className={styles.compareBars}>
          <LoadBars a={a} s={s} />
          <FreeBars before={s.before.free} after={s.after.free} tone="danger" />
        </div>
      </div>
    </section>
  );
}

function DetailsSection({ a, s }: { a: Assessment; s: Snap }) {
  const t = useT(dict);
  const src = a.data_sources;
  const entered = [src.income_updated_at, src.expenses_updated_at].filter((d): d is string => !!d).sort().at(-1) ?? null;
  return (
    <section id="details" tabIndex={-1} aria-labelledby="details-title" className={styles.panel}>
      <h2 id="details-title" className={styles.h2}>
        {t.compare.title(a.purchase.kind)}
      </h2>
      <CompareTable a={a} s={s} />
      <p className={styles.bodySm}>
        {t.compare.considered(money(s.before.income), money(s.before.expenses), entered, t.compare.creditsSources(src.credits_from_report, src.credits_manual))}
      </p>
    </section>
  );
}

// ------------------------------------------------------------------ alternatives

function Alternative({ a, s }: { a: Assessment; s: Snap }) {
  const t = useT(dict);
  const c = useT(common);
  const alt = a.alternative;
  const scenarios = `/scenarios?check=${a.id}`;
  if (!alt) {
    return (
      <section aria-labelledby="alt-title" className={`${styles.altCard} ${styles.altNone}`}>
        <h2 id="alt-title" className={styles.altTitle}>
          {t.alt.noneTitle}
        </h2>
        <p className={styles.bodyText}>{t.alt.noneText}</p>
        <Button to="/plan" variant="teal" size="lg" iconRight="arrowRight" className={styles.selfStart}>
          {t.alt.noneCta}
        </Button>
      </section>
    );
  }
  const p = a.purchase;
  const simpler = alt.price < p.price;
  const item = lowerFirst(p.title);
  const cc = alt.closing_credit;
  const other = t.alt.text.other(percent(alt.load), money(alt.free));
  let title: string;
  let text: string;
  switch (alt.code) {
    case 'save':
      title = cc ? t.alt.title.saveClosing(c.creditTypeAcc[cc.type], simpler) : t.alt.title.save(simpler);
      text = cc
        ? t.alt.text.saveClosing(cc.remaining_payments ?? 0, c.creditTypeAcc[cc.type], money(alt.saving_monthly ?? 0), item, money(alt.price))
        : t.alt.text.save(money(alt.saving_monthly ?? 0), alt.months_until_purchase ?? 0, item, money(alt.price));
      break;
    case 'wait':
      title = cc ? t.alt.title.wait(c.creditTypeLower[cc.type]) : t.alt.title.cheaper(money(alt.price));
      text = cc ? t.alt.text.wait(alt.months_until_purchase ?? 0, c.creditTypePoss[cc.type], cc.organization, money(alt.price), percent(alt.load)) : other;
      break;
    case 'longer_term':
      title = t.alt.title.longer(p.term_months < 24 ? 24 : 36);
      text = t.alt.text.longerPrefix + other;
      break;
    case 'down_payment':
      title = t.alt.title.down;
      text = other;
      break;
    default:
      title = t.alt.title.cheaper(money(alt.price));
      text = other;
  }
  const bullets: Array<{ icon: IconName; text: string }> = [
    { icon: 'calendar', text: alt.months_until_purchase ? t.alt.inMonths(alt.months_until_purchase) : t.alt.now },
    ...(!alt.new_debt ? [{ icon: 'shield' as IconName, text: t.alt.noDebt }] : []),
    { icon: 'trendDown', text: alt.load < s.before.load ? t.alt.loadDown(percent(alt.load)) : t.alt.loadIs(percent(alt.load)) },
  ];
  return (
    <section aria-labelledby="alt-title" className={styles.altCard}>
      <span className={styles.altBadge}>
        <Icon name="checkCircle" size={15} strokeWidth={2.2} />
        {t.alt.badge}
      </span>
      <h2 id="alt-title" className={styles.altTitle}>
        {title}
      </h2>
      <ul className={styles.altBullets}>
        {bullets.map((b) => (
          <li key={b.icon}>
            <Icon name={b.icon} size={16} />
            <span>
              <Rich text={b.text} />
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.bodyText}>{text}</p>
      <Button to={scenarios} variant="teal" size="lg" iconRight="arrowRight" className={styles.selfStart}>
        {t.alt.compareAll}
      </Button>
    </section>
  );
}

function AskAi({ a }: { a: Assessment }) {
  const t = useT(dict);
  const questions = [t.ask.why[a.purchase.kind], a.purchase.term_months < 24 ? t.ask.longer : t.ask.down, t.ask.when];
  return (
    <section aria-labelledby="ask-title" className={styles.askCard}>
      <div className={styles.askHead}>
        <span aria-hidden="true" className={styles.aiAvatar}>
          <Icon name="sparkle" size={18} strokeWidth={2} />
        </span>
        <h2 id="ask-title" className={styles.askTitle}>
          {t.ask.title}
        </h2>
      </div>
      {questions.map((q) => (
        <Link key={q} to={`/ai?q=${encodeURIComponent(q)}`} className={styles.askChip}>
          {q}
        </Link>
      ))}
    </section>
  );
}

function Softer({ a }: { a: Assessment }) {
  const t = useT(dict);
  const S = t.softer;
  if (a.softer_options.length === 0) return null;
  return (
    <section aria-labelledby="softer-title" className={styles.block}>
      <h2 id="softer-title" className={styles.h2sm}>
        {S.title}
      </h2>
      <div className={styles.softerGrid}>
        {a.softer_options.map((o) => {
          let title: string;
          const parts: string[] = [o.monthly_payment > 0 ? S.payment(money(o.monthly_payment)) : S.noPayment, S.load(percent(o.load))];
          switch (o.code) {
            case 'longer_term':
              title = S.longer(S.kindName[a.purchase.kind], o.term_months);
              parts.push(o.total_cost > o.price ? S.overpay(money(o.total_cost - o.price)) : S.free(money(o.free)));
              break;
            case 'cheaper':
              title = S.cheaper(money(o.price));
              parts.push(S.free(money(o.free)));
              break;
            case 'wait':
              title = S.wait(o.months_until_purchase ?? 0);
              parts.push(S.free(money(o.free)));
              break;
            case 'save':
              title = S.save(o.months_until_purchase);
              parts.push(S.free(money(o.free)));
              break;
            default:
              title = S.down;
              parts.push(S.free(money(o.free)));
          }
          return (
            <Link key={o.code} to={`/scenarios?check=${a.id}`} className={`${styles.softer} ${o.recommended ? styles.softerRec : ''}`}>
              {o.recommended && <span className={styles.recBadge}>{S.recommended}</span>}
              <b className={styles.softerTitle}>{title}</b>
              <span className={styles.bodySm}>{parts.join(' · ')}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

const TIP_ICON: Record<Assessment['tips'][number], IconName> = {
  check_hidden_fees: 'file',
  check_full_cost: 'fileText',
  set_reminders: 'calendar',
  no_new_credit_during_term: 'shield',
};

function Tips({ a }: { a: Assessment }) {
  const t = useT(dict);
  if (a.tips.length === 0) return null;
  const text = (tip: Assessment['tips'][number]) =>
    tip === 'set_reminders'
      ? t.tips.set_reminders(a.purchase.kind)
      : tip === 'no_new_credit_during_term'
        ? t.tips.no_new_credit_during_term(a.purchase.term_months)
        : t.tips[tip];
  return (
    <section aria-labelledby="tips-title" className={styles.block}>
      <h2 id="tips-title" className={styles.h2sm}>
        {t.tips.title}
      </h2>
      <ul className={styles.tips}>
        {a.tips.map((tip) => (
          <li key={tip}>
            <Icon name={TIP_ICON[tip]} size={20} />
            <span>{text(tip)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------ «Как мы считали»

function CalcDetails({ a, s }: { a: Assessment; s: Snap }) {
  const t = useT(dict);
  const C = t.calc;
  const { before, after } = s;
  const src = a.data_sources;
  const p = a.purchase;
  const [open, setOpen] = useState(() => a.risk === 'high' && !window.matchMedia('(max-width: 767px)').matches);

  let newSrc: string;
  if (p.kind === 'own') newSrc = C.newOwn;
  else if (!a.monthly_auto) newSrc = C.newManual;
  else {
    const financed = a.total_cost - p.down_payment;
    const principal = p.price - p.down_payment;
    const markup = principal > 0 ? (financed - p.fees) / principal - 1 : 0;
    newSrc =
      C.newAuto(money(financed), p.term_months) +
      C.extras(p.down_payment ? money(p.down_payment) : null, p.fees ? money(p.fees) : null) +
      (markup > 0.004 ? C.markup(percent(markup)) : '');
  }
  const rows = [
    { label: C.income, src: src.income_updated_at ? C.incomeSrc(shortDate(src.income_updated_at)!) : C.noDate, value: money(before.income) },
    { label: C.expenses, src: src.expenses_updated_at ? C.expensesSrc(shortDate(src.expenses_updated_at)!) : C.noDate, value: money(before.expenses) },
    { label: C.payments(before.credits_count), src: C.creditsSrc(shortDate(src.report_date), src.credits_from_report, src.credits_manual), value: money(before.payments) },
    { label: C.newPayment, src: newSrc, value: money(a.monthly_payment) },
  ];

  return (
    <details id="calc" open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className={styles.calc}>
      <summary className={styles.calcSummary}>
        {C.summary}
        <Icon name="chevronDown" size={20} strokeWidth={2} className={styles.calcChevron} />
      </summary>
      <div className={styles.calcBody}>
        <div className={styles.calcData}>
          <h3 className={styles.h3}>{C.data}</h3>
          <dl className={styles.calcList}>
            {rows.map((r) => (
              <div key={r.label}>
                <dt>
                  {r.label} · <span className={styles.muted}>{r.src}</span>
                </dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
          <Link to="/profile?section=finance" className={styles.fixLink}>
            {C.fix}
          </Link>
        </div>
        <div className={styles.calcFormulas}>
          <h3 className={styles.h3}>{C.formulas}</h3>
          <p className={styles.formula}>
            <Rich text={`${C.loadFormula}\n${num(after.payments)} ÷ ${num(after.income)} = **${percent(after.load)}**`} />
          </p>
          <p className={styles.formula}>
            <Rich
              text={`${C.freeFormula}\n${num(after.income)} − ${num(after.expenses)} − ${num(after.payments)} = **${money(after.free)}**`}
              boldClass={after.free < 0 ? styles.negative : undefined}
            />
          </p>
          <ul className={styles.legend}>
            {(['low', 'medium', 'high'] as const).map((r) => (
              <li key={r}>
                <span aria-hidden="true" className={`${styles.legendDot} ${styles['dot_' + r]}`} />
                {C.legend[r]}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

/** HIGH (Result-Red) · MEDIUM (Result-Yellow) · LOW (Result-Green). */
export function AssessedResult({ a }: { a: Assessment }) {
  if (!a.before || !a.after) return null;
  const s: Snap = { before: a.before, after: a.after };
  return (
    <>
      <Hero a={a} s={s} />
      {a.risk !== 'low' && <Reasons a={a} />}
      {a.risk === 'low' ? <DetailsSection a={a} s={s} /> : <CompareSection a={a} s={s} />}
      {a.risk === 'high' && (
        <div className={styles.row}>
          <Alternative a={a} s={s} />
          <AskAi a={a} />
        </div>
      )}
      {a.risk === 'medium' && <Softer a={a} />}
      {a.risk === 'low' && <Tips a={a} />}
      {a.risk !== 'low' && <CalcDetails a={a} s={s} />}
    </>
  );
}

