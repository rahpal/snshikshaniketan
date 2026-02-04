import { useLanguage } from '../context/LanguageContext';
import { createTranslator } from '../data/translations';

export function useTranslation() {
  const { language, toggleLanguage } = useLanguage();
  const t = createTranslator(language);

  const getText = (obj) => {
    if (typeof obj === 'string' || typeof obj === 'number') return obj;
    return obj?.[language] || obj?.en || obj;
  };

  return { t, getText, language, toggleLanguage };
}
