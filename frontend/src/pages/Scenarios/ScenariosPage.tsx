import { Link, useSearchParams } from 'react-router-dom';
import { useDashboard, useScenarios } from '@/api/hooks';
import { AppPage } from '@/components/layout/AppShell';
import { Button, EmptyState, ErrorState, PageSkeleton } from '@/components/ui';
import { useLang, useT } from '@/i18n/I18nProvider';
import { dayMonthWhen } from '@/lib/format';
import { ScenariosContent } from './ScenariosContent';
import { dict } from './i18n';

/** «Сценарии»: alternatives to the checked purchase (`?check=<id>`, latest check by default). */
export default function ScenariosPage() {
  const t = useT(dict);
  const { lang } = useLang();
  const [params] = useSearchParams();
  const { data, isLoading, error, refetch } = useScenarios(params.get('check') ?? undefined);
  const { data: dashboard } = useDashboard();

  const subtitle = dashboard?.updated_at ? (
    <>
      {t.updated(dayMonthWhen(dashboard.updated_at, lang))} · <Link to="/profile?section=finance">{t.refresh}</Link>
    </>
  ) : null;

  return (
    <AppPage title={t.title} subtitle={subtitle}>
      {isLoading && <PageSkeleton />}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {data &&
        (data.check && data.scenarios ? (
          <ScenariosContent check={data.check} data={data.scenarios} />
        ) : (
          <EmptyState icon="scales" title={t.empty.title} text={t.empty.text}>
            <Button to="/check" iconRight="arrowRight">
              {t.empty.cta}
            </Button>
          </EmptyState>
        ))}
    </AppPage>
  );
}
