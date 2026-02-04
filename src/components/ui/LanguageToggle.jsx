import { Languages } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-300 flex items-center gap-1"
      aria-label={language === 'en' ? 'Switch to Hindi' : 'Switch to English'}
    >
      <Languages className="w-5 h-5 text-slate-700 dark:text-slate-300" />
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {language === 'en' ? 'हि' : 'EN'}
      </span>
    </button>
  );
}
