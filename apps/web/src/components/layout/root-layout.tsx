import type { ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { TeacherIcon, type TeacherIconName } from '../ui/teacher-icon';
import { authApi, tenantsApi } from '../../data/api-client/endpoints';
import { useSessionSnapshot } from '../../features/auth/use-session';
import { clearSession, getActiveTenantId, setActiveWorkspaceId } from '../../lib/auth/session';

const publicNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

const teacherNavItems: Array<{ to: string; label: string; icon: TeacherIconName }> = [
  { to: '/dashboard', label: 'الرئيسية', icon: 'home' },
  { to: '/dashboard/quizzes/new', label: 'إنشاء اختبار', icon: 'create' },
  { to: '/dashboard/quizzes', label: 'الاختبارات', icon: 'quizzes' },
  { to: '/dashboard/questions', label: 'بنك الأسئلة', icon: 'questions' },
  { to: '/dashboard/reports', label: 'النتائج والتقارير', icon: 'reports' },
  { to: '/dashboard/certificates', label: 'الشهادات', icon: 'certificate' },
  { to: '/dashboard/settings', label: 'الإعدادات', icon: 'settings' },
];

function isTeacherNavActive(pathname: string, target: string) {
  if (target === '/dashboard') return pathname === target;
  if (target === '/dashboard/quizzes/new') return pathname === target;
  if (target === '/dashboard/quizzes') {
    return pathname.startsWith(target) && pathname !== '/dashboard/quizzes/new';
  }
  return pathname.startsWith(target);
}

export function RootLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSessionSnapshot();
  const activeTenantId = getActiveTenantId();

  const { data: workspaces } = useQuery({
    queryKey: ['tenants', 'mine'],
    queryFn: ({ signal }) => tenantsApi.listMine(signal),
    enabled: Boolean(session.user),
    retry: false,
  });

  const activeWorkspace = workspaces?.find((workspace) => workspace.id === activeTenantId) ?? null;

  if (location.pathname.startsWith('/play/')) {
    return <div className="min-h-dvh" dir="rtl">{children}</div>;
  }

  async function onLogout() {
    try {
      await authApi.logout();
    } finally {
      clearSession();
      navigate('/auth/login', { replace: true });
    }
  }

  function onWorkspaceChange(workspaceId: string) {
    setActiveWorkspaceId(workspaceId);
    navigate('/dashboard', { replace: true });
  }

  if (!session.user) {
    return (
      <div className="flex min-h-screen flex-col" dir="rtl">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex min-h-16 w-full max-w-5xl flex-col items-stretch justify-between gap-2 px-4 py-2 sm:flex-row sm:items-center sm:gap-4 sm:py-0">
            <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-base font-black text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white"><TeacherIcon name="questions" /></span>
              منصة المعلم
            </Link>
            <nav className="flex w-full items-center gap-1 sm:w-auto" aria-label="التنقل الرئيسي">
              <NavLink to="/" end className={publicNavLinkClass}>الرئيسية</NavLink>
              <NavLink to="/auth/login" className={publicNavLinkClass}>تسجيل الدخول</NavLink>
              <NavLink to="/auth/signup" className={publicNavLinkClass}>إنشاء حساب</NavLink>
            </nav>
          </div>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="teacher-app min-h-dvh" dir="rtl">
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-2xl">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-l border-slate-200 bg-white px-4 py-5 lg:flex">
          <TeacherBrand />
          <div className="mt-6 border-y border-slate-100 py-4">
            <p className="truncate text-sm font-black text-[var(--teacher-ink)]">{session.user.fullName}</p>
            <p dir="ltr" title={session.user.email} className="mt-1 truncate text-left text-xs text-[var(--teacher-muted)]">{session.user.email}</p>
            {workspaces && workspaces.length > 0 ? (
              <label className="mt-4 flex flex-col gap-1.5 text-xs font-semibold text-[var(--teacher-muted)]">
                <span className="inline-flex items-center gap-1.5"><TeacherIcon name="workspace" className="h-4 w-4" />مساحة العمل</span>
                <select
                  value={activeWorkspace?.id ?? ''}
                  onChange={(event) => onWorkspaceChange(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-emerald-600 focus:outline-2 focus:outline-emerald-700">
                  {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
                </select>
              </label>
            ) : null}
          </div>

          <TeacherNavigation pathname={location.pathname} isPlatformAdmin={session.user.platformRoles.includes('PlatformAdmin')} />

          <div className="mt-auto border-t border-slate-100 pt-4">
            <Link to="/onboarding" className="inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
              <TeacherIcon name="workspace" />مساحة عمل جديدة
            </Link>
            <button type="button" onClick={() => void onLogout()} className="inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700">
              <TeacherIcon name="logout" />تسجيل الخروج
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white lg:hidden">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4">
              <TeacherBrand compact />
              <details key={location.pathname} className="group relative">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
                  القائمة الرئيسية
                  <span aria-hidden="true" className="text-lg leading-none">≡</span>
                </summary>
                <div className="fixed inset-x-3 top-16 z-50 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-md">
                  {workspaces && workspaces.length > 0 ? (
                    <label className="mb-3 flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
                      مساحة العمل
                      <select value={activeWorkspace?.id ?? ''} onChange={(event) => onWorkspaceChange(event.target.value)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800">
                        {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
                      </select>
                    </label>
                  ) : null}
                  <TeacherNavigation pathname={location.pathname} isPlatformAdmin={session.user.platformRoles.includes('PlatformAdmin')} />
                  <button type="button" onClick={() => void onLogout()} className="mt-2 inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                    <TeacherIcon name="logout" />تسجيل الخروج
                  </button>
                </div>
              </details>
            </div>
          </header>

          <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
          <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500">
            منصة المعلم — مساحة عمل تعليمية واضحة
          </footer>
        </div>
      </div>
    </div>
  );
}

function TeacherBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/dashboard" className="inline-flex min-h-11 items-center gap-2 text-base font-black text-[var(--teacher-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
      <span aria-hidden="true" className={`${compact ? 'h-9 w-9' : 'h-10 w-10'} flex items-center justify-center rounded-lg bg-[var(--teacher-primary)] text-white`}>
        <TeacherIcon name="questions" />
      </span>
      <span>منصة المعلم</span>
    </Link>
  );
}

function TeacherNavigation({ pathname, isPlatformAdmin }: { pathname: string; isPlatformAdmin: boolean }) {
  return (
    <nav className="mt-4 flex flex-col gap-1" aria-label="التنقل الرئيسي">
      {teacherNavItems.map((item) => {
        const isActive = isTeacherNavActive(pathname, item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
              isActive
                ? 'bg-[var(--teacher-primary-soft)] text-[var(--teacher-primary-strong)]'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}>
            <TeacherIcon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
      {isPlatformAdmin ? (
        <Link to="/platform" className="inline-flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
          <TeacherIcon name="settings" />إدارة المنصة
        </Link>
      ) : null}
    </nav>
  );
}

function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-slate-500 sm:flex-row">
        <span>منصة المعلم — إدارة الاختبارات والنتائج</span>
        <nav aria-label="روابط السياسات" className="flex items-center gap-4">
          <Link className="min-h-11 content-center hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700" to="/privacy">الخصوصية</Link>
          <Link className="min-h-11 content-center hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700" to="/terms">الشروط</Link>
        </nav>
      </div>
    </footer>
  );
}
