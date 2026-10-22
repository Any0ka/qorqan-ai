import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useConsents, useDashboard, useMe } from '@/api/hooks';
import { AppPage } from '@/components/layout/AppShell';
import { Button } from '@/components/ui';
import { useLang, useT } from '@/i18n/I18nProvider';
import { dayMonth, dayMonthWhen } from '@/lib/format';
import { ConsentsSection } from './ConsentsSection';
import { FinanceSection, SourcesSection } from './FinanceSections';
import { HelpSection, LanguageSection, NotificationsSection, PrivacySection } from './InfoSections';
import { HistorySection, PersonalSection } from './AccountSections';
import { dict, type SectionKey } from './i18n';
import styles from './Profile.module.css';

const SECTIONS: SectionKey[] = ['personal', 'finance', 'sources', 'consents', 'privacy', 'language', 'notifications', 'history', 'help'];

const VIEWS: Record<SectionKey, () => JSX.Element> = {
  personal: PersonalSection,
  finance: FinanceSection,
  sources: SourcesSection,
  consents: ConsentsSection,
  privacy: PrivacySection,
  language: LanguageSection,
  notifications: NotificationsSection,
  history: HistorySection,
  help: HelpSection,
};

/** «Профиль и настройки» with sub-sections in `?section=` (default: consents, the main design). */
export default function ProfilePage() {
  const t = useT(dict);
  const { lang } = useLang();
  const [params] = useSearchParams();
  const raw = params.get('section') as SectionKey | null;
  const section: SectionKey = raw && SECTIONS.includes(raw) ? raw : 'consents';
  const dashboard = useDashboard();
  const consents = useConsents();

  const reportRevoked = consents.data?.items.some((i) => i.type === 'credit_report' && i.status === 'revoked');
  const updated = dashboard.data?.updated_at;
  const subtitle = reportRevoked ? t.creditsIncomplete : updated ? t.updated(dayMonthWhen(updated, lang)) : null;

  // Moving between sections: send focus to the new heading (not on the first render).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById('profile-section-title')?.focus();
  }, [section]);

  const View = VIEWS[section];
  return (
    <AppPage title={t.title} subtitle={subtitle} subtitleIcon={reportRevoked ? 'triangle' : 'clock'} subtitleTone={reportRevoked ? 'warning' : 'muted'}>
      <MobileAccount />
      <div className={styles.layout}>
        <SectionNav current={section} />
        <div className={styles.content}>
          <View />
        </div>
      </div>
    </AppPage>
  );
}

function SectionNav({ current }: { current: SectionKey }) {
  const t = useT(dict);
  const activeRef = useRef<HTMLAnchorElement>(null);
  // On mobile the list scrolls sideways — keep the current section visible.
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [current]);
  return (
    <nav aria-label={t.navLabel} className={styles.nav}>
      {SECTIONS.map((key) => (
        <Link
          key={key}
          ref={key === current ? activeRef : undefined}
          to={`?section=${key}`}
          aria-current={key === current ? 'page' : undefined}
          className={styles.navItem}
        >
          {t.sections[key]}
        </Link>
      ))}
    </nav>
  );
}

/** M-Profile: account card above the sections (mobile only). */
function MobileAccount() {
  const t = useT(dict);
  const { lang } = useLang();
  const { data: me } = useMe();
  const { data: dashboard } = useDashboard();
  if (!me) return null;
  return (
    <section aria-label={t.account.label} className={styles.account}>
      <div className={styles.accountHead}>
        <span aria-hidden="true" className={styles.accountAvatar} style={{ background: me.avatar_color }}>
          {me.initials}
        </span>
        <span className={styles.accountName}>
          <b>
            {me.name}
            {me.surname ? ` ${me.surname.charAt(0)}.` : ''}
          </b>
          <span>{me.phone_masked}</span>
        </span>
      </div>
      {dashboard?.updated_at && (
        <div className={styles.accountNote}>
          <p>
            <b>{t.account.financialAsOf(dayMonth(dashboard.updated_at, lang))}</b> {t.account.financialHint}
          </p>
          <Button to="?section=finance" block>
            {t.account.update}
          </Button>
        </div>
      )}
    </section>
  );
}
