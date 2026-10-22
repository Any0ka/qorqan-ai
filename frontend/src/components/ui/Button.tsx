import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../Icon';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'teal' | 'white' | 'ghost' | 'danger' | 'dangerOutline' | 'aiChip' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
  className?: string;
  children?: ReactNode;
}

type AsButton = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined; href?: undefined };
type AsLink = CommonProps & { to: string; href?: undefined; onClick?: () => void; 'aria-label'?: string; state?: unknown; replace?: boolean };
type AsAnchor = CommonProps & { href: string; to?: undefined; download?: string; target?: string; rel?: string; 'aria-label'?: string };

export type ButtonProps = AsButton | AsLink | AsAnchor;

function classes(p: CommonProps) {
  return [styles.btn, styles[p.variant ?? 'primary'], styles[p.size ?? 'md'], p.block ? styles.block : '', p.className ?? '']
    .filter(Boolean)
    .join(' ');
}

/** Button that renders as <button>, a router <Link> (`to`) or an <a> (`href`). */
export function Button(props: ButtonProps) {
  const { icon, iconRight, children } = props;
  const iconSize = props.size === 'sm' ? 16 : props.size === 'xl' ? 20 : 18;
  const content = (
    <>
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} strokeWidth={2} />}
    </>
  );
  if ('to' in props && props.to !== undefined) {
    const { to, onClick, state, replace } = props as AsLink;
    return (
      <Link to={to} onClick={onClick} state={state} replace={replace} className={classes(props)} aria-label={props['aria-label']}>
        {content}
      </Link>
    );
  }
  if ('href' in props && props.href !== undefined) {
    const { href, download, target, rel } = props as AsAnchor;
    return (
      <a href={href} download={download} target={target} rel={rel} className={classes(props)} aria-label={props['aria-label']}>
        {content}
      </a>
    );
  }
  const { variant: _v, size: _s, icon: _i, iconRight: _ir, block: _b, className: _c, children: _ch, type, ...rest } = props as AsButton;
  return (
    <button type={type ?? 'button'} className={classes(props)} {...rest}>
      {content}
    </button>
  );
}

/** Square icon-only button (44×44 touch target). Always needs an accessible label. */
export function IconButton({
  icon,
  label,
  variant = 'outline',
  size = 44,
  className,
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; variant?: 'outline' | 'plain' | 'navy'; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={[styles.iconBtn, styles['icon_' + variant], className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
