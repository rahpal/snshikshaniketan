import { Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell.jsx';
import { RedirectIfSignedIn, RequireAdmin, RequireAuth } from './components/RouteGuards.jsx';
import { NAV_ITEMS } from './components/navigation.js';
import Login from './pages/Login.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CollectPayment from './pages/CollectPayment.jsx';
import Receipt from './pages/Receipt.jsx';
import Roster from './pages/Roster.jsx';
import ClassWise from './pages/ClassWise.jsx';
import Pending from './pages/Pending.jsx';
import StudentLedger from './pages/StudentLedger.jsx';
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
          <Route path="collect" element={<CollectPayment />} />
          <Route path="receipt/:receiptNo" element={<Receipt />} />
          <Route path="classwise" element={<ClassWise />} />
          <Route path="defaulters" element={<Pending />} />
          <Route path="students/:studentId" element={<StudentLedger />} />

          {sharedPlaceholders.map(({ path, labelKey }) => (
            <Route key={path} path={path} element={<ComingSoon titleKey={labelKey} />} />
          ))}

          <Route element={<RequireAdmin />}>
            <Route path="roster" element={<Roster />} />
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
