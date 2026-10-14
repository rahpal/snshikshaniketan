import { useEffect, useState } from 'react';
import { Copy, KeyRound, Power, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { ApiError, api } from '../lib/api.js';
import { formatDate } from '../../shared/money.js';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import Spinner from '../components/ui/Spinner.jsx';

/**
 * Shows a newly issued password once, loudly, with a way to copy it.
 *
 * Nothing stores it in readable form, so if this box is closed without the
 * password being written down or handed over, the only way forward is another
 * reset. The copy says so.
 */
function TemporaryPassword({ username, password, onDismiss }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  return (
    <Alert tone="warning" title={t('users.tempTitle')}>
      <p className="mt-1 flex flex-wrap items-center gap-2">
        <span className="font-medium">{username}</span>
        <code className="rounded bg-black/10 px-2 py-1 font-mono text-base tracking-wide dark:bg-white/10">
          {password}
        </code>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs underline hover:no-underline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(password);
              setCopied(true);
            } catch {
              // Clipboard access can be refused; the password is on screen anyway.
              setCopied(false);
            }
          }}
        >
          <Copy className="h-3 w-3" aria-hidden="true" />
          {copied ? t('users.copied') : t('users.copy')}
        </button>
      </p>
      <p className="mt-2 text-xs">{t('users.tempNote')}</p>
      <Button size="sm" variant="secondary" className="mt-2" onClick={onDismiss}>
        {t('users.dismiss')}
      </Button>
    </Alert>
  );
}

function AddUser({ onCreated }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('operator');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  async function save(event) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      const result = await api.post('/api/admin/users/create', {
        username,
        full_name: fullName,
        role,
      });
      setUsername('');
      setFullName('');
      setRole('operator');
      setOpen(false);
      onCreated(result);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.details ?? {});
      } else {
        setError('Could not create the account. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        {t('users.add')}
      </Button>
    );
  }

  return (
    <form onSubmit={save} className="card w-full space-y-4 p-5" noValidate>
      <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('users.add')}</h2>
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label={t('users.username')}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          error={fieldErrors.username}
          autoCapitalize="none"
          spellCheck="false"
          required
        />
        <Field
          label={t('users.fullName')}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={fieldErrors.full_name}
          required
        />
        <Field
          label={t('users.role')}
          as="select"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          error={fieldErrors.role}
        >
          <option value="operator">{t('role.operator')}</option>
          <option value="admin">{t('role.admin')}</option>
        </Field>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">{t('users.roleHelp')}</p>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? t('users.creating') : t('users.create')}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

export default function Users() {
  const { t } = useLanguage();
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [issued, setIssued] = useState(null);
  const [busy, setBusy] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get('/api/admin/users/list');
        if (!cancelled) setUsers(data.users);
      } catch (caught) {
        if (!cancelled) setError(caught.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = () => setReloadToken((token) => token + 1);

  async function act(user, action) {
    setError(null);
    setBusy(user.user_id);
    try {
      if (action === 'reset') {
        const result = await api.post('/api/admin/users/reset-password', { user_id: user.user_id });
        setIssued({ username: user.username, password: result.temporary_password });
      } else if (action === 'toggle') {
        await api.post('/api/admin/users/update', { user_id: user.user_id, active: !user.active });
      } else if (action === 'role') {
        await api.post('/api/admin/users/update', {
          user_id: user.user_id,
          role: user.role === 'admin' ? 'operator' : 'admin',
        });
      }
      reload();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t('users.title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('users.intro')}</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {issued && (
        <TemporaryPassword
          username={issued.username}
          password={issued.password}
          onDismiss={() => setIssued(null)}
        />
      )}

      <AddUser
        onCreated={(result) => {
          setIssued({ username: result.user.username, password: result.temporary_password });
          reload();
        }}
      />

      {loading ? (
        <Spinner label={t('common.loading')} className="py-10" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{t('users.username')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('users.fullName')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('users.role')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('users.status')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('users.lastLogin')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('audit.what')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((user) => {
                const isMe = user.user_id === me?.user_id;
                return (
                  <tr key={user.user_id} className={user.active ? '' : 'opacity-60'}>
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                      {user.username}
                      {isMe && (
                        <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                          ({t('users.you')})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{user.full_name}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {user.role === 'admin' && <ShieldCheck className="h-3 w-3" aria-hidden="true" />}
                        {user.role === 'admin' ? t('role.admin') : t('role.operator')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {!user.active ? (
                        <span className="text-slate-500 dark:text-slate-400">{t('users.inactive')}</span>
                      ) : user.locked ? (
                        <span className="text-amber-700 dark:text-amber-400">
                          {t('users.locked')} · {user.locked_minutes} {t('users.lockedFor')}
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400">{t('users.active')}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                      {user.last_login_at ? formatDate(user.last_login_at.slice(0, 10)) : t('users.never')}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy === user.user_id}
                          onClick={() => act(user, 'reset')}
                        >
                          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('users.resetPassword')}
                        </Button>
                        {/* Changing your own role or switching yourself off is
                            refused by the server; not offering it avoids an
                            error the admin cannot act on. */}
                        {!isMe && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy === user.user_id}
                              onClick={() => act(user, 'role')}
                            >
                              {user.role === 'admin' ? t('users.makeOperator') : t('users.makeAdmin')}
                            </Button>
                            <Button
                              size="sm"
                              variant={user.active ? 'danger' : 'secondary'}
                              disabled={busy === user.user_id}
                              onClick={() => act(user, 'toggle')}
                            >
                              <Power className="h-3.5 w-3.5" aria-hidden="true" />
                              {user.active ? t('users.deactivate') : t('users.activate')}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
