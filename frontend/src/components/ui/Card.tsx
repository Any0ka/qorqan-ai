import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

export type CardTone = 'default' | 'navy' | 'teal' | 'muted' | 'navyTint' | 'dashed' | 'warningDashed' | 'warning' | 'danger' | 'success';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  tone?: CardTone;
  /** 'sm' 20px · 'md' 24–28px (default) · 'lg' 32–36px */
  pad?: 'sm' | 'md' | 'lg';
  radius?: 'card' | 'section' | 'hero';
  /** flex basis shorthand used throughout the design: `grow basis` e.g. "2 560px". */
  flex?: string;
  gap?: number;
  style?: CSSProperties;
  children?: ReactNode;
}

/** Surface used for every block on the app screens. */
export function Card({ as: Tag = 'section', tone = 'default', pad = 'md', radius = 'section', flex, gap, style, className, children, ...rest }: CardProps) {
  const [grow, basis] = flex ? flex.split(' ') : [];
  return (
    <Tag
      className={[styles.card, styles[tone], styles['pad_' + pad], styles['r_' + radius], className].filter(Boolean).join(' ')}
      style={{ ...(flex ? { flex: `${grow} 1 ${basis}`, minWidth: 0 } : null), ...(gap !== undefined ? { gap } : null), ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  id?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Title style: 'section' 18px bold (default) · 'muted' 17px semibold grey · 'large' 20px */
  variant?: 'section' | 'muted' | 'large';
  level?: 2 | 3;
  actions?: ReactNode;
}

export function CardHeader({ id, title, subtitle, variant = 'section', level = 2, actions }: CardHeaderProps) {
  const H = `h${level}` as 'h2' | 'h3';
  return (
    <div className={styles.header}>
      <div className={styles.headerText}>
        <H id={id} className={styles['title_' + variant]}>
          {title}
        </H>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

/** Row of cards that wraps on narrow screens (the design's `display:flex; flex-wrap:wrap; gap:24px`). */
export function Row({ gap = 24, children, className, style }: { gap?: number; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={[styles.row, className].filter(Boolean).join(' ')} style={{ gap, ...style }}>
      {children}
    </div>
  );
}

/** Auto-fitting grid of tiles (KPI rows). */
export function TileGrid({
  min = 230,
  gap = 16,
  children,
  label,
  compactOnMobile = true,
}: {
  min?: number;
  gap?: number;
  children: ReactNode;
  label?: string;
  compactOnMobile?: boolean;
}) {
  return (
    <section
      aria-label={label}
      className={`${styles.tiles} ${compactOnMobile ? styles.tilesCompact : ''}`}
      style={{ gap, gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))` }}
    >
      {children}
    </section>
  );
}
