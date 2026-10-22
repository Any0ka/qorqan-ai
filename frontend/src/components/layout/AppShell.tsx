import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAiStatus, useMe } from '@/api/hooks';
import { useAuth } from '@/auth/AuthProvider';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { Icon, type IconName } from '../Icon';
import { Logo, LogoMark } from '../Logo';
import { LangSwitch } from './LangSwitch';
import styles from './AppShell.module.css';

type NavKey = 'dashboard' | 'credits' | 'check' | 'scenarios' | 'plan' | 'dss' | 'ai' | 'profile';

const NAV: Array<{ key: NavKey; to: string; icon: IconName; match?: string[] }> = [
  { key: 'dashboard', to: '/dashboard', icon: 'dashboard' },
  { key: 'credits', to: '/credits', icon: 'card' },
  { key: 'check', to: '/check', icon: 'scales', match: ['/check', '/result'] },
  { key: 'scenarios', to: '/scenarios', icon: 'branches' },
  { key: 'plan', to: '/plan', icon: 'route' },
  { key: 'dss', to: '/dss', icon: 'sliders' },
  { key: 'ai', to: '/ai', icon: 'aiChat' },
  { key: 'profile', to: '/profile', icon: 'user' },
];

const MOBILE_NAV: NavKey[] = ['dashboard', 'credits', 'check', 'ai', 'profile'];

function useIsActive() {
  const { pathname } = useLocation();
  return (item: (typeof NAV)[number]) => (item.match ?? [item.to]).some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/** Layout for every signed-in screen: sidebar (desktop) · rail (tablet) · top bar + bottom nav (mobile). */
export function AppShell() {
  const t = useT(common);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const isActive = useIsActive();
  const { pathname } = useLocation();
  const aiDown = useAiStatus().data?.available === false;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const logout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        {t.skipToContent}
      </a>

      {/* Desktop sidebar + tablet rail share one element; CSS switches the layout. */}
      <aside className={styles.sidebar}>
        <Logo to="/dashboard" label={t.brandOverview} />
        <Link to="/dashboard" aria-label={t.brandOverview} className={styles.railLogo}>
          <LogoMark size={32} />
        </Link>
        <nav aria-label={t.nav.label} className={styles.nav}>
          {NAV.map((item) => (
            <NavLink key={item.key} to={item.to} aria-current={isActive(item) ? 'page' : undefined} className={styles.navItem}>
              <span className={styles.navIcon}>
                <Icon name={item.icon} size={20} className={item.key === 'ai' ? styles.aiIcon : undefined} />
              </span>
              <span className={styles.navLabel}>{t.nav[item.key]}</span>
              <span className={styles.navShort}>{t.nav.short[item.key]}</span>
              {item.key === 'ai' && aiDown && <span role="img" aria-label={t.aiUnavailable} className={styles.navDot} />}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sideFooter}>
          <Link to="/profile?section=help" className={styles.navItem} aria-label={t.nav.help}>
            <span className={styles.navIcon}>
              <Icon name="help" size={20} />
            </span>
            <span className={styles.navLabel}>{t.nav.help}</span>
          </Link>
          <button type="button" className={styles.navItem} onClick={logout} aria-label={t.nav.logout}>
            <span className={styles.navIcon}>
              <Icon name="logout" size={20} />
            </span>
            <span className={styles.navLabel}>{t.nav.logout}</span>
          </button>
        </div>
      </aside>

      <div className={styles.column}>
        <MobileTopBar />
        <Outlet />
      </div>

      <nav aria-label={t.nav.mobileLabel} className={styles.bottomNav}>
        {MOBILE_NAV.map((key) => {
          const item = NAV.find((n) => n.key === key)!;
          const active = isActive(item);
          return (
            <NavLink key={key} to={item.to} aria-current={active ? 'page' : undefined} className={`${styles.bottomItem} ${key === 'check' ? styles.bottomCheck : ''}`}>
              <span className={styles.bottomIcon}>
                <Icon name={item.icon} size={key === 'check' ? 20 : 22} />
              </span>
              {t.nav.short[key]}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

function NotificationsLink({ plain = false }: { plain?: boolean }) {
  const t = useT(common);
  const { data: me } = useMe();
  const unread = me?.unread_notifications ?? 0;
  return (
    <Link to="/notifications" aria-label={unread ? t.notificationsNew(unread) : t.notifications} className={`${styles.bell} ${plain ? styles.bellPlain : ''}`}>
      <Icon name="bell" size={20} />
      {unread > 0 && <span className={styles.bellDot} />}
    </Link>
  );
}

function UserChip() {
  const { data: me } = useMe();
  return (
    <Link to="/profile" className={styles.userChip}>
      <span aria-hidden="true" className={styles.avatar} style={{ background: me?.avatar_color ?? '#14263D' }}>
        {me?.initials ?? ''}
      </span>
      <span className={styles.userName}>{me?.name ?? '…'}</span>
    </Link>
  );
}

function MobileTopBar() {
  const t = useT(common);
  const { data: me } = useMe();
  return (
    <header className={styles.mobileBar}>
      <Logo to="/dashboard" label={t.brandOverview} size="sm" />
      <span className={styles.mobileActions}>
        <LangSwitch compact />
        <NotificationsLink plain />
        <Link to="/profile" aria-label={t.nav.profile} className={styles.mobileAvatar}>
          <span className={styles.avatar} style={{ background: me?.avatar_color ?? '#14263D' }} aria-hidden="true">
            {me?.initials ?? ''}
          </span>
        </Link>
      </span>
    </header>
  );
}

interface AppPageProps {
  title: ReactNode;
  subtitle?: ReactNode;
  subtitleIcon?: IconName;
  subtitleTone?: 'muted' | 'warning';
  /** Extra controls placed before the global header controls. */
  headerExtra?: ReactNode;
  /** Content max width (default 1200). */
  maxWidth?: number;
  children: ReactNode;
  /** Render children without the padded <main> wrapper (screens with their own split layout). */
  bare?: boolean;
}

/** Page frame inside AppShell: header bar with the title + global controls, then the content. */
export function AppPage({ title, subtitle, subtitleIcon = 'clock', subtitleTone = 'muted', headerExtra, maxWidth, children, bare }: AppPageProps) {
  useEffect(() => {
    if (typeof title === 'string') document.title = `${title} · qorgan`;
  }, [title]);
  return (
    <>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.pageTitle}>{title}</h1>
          {subtitle && (
            <p className={`${styles.pageSubtitle} ${subtitleTone === 'warning' ? styles.subtitleWarning : ''}`}>
              <Icon name={subtitleIcon} size={16} />
              <span>{subtitle}</span>
            </p>
          )}
        </div>
        <div className={styles.headerControls}>
          {headerExtra}
          <span className={styles.desktopOnly}>
            <LangSwitch />
          </span>
          <span className={styles.desktopOnly}>
            <NotificationsLink />
          </span>
          <span className={styles.desktopOnly}>
            <UserChip />
          </span>
        </div>
      </header>
      {bare ? (
        <div id="main" className={styles.bare}>
          {children}
        </div>
      ) : (
        <main id="main" className={styles.main} style={maxWidth ? { maxWidth } : undefined}>
          {children}
        </main>
      )}
    </>
  );
}
