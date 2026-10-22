import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ChatBlock, ChatMessage, RiskLevel } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Pill, RISK_ICON, RISK_TONE, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useT } from '@/i18n/I18nProvider';
import { money, percent } from '@/lib/format';
import { dict } from './i18n';
import styles from './AI.module.css';

// ------------------------------------------------------------------ rich text

/** `**bold**` and single line breaks inside one paragraph. Amounts in bold never wrap; negative ones are red. */
function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, i) => {
      if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
        const value = part.slice(2, -2);
        const amount = /\d/.test(value) && /[₸%]/.test(value);
        const cls = [amount && styles.nowrap, amount && value.startsWith('−') && styles.negative].filter(Boolean).join(' ');
        return (
          <b key={i} className={cls || undefined}>
            {value}
          </b>
        );
      }
      return part.split('\n').map((line, j) => (j === 0 ? line : [<br key={`${i}-${j}`} />, line]));
    });
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className={className}>
          {inline(p)}
        </p>
      ))}
    </>
  );
}

const strip = (s: string) => s.replace(/\*\*/g, '');

/** Plain-text version of an answer for «Скопировать ответ». */
function plainText(m: ChatMessage): string {
  const parts = [strip(m.text)];
  for (const b of m.blocks) {
    const d = b.data;
    if (b.type === 'steps') parts.push(d.title, ...(d.items ?? []).map((it: StepItem) => `${it.n}. ${it.title} — ${it.hint}`));
    if (b.type === 'verdict') parts.push(`${d.title}. ${strip(d.text ?? '')}`);
    if (b.type === 'compare') parts.push(...(d.rows ?? []).map((r: CompareRow) => `${r.label}: ${r.approx ? '≈ ' : ''}${money(r.monthly)} · ${money(r.total)}`), d.note ?? '');
    if (b.type === 'list') parts.push(...(d.items ?? []).map((it: string, i: number) => (d.ordered ? `${i + 1}. ${strip(it)}` : `• ${strip(it)}`)));
  }
  return parts.filter(Boolean).join('\n');
}

// ------------------------------------------------------------------ pieces

export function Avatar({ muted = false }: { muted?: boolean }) {
  return (
    <span aria-hidden="true" className={`${styles.avatar} ${muted ? styles.avatarMuted : ''}`}>
      <Icon name={muted ? 'lock' : 'sparkle'} size={18} strokeWidth={2} />
    </span>
  );
}

export function TypingIndicator() {
  const t = useT(dict);
  return (
    <div className={`${styles.aiRow} ${styles.message}`}>
      <Avatar />
      <span role="status" className={styles.typing}>
        <span className="visually-hidden">{t.typing}</span>
        <span aria-hidden="true" className={styles.dot} />
        <span aria-hidden="true" className={styles.dot} />
        <span aria-hidden="true" className={styles.dot} />
      </span>
      <span className={styles.typingHint}>{t.typingHint}</span>
    </div>
  );
}

interface StepItem {
  n: string;
  title: string;
  hint: string;
}

function StepsBlock({ data }: { data: ChatBlock['data'] }) {
  const items = (data.items ?? []) as StepItem[];
  return (
    <div className={styles.blockCard}>
      <p className={styles.blockHead}>
        <Icon name="list" size={16} />
        {data.title}
      </p>
      <ol className={styles.steps}>
        {items.map((it, i) => (
          <li key={i}>
            <b className={styles.stepN}>{it.n}</b>
            <span className={styles.stepTitle}>{it.title}</span>
            <span className={i === 0 ? styles.stepHintFirst : styles.stepHint}>{it.hint}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function VerdictBlock({ data }: { data: ChatBlock['data'] }) {
  const c = useT(common);
  const risk = (data.risk ?? 'insufficient') as RiskLevel;
  const title = String(data.title ?? c.risk[risk]);
  const links = (data.links ?? []) as Array<{ label: string; to: string }>;
  const namesRisk = title.toLowerCase().includes(c.riskShort[risk].toLowerCase());
  return (
    <div className={`${styles.verdict} ${styles['verdict_' + risk]}`}>
      <Pill tone={RISK_TONE[risk]} icon={RISK_ICON[risk]} size="sm" className={styles.verdictBadge}>
        {!namesRisk && <span className="visually-hidden">{c.risk[risk]}: </span>}
        {title}
      </Pill>
      {data.text && <RichText text={String(data.text)} className={styles.text} />}
      {links.length > 0 && (
        <div className={styles.links}>
          {links.map((l, i) => (
            <Link key={l.to + i} to={l.to} className={i === 0 ? styles.linkNavy : styles.linkOutline}>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

interface CompareRow {
  label: string;
  monthly: number;
  total: number;
  approx?: boolean;
  load?: number;
  risk?: RiskLevel;
}

function CompareBlock({ data }: { data: ChatBlock['data'] }) {
  const t = useT(dict);
  const c = useT(common);
  const rows = (data.rows ?? []) as CompareRow[];
  const showLoad = !!data.show_load || rows.some((r) => typeof r.load === 'number');
  const showRisk = rows.some((r) => r.risk);
  const approx = (r: CompareRow) =>
    r.approx ? (
      <>
        <span aria-hidden="true">≈ </span>
        <span className="visually-hidden">{t.compare.approx} </span>
      </>
    ) : null;
  return (
    <div className={styles.blockCard}>
      <p className={styles.blockHead}>
        <Icon name="calculator" size={16} />
        {showLoad ? t.compare.termTitle : t.compare.title}
        {!showLoad && data.term_months ? <span className={styles.blockHeadMuted}>· {t.compare.term(c.months(data.term_months))}</span> : null}
      </p>
      <table className={styles.compare}>
        <thead>
          <tr>
            <th scope="col">{t.compare.option}</th>
            <th scope="col" className={styles.num}>
              {t.compare.monthly}
            </th>
            <th scope="col" className={styles.num}>
              {t.compare.total}
            </th>
            {showLoad && (
              <th scope="col" className={styles.num}>
                {t.compare.load}
              </th>
            )}
            {showRisk && <th scope="col">{t.compare.risk}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <th scope="row">{r.label}</th>
              <td data-label={t.compare.monthly} className={styles.num}>
                {approx(r)}
                {money(r.monthly)}
              </td>
              <td data-label={t.compare.total} className={styles.num}>
                <b>
                  {approx(r)}
                  {money(r.total)}
                </b>
              </td>
              {showLoad && (
                <td data-label={t.compare.load} className={styles.num}>
                  {typeof r.load === 'number' ? percent(r.load) : '—'}
                </td>
              )}
              {showRisk && (
                <td data-label={t.compare.risk}>
                  {r.risk && (
                    <Pill tone={RISK_TONE[r.risk]} icon={RISK_ICON[r.risk]} size="xs">
                      {c.riskShort[r.risk]}
                    </Pill>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {data.note && <p className={styles.blockNote}>{data.note}</p>}
    </div>
  );
}

function ListBlock({ data }: { data: ChatBlock['data'] }) {
  const items = (data.items ?? []) as string[];
  const Tag = data.ordered ? 'ol' : 'ul';
  return (
    <Tag className={`${styles.list} ${data.muted ? styles.listMuted : ''}`}>
      {items.map((it, i) => (
        <li key={i}>{inline(it)}</li>
      ))}
    </Tag>
  );
}

function Block({ block }: { block: ChatBlock }) {
  if (block.type === 'steps') return <StepsBlock data={block.data} />;
  if (block.type === 'verdict') return <VerdictBlock data={block.data} />;
  if (block.type === 'compare') return <CompareBlock data={block.data} />;
  if (block.type === 'list') return <ListBlock data={block.data} />;
  return null;
}

function Feedback({ message }: { message: ChatMessage }) {
  const t = useT(dict);
  const toast = useToast();
  // TODO: there is no feedback endpoint yet — the vote only lives in this screen.
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const pick = (v: 'up' | 'down') => {
    const next = vote === v ? null : v;
    setVote(next);
    if (next) toast({ tone: 'info', text: t.thanks });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText(message));
      toast({ tone: 'success', text: t.copied });
    } catch {
      toast({ tone: 'error', text: t.copyFailed });
    }
  };
  return (
    <div role="group" aria-label={t.rate} className={styles.feedback}>
      <button type="button" aria-label={t.useful} aria-pressed={vote === 'up'} onClick={() => pick('up')}>
        <Icon name="thumbUp" size={18} />
      </button>
      <button type="button" aria-label={t.useless} aria-pressed={vote === 'down'} onClick={() => pick('down')}>
        <Icon name="thumbDown" size={18} />
      </button>
      <button type="button" aria-label={t.copy} onClick={copy}>
        <Icon name="copy" size={18} />
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ messages

export function UserMessage({ text }: { text: string }) {
  const t = useT(dict);
  return (
    <div className={`${styles.userBubble} ${styles.message}`}>
      <span className="visually-hidden">{t.you}: </span>
      {text}
    </div>
  );
}

interface AssistantMessageProps {
  message: ChatMessage;
  asked: Set<string>;
  onAsk: (q: string) => void;
  busy: boolean;
  feedback: boolean;
}

export function AssistantMessage({ message: m, asked, onAsk, busy, feedback }: AssistantMessageProps) {
  const t = useT(dict);
  const bubble = m.blocks.length === 0;
  // An assessment verdict leads; the text after it is the softer alternative.
  const verdictFirst = m.blocks[0]?.type === 'verdict' && !!m.blocks[0].data.text;
  const text = m.text ? <RichText text={m.text} className={styles.text} /> : null;
  return (
    <div className={`${styles.aiRow} ${styles.message}`}>
      <Avatar />
      <div className={styles.aiBody}>
        <span className="visually-hidden">qorgan AI: </span>
        {bubble ? (
          m.text && <div className={styles.bubble}>{text}</div>
        ) : (
          <>
            {!verdictFirst && text}
            {m.blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
            {verdictFirst && text}
          </>
        )}
        {m.links.length > 0 && (
          <div className={styles.links}>
            {m.links.map((l, i) => (
              <Link key={l.to + i} to={l.to} className={l.primary ? styles.linkTeal : styles.linkOutline}>
                {l.label}
              </Link>
            ))}
          </div>
        )}
        {m.suggestions.length > 0 && (
          <div role="group" aria-label={t.quickQuestions} className={styles.chips}>
            {m.suggestions.map((s) =>
              asked.has(s) ? (
                <span key={s} className={styles.chipAsked}>
                  {s} · {t.asked}
                </span>
              ) : (
                <button key={s} type="button" className={styles.chip} disabled={busy} onClick={() => onAsk(s)}>
                  {s}
                </button>
              ),
            )}
          </div>
        )}
        {feedback && <Feedback message={m} />}
      </div>
    </div>
  );
}

/** «Без доступа к данным»: the assistant explains it answers in general terms and offers to restore the consent. */
export function NoAccessMessage({ onGrant, busy }: { onGrant: () => void; busy: boolean }) {
  const t = useT(dict);
  return (
    <div className={`${styles.aiRow} ${styles.message}`}>
      <Avatar muted />
      <p className={`${styles.bubble} ${styles.bubbleMuted}`}>
        {t.noAccess.text}{' '}
        <button type="button" className={styles.inlineAction} onClick={onGrant} disabled={busy}>
          {t.noAccess.action}
        </button>
        .
      </p>
    </div>
  );
}
