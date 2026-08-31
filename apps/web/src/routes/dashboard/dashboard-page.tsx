import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { TeacherIcon } from '../../components/ui/teacher-icon';
import { quizzesApi, tenantsApi } from '../../data/api-client/endpoints';
import { useSessionSnapshot } from '../../features/auth/use-session';
import { getActiveTenantId } from '../../lib/auth/session';
import { QUIZ_STATUS_LABELS, type QuizListItem } from '../../types/quizzes';

export default function DashboardPage() {
  const navigate = useNavigate();
  const session = useSessionSnapshot();
  const activeTenantId = getActiveTenantId();

  const workspacesQuery = useQuery({
    queryKey: ['tenants', 'mine'],
    queryFn: ({ signal }) => tenantsApi.listMine(signal),
  });

  const activeWorkspace = workspacesQuery.data?.find((workspace) => workspace.id === activeTenantId) ?? null;
  const recentQuizzesQuery = useQuery({
    queryKey: ['quizzes', activeTenantId, 'dashboard-recent'],
    queryFn: ({ signal }) => quizzesApi.list(activeTenantId!, { page: 1, pageSize: 5 }, signal),
    enabled: Boolean(activeTenantId && activeWorkspace),
  });

  if (workspacesQuery.isLoading) return <DashboardSkeleton />;
  if (workspacesQuery.isError) {
    return <div role="alert" className="teacher-surface max-w-2xl bg-rose-50 p-5 text-sm text-rose-800"><p className="font-bold">تعذر تحميل مساحة العمل.</p><p className="mt-1">تحقق من الاتصال ثم حاول مرة أخرى.</p><button type="button" onClick={() => void workspacesQuery.refetch()} className="mt-4 min-h-11 rounded-lg border border-rose-300 bg-white px-4 py-2 font-bold hover:bg-rose-100">إعادة المحاولة</button></div>;
  }
  if (workspacesQuery.data && workspacesQuery.data.length === 0) {
    return <section className="teacher-surface mx-auto max-w-2xl p-8 text-center"><TeacherIcon name="workspace" className="mx-auto h-10 w-10 text-violet-700" /><h1 className="mt-4 text-2xl font-bold text-[var(--teacher-ink)]">أنشئ مساحة العمل أولًا</h1><p className="mx-auto mt-2 max-w-lg text-base leading-7 text-[var(--teacher-muted)]">هنا ستجد الأنشطة والأسئلة والطلاب والنتائج.</p><button type="button" onClick={() => navigate('/onboarding')} className="mt-5 min-h-11 rounded-xl bg-violet-700 px-5 py-2 text-sm font-bold text-white hover:bg-violet-800">إنشاء مساحة العمل</button></section>;
  }
  if (!activeWorkspace) return <p className="teacher-surface p-5 text-sm text-slate-700">اختر مساحة العمل من القائمة للمتابعة.</p>;

  const firstName = session.user?.fullName?.trim().split(/\s+/)[0] ?? 'مرحبًا';
  const isPlatformAdmin = Boolean(session.user?.platformRoles.includes('PlatformAdmin'));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm font-semibold text-violet-700">{activeWorkspace.name}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">أهلًا، {firstName} 👋</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">ماذا تريد أن تجهز للطلاب اليوم؟</p>
      </header>

      {isPlatformAdmin ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between" aria-label="إدارة المنصة">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-xl">⚙️</span>
            <div><h2 className="font-bold text-amber-950">إدارة الحسابات والمنصة</h2><p className="mt-1 text-sm leading-6 text-amber-900/75">راجع المستخدمين والعملاء والاشتراكات والخطط.</p></div>
          </div>
          <Link to="/platform" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-amber-900 px-4 text-sm font-bold text-white hover:bg-amber-950">فتح لوحة الإدارة</Link>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]" aria-label="ابدأ من هنا">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-800 via-indigo-800 to-slate-950 p-6 text-white shadow-[0_24px_70px_rgb(76_29_149/0.18)] sm:p-8">
          <span aria-hidden="true" className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-fuchsia-400/15 blur-3xl" />
          <span aria-hidden="true" className="absolute -bottom-24 right-16 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative max-w-2xl">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-amber-200">نشاط جديد</span>
            <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">ابدأ بالاسم، والباقي خطوة بخطوة.</h2>
            <p className="mt-3 max-w-xl text-base leading-8 text-violet-100">اكتب اسم النشاط، أضف الأسئلة، ثم جرّبه بنفسك قبل أن ترسل الرابط للطلاب.</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link to="/dashboard/activities/new" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-violet-900 shadow-sm hover:bg-violet-50"><TeacherIcon name="create" />إنشاء نشاط</Link>
              <Link to="/join" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 text-sm font-bold text-white hover:bg-white/15"><span aria-hidden="true">🚀</span>فتح واجهة الطالب</Link>
            </div>
          </div>
        </div>

        <div className="teacher-surface p-5 sm:p-6">
          <h2 className="text-base font-bold text-slate-950">ثلاث خطوات فقط</h2>
          <ol className="mt-5 space-y-5">
            <FlowStep number="1" title="سمِّ النشاط" description="اكتب اسمًا يعرفه الطلاب بسهولة." />
            <FlowStep number="2" title="أضف الأسئلة" description="اكتب أسئلة جديدة أو استخدم الموجود عندك." />
            <FlowStep number="3" title="جرّبه وشاركه" description="افتحه كطالب، وبعدها أرسل الرابط." last />
          </ol>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="اختصارات العمل">
        <ShortcutCard to="/dashboard/quizzes" icon="quizzes" title="المحتوى" description="كل الأنشطة التي أنشأتها من قبل." tone="violet" />
        <ShortcutCard to="/dashboard/questions" icon="questions" title="بنك الأسئلة" description="احفظ الأسئلة واستخدمها في أكثر من نشاط." tone="sky" />
        <ShortcutCard to="/dashboard/students" icon="students" title="الطلاب" description="أضف الطلاب وانسخ كود كل طالب." tone="emerald" />
        <ShortcutCard to="/dashboard/reports" icon="reports" title="النتائج" description="تابع الإجابات والدرجات بعد كل نشاط." tone="amber" />
      </section>

      <section aria-labelledby="recent-activities-heading">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="recent-activities-heading" className="text-xl font-bold text-slate-950">آخر الأنشطة</h2><p className="mt-1 text-sm text-slate-500">افتح أي نشاط لتكمل تعديله أو مشاركته.</p></div><Link to="/dashboard/quizzes" className="inline-flex min-h-11 items-center text-sm font-bold text-violet-700 hover:underline">عرض الكل ←</Link></div>
        {recentQuizzesQuery.isLoading ? <div className="mt-4 space-y-2" role="status" aria-label="جارٍ تحميل أحدث الأنشطة">{[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-200/70" />)}</div> : null}
        {recentQuizzesQuery.isError ? <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">تعذر تحميل أحدث الأنشطة.</div> : null}
        {recentQuizzesQuery.data?.items.length === 0 ? <div className="teacher-surface mt-4 py-10 text-center"><span aria-hidden="true" className="text-3xl">✦</span><p className="mt-3 font-bold text-slate-900">لا يوجد نشاط بعد</p><Link to="/dashboard/activities/new" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-violet-700 px-5 text-sm font-bold text-white">إنشاء أول نشاط</Link></div> : null}
        {recentQuizzesQuery.data && recentQuizzesQuery.data.items.length > 0 ? <ul className="teacher-surface mt-4 divide-y divide-slate-100 overflow-hidden" aria-label="أحدث الأنشطة">{recentQuizzesQuery.data.items.map((quiz) => <RecentActivityRow key={quiz.id} quiz={quiz} />)}</ul> : null}
      </section>
    </div>
  );
}

function FlowStep({ number, title, description, last = false }: { number: string; title: string; description: string; last?: boolean }) {
  return <li className="relative flex gap-3">{!last ? <span aria-hidden="true" className="absolute right-[1.05rem] top-9 h-[calc(100%+0.75rem)] w-px bg-violet-100" /> : null}<span aria-hidden="true" className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-800">{number}</span><div><p className="font-bold text-slate-900">{title}</p><p className="mt-0.5 text-sm leading-6 text-slate-500">{description}</p></div></li>;
}

function ShortcutCard({ to, icon, title, description, tone }: { to: string; icon: 'quizzes' | 'questions' | 'students' | 'reports'; title: string; description: string; tone: 'violet' | 'sky' | 'emerald' | 'amber' }) {
  const toneClass = tone === 'violet'
    ? 'bg-violet-100 text-violet-700 group-hover:border-violet-200'
    : tone === 'sky'
      ? 'bg-sky-100 text-sky-700 group-hover:border-sky-200'
      : tone === 'emerald'
        ? 'bg-emerald-100 text-emerald-800 group-hover:border-emerald-200'
        : 'bg-amber-100 text-amber-800 group-hover:border-amber-200';

  return (
    <Link to={to} className="teacher-surface group flex min-h-28 items-start gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none">
      <span aria-hidden="true" className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}><TeacherIcon name={icon} /></span>
      <span className="min-w-0 flex-1"><span className="block text-base font-bold text-slate-950">{title}</span><span className="mt-1 block text-sm leading-6 text-slate-500">{description}</span></span>
      <span aria-hidden="true" className="mt-2 shrink-0 text-lg font-bold text-slate-300 transition group-hover:-translate-x-0.5 group-hover:text-violet-500">←</span>
    </Link>
  );
}

function RecentActivityRow({ quiz }: { quiz: QuizListItem }) {
  const action = quiz.status === 'Archived'
    ? { label: 'معاينة', to: `/dashboard/quizzes/${quiz.id}/preview` }
    : { label: 'فتح النشاط', to: `/dashboard/activities/${quiz.id}/manage` };

  return <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-base font-bold text-slate-950">{quiz.title}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${quiz.status === 'Published' ? 'bg-emerald-100 text-emerald-800' : quiz.status === 'Archived' ? 'bg-slate-100 text-slate-700' : 'bg-violet-100 text-violet-800'}`}>{QUIZ_STATUS_LABELS[quiz.status]}</span></div><p className="mt-1 text-sm text-slate-500">{quiz.itemCount} سؤال · آخر تعديل {new Date(quiz.updatedAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })}</p></div><Link to={action.to} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:border-violet-400 hover:text-violet-800">{action.label}</Link></li>;
}

function DashboardSkeleton() {
  return <div role="status" aria-label="جارٍ تجهيز الصفحة الرئيسية" className="animate-pulse space-y-8"><div className="h-20 rounded-2xl bg-slate-200" /><div className="grid gap-4 lg:grid-cols-[1.45fr_0.55fr]"><div className="h-72 rounded-[2rem] bg-slate-200" /><div className="h-72 rounded-2xl bg-slate-200" /></div></div>;
}
