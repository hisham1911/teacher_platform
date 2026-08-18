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

  if (workspacesQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (workspacesQuery.isError) {
    return (
      <div role="alert" className="teacher-surface max-w-2xl bg-rose-50 p-5 text-sm text-rose-800">
        <p className="font-bold">تعذر تحميل مساحة العمل.</p>
        <p className="mt-1">تحقق من الاتصال ثم حاول مرة أخرى.</p>
        <button type="button" onClick={() => void workspacesQuery.refetch()} className="mt-4 min-h-11 rounded-lg border border-rose-300 bg-white px-4 py-2 font-bold hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (workspacesQuery.data && workspacesQuery.data.length === 0) {
    return (
      <section className="teacher-surface mx-auto max-w-2xl p-8 text-center">
        <TeacherIcon name="workspace" className="mx-auto h-10 w-10 text-[var(--teacher-primary)]" />
        <h1 className="mt-4 text-2xl font-black text-[var(--teacher-ink)]">أنشئ مساحة عملك الأولى</h1>
        <p className="mx-auto mt-2 max-w-lg text-base leading-7 text-[var(--teacher-muted)]">مساحة العمل تجمع اختباراتك وأسئلتك ونتائج طلابك في مكان واحد.</p>
        <button type="button" onClick={() => navigate('/onboarding')} className="mt-5 min-h-11 rounded-lg bg-[var(--teacher-primary)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--teacher-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">إنشاء مساحة عمل</button>
      </section>
    );
  }

  if (!activeWorkspace) {
    return <p className="teacher-surface p-5 text-sm text-slate-700">اختر مساحة العمل من القائمة الرئيسية للمتابعة.</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      <header>
        <p className="text-sm font-bold text-[var(--teacher-primary-strong)]">{activeWorkspace.name}</p>
        <h1 className="mt-2 text-3xl font-black text-[var(--teacher-ink)]">مرحبًا، {session.user?.fullName ?? 'معلمنا'}</h1>
        <p className="mt-2 text-lg text-[var(--teacher-muted)]">ماذا تريد أن تفعل اليوم؟</p>
      </header>

      <section aria-label="المهام الرئيسية" className="grid gap-4 lg:grid-cols-[1.15fr_1fr_1fr]">
        <TaskAction
          to="/dashboard/quizzes/new"
          icon="create"
          title="إنشاء اختبار جديد"
          description="ابدأ اختبارًا جديدًا وأضف أسئلتك خطوة بخطوة."
          action="ابدأ الآن"
          emphasis="primary"
        />
        <TaskAction
          to="/dashboard/quizzes"
          icon="play"
          title="تشغيل اختبار"
          description="اختر اختبارًا منشورًا ثم ابدأ جلسة ذاتية أو مباشرة."
          action="تشغيل الاختبار"
          emphasis="secondary"
        />
        <TaskAction
          to="/dashboard/reports"
          icon="reports"
          title="عرض النتائج والتقارير"
          description="تابع نتائج الجلسات وأداء الطلاب من مكان واحد."
          action="عرض النتائج"
          emphasis="violet"
        />
      </section>

      <section aria-labelledby="recent-quizzes-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="recent-quizzes-heading" className="text-xl font-black text-[var(--teacher-ink)]">أحدث الاختبارات</h2>
            <p className="mt-1 text-sm text-[var(--teacher-muted)]">ارجع سريعًا إلى آخر ما كنت تعمل عليه.</p>
          </div>
          <div className="flex items-center gap-3">
            {recentQuizzesQuery.data ? <span className="text-sm font-bold tabular-nums text-slate-600">{recentQuizzesQuery.data.totalItems} اختبار</span> : null}
            <Link to="/dashboard/quizzes" className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--teacher-primary-strong)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">عرض الكل ←</Link>
          </div>
        </div>

        {recentQuizzesQuery.isLoading ? (
          <div className="mt-4 space-y-2" role="status" aria-label="جارٍ تحميل أحدث الاختبارات">
            {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-200/70" />)}
          </div>
        ) : null}

        {recentQuizzesQuery.isError ? (
          <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">تعذر تحميل أحدث الاختبارات. يمكنك فتح قائمة الاختبارات للمتابعة.</div>
        ) : null}

        {recentQuizzesQuery.data?.items.length === 0 ? (
          <div className="mt-4 border-t border-slate-200 py-8 text-center">
            <p className="text-base font-bold text-slate-800">لم تنشئ اختبارًا بعد.</p>
            <p className="mt-1 text-sm text-[var(--teacher-muted)]">ابدأ باسم الاختبار، ثم أضف أول سؤال داخل المنشئ.</p>
            <Link to="/dashboard/quizzes/new" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-[var(--teacher-primary)] px-5 text-sm font-bold text-white hover:bg-[var(--teacher-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">إنشاء أول اختبار</Link>
          </div>
        ) : null}

        {recentQuizzesQuery.data && recentQuizzesQuery.data.items.length > 0 ? (
          <ul className="teacher-surface mt-4 divide-y divide-slate-100 overflow-hidden" aria-label="أحدث الاختبارات">
            {recentQuizzesQuery.data.items.map((quiz) => <RecentQuizRow key={quiz.id} quiz={quiz} />)}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function TaskAction({
  to,
  icon,
  title,
  description,
  action,
  emphasis,
}: {
  to: string;
  icon: 'create' | 'play' | 'reports';
  title: string;
  description: string;
  action: string;
  emphasis: 'primary' | 'secondary' | 'violet';
}) {
  const styles = {
    primary: 'bg-[var(--teacher-primary)] text-white',
    secondary: 'teacher-surface text-[var(--teacher-ink)]',
    violet: 'border border-violet-200 bg-[var(--teacher-violet-soft)] text-[var(--teacher-ink)]',
  } as const;
  const iconStyles = {
    primary: 'bg-white/16 text-white',
    secondary: 'bg-[var(--teacher-primary-soft)] text-[var(--teacher-primary-strong)]',
    violet: 'bg-white text-[var(--teacher-violet)]',
  } as const;

  return (
    <Link to={to} className={`${styles[emphasis]} group flex min-h-56 flex-col rounded-xl p-6 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:transform-none`}>
      <span aria-hidden="true" className={`${iconStyles[emphasis]} flex h-12 w-12 items-center justify-center rounded-xl`}><TeacherIcon name={icon} className="h-6 w-6" /></span>
      <h2 className="mt-5 text-xl font-black">{title}</h2>
      <p className={`mt-2 max-w-sm text-base leading-7 ${emphasis === 'primary' ? 'text-emerald-50' : 'text-[var(--teacher-muted)]'}`}>{description}</p>
      <span className={`mt-auto inline-flex min-h-11 items-center pt-5 text-sm font-black ${emphasis === 'primary' ? 'text-white' : 'text-[var(--teacher-primary-strong)]'}`}>{action} ←</span>
    </Link>
  );
}

function RecentQuizRow({ quiz }: { quiz: QuizListItem }) {
  const action = quiz.status === 'Published'
    ? { label: 'تشغيل', to: `/dashboard/quizzes/${quiz.id}/sessions` }
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
      <Link to={action.to} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">{action.label}</Link>
    </li>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="جارٍ تجهيز الصفحة الرئيسية" className="animate-pulse space-y-8">
      <div className="space-y-3"><div className="h-4 w-32 rounded bg-slate-200" /><div className="h-9 w-72 rounded bg-slate-200" /><div className="h-5 w-56 rounded bg-slate-200" /></div>
      <div className="grid gap-4 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-56 rounded-xl bg-slate-200" />)}</div>
    </div>
  );
}
