import { Link } from 'react-router-dom';
import type { ChatBlock, ChatLink, ChatMessage, RiskLevel } from '@/api/types';
import { Pill, RISK_ICON, RISK_TONE } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { money, percent } from '@/lib/format';
import { dict } from './i18n';
import { Rich } from './Rich';
import styles from './AiPanel.module.css';

interface CompareRow {
  label: string;
  monthly: number;
  total: number;
  approx?: boolean;
  load?: number;
  risk?: RiskLevel;
}

function Compare({ data }: { data: Record<string, any> }) {
  const t = useT(dict).panel.compare;
  const rows = (data.rows ?? []) as CompareRow[];
  const showLoad = !!data.show_load;
  const approx = (r: CompareRow, v: string) => (r.approx ? `≈ ${v}` : v);
  return (
    <div className={styles.compare}>
      <table className={styles.compareTable}>
        <thead>
          <tr>
            <th scope="col">{data.term_months ? t.term(data.term_months) : t.variant}</th>
            <th scope="col">{t.monthly}</th>
            <th scope="col">{t.total}</th>
            {showLoad && <th scope="col">{t.load}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{approx(r, money(r.monthly))}</td>
              <td>
                <b>{approx(r, money(r.total))}</b>
              </td>
              {showLoad && <td className={r.risk ? styles['risk_' + r.risk] : undefined}>{r.load !== undefined ? percent(r.load) : '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {data.note && <p className={styles.note}>{data.note}</p>}
    </div>
  );
}

function Verdict({ data }: { data: Record<string, any> }) {
  const risk = (data.risk ?? 'insufficient') as RiskLevel;
  const links = (data.links ?? []) as Array<{ label: string; to: string }>;
  return (
    <div className={`${styles.verdict} ${styles['verdict_' + risk]}`}>
      <Pill tone={RISK_TONE[risk]} icon={RISK_ICON[risk]} size="xs">
        {data.title}
      </Pill>
      {data.text && (
        <p className={styles.verdictText}>
          <Rich text={data.text} />
        </p>
      )}
      {links.length > 0 && (
        <div className={styles.links}>
          {links.map((l, i) => (
            <Link key={l.to} to={l.to} className={i === 0 ? styles.linkNavy : styles.linkTeal}>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function List({ data }: { data: Record<string, any> }) {
  const items = (data.items ?? []) as string[];
  const Tag = data.ordered ? 'ol' : 'ul';
  return (
    <Tag className={data.ordered ? styles.listOrdered : styles.list}>
      {items.map((it, i) => (
        <li key={i}>
          <Rich text={it} />
        </li>
      ))}
    </Tag>
  );
}

function Steps({ data }: { data: Record<string, any> }) {
  const items = (data.items ?? []) as Array<{ n: string; title: string; hint?: string }>;
  return (
    <div className={styles.steps}>
      {data.title && <b className={styles.stepsTitle}>{data.title}</b>}
      <ol>
        {items.map((it) => (
          <li key={it.n}>
            <span aria-hidden="true" className={styles.stepNum}>
              {it.n}
            </span>
            <span className={styles.stepText}>
              <b>{it.title}</b>
              {it.hint && <span>{it.hint}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Block({ block }: { block: ChatBlock }) {
  switch (block.type) {
    case 'compare':
      return <Compare data={block.data} />;
    case 'verdict':
      return <Verdict data={block.data} />;
    case 'list':
      return <List data={block.data} />;
    case 'steps':
      return <Steps data={block.data} />;
    default:
      return null;
  }
}

function Links({ links }: { links: ChatLink[] }) {
  const anyPrimary = links.some((l) => l.primary);
  return (
    <div className={styles.links}>
      {links.map((l, i) => (
        <Link key={l.to + l.label} to={l.to} className={l.primary || (!anyPrimary && i === 0) ? styles.linkTeal : styles.linkOutline}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}

/** An assistant answer: lead paragraph → structured blocks → the rest of the text → actions. */
export function AssistantMessage({ message }: { message: ChatMessage }) {
  const [first, ...rest] = message.text.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <div className={styles.answer}>
      {first && (
        <p>
          <Rich text={first} />
        </p>
      )}
      {message.blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
      {rest.map((p, i) => (
        <p key={i}>
          <Rich text={p} />
        </p>
      ))}
      {message.links.length > 0 && <Links links={message.links} />}
    </div>
  );
}
