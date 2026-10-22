import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import type { CreditReport } from '@/api/types';
import { keys, useConfirmReport, useCredits, useLatestReport, useSetNoCredits, useUploadReport } from '@/api/hooks';
import { Icon } from '@/components/Icon';
import { Alert, Button, ErrorState, RadioCards, Skeleton, useToast } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { CreditRows } from './CreditRows';
import { ManualCreditForm } from './ManualCreditForm';
import { Dropzone, FailedReport, FileRow, ObligationList, type FailCode } from './ReportBlock';
import { StepFooter, StepHeading, type StepProps } from './shared';
import { dict } from './i18n';
import styles from './Onboarding.module.css';

export type CreditMethod = 'report' | 'manual' | 'sources';

type Upload =
  | { kind: 'uploading'; name: string; size: number }
  | { kind: 'failed'; name: string; size: number; code: FailCode }
  | { kind: 'error'; name: string; size: number; file: File }
  | { kind: 'processed'; report: CreditReport };

const MAX_BYTES = 10 * 1024 * 1024;

interface Props extends StepProps {
  initialMethod: CreditMethod;
  /** A PDF dropped on the dashboard: uploaded as soon as the step opens. */
  uploadFile: File | null;
  onFileTaken: () => void;
  /** Tells the page that the report failed (stepper «Нужно внимание», PDF help in the aside). */
  onAttention: (failed: boolean) => void;
}

/** Step 3 — credits: upload the bureau report and confirm what was found, add manually, or «нет кредитов». */
export function StepCredits({ financial, goTo, advance, headingRef, initialMethod, uploadFile, onFileTaken, onAttention }: Props) {
  const t = useT(dict);
  const tc = t.credits;
  const c = useT(common);
  const qc = useQueryClient();
  const toast = useToast();
  const credits = useCredits();
  const latest = useLatestReport();
  const uploadReport = useUploadReport();
  const confirm = useConfirmReport();
  const noCredits = useSetNoCredits();
  const [method, setMethod] = useState<CreditMethod>(initialMethod);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [checked, setChecked] = useState<{ reportId: string; ids: string[] } | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  // The latest processed report stands in until something is uploaded here.
  const shown: Upload | null = upload ?? (latest.data?.status === 'processed' ? { kind: 'processed', report: latest.data } : null);
  const pending = shown?.kind === 'processed' && !shown.report.confirmed ? shown.report : null;
  const checkedIds = pending ? (checked?.reportId === pending.id ? checked.ids : pending.obligations.map((o) => o.id)) : [];
  const failed = shown?.kind === 'failed' ? shown : null;
  const items = credits.data?.items ?? [];
  const hasCredits = items.length > 0;

  const isFailed = !!failed;
  useEffect(() => {
    onAttention(isFailed);
  }, [isFailed, onAttention]);
  useEffect(() => () => onAttention(false), [onAttention]);

  const start = (file: File) => {
    setMethod('report');
    setShowManual(false);
    setError(null);
    const base = { name: file.name, size: file.size };
    if (file.size > MAX_BYTES) return setUpload({ kind: 'failed', ...base, code: 'too_large' });
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return setUpload({ kind: 'failed', ...base, code: 'not_pdf' });
    setUpload({ kind: 'uploading', ...base });
    uploadReport.mutate(file, {
      onSuccess: (r) => {
        if (r.status !== 'processed') return setUpload({ kind: 'failed', name: r.filename, size: r.size_bytes, code: r.error_code ?? 'not_a_report' });
        setUpload({ kind: 'processed', report: r });
        qc.invalidateQueries({ queryKey: keys.latestReport });
        qc.invalidateQueries({ queryKey: keys.consents });
        const partial = r.obligations.filter((o) => o.partial).length;
        if (partial) toast({ tone: 'warning', text: tc.partialToast(partial) });
      },
      onError: () => setUpload({ kind: 'error', ...base, file }),
    });
  };

  // StrictMode runs effects twice in development; the ref keeps it to one upload.
  const taken = useRef(false);
  useEffect(() => {
    if (!uploadFile || taken.current) return;
    taken.current = true;
    start(uploadFile);
    onFileTaken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadFile]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const next = () =>
    run(async () => {
      if (pending) {
        try {
          await confirm.mutateAsync({ id: pending.id, obligationIds: checkedIds });
        } catch (e) {
          if (!(e instanceof ApiError && e.code === 'report_already_confirmed')) throw e;
        }
        setUpload({ kind: 'processed', report: { ...pending, confirmed: true } });
      }
      await advance(4);
    });

  const markNoCredits = () => run(async () => advance(4, await noCredits.mutateAsync(true)));

  const openPicker = () => pickerRef.current?.click();

  return (
    <>
      <StepHeading headingRef={headingRef} title={tc.title} lead={failed ? tc.leadFailed : tc.lead} />

      {!failed && (
        <div className={styles.methods}>
          <RadioCards<CreditMethod>
            legend={tc.method}
            name="credit-method"
            value={method}
            min={190}
            onChange={(m) => {
              setMethod(m);
              setShowManual(false);
            }}
            options={[
              { value: 'report', title: tc.methods.report.title, description: tc.methods.report.text, tag: <span className={styles.tagFast}>{tc.methods.report.tag}</span> },
              { value: 'manual', title: tc.methods.manual.title, description: tc.methods.manual.text },
              {
                value: 'sources',
                title: tc.methods.sources.title,
                description: tc.methods.sources.text,
                disabled: true,
                tag: <span className={styles.tagOff}>{tc.methods.sources.tag}</span>,
              },
            ]}
          />
        </div>
      )}

      {failed ? (
        <FailedReport
          name={failed.name}
          size={failed.size}
          code={failed.code}
          onPick={openPicker}
          onManual={() => {
            setUpload(null);
            setMethod('manual');
          }}
        />
      ) : (
        <>
          {(method === 'report' || pending) && (
            <div className={styles.box}>
              {shown?.kind === 'uploading' && <FileRow name={shown.name} size={shown.size} uploadedAt={null} status="uploading" />}
              {shown?.kind === 'processed' && (
                <>
                  <FileRow
                    name={shown.report.filename}
                    size={shown.report.size_bytes}
                    uploadedAt={new Date(shown.report.uploaded_at)}
                    status="processed"
                    action={
                      <button type="button" className={styles.inlineButton} onClick={openPicker}>
                        {tc.another}
                      </button>
                    }
                  />
                  {pending ? (
                    <ObligationList report={pending} checked={checkedIds} onChange={(ids) => setChecked({ reportId: pending.id, ids })} />
                  ) : (
                    <p className={styles.foundText}>{tc.imported}</p>
                  )}
                  {pending && items.some((i) => i.source === 'report') && <p className={styles.note}>{tc.replaceHint}</p>}
                </>
              )}
              {shown?.kind === 'error' && (
                <Alert
                  tone="danger"
                  role="alert"
                  actions={
                    <Button variant="secondary" size="sm" icon="refresh" onClick={() => start(shown.file)}>
                      {c.retry}
                    </Button>
                  }
                >
                  {tc.uploadError}
                </Alert>
              )}
              {(!shown || shown.kind === 'error') && (latest.isLoading ? <Skeleton height={180} radius={18} /> : <Dropzone onFile={start} />)}
              {method === 'report' && <p className={styles.note}>{tc.consentNote}</p>}
            </div>
          )}

          {(method === 'manual' || showManual) && <ManualCreditForm onCancel={method === 'manual' ? undefined : () => setShowManual(false)} />}

          {credits.isLoading ? (
            <Skeleton height={56} radius={14} />
          ) : credits.error ? (
            <ErrorState compact error={credits.error} onRetry={() => credits.refetch()} />
          ) : (
            <CreditRows credits={items} />
          )}

          {method === 'report' && !showManual && (
            <button type="button" className={styles.dashedButton} onClick={() => setShowManual(true)}>
              <Icon name="plus" size={18} strokeWidth={2} />
              {tc.addManual}
            </button>
          )}

          {!hasCredits && !pending && credits.isSuccess &&
            (financial.no_credits ? (
              <Alert
                tone="success"
                role="status"
                actions={
                  <button type="button" className={styles.inlineButton} disabled={noCredits.isPending} onClick={() => noCredits.mutate(false)}>
                    {tc.noCreditsUndo}
                  </button>
                }
              >
                {tc.noCreditsSet}
              </Alert>
            ) : (
              <div className={styles.noCredits}>
                <Button variant="secondary" icon="checkCircle" disabled={busy} onClick={markNoCredits}>
                  {tc.noCredits}
                </Button>
                <p className={styles.note}>{tc.noCreditsHint}</p>
              </div>
            ))}
        </>
      )}

      <input
        ref={pickerRef}
        type="file"
        accept="application/pdf,.pdf"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) start(file);
        }}
      />

      <StepFooter
        onBack={() => goTo(2)}
        onNext={() => void next()}
        pending={busy || shown?.kind === 'uploading'}
        disabled={!!failed && !hasCredits}
        hint={tc.nextHint}
        error={error}
      />
    </>
  );
}
