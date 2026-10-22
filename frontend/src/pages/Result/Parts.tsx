import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSaveCheck } from '@/api/hooks';
import type { Assessment } from '@/api/types';
import { Button, Tag, TagList, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useT } from '@/i18n/I18nProvider';
import { money, numericDate } from '@/lib/format';
import { dict } from './i18n';
import styles from './Result.module.css';

/** "14.10" — the short source dates of «Как мы считали». */
export const shortDate = (d: string | null) => (d ? numericDate(d).slice(0, 5) : null);

/** The freshest date of the data the assessment used. */
export function dataDate(a: Assessment): string | null {
  const s = a.data_sources;
  const dates = [s.income_updated_at, s.expenses_updated_at, s.report_date].filter((d): d is string => !!d);
  return dates.length ? dates.sort().at(-1)! : null;
}

export const termOf = (a: Assessment) => (a.purchase.kind === 'own' ? null : a.purchase.term_months);

/** In-page link that also opens a <details> target and moves focus there. */
export function JumpLink({ target, className, children }: { target: string; className?: string; children: ReactNode }) {
  const onClick = (e: MouseEvent) => {
    const el = document.getElementById(target);
    if (!el) return;
    e.preventDefault();
    if (el instanceof HTMLDetailsElement) el.open = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const focusable = el instanceof HTMLDetailsElement ? el.querySelector('summary') : el;
    (focusable as HTMLElement | null)?.focus({ preventScroll: true });
  };
  return (
    <a href={`#${target}`} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

/** Breadcrumb, purchase tags and «Сохранить результат». */
export function PurchaseBar({ a }: { a: Assessment }) {
  const t = useT(dict);
  const c = useT(common);
  const toast = useToast();
  const save = useSaveCheck();
  const p = a.purchase;
  const term = termOf(a);

  const toggle = () =>
    save.mutate(
      { id: a.id, saved: !a.saved },
      {
        onSuccess: (r) =>
          toast(
            r.saved
              ? { tone: 'success', text: t.savedToast, action: { label: t.open, to: '/profile?section=history' } }
              : { tone: 'info', text: t.unsavedToast },
          ),
        onError: () => toast({ tone: 'error', text: c.saveFailed }),
      },
    );

  return (
    <div className={styles.topBar}>
      <div className={styles.topLeft}>
        <nav aria-label={t.crumbs.label}>
          <ol className={styles.crumbs}>
            <li>
              <Link to="/check">{t.crumbs.check}</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">{t.crumbs.result}</li>
          </ol>
        </nav>
        <TagList label={t.tags.label}>
          <Tag strong>{p.title}</Tag>
          <Tag>{t.tags.kind[p.kind](term ?? 0)}</Tag>
          <Tag>
            <span className="nowrap">{money(p.price)}</span>
          </Tag>
          {p.kind !== 'own' && a.monthly_payment > 0 && (
            <Tag>
              <span className="nowrap">{t.tags.perMonth(money(a.monthly_payment))}</span>
            </Tag>
          )}
        </TagList>
      </div>
      <Button
        variant="secondary"
        icon={a.saved ? 'check' : 'bookmark'}
        onClick={toggle}
        disabled={save.isPending}
        className={a.saved ? styles.savedBtn : undefined}
      >
        {a.saved ? t.saved : t.save}
      </Button>
    </div>
  );
}

export interface ChangeItem {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  tone?: 'danger' | 'warning' | 'navy';
  small?: boolean;
}

/** Right side of the verdict: «Что изменится…». */
export function ChangePanel({ title, items }: { title: string; items: ChangeItem[] }) {
  return (
    <div className={styles.changePanel}>
      <h3 className={styles.changeTitle}>{title}</h3>
      {items.map((it) => (
        <div key={it.label} className={styles.changeItem}>
          <span className={styles.changeLabel}>{it.label}</span>
          <span className={`${it.small ? styles.changeValueSm : styles.changeValue} ${styles['tone_' + (it.tone ?? 'navy')]}`}>
            {it.value}
            {it.unit && <span className={styles.changeUnit}> {it.unit}</span>}
          </span>
          <span className={styles.changeSub}>{it.sub}</span>
        </div>
      ))}
    </div>
  );
}
