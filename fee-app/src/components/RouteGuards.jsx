import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Spinner from './ui/Spinner.jsx';

/**
 * These guards decide what to render. They are not a security boundary - the
 * API re-checks the session and the role on every request - but they keep a
 * signed-out or half-set-up user from landing on a screen that cannot work.
 */

function FullPageSpinner() {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner label={t('common.loading')} />
    </div>
  );
}

export function RequireAuth() {
  const { status, mustChangePassword } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;

  if (status === 'signedOut') {
    // Remember where they were headed so sign-in can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  // A handed-over temporary password gets you exactly one place: the screen
  // where you replace it. The API enforces the same rule.
  if (mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}

export function RequireAdmin() {
  const { status, isAdmin } = useAuth();
  if (status === 'loading') return <FullPageSpinner />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function RedirectIfSignedIn({ children }) {
  const { status, mustChangePassword } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'signedIn') {
    if (mustChangePassword) return <Navigate to="/change-password" replace />;
    return <Navigate to={location.state?.from ?? '/'} replace />;
  }
  return children;
}
