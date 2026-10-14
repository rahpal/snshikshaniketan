import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { LanguageToggle, ThemeToggle } from '../ui/Toggles.jsx';
import { visibleNavItems } from '../navigation.js';

function NavItems({ onNavigate }) {
  const { isAdmin } = useAuth();
  const { t } = useLanguage();

  return (
    <nav className="space-y-1">
      {visibleNavItems(isAdmin).map(({ path, labelKey, icon: Icon, ready }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800'
            }`
          }
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{t(labelKey)}</span>
          {!ready && (
            <span className="ml-auto shrink-0 whitespace-nowrap rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {t('dash.soon')}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppShell() {
  const { user, isAdmin, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-200/70 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={t('nav.menu')}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img src="/sn_logo.jpeg" alt="" className="h-9 w-9 rounded-full object-cover" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('app.name')}
              </span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                {t('app.school')}
              </span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
            <div className="mx-1 hidden h-8 w-px bg-slate-200 sm:block dark:bg-slate-700" />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user?.full_name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAdmin ? t('role.admin') : t('role.operator')}
              </p>
            </div>
            <Link
              to="/change-password"
              title={t('nav.changePassword')}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{t('nav.changePassword')}</span>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              title={t('nav.signOut')}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{t('nav.signOut')}</span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200 p-3 lg:hidden dark:border-slate-800">
            <NavItems onNavigate={() => setMenuOpen(false)} />
          </div>
        )}
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="no-print hidden w-60 shrink-0 lg:block">
          <div className="sticky top-22">
            <NavItems />
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
