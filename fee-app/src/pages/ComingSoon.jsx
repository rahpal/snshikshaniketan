import { Link } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';

/**
 * Stands in for screens the later phases add. Kept as a real route so the
 * navigation, guards and layout are all exercised from the first deploy.
 */
export default function ComingSoon({ titleKey }) {
  const { t } = useLanguage();
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <Construction className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {titleKey ? t(titleKey) : t('soon.heading')}
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('soon.body')}</p>
      <Link
        to="/"
        className="mt-5 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        {t('common.backToDashboard')}
      </Link>
    </div>
  );
}
