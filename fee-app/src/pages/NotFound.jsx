import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-sm p-8 text-center">
        <p className="text-4xl font-bold text-slate-300 dark:text-slate-700">404</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t('common.notFound')}</p>
        <Link
          to="/"
          className="mt-5 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {t('common.backToDashboard')}
        </Link>
      </div>
    </div>
  );
}
