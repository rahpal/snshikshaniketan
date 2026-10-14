import { Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell.jsx';
import { RedirectIfSignedIn, RequireAdmin, RequireAuth } from './components/RouteGuards.jsx';
import { NAV_ITEMS } from './components/navigation.js';
import Login from './pages/Login.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import NotFound from './pages/NotFound.jsx';

/** Routes for screens a later phase will replace, derived from the nav list. */
const placeholders = NAV_ITEMS.filter((item) => !item.ready);
const sharedPlaceholders = placeholders.filter((item) => !item.adminOnly);
const adminPlaceholders = placeholders.filter((item) => item.adminOnly);

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfSignedIn>
            <Login />
          </RedirectIfSignedIn>
        }
      />

      <Route element={<RequireAuth />}>
        {/* Outside the shell: reachable while a password change is still pending. */}
        <Route path="/change-password" element={<ChangePassword />} />

        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />

          {sharedPlaceholders.map(({ path, labelKey }) => (
            <Route key={path} path={path} element={<ComingSoon titleKey={labelKey} />} />
          ))}

          <Route element={<RequireAdmin />}>
            {adminPlaceholders.map(({ path, labelKey }) => (
              <Route key={path} path={path} element={<ComingSoon titleKey={labelKey} />} />
            ))}
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
