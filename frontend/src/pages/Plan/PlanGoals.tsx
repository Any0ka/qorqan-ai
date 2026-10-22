import { useCallback, useId, useState, type FormEvent } from 'react';
import { useAddGoal, useDeleteGoal } from '@/api/hooks';
import type { CreditType, Goal } from '@/api/types';
import { Alert, Button, Card, ConfirmDialog, Dialog, IconButton, MoneyField, Pill, ProgressBar, TextField, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useLang, useT } from '@/i18n/I18nProvider';
import { money, monthYear, percent, toDate } from '@/lib/format';
import { dict, goalNoun } from './i18n';
import styles from './Plan.module.css';

interface GoalView {
  title: string;
  date: string | null;
  bar: { value: number; label: string; tone: 'navy' | 'teal' | 'success' } | null;
  note: string;
  variant: 'default' | 'scenario' | 'planned';
}

function useGoalView() {
  const t = useT(dict);
  const { lang } = useLang();
  const g = t.goals;
  return (goal: Goal): GoalView => {
    const date = goal.target_date ? monthYear(goal.target_date, lang) : null;
    const done = goal.status === 'done';
    const tone = done ? ('success' as const) : ('navy' as const);
    const amount = { value: goal.progress, label: g.amountOf(goal.current, goal.target), tone };
    switch (goal.kind) {
      case 'close_credit': {
        const label = g.payments(Math.round(goal.current), Math.round(goal.target));
        const type = (goal.params.credit_type as CreditType | undefined) ?? 'other';
        return { title: g.closeCredit(type), date, bar: { value: goal.progress, label, tone }, note: label, variant: 'default' };
      }
      case 'reduce_load': {
        const now = percent(goal.current);
        const target = percent(goal.target);
        const starts = typeof goal.params.starts === 'string' && toDate(goal.params.starts) > new Date() ? (goal.params.starts as string) : null;
        const note = goal.current <= goal.target ? g.loadReached(now) : starts ? g.loadStarts(now, starts) : g.loadNow(now, target);
        return { title: g.reduceLoad(target), date, bar: { value: goal.progress, label: g.loadAria(now, target), tone }, note, variant: 'default' };
      }
      case 'save_for': {
        const monthly = typeof goal.params.monthly === 'number' && goal.params.monthly > 0 ? g.monthly(money(goal.params.monthly)) : null;
        const fromScenario = goal.source === 'scenario';
        return {
          title: g.saveFor(goalNoun(t, goal.params.item, goal.params.title)),
          date,
          bar: { ...amount, tone: done ? 'success' : 'teal' },
          note: [amount.label, monthly, fromScenario && g.fromScenarios].filter(Boolean).join(' · '),
          variant: fromScenario && !done ? 'scenario' : 'default',
        };
      }
      case 'reserve': {
        const title = g.reserve(money(goal.target));
        if (goal.status === 'planned') {
          const after = goal.params.after;
          return { title, date: g.planned, bar: null, note: after ? g.reserveAfter(goalNoun(t, after, null)) : g.reserveLater, variant: 'planned' };
        }
        return { title, date, bar: amount, note: amount.label, variant: 'default' };
      }
      default:
        return { title: goal.title ?? '', date: date ?? g.noDate, bar: amount, note: amount.label, variant: 'default' };
    }
  };
}

/** «Финансовые цели»: system goals, goals added from scenarios and the user's own (those can be deleted). */
export function GoalsCard({ goals, onAdd }: { goals: Goal[]; onAdd: () => void }) {
  const t = useT(dict);
  const c = useT(common);
  const g = t.goals;
  const toast = useToast();
  const view = useGoalView();
  const remove = useDeleteGoal();
  const [toDelete, setToDelete] = useState<{ id: string; title: string } | null>(null);
  const closeConfirm = useCallback(() => setToDelete(null), []);

  return (
    <Card flex="1 460px" aria-labelledby="goals-title" className={`${styles.pad24} ${styles.goalsCard}`}>
      <div className={styles.cardTop}>
        <h2 id="goals-title" className={styles.sectionTitle}>
          {g.title}
        </h2>
        <Button variant="secondary" size="sm" icon="plus" className={styles.smallBtn} onClick={onAdd} aria-label={g.addLabel}>
          {g.add}
        </Button>
      </div>
      {goals.length === 0 ? (
        <p className={styles.goalNote}>{g.empty}</p>
      ) : (
        <ul className={styles.goals}>
          {goals.map((goal) => {
            const v = view(goal);
            const deletable = goal.source !== 'system';
            return (
              <li key={goal.id} className={`${styles.goal} ${v.variant === 'scenario' ? styles.goalScenario : v.variant === 'planned' ? styles.goalPlanned : ''}`}>
                <div className={styles.goalHead}>
                  <b>{v.title}</b>
                  <span className={styles.goalMeta}>
                    {goal.status === 'done' ? (
                      <Pill tone="success" icon="checkCircle" size="xs">
                        {g.done}
                      </Pill>
                    ) : (
                      v.date && <span className={styles.goalDate}>{v.date}</span>
                    )}
                    {deletable && (
                      <span className={styles.remove}>
                        <IconButton icon="trash" variant="plain" label={g.remove(v.title)} onClick={() => setToDelete({ id: goal.id, title: v.title })} />
                      </span>
                    )}
                  </span>
                </div>
                {v.bar && <ProgressBar value={v.bar.value} label={v.bar.label} tone={v.bar.tone} />}
                <span className={styles.goalNote}>{v.note}</span>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        onClose={closeConfirm}
        title={g.confirmTitle}
        text={toDelete ? g.confirmText(toDelete.title) : ''}
        confirmLabel={g.confirm}
        cancelLabel={c.cancel}
        busy={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              setToDelete(null);
              toast({ tone: 'success', text: g.removed });
            },
            onError: () => toast({ tone: 'error', text: c.saveFailed }),
          })
        }
      />
    </Card>
  );
}

/** «+ Цель»: title, amount and an optional date. Mounted only while open. */
export function AddGoalDialog({ onClose }: { onClose: () => void }) {
  const t = useT(dict);
  const c = useT(common);
  const d = t.dialog;
  const toast = useToast();
  const add = useAddGoal();
  const formId = useId();
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const nameError = submitted && !title.trim() ? d.nameRequired : undefined;
  const amountError = submitted && !(target && target > 0) ? d.amountRequired : undefined;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!title.trim() || !target || target <= 0) return;
    add.mutate(
      { title: title.trim(), target, target_date: date || null },
      {
        onSuccess: () => {
          toast({ tone: 'success', text: d.added });
          onClose();
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={d.title}
      description={d.description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {c.cancel}
          </Button>
          <Button type="submit" form={formId} disabled={add.isPending}>
            {d.submit}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className={styles.form}>
        <TextField
          label={d.name}
          placeholder={d.namePlaceholder}
          value={title}
          maxLength={120}
          autoComplete="off"
          required
          error={nameError}
          onChange={(e) => setTitle(e.target.value)}
        />
        <MoneyField label={d.amount} value={target} onChange={setTarget} emptyAsNull invalidMessage={c.errors.money_letters} error={amountError} required />
        <TextField
          type="date"
          label={d.date}
          badge={<span className={styles.optional}>{c.optional}</span>}
          value={date}
          min={minDate}
          onChange={(e) => setDate(e.target.value)}
        />
        {add.isError && (
          <Alert tone="danger" role="alert">
            {c.saveFailed}
          </Alert>
        )}
      </form>
    </Dialog>
  );
}
