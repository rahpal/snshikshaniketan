import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { api } from '../lib/api.js';
import { visibleNavItems } from '../components/navigation.js';
import Alert from '../components/ui/Alert.jsx';
import Spinner from '../components/ui/Spinner.jsx';

/**
 * Admin-only panel confirming the functions can actually reach the
 * spreadsheet. The detail only comes back for admins, so it is only asked for
 * by them.
 */
function SetupStatus() {
  const { t } = useLanguage();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/health')
      .then((data) => {
        if (!cancelled) setState({ status: 'done', data });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', message: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="card p-4">
        <Spinner label={t('dash.setupChecking')} />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <Alert tone="error" title={t('dash.setupProblem')}>
        {state.message}
      </Alert>
    );
  }

  if (state.data.ok) {
    return <Alert tone="success" title={t('dash.setup')}>{t('dash.setupOk')}</Alert>;
  }

  return (
    <Alert tone="warning" title={t('dash.setupProblem')}>
      {state.data.detail && <p>{state.data.detail}</p>}
      {state.data.problems?.length > 0 && (
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          {state.data.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <p className="mt-1">
        Run <code className="rounded bg-black/10 px-1 dark:bg-white/10">npm run bootstrap-sheet</code> to
        repair the spreadsheet.
      </p>
    </Alert>
  );
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();
  const items = visibleNavItems(isAdmin).filter((item) => item.path !== '/');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {t('dash.greeting')}, {user?.full_name?.split(' ')[0] ?? user?.username}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('dash.intro')}</p>
      </div>

      {isAdmin && <SetupStatus />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ path, labelKey, icon: Icon, ready }) => (
          <Link
            key={path}
            to={path}
            className="card group flex items-start gap-3 p-4 transition hover:border-blue-400 hover:shadow-md"
          >
            <span className="rounded-lg bg-blue-50 p-2 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-medium text-slate-900 dark:text-slate-100">{t(labelKey)}</span>
                {!ready && (
                  <span className="shrink-0 whitespace-nowrap rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {t('dash.soon')}
                  </span>
                )}
              </span>
            </span>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
