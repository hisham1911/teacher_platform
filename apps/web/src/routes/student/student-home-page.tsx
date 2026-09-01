import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { HttpError } from '../../data/api-client/http-error';
import { studentPortalApi } from '../../data/api-client/student-portal-endpoints';
import type { StudentPortalActivity } from '../../types/student-portal';
import { StudentButton, StudentError, StudentLoading, StudentShell } from '../play/student-ui';

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function percentageLabel(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`;
}

function activityStatusLabel(activity: StudentPortalActivity): string {
  if (activity.canResume) return 'قيد التقدم';
  if (activity.status === 'TimedOut') return 'انتهى الوقت';
  if (activity.passed === true) return 'مكتمل ✓';
  if (activity.passed === false) return 'مكتمل';
  return 'نشاط سابق';
}

export default function StudentHomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const homeQuery = useQuery({
    queryKey: ['student-portal', 'home'],
    queryFn: ({ signal }) => studentPortalApi.home(signal),
    retry: false,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (homeQuery.error instanceof HttpError && homeQuery.error.status === 401) {
      navigate('/student', { replace: true });
    }
  }, [homeQuery.error, navigate]);

  const logoutMutation = useMutation({
    mutationFn: () => studentPortalApi.logout(),
    onSettled: async () => {
      queryClient.removeQueries({ queryKey: ['student-portal'] });
      navigate('/student', { replace: true });
    },
  });

  if (homeQuery.isLoading) return <StudentLoading message="جارٍ تجهيز مساحتك…" />;
  if (homeQuery.error instanceof HttpError && homeQuery.error.status === 401) return <StudentLoading message="جارٍ العودة إلى تسجيل الدخول…" />;
  if (homeQuery.isError || !homeQuery.data) {
    return (
      <StudentError
        title="تعذر فتح مساحتك"
        message="لم نتمكن من تحميل بياناتك الآن. تحقق من الاتصال ثم أعد المحاولة."
        action={<StudentButton type="button" onClick={() => void homeQuery.refetch()}>إعادة المحاولة</StudentButton>}
      />
    );
  }

  const home = homeQuery.data;
  const recent = home.recentActivities;

  return (
    <StudentShell width="wide">
      <div className="student-enter space-y-5 pb-4">
        <header className="student-panel overflow-hidden p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-[var(--student-primary-strong)]">{home.profile.workspaceName}</p>
              <h1 className="mt-1 text-2xl font-black text-[var(--student-ink)] sm:text-3xl">أهلًا {firstName(home.profile.fullName)} 👋</h1>
              <p className="mt-2 text-sm leading-7 text-[var(--student-muted)]">دي مساحتك في English Spark. من هنا تكمل اللي بدأت وتراجع تقدمك.</p>
            </div>
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:opacity-50">
              تسجيل الخروج
            </button>
          </div>
        </header>

        {home.continueActivity ? (
          <section className="student-panel overflow-hidden border-2 border-emerald-200 bg-gradient-to-l from-emerald-50 to-white p-5 sm:p-6" aria-labelledby="continue-title">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black text-emerald-700">أكمل من حيث توقفت</p>
                <h2 id="continue-title" dir="auto" className="mt-1 truncate text-xl font-black text-[var(--student-ink)]">{home.continueActivity.quizTitle}</h2>
                <p className="mt-1 text-sm text-[var(--student-muted)]">محاولتك محفوظة. تقدر ترجع لنفس النقطة مباشرة.</p>
              </div>
              <Link to={`/play/${encodeURIComponent(home.continueActivity.joinCode)}`} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-[var(--student-primary)] px-5 text-sm font-black text-white shadow-sm hover:bg-[var(--student-primary-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100">متابعة النشاط</Link>
            </div>
          </section>
        ) : null}

        <section aria-label="ملخص تقدمك" className="grid grid-cols-3 gap-2 sm:gap-4">
          <SummaryCard value={String(home.summary.completedActivities)} label="أنشطة مكتملة" icon="✓" />
          <SummaryCard value={percentageLabel(home.summary.averagePercentage)} label="متوسطك" icon="★" />
          <SummaryCard value={String(home.summary.certificates)} label="شهادات" icon="◇" />
        </section>

        <section className="student-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-black text-[var(--student-ink)]">آخر أنشطتك</h2>
              <p className="mt-1 text-xs leading-6 text-[var(--student-muted)]">آخر ما لعبته أو أنهيته يظهر هنا.</p>
            </div>
            <Link to="/join" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-black text-violet-700 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100">انضم لنشاط سريع</Link>
          </div>

          {recent.length === 0 ? (
            <div className="px-5 py-10 text-center sm:px-6">
              <div aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-xl">⚡</div>
              <h3 className="mt-3 font-black text-[var(--student-ink)]">لسه مفيش أنشطة هنا</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-7 text-[var(--student-muted)]">لما تدخل نشاط باستخدام رمز أو رابط، تقدمك ونتيجتك هيظهروا هنا تلقائيًا.</p>
              <Link to="/join" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-700 px-4 text-sm font-black text-white hover:bg-violet-800">عندي رمز نشاط</Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {recent.map((activity) => <ActivityRow key={activity.attemptId} activity={activity} />)}
            </div>
          )}
        </section>
      </div>
    </StudentShell>
  );
}

function SummaryCard({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <div className="student-panel px-3 py-4 text-center sm:px-5 sm:py-5">
      <div aria-hidden="true" className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--student-violet-soft)] text-sm font-black text-violet-700">{icon}</div>
      <p dir="ltr" className="text-xl font-black text-[var(--student-ink)] sm:text-2xl">{value}</p>
      <p className="mt-1 text-[11px] font-bold leading-5 text-[var(--student-muted)] sm:text-xs">{label}</p>
    </div>
  );
}

function ActivityRow({ activity }: { activity: StudentPortalActivity }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 dir="auto" className="truncate font-black text-[var(--student-ink)]">{activity.quizTitle}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${activity.canResume ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{activityStatusLabel(activity)}</span>
        </div>
        <p className="mt-1 text-xs text-[var(--student-muted)]">{activity.finishedAt ? `النتيجة: ${percentageLabel(activity.percentage)}` : 'النشاط محفوظ في تقدمك'}</p>
      </div>
      {activity.canResume ? (
        <Link to={`/play/${encodeURIComponent(activity.joinCode)}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-800 hover:bg-emerald-100">متابعة</Link>
      ) : (
        <span dir="ltr" className="shrink-0 text-sm font-black text-[var(--student-primary-strong)]">{percentageLabel(activity.percentage)}</span>
      )}
    </div>
  );
}
