import { useT, type Dict } from '@/i18n/I18nProvider';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import { useAuth } from '@/auth/AuthProvider';
import styles from './NotFound.module.css';

const dict: Dict<{ title: string; text: string; home: string; app: string; brand: string }> = {
  ru: {
    title: 'Такой страницы нет',
    text: 'Возможно, ссылка устарела или в адресе опечатка.',
    home: 'На главную',
    app: 'К обзору',
    brand: 'qorgan — на главную',
  },
  kk: {
    title: 'Мұндай бет жоқ',
    text: 'Сілтеменің мерзімі өткен немесе мекенжайда қате болуы мүмкін.',
    home: 'Басты бетке',
    app: 'Шолуға',
    brand: 'qorgan — басты бетке',
  },
};

export default function NotFoundPage() {
  const t = useT(dict);
  const { isAuthenticated } = useAuth();
  return (
    <main className={styles.page}>
      <Logo label={t.brand} />
      <h1 className={styles.title}>{t.title}</h1>
      <p className={styles.text}>{t.text}</p>
      <Button to={isAuthenticated ? '/dashboard' : '/'} size="lg" iconRight="arrowRight">
        {isAuthenticated ? t.app : t.home}
      </Button>
    </main>
  );
}
