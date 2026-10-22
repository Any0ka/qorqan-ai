import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { useCheck, useFinancial } from '@/api/hooks';
import { AppPage } from '@/components/layout/AppShell';
import { Button, Disclaimer, EmptyState, ErrorState, PageSkeleton } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { AssessedResult } from './Assessed';
import { dict } from './i18n';
import { NoDataResult } from './NoData';
import { dataDate, PurchaseBar } from './Parts';
import styles from './Result.module.css';

/** «Результат оценки» (/result/:id): high · medium · low · insufficient data. */
export default function ResultPage() {
  const t = useT(dict);
  const { id } = useParams();
  const { data: a, isLoading, error, refetch } = useCheck(id);
  const { data: financial } = useFinancial();
  const notFound = error instanceof ApiError && error.status === 404;
  const noData = a?.risk === 'insufficient';

  let subtitle: React.ReactNode;
  if (a && noData && financial) subtitle = t.profilePercent(financial.completeness.percent);
  else if (a)
    subtitle = (
      <>
        {t.calculated(a.created_at, dataDate(a))} · <Link to="/profile?section=finance">{t.refresh}</Link>
      </>
    );

  return (
    <AppPage title={t.title} subtitle={subtitle} subtitleIcon={noData && financial ? 'triangle' : 'clock'} subtitleTone={noData && financial ? 'warning' : 'muted'}>
      {isLoading && <PageSkeleton />}
      {notFound && (
        <div className={styles.notFound}>
          <EmptyState icon="search" title={t.notFound.title} text={t.notFound.text}>
            <Button to="/check" iconRight="arrowRight">
              {t.notFound.cta}
            </Button>
          </EmptyState>
        </div>
      )}
      {error && !notFound && <ErrorState error={error} onRetry={() => refetch()} />}
      {a && (
        <>
          <PurchaseBar a={a} />
          {noData ? <NoDataResult a={a} financial={financial} /> : <AssessedResult a={a} />}
          <Disclaimer />
        </>
      )}
    </AppPage>
  );
}
