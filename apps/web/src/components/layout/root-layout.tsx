import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { TeacherIcon, type TeacherIconName } from '../ui/teacher-icon';
import { authApi, tenantsApi } from '../../data/api-client/endpoints';
import { useSessionSnapshot } from '../../features/auth/use-session';
import { clearSession, getActiveTenantId, setActiveWorkspaceId } from '../../lib/auth/session';

import { ScrollToTop } from './scroll-to-top';

const studioNavItems: Array<{ to: string; label: string; icon: TeacherIconName }> = [
  { to: '/dashboard', label: 'الرئيسية', icon: 'home' },
  { to: '/dashboard/quizzes', label: 'الأنشطة', icon: 'quizzes' },
  { to: '/dashboard/questions', label: 'بنك الأسئلة', icon: 'questions' },
  { to: '/dashboard/students', label: 'الطلاب', icon: 'students' },
  { to: '/dashboard/reports', label: 'النتائج', icon: 'reports' },
];

const secondaryNavItems: Array<{ to: string; label: string; icon: TeacherIconName }> = [
  { to: '/dashboard/certificates', label: 'الشهادات', icon: 'certificate' },
  { to: '/dashboard/settings', label: 'الإعدادات', icon: 'settings' },
];

const mobilePrimaryNav: Array<{ to: string; label: string; icon: TeacherIconName }> = [
  { to: '/dashboard', label: 'الرئيسية', icon: 'home' },
  { to: '/dashboard/activities/new', label: 'إنشاء', icon: 'create' },
  { to: '/dashboard/quizzes', label: 'الأنشطة', icon: 'quizzes' },
  { to: '/dashboard/students', label: 'الطلاب', icon: 'students' },
];

function isStudioNavActive(pathname: string, target: string) {
  if (target === '/dashboard') return pathname === target;
  if (target === '/dashboard/activities/new') return pathname.startsWith('/dashboard/activities/');
  if (target === '/dashboard/quizzes') return pathname.startsWith('/dashboard/quizzes') || pathname.startsWith('/dashboard/activities/');
  if (target === '/dashboard/questions') return pathname.startsWith('/dashboard/questions');
  if (target === '/dashboard/students') return pathname.startsWith('/dashboard/students');
  if (target === '/dashboard/reports') return pathname.startsWith(target) || pathname.startsWith('/dashboard/attempts/');
  return pathname.startsWith(target);
}

function isStandaloneExperience(pathname: string) {
  return pathname === '/'
    || pathname === '/portal'
    || pathname === '/home'
    || pathname === '/teachers'
    || pathname === '/join'
    || pathname === '/speaking'
    || pathname === '/challenge'
    || pathname === '/placement'
    || pathname === '/guestbook'
    || pathname === '/teacher-admin'
    || pathname === '/privacy'
    || pathname === '/terms'
    || pathname.startsWith('/grammar')
    || pathname.startsWith('/reading')
    || pathname.startsWith('/listening')
    || pathname.startsWith('/writing')
    || pathname.startsWith('/competitions')
    || pathname.startsWith('/placement')
    || pathname.startsWith('/teacher')
    || pathname.startsWith('/play/')
    || pathname.startsWith('/student')
    || pathname.startsWith('/q/')
    || pathname.startsWith('/result/')
    || pathname.startsWith('/certificate/');
}

export function RootLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSessionSnapshot();
  const activeTenantId = getActiveTenantId();
  const isFocusedLiveHost = location.pathname.startsWith('/dashboard/sessions/') && location.pathname.endsWith('/live');
  const isFocusedExperience = isStandaloneExperience(location.pathname) || isFocusedLiveHost;

  const { data: workspaces } = useQuery({
    queryKey: ['tenants', 'mine'],
    queryFn: ({ signal }) => tenantsApi.listMine(signal),
    enabled: Boolean(session.user && !isFocusedExperience),
    retry: false,
  });

  const activeWorkspace = workspaces?.find((workspace) => workspace.id === activeTenantId) ?? null;
  const isPlatformAdmin = Boolean(session.user?.platformRoles.includes('PlatformAdmin'));
  const isCreatingActivity = location.pathname.startsWith('/dashboard/activities/');

  if (isFocusedExperience) {
    return (
      <div className="min-h-dvh" dir="rtl">
        <ScrollToTop />
        {children}
      </div>
    );
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
    const onLoginPage = location.pathname === '/auth/login';
    return (
      <div className="spark-public-shell relative flex min-h-dvh flex-col overflow-x-clip" dir="rtl">
        <ScrollToTop />
        <PublicBackdrop />
        <header className="sticky top-0 z-40 border-b border-violet-100/80 bg-white/88 backdrop-blur-xl">
          <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
            <EnglishSparkBrand to="/" compact />
            <nav className="flex items-center gap-2" aria-label="التنقل الرئيسي">
              <Link to="/" className="hidden min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-white hover:text-violet-800 sm:inline-flex">الرئيسية</Link>
              {onLoginPage ? (
                <Link to="/auth/signup" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200 bg-white px-4 text-sm font-bold text-violet-800 shadow-sm hover:bg-violet-50">إنشاء حساب</Link>
              ) : (
                <Link to="/auth/login" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-violet-800">تسجيل الدخول</Link>
              )}
            </nav>
          </div>
        </header>
        <main id="main-content" className="animate-page-enter mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-9">{children}</main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="teacher-app min-h-dvh" dir="rtl">
      <ScrollToTop />
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-2xl">
        <aside className="sticky top-0 hidden h-dvh w-[17rem] shrink-0 flex-col border-l border-slate-200 bg-white/96 px-4 py-5 lg:flex">
          <EnglishSparkBrand to="/dashboard" />

          {workspaces && workspaces.length > 0 ? (
            <label className="mt-6 block rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-500">
              <span className="mb-1.5 inline-flex items-center gap-1.5"><TeacherIcon name="workspace" className="h-4 w-4" />مساحة العمل</span>
              <select value={activeWorkspace?.id ?? ''} onChange={(event) => onWorkspaceChange(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus-visible:border-violet-600 focus-visible:ring-4 focus-visible:ring-violet-100">
                {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
              </select>
            </label>
          ) : null}

          <Link to="/dashboard/activities/new" className={`mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 ${isCreatingActivity ? 'bg-violet-800 text-white' : 'bg-violet-700 text-white hover:bg-violet-800'}`}>
            <TeacherIcon name="create" />إنشاء نشاط جديد
          </Link>

          {isPlatformAdmin ? (
            <Link to="/platform" className="mt-3 flex min-h-12 items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-bold text-amber-950 shadow-sm hover:bg-amber-100">
              <span aria-hidden="true" className="text-lg">⚙️</span><span><span className="block">إدارة الحسابات</span><span className="mt-0.5 block text-[10px] font-semibold text-amber-800">المستخدمون · العملاء · الاشتراكات</span></span>
            </Link>
          ) : null}

          <StudioNavigation pathname={location.pathname} />

          <nav className="mt-3 flex flex-col gap-1 border-t border-slate-200 pt-3" aria-label="إعدادات Studio">
            {secondaryNavItems.map((item) => {
              const isActive = isStudioNavActive(location.pathname, item.to);
              return (
                <Link key={item.to} to={item.to} aria-current={isActive ? 'page' : undefined} className={`inline-flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 ${isActive ? 'bg-slate-100 text-slate-950' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                  <TeacherIcon name={item.icon} className="h-4 w-4" />{item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-2 border-t border-slate-200 pt-4">
            <div className="px-3 pb-1"><p className="truncate text-sm font-semibold text-[var(--teacher-ink)]">{session.user.fullName}</p><p className="mt-0.5 text-[11px] font-medium text-slate-400">English Spark Studio</p></div>
            <button type="button" onClick={() => void onLogout()} className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"><TeacherIcon name="logout" />تسجيل الخروج</button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4">
              <EnglishSparkBrand to="/dashboard" compact />
              <details key={location.pathname} className="group relative">
                <summary aria-label="فتح القائمة الإضافية" className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm marker:content-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100"><span className="hidden sm:inline">المزيد</span><span aria-hidden="true" className="text-xl leading-none">•••</span></summary>
                <div className="fixed inset-x-3 top-16 z-50 max-h-[calc(100dvh-9rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                  {workspaces && workspaces.length > 0 ? <label className="mb-3 flex flex-col gap-1.5 text-xs font-medium text-slate-600">مساحة العمل<select value={activeWorkspace?.id ?? ''} onChange={(event) => onWorkspaceChange(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800">{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label> : null}
                  {isPlatformAdmin ? <Link to="/platform" className="mb-2 inline-flex min-h-12 w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-bold text-amber-950"><span aria-hidden="true">⚙️</span><span>إدارة الحسابات والمنصة</span></Link> : null}
                  <Link to="/dashboard/questions" className="inline-flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-violet-50"><TeacherIcon name="questions" />بنك الأسئلة</Link>
                  <Link to="/dashboard/reports" className="inline-flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-violet-50"><TeacherIcon name="reports" />النتائج</Link>
                  <Link to="/dashboard/certificates" className="inline-flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-violet-50"><TeacherIcon name="certificate" />الشهادات</Link>
                  <Link to="/dashboard/settings" className="inline-flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-violet-50"><TeacherIcon name="settings" />الإعدادات</Link>
                  <button type="button" onClick={() => void onLogout()} className="mt-2 inline-flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-rose-700 hover:bg-rose-50"><TeacherIcon name="logout" />تسجيل الخروج</button>
                </div>
              </details>
            </div>
          </header>

          <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-24 sm:px-6 sm:py-7 sm:pb-24 lg:px-8 lg:py-8">{children}</main>
          <footer className="hidden border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500 lg:block">English Spark Studio</footer>
          <MobileStudioNavigation pathname={location.pathname} />
        </div>
      </div>
    </div>
  );
}

function EnglishSparkBrand({ to, compact = false }: { to: string; compact?: boolean }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center gap-2.5 text-base font-bold text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100">
      <span aria-hidden="true" className={`spark-brand-mark ${compact ? 'h-10 w-10 text-xl' : 'h-11 w-11 text-2xl'} flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-white`}>✦</span>
      <span className="leading-tight"><span className="block tracking-wide">English Spark</span></span>
    </Link>
  );
}

function StudioNavigation({ pathname }: { pathname: string }) {
  return <nav className="mt-4 flex flex-col gap-1" aria-label="التنقل الرئيسي">{studioNavItems.map((item) => { const isActive = isStudioNavActive(pathname, item.to); return <Link key={item.to} to={item.to} aria-current={isActive ? 'page' : undefined} className={`inline-flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 ${isActive ? 'bg-violet-50 text-violet-900' : 'text-slate-600 hover:bg-violet-50 hover:text-violet-900'}`}><TeacherIcon name={item.icon} />{item.label}</Link>; })}</nav>;
}

function MobileStudioNavigation({ pathname }: { pathname: string }) {
  return <nav aria-label="التنقل السريع" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/96 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_26px_rgb(15_23_42/0.06)] backdrop-blur-xl lg:hidden"><div className="mx-auto grid max-w-lg grid-cols-4 gap-1">{mobilePrimaryNav.map((item) => { const isActive = isStudioNavActive(pathname, item.to); return <Link key={item.to} to={item.to} aria-current={isActive ? 'page' : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition-colors ${isActive ? 'bg-violet-50 text-violet-800' : 'text-slate-500 hover:bg-violet-50 hover:text-violet-800'}`}><TeacherIcon name={item.icon} className="h-5 w-5" /><span>{item.label}</span></Link>; })}</div></nav>;
}

function PublicFooter() {
  return <footer className="relative z-10 border-t border-violet-100/80 bg-white/70 backdrop-blur"><div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 text-xs text-slate-500 sm:px-6"><span className="font-semibold">English Spark</span><nav aria-label="روابط السياسات" className="flex items-center gap-4"><Link className="min-h-11 content-center hover:text-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100" to="/privacy">الخصوصية</Link><Link className="min-h-11 content-center hover:text-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100" to="/terms">الشروط</Link></nav></div></footer>;
}

export function PublicBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Fluid CSS Ambient Mesh Glow — Fully responsive on mobile, tablet & desktop */}
      <div className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 h-[28rem] w-[92vw] max-w-4xl rounded-full bg-gradient-to-b from-violet-300/30 via-fuchsia-200/20 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute top-16 -right-16 h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-gradient-to-bl from-amber-200/35 via-orange-100/20 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute top-[36%] -left-16 h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-gradient-to-tr from-sky-200/30 via-indigo-100/20 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 h-64 w-64 sm:h-80 sm:w-80 rounded-full bg-gradient-to-t from-emerald-200/25 via-teal-100/15 to-transparent blur-3xl" />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none">
        {/* Soft Glowing Orbs (Flanks for desktop + Center for mobile) */}
        {/* Desktop Flanks */}
        <circle cx="122" cy="150" r="92" fill="var(--teacher-violet-soft)" opacity="0.6" className="animate-float-slow" />
        <circle cx="1320" cy="190" r="132" fill="#FEF3C7" opacity="0.6" className="animate-float-medium" />
        <circle cx="1265" cy="760" r="170" fill="#D1FAE5" opacity="0.6" className="animate-float-slow" style={{ animationDelay: '-2s' }} />
        <circle cx="120" cy="775" r="138" fill="#E0F2FE" opacity="0.5" className="animate-float-medium" style={{ animationDelay: '-4s' }} />

        {/* Mobile Center Slice Orbs */}
        <circle cx="580" cy="190" r="88" fill="var(--teacher-violet-soft)" opacity="0.65" className="animate-float-slow" />
        <circle cx="860" cy="240" r="95" fill="#FEF3C7" opacity="0.65" className="animate-float-medium" />
        <circle cx="530" cy="520" r="80" fill="#E0F2FE" opacity="0.55" className="animate-float-slow" style={{ animationDelay: '-3s' }} />
        <circle cx="880" cy="640" r="92" fill="#D1FAE5" opacity="0.6" className="animate-float-medium" style={{ animationDelay: '-2s' }} />
        <circle cx="690" cy="800" r="82" fill="#FCE7F3" opacity="0.55" className="animate-float-slow" style={{ animationDelay: '-4s' }} />

        {/* Abstract Lines & Doodles */}
        <g opacity="0.08" stroke="var(--teacher-violet)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="animate-float-slow" style={{ animationDelay: '-1s' }}>
          {/* Flanks */}
          <path d="M64 278h82v66H64z" />
          <path d="M64 278l41 29 41-29" />
          <path d="M1288 350c22-23 59-22 80 1 19 21 17 54-4 73l-34 31-34-31c-22-20-25-53-8-74Z" />
          <path d="M179 622h84M221 580v84" />
          <path d="m1140 646 15 31 34 5-25 24 6 34-30-16-30 16 6-34-25-24 34-5 15-31Z" />

          {/* Center Mobile Doodles */}
          <path d="M555 295h56v42h-56z" />
          <path d="M555 295l28 19 28-19" />
          <path d="M840 370c14-15 38-14 52 1 12 14 11 35-3 47l-22 20-22-20c-14-13-16-34-5-48Z" />
          <path d="M680 710h54M707 683v54" />
        </g>

        {/* Typography & Math Elements */}
        <g fill="var(--student-primary)" opacity="0.065" fontFamily="ui-rounded, system-ui, sans-serif" fontWeight="900" className="animate-float-medium" style={{ animationDelay: '-3s' }}>
          {/* Flanks */}
          <text x="76" y="122" fontSize="72">Aa</text>
          <text x="1215" y="145" fontSize="62">Bb</text>
          <text x="80" y="820" fontSize="64">123</text>
          <text x="1260" y="700" fontSize="88">?</text>
          <text x="350" y="200" fontSize="54">+</text>
          <text x="1050" y="800" fontSize="54">=</text>

          {/* Center Mobile Slice */}
          <text x="520" y="140" fontSize="56">Aa</text>
          <text x="860" y="160" fontSize="52">Bb</text>
          <text x="510" y="440" fontSize="44">123</text>
          <text x="890" y="520" fontSize="60">?</text>
          <text x="730" y="320" fontSize="42">✦</text>
          <text x="540" y="750" fontSize="40">ABC</text>
          <text x="670" y="490" fontSize="38">+</text>
          <text x="830" y="790" fontSize="38">=</text>
        </g>

        {/* Floating Stars & Sparkles */}
        <g opacity="0.12" fill="var(--student-orange)" className="animate-float-slow" style={{ animationDelay: '-5s' }}>
          {/* Flanks */}
          <path d="m292 130 6 13 14 6-14 6-6 13-6-13-14-6 14-6 6-13Z" />
          <path d="m1048 194 7 15 15 7-15 7-7 15-7-15-15-7 15-7 7-15Z" />
          <path d="m404 760 5 11 11 5-11 5-5 11-5-11-11-5 11-5 5-11Z" />
          <path d="m1120 400 4 9 9 4-9 4-4 9-4-9-9-4 9-4 4-9Z" />
          <path d="m220 500 4 9 9 4-9 4-4 9-4-9-9-4 9-4 4-9Z" />

          {/* Center Mobile Sparkles */}
          <path d="m640 120 5 11 11 5-11 5-5 11-5-11-11-5 11-5 5-11Z" />
          <path d="m810 260 6 13 13 6-13 6-6 13-6-13-13-6 13-6 6-13Z" />
          <path d="m590 370 4 9 9 4-9 4-4 9-4-9-9-4 9-4 4-9Z" />
          <path d="m860 410 5 11 11 5-11 5-5 11-5-11-11-5 11-5 5-11Z" />
          <path d="m640 670 4 9 9 4-9 4-4 9-4-9-9-4 9-4 4-9Z" />
          <path d="m780 760 5 11 11 5-11 5-5 11-5-11-11-5 11-5 5-11Z" />
        </g>

        {/* Magical Pencil Elements */}
        {/* Flanks */}
        <g transform="translate(1090 92) rotate(18)" opacity="0.1" className="animate-float-medium" style={{ animationDelay: '-2s' }}>
          <rect width="94" height="24" rx="12" fill="var(--student-orange)" />
          <path d="M0 0-23 12 0 24V0Z" fill="var(--student-ink)" />
        </g>
        <g transform="translate(250 820) rotate(-15)" opacity="0.08" className="animate-float-slow" style={{ animationDelay: '-4s' }}>
          <rect width="70" height="18" rx="9" fill="var(--student-violet)" />
          <path d="M70 0l18 9-18 9V0Z" fill="var(--student-primary)" />
        </g>

        {/* Center Mobile Pencils */}
        <g transform="translate(680 180) rotate(-16) scale(0.75)" opacity="0.1" className="animate-float-medium" style={{ animationDelay: '-1.5s' }}>
          <rect width="94" height="24" rx="12" fill="var(--student-orange)" />
          <path d="M0 0-23 12 0 24V0Z" fill="var(--student-ink)" />
        </g>
        <g transform="translate(740 660) rotate(18) scale(0.7)" opacity="0.09" className="animate-float-slow" style={{ animationDelay: '-3.5s' }}>
          <rect width="70" height="18" rx="9" fill="var(--student-violet)" />
          <path d="M70 0l18 9-18 9V0Z" fill="var(--student-primary)" />
        </g>
      </svg>
    </div>
  );
}
