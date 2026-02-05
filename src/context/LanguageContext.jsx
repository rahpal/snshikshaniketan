import { createContext, useContext, useEffect, useState } from 'react';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('language');
      if (saved !== null) {
        return saved;
      }
    }
    return 'hi';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = () => setLanguage(prev => prev === 'en' ? 'hi' : 'en');

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
