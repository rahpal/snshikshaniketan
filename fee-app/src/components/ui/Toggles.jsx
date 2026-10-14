import { Languages, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';

const BUTTON =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <button type="button" onClick={toggleTheme} className={BUTTON} title={t('common.theme')}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">{t('common.theme')}</span>
    </button>
  );
}

export function LanguageToggle() {
  const { language, toggleLanguage, t } = useLanguage();
  return (
    <button type="button" onClick={toggleLanguage} className={BUTTON} title={t('common.language')}>
      <Languages className="h-4 w-4" aria-hidden="true" />
      <span aria-hidden="true">{language === 'en' ? 'हिं' : 'EN'}</span>
      <span className="sr-only">{t('common.language')}</span>
    </button>
  );
}
