import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getStoredAppLanguage, setStoredAppLanguage } from '../lib/appLanguageStorage';
import type { AppLanguage } from '../i18n/strings';
import { tForLanguage, type TranslateVars } from '../i18n/strings';
import { setRuntimeLanguage } from '../i18n/runtime';

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  t: (key: string, vars?: TranslateVars) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: 'fr',
  setLanguage: async () => undefined,
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('fr');

  useEffect(() => {
    void (async () => {
      const saved = await getStoredAppLanguage();
      if (saved) {
        setLanguageState(saved);
        setRuntimeLanguage(saved);
      }
    })();
  }, []);

  const setLanguage = useCallback(async (lang: AppLanguage) => {
    setLanguageState(lang);
    setRuntimeLanguage(lang);
    await setStoredAppLanguage(lang);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key: string, vars?: TranslateVars) => tForLanguage(language, key, vars),
    }),
    [language, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
