import { Link } from 'react-router-dom';
import type { AiContext } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Button, RISK_ICON, Skeleton } from '@/components/ui';
import { common } from '@/i18n/common';
import { useT } from '@/i18n/I18nProvider';
import { money } from '@/lib/format';
import { dict } from './i18n';
import styles from './AI.module.css';

const PROFILE_CONSENTS = '/profile?section=consents';

/** «Что учитывает qorgan AI» — the numbers the assistant can see. */
function ContextList({ ctx, compact = false }: { ctx: AiContext; compact?: boolean }) {
  const t = useT(dict);
  const c = useT(common);
  const amount = (n: number | null) => (n === null ? t.aside.notSet : money(n));
  const rows = [
    { label: t.aside.income, value: ctx.income ? money(ctx.income) : t.aside.notSet },
    { label: t.aside.expenses, value: amount(ctx.expenses) },
    {
      label: t.aside.credits,
      value: ctx.credits_count ? `${ctx.credits_count} · ${money(ctx.payments ?? 0)}${t.aside.perMonth}` : t.aside.none,
    },
    {
      label: t.aside.lastCheck,
      value: ctx.last_check ? (
        <Link to={`/result/${ctx.last_check.id}`} className={`${styles.ctxCheck} ${styles['risk_' + ctx.last_check.risk]}`}>
          <Icon name={RISK_ICON[ctx.last_check.risk]} size={14} strokeWidth={2.2} />
          {ctx.last_check.title} · {(compact ? c.risk : c.riskShort)[ctx.last_check.risk].toLowerCase()}
        </Link>
      ) : (
        '—'
      ),
    },
  ];
  return (
    <dl className={compact ? styles.ctxGrid : styles.ctxList}>
      {rows.map((r) => (
        <div key={r.label}>
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function NoAccess({ onGrant, busy }: { onGrant: () => void; busy: boolean }) {
  const t = useT(dict);
  return (
    <>
      <p className={styles.asideText}>{t.aside.noAccessText}</p>
      <Button variant="teal" size="sm" icon="sparkle" onClick={onGrant} disabled={busy} className={styles.allowBtn}>
        {t.aside.allow}
      </Button>
    </>
  );
}

function ActionLinks({ checkLabel }: { checkLabel: string }) {
  const t = useT(dict);
  return (
    <>
      {[
        { to: '/check', label: checkLabel },
        { to: '/scenarios', label: t.aside.scenarios },
        { to: '/plan', label: t.aside.plan },
      ].map((l) => (
        <Link key={l.to} to={l.to} className={styles.actionLink}>
          {l.label}
          <Icon name="chevronRight" size={16} strokeWidth={2} />
        </Link>
      ))}
    </>
  );
}

interface AsideProps {
  ctx: AiContext | undefined;
  loading: boolean;
  offline: boolean;
  onGrant: () => void;
  granting: boolean;
}

export function Aside({ ctx, loading, offline, onGrant, granting }: AsideProps) {
  const t = useT(dict);
  if (offline) {
    return (
      <aside aria-labelledby="ai-alt-title" className={`${styles.aside} ${styles.asideCard}`}>
        <h2 id="ai-alt-title" className={styles.asideTitle}>
          {t.aside.meanwhileTitle}
        </h2>
        <ActionLinks checkLabel={t.aside.checkCredit} />
        <p className={styles.asideNote}>{t.aside.notifyNote}</p>
      </aside>
    );
  }
  return (
    <aside className={styles.aside}>
      <section aria-labelledby="ai-ctx-title" className={`${styles.asideCard} ${styles.desktopOnly}`}>
        <h2 id="ai-ctx-title" className={styles.asideTitle}>
          {t.aside.contextTitle}
        </h2>
        {loading && (
          <div className={styles.skeletonStack}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={18} />
            ))}
          </div>
        )}
        {ctx &&
          (ctx.allowed ? (
            <>
              <ContextList ctx={ctx} />
              <p className={styles.asideNote}>{t.aside.contextNote}</p>
            </>
          ) : (
            <NoAccess onGrant={onGrant} busy={granting} />
          ))}
        <Link to={PROFILE_CONSENTS} className={styles.asideLink}>
          {t.manageAccess}
        </Link>
      </section>
      <section aria-labelledby="ai-act-title" className={styles.asideCard}>
        <h2 id="ai-act-title" className={styles.asideTitle}>
          {t.aside.actionsTitle}
        </h2>
        <ActionLinks checkLabel={t.aside.check} />
      </section>
    </aside>
  );
}

/** Mobile (M-AI): the context folds into a <details> above the conversation. */
export function MobileContext({ ctx, onGrant, granting }: { ctx: AiContext | undefined; onGrant: () => void; granting: boolean }) {
  const t = useT(dict);
  if (!ctx) return null;
  return (
    <details className={styles.mobileContext}>
      <summary>
        {t.aside.contextTitle}
        <Icon name="chevronDown" size={18} strokeWidth={2} className={styles.summaryIcon} />
      </summary>
      {ctx.allowed ? (
        <>
          <ContextList ctx={ctx} compact />
          <p className={styles.asideText}>
            {t.aside.mobileNote} <Link to={PROFILE_CONSENTS}>{t.manageAccess}</Link>
          </p>
        </>
      ) : (
        <div className={styles.mobileNoAccess}>
          <NoAccess onGrant={onGrant} busy={granting} />
          <Link to={PROFILE_CONSENTS} className={styles.asideLink}>
            {t.manageAccess}
          </Link>
        </div>
      )}
    </details>
  );
}
