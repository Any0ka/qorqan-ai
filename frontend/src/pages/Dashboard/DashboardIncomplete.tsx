import { useNavigate } from 'react-router-dom';
import type { Dashboard } from '@/api/types';
import { useSetNoCredits } from '@/api/hooks';
import { Icon } from '@/components/Icon';
import { Button, Card, Kpi, Pill, Row, Segments, TileGrid, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useT } from '@/i18n/I18nProvider';
import { money } from '@/lib/format';
import { AiCard } from './DashboardComplete';
import { dict } from './i18n';
import styles from './Dashboard.module.css';

/** New account: nothing entered yet. */
export function DashboardNew() {
  const t = useT(dict);
  const w = t.welcome;
  return (
    <>
      <Card pad="lg" radius="hero" aria-labelledby="w-title" className={styles.welcome}>
        <div className={styles.welcomeText}>
          <p className={styles.eyebrowTeal}>{w.eyebrow}</p>
          <h2 id="w-title" className={styles.heroTitle}>
            {w.title}
          </h2>
          <p className={styles.heroText}>{w.text}</p>
          <div className={styles.actions}>
            <Button to="/onboarding" size="xl" iconRight="arrowRight">
              {w.fill}
            </Button>
            <Button to="/profile?section=consents" variant="secondary" size="xl">
              {w.howData}
            </Button>
          </div>
        </div>
        <ol aria-label={w.stepsLabel} className={styles.steps}>
          {w.steps.map((s, i) => (
            <li key={s.title}>
              <span className={`${styles.stepNum} ${i === 0 ? styles.stepNumOn : ''}`}>{i + 1}</span>
              <span className={styles.stepText}>
                <b>{s.title}</b>
                <span>{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <TileGrid label={w.placeholdersLabel}>
        <Kpi title={t.kpi.debt} value="—" muted dashed="neutral" note={w.afterStep3} />
        <Kpi title={t.kpi.payments} value="—" muted dashed="neutral" note={w.afterStep3} />
        <Kpi title={t.kpi.load} value="—" muted dashed="neutral" note={w.needIncomeCredits} />
        <Kpi title={t.kpi.free} value="—" muted dashed="neutral" note={w.needAll} />
      </TileGrid>

      <Row>
        <Card flex="2 520px" aria-labelledby="s-title" style={{ gap: 14 }}>
          <InsufficientHead />
          <p className={styles.bodyText} style={{ color: 'var(--text)' }}>
            {w.stateText}
          </p>
          <p className={styles.bodyTextSm}>{w.stateHint}</p>
          <Button to="/check" variant="secondary" className={styles.selfStart}>
            {w.checkPurchase}
          </Button>
        </Card>
        <AiCard title={w.aiTitle} text={w.aiText} questions={[w.aiQuestion]} open={t.ai.open} />
      </Row>
    </>
  );
}

function InsufficientHead() {
  const t = useT(dict);
  const c = useT(common);
  return (
    <div className={styles.cardTop}>
      <h2 id="s-title" className={styles.mutedTitle}>
        {t.state.title}
      </h2>
      <Pill tone="neutral" icon="questionDashed">
        {c.risk.insufficient}
      </Pill>
    </div>
  );
}

/** Incomes and/or expenses entered, credits not yet. */
export function DashboardPartial({ data }: { data: Dashboard }) {
  const t = useT(dict);
  const p = t.partial;
  const navigate = useNavigate();
  const toast = useToast();
  const c = useT(common);
  const noCredits = useSetNoCredits();
  const done = data.completeness.steps_done;
  const m = data.metrics;

  const pickFile = (file: File | undefined) => {
    if (file) navigate('/onboarding?step=3', { state: { uploadFile: file } });
  };

  return (
    <>
      <section aria-labelledby="p-title" className={styles.progressCard}>
        <div className={styles.progressText}>
          <h2 id="p-title" className={styles.progressTitle}>
            {p.progressTitle(done)}
          </h2>
          <Segments total={3} done={done} label={p.progressAria(done)} />
          <p className={styles.bodyTextSm}>{data.completeness.expenses ? p.progressText : p.progressTextIncomeOnly}</p>
        </div>
        <Button to={`/onboarding?step=${data.completeness.expenses ? 3 : 2}`} size="lg">
          {p.continue}
        </Button>
      </section>

      <Row>
        <Card flex="2 560px" aria-labelledby="s-title">
          <InsufficientHead />
          {data.completeness.expenses && <p className={styles.partialLead}>{p.freeLead(money(m.free_before_credits))}</p>}
          <p className={styles.bodyText}>{p.freeText}</p>
        </Card>
        <Card tone="navy" flex="1 320px" aria-labelledby="c-title" style={{ gap: 12 }}>
          <h2 id="c-title" className={styles.navyTitle} style={{ fontSize: 20, lineHeight: '27px' }}>
            {p.checkTitle}
          </h2>
          <p className={styles.navyText} style={{ fontSize: 14, lineHeight: '21px' }}>
            {p.checkText}
          </p>
          <Button to="/check" variant="white" size="lg" block className={styles.pushDown}>
            {p.checkCta}
          </Button>
        </Card>
      </Row>

      <TileGrid label={t.kpi.label}>
        <Kpi title={p.income} value={money(m.income)} note={p.incomeSet} noteTone="success" />
        {data.completeness.expenses ? (
          <Kpi title={p.expenses} value={money(m.expenses)} note={p.expensesSet} noteTone="success" />
        ) : (
          <Kpi title={p.expenses} value="—" muted dashed="warning" note={p.expensesMissing} noteTone="warning" />
        )}
        <Kpi title={p.payments} value="—" muted dashed="warning" note={p.paymentsMissing} noteTone="warning" />
        <Kpi title={p.load} value="—" muted dashed="warning" note={p.loadMissing} noteTone="warning" />
      </TileGrid>

      <Card aria-labelledby="add-title" style={{ gap: 18 }}>
        <div>
          <h2 id="add-title" className={styles.addTitle}>
            {p.addTitle}
          </h2>
          <p className={styles.bodyTextSm}>{p.addText}</p>
        </div>
        <div className={styles.addRow}>
          <label
            className={styles.drop}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickFile(e.dataTransfer.files?.[0]);
            }}
          >
            <input type="file" accept="application/pdf" className="visually-hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
            <span aria-hidden="true" className={styles.dropIcon}>
              <Icon name="upload" size={24} />
            </span>
            <b className={styles.dropTitle}>{p.drop}</b>
            <span className={styles.bodyTextSm}>
              {p.dropOr} <span className={styles.dropLink}>{p.dropChoose}</span> · {p.dropLimit}
            </span>
          </label>
          <div className={styles.addAlt}>
            <Button to="/onboarding?step=3&method=manual" variant="secondary" size="xl" icon="pencil" className={styles.altBtn}>
              {p.manual}
            </Button>
            <Button
              variant="secondary"
              size="xl"
              icon="checkCircle"
              className={styles.altBtn}
              disabled={noCredits.isPending}
              onClick={() => noCredits.mutate(true, { onError: () => toast({ tone: 'error', text: c.saveFailed }) })}
            >
              {p.none}
            </Button>
            <p className={styles.hintSm}>{p.reportHint}</p>
          </div>
        </div>
      </Card>
    </>
  );
}
