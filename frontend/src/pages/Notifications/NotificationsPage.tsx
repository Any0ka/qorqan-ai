import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useCredits, useDashboard, useMarkNotificationRead, useMarkPaid, useNotifications, useReadAllNotifications } from '@/api/hooks';
import type { AppNotification } from '@/api/types';
import { AppPage } from '@/components/layout/AppShell';
import { Icon } from '@/components/Icon';
import { Button, EmptyState, ErrorState, Skeleton, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useLang, useT } from '@/i18n/I18nProvider';
import { dayMonth, daysBetween, fullDate, monthName, time, toDate } from '@/lib/format';
import { NotificationSettingsPanel } from './SettingsPanel';
import { renderNotification, visual } from './render';
import { dict, type Tab } from './i18n';
import styles from './Notifications.module.css';

const TABS: Tab[] = ['all', 'payment', 'load', 'data', 'goal', 'recommendation'];
type Group = 'today' | 'week' | 'earlier';

const age = (n: AppNotification) => daysBetween(toDate(n.created_at), new Date());

/** «Уведомления»: feed by category with read state, plus delivery settings. */
export default function NotificationsPage() {
  const t = useT(dict);
  const { lang } = useLang();
  const [tab, setTab] = useState<Tab>('all');
  const feed = useNotifications(tab === 'all' ? undefined : tab);
  const readAll = useReadAllNotifications();
  const dashboard = useDashboard();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const unread = feed.data?.unread ?? 0;
  const updated = dashboard.data?.updated_at;
  const updatedText = updated
    ? t.updated(lang === 'kk' ? `${toDate(updated).getDate()} ${monthName(updated, 'kk', 'prep')}` : dayMonth(updated, lang))
    : null;
  const subtitle = feed.data ? [unread ? t.unreadCount(unread) : t.noUnread, updatedText].filter(Boolean).join(' · ') : null;

  const groups = useMemo(() => {
    const items = [...(feed.data?.items ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const by: Record<Group, AppNotification[]> = { today: [], week: [], earlier: [] };
    for (const n of items) by[age(n) <= 0 ? 'today' : age(n) < 7 ? 'week' : 'earlier'].push(n);
    return (['today', 'week', 'earlier'] as Group[]).filter((g) => by[g].length).map((g) => ({ key: g, items: by[g] }));
  }, [feed.data]);

  const onTabKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const j = (next + TABS.length) % TABS.length;
    setTab(TABS[j]);
    tabRefs.current[j]?.focus();
  };

  const tabLabel = (k: Tab) => (k === 'all' && feed.data ? `${t.tabs.all} · ${feed.data.total}` : t.tabs[k]);

  return (
    <AppPage
      title={t.title}
      subtitle={subtitle}
      headerExtra={
        unread > 0 && (
          <Button variant="secondary" icon="checkDouble" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
            {t.readAll}
          </Button>
        )
      }
    >
      <div className={styles.layout}>
        <section aria-label={t.listLabel} className={styles.feed}>
          <div role="tablist" aria-label={t.tabsLabel} className={styles.tabs}>
            {TABS.map((k, i) => (
              <button
                key={k}
                ref={(el) => (tabRefs.current[i] = el)}
                id={`ntab-${k}`}
                type="button"
                role="tab"
                aria-selected={tab === k}
                aria-controls="npanel"
                tabIndex={tab === k ? 0 : -1}
                className={styles.tab}
                onClick={() => setTab(k)}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                {tabLabel(k)}
              </button>
            ))}
          </div>

          <div role="tabpanel" id="npanel" aria-labelledby={`ntab-${tab}`} className={`${styles.panel} ${feed.isPlaceholderData ? styles.refreshing : ''}`}>
            {feed.isLoading && <FeedSkeleton />}
            {feed.error && !feed.data && <ErrorState title={t.loadError} error={feed.error} onRetry={() => feed.refetch()} />}
            {feed.data && groups.length === 0 && (
              <EmptyState icon="bell" title={tab === 'all' ? t.emptyAll : t.emptyCategory} text={tab === 'all' ? t.emptyAllText : t.emptyCategoryText}>
                {tab === 'all' ? (
                  <Button variant="secondary" size="sm" to="/dashboard">
                    {t.emptyAllCta}
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setTab('all')}>
                    {t.showAll}
                  </Button>
                )}
              </EmptyState>
            )}
            {groups.map((g) => (
              <section key={g.key} aria-labelledby={`ngroup-${g.key}`} className={styles.group}>
                <h2 id={`ngroup-${g.key}`} className={styles.groupTitle}>
                  {t.groups[g.key]}
                </h2>
                <ul className={styles.list}>
                  {g.items.map((n) => (
                    <NotificationItem key={n.id} n={n} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <NotificationSettingsPanel />
      </div>
    </AppPage>
  );
}

function FeedSkeleton() {
  const c = useT(common);
  return (
    <div aria-busy="true" aria-label={c.loading} className={styles.list}>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} height={112} radius={18} />
      ))}
    </div>
  );
}

function NotificationItem({ n }: { n: AppNotification }) {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  const toast = useToast();
  const markRead = useMarkNotificationRead();
  const markPaid = useMarkPaid();
  const credits = useCredits();
  const { title, body } = renderNotification(n, t, c, lang);
  const { icon, tone } = visual(n);
  const read = () => !n.read && markRead.mutate(n.id);

  const d = toDate(n.created_at);
  const days = age(n);
  const when = days <= 0 ? time(n.created_at) : d.getFullYear() === new Date().getFullYear() ? dayMonth(n.created_at, lang) : fullDate(n.created_at, lang);

  const paidState = (creditId: string) => {
    const credit = credits.data?.items.find((x) => x.id === creditId);
    if (!credits.data) return false;
    // Already marked: the credit moved on to its next payment (or is closed).
    return !credit || (!!credit.next_payment_date && typeof n.params.date === 'string' && credit.next_payment_date > n.params.date);
  };

  const pay = (creditId: string) =>
    markPaid.mutate(creditId, {
      onSuccess: () => {
        read();
        toast({ tone: 'success', text: t.paidToast(String(n.params.organization ?? '')) });
      },
      onError: () => toast({ tone: 'error', text: c.saveFailed }),
    });

  const actions = n.actions.filter((a) => a.code === 'mark_paid' || a.to.startsWith('/'));

  return (
    <li className={styles.item}>
      <span aria-hidden="true" className={`${styles.tile} ${styles['tile_' + tone]}`}>
        <Icon name={icon} size={20} />
      </span>
      <div className={styles.body}>
        <div className={styles.head}>
          <h3 className={`${styles.title} ${n.read ? '' : styles.titleUnread}`}>
            {!n.read && <span role="img" aria-label={t.unread} className={styles.dot} />}
            {title}
          </h3>
          <time dateTime={n.created_at} className={styles.time}>
            {when}
          </time>
        </div>
        {body && <p className={styles.text}>{body}</p>}
        {(actions.length > 0 || !n.read) && (
          <div className={styles.actions}>
            {actions.map((a) => {
              if (a.code === 'mark_paid') {
                const creditId = a.to.startsWith('credit:') ? a.to.slice('credit:'.length) : String(n.params.credit_id ?? '');
                if (!creditId) return null;
                return paidState(creditId) ? (
                  <span key={a.code} className={styles.done}>
                    <Icon name="checkCircle" size={18} />
                    {t.paidDone}
                  </span>
                ) : (
                  <Button key={a.code} variant="secondary" size="sm" className={styles.action} onClick={() => pay(creditId)} disabled={markPaid.isPending}>
                    {t.actions.mark_paid}
                  </Button>
                );
              }
              return (
                <Button
                  key={a.code + a.to}
                  to={a.to}
                  size="sm"
                  variant={a.code === 'open_credit' ? 'primary' : 'secondary'}
                  className={styles.action}
                  onClick={read}
                >
                  {t.actions[a.code] ?? t.actions.other}
                </Button>
              );
            })}
            {actions.length === 0 && !n.read && (
              <Button variant="link" size="sm" icon="check" onClick={read} disabled={markRead.isPending}>
                {t.markRead}
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
