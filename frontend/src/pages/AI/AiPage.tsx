import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import {
  keys, useAiContext, useAiStatus, useConversation, useConversations, useDashboard, useGrantConsent, useLatestConversation,
  useNewConversation, useSendMessage,
} from '@/api/hooks';
import type { ChatMessage } from '@/api/types';
import { AppPage } from '@/components/layout/AppShell';
import { Icon } from '@/components/Icon';
import { Button, Dialog, EmptyState, ErrorState, Skeleton, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useLang, useT } from '@/i18n/I18nProvider';
import { dayMonth, time } from '@/lib/format';
import { Aside, MobileContext } from './Aside';
import { AssistantMessage, NoAccessMessage, TypingIndicator, UserMessage } from './Message';
import { dict } from './i18n';
import styles from './AI.module.css';

const isUnavailable = (e: unknown) => e instanceof ApiError && e.status === 503 && e.code === 'ai_unavailable';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** «qorgan AI»: chat with the assistant (`?c=<id>` picks a conversation, `?q=<text>` asks once on arrival). */
export default function AiPage() {
  const t = useT(dict);
  const c = useT(common);
  const { lang } = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('c');

  const latest = useLatestConversation();
  const selected = useConversation(selectedId);
  const query = selectedId ? selected : latest;
  const convo = query.data;
  const status = useAiStatus();
  const context = useAiContext();
  const dashboard = useDashboard();
  const send = useSendMessage(convo?.id);
  const create = useNewConversation();
  const grant = useGrantConsent();

  const [draft, setDraft] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  /** Time of the last 503 — offline until a newer status check says otherwise. */
  const [downAt, setDownAt] = useState(0);
  /** Question that hit the outage, shown until the saved copy arrives with the conversation. */
  const [failedText, setFailedText] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const offline = status.data?.available === false || downAt > status.dataUpdatedAt;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  /** One question at a time, even when two effects ask in the same render. */
  const inFlight = useRef(false);
  const sendText = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || !convo || send.isPending || inFlight.current) return;
      inFlight.current = true;
      setDraft((d) => (d.trim() === text ? '' : d));
      send.mutate(
        { text },
        {
          onSettled: () => {
            inFlight.current = false;
          },
          onSuccess: () => setFailedText(null),
          onError: (e) => {
            if (isUnavailable(e)) {
              setDownAt(Date.now());
              setFailedText(text);
            } else {
              toast({ tone: 'error', text: t.sendError, action: { label: c.retry, onClick: () => sendRef.current(text) } });
            }
          },
        },
      );
    },
    [convo, send, toast, t.sendError, c.retry],
  );
  const sendRef = useRef(sendText);
  sendRef.current = sendText;

  // ------------------------------------------------ derived conversation state
  const messages = useMemo(() => convo?.messages ?? [], [convo]);
  /** A saved (pending) question disappears once the same question was answered later. */
  const visible = useMemo(
    () => messages.filter((m, i) => !(m.pending && messages.slice(i + 1).some((x) => x.role === 'user' && !x.pending && x.text === m.text))),
    [messages],
  );
  const asked = useMemo(() => new Set(messages.filter((m) => m.role === 'user').map((m) => m.text)), [messages]);
  const lastPending = [...visible].reverse().find((m) => m.role === 'user' && m.pending);
  const sendingText = send.isPending ? send.variables?.text : undefined;
  const resending = sendingText !== undefined && lastPending?.text === sendingText;
  const showFailed = !!failedText && !send.isPending && !visible.some((m) => m.pending && m.text === failedText);
  const firstAnswerIdx = visible.findIndex((m) => m.role === 'user');

  // ------------------------------------------------ effects
  // Saved questions are sent once the assistant is back (and again after «Повторить»).
  const autoSent = useRef(new Set<string>());
  useEffect(() => {
    if (!lastPending || status.data?.available !== true || downAt > status.dataUpdatedAt || send.isPending || inFlight.current) return;
    if (autoSent.current.has(lastPending.id)) return;
    autoSent.current.add(lastPending.id);
    sendText(lastPending.text);
  }, [lastPending, status.data?.available, status.dataUpdatedAt, downAt, send.isPending, sendText, retryTick]);

  // While offline, check again every 30 s.
  useEffect(() => {
    if (!offline) return;
    const id = window.setInterval(() => qc.invalidateQueries({ queryKey: keys.aiStatus }), 30_000);
    return () => window.clearInterval(id);
  }, [offline, qc]);

  // `?q=` from other screens: ask once, then drop it from the URL.
  const askedFromUrl = useRef(false);
  useEffect(() => {
    const q = params.get('q');
    if (!q || askedFromUrl.current || !convo || send.isPending || inFlight.current) return;
    askedFromUrl.current = true;
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete('q');
        return next;
      },
      { replace: true },
    );
    sendText(q);
  }, [params, setParams, convo, send.isPending, sendText]);

  // Follow the newest message (not on first render, so the page opens at the top).
  const count = visible.length + (send.isPending ? 1 : 0) + (showFailed ? 1 : 0);
  const prev = useRef<{ id: string; count: number } | null>(null);
  useEffect(() => {
    if (!convo) return;
    const p = prev.current;
    if (p && p.id === convo.id && count > p.count) {
      endRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
    }
    prev.current = { id: convo.id, count };
  }, [count, convo]);

  useEffect(() => setFailedText(null), [convo?.id]);

  // ------------------------------------------------ actions
  const retry = () => {
    if (lastPending) autoSent.current.delete(lastPending.id);
    setRetryTick((n) => n + 1);
    status.refetch();
  };

  const startNew = () =>
    create.mutate(
      {},
      {
        onSuccess: (n) => {
          qc.invalidateQueries({ queryKey: keys.latestConversation });
          setParams({ c: n.id });
          inputRef.current?.focus();
        },
        onError: () => toast({ tone: 'error', text: t.newConversationError }),
      },
    );

  const allow = () =>
    grant.mutate('ai_analysis', {
      onSuccess: () => toast({ tone: 'success', text: t.aside.allowed }),
      onError: () => toast({ tone: 'error', text: c.saveFailed }),
    });

  // ------------------------------------------------ header
  const manage = <Link to="/profile?section=consents">{t.manageAccess}</Link>;
  const updated = dashboard.data?.updated_at;
  const subtitle = offline ? (
    t.offlineSubtitle
  ) : (
    <>
      {context.data && !context.data.allowed ? t.subtitleGeneral : updated ? t.subtitle(dayMonth(updated, lang)) : t.subtitleNoDate} · {manage}
    </>
  );

  const notFound = selectedId && selected.error instanceof ApiError && selected.error.status === 404;

  return (
    <AppPage title={t.title} subtitle={subtitle} subtitleIcon={offline ? 'wifiOff' : 'clock'} subtitleTone={offline ? 'warning' : 'muted'}>
      <div className={styles.layout}>
        {!offline && <MobileContext ctx={context.data} onGrant={allow} granting={grant.isPending} />}

        <section aria-label={t.conversationLabel} className={styles.chat}>
          {offline && <OfflineBanner onRetry={retry} retrying={status.isFetching} />}

          <div className={styles.chatTop}>
            <p className={styles.chatDate}>{convo ? t.conversationFrom(dayMonth(convo.created_at, lang)) : ' '}</p>
            <div className={styles.chatTopActions}>
              <button type="button" className={styles.topBtn} onClick={() => setHistoryOpen(true)} aria-label={t.historyLabel}>
                <Icon name="clock" size={16} />
                <span className={styles.topBtnText}>{t.history}</span>
              </button>
              <button type="button" className={styles.topBtn} onClick={startNew} disabled={create.isPending} aria-label={t.newConversation}>
                <Icon name="plus" size={16} strokeWidth={2} />
                <span className={styles.topBtnText}>{t.newConversation}</span>
              </button>
            </div>
          </div>

          {query.isLoading && <LogSkeleton />}
          {query.error && (
            <div className={styles.logState}>
              {notFound ? (
                <EmptyState icon="search" title={t.notFound}>
                  <Button variant="secondary" onClick={() => setParams({})}>
                    {t.openLatest}
                  </Button>
                </EmptyState>
              ) : (
                <ErrorState error={query.error} onRetry={() => query.refetch()} compact />
              )}
            </div>
          )}

          {convo && (
            <div role="log" aria-label={t.messages} className={`${styles.log} ${offline ? styles.logDimmed : ''}`}>
              {visible.map((m, i) => (
                <MessageView
                  key={m.id}
                  m={m}
                  asked={asked}
                  busy={send.isPending || offline}
                  onAsk={sendText}
                  feedback={m.role === 'assistant' && firstAnswerIdx !== -1 && i > firstAnswerIdx}
                  pendingNote={m.pending && !(resending && m.id === lastPending?.id) ? (offline ? 'offline' : 'retry') : null}
                  onRetry={() => sendText(m.text)}
                />
              ))}
              {showFailed && failedText && (
                <>
                  <UserMessage text={failedText} />
                  <PendingNote offline={offline} onRetry={() => sendText(failedText)} />
                </>
              )}
              {sendingText !== undefined && !resending && <UserMessage text={sendingText} />}
              {send.isPending && <TypingIndicator />}
              {context.data && !context.data.allowed && <NoAccessMessage onGrant={allow} busy={grant.isPending} />}
              <div ref={endRef} className={styles.logEnd} />
            </div>
          )}

          <Composer
            inputRef={inputRef}
            value={draft}
            onChange={setDraft}
            onSend={() => sendText(draft)}
            offline={offline}
            busy={send.isPending || !convo}
          />
        </section>

        <Aside ctx={context.data} loading={context.isLoading} offline={offline} onGrant={allow} granting={grant.isPending} />
      </div>

      {historyOpen && (
        <HistoryDialog
          currentId={convo?.id}
          onClose={() => setHistoryOpen(false)}
          onSelect={(id) => {
            setHistoryOpen(false);
            setParams({ c: id });
          }}
        />
      )}
    </AppPage>
  );
}

function MessageView({
  m,
  asked,
  busy,
  onAsk,
  feedback,
  pendingNote,
  onRetry,
}: {
  m: ChatMessage;
  asked: Set<string>;
  busy: boolean;
  onAsk: (q: string) => void;
  feedback: boolean;
  pendingNote: 'offline' | 'retry' | null;
  onRetry: () => void;
}) {
  if (m.role === 'user') {
    return (
      <>
        <UserMessage text={m.text} />
        {pendingNote && <PendingNote offline={pendingNote === 'offline'} onRetry={onRetry} />}
      </>
    );
  }
  return <AssistantMessage message={m} asked={asked} onAsk={onAsk} busy={busy} feedback={feedback} />;
}

function PendingNote({ offline, onRetry }: { offline: boolean; onRetry: () => void }) {
  const t = useT(dict);
  const c = useT(common);
  return (
    <div className={`${styles.pendingNote} ${styles.message}`}>
      <Icon name="alert" size={18} />
      {offline ? (
        <span>{t.offline.pending}</span>
      ) : (
        <span>
          {t.offline.notAnswered}{' '}
          <button type="button" className={styles.inlineAction} onClick={onRetry}>
            {c.retry}
          </button>
        </span>
      )}
    </div>
  );
}

function OfflineBanner({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const t = useT(dict);
  return (
    <div role="status" className={styles.offline}>
      <span aria-hidden="true" className={styles.offlineIcon}>
        <Icon name="wifiOff" size={22} />
      </span>
      <div className={styles.offlineBody}>
        <h2 className={styles.offlineTitle}>{t.offline.title}</h2>
        <p className={styles.offlineText}>{t.offline.text}</p>
        <div className={styles.offlineActions}>
          <Button icon="refresh" onClick={onRetry} disabled={retrying}>
            {t.offline.retry}
          </Button>
          <Link to="/check" className={styles.offlineLink}>
            {t.offline.checkWithoutAi}
          </Link>
        </div>
      </div>
    </div>
  );
}

function Composer({
  inputRef,
  value,
  onChange,
  onSend,
  offline,
  busy,
}: {
  inputRef: RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  offline: boolean;
  busy: boolean;
}) {
  const t = useT(dict);
  const c = useT(common);
  const canSend = !offline && !busy && value.trim().length > 0;

  // Grow with the text up to the CSS max-height.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, inputRef]);

  return (
    <form
      aria-label={t.composerLabel}
      className={styles.composer}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
    >
      <div className={`${styles.inputBox} ${offline ? styles.inputBoxOff : ''}`}>
        <label htmlFor="ai-message" className="visually-hidden">
          {t.inputLabel}
        </label>
        <textarea
          id="ai-message"
          ref={inputRef}
          rows={1}
          value={value}
          disabled={offline}
          maxLength={2000}
          placeholder={offline ? t.placeholderOffline : t.placeholder}
          className={styles.textarea}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
        />
        <button type="submit" aria-label={t.send} className={styles.sendBtn} disabled={!canSend}>
          <Icon name="arrowUp" size={20} strokeWidth={2} />
        </button>
      </div>
      {!offline && <p className={styles.disclaimer}>{c.aiDisclaimer}</p>}
    </form>
  );
}

function LogSkeleton() {
  return (
    <div className={styles.log} aria-hidden="true">
      <div className={styles.aiRow}>
        <Skeleton width={36} height={36} radius={18} />
        <Skeleton width="min(520px, 80%)" height={72} radius={18} />
      </div>
      <Skeleton width="min(320px, 60%)" height={46} radius={18} style={{ alignSelf: 'flex-end' }} />
      <div className={styles.aiRow}>
        <Skeleton width={36} height={36} radius={18} />
        <Skeleton width="min(600px, 85%)" height={140} radius={18} />
      </div>
    </div>
  );
}

function HistoryDialog({ currentId, onClose, onSelect }: { currentId?: string; onClose: () => void; onSelect: (id: string) => void }) {
  const t = useT(dict);
  const { lang } = useLang();
  const { data, isLoading, error, refetch } = useConversations();
  const items = useMemo(() => [...(data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)), [data]);
  return (
    <Dialog open onClose={onClose} title={t.historyLabel} description={t.historyDialog.description}>
      {isLoading && (
        <div className={styles.skeletonStack}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={64} radius={14} />
          ))}
        </div>
      )}
      {error && <ErrorState error={error} onRetry={() => refetch()} compact />}
      {data && items.length === 0 && <p className={styles.asideText}>{t.historyDialog.empty}</p>}
      {items.length > 0 && (
        <ul className={styles.historyList}>
          {items.map((s) => {
            const current = s.id === currentId;
            return (
              <li key={s.id}>
                <button type="button" className={styles.historyItem} aria-current={current ? 'true' : undefined} onClick={() => onSelect(s.id)}>
                  <span className={styles.historyMeta}>
                    {dayMonth(s.created_at, lang)} · {time(s.created_at)} · {t.historyDialog.count(s.messages)}
                    {current && <span className={styles.historyCurrent}>{t.historyDialog.current}</span>}
                  </span>
                  <span className={styles.historyTitle}>{s.title ?? t.historyDialog.untitled}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
