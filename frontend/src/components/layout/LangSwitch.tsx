import { useLang, type Lang } from '@/i18n/I18nProvider';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { useAuth } from '@/auth/AuthProvider';
import { useUpdateMe } from '@/api/hooks';
import styles from './LangSwitch.module.css';

/** Рус / Қаз toggle. Remembers the choice locally and on the account when signed in. */
export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  const t = useT(common);
  const { isAuthenticated } = useAuth();
  const updateMe = useUpdateMe();

  const choose = (next: Lang) => {
    if (next === lang) return;
    setLang(next);
    if (isAuthenticated) updateMe.mutate({ language: next });
  };

  return (
    <div role="group" aria-label={t.langSwitch} className={`${styles.group} ${compact ? styles.compact : ''}`}>
      <button type="button" lang="ru" aria-pressed={lang === 'ru'} className={styles.option} onClick={() => choose('ru')}>
        Рус
      </button>
      <button type="button" lang="kk" aria-pressed={lang === 'kk'} className={styles.option} onClick={() => choose('kk')}>
        Қаз
      </button>
    </div>
  );
}
