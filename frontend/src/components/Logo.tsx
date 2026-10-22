import { Link } from 'react-router-dom';
import styles from './Logo.module.css';

/** Shield mark: navy outline with a teal "q" tail. */
export function LogoMark({ size = 32, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M20 4.5c5 0 9.5 1.5 13 3.5v11c0 7.8-5.4 13.8-13 16.5C12.4 32.8 7 26.8 7 19V8c3.5-2 8-3.5 13-3.5z"
        stroke={inverted ? '#FFFFFF' : '#14263D'}
        strokeWidth="4.2"
        strokeLinejoin="round"
      />
      <path d="M23 24.5l9 10.5" stroke={inverted ? '#5FD3CD' : '#149E9A'} strokeWidth="4.2" strokeLinecap="round" />
    </svg>
  );
}

interface LogoProps {
  to?: string;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  inverted?: boolean;
  showWordmark?: boolean;
}

export function Logo({ to = '/', label, size = 'md', inverted = false, showWordmark = true }: LogoProps) {
  const mark = { sm: 28, md: 32, lg: 36 }[size];
  return (
    <Link to={to} aria-label={label} className={`${styles.logo} ${styles[size]} ${inverted ? styles.inverted : ''}`}>
      <LogoMark size={mark} inverted={inverted} />
      {showWordmark && <span className={styles.word}>qorgan</span>}
    </Link>
  );
}
