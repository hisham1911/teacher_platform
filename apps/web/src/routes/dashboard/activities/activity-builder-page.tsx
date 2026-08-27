import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { TeacherIcon, type TeacherIconName } from '../../../components/ui/teacher-icon';
import { questionBanksApi, questionsApi, quizzesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import {
  getActivityModeDefinition,
  isQuestionTypeAllowedForActivity,
  parseActivityMode,
} from '../../../features/activities/activity-mode';
import { launchActivity } from '../../../features/activities/launch-activity';
import { getActiveTenantId } from '../../../lib/auth/session';
import {
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  type QuestionDifficulty,
  type QuestionType,
} from '../../../types/questions';
import type { QuizDraft } from '../../../types/quizzes';

const QUESTION_ACTIONS: Array<{ type: QuestionType; title: string; description: string; icon: TeacherIconName }> = [
  { type: 'MultipleChoice', title: 'اختيار من متعدد', description: 'سريع للمفردات والمراجعات', icon: 'quizzes' },
  { type: 'TrueFalse', title: 'صح أو خطأ', description: 'سؤال مباشر بإجابتين', icon: 'true-false' },
  { type: 'Listening', title: 'استماع', description: 'صوت ثم سؤال قصير', icon: 'audio' },
  { type: 'Ordering', title: 'ترتيب', description: 'ترتيب كلمات أو عناصر', icon: 'ordering' },
  { type: 'ShortAnswer', title: 'إجابة قصيرة', description: 'إجابة نصية أو إكمال فراغ', icon: 'short-answer' },
];

type AddMode = 'choose' | 'new' | 'bank';

export default function ActivityBuilderPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const activityQuizId = quizId ?? '';
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId() ?? '';
  const mode = parseActivityMode(searchParams.get('mode'));
  const modeDefinition = getActivityModeDefinition(mode);

  const [addMode, setAddMode] = useState<AddMode>('choose');
  const [bankId, setBankId] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [bankType, setBankType] = useState('');
  const [bankDifficulty, setBankDifficulty] = useState('');
  const [bankPage, setBankPage] = useState(1);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  const draftQuery = useQuery({
    queryKey: ['quiz-draft', tenantId, activityQuizId],
    queryFn: ({ signal }) => quizzesApi.getDraft(tenantId, activityQuizId, signal),
    enabled: Boolean(tenantId && activityQuizId),
    staleTime: 0,
  });

  const banksQuery = useQuery({
    queryKey: ['question-banks', tenantId],
    queryFn: ({ signal }) => questionBanksApi.list(tenantId, signal),
    enabled: Boolean(tenantId && addMode === 'bank'),
  });

  const questionFilters = useMemo(() => ({
    bankId: bankId || undefined,
    search: bankSearch.trim() || undefined,
    type: bankType || undefined,
    difficulty: bankDifficulty || undefined,
    page: bankPage,
    pageSize: 20,
  }), [bankId, bankSearch, bankType, bankDifficulty, bankPage]);

  const bankQuestionsQuery = useQuery({
    queryKey: ['activity-question-bank', tenantId, questionFilters],
    queryFn: ({ signal }) => questionsApi.list(tenantId, questionFilters, signal),
    enabled: Boolean(tenantId && addMode === 'bank'),
    placeholderData: (previous) => previous,
  });

  const itemMutation = useMutation({
    mutationFn: (operation: () => Promise<QuizDraft>) => operation(),
    onSuccess: (updated) => {
      queryClient.setQueryData(['quiz-draft', tenantId, activityQuizId], updated);
      void queryClient.invalidateQueries({ queryKey: ['quizzes', tenantId] });
    },
  });

  const addSelectedMutation = useMutation({
    mutationFn: async (questionIds: string[]) => {
      let latest = await quizzesApi.getDraft(tenantId, activityQuizId);
      const existing = new Set(latest.items.map((item) => item.questionId));
      for (const questionId of questionIds) {
        if (existing.has(questionId)) continue;
        latest = await quizzesApi.addItem(tenantId, activityQuizId, { questionId });
        existing.add(questionId);
      }
      return latest;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['quiz-draft', tenantId, activityQuizId], updated);
      setSelectedQuestionIds([]);
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
  const existingQuestionIds = new Set(draft.items.map((item) => item.questionId));
  const unsupportedItems = draft.items.filter((item) => !isQuestionTypeAllowedForActivity(mode, item.questionType));
  const canLaunch = draft.items.length > 0 && unsupportedItems.length === 0 && !itemMutation.isPending && !addSelectedMutation.isPending && !launchMutation.isPending;
  const returnTo = `/dashboard/activities/${activityQuizId}/build?mode=${mode}`;
  const visibleQuestionActions = QUESTION_ACTIONS.filter((action) => isQuestionTypeAllowedForActivity(mode, action.type));
  const bankQuestions = bankQuestionsQuery.data?.items ?? [];
  const selectableOnPage = bankQuestions.filter((question) => !existingQuestionIds.has(question.id) && isQuestionTypeAllowedForActivity(mode, question.questionType));

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

  function toggleSelected(questionId: string) {
    setSelectedQuestionIds((current) => current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId]);
  }

  function selectPage() {
    const ids = selectableOnPage.map((question) => question.id);
    setSelectedQuestionIds((current) => Array.from(new Set([...current, ...ids])));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-44 lg:space-y-6 lg:pb-28">
      <div className="flex items-center justify-between gap-3">
        <Link to="/dashboard" className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-bold text-slate-500 hover:bg-white hover:text-violet-800">→ الرئيسية</Link>
        <Link to={`/dashboard/quizzes/${activityQuizId}/edit`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-black text-slate-500 hover:bg-slate-100 hover:text-slate-800">إعدادات متقدمة</Link>
      </div>

      <header className="teacher-surface p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black tracking-[0.17em] text-violet-700">الخطوة 2 · الأسئلة</p>
            <h1 dir="auto" className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{draft.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black">
              <span className="rounded-full bg-violet-100 px-3 py-1.5 text-violet-800">{modeDefinition.title}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">{draft.items.length} سؤال</span>
              <span className={`rounded-full px-3 py-1.5 ${itemMutation.isPending || addSelectedMutation.isPending ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>{itemMutation.isPending || addSelectedMutation.isPending ? 'جارٍ الحفظ…' : 'محفوظ ✓'}</span>
            </div>
          </div>
          <BuilderProgress />
        </div>
      </header>

      {mode === 'ProgressiveChallenge' ? (
        <section className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
          <span aria-hidden="true" className="text-xl">💡</span>
          <div><p className="font-black">ابدأ بالسهل ثم ارفع الصعوبة</p><p className="mt-0.5">ترتيب الأسئلة هو ترتيب مستويات التحدي، وأول خطأ ينهي الرحلة.</p></div>
        </section>
      ) : null}

      <section aria-labelledby="add-questions-heading">
        <div className="mb-3">
          <h2 id="add-questions-heading" className="text-xl font-black text-slate-950">كيف تريد إضافة الأسئلة؟</h2>
          <p className="mt-1 text-sm text-slate-500">اختر طريقة واحدة الآن. لن نعرض باقي الأدوات إلا عندما تحتاجها.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <button type="button" aria-pressed={addMode === 'new'} onClick={() => setAddMode('new')} className={`group rounded-2xl border-2 p-5 text-right transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none ${addMode === 'new' ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-slate-200 bg-white hover:border-violet-300'}`}>
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${addMode === 'new' ? 'bg-violet-700 text-white' : 'bg-violet-100 text-violet-700'}`}><TeacherIcon name="create" /></span>
            <h3 className="mt-4 text-lg font-black text-slate-950">سؤال جديد</h3>
            <p className="mt-1 text-sm leading-7 text-slate-600">لو ستكتب سؤالًا أو سؤالين الآن.</p>
          </button>
          <button type="button" aria-pressed={addMode === 'bank'} onClick={() => setAddMode('bank')} className={`group rounded-2xl border-2 p-5 text-right transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none ${addMode === 'bank' ? 'border-emerald-500 bg-emerald-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${addMode === 'bank' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-700'}`}><TeacherIcon name="questions" /></span>
            <h3 className="mt-4 text-lg font-black text-slate-950">من بنك الأسئلة</h3>
            <p className="mt-1 text-sm leading-7 text-slate-600">اختر عدة أسئلة موجودة وأضفها مرة واحدة.</p>
          </button>
          <Link to={`/dashboard/activities/${activityQuizId}/bulk?mode=${mode}`} className="group rounded-2xl border-2 border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md motion-reduce:transform-none">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><TeacherIcon name="quizzes" /></span>
            <h3 className="mt-4 text-lg font-black text-slate-950">مجموعة جاهزة</h3>
            <p className="mt-1 text-sm leading-7 text-slate-600">الصق من Excel أو Sheets، أو ارفع CSV.</p>
          </Link>
        </div>
      </section>

      {addMode === 'choose' ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-8 text-center text-sm font-semibold text-slate-500">اختر إحدى الطرق بالأعلى، وسيظهر لك الجزء المطلوب فقط.</div>
      ) : null}

      {addMode === 'new' ? (
        <section className="teacher-surface p-4 sm:p-6" aria-labelledby="quick-add-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 id="quick-add-heading" className="text-xl font-black text-slate-950">اختر نوع السؤال</h2><p className="mt-1 text-sm leading-6 text-slate-600">بعد الحفظ ستعود للنشاط تلقائيًا.</p></div>
            {mode === 'ProgressiveChallenge' ? <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-800">الأنواع المناسبة للتحدي فقط</span> : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleQuestionActions.map((action, index) => (
              <Link key={action.type} to={questionPath(action.type)} className={`group rounded-2xl border p-4 transition hover:border-violet-400 hover:bg-violet-50/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 ${index === 0 ? 'border-violet-200 bg-violet-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-2"><TeacherIcon name={action.icon} className="h-6 w-6 text-violet-700" />{index === 0 ? <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black text-violet-800">الأبسط</span> : null}</div>
                <h3 className="mt-3 font-black text-slate-950">{action.title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {addMode === 'bank' ? (
        <section className="teacher-surface overflow-hidden" aria-labelledby="bank-picker-heading">
          <div className="border-b border-slate-100 p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 id="bank-picker-heading" className="text-xl font-black text-slate-950">اختر من البنك</h2><p className="mt-1 text-sm text-slate-600">يمكن تحديد أكثر من سؤال وإضافتها دفعة واحدة.</p></div>
              <Link to="/dashboard/questions" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-black text-slate-500 hover:bg-slate-50 hover:text-violet-800">إدارة البنك</Link>
            </div>
            <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-black text-slate-700 marker:content-none"><span>بحث وفلترة</span><span aria-hidden="true">⌄</span></summary>
              <div className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="flex flex-col gap-1.5 text-sm font-bold text-slate-700">البنك<select value={bankId} onChange={(event) => { setBankId(event.target.value); setBankPage(1); setSelectedQuestionIds([]); }} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3"><option value="">كل البنوك</option>{(banksQuery.data ?? []).map((bank) => <option key={bank.id} value={bank.id}>{bank.name} ({bank.questionCount})</option>)}</select></label>
                <label className="flex flex-col gap-1.5 text-sm font-bold text-slate-700">بحث<input value={bankSearch} onChange={(event) => { setBankSearch(event.target.value); setBankPage(1); }} placeholder="كلمة من السؤال…" className="min-h-11 rounded-xl border border-slate-300 bg-white px-3" /></label>
                <label className="flex flex-col gap-1.5 text-sm font-bold text-slate-700">النوع<select value={bankType} onChange={(event) => { setBankType(event.target.value); setBankPage(1); }} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3"><option value="">كل الأنواع</option>{Object.entries(QUESTION_TYPE_LABELS).filter(([type]) => isQuestionTypeAllowedForActivity(mode, type as QuestionType)).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
                <label className="flex flex-col gap-1.5 text-sm font-bold text-slate-700">الصعوبة<select value={bankDifficulty} onChange={(event) => { setBankDifficulty(event.target.value); setBankPage(1); }} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3"><option value="">كل المستويات</option>{Object.entries(DIFFICULTY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              </div>
            </details>
          </div>

          {bankQuestionsQuery.isLoading && !bankQuestionsQuery.data ? <p className="p-6 text-sm text-slate-500">جارٍ تحميل بنك الأسئلة…</p> : null}
          {bankQuestionsQuery.isError ? <p role="alert" className="m-4 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-800">تعذر تحميل بنك الأسئلة.</p> : null}
          {bankQuestions.length === 0 && !bankQuestionsQuery.isLoading ? <div className="p-8 text-center"><p className="text-sm text-slate-600">لا توجد أسئلة مطابقة. أنشئ سؤالًا جديدًا أو افتح الفلاتر.</p><Button className="mt-4" onClick={() => setAddMode('new')}>إنشاء سؤال</Button></div> : null}

          {bankQuestions.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
                <button type="button" onClick={selectPage} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 hover:border-violet-300">تحديد المتاح في الصفحة</button>
                <span className="text-sm font-black text-violet-800">تم تحديد {selectedQuestionIds.length}</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {bankQuestions.map((question) => {
                  const alreadyAdded = existingQuestionIds.has(question.id);
                  const allowed = isQuestionTypeAllowedForActivity(mode, question.questionType);
                  const selected = selectedQuestionIds.includes(question.id);
                  return (
                    <li key={question.id} className={`px-4 py-4 sm:px-6 ${!allowed ? 'bg-rose-50/50' : selected ? 'bg-violet-50/50' : ''}`}>
                      <label className={`flex gap-3 ${alreadyAdded || !allowed ? 'cursor-default opacity-65' : 'cursor-pointer'}`}>
                        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-violet-700" checked={selected} disabled={alreadyAdded || !allowed} onChange={() => toggleSelected(question.id)} />
                        <span className="min-w-0 flex-1"><span dir="auto" className="block text-base font-black leading-7 text-slate-950">{question.prompt}</span><span className="mt-1 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{QUESTION_TYPE_LABELS[question.questionType]}</span><span className="rounded-full bg-amber-50 px-2 py-1 text-amber-900">{DIFFICULTY_LABELS[question.difficulty as QuestionDifficulty]}</span>{alreadyAdded ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">مضاف بالفعل ✓</span> : null}{!allowed ? <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-800">غير متوافق مع التجربة</span> : null}</span></span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 sm:px-6">
                <div className="flex gap-2"><Button variant="secondary" disabled={(bankQuestionsQuery.data?.page ?? 1) <= 1} onClick={() => setBankPage((page) => Math.max(1, page - 1))}>السابق</Button><Button variant="secondary" disabled={(bankQuestionsQuery.data?.page ?? 1) >= (bankQuestionsQuery.data?.totalPages ?? 1)} onClick={() => setBankPage((page) => page + 1)}>التالي</Button></div>
                <Button disabled={selectedQuestionIds.length === 0 || addSelectedMutation.isPending} onClick={() => addSelectedMutation.mutate(selectedQuestionIds)}>{addSelectedMutation.isPending ? `جارٍ إضافة ${selectedQuestionIds.length}…` : `إضافة ${selectedQuestionIds.length} للنشاط`}</Button>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="teacher-surface overflow-hidden" aria-labelledby="activity-questions-heading">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3"><div><h2 id="activity-questions-heading" className="text-xl font-black text-slate-950">أسئلة النشاط</h2><p className="mt-1 text-sm text-slate-600">{draft.items.length === 0 ? 'أضف أول سؤال للبدء.' : 'رتّب الأسئلة كما تريد أن يراها الطلاب.'}</p></div>{draft.items.length > 0 ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">{draft.items.length} سؤال</span> : null}</div>
        </div>
        {draft.items.length === 0 ? (
          <div className="px-5 py-10 text-center"><span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><TeacherIcon name="questions" className="h-7 w-7" /></span><h3 className="mt-4 text-lg font-black text-slate-950">النشاط ينتظر أول سؤال</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-600">اختر طريقة الإضافة من الأعلى. لن تحتاج فتح أي شاشة تقنية أخرى.</p></div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {draft.items.map((item, index) => {
              const allowed = isQuestionTypeAllowedForActivity(mode, item.questionType);
              return <li key={item.id} className={`flex gap-3 px-4 py-4 sm:px-5 ${allowed ? '' : 'bg-rose-50'}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-black text-violet-800">{index + 1}</span><div className="min-w-0 flex-1"><p dir="auto" className="text-base font-black leading-7 text-slate-950">{item.prompt}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{QUESTION_TYPE_LABELS[item.questionType]}</span><span className={`rounded-full px-2.5 py-1 ${item.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-800' : item.difficulty === 'Hard' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{DIFFICULTY_LABELS[item.difficulty]}</span>{!allowed ? <span className="rounded-full bg-rose-200 px-2.5 py-1 text-rose-900">غير متوافق</span> : null}</div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => moveItem(item.id, 'up')} disabled={index === 0 || itemMutation.isPending} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30" aria-label={`نقل السؤال ${index + 1} لأعلى`}><TeacherIcon name="move-up" /></button><button type="button" onClick={() => moveItem(item.id, 'down')} disabled={index === draft.items.length - 1 || itemMutation.isPending} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30" aria-label={`نقل السؤال ${index + 1} لأسفل`}><TeacherIcon name="move-down" /></button><Link to={`/dashboard/questions/${item.questionId}/edit`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:border-violet-300 hover:text-violet-800">تعديل</Link><button type="button" onClick={() => removeItem(item.id)} disabled={itemMutation.isPending} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40">إزالة</button></div></div></li>;
            })}
          </ol>
        )}
      </section>

      {itemMutation.isError ? <ErrorNotice error={itemMutation.error} fallback="تعذر تحديث الأسئلة. حاول مرة أخرى." /> : null}
      {addSelectedMutation.isError ? <ErrorNotice error={addSelectedMutation.error} fallback="تعذر إضافة الأسئلة المحددة. لم يتم حذف أي سؤال من البنك." /> : null}
      {launchMutation.isError ? <ErrorNotice error={launchMutation.error} fallback="تعذر تجهيز رابط الطلاب. الأسئلة محفوظة ويمكن المحاولة مرة أخرى." /> : null}

      <div className="fixed inset-x-3 bottom-20 z-30 mx-auto max-w-3xl rounded-2xl border border-violet-100 bg-white/96 p-3 shadow-[0_20px_50px_rgb(76_29_149/0.2)] backdrop-blur lg:bottom-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-slate-950">{draft.items.length === 0 ? 'أضف سؤالًا واحدًا على الأقل' : `${draft.items.length} سؤال جاهز`}</p>{unsupportedItems.length > 0 ? <p className="text-xs font-bold text-rose-700">يوجد {unsupportedItems.length} سؤال غير متوافق مع التجربة الحالية.</p> : <p className="text-xs text-slate-500">الخطوة التالية: تجهيز النشاط ثم معاينته ومشاركة الرابط.</p>}</div><Button disabled={!canLaunch} onClick={() => launchMutation.mutate()}>{launchMutation.isPending ? 'جارٍ تجهيز النشاط…' : 'التالي: تجهيز ومشاركة'}</Button></div>
      </div>
    </div>
  );
}

function BuilderProgress() {
  return (
    <ol className="grid w-full max-w-sm grid-cols-3 gap-1.5" aria-label="مراحل إنشاء النشاط">
      <ProgressItem label="الفكرة" done />
      <ProgressItem label="الأسئلة" active />
      <ProgressItem label="المشاركة" />
    </ol>
  );
}

function ProgressItem({ label, active = false, done = false }: { label: string; active?: boolean; done?: boolean }) {
  return <li className={`rounded-xl px-2 py-2 text-center text-[11px] font-black ${active ? 'bg-violet-700 text-white' : done ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>{done ? '✓ ' : ''}{label}</li>;
}

function ErrorNotice({ error, fallback }: { error: unknown; fallback: string }) {
  let message = fallback;
  if (error instanceof HttpError && error.status === 409) {
    const body = error.body as { detail?: string; title?: string } | null;
    message = body?.detail ?? 'تعذر تنفيذ العملية بسبب تعارض في المحتوى. حدّث الصفحة وحاول مرة أخرى.';
  }
  return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{message}</p>;
}
