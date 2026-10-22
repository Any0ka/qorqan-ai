import type { ReactNode } from 'react';
import type { LoadZone, RiskLevel } from '@/api/types';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { Icon, type IconName } from '../Icon';
import styles from './Badge.module.css';

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'teal' | 'navy';

/** Risk is always colour + icon shape + word, never colour alone (design system rule). */
export const RISK_TONE: Record<RiskLevel, Tone> = { low: 'success', medium: 'warning', high: 'danger', insufficient: 'neutral' };
export const RISK_ICON: Record<RiskLevel, IconName> = { low: 'checkCircle', medium: 'triangle', high: 'octagon', insufficient: 'questionDashed' };
export const ZONE_TONE: Record<LoadZone, Tone> = { stable: 'success', caution: 'warning', high: 'danger' };
export const ZONE_ICON: Record<LoadZone, IconName> = { stable: 'checkCircle', caution: 'triangle', high: 'octagon' };

interface PillProps {
  tone: Tone;
  icon?: IconName;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
}

/** Rounded status pill. */
export function Pill({ tone, icon, size = 'md', children, className }: PillProps) {
  const iconSize = { xs: 12, sm: 14, md: 16, lg: 18 }[size];
  return (
    <span className={[styles.pill, styles[tone], styles[size], className].filter(Boolean).join(' ')}>
      {icon && <Icon name={icon} size={iconSize} strokeWidth={2.2} />}
      {children}
    </span>
  );
}

export function RiskBadge({ risk, size = 'md', label }: { risk: RiskLevel; size?: PillProps['size']; label?: ReactNode }) {
  const t = useT(common);
  return (
    <Pill tone={RISK_TONE[risk]} icon={RISK_ICON[risk]} size={size}>
      {label ?? t.risk[risk]}
    </Pill>
  );
}

export function ZoneBadge({ zone, size = 'md', short = false }: { zone: LoadZone; size?: PillProps['size']; short?: boolean }) {
  const t = useT(common);
  return (
    <Pill tone={ZONE_TONE[zone]} icon={ZONE_ICON[zone]} size={size}>
      {short ? t.zoneShort[zone] : t.zone[zone]}
    </Pill>
  );
}

/** Small neutral chip with the purchase parameters ("Смартфон", "840 000 ₸"…). */
export function Tag({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return <li className={`${styles.tag} ${strong ? styles.tagStrong : ''}`}>{children}</li>;
}

export function TagList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className={styles.tagList}>
      {children}
    </ul>
  );
}

/** Coloured dot used before "Активен" in tables. */
export function Dot({ tone }: { tone: Tone }) {
  return <span aria-hidden="true" className={`${styles.dot} ${styles['dot_' + tone]}`} />;
}
