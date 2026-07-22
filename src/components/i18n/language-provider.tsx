'use client';
import * as React from 'react';
import { t as translate, isLang, type Lang } from '@/lib/i18n';

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (s: string) => string }
const LanguageContext = React.createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (s) => s });

const KEY = 'amh:lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>('en');

  React.useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (v && isLang(v)) setLangState(v); } catch { /* ignore */ }
  }, []);

  const setLang = React.useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    try { document.documentElement.setAttribute('lang', l); } catch { /* ignore */ }
  }, []);

  const value = React.useMemo<Ctx>(() => ({ lang, setLang, t: (s: string) => translate(s, lang) }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Translate strings in a client component: `const { t } = useT()`. */
export function useT(): Ctx {
  return React.useContext(LanguageContext);
}
