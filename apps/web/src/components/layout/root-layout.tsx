import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { TeacherIcon, type TeacherIconName } from '../ui/teacher-icon';
import { authApi, tenantsApi } from '../../data/api-client/endpoints';
import { useSessionSnapshot } from '../../features/auth/use-session';
import { clearSession, getActiveTenantId, setActiveWorkspaceId } from '../../lib/auth/session';

const studioNavItems: Array<{ to: string; label: string; icon: TeacherIconName }> = [
  { to: '/dashboard', label: 'الرئيسية', icon: 'home' },
  { to: '/dashboard/quizzes', label: 'المحتوى', icon: 'quizzes' },
  { to: '/dashboard/reports', label: 'النتائج', icon: 'reports' },
  { to: '/dashboard/certificates', label: 'الشهادات', icon: 'certificate' },
  { to: '/dashboard/settings', label: 'الإعدادات', icon: 'settings' },
];

const mobilePrimaryNav: Array<{ to: string; label: string; icon: TeacherIconName }> = [
  { to: '/dashboard', label: 'الرئيسية', icon: 'home' },
  { to: '/dashboard/activities/new', label: 'إنشاء', icon: 'create' },
  { to: '/dashboard/quizzes', label: 'المحتوى', icon: 'quizzes' },
  { to: '/dashboard/reports', label: 'النتائج', icon: 'reports' },
];

function isStudioNavActive(pathname: string, target: string) {
  if (target === '/dashboard') return pathname === target;
  if (target === '/dashboard/activities/new') return pathname.startsWith('/dashboard/activities/');
  if (target === '/dashboard/quizzes') return pathname.startsWith('/dashboard/quizzes') || pathname.startsWith('/dashboard/questions');
  if (target === '/dashboard/reports') return pathname.startsWith(target) || pathname.startsWith('/dashboard/attempts/');
  return pathname.startsWith(target);
}

export function RootLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSessionSnapshot();
  const activeTenantId = getActiveTenantId();
  const isFocusedLiveHost = location.pathname.startsWith('/dashboard/sessions/') && location.pathname.endsWith('/live');
  const isFocusedExperience = location.pathname.startsWith('/play/') || isFocusedLiveHost;

  const { data: workspaces } = useQuery({
    queryKey: ['tenants', 'mine'],
    queryFn: ({ signal }) => tenantsApi.listMine(signal),
    enabled: Boolean(session.user && !isFocusedExperience),
    retry: false,
  });

  const activeWorkspace = workspaces?.find((workspace) => workspace.id === activeTenantId) ?? null;
  const isPlatformAdmin = Boolean(session.user?.platformRoles.includes('PlatformAdmin'));
  const isCreatingActivity = location.pathname.startsWith('/dashboard/activities/');

  if (isFocusedExperience) return <div className="min-h-dvh" dir="rtl">{children}</div>;

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
    const onLoginPage = location.pathname === '/auth/login';
    return (
      <div className="spark-public-shell flex min-h-dvh flex-col" dir="rtl">
        <header className="sticky top-0 z-40 border-b border-violet-100/80 bg-white/88 backdrop-blur-xl">
          <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
            <EnglishSparkBrand to="/" compact />
            <nav className="flex items-center gap-2" aria-label="التنقل الرئيسي">
              <Link to="/" className="hidden min-h-11 items-center rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-white hover:text-violet-800 sm:inline-flex">الرئيسية</Link>
              {onLoginPage ? (
                <Link to="/auth/signup" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200 bg-white px-4 text-sm font-black text-violet-800 shadow-sm hover:bg-violet-50">إنشاء حساب</Link>
              ) : (
                <Link to="/auth/login" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-700 px-4 text-sm font-black text-white shadow-sm hover:bg-violet-800">تسجيل الدخول</Link>
              )}
            </nav>
          </div>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-9">{children}</main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="teacher-app min-h-dvh" dir="rtl">
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-2xl">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-l border-violet-100 bg-white/95 px-4 py-5 lg:flex">
          <EnglishSparkBrand to="/dashboard" />

          {workspaces && workspaces.length > 0 ? (
            <label className="mt-6 block rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-xs font-semibold text-[var(--teacher-muted)]">
              <span className="mb-1.5 inline-flex items-center gap-1.5"><TeacherIcon name="workspace" className="h-4 w-4" />مساحة العمل</span>
              <select value={activeWorkspace?.id ?? ''} onChange={(event) => onWorkspaceChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 focus:border-violet-600 focus:outline-2 focus:outline-violet-200">
                {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
              </select>
            </label>
          ) : null}

          <Link
            to="/dashboard/activities/new"
            className={`mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-black shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 ${isCreatingActivity ? 'bg-violet-800 text-white ring-4 ring-violet-100' : 'bg-violet-700 text-white hover:bg-violet-800'}`}>
            <TeacherIcon name="create" />
            إنشاء نشاط جديد
          </Link>

          <StudioNavigation pathname={location.pathname} />

          <details className="group mt-3 border-t border-slate-100 pt-3">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 marker:content-none">
              <span className="inline-flex items-center gap-2"><TeacherIcon name="questions" />أدوات إضافية</span>
              <span aria-hidden="true" className="text-xs transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-1 space-y-1 pr-2">
              <Link to="/dashboard/questions" className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-800">بنك الأسئلة</Link>
              <Link to="/dashboard/students" className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-800"><TeacherIcon name="students" className="h-4 w-4" />الطلاب</Link>
            </div>
          </details>

          <div className="mt-auto space-y-2 border-t border-slate-100 pt-4">
            <div className="px-3 pb-1">
              <p className="truncate text-sm font-black text-[var(--teacher-ink)]">{session.user.fullName}</p>
              <p className="mt-0.5 text-[11px] font-bold text-slate-400">English Spark Studio</p>
            </div>
            {isPlatformAdmin ? (
              <Link to="/platform" className="flex min-h-11 items-center gap-2 rounded-xl bg-amber-50 px-3 text-xs font-black text-amber-950 hover:bg-amber-100">
                <span aria-hidden="true">⚙️</span><span>إدارة المنصة</span>
              </Link>
            ) : null}
            <button type="button" onClick={() => void onLogout()} className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"><TeacherIcon name="logout" />تسجيل الخروج</button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-violet-100 bg-white/95 backdrop-blur lg:hidden">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4">
              <EnglishSparkBrand to="/dashboard" compact />
              <details key={location.pathname} className="group relative">
                <summary aria-label="فتح القائمة الإضافية" className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-violet-100 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"><span className="hidden sm:inline">المزيد</span><span aria-hidden="true" className="text-xl leading-none">•••</span></summary>
                <div className="fixed inset-x-3 top-16 z-50 max-h-[calc(100dvh-9rem)] overflow-y-auto rounded-2xl border border-violet-100 bg-white p-3 shadow-xl">
                  {workspaces && workspaces.length > 0 ? <label className="mb-3 flex flex-col gap-1.5 text-xs font-semibold text-slate-600">مساحة العمل<select value={activeWorkspace?.id ?? ''} onChange={(event) => onWorkspaceChange(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800">{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label> : null}
                  <Link to="/dashboard/questions" className="inline-flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-700 hover:bg-violet-50"><TeacherIcon name="questions" />بنك الأسئلة</Link>
                  <Link to="/dashboard/students" className="inline-flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-700 hover:bg-violet-50"><TeacherIcon name="students" />الطلاب</Link>
                  <Link to="/dashboard/certificates" className="inline-flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-700 hover:bg-violet-50"><TeacherIcon name="certificate" />الشهادات</Link>
                  <Link to="/dashboard/settings" className="inline-flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-700 hover:bg-violet-50"><TeacherIcon name="settings" />الإعدادات</Link>
                  {isPlatformAdmin ? <Link to="/platform" className="mt-2 inline-flex min-h-11 w-full items-center gap-3 rounded-xl bg-amber-50 px-3 text-sm font-black text-amber-950"><span aria-hidden="true">⚙️</span><span>إدارة المنصة</span></Link> : null}
                  <button type="button" onClick={() => void onLogout()} className="mt-2 inline-flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50"><TeacherIcon name="logout" />تسجيل الخروج</button>
                </div>
              </details>
            </div>
          </header>

          <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-24 sm:px-6 sm:py-7 sm:pb-24 lg:px-8 lg:py-8">{children}</main>
          <footer className="hidden border-t border-violet-100 px-4 py-4 text-center text-xs text-slate-500 lg:block">English Spark — Learn • Play • Explore</footer>
          <MobileStudioNavigation pathname={location.pathname} />
        </div>
      </div>
    </div>
  );
}

function EnglishSparkBrand({ to, compact = false }: { to: string; compact?: boolean }) {
  return <Link to={to} className="inline-flex min-h-11 items-center gap-2.5 text-base font-black text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"><span aria-hidden="true" className={`spark-brand-mark ${compact ? 'h-10 w-10 text-xl' : 'h-11 w-11 text-2xl'} flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-white`}>✦</span><span className="leading-tight"><span className="block tracking-wide">English Spark</span>{!compact ? <span className="block text-[9px] font-black tracking-[0.19em] text-violet-600">LEARN • PLAY • EXPLORE</span> : null}</span></Link>;
}

function StudioNavigation({ pathname }: { pathname: string }) {
  return <nav className="mt-4 flex flex-col gap-1" aria-label="التنقل الرئيسي">{studioNavItems.map((item) => { const isActive = isStudioNavActive(pathname, item.to); return <Link key={item.to} to={item.to} aria-current={isActive ? 'page' : undefined} className={`inline-flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 ${isActive ? 'bg-violet-50 text-violet-900' : 'text-slate-600 hover:bg-violet-50 hover:text-violet-900'}`}><TeacherIcon name={item.icon} />{item.label}</Link>; })}</nav>;
}

function MobileStudioNavigation({ pathname }: { pathname: string }) {
  return <nav aria-label="التنقل السريع" className="fixed inset-x-0 bottom-0 z-40 border-t border-violet-100 bg-white/96 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgb(76_29_149/0.08)] backdrop-blur-xl lg:hidden"><div className="mx-auto grid max-w-lg grid-cols-4 gap-1">{mobilePrimaryNav.map((item) => { const isActive = isStudioNavActive(pathname, item.to); return <Link key={item.to} to={item.to} aria-current={isActive ? 'page' : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-black transition-colors ${isActive ? 'bg-violet-50 text-violet-800' : 'text-slate-500 hover:bg-violet-50 hover:text-violet-800'}`}><TeacherIcon name={item.icon} className="h-5 w-5" /><span>{item.label}</span></Link>; })}</div></nav>;
}

function PublicFooter() {
  return <footer className="border-t border-violet-100/80 bg-white/70 backdrop-blur"><div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 text-xs text-slate-500 sm:px-6"><span className="font-semibold">English Spark</span><nav aria-label="روابط السياسات" className="flex items-center gap-4"><Link className="min-h-11 content-center hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700" to="/privacy">الخصوصية</Link><Link className="min-h-11 content-center hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700" to="/terms">الشروط</Link></nav></div></footer>;
}
