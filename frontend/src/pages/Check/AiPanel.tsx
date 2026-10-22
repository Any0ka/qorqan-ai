import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { useAiStatus, useConversation, useNewConversation, useSendMessage } from '@/api/hooks';
import type { ChatMessage, Purchase } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Alert, Button, Skeleton } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { AssistantMessage } from './ChatBlocks';
import { dict } from './i18n';
import styles from './AiPanel.module.css';

interface AiPanelProps {
  purchase: Purchase | null;
  context: string;
  /** Router state for the close link (keeps the form). */
  linkState: unknown;
  /** Called before leaving to /ai so the form survives «Назад». */
  onLeave: () => void;
}

function Avatar() {
  return (
    <span aria-hidden="true" className={styles.avatar}>
      <Icon name="sparkle" size={18} strokeWidth={2} />
    </span>
  );
}

function UserBubble({ text, notSent }: { text: string; notSent?: string }) {
  return (
    <div className={styles.userWrap}>
      <div className={styles.user}>{text}</div>
      {notSent && <span className={styles.notSent}>{notSent}</span>}
    </div>
  );
}

/** qorgan AI side panel on «Проверить решение» (Check-AI, DS-AI «AI Side Panel»). */
export function AiPanel({ purchase, context, linkState, onLeave }: AiPanelProps) {
  const t = useT(dict).panel;
  const start = useNewConversation();
  const started = useRef(false);
  const id = start.data?.id ?? null;
  const { data: convo } = useConversation(id);
  const status = useAiStatus();
  const send = useSendMessage(id);
  const [draft, setDraft] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const begin = () => start.mutate({ check_panel: true, purchase });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    begin();
    // Once per panel: later questions carry the current purchase themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const all = convo?.messages ?? start.data?.messages ?? [];
  const visible = all.filter((m) => m.role === 'user' || m.text.trim() || m.blocks.length > 0 || m.links.length > 0);
  const assistant = all.filter((m) => m.role === 'assistant');
  const asked = new Set(all.filter((m) => m.role === 'user').map((m) => m.text));
  const last = assistant.at(-1);
  const suggestions = (last?.suggestions.length ? last.suggestions : assistant[0]?.suggestions ?? []).filter((s) => !asked.has(s)).slice(0, 3);
  const offline = unavailable || status.data?.available === false;

  useEffect(() => {
    const el = logRef.current;
    if (el && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
  }, [visible.length, send.isPending, failed]);

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || !id || send.isPending) return;
    setFailed(null);
    setDraft('');
    send.mutate(
      { text: q, purchase },
      {
        onSuccess: () => setUnavailable(false),
        onError: (e) => {
          if (e instanceof ApiError && e.code === 'ai_unavailable') setUnavailable(true);
          else setFailed(q);
        },
      },
    );
  };

  const renderMessage = (m: ChatMessage) =>
    m.role === 'user' ? <UserBubble key={m.id} text={m.text} notSent={m.pending ? t.notSent : undefined} /> : <AssistantMessage key={m.id} message={m} />;

  return (
    <aside aria-labelledby="panel-title" className={styles.panel}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <Avatar />
          <div className={styles.headText}>
            <h2 id="panel-title" className={styles.title}>
              {t.title}
            </h2>
            <span className={styles.subtitle}>{t.subtitle}</span>
          </div>
          <Link to="/ai" aria-label={t.fullscreen} title={t.fullscreen} className={styles.headBtn} onClick={onLeave}>
            <Icon name="expand" size={18} />
          </Link>
          <Link to="/check" state={linkState} aria-label={t.close} title={t.close} className={styles.headBtn}>
            <Icon name="x" size={18} strokeWidth={2} />
          </Link>
        </div>

        <p className={styles.context}>
          <Icon name="file" size={14} />
          {context}
        </p>

        <div ref={logRef} role="log" aria-label={t.log} className={styles.log}>
          {start.isPending && (
            <div aria-busy="true" className={styles.loadingLog}>
              <Skeleton height={40} width="70%" radius={14} style={{ alignSelf: 'flex-end' }} />
              <Skeleton height={80} radius={14} />
            </div>
          )}
          {start.isError && (
            <Alert tone="danger" role="alert" actions={<Button variant="link" onClick={begin}>{t.retry}</Button>}>
              {t.startError}
            </Alert>
          )}
          {id && visible.length === 0 && !send.isPending && <p className={styles.empty}>{t.empty}</p>}
          {visible.map(renderMessage)}
          {send.isPending && send.variables && (
            <>
              <UserBubble text={send.variables.text} />
              <div className={styles.typing}>
                <Avatar />
                <span role="status" aria-label={t.typing} className={styles.dots}>
                  <span />
                  <span />
                  <span />
                </span>
                <span className={styles.typingText}>{t.typingText}</span>
              </div>
            </>
          )}
          {failed && (
            <>
              <UserBubble text={failed} />
              <div className={styles.failed} role="alert">
                <Icon name="alert" size={18} />
                {t.failed}
                <button type="button" className={styles.retry} onClick={() => ask(failed)}>
                  {t.retry}
                </button>
              </div>
            </>
          )}
          {offline && (
            <Alert tone="warning" role="status" title={t.unavailableTitle}>
              {t.unavailableText}
            </Alert>
          )}
          {id && !send.isPending && suggestions.length > 0 && (
            <div role="group" aria-label={t.suggestions} className={styles.suggestions}>
              {suggestions.map((s) => (
                <button key={s} type="button" className={styles.suggestion} onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <form
          aria-label={t.form}
          className={styles.ask}
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
        >
          <div className={styles.inputBox}>
            <label htmlFor="panel-q" className="visually-hidden">
              {t.input}
            </label>
            <input id="panel-q" type="text" value={draft} placeholder={t.placeholder} maxLength={2000} autoComplete="off" onChange={(e) => setDraft(e.target.value)} />
            <button type="submit" aria-label={t.send} className={styles.send} disabled={!id || send.isPending || !draft.trim()}>
              <Icon name="arrowUp" size={18} strokeWidth={2} />
            </button>
          </div>
          <p className={styles.disclaimer}>{t.disclaimer}</p>
        </form>
      </div>
    </aside>
  );
}
