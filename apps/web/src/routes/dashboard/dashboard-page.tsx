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
        <h1 className="mt-4 text-2xl font-black text-[var(--teacher-ink)]">جهّزي مساحة English Spark</h1>
        <p className="mx-auto mt-2 max-w-lg text-base leading-7 text-[var(--teacher-muted)]">المساحة تجمع أنشطتك وأسئلتك ونتائج الطلاب في مكان واحد.</p>
        <button type="button" onClick={() => navigate('/onboarding')} className="mt-5 min-h-11 rounded-xl bg-violet-700 px-5 py-2 text-sm font-bold text-white hover:bg-violet-800">إنشاء مساحة العمل</button>
      </section>
    );
  }

  if (!activeWorkspace) {
    return <p className="teacher-surface p-5 text-sm text-slate-700">اختاري مساحة العمل من القائمة للمتابعة.</p>;
  }

  const firstName = session.user?.fullName?.trim().split(/\s+/)[0] ?? 'مريم';

  return (
    <div className="flex flex-col gap-9">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-violet-700 via-indigo-700 to-slate-900 px-6 py-8 text-white sm:px-8 sm:py-10">
        <span aria-hidden="true" className="absolute -left-12 -top-16 h-48 w-48 rounded-full bg-amber-300/15 blur-2xl" />
        <span aria-hidden="true" className="absolute -bottom-20 right-1/3 h-56 w-56 rounded-full bg-fuchsia-300/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="text-sm font-black text-amber-200">{activeWorkspace.name} · English Spark Studio</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">مرحبًا، {firstName} 👋</h1>
          <p className="mt-3 text-lg leading-8 text-violet-100">ماذا تريدين أن تفعلي اليوم؟ ابدئي بالنشاط، ونحن نتولى خطوات النشر والرابط خلف الكواليس.</p>
          <Link to="/dashboard/activities/new" className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-black text-violet-800 shadow-sm hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <TeacherIcon name="create" />إنشاء نشاط جديد
          </Link>
        </div>
      </header>

      <section aria-label="المهام الرئيسية" className="grid gap-4 md:grid-cols-3">
        <TaskAction
          to="/dashboard/activities/new"
          icon="create"
          title="إنشاء نشاط"
          description="اختاري طريقة اللعب، أضيفي الأسئلة، وخذي رابط الطلاب مباشرة."
          action="ابدئي الآن"
          tone="violet"
        />
        <TaskAction
          to="/dashboard/quizzes"
          icon="quizzes"
          title="إدارة المحتوى"
          description="راجعي الأنشطة السابقة أو افتحي الأدوات المتقدمة عند الحاجة."
          action="فتح المحتوى"
          tone="white"
        />
        <TaskAction
          to="/dashboard/reports"
          icon="reports"
          title="النتائج"
          description="تابعي المحاولات والدرجات والتقدم من شاشة واحدة."
          action="مشاهدة النتائج"
          tone="amber"
        />
      </section>

      <section aria-labelledby="recent-activities-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="recent-activities-heading" className="text-xl font-black text-[var(--teacher-ink)]">آخر ما عملتِ عليه</h2>
            <p className="mt-1 text-sm text-[var(--teacher-muted)]">ارجعي بسرعة إلى أحدث الأنشطة والمحتوى.</p>
          </div>
          <div className="flex items-center gap-3">
            {recentQuizzesQuery.data ? <span className="text-sm font-bold tabular-nums text-slate-600">{recentQuizzesQuery.data.totalItems} نشاط</span> : null}
            <Link to="/dashboard/quizzes" className="inline-flex min-h-11 items-center text-sm font-bold text-violet-700 hover:underline">عرض الكل ←</Link>
          </div>
        </div>

        {recentQuizzesQuery.isLoading ? (
          <div className="mt-4 space-y-2" role="status" aria-label="جارٍ تحميل أحدث الأنشطة">
            {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-200/70" />)}
          </div>
        ) : null}

        {recentQuizzesQuery.isError ? <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">تعذر تحميل أحدث الأنشطة. يمكنك فتح المحتوى للمتابعة.</div> : null}

        {recentQuizzesQuery.data?.items.length === 0 ? (
          <div className="teacher-surface mt-4 py-10 text-center">
            <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-2xl text-violet-700">✦</span>
            <p className="mt-4 text-base font-black text-slate-900">جاهزة لأول Spark؟</p>
            <p className="mt-1 text-sm text-[var(--teacher-muted)]">ابدئي بنشاط صغير من خمس أسئلة لتجربة المسار الجديد.</p>
            <Link to="/dashboard/activities/new" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-violet-700 px-5 text-sm font-bold text-white hover:bg-violet-800">إنشاء أول نشاط</Link>
          </div>
        ) : null}

        {recentQuizzesQuery.data && recentQuizzesQuery.data.items.length > 0 ? (
          <ul className="teacher-surface mt-4 divide-y divide-slate-100 overflow-hidden" aria-label="أحدث الأنشطة">
            {recentQuizzesQuery.data.items.map((quiz) => <RecentActivityRow key={quiz.id} quiz={quiz} />)}
          </ul>
        ) : null}
      </section>

      <section className="rounded-2xl border border-violet-100 bg-violet-50/60 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-black text-violet-950">تحتاجين الأدوات القديمة؟</h2>
            <p className="mt-1 text-sm leading-6 text-violet-900/75">بنك الأسئلة والمنشئ المتقدم وإعدادات النشر ما زالت موجودة للمستخدم المتقدم.</p>
          </div>
          <Link to="/dashboard/questions" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-200 bg-white px-4 text-sm font-bold text-violet-800">فتح بنك الأسئلة</Link>
        </div>
      </section>
    </div>
  );
}

function TaskAction({ to, icon, title, description, action, tone }: {
  to: string;
  icon: 'create' | 'quizzes' | 'reports';
  title: string;
  description: string;
  action: string;
  tone: 'violet' | 'white' | 'amber';
}) {
  const styles = {
    violet: 'border-violet-200 bg-violet-700 text-white',
    white: 'border-slate-200 bg-white text-slate-950',
    amber: 'border-amber-200 bg-amber-50 text-slate-950',
  } as const;
  return (
    <Link to={to} className={`${styles[tone]} group flex min-h-52 flex-col rounded-2xl border p-5 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 motion-reduce:transform-none`}>
      <span aria-hidden="true" className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone === 'violet' ? 'bg-white/15 text-white' : tone === 'amber' ? 'bg-white text-amber-700' : 'bg-violet-100 text-violet-700'}`}><TeacherIcon name={icon} /></span>
      <h2 className="mt-4 text-xl font-black">{title}</h2>
      <p className={`mt-2 text-sm leading-7 ${tone === 'violet' ? 'text-violet-100' : 'text-slate-600'}`}>{description}</p>
      <span className={`mt-auto pt-4 text-sm font-black ${tone === 'violet' ? 'text-white' : 'text-violet-700'}`}>{action} ←</span>
    </Link>
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
      <div className="h-56 rounded-3xl bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-52 rounded-2xl bg-slate-200" />)}</div>
    </div>
  );
}
