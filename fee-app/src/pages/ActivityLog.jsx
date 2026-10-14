import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { api } from '../lib/api.js';
import Alert from '../components/ui/Alert.jsx';
import Spinner from '../components/ui/Spinner.jsx';

/** Renders the JSON the log stores as something a person can read. */
function Details({ before, after }) {
  const { t } = useLanguage();
  const parse = (value) => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  const summarise = (value) => {
    const parsed = parse(value);
    if (parsed === null) return null;
    if (typeof parsed !== 'object') return String(parsed);
    return Object.entries(parsed)
      .map(([key, item]) => `${key}: ${Array.isArray(item) ? item.join(', ') : item}`)
      .join(' · ');
  };

  const was = summarise(before);
  const became = summarise(after);
  if (!was && !became) return <span className="text-slate-400">—</span>;

  return (
    <span className="text-xs text-slate-600 dark:text-slate-300">
      {was && (
        <span className="block">
          <span className="text-slate-400">{t('audit.before')}</span> {was}
        </span>
      )}
      {became && (
        <span className="block">
          {was && <span className="text-slate-400">{t('audit.after')} </span>}
          {became}
        </span>
      )}
    </span>
  );
}

export default function ActivityLog() {
  const { t } = useLanguage();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get('/api/admin/audit?limit=200');
        if (!cancelled) setState({ status: 'done', ...data });
      } catch (caught) {
        if (!cancelled) setState({ status: 'error', message: caught.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t('audit.title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('audit.intro')}</p>
      </div>

      {state.status === 'loading' && <Spinner label={t('common.loading')} className="py-10" />}
      {state.status === 'error' && <Alert tone="error">{state.message}</Alert>}

      {state.status === 'done' &&
        (state.entries.length === 0 ? (
          <Alert tone="info">{t('audit.empty')}</Alert>
        ) : (
          <>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">{t('audit.when')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('audit.who')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('audit.what')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('audit.which')}</th>
                    <th scope="col" className="px-4 py-3 font-medium">{t('audit.details')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {state.entries.map((entry, index) => (
                    <tr key={`${entry.timestamp}-${index}`}>
                      <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {entry.timestamp.slice(0, 16).replace('T', ' ')}
                      </td>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{entry.user}</td>
                      <td className="px-4 py-2">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {entry.action}
                        </code>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {entry.entity_id || '—'}
                      </td>
                      <td className="px-4 py-2">
                        <Details before={entry.before} after={entry.after} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {state.truncated && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('audit.truncated')}</p>
            )}
          </>
        ))}
    </div>
  );
}
