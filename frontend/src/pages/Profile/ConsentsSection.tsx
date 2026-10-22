import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { download } from '@/api/client';
import { useConsentImpact, useConsents, useCredits, useDeleteAccount, useGrantConsent, useRevokeConsent } from '@/api/hooks';
import type { Consent, ConsentEvent, ConsentType, RevokeResponse } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Icon, type IconName } from '@/components/Icon';
import { Button, ConfirmDialog, Dialog, ErrorState, Skeleton, Switch, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useLang, useT } from '@/i18n/I18nProvider';
import { dayMonth, numericDate } from '@/lib/format';
import { SectionHead } from './SectionHead';
import { dict } from './i18n';
import styles from './Profile.module.css';

type Revocable = 'credit_report' | 'ai_analysis';

const ICONS: Record<ConsentType, IconName> = {
  personal_data: 'user',
  credit_report: 'fileText',
  ai_analysis: 'sparkle',
  auto_update: 'refresh',
  marketing_email: 'mail',
  terms: 'file',
};

const actionId = (type: ConsentType) => `consent-${type}-action`;

/** «Согласия и разрешения» — Profile.dc.html, Consent-Revoked.dc.html, System-States (confirm dialog). */
export function ConsentsSection() {
  const t = useT(dict);
  const c = useT(common);
  const toast = useToast();
  const { data, isLoading, error, refetch } = useConsents();
  const revoke = useRevokeConsent();
  const grant = useGrantConsent();
  const [confirm, setConfirm] = useState<Revocable | null>(null);
  const impact = useConsentImpact(confirm === 'credit_report' ? 'credit_report' : null);
  const [summary, setSummary] = useState<RevokeResponse['summary'] | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  /** Element to focus after an action replaced the button that had focus. */
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  useEffect(() => {
    const el = focusTarget ? document.getElementById(focusTarget) : null;
    if (!el) return;
    el.focus();
    setFocusTarget(null);
  }, [focusTarget, data]);

  const report = data?.items.find((i) => i.type === 'credit_report');

  const doRevoke = () => {
    if (!confirm) return;
    const type = confirm;
    revoke.mutate(type, {
      onSuccess: (r) => {
        setConfirm(null);
        if (type === 'credit_report') {
          setSummary(r.summary);
          setFocusTarget('consent-changed');
          toast({ tone: 'success', text: t.toasts.reportRevoked });
        } else {
          setFocusTarget(actionId(type));
          toast({ tone: 'success', text: t.toasts.aiRevoked });
        }
      },
      onError: () => toast({ tone: 'error', text: c.saveFailed }),
    });
  };

  const doGrant = (type: ConsentType) =>
    grant.mutate(type, {
      onSuccess: () => {
        if (type === 'credit_report') {
          setSummary(null);
          toast({ tone: 'success', text: t.toasts.reportGranted, action: { label: t.toasts.upload, to: '/onboarding?step=3' } });
        } else {
          toast({ tone: 'success', text: type === 'marketing_email' ? t.toasts.marketingOn : t.toasts.granted });
        }
        if (type !== 'marketing_email') setFocusTarget(actionId(type));
      },
      onError: () => toast({ tone: 'error', text: c.saveFailed }),
    });

  const toggleMarketing = (on: boolean) => {
    if (on) doGrant('marketing_email');
    else
      revoke.mutate('marketing_email', {
        onSuccess: () => toast({ tone: 'success', text: t.toasts.marketingOff }),
        onError: () => toast({ tone: 'error', text: c.saveFailed }),
      });
  };

  const reportCount = impact.data?.credits_to_delete ?? report?.details?.credits_from_report;
  const confirmText =
    confirm === 'credit_report'
      ? reportCount === undefined
        ? t.revokeReport.loading
        : t.revokeReport.text(reportCount)
      : t.revokeAi.text;

  return (
    <>
      <SectionHead title={t.sections.consents} intro={t.consents.intro} />

      {summary && <ChangedStatus summary={summary} onGrant={() => doGrant('credit_report')} granting={grant.isPending} />}

      {isLoading && (
        <div className={styles.stack}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={104} radius={18} />
          ))}
        </div>
      )}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && (
        <ul className={styles.consents}>
          {data.items.map((item) => (
            <ConsentItem
              key={item.type}
              consent={item}
              busy={grant.isPending || revoke.isPending}
              onRevoke={(type) => setConfirm(type)}
              onGrant={doGrant}
              onToggle={toggleMarketing}
              onShowText={() => setTextOpen(true)}
            />
          ))}
        </ul>
      )}

      <div className={styles.row}>
        {data && <ConsentHistory events={data.history} highlightFirst={!!summary} />}
        <YourData />
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={doRevoke}
        busy={revoke.isPending}
        title={confirm === 'credit_report' ? t.revokeReport.title : t.revokeAi.title}
        text={confirmText}
        cancelLabel={confirm === 'credit_report' ? t.revokeReport.keep : t.revokeAi.keep}
        confirmLabel={confirm === 'credit_report' ? t.revokeReport.confirm : t.revokeAi.confirm}
      />

      <Dialog
        open={textOpen}
        onClose={() => setTextOpen(false)}
        title={t.consentDialog.title}
        footer={<Button onClick={() => setTextOpen(false)}>{t.consentDialog.close}</Button>}
      >
        <div className={styles.dialogText}>
          {t.consentDialog.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </Dialog>
    </>
  );
}

function StatusLine({ consent }: { consent: Consent }) {
  const t = useT(dict);
  if (consent.status === 'active' && consent.since) {
    return (
      <p className={styles.statusOn}>
        <Icon name="checkCircle" size={14} strokeWidth={2.4} />
        {t.consents.since(consent.since)}
      </p>
    );
  }
  if (consent.revoked_at) {
    return (
      <p className={styles.statusOff}>
        <Icon name="minusCircle" size={14} strokeWidth={2.2} />
        {t.consents.revokedAt(consent.revoked_at)}
      </p>
    );
  }
  return <p className={styles.statusMuted}>{consent.status === 'not_connected' ? t.consents.notConnected : t.consents.off}</p>;
}

function ConsentItem({
  consent,
  busy,
  onRevoke,
  onGrant,
  onToggle,
  onShowText,
}: {
  consent: Consent;
  busy: boolean;
  onRevoke: (type: Revocable) => void;
  onGrant: (type: ConsentType) => void;
  onToggle: (on: boolean) => void;
  onShowText: () => void;
}) {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  const { type, status } = consent;
  const active = status === 'active';
  const name = t.consents.names[type];
  const titleId = `consent-${type}-title`;

  let desc: string = t.consents.desc[type];
  if (type === 'credit_report') {
    const d = consent.details;
    if (status === 'revoked') desc = t.consents.creditReportRevoked;
    else if (active && d && d.credits_from_report > 0 && d.report_date) desc = t.consents.creditReportWith(c.obligations(d.credits_from_report), dayMonth(d.report_date, lang));
  }

  let actions: ReactNode = null;
  if (consent.required) {
    actions = (
      <div className={styles.consentAside}>
        <button type="button" className={styles.textLink} onClick={onShowText} aria-describedby={titleId}>
          {t.consents.consentText}
        </button>
        <span>{t.consents.revokeWithAccount}</span>
      </div>
    );
  } else if (type === 'marketing_email') {
    actions = (
      <div className={styles.consentSwitch}>
        <Switch
          label={<span className="visually-hidden">{name}</span>}
          stateLabel={active ? t.consents.on : t.consents.off}
          checked={active}
          onChange={onToggle}
          disabled={busy}
        />
      </div>
    );
  } else if (type === 'credit_report' || type === 'ai_analysis') {
    actions = active ? (
      <button id={actionId(type)} type="button" className={styles.revokeBtn} onClick={() => onRevoke(type)} aria-describedby={titleId}>
        {t.consents.revoke}
      </button>
    ) : type === 'credit_report' ? (
      // A new consent comes with a new report upload.
      <Link id={actionId(type)} to="/onboarding?step=3" className={styles.grantBtn} aria-describedby={titleId}>
        {t.consents.grant}
      </Link>
    ) : (
      <button id={actionId(type)} type="button" className={styles.grantBtn} onClick={() => onGrant(type)} disabled={busy} aria-describedby={titleId}>
        {t.consents.grant}
      </button>
    );
  }

  const tone = status === 'not_connected' ? styles.consentDashed : !active && type === 'credit_report' ? styles.consentMuted : '';
  return (
    <li className={`${styles.consent} ${tone}`}>
      <span aria-hidden="true" className={`${styles.consentIcon} ${type === 'ai_analysis' ? styles.consentIconTeal : ''}`}>
        <Icon name={ICONS[type]} size={20} />
      </span>
      <div className={styles.consentBody}>
        <div className={styles.consentHead}>
          <h3 id={titleId} className={styles.consentTitle}>
            {name}
          </h3>
          {consent.required && <span className={styles.requiredBadge}>{t.consents.required}</span>}
        </div>
        <p className={styles.consentDesc}>{desc}</p>
        {type !== 'marketing_email' && <StatusLine consent={consent} />}
      </div>
      {actions}
    </li>
  );
}

/** Consent-Revoked: what changed after revoking the credit-report consent. */
function ChangedStatus({ summary, onGrant, granting }: { summary: RevokeResponse['summary']; onGrant: () => void; granting: boolean }) {
  const t = useT(dict);
  const { data: credits } = useCredits();
  const left = summary.remaining_manual ?? credits?.items.length ?? 0;
  const types = new Set(credits?.items.map((i) => i.type));
  const type = types.size === 1 ? [...types][0] : null;
  return (
    <section id="consent-changed" tabIndex={-1} role="status" aria-labelledby="consent-changed-title" className={styles.changed}>
      <div className={styles.changedHead}>
        <span aria-hidden="true" className={styles.changedIcon}>
          <Icon name="triangle" size={20} />
        </span>
        <div className={styles.changedBody}>
          <h3 id="consent-changed-title" className={styles.changedTitle}>
            {t.changed.title}
          </h3>
          <ul className={styles.changedList}>
            <li>{t.changed.deleted(summary.deleted_credits ?? 0)}</li>
            <li>{t.changed.left(left, type)}</li>
            <li>{t.changed.incomplete}</li>
          </ul>
        </div>
      </div>
      <div className={styles.changedActions}>
        <Button to="/onboarding?step=3&method=manual">{t.changed.addManual}</Button>
        <Button variant="secondary" onClick={onGrant} disabled={granting}>
          {t.changed.grantAgain}
        </Button>
      </div>
    </section>
  );
}

function ConsentHistory({ events, highlightFirst }: { events: ConsentEvent[]; highlightFirst: boolean }) {
  const t = useT(dict);
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section aria-labelledby="consent-history-title" className={`${styles.panel} ${styles.panelWide}`}>
      <h3 id="consent-history-title" className={styles.panelTitle}>
        {t.history.title}
      </h3>
      {sorted.length === 0 ? (
        <p className={styles.muted}>{t.history.empty}</p>
      ) : (
        <table className={styles.historyTable}>
          <thead>
            <tr>
              <th scope="col">{t.history.date}</th>
              <th scope="col">{t.history.consent}</th>
              <th scope="col">{t.history.action}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => (
              <tr key={`${e.type}-${e.at}-${i}`} className={highlightFirst && i === 0 ? styles.rowStrong : undefined}>
                <td className={styles.nowrap}>{numericDate(e.at)}</td>
                <td>{t.consents.short[e.type]}</td>
                <td>{e.action === 'granted' ? t.history.granted : t.history.revoked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function YourData() {
  const t = useT(dict);
  const toast = useToast();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const del = useDeleteAccount();
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const exportData = async () => {
    setDownloading(true);
    try {
      await download('/me/export', 'qorgan-my-data.json');
    } catch {
      toast({ tone: 'error', text: t.data.downloadFailed });
    } finally {
      setDownloading(false);
    }
  };

  const remove = () =>
    del.mutate(undefined, {
      onSuccess: async () => {
        setConfirmDelete(false);
        await signOut();
        navigate('/', { replace: true });
      },
      onError: () => toast({ tone: 'error', text: t.data.deleteFailed }),
    });

  const logout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <section aria-labelledby="your-data-title" className={styles.panel}>
      <h3 id="your-data-title" className={styles.panelTitle}>
        {t.data.title}
      </h3>
      <Button variant="secondary" icon="download" onClick={exportData} disabled={downloading} className={styles.dataBtn}>
        {t.data.download}
      </Button>
      <button type="button" className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>
        <Icon name="trash" size={18} />
        {t.data.delete}
      </button>
      <button type="button" className={`${styles.logoutBtn} ${styles.mobileOnly}`} onClick={logout}>
        <Icon name="logout" size={18} />
        {t.data.logout}
      </button>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        busy={del.isPending}
        title={t.data.deleteTitle}
        text={t.data.deleteText}
        cancelLabel={t.data.deleteKeep}
        confirmLabel={t.data.deleteConfirm}
      />
    </section>
  );
}
