import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { TeacherIcon, type TeacherIconName } from '../../../components/ui/teacher-icon';
import { quizzesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import {
  getActivityModeDefinition,
  isQuestionTypeAllowedForActivity,
  parseActivityMode,
} from '../../../features/activities/activity-mode';
import { launchActivity } from '../../../features/activities/launch-activity';
import { getActiveTenantId } from '../../../lib/auth/session';
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS, type QuestionType } from '../../../types/questions';
import type { QuizDraft } from '../../../types/quizzes';

const QUESTION_ACTIONS: Array<{ type: QuestionType; title: string; description: string; icon: TeacherIconName }> = [
  { type: 'MultipleChoice', title: 'اختيار من متعدد', description: 'أفضل اختيار للأسئلة السريعة والمفردات', icon: 'quizzes' },
  { type: 'TrueFalse', title: 'صح أو خطأ', description: 'سؤال مباشر بإجابتين', icon: 'true-false' },
  { type: 'Listening', title: 'استماع', description: 'شغّلي صوتًا ثم اسألي عنه', icon: 'audio' },
  { type: 'Ordering', title: 'ترتيب', description: 'رتّبي كلمات أو عناصر باللمس', icon: 'ordering' },
  { type: 'ShortAnswer', title: 'إجابة قصيرة', description: 'إجابة نصية أو إكمال فراغ', icon: 'short-answer' },
];

export default function ActivityBuilderPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const activityQuizId = quizId ?? '';
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId() ?? '';
  const mode = parseActivityMode(searchParams.get('mode'));
  const modeDefinition = getActivityModeDefinition(mode);

  const draftQuery = useQuery({
    queryKey: ['quiz-draft', tenantId, activityQuizId],
    queryFn: ({ signal }) => quizzesApi.getDraft(tenantId, activityQuizId, signal),
    enabled: Boolean(tenantId && activityQuizId),
    staleTime: 0,
  });

  const itemMutation = useMutation({
    mutationFn: (operation: () => Promise<QuizDraft>) => operation(),
    onSuccess: (updated) => {
      queryClient.setQueryData(['quiz-draft', tenantId, activityQuizId], updated);
      void queryClient.invalidateQueries({ queryKey: ['quizzes', tenantId] });
    },
  });

  const launchMutation = useMutation({
    mutationFn: async () => {
      const latest = await quizzesApi.getDraft(tenantId, activityQuizId);
      return launchActivity({ tenantId, quizId: activityQuizId, mode, draft: latest });
    },
    onSuccess: (result) => {
      navigate(`/dashboard/activities/${activityQuizId}/ready?sessionId=${result.session.id}&mode=${mode}`);
    },
  });

  if (!tenantId || !activityQuizId) return null;

  if (draftQuery.isLoading) {
    return <div role="status" className="teacher-surface animate-pulse p-6 text-sm text-slate-600">جارٍ تجهيز مساحة النشاط…</div>;
  }

  if (draftQuery.isError || !draftQuery.data) {
    return (
      <div className="teacher-surface max-w-2xl p-6">
        <p role="alert" className="font-bold text-rose-800">تعذر تحميل النشاط.</p>
        <button type="button" onClick={() => void draftQuery.refetch()} className="mt-4 min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold">إعادة المحاولة</button>
      </div>
    );
  }

  const draft = draftQuery.data;
  const unsupportedItems = draft.items.filter((item) => !isQuestionTypeAllowedForActivity(mode, item.questionType));
  const canLaunch = draft.items.length > 0 && unsupportedItems.length === 0 && !itemMutation.isPending && !launchMutation.isPending;
  const returnTo = `/dashboard/activities/${activityQuizId}/build?mode=${mode}`;
  const visibleQuestionActions = QUESTION_ACTIONS.filter((action) => isQuestionTypeAllowedForActivity(mode, action.type));

  function questionPath(type: QuestionType) {
    const query = new URLSearchParams({ type, quizId: activityQuizId, returnTo });
    return `/dashboard/questions/new?${query.toString()}`;
  }

  function moveItem(itemId: string, direction: 'up' | 'down') {
    const orderedItemIds = draft.items.map((item) => item.id);
    const index = orderedItemIds.indexOf(itemId);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= orderedItemIds.length) return;
    [orderedItemIds[index], orderedItemIds[target]] = [orderedItemIds[target]!, orderedItemIds[index]!];
    itemMutation.mutate(() => quizzesApi.reorderItems(tenantId, activityQuizId, { orderedItemIds }));
  }

  function removeItem(itemId: string) {
    itemMutation.mutate(() => quizzesApi.removeItem(tenantId, activityQuizId, itemId));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-44 lg:space-y-6 lg:pb-28">
      <header className="teacher-surface overflow-hidden">
        <div className="bg-gradient-to-br from-violet-800 via-violet-700 to-indigo-700 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link to="/dashboard" className="inline-flex min-h-11 items-center text-sm font-bold text-violet-100 hover:text-white">→ الرئيسية</Link>
                <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-black text-white">خطوة 2 من 2</span>
              </div>
              <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200">English Spark Studio</p>
              <h1 dir="auto" className="mt-1 text-2xl font-black sm:text-3xl">{draft.title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-violet-100">{modeDefinition.title} · أضيفي الأسئلة ثم اضغطي تجهيز النشاط.</p>
            </div>
            <Link to={`/dashboard/quizzes/${activityQuizId}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              خيارات متقدمة
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px bg-slate-200">
          <SummaryStat label="الأسئلة" value={String(draft.items.length)} />
          <SummaryStat label="اللعب" value={modeDefinition.title} />
          <SummaryStat label="الحفظ" value={itemMutation.isPending ? 'يحفظ…' : 'تم ✓'} />
        </div>
      </header>

      {mode === 'ProgressiveChallenge' ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
          <p className="font-black">💡 رتّبي الأسئلة من السهل إلى الأصعب</p>
          <p className="mt-1">السؤال الأول هو المستوى الأول، وكل إجابة صحيحة تنقل الطالب للمستوى التالي.</p>
        </section>
      ) : null}

      <section className="teacher-surface p-4 sm:p-6" aria-labelledby="quick-add-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="quick-add-heading" className="text-xl font-black text-slate-950">+ أضيفي سؤالًا</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">اختاري النوع. بعد الحفظ سترجعين هنا تلقائيًا.</p>
          </div>
          {mode === 'ProgressiveChallenge' ? <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-800">المناسب للتحدي فقط</span> : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleQuestionActions.map((action, index) => (
            <Link key={action.type} to={questionPath(action.type)} className={`group rounded-2xl border p-4 transition hover:border-violet-400 hover:bg-violet-50/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 ${index === 0 ? 'border-violet-200 bg-violet-50/40' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between gap-2">
                <TeacherIcon name={action.icon} className="h-6 w-6 text-violet-700" />
                {index === 0 ? <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black text-violet-800">الأبسط</span> : null}
              </div>
              <h3 className="mt-3 font-black text-slate-950">{action.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="teacher-surface overflow-hidden" aria-labelledby="activity-questions-heading">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="activity-questions-heading" className="text-xl font-black text-slate-950">أسئلة النشاط</h2>
              <p className="mt-1 text-sm text-slate-600">{draft.items.length === 0 ? 'أضيفي أول سؤال للبدء.' : 'غيّري الترتيب بالسهمين إذا احتجتِ.'}</p>
            </div>
            {draft.items.length > 0 ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{draft.items.length} سؤال</span> : null}
          </div>
        </div>

        {draft.items.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><TeacherIcon name="questions" className="h-7 w-7" /></span>
            <h3 className="mt-4 text-lg font-black text-slate-950">ابدئي بأول سؤال</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-600">خمسة أسئلة قصيرة كافية جدًا لأول تجربة.</p>
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {draft.items.map((item, index) => {
              const allowed = isQuestionTypeAllowedForActivity(mode, item.questionType);
              return (
                <li key={item.id} className={`flex gap-3 px-4 py-4 sm:px-5 ${allowed ? '' : 'bg-rose-50'}`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-black text-violet-800">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="text-base font-black leading-7 text-slate-950">{item.prompt}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{QUESTION_TYPE_LABELS[item.questionType]}</span>
                      <span className={`rounded-full px-2.5 py-1 ${item.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-800' : item.difficulty === 'Hard' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{DIFFICULTY_LABELS[item.difficulty]}</span>
                      {!allowed ? <span className="rounded-full bg-rose-200 px-2.5 py-1 text-rose-900">غير متوافق</span> : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => moveItem(item.id, 'up')} disabled={index === 0 || itemMutation.isPending} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30" aria-label={`نقل السؤال ${index + 1} لأعلى`}><TeacherIcon name="move-up" /></button>
                      <button type="button" onClick={() => moveItem(item.id, 'down')} disabled={index === draft.items.length - 1 || itemMutation.isPending} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30" aria-label={`نقل السؤال ${index + 1} لأسفل`}><TeacherIcon name="move-down" /></button>
                      <Link to={`/dashboard/questions/${item.questionId}/edit`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:border-violet-300 hover:text-violet-800">تعديل</Link>
                      <button type="button" onClick={() => removeItem(item.id)} disabled={itemMutation.isPending} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40">إزالة</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {itemMutation.isError ? <ErrorNotice error={itemMutation.error} fallback="تعذر تحديث الأسئلة. حاولي مرة أخرى." /> : null}
      {launchMutation.isError ? <ErrorNotice error={launchMutation.error} fallback="تعذر تجهيز رابط الطلاب. لم نفقد أسئلتك؛ حاولي مرة أخرى." /> : null}
      {unsupportedItems.length > 0 ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-bold leading-6 text-rose-800">يوجد {unsupportedItems.length} سؤال غير متوافق مع {modeDefinition.title}. احذفيه أو غيّري طريقة اللعب قبل التجهيز.</p>
      ) : null}

      <div className="fixed inset-x-0 bottom-[4.6rem] z-30 border-t border-violet-100 bg-white/96 p-3 shadow-[0_-8px_24px_rgb(76_29_149/0.08)] backdrop-blur lg:bottom-0 lg:z-40 lg:pe-6 lg:ps-72">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden sm:block">
            <p className="text-sm font-black text-slate-900">{draft.items.length === 0 ? 'أضيفي أول سؤال للمتابعة' : `${draft.items.length} سؤال جاهز`}</p>
            <p className="text-xs text-slate-500">English Spark ستتولى النشر والرابط تلقائيًا.</p>
          </div>
          <button type="button" onClick={() => launchMutation.mutate()} disabled={!canLaunch} className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 text-sm font-black text-white shadow-sm transition hover:bg-violet-800 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            {launchMutation.isPending ? 'جارٍ التجهيز…' : mode === 'Live' ? 'تجهيز المسابقة' : 'النشاط جاهز — شاركيه'}
            {!launchMutation.isPending ? <span aria-hidden="true">←</span> : null}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-3 py-3 text-center sm:px-5 sm:text-start">
      <p className="text-[10px] font-bold text-slate-500 sm:text-xs">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-slate-900 sm:text-sm">{value}</p>
    </div>
  );
}

function ErrorNotice({ error, fallback }: { error: unknown; fallback: string }) {
  let message = fallback;
  if (error instanceof HttpError) {
    const body = error.body as { title?: string; detail?: string } | null;
    if (body?.title === 'UnsupportedQuestionTypesForMode') {
      message = 'طريقة اللعب المختارة لا تدعم أحد أنواع الأسئلة الحالية. راجعي الأسئلة ثم حاولي مجددًا.';
    } else if (body?.detail) {
      message = body.detail;
    }
  }
  return <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-bold leading-6 text-rose-800">{message}</p>;
}
