import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { keys, useMe, useNotificationSettings, useSaveNotificationSettings } from '@/api/hooks';
import type { NotificationSettings } from '@/api/types';
import { ErrorState, Skeleton, Switch, useToast } from '@/components/ui';
import { common } from '@/i18n/common';
import { useT } from '@/i18n/I18nProvider';
import { dict } from './i18n';
import styles from './Notifications.module.css';

type Topic = 'payment_reminders' | 'load_changes' | 'data_updates' | 'goals_progress' | 'recommendations';
const TOPICS: Topic[] = ['payment_reminders', 'load_changes', 'data_updates', 'goals_progress', 'recommendations'];

/** «Что присылать»: categories and delivery channels, saved optimistically. */
export function NotificationSettingsPanel() {
  const t = useT(dict);
  const c = useT(common);
  const toast = useToast();
  const qc = useQueryClient();
  const settings = useNotificationSettings();
  const save = useSaveNotificationSettings();
  const { data: me } = useMe();
  const [browserHint, setBrowserHint] = useState<string | null>(null);

  const set = (patch: Partial<NotificationSettings>) => {
    const prev = settings.data;
    if (!prev) return;
    save.mutate(
      { ...prev, ...patch },
      {
        onError: () => {
          qc.setQueryData(keys.notificationSettings, prev);
          toast({ tone: 'error', text: c.saveFailed });
        },
      },
    );
  };

  const setBrowser = async (on: boolean) => {
    setBrowserHint(null);
    if (!on) return set({ channel_browser: false });
    if (!('Notification' in window)) return setBrowserHint(t.settings.browserUnsupported);
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') return setBrowserHint(t.settings.browserBlocked);
    set({ channel_browser: true });
  };

  const s = settings.data;
  return (
    <aside aria-labelledby="set-title" className={styles.settings}>
      <h2 id="set-title" className={styles.settingsTitle}>
        {t.settings.title}
      </h2>
      {settings.isLoading && (
        <div aria-busy="true" aria-label={c.loading} className={styles.settingsSkeleton}>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={36} />
          ))}
        </div>
      )}
      {settings.error && !s && <ErrorState compact title={t.settings.loadError} error={settings.error} onRetry={() => settings.refetch()} />}
      {s && (
        <>
          <div className={styles.switches}>
            {TOPICS.map((k) => (
              <Switch
                key={k}
                label={t.settings[k]}
                description={k === 'payment_reminders' ? t.settings.paymentHint : undefined}
                checked={s[k]}
                onChange={(v) => set({ [k]: v })}
              />
            ))}
          </div>
          <h3 className={styles.where}>{t.settings.where}</h3>
          <div className={styles.switches}>
            <Switch label={t.settings.app} checked disabled onChange={() => undefined} />
            <Switch label={t.settings.browser} checked={s.channel_browser} onChange={setBrowser} />
            {me?.email && me.email_masked && (
              <Switch label={t.settings.email(me.email_masked)} checked={s.channel_email} onChange={(v) => set({ channel_email: v })} />
            )}
          </div>
          {browserHint && (
            <p role="status" className={styles.hint}>
              {browserHint}
            </p>
          )}
        </>
      )}
      <p className={styles.noAds}>{t.settings.noAds}</p>
    </aside>
  );
}
