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
  const [mode, setMode] = useState<ActivityMode>('SelfPaced');

  const draftQuery = useQuery({
    queryKey: ['quiz-draft', tenantId, quizId],
    queryFn: ({ signal }) => quizzesApi.getDraft(tenantId, quizId, signal),
    enabled: Boolean(tenantId && quizId),
    staleTime: 0,
  });
  const versionsQuery = useQuery({
    queryKey: ['quiz-versions', tenantId, quizId],
    queryFn: ({ signal }) => quizzesApi.listVersions(tenantId, quizId, signal),
    enabled: Boolean(tenantId && quizId),
  });

  const draft = draftQuery.data;
  const publishedVersion = useMemo(
    () => versionsQuery.data
      ?.filter((version) => version.status !== 'Draft')
      .sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null,
    [versionsQuery.data],
  );
  const incompatibleCount = useMemo(
    () => draft?.items.filter(
      (item) => !isQuestionTypeAllowedForActivity(mode, item.questionType),
    ).length ?? 0,
    [draft, mode],
  );

  const launchMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('missing-draft');
      return launchActivity({ tenantId, quizId, mode, draft });
    },
    onSuccess: (result) => navigate(
      `/dashboard/activities/${quizId}/ready?sessionId=${result.session.id}&mode=${mode}`,
    ),
  });

  if (!tenantId || !quizId) return null;
  if (draftQuery.isLoading) {
    return (
      <div role="status" className="teacher-surface animate-pulse p-6 text-sm text-slate-600">
        جارٍ فتح النشاط…
      </div>
    );
  }
  if (draftQuery.isError || !draft) {
    return (
      <div className="teacher-surface p-6">
        <p role="alert" className="font-bold text-rose-800">تعذر فتح النشاط.</p>
        <Button className="mt-4" variant="secondary" onClick={() => void draftQuery.refetch()}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  const canPrepare = draft.items.length > 0
    && incompatibleCount === 0
    && !launchMutation.isPending;
  const assignUrl = publishedVersion
    ? `/dashboard/activities/${quizId}/assign?versionId=${encodeURIComponent(publishedVersion.id)}&title=${encodeURIComponent(draft.title)}`
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/dashboard/quizzes" className="inline-flex min-h-11 items-center text-sm font-bold text-slate-500 hover:text-violet-800">→ الأنشطة</Link>
          <p className="mt-2 text-xs font-black tracking-[0.14em] text-violet-700">إدارة النشاط</p>
          <h1 dir="auto" className="mt-1 text-3xl font-black text-slate-950">{draft.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{draft.items.length} سؤال · من هنا تعدّل وتعاين وتختار كيف يصل النشاط للطلاب.</p>
        </div>
        <Link to={`/dashboard/quizzes/${quizId}/edit`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800">إعدادات النشاط</Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="خطوات إدارة النشاط">
        <Link to={`/dashboard/activities/${quizId}/build?mode=${mode}&editOnly=1`} className="teacher-surface group p-5 transition hover:border-violet-300 hover:shadow-md">
          <span aria-hidden="true" className="text-2xl">✏️</span><h2 className="mt-3 text-lg font-black text-slate-950">1. تعديل المحتوى</h2><p className="mt-1 text-sm leading-7 text-slate-600">أضف الأسئلة ورتّبها وعدّل النقاط.</p><span className="mt-3 inline-block text-sm font-black text-violet-700">فتح الأسئلة ←</span>
        </Link>
        <Link to={`/dashboard/quizzes/${quizId}/preview`} className="teacher-surface group p-5 transition hover:border-violet-300 hover:shadow-md">
          <span aria-hidden="true" className="text-2xl">👁️</span><h2 className="mt-3 text-lg font-black text-slate-950">2. المعاينة</h2><p className="mt-1 text-sm leading-7 text-slate-600">راجع المحتوى كما سيظهر قبل إرساله.</p><span className="mt-3 inline-block text-sm font-black text-violet-700">فتح المعاينة ←</span>
        </Link>
        <a href="#deliver-activity" className="teacher-surface group p-5 transition hover:border-violet-300 hover:shadow-md">
          <span aria-hidden="true" className="text-2xl">🚀</span><h2 className="mt-3 text-lg font-black text-slate-950">3. أوصله للطلاب</h2><p className="mt-1 text-sm leading-7 text-slate-600">أسنده لطلابك، شارك رابطًا، أو جهّز مسابقة مباشرة.</p><span className="mt-3 inline-block text-sm font-black text-violet-700">اختيار الطريقة ↓</span>
        </a>
      </section>

      <section id="deliver-activity" className="teacher-surface scroll-mt-24 p-5 sm:p-6" aria-labelledby="deliver-activity-heading">
        <div className="max-w-2xl">
          <p className="text-xs font-black tracking-[0.14em] text-amber-700">طريقة الوصول</p>
          <h2 id="deliver-activity-heading" className="mt-1 text-2xl font-black text-slate-950">كيف سيستخدم الطلاب هذا النشاط؟</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">اختر التجربة المناسبة. English Spark تتولى تجهيز ما يلزم خلف الكواليس وتعرض لك الخطوة التالية فقط.</p>
        </div>

        <div className="mt-5">
          {assignUrl ? (
            <Link to={assignUrl} className="flex min-h-28 items-center gap-4 rounded-2xl border-2 border-violet-400 bg-violet-50 p-5 transition hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100">
              <span aria-hidden="true" className="text-3xl">🎯</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black text-violet-950">إسناد لطلابي</h3>
                <p className="mt-1 text-sm leading-7 text-violet-800">اختر فصلًا أو طلابًا محددين، وحدد موعدًا إن احتجت. سيظهر التكليف داخل بوابة الطالب.</p>
              </div>
              <span className="shrink-0 text-sm font-black text-violet-800">ابدأ ←</span>
            </Link>
          ) : (
            <Link to={`/dashboard/quizzes/${quizId}/publish`} className="flex min-h-28 items-center gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 transition hover:bg-amber-100">
              <span aria-hidden="true" className="text-3xl">🎯</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black text-amber-950">إسناد لطلابي</h3>
                <p className="mt-1 text-sm leading-7 text-amber-800">ثبّت نسخة النشاط أولًا حتى يصل للطلاب نفس المحتوى الذي راجعته.</p>
              </div>
              <span className="shrink-0 text-sm font-black text-amber-900">تجهيز النشاط ←</span>
            </Link>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {ACTIVITY_MODES.map((definition) => {
            const selected = mode === definition.mode;
            return (
              <button key={definition.mode} type="button" onClick={() => setMode(definition.mode)} className={`min-h-36 rounded-2xl border p-4 text-right transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 ${selected ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100' : 'border-slate-200 bg-white hover:border-violet-300'}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-xl" aria-hidden="true">{definition.mode === 'ProgressiveChallenge' ? '🏆' : definition.mode === 'Live' ? '⚡' : '📝'}</span><span aria-hidden="true" className={`h-5 w-5 rounded-full border ${selected ? 'border-violet-700 bg-violet-700 shadow-[inset_0_0_0_4px_white]' : 'border-slate-300'}`} /></div>
                <h3 className="mt-3 font-black text-slate-950">{definition.title}</h3><p className="mt-1 text-xs leading-6 text-slate-600">{definition.description}</p>
              </button>
            );
          })}
        </div>

        {incompatibleCount > 0 ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">هذه الطريقة لا تناسب {incompatibleCount} من الأسئلة. اختر طريقة أخرى أو عدّل أنواع الأسئلة.</p> : null}
        {draft.items.length === 0 ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">أضف سؤالًا واحدًا على الأقل قبل المتابعة.</p> : null}
        {launchMutation.isError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">تعذر تجهيز النشاط الآن. المحتوى محفوظ؛ حاول مرة أخرى.</p> : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-6 text-slate-500">سيظهر لك رابط ورمز النشاط بعد التجهيز. كود الطالب يظل منفصلًا عن رمز النشاط.</p>
          <Button disabled={!canPrepare} onClick={() => launchMutation.mutate()}>{launchMutation.isPending ? <ButtonSpinner /> : null}{launchMutation.isPending ? 'جارٍ التجهيز…' : mode === 'Live' ? 'تجهيز المسابقة' : 'تجهيز المشاركة'}</Button>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div><h2 className="text-sm font-black text-slate-800">تشغيلات ونتائج سابقة</h2><p className="mt-1 text-xs text-slate-500">راجع ما تم تشغيله سابقًا بدون إدخال تفاصيل الجلسة في المسار الأساسي.</p></div>
        <Link to={`/dashboard/quizzes/${quizId}/sessions`} className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-black text-slate-700 hover:bg-white hover:text-violet-800">عرض السجل</Link>
      </section>
    </div>
  );
}
