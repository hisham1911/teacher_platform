import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { clearSession, getActiveTenantId, setActiveWorkspaceId } from '../../lib/auth/session';
import { useSessionSnapshot } from '../../features/auth/use-session';
import { authApi, tenantsApi } from '../../data/api-client/endpoints';
import { useQuery } from '@tanstack/react-query';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`;

export function RootLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const session = useSessionSnapshot();
  const activeTenantId = getActiveTenantId();

  const { data: workspaces } = useQuery({
    queryKey: ['tenants', 'mine'],
    queryFn: ({ signal }) => tenantsApi.listMine(signal),
    enabled: Boolean(session.user),
    retry: false,
  });

  const activeWorkspace = workspaces?.find((w) => w.id === activeTenantId) ?? null;

  async function onLogout() {
    try {
      await authApi.logout();
    } finally {
      clearSession();
      navigate('/auth/login', { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen flex-col" dir="rtl">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <Link to="/" className="text-base font-bold text-slate-900 shrink-0">
            منصة المعلم
          </Link>

          <nav className="flex items-center gap-1" aria-label="التنقل الرئيسي">
            {!session.user ? (
              <>
                <NavLink to="/" end className={navLinkClass}>
                  الرئيسية
                </NavLink>
                <NavLink to="/auth/login" className={navLinkClass}>
                  تسجيل الدخول
                </NavLink>
                <NavLink to="/auth/signup" className={navLinkClass}>
                  إنشاء حساب
                </NavLink>
              </>
            ) : (
              <>
                <NavLink to="/dashboard" className={navLinkClass}>
                  لوحة التحكم
                </NavLink>
                <NavLink to="/dashboard/settings" className={navLinkClass}>
                  الإعدادات
                </NavLink>
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="min-h-11 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
                  تسجيل الخروج
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Workspace switcher يظهر فقط للمستخدم المُصادق الذي لديه أكثر من Workspace */}
        {session.user && workspaces && workspaces.length > 0 ? (
          <div className="border-t border-slate-100 bg-white">
            <div className="mx-auto flex w-full max-w-5xl items-center gap-2 overflow-x-auto px-4 py-1.5">
              <span className="shrink-0 text-xs text-slate-500">مساحة العمل:</span>
              <div className="flex gap-1">
                {workspaces.map((workspace) => {
                  const isActive = activeWorkspace?.id === workspace.id;
                  return (
                    <button
                      key={workspace.id}
                      type="button"
                      onClick={() => {
                        setActiveWorkspaceId(workspace.id);
                        navigate('/dashboard', { replace: true });
                      }}
                      aria-pressed={isActive}
                      className={`min-h-11 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
                        isActive
                          ? 'bg-sky-600 text-white'
                          : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}>
                      {workspace.name}
                    </button>
                  );
                })}
                <Link
                  to="/onboarding"
                  className="inline-flex min-h-11 items-center rounded-md border border-dashed border-slate-400 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-500 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
                  + جديدة
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 text-center text-xs text-slate-500">
          منصة المعلم — المرحلة 1 (Identity &amp; Multi-tenancy)
        </div>
      </footer>
    </div>
  );
}
