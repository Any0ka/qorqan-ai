import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '@/i18n/I18nProvider';
import { common } from '@/i18n/common';
import { Icon } from '../Icon';
import styles from './Toast.module.css';

type ToastTone = 'success' | 'info' | 'warning' | 'error';

interface ToastInput {
  tone?: ToastTone;
  text: ReactNode;
  action?: { label: string; to?: string; onClick?: () => void };
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

/** Toasts: top right, success/info disappear after 6 s, errors stay until closed. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const navigate = useNavigate();
  const t = useT(common);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setItems((xs) => [...xs.slice(-3), { ...input, id }]);
      if (input.tone !== 'error' && input.tone !== 'warning') setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.region}>
        {items.map((it) => {
          const tone = it.tone ?? 'success';
          const icon = tone === 'success' ? 'checkCircle' : tone === 'error' ? 'alert' : tone === 'warning' ? 'triangle' : 'info';
          return (
            <div key={it.id} role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'} className={`${styles.toast} ${styles[tone]}`}>
              <Icon name={icon} size={20} />
              <span className={styles.text}>{it.text}</span>
              {it.action && (
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => {
                    it.action?.onClick?.();
                    if (it.action?.to) navigate(it.action.to);
                    dismiss(it.id);
                  }}
                >
                  {it.action.label}
                </button>
              )}
              <button type="button" aria-label={t.close} className={styles.close} onClick={() => dismiss(it.id)}>
                <Icon name="x" size={18} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
