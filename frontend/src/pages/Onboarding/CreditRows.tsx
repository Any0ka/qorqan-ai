import type { Credit } from '@/api/types';
import { useDeleteCredit } from '@/api/hooks';
import { IconButton, useToast } from '@/components/ui';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { money } from '@/lib/format';
import { dict } from './i18n';
import styles from './Onboarding.module.css';

/** Credits already on the account: «Из отчёта» / «Вручную»; manual ones can be removed right here. */
export function CreditRows({ credits }: { credits: Credit[] }) {
  const t = useT(dict);
  const c = useT(common);
  const toast = useToast();
  const remove = useDeleteCredit();
  if (!credits.length) return null;
  return (
    <section aria-labelledby="added-title" className={styles.addedBlock}>
      <h3 id="added-title" className={styles.boxTitle}>
        {t.credits.listTitle}
      </h3>
      <ul className={styles.creditRows}>
        {credits.map((cr) => {
          const name = `${cr.organization} · ${c.creditTypeShort[cr.type]}`;
          return (
            <li key={cr.id} className={styles.creditRow}>
              <span className={styles.sourceTag}>{cr.source === 'report' ? t.credits.fromReport : t.credits.manualTag}</span>
              <span className={styles.creditName}>{name}</span>
              <span className={`${styles.creditNums} tabular`}>
                {money(cr.balance)} · {money(cr.monthly_payment)}
                {c.perMonthShort}
              </span>
              {cr.source === 'manual' && (
                <IconButton
                  icon="trash"
                  label={t.credits.remove(name)}
                  variant="plain"
                  disabled={remove.isPending && remove.variables === cr.id}
                  onClick={() =>
                    remove.mutate(cr.id, {
                      onSuccess: () => toast({ tone: 'success', text: t.credits.removed }),
                      onError: () => toast({ tone: 'error', text: c.saveFailed }),
                    })
                  }
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
