import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { ApiError } from '../lib/api.js';
import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import { LanguageToggle, ThemeToggle } from '../components/ui/Toggles.jsx';

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);

    try {
      const result = await login(username, password);
      const destination = result.must_change_password
        ? '/change-password'
        : (location.state?.from ?? '/');
      navigate(destination, { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFieldErrors(caught.details ?? {});
      } else {
        setError('Something went wrong. Please try again.');
      }
      setPassword('');
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
        <div className="mb-6 text-center">
          <img
            src="/sn_logo.jpeg"
            alt=""
            className="mx-auto h-16 w-16 rounded-full object-cover shadow-sm"
          />
          <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t('app.school')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('app.tagline')}</p>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('login.heading')}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('login.subheading')}</p>

          {error && (
            <Alert tone="error" className="mt-4">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
            <Field
              label={t('login.username')}
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              error={fieldErrors.username}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              required
              autoFocus
            />

            <div className="relative">
              <Field
                label={t('login.password')}
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={fieldErrors.password}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                className="absolute right-2 top-8 rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                title={showPassword ? t('login.hidePassword') : t('login.showPassword')}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">
                  {showPassword ? t('login.hidePassword') : t('login.showPassword')}
                </span>
              </button>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              {submitting ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
            {t('login.noAccount')}
          </p>
        </div>
      </div>
    </div>
  );
}
