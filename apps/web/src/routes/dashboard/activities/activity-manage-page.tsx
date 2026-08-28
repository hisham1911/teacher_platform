import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { quizzesApi } from '../../../data/api-client/endpoints';
import { ACTIVITY_MODES, isQuestionTypeAllowedForActivity, type ActivityMode } from '../../../features/activities/activity-mode';
import { launchActivity } from '../../../features/activities/launch-activity';
import { getActiveTenantId } from '../../../lib/auth/session';

export default function ActivityManagePage() {
  const { quizId = '' } = useParams<{ quizId: string }>();
  const tenantId = getActiveTenantId() ?? '';
  const navigate = useNavigate();
  const [mode, setMode] = useState<ActivityMode>('ProgressiveChallenge');

  const draftQuery = useQuery({
    queryKey: ['quiz-draft', tenantId, quizId],
    queryFn: ({ signal }) => quizzesApi.getDraft(tenantId, quizId, signal),
    enabled: Boolean(tenantId && quizId),
    staleTime: 0,
  });

  const draft = draftQuery.data;
  const incompatibleCount = useMemo(() => draft?.items.filter((item) => !isQuestionTypeAllowedForActivity(mode, item.questionType)).length ?? 0, [draft, mode]);

  const launchMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('missing-draft');
      return launchActivity({ tenantId, quizId, mode, draft });
    },
    onSuccess: (result) => navigate(`/dashboard/activities/${quizId}/ready?sessionId=${result.session.id}&mode=${mode}`),
  });

  if (!tenantId || !quizId) return null;
  if (draftQuery.isLoading) return <div role="status" className="teacher-surface animate-pulse p-6 text-sm text-slate-600">جارٍ فتح النشاط…</div>;
  if (draftQuery.isError || !draft) return <div className="teacher-surface p-6"><p role="alert" className="font-bold text-rose-800">تعذر فتح النشاط.</p><Button className="mt-4" variant="secondary" onClick={() => void draftQuery.refetch()}>إعادة المحاولة</Button></div>;

  const canShare = draft.items.length > 0 && incompatibleCount === 0 && !launchMutation.isPending;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/dashboard/quizzes" className="inline-flex min-h-11 items-center text-sm font-bold text-slate-500 hover:text-violet-800">→ المحتوى</Link>
          <p className="mt-2 text-xs font-black tracking-[0.16em] text-violet-700">ACTIVITY</p>
          <h1 dir="auto" className="mt-1 text-3xl font-black text-slate-950">{draft.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{draft.items.length} سؤال · التغييرات محفوظة داخل النشاط</p>
        </div>
        <Link to={`/dashboard/quizzes/${quizId}/edit`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-700">إعدادات متقدمة</Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link to={`/dashboard/activities/${quizId}/build?mode=SelfPaced&editOnly=1`} className="teacher-surface group p-5 transition hover:border-violet-300 hover:shadow-md">
          <span aria-hidden="true" className="text-2xl">✏️</span>
          <h2 className="mt-3 text-xl font-black text-slate-950">تعديل الأسئلة</h2>
          <p className="mt-1 text-sm leading-7 text-slate-600">إضافة أو حذف أو ترتيب الأسئلة بدون الدخول لإعدادات النشر.</p>
          <span className="mt-4 inline-block text-sm font-black text-violet-700">فتح الأسئلة ←</span>
        </Link>
        <Link to={`/dashboard/quizzes/${quizId}/preview`} className="teacher-surface group p-5 transition hover:border-violet-300 hover:shadow-md">
          <span aria-hidden="true" className="text-2xl">👁️</span>
          <h2 className="mt-3 text-xl font-black text-slate-950">معاينة النشاط</h2>
          <p className="mt-1 text-sm leading-7 text-slate-600">شاهد المحتوى كما سيظهر قبل تجهيز رابط الطلاب.</p>
          <span className="mt-4 inline-block text-sm font-black text-violet-700">فتح المعاينة ←</span>
        </Link>
      </section>

      <section className="teacher-surface p-5 sm:p-6" aria-labelledby="share-activity-heading">
        <div className="max-w-2xl">
          <p className="text-xs font-black tracking-[0.16em] text-amber-700">WHEN YOU ARE READY</p>
          <h2 id="share-activity-heading" className="mt-1 text-2xl font-black text-slate-950">جهّز النشاط للطلاب</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">اختاري شكل التجربة الآن. English Spark تتولى النشر وإنشاء جلسة ورمز دخول النشاط خلف الكواليس.</p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {ACTIVITY_MODES.map((definition) => {
            const selected = mode === definition.mode;
            return (
              <button key={definition.mode} type="button" onClick={() => setMode(definition.mode)} className={`rounded-2xl border p-4 text-right transition ${selected ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100' : 'border-slate-200 bg-white hover:border-violet-300'}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-xl" aria-hidden="true">{definition.mode === 'ProgressiveChallenge' ? '🏆' : definition.mode === 'Live' ? '⚡' : '📝'}</span><span className={`h-5 w-5 rounded-full border ${selected ? 'border-violet-700 bg-violet-700 shadow-[inset_0_0_0_4px_white]' : 'border-slate-300'}`} /></div>
                <h3 className="mt-3 font-black text-slate-950">{definition.title}</h3>
                <p className="mt-1 text-xs leading-6 text-slate-600">{definition.description}</p>
              </button>
            );
          })}
        </div>

        {incompatibleCount > 0 ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">طريقة اللعب المختارة لا تناسب {incompatibleCount} من الأسئلة. اختاري طريقة أخرى أو عدّلي أنواع الأسئلة.</p> : null}
        {draft.items.length === 0 ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">أضيفي سؤالًا واحدًا على الأقل قبل تجهيز الرابط.</p> : null}
        {launchMutation.isError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">تعذر تجهيز رابط الطلاب الآن. الأسئلة محفوظة؛ حاولي مرة أخرى.</p> : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-6 text-slate-500">رمز الدخول الذي سيظهر بعد التجهيز هو <b>رمز النشاط</b> وليس كود الطالب.</p>
          <Button disabled={!canShare} onClick={() => launchMutation.mutate()}>{launchMutation.isPending ? <ButtonSpinner /> : null}{launchMutation.isPending ? 'جارٍ التجهيز…' : 'تجهيز رابط الطلاب'}</Button>
        </div>
      </section>
    </div>
  );
}
