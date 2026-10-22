import { useState, type ReactNode } from 'react';
import type { CreditReport } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Button, Pill } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { money } from '@/lib/format';
import { fileSize } from './shared';
import { dict } from './i18n';
import styles from './Onboarding.module.css';

export type FailCode = NonNullable<CreditReport['error_code']>;

/** Drag a PDF here or pick one (the input is visually hidden inside the label). */
export function Dropzone({ onFile }: { onFile: (file: File) => void }) {
  const t = useT(dict);
  const [over, setOver] = useState(false);
  return (
    <label
      className={`${styles.drop} ${over ? styles.dropOver : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <input
        type="file"
        accept="application/pdf,.pdf"
        className="visually-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
      <span aria-hidden="true" className={styles.dropIcon}>
        <Icon name="upload" size={24} />
      </span>
      <b className={styles.dropTitle}>{t.credits.drop}</b>
      <span className={styles.dropText}>
        {t.credits.dropOr} <span className={styles.dropLink}>{t.credits.dropChoose}</span> · {t.credits.dropLimit}
      </span>
    </label>
  );
}

type FileStatus = 'uploading' | 'processed' | 'failed';

/** File name, size · when, and a status pill. */
export function FileRow({ name, size, uploadedAt, status, action }: { name: string; size: number; uploadedAt: Date | null; status: FileStatus; action?: ReactNode }) {
  const t = useT(dict);
  const tc = t.credits;
  const old = uploadedAt && Date.now() - uploadedAt.getTime() > 5 * 60_000 ? uploadedAt : null;
  return (
    <div className={styles.fileRow} role={status === 'uploading' ? 'status' : undefined}>
      <span aria-hidden="true" className={`${styles.fileIcon} ${status === 'failed' ? styles.fileIconFailed : ''}`}>
        <Icon name={status === 'failed' ? 'fileX' : 'file'} size={20} />
      </span>
      <span className={styles.fileText}>
        <span className={styles.fileName}>{name}</span>
        <span className={styles.fileMeta}>
          {fileSize(size)} · {old ? tc.uploadedOn(old) : tc.uploadedNow}
        </span>
      </span>
      {status === 'uploading' && (
        <Pill tone="neutral" size="sm">
          <span aria-hidden="true" className={styles.spinner} />
          {tc.uploading}
        </Pill>
      )}
      {status === 'processed' && (
        <Pill tone="success" size="sm" icon="checkCircle">
          {tc.processed}
        </Pill>
      )}
      {status === 'failed' && (
        <Pill tone="danger" size="sm" icon="octagon">
          {tc.failed}
        </Pill>
      )}
      {action}
    </div>
  );
}

/** «Найдено N обязательств — проверь и подтверди» with a checkbox per recognised obligation. */
export function ObligationList({ report, checked, onChange }: { report: CreditReport; checked: string[]; onChange: (ids: string[]) => void }) {
  const t = useT(dict);
  const c = useT(common);
  if (!report.obligations.length) return <p className={styles.foundText}>{t.credits.foundNone}</p>;
  return (
    <fieldset className={styles.obligations}>
      <legend className={styles.foundText}>{t.credits.found(c.obligations(report.obligations.length))}</legend>
      <ul className={styles.obList}>
        {report.obligations.map((o) => (
          <li key={o.id}>
            <label className={styles.obRow}>
              <input
                type="checkbox"
                checked={checked.includes(o.id)}
                onChange={(e) => onChange(e.target.checked ? [...checked, o.id] : checked.filter((id) => id !== o.id))}
              />
              <span className={styles.obName}>
                {o.organization} · {c.creditTypeShort[o.type]}
                {o.partial && (
                  <Pill tone="warning" size="xs" icon="triangle">
                    {t.credits.partial}
                  </Pill>
                )}
              </span>
              <span className={`${styles.creditNums} tabular`}>
                {money(o.balance)} · {money(o.monthly_payment)}
                {c.perMonthShort}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/** Onboarding-Error board: what went wrong (by error_code), what to do, two ways forward. */
export function FailedReport({ name, size, code, onPick, onManual }: { name: string; size: number; code: FailCode; onPick: () => void; onManual: () => void }) {
  const t = useT(dict);
  const tc = t.credits;
  return (
    <>
      <FileRow name={name} size={size} uploadedAt={null} status="failed" />
      <div role="alert" className={styles.failBox}>
        <h3 className={styles.failTitle}>{tc.failedTitle}</h3>
        <p className={styles.failText}>{tc.failedReason[code]}</p>
        <div className={styles.tips}>
          <p className={styles.tipsTitle}>{tc.tipsTitle}</p>
          <ul>
            {tc.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
        <div className={styles.failActions}>
          <Button icon="upload" onClick={onPick}>
            {tc.retryUpload}
          </Button>
          <Button variant="secondary" onClick={onManual}>
            {tc.switchManual}
          </Button>
        </div>
      </div>
      <p className={styles.lockNote}>
        <Icon name="lock" size={16} />
        {tc.notKept}
      </p>
    </>
  );
}
