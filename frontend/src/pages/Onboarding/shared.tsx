import { useId, type ReactNode, type RefObject } from 'react';
import { ApiError } from '@/api/client';
import type { Financial } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { dict } from './i18n';
import styles from './Onboarding.module.css';

export interface StepProps {
  financial: Financial;
  goTo: (step: number) => void;
  /** Persists the onboarding step on the account (never moving it backwards) and opens `to`. Throws on failure. */
  advance: (to: number, latest?: Financial) => Promise<void>;
  /** Lets «Сохранить и продолжить позже» save the step that is open. Resolves false when nothing could be saved. */
  registerSave: (fn: (() => Promise<boolean>) | null) => void;
  headingRef: RefObject<HTMLHeadingElement>;
}

export function StepHeading({ headingRef, title, lead }: { headingRef: RefObject<HTMLHeadingElement>; title: ReactNode; lead: ReactNode }) {
  return (
    <div className={styles.stepHead}>
      <h2 ref={headingRef} tabIndex={-1} className={styles.stepTitleH}>
        {title}
      </h2>
      <p className={styles.stepLead}>{lead}</p>
    </div>
  );
}

/** «Не удалось сохранить…» above the action button, with a retry (System-States). */
export function SaveError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const c = useT(common);
  const code = error instanceof ApiError ? error.code : 'unknown';
  const text = code === 'network' || code === 'unknown' || !c.errors[code] ? c.saveFailed : c.errors[code];
  return (
    <div role="alert" className={styles.saveError}>
      <Icon name="alert" size={18} />
      <span>
        {text}
        {onRetry && (
          <>
            {' '}
            <button type="button" className={styles.inlineButton} onClick={onRetry}>
              {c.retry}
            </button>
          </>
        )}
      </span>
    </div>
  );
}

interface FooterProps {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: ReactNode;
  disabled?: boolean;
  pending?: boolean;
  error?: unknown;
  /** Explains why «Далее» is disabled. */
  hint?: ReactNode;
}

/** Back / Next row at the bottom of the step card. */
export function StepFooter({ onBack, onNext, nextLabel, disabled, pending, error, hint }: FooterProps) {
  const t = useT(dict);
  const hintId = useId();
  return (
    <div className={styles.footerWrap}>
      {error ? <SaveError error={error} onRetry={onNext} /> : null}
      <div className={styles.footer}>
        {onBack ? (
          <Button variant="secondary" size="lg" icon="chevronLeft" className={styles.navBtn} onClick={onBack}>
            {t.back}
          </Button>
        ) : (
          <span />
        )}
        <Button
          size="lg"
          iconRight="arrowRight"
          className={styles.navBtn}
          disabled={disabled || pending}
          aria-busy={pending || undefined}
          aria-describedby={hint && disabled ? hintId : undefined}
          onClick={onNext}
        >
          {nextLabel ?? t.next}
        </Button>
      </div>
      {hint && disabled && (
        <p id={hintId} className={styles.footerHint}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** 1 258 291 → "1,2 МБ"; small files in КБ. */
export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}
