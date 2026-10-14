import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { strings } from '../i18n/strings.js';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'sns-fee-language';

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'en';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'hi' || stored === 'en' ? stored : 'en';
  });

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Not persisting the choice is not worth failing over.
    }
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage((current) => (current === 'en' ? 'hi' : 'en'));
  }, []);

  /** Falls back to English, then to the key itself, so a missing string is visible but harmless. */
  const t = useCallback(
    (key) => strings[language]?.[key] ?? strings.en[key] ?? key,
    [language]
  );

  const value = useMemo(() => ({ language, setLanguage, toggleLanguage, t }), [language, toggleLanguage, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
