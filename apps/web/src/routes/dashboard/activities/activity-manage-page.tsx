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
  const publishedVersion = useMemo(() => versionsQuery.data
    ?.filter((version) => version.status !== 'Draft')
    .sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null, [versionsQuery.data]);
  const incompatibleCount = useMemo(() => draft?.items.filter((item) => !isQuestionTypeAllowedForActivity(mode, item.questionType)).length ?? 0, [draft, mode]);

  const launchMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('missing-draft');
      return launchActivity({ tenantId, quizId, mode, draft });
    },
    onSuccess: (result) => navigate(`/dashboard/activities/${quizId}/ready?sessionId=${result.session.id}&mode=${mode}`),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('missing-draft');
      if (draft.publicationState === 'PublishedCurrent' && publishedVersion) return publishedVersion.id;
      const result = await quizzesApi.publish(tenantId, quizId, { baseVersion: draft.version });
      return result.publishedVersionId;
    },
    onSuccess: (versionId) => navigate(`/dashboard/activities/${quizId}/assign?versionId=${encodeURIComponent(versionId)}&title=${encodeURIComponent(draft?.title ?? '')}`),
  });

  if (!tenantId || !quizId) return null;
  if (draftQuery.isLoading) return <div role="status" className="teacher-surface animate-pulse p-6 text-sm text-slate-600">جارٍ فتح النشاط…</div>;
  if (draftQuery.isError || !draft) return <div className="teacher-surface p-6"><p role="alert" className="font-bold text-rose-800">تعذر فتح النشاط.</p><Button className="mt-4" variant="secondary" onClick={() => void draftQuery.refetch()}>إعادة المحاولة</Button></div>;

  const canLaunch = draft.items.length > 0 && incompatibleCount === 0 && !launchMutation.isPending;
  const canAssign = draft.items.length > 0 && !assignMutation.isPending;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/dashboard/quizzes" className="inline-flex min-h-11 items-center text-sm font-bold text-slate-500 hover:text-violet-800">→ الأنشطة</Link>
          <p className="mt-2 text-xs font-black tracking-[0.08em] text-violet-700">إدارة النشاط</p>
          <h1 dir="auto" className="mt-1 text-3xl font-black text-slate-950">{draft.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{draft.items.length} سؤال · كل خطوة التالية من نفس المكان</p>
        </div>
        <Link to={`/dashboard/quizzes/${quizId}/edit`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-bold text-slate-400 hover:bg-slate-50 hover:text-slate-700">إعدادات متقدمة</Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2" aria-label="بناء ومعاينة النشاط">
        <Link to={`/dashboard/activities/${quizId}/build?mode=SelfPaced&editOnly=1`} className="teacher-surface group p-5 transition hover:border-violet-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100">
          <span aria-hidden="true" className="text-2xl">✏️</span><h2 className="mt-3 text-xl font-black text-slate-950">1. تعديل المحتوى</h2><p className="mt-1 text-sm leading-7 text-slate-600">أضف أو احذف أو رتّب الأسئلة.</p><span className="mt-4 inline-block text-sm font-black text-violet-700">فتح الأسئلة ←</span>
        </Link>
        <Link to={`/dashboard/activities/${quizId}/preview`} className="teacher-surface group p-5 transition hover:border-violet-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100">
          <span aria-hidden="true" className="text-2xl">👁️</span><h2 className="mt-3 text-xl font-black text-slate-950">2. المعاينة</h2><p className="mt-1 text-sm leading-7 text-slate-600">راجع تجربة الطالب قبل إرسال النشاط.</p><span className="mt-4 inline-block text-sm font-black text-violet-700">فتح المعاينة ←</span>
        </Link>
      </section>

      <section id="deliver-activity" className="teacher-surface scroll-mt-24 p-5 sm:p-6" aria-labelledby="next-action-heading">
        <p className="text-xs font-black tracking-[0.08em] text-amber-700">3. أوصله للطلاب</p>
        <h2 id="next-action-heading" className="mt-1 text-2xl font-black text-slate-950">إسناد، مشاركة، أو Live</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">اختر ما يناسب الموقف؛ حفظ الحالة الصحيحة وتجهيز الوصول يتمان خلف الكواليس.</p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <button type="button" disabled={!canAssign} onClick={() => assignMutation.mutate()} className="min-h-44 rounded-2xl border-2 border-violet-500 bg-violet-50 p-5 text-right shadow-sm transition hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-60">
            <span aria-hidden="true" className="text-2xl">🎯</span><h3 className="mt-3 text-lg font-black text-violet-950">إسناد لطلابي</h3><p className="mt-1 text-xs leading-6 text-violet-800">اختر فصلًا أو طلابًا محددين، ويمكنك إضافة موعد نهائي.</p><span className="mt-4 inline-flex min-h-11 items-center text-sm font-black text-violet-800">{assignMutation.isPending ? 'جارٍ التجهيز…' : 'إسناد النشاط ←'}</span>
          </button>
          <button type="button" onClick={() => setMode('SelfPaced')} className={`min-h-44 rounded-2xl border p-5 text-right transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 ${mode === 'SelfPaced' ? 'border-violet-400 bg-white ring-2 ring-violet-100' : 'border-slate-200 bg-white hover:border-violet-300'}`}><span aria-hidden="true" className="text-2xl">🔗</span><h3 className="mt-3 text-lg font-black text-slate-950">مشاركة رابط</h3><p className="mt-1 text-xs leading-6 text-slate-600">أنشئ رابطًا وكودًا يمكن مشاركتهما مباشرة.</p></button>
          <button type="button" onClick={() => setMode('Live')} className={`min-h-44 rounded-2xl border p-5 text-right transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 ${mode === 'Live' ? 'border-violet-400 bg-white ring-2 ring-violet-100' : 'border-slate-200 bg-white hover:border-violet-300'}`}><span aria-hidden="true" className="text-2xl">⚡</span><h3 className="mt-3 text-lg font-black text-slate-950">بدء Live</h3><p className="mt-1 text-xs leading-6 text-slate-600">ابدأ مسابقة مباشرة مع الطلاب في نفس الوقت.</p></button>
        </div>

        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><summary className="min-h-11 cursor-pointer text-sm font-bold text-slate-600">طريقة لعب أخرى</summary><div className="mt-3 grid gap-2 sm:grid-cols-3">{ACTIVITY_MODES.filter((definition) => definition.mode !== 'SelfPaced' && definition.mode !== 'Live').map((definition) => <button key={definition.mode} type="button" onClick={() => setMode(definition.mode)} className={`min-h-12 rounded-xl border px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 ${mode === definition.mode ? 'border-violet-500 bg-violet-50 text-violet-900' : 'border-slate-200 bg-white text-slate-700'}`}>{definition.title}</button>)}</div></details>

        {incompatibleCount > 0 ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">طريقة اللعب المختارة لا تناسب {incompatibleCount} من الأسئلة.</p> : null}
        {draft.items.length === 0 ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">أضف سؤالًا واحدًا على الأقل قبل إرسال النشاط.</p> : null}
        {assignMutation.isError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">تعذر تجهيز الإسناد الآن. المحتوى محفوظ؛ حاول مرة أخرى.</p> : null}
        {launchMutation.isError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">تعذر تجهيز النشاط الآن. المحتوى محفوظ؛ حاول مرة أخرى.</p> : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-6 text-slate-500">طريقة الوصول المختارة: <b>{ACTIVITY_MODES.find((item) => item.mode === mode)?.title}</b></p><Button disabled={!canLaunch} onClick={() => launchMutation.mutate()}>{launchMutation.isPending ? <ButtonSpinner /> : null}{launchMutation.isPending ? 'جارٍ التجهيز…' : mode === 'Live' ? 'تجهيز Live' : 'تجهيز رابط الطلاب'}</Button></div>
      </section>

      <section className="teacher-surface p-5 sm:p-6" aria-labelledby="history-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="history-heading" className="text-lg font-black text-slate-950">تشغيلات ونتائج سابقة</h2><p className="mt-1 text-sm text-slate-600">السجل موجود للمراجعة؛ لا تحتاجه لتوصيل النشاط الآن.</p></div><Link to={`/dashboard/quizzes/${quizId}/sessions`} className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold text-violet-700 hover:bg-violet-50">عرض السجل ←</Link></div>
      </section>
    </div>
  );
}
