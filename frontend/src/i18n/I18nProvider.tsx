import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'ru' | 'kk';

/** A page's strings in both languages. `kk` must have exactly the shape of `ru`. */
export type Dict<T> = { ru: T; kk: T };

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const STORAGE_KEY = 'qorgan.lang';
const I18nContext = createContext<I18nValue | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ru' || saved === 'kk') return saved;
  } catch {
    /* storage unavailable */
  }
  return 'ru';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'kk' ? 'kk' : 'ru';
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLang(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useLang must be used inside <I18nProvider>');
  return ctx;
}

/** Pick the current language from a page dictionary: `const t = useT(dict)`. */
export function useT<T>(dict: Dict<T>): T {
  return dict[useLang().lang];
}
