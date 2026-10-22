import { Link } from 'react-router-dom';
import { useDashboard } from '@/api/hooks';
import { AppPage } from '@/components/layout/AppShell';
import { ErrorState, PageSkeleton } from '@/components/ui';
import { useLang, useT } from '@/i18n/I18nProvider';
import { dayMonthWhen } from '@/lib/format';
import { DashboardComplete } from './DashboardComplete';
import { DashboardNew, DashboardPartial } from './DashboardIncomplete';
import { dict } from './i18n';

/** «Обзор». Three states from the API: new account · partially filled profile · complete. */
export default function DashboardPage() {
  const t = useT(dict);
  const { lang } = useLang();
  const { data, isLoading, error, refetch } = useDashboard();

  let subtitle: React.ReactNode = null;
  let subtitleIcon: 'clock' | 'circleDashed' = 'clock';
  if (data?.state === 'new') {
    subtitle = t.noData;
    subtitleIcon = 'circleDashed';
  } else if (data?.state === 'partial' && data.updated_at) {
    subtitle = t.partialSubtitle(dayMonthWhen(data.updated_at, lang));
  } else if (data?.updated_at) {
    const sources = [data.sources.credits_from_report && t.sourcesReport, data.sources.incomes_manual && t.sourcesManual].filter(Boolean);
    subtitle = (
      <>
        {[t.updated(dayMonthWhen(data.updated_at, lang)), ...sources].join(' · ')} · <Link to="/profile?section=finance">{t.refresh}</Link>
      </>
    );
  }

  return (
    <AppPage title={t.title} subtitle={subtitle} subtitleIcon={subtitleIcon}>
      {isLoading && <PageSkeleton />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data?.state === 'new' && <DashboardNew />}
      {data?.state === 'partial' && <DashboardPartial data={data} />}
      {data?.state === 'complete' && <DashboardComplete data={data} />}
    </AppPage>
  );
}
