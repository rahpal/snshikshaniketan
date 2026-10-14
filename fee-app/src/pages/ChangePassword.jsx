import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { ApiError } from '../lib/api.js';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import { LanguageToggle, ThemeToggle } from '../components/ui/Toggles.jsx';

/**
 * Serves two cases: the forced change at first sign-in (where the user cannot
 * go anywhere else) and a routine change from the header. The copy switches,
 * the mechanics do not.
 */
export default function ChangePassword() {
  const { mustChangePassword, changePassword } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: t('password.mismatch') });
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setDone(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Give the confirmation a moment to be read before moving on.
      setTimeout(() => navigate('/', { replace: true }), 1200);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.details ?? {});
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col px-4 py-10">
      <div className="mx-auto flex w-full max-w-sm justify-end gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-blue-100 p-2 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t('password.heading')}
            </h1>
          </div>

          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            {mustChangePassword ? t('password.firstTime') : t('password.routine')}
          </p>

          {done && (
            <Alert tone="success" className="mt-4">
              {t('password.changed')}
            </Alert>
          )}
          {error && (
            <Alert tone="error" className="mt-4">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
            <Field
              label={t('password.current')}
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              error={fieldErrors.currentPassword}
              autoComplete="current-password"
              required
              autoFocus
            />
            <Field
              label={t('password.new')}
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              error={fieldErrors.newPassword}
              hint={t('password.rules')}
              autoComplete="new-password"
              required
            />
            <Field
              label={t('password.confirm')}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              error={fieldErrors.confirmPassword}
              autoComplete="new-password"
              required
            />
            <Button type="submit" size="lg" className="w-full" disabled={submitting || done}>
              {submitting ? t('password.submitting') : t('password.submit')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
