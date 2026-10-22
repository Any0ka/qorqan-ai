import { useMe, useUpdateMe } from '@/api/hooks';
import type { Lang } from '@/api/types';
import { Icon } from '@/components/Icon';
import { Button, Segmented, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useLang, useT } from '@/i18n/I18nProvider';
import { SectionHead } from './SectionHead';
import { dict } from './i18n';
import styles from './Profile.module.css';

/** «Язык интерфейса»: switches the UI at once and saves the choice on the account. */
export function LanguageSection() {
  const t = useT(dict);
  const { lang, setLang } = useLang();
  const update = useUpdateMe();
  const toast = useToast();
  const pick = (next: Lang) => {
    if (next === lang) return;
    setLang(next);
    update.mutate(
      { language: next },
      {
        // The UI already speaks the new language, so the toast does too.
        onSuccess: () => toast({ tone: 'success', text: dict[next].language.saved }),
        onError: () => toast({ tone: 'error', text: common[next].saveFailed }),
      },
    );
  };
  return (
    <>
      <SectionHead title={t.sections.language} intro={t.language.intro} />
      <div className={`${styles.panel} ${styles.langPanel}`}>
        <Segmented
          legend={t.language.legend}
          hideLegend
          name="ui-language"
          value={lang}
          onChange={pick}
          options={[
            { value: 'ru', label: <span lang="ru">Русский</span> },
            { value: 'kk', label: <span lang="kk">Қазақша</span> },
          ]}
        />
      </div>
    </>
  );
}

/** «Уведомления» lives on its own screen; here is the way there. */
export function NotificationsSection() {
  const t = useT(dict);
  const { data: me } = useMe();
  const unread = me?.unread_notifications ?? 0;
  return (
    <>
      <SectionHead title={t.sections.notifications} />
      <div className={`${styles.panel} ${styles.linkCard}`}>
        <span aria-hidden="true" className={styles.linkCardIcon}>
          <Icon name="bell" size={22} />
        </span>
        <div className={styles.linkCardBody}>
          <p className={styles.bodyText}>{t.notifications.text}</p>
          {unread > 0 && <p className={styles.unread}>{t.notifications.unread(unread)}</p>}
        </div>
        <Button to="/notifications" iconRight="arrowRight">
          {t.notifications.open}
        </Button>
      </div>
    </>
  );
}

/** «Конфиденциальность»: what is stored and why; qorgan is not a lender. */
export function PrivacySection() {
  const t = useT(dict);
  return (
    <>
      <SectionHead title={t.sections.privacy} intro={t.privacy.intro} />
      <section aria-labelledby="privacy-stored-title" className={styles.panel}>
        <h3 id="privacy-stored-title" className={styles.panelTitle}>
          {t.privacy.storedTitle}
        </h3>
        <dl className={styles.stored}>
          {t.privacy.stored.map((s) => (
            <div key={s.title}>
              <dt>{s.title}</dt>
              <dd>{s.text}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className={styles.row}>
        <section aria-labelledby="privacy-lender-title" className={`${styles.panel} ${styles.panelHalf} ${styles.panelNavy}`}>
          <h3 id="privacy-lender-title" className={styles.panelTitle}>
            <Icon name="shield" size={20} />
            {t.privacy.notLenderTitle}
          </h3>
          <p className={styles.bodyText}>{t.privacy.notLender}</p>
        </section>
        <section aria-labelledby="privacy-control-title" className={`${styles.panel} ${styles.panelHalf}`}>
          <h3 id="privacy-control-title" className={styles.panelTitle}>
            <Icon name="lock" size={20} />
            {t.privacy.controlTitle}
          </h3>
          <p className={styles.bodyText}>{t.privacy.control}</p>
          <Button to="?section=consents" variant="secondary" iconRight="arrowRight" className={styles.selfStart}>
            {t.privacy.toConsents}
          </Button>
        </section>
      </div>
    </>
  );
}

/** «Помощь и поддержка»: FAQ + the way to qorgan AI. */
export function HelpSection() {
  const t = useT(dict);
  return (
    <>
      <SectionHead title={t.sections.help} intro={t.help.intro} />
      <div className={styles.faq}>
        {t.help.faq.map((item) => (
          <details key={item.q} className={styles.faqItem}>
            <summary>
              {item.q}
              <Icon name="chevronDown" size={18} strokeWidth={2} className={styles.faqIcon} />
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
      <section aria-labelledby="help-ai-title" className={`${styles.panel} ${styles.aiCard}`}>
        <span aria-hidden="true" className={styles.aiBadge}>
          <Icon name="sparkle" size={18} strokeWidth={2} />
        </span>
        <div className={styles.linkCardBody}>
          <h3 id="help-ai-title" className={styles.panelTitle}>
            {t.help.aiTitle}
          </h3>
          <p className={styles.bodyText}>{t.help.aiText}</p>
        </div>
        <Button to="/ai" variant="teal">
          {t.help.askAi}
        </Button>
      </section>
    </>
  );
}
