import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCredit, useCredits, type CreditsQuery } from '@/api/hooks';
import type { Credit, CreditsResponse } from '@/api/types';
import { AppPage } from '@/components/layout/AppShell';
import type { IconName } from '@/components/Icon';
import { ErrorState, PageSkeleton } from '@/components/ui';
import { common } from '@/i18n/common';
import { useLang, useT } from '@/i18n/I18nProvider';
import { CreditAlerts, OverdueFootnote } from './CreditAlerts';
import { CreditDetail } from './CreditDetail';
import { CreditFormDialog } from './CreditForm';
import { CreditList, type Sort } from './CreditList';
import { CreditsEmpty } from './CreditsEmpty';
import { SummaryTiles } from './SummaryTiles';
import { dateIn, daysAgo, inGroup, useDebounced, useMediaQuery, useStableCallback } from './helpers';
import { dict, type FilterGroup } from './i18n';
import styles from './Credits.module.css';

/** «Мои кредиты». URL params: `id` — credit in the detail panel, `edit` — credit in the edit dialog, `add=1` — add dialog. */
export default function CreditsPage() {
  const t = useT(dict);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('next_payment');
  const [group, setGroup] = useState<FilterGroup>('all');
  const [dismissed, setDismissed] = useState(false);
  const q = useDebounced(search.trim());
  // Side-by-side list + panel fits from here; below it the panel goes under the list.
  const wide = useMediaQuery('(min-width: 1320px)');

  const all = useCredits();
  const query: CreditsQuery = { ...(q ? { q } : {}), ...(sort !== 'next_payment' ? { sort } : {}) };
  const list = useCredits(query);

  const selectedId = params.get('id');
  const editId = params.get('edit');
  const adding = params.get('add') === '1';
  const items = all.data?.items ?? [];
  const known = (id: string | null) => !!id && items.some((c) => c.id === id);
  const fallback = useCredit(all.data && selectedId && !known(selectedId) ? selectedId : null);
  const find = (id: string | null): Credit | undefined =>
    id ? items.find((c) => c.id === id) ?? (fallback.data?.id === id ? fallback.data : undefined) : undefined;

  const rows = useMemo(() => (list.data ?? all.data)?.items.filter((c) => inGroup(c, group)) ?? [], [list.data, all.data, group]);
  const selected = selectedId ? find(selectedId) : wide && !dismissed ? rows[0] : undefined;
  const editing = find(editId);

  const update = (fn: (p: URLSearchParams) => void, replace = false) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        fn(p);
        return p;
      },
      { replace },
    );
  const hrefFor = (id: string) => {
    const p = new URLSearchParams(params);
    p.set('id', id);
    p.delete('edit');
    p.delete('add');
    return `/credits?${p}`;
  };
  const select = (id: string) => update((p) => p.set('id', id));
  const openEdit = (id: string) =>
    update((p) => {
      p.set('edit', id);
      p.delete('add');
    });
  const openAdd = () =>
    update((p) => {
      p.set('add', '1');
      p.delete('edit');
    });
  const closeDialog = useStableCallback(() =>
    update((p) => {
      p.delete('edit');
      p.delete('add');
    }, true),
  );
  const closeDetail = () => {
    setDismissed(true);
    update((p) => p.delete('id'), true);
  };
  const afterRemove = () =>
    update((p) => {
      p.delete('id');
      p.delete('edit');
    }, true);
  const afterAdd = (id: string) =>
    update((p) => {
      p.delete('add');
      p.set('id', id);
    }, true);

  const { subtitle, icon, tone } = useSubtitle(all.data);

  const dialog = (
    <CreditFormDialog
      open={adding || !!editing}
      credit={adding ? undefined : editing}
      report={all.data?.report ?? null}
      initialOrg={search.trim()}
      onClose={closeDialog}
      onDeleted={afterRemove}
      onAdded={afterAdd}
    />
  );

  return (
    <AppPage title={t.title} subtitle={subtitle} subtitleIcon={icon} subtitleTone={tone}>
      {all.isLoading && <PageSkeleton />}
      {all.error && !all.data && <ErrorState title={t.loadError} error={all.error} onRetry={() => all.refetch()} />}
      {all.data && items.length === 0 && <CreditsEmpty summary={all.data.summary} onAdd={openAdd} />}
      {all.data && items.length > 0 && (
        <>
          <SummaryTiles summary={all.data.summary} />
          <CreditAlerts items={items} report={all.data.report} onEdit={openEdit} />
          <div className={styles.split}>
            <CreditList
              rows={rows}
              summary={all.data.summary}
              showFresh={items.some((c) => c.stale)}
              search={search}
              onSearch={setSearch}
              query={q}
              sort={sort}
              onSort={setSort}
              group={group}
              onGroup={setGroup}
              selectedId={selected?.id ?? null}
              hrefFor={hrefFor}
              onSelect={select}
              onAdd={openAdd}
              fetching={list.isFetching && list.isPlaceholderData}
              error={list.error && !list.data ? list.error : null}
              onRetry={() => list.refetch()}
            />
            {selected && (
              <CreditDetail
                key={selected.id}
                credit={selected}
                report={all.data.report}
                scrollIntoView={!wide}
                onClose={closeDetail}
                onEdit={() => openEdit(selected.id)}
                onClosed={afterRemove}
              />
            )}
          </div>
          {items.some((c) => c.status === 'overdue') && <OverdueFootnote />}
        </>
      )}
      {all.data && dialog}
    </AppPage>
  );
}

function useSubtitle(data: CreditsResponse | undefined): { subtitle: React.ReactNode; icon: IconName; tone: 'muted' | 'warning' } {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  if (!data) return { subtitle: null, icon: 'clock', tone: 'muted' };
  const { items, report } = data;
  const reportDate = report ? dateIn(report.uploaded_at, lang, 'attr') : null;
  if (items.length === 0) {
    return { subtitle: reportDate ? `${t.subtitle.report(reportDate)} · ${t.subtitle.noneFound}` : t.subtitle.empty, icon: reportDate ? 'clock' : 'circleDashed', tone: 'muted' };
  }
  const stale = items.filter((x) => x.stale);
  if (stale.length) {
    const fromReport = report && stale.some((x) => x.source === 'report');
    const oldest = stale.map((x) => x.data_as_of).sort()[0];
    return {
      subtitle: fromReport
        ? t.subtitle.reportAgo(reportDate!, c.daysAgo(daysAgo(report.uploaded_at)))
        : t.subtitle.dataAgo(dateIn(oldest, lang, 'attr'), c.daysAgo(daysAgo(oldest))),
      icon: 'triangle',
      tone: 'warning',
    };
  }
  const manual = items.filter((x) => x.source === 'manual').length;
  const parts = reportDate ? [t.subtitle.report(reportDate), ...(manual ? [t.subtitle.manual(manual)] : [])] : [t.subtitle.manualOnly];
  return {
    subtitle: (
      <>
        {parts.join(' · ')} · <Link to="/onboarding?step=3">{reportDate ? t.subtitle.upload : t.subtitle.uploadFirst}</Link>
      </>
    ),
    icon: 'clock',
    tone: 'muted',
  };
}
