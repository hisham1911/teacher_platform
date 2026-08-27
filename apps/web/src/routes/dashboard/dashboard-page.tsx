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
    return (
      <div role="alert" className="teacher-surface max-w-2xl bg-rose-50 p-5 text-sm text-rose-800">
        <p className="font-bold">تعذر تحميل مساحة العمل.</p>
        <p className="mt-1">تحقق من الاتصال ثم حاول مرة أخرى.</p>
        <button type="button" onClick={() => void workspacesQuery.refetch()} className="mt-4 min-h-11 rounded-lg border border-rose-300 bg-white px-4 py-2 font-bold hover:bg-rose-100">إعادة المحاولة</button>
      </div>
    );
  }

  if (workspacesQuery.data && workspacesQuery.data.length === 0) {
    return (
      <section className="teacher-surface mx-auto max-w-2xl p-8 text-center">
        <TeacherIcon name="workspace" className="mx-auto h-10 w-10 text-violet-700" />
        <h1 className="mt-4 text-2xl font-black text-[var(--teacher-ink)]">تجهيز مساحة English Spark</h1>
        <p className="mx-auto mt-2 max-w-lg text-base leading-7 text-[var(--teacher-muted)]">المساحة تجمع الأنشطة والأسئلة ونتائج الطلاب في مكان واحد.</p>
        <button type="button" onClick={() => navigate('/onboarding')} className="mt-5 min-h-11 rounded-xl bg-violet-700 px-5 py-2 text-sm font-bold text-white hover:bg-violet-800">إنشاء مساحة العمل</button>
      </section>
    );
  }

  if (!activeWorkspace) {
    return <p className="teacher-surface p-5 text-sm text-slate-700">اختيار مساحة العمل من القائمة مطلوب للمتابعة.</p>;
  }

  const firstName = session.user?.fullName?.trim().split(/\s+/)[0] ?? 'مرحبًا';

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black text-violet-700">{activeWorkspace.name}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">مرحبًا، {firstName} 👋</h1>
          <p className="mt-2 text-sm leading-7 text-slate-500">ابدأ بالمهمة التي تريد إنجازها، واترك التفاصيل التقنية لـ English Spark.</p>
        </div>
        {recentQuizzesQuery.data ? <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{recentQuizzesQuery.data.totalItems} نشاط محفوظ</span> : null}
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]" aria-label="ابدأ من هنا">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-800 via-indigo-800 to-slate-950 p-6 text-white shadow-[0_24px_70px_rgb(76_29_149/0.18)] sm:p-8">
          <span aria-hidden="true" className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-fuchsia-400/15 blur-3xl" />
          <span aria-hidden="true" className="absolute -bottom-24 right-1/3 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="relative max-w-2xl">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black text-amber-200">أسرع طريق للطلاب</span>
            <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">نشاط جديد في دقائق، لا في سلسلة شاشات.</h2>
            <p className="mt-3 max-w-xl text-base leading-8 text-violet-100">اختر طريقة اللعب، أضف أسئلتك، ثم خذ الرابط الجاهز للمشاركة. النشر والجلسة يتمان خلف الكواليس.</p>
            <Link to="/dashboard/activities/new" className="mt-6 inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-black text-violet-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transform-none">
              <TeacherIcon name="create" />إنشاء نشاط جديد
            </Link>
          </div>
        </div>

        <div className="teacher-surface p-5 sm:p-6">
          <p className="text-xs font-black tracking-[0.16em] text-violet-700">المسار المختصر</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">من الفكرة إلى الرابط</h2>
          <ol className="mt-5 space-y-4">
            <FlowStep number="1" title="اختر طريقة اللعب" description="فردي، مباشر أو تحدٍ متدرج." />
            <FlowStep number="2" title="أضف الأسئلة" description="جديد، من البنك، أو دفعة واحدة." />
            <FlowStep number="3" title="شارك الرابط" description="معاينة ثم نسخ الرابط للطلاب." last />
          </ol>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2" aria-label="اختصارات">
        <Link to="/dashboard/quizzes" className="teacher-surface group flex min-h-28 items-center gap-4 p-4 transition hover:border-violet-200 hover:shadow-md">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><TeacherIcon name="quizzes" /></span>
          <span className="min-w-0"><span className="block text-base font-black text-slate-950">إدارة المحتوى</span><span className="mt-1 block text-sm leading-6 text-slate-500">كل الأنشطة السابقة في مكان واحد.</span></span>
          <span aria-hidden="true" className="mr-auto text-lg font-black text-violet-500 transition-transform group-hover:-translate-x-1 motion-reduce:transform-none">←</span>
        </Link>
        <Link to="/dashboard/reports" className="teacher-surface group flex min-h-28 items-center gap-4 p-4 transition hover:border-amber-200 hover:shadow-md">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><TeacherIcon name="reports" /></span>
          <span className="min-w-0"><span className="block text-base font-black text-slate-950">النتائج</span><span className="mt-1 block text-sm leading-6 text-slate-500">الدرجات والمحاولات والتقدم.</span></span>
          <span aria-hidden="true" className="mr-auto text-lg font-black text-amber-600 transition-transform group-hover:-translate-x-1 motion-reduce:transform-none">←</span>
        </Link>
      </section>

      <section aria-labelledby="recent-activities-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="recent-activities-heading" className="text-xl font-black text-[var(--teacher-ink)]">آخر الأنشطة</h2>
            <p className="mt-1 text-sm text-[var(--teacher-muted)]">تابع من المكان الذي توقفت عنده.</p>
          </div>
          <Link to="/dashboard/quizzes" className="inline-flex min-h-11 items-center text-sm font-black text-violet-700 hover:underline">عرض كل المحتوى ←</Link>
        </div>

        {recentQuizzesQuery.isLoading ? (
          <div className="mt-4 space-y-2" role="status" aria-label="جارٍ تحميل أحدث الأنشطة">
            {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-200/70" />)}
          </div>
        ) : null}

        {recentQuizzesQuery.isError ? <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">تعذر تحميل أحدث الأنشطة. يمكن فتح المحتوى للمتابعة.</div> : null}

        {recentQuizzesQuery.data?.items.length === 0 ? (
          <div className="teacher-surface mt-4 py-10 text-center">
            <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-2xl text-violet-700">✦</span>
            <p className="mt-4 text-base font-black text-slate-900">ابدأ بأول Spark</p>
            <p className="mt-1 text-sm text-[var(--teacher-muted)]">خمس أسئلة تكفي لتجربة المسار كاملًا.</p>
            <Link to="/dashboard/activities/new" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-violet-700 px-5 text-sm font-bold text-white hover:bg-violet-800">إنشاء أول نشاط</Link>
          </div>
        ) : null}

        {recentQuizzesQuery.data && recentQuizzesQuery.data.items.length > 0 ? (
          <ul className="teacher-surface mt-4 divide-y divide-slate-100 overflow-hidden" aria-label="أحدث الأنشطة">
            {recentQuizzesQuery.data.items.map((quiz) => <RecentActivityRow key={quiz.id} quiz={quiz} />)}
          </ul>
        ) : null}
      </section>

      <details className="rounded-2xl border border-slate-200 bg-white">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 text-sm font-black text-slate-700 marker:content-none hover:bg-slate-50">
          <span>أدوات إضافية</span>
          <span aria-hidden="true" className="text-slate-400">⌄</span>
        </summary>
        <div className="border-t border-slate-100 p-5 text-sm leading-7 text-slate-600">
          بنك الأسئلة والمنشئ المتقدم وإعدادات النشر ما زالت متاحة، لكنها ليست مطلوبة لإنشاء نشاط عادي.
          <div className="mt-3"><Link to="/dashboard/questions" className="inline-flex min-h-11 items-center rounded-xl border border-violet-200 bg-violet-50 px-4 font-black text-violet-800">فتح بنك الأسئلة</Link></div>
        </div>
      </details>
    </div>
  );
}

function FlowStep({ number, title, description, last = false }: { number: string; title: string; description: string; last?: boolean }) {
  return (
    <li className="relative flex gap-3">
      {!last ? <span aria-hidden="true" className="absolute right-[1.05rem] top-9 h-[calc(100%+0.5rem)] w-px bg-violet-100" /> : null}
      <span aria-hidden="true" className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-black text-violet-800">{number}</span>
      <div><p className="font-black text-slate-900">{title}</p><p className="mt-0.5 text-sm leading-6 text-slate-500">{description}</p></div>
    </li>
  );
}

function RecentActivityRow({ quiz }: { quiz: QuizListItem }) {
  const action = quiz.status === 'Published'
    ? { label: 'إدارة ومشاركة', to: `/dashboard/quizzes/${quiz.id}/sessions` }
    : quiz.status === 'Archived'
      ? { label: 'معاينة', to: `/dashboard/quizzes/${quiz.id}/preview` }
      : { label: 'متابعة التحرير', to: `/dashboard/quizzes/${quiz.id}/edit` };

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-base font-black text-[var(--teacher-ink)]">{quiz.title}</h3>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${quiz.status === 'Published' ? 'bg-emerald-100 text-emerald-800' : quiz.status === 'Archived' ? 'bg-slate-100 text-slate-700' : 'bg-violet-100 text-violet-800'}`}>{QUIZ_STATUS_LABELS[quiz.status]}</span>
        </div>
        <p className="mt-1 text-sm text-[var(--teacher-muted)]">{quiz.itemCount} سؤال · آخر تعديل {new Date(quiz.updatedAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
      </div>
      <Link to={action.to} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:border-violet-400 hover:text-violet-800">{action.label}</Link>
    </li>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="جارٍ تجهيز الصفحة الرئيسية" className="animate-pulse space-y-8">
      <div className="h-20 rounded-2xl bg-slate-200" />
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]"><div className="h-72 rounded-[2rem] bg-slate-200" /><div className="h-72 rounded-2xl bg-slate-200" /></div>
    </div>
  );
}
