import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { TeacherIcon, type TeacherIconName } from '../../../components/ui/teacher-icon';
import { FormField, SelectInput, TextArea, TextInput } from '../../../components/ui/form-field';
import { questionsApi, quizzesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import {
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  type QuestionDifficulty,
  type QuestionType,
} from '../../../types/questions';
import {
  QUIZ_THEME_TEMPLATE_LABELS,
  QUIZ_THEME_TEMPLATES,
  TIME_MODE_LABELS,
  type QuizDraft,
  type QuizThemeTemplate,
  type QuizTimeMode,
  type UpdateDraftRequest,
} from '../../../types/quizzes';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const AUTOSAVE_DEBOUNCE_MS = 1200;

const questionTypeActions: Array<{ type: QuestionType; label: string; description: string; icon: TeacherIconName }> = [
  { type: 'MultipleChoice', label: 'اختيار من متعدد', description: 'اختيار واحد صحيح', icon: 'quizzes' },
  { type: 'TrueFalse', label: 'صح أو خطأ', description: 'إجابة سريعة وواضحة', icon: 'true-false' },
  { type: 'ShortAnswer', label: 'إجابة قصيرة', description: 'إجابة نصية محددة', icon: 'short-answer' },
  { type: 'Ordering', label: 'ترتيب', description: 'رتّب العناصر باللمس', icon: 'ordering' },
  { type: 'Listening', label: 'استماع', description: 'سؤال مع مقطع صوتي', icon: 'audio' },
];

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export default function QuizEditPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();

  const draftQuery = useQuery({
    queryKey: ['quiz-draft', tenantId, quizId],
    queryFn: ({ signal }) => quizzesApi.getDraft(tenantId!, quizId!, signal),
    enabled: Boolean(tenantId && quizId),
    staleTime: 0,
  });
  const draft = draftQuery.data;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [passingPercentage, setPassingPercentage] = useState(50);
  const [timeMode, setTimeMode] = useState<QuizTimeMode>('None');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | ''>('');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [themeTemplate, setThemeTemplate] = useState<QuizThemeTemplate>('default');
  const [primaryColor, setPrimaryColor] = useState('#0284c7');
  const [secondaryColor, setSecondaryColor] = useState('#0f172a');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [colorError, setColorError] = useState<string | null>(null);

  // Track the latest known version for optimistic concurrency
  const versionRef = useRef<number>(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNowRef = useRef<() => void>(() => undefined);
  const initializedRef = useRef(false);

  // Sync form from draft on first load / after reload
  useEffect(() => {
    if (!draft) return;
    if (initializedRef.current && versionRef.current === draft.version) return;
    initializedRef.current = true;
    versionRef.current = draft.version;
    setTitle(draft.title);
    setDescription(draft.description ?? '');
    setInstructions(draft.instructions ?? '');
    setPassingPercentage(draft.passingPercentage);
    setTimeMode(draft.timeMode);
    setTimeLimitSeconds(draft.timeLimitSeconds ?? '');
    setShuffleQuestions(draft.shuffleQuestions);
    setShuffleOptions(draft.shuffleOptions);
    setThemeTemplate((draft.theme?.template as QuizThemeTemplate) ?? 'default');
    setPrimaryColor(draft.theme?.primaryColor ?? '#0284c7');
    setSecondaryColor(draft.theme?.secondaryColor ?? '#0f172a');
    setBackgroundColor(draft.theme?.backgroundColor ?? '#ffffff');
    setConflictMessage(null);
  }, [draft]);

  const saveMutation = useMutation({
    mutationFn: (request: UpdateDraftRequest) =>
      quizzesApi.updateDraft(tenantId!, quizId!, request),
    onSuccess: async (updated) => {
      versionRef.current = updated.version;
      setSaveState('saved');
      setSaveError(null);
      setConflictMessage(null);
      queryClient.setQueryData(['quiz-draft', tenantId, quizId], updated);
      await queryClient.invalidateQueries({ queryKey: ['quizzes', tenantId] });
    },
    onError: (error) => {
      setSaveState('error');
      if (error instanceof HttpError && error.status === 409) {
        setConflictMessage('تم تحديث هذا الاختبار في مكان آخر. حمّل أحدث نسخة قبل متابعة التعديل.');
        setSaveError(null);
      } else if (error instanceof HttpError && error.status === 403) {
        setSaveError('ليس لديك صلاحية تعديل الاختبارات (يلزم دور مالك أو معلم).');
      } else if (error instanceof HttpError) {
        const body = error.body as { title?: string; detail?: string } | null;
        setSaveError(body?.detail ? `تعذر الحفظ: ${body.detail}` : 'تعذر الحفظ. راجع البيانات ثم أعد المحاولة.');
      } else {
        setSaveError('فشل الحفظ. تحقق من الاتصال.');
      }
    },
  });

  function buildUpdateRequest(): UpdateDraftRequest | null {
    setColorError(null);
    for (const [label, value] of [
      ['اللون الأساسي', primaryColor],
      ['اللون الثانوي', secondaryColor],
      ['لون الخلفية', backgroundColor],
    ] as const) {
      if (!HEX_COLOR_PATTERN.test(value)) {
        setColorError(`${label} يجب أن يكون بصيغة hex مثل #0284c7.`);
        return null;
      }
    }
    return {
      title: title.trim(),
      description: description.trim() || undefined,
      instructions: instructions.trim() || undefined,
      passingPercentage,
      timeMode,
      timeLimitSeconds: timeMode === 'None' ? undefined : timeLimitSeconds === '' ? undefined : Number(timeLimitSeconds),
      shuffleQuestions,
      shuffleOptions,
      theme: { template: themeTemplate, primaryColor, secondaryColor, backgroundColor },
      baseVersion: versionRef.current,
    };
  }

  function saveNow() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const request = buildUpdateRequest();
    if (!request) return;
    setSaveState('saving');
    saveMutation.mutate(request);
  }

  saveNowRef.current = saveNow;

  function scheduleAutosave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState('pending');
    debounceRef.current = setTimeout(() => saveNowRef.current(), AUTOSAVE_DEBOUNCE_MS);
  }

  async function saveBeforeNavigation(event: ReactMouseEvent<HTMLAnchorElement>, path: string) {
    if (saveState === 'saving') {
      event.preventDefault();
      return;
    }
    if (saveState !== 'pending' && saveState !== 'error') return;

    event.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const request = buildUpdateRequest();
    if (!request) return;

    setSaveState('saving');
    try {
      await saveMutation.mutateAsync(request);
      navigate(path);
    } catch {
      // The mutation callbacks keep the user on the page and show the actionable error.
    }
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const itemMutation = useMutation({
    mutationFn: (fn: () => Promise<QuizDraft>) => fn(),
    onSuccess: (updated) => {
      versionRef.current = updated.version;
      queryClient.setQueryData(['quiz-draft', tenantId, quizId], updated);
      setConflictMessage(null);
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        setConflictMessage('تم تحديث أسئلة الاختبار في مكان آخر. حمّل أحدث نسخة ثم أعد المحاولة.');
      } else if (error instanceof HttpError) {
        const body = error.body as { title?: string; detail?: string } | null;
        setSaveError(body?.detail ? `تعذر تحديث الأسئلة: ${body.detail}` : 'تعذر تحديث الأسئلة. أعد المحاولة.');
      }
    },
  });

  function onAddItem(questionId: string) {
    itemMutation.mutate(() => quizzesApi.addItem(tenantId!, quizId!, { questionId }));
  }

  function onRemoveItem(itemId: string) {
    itemMutation.mutate(() => quizzesApi.removeItem(tenantId!, quizId!, itemId));
  }

  function onMoveItem(itemId: string, direction: 'up' | 'down') {
    if (!draft) return;
    const ids = draft.items.map((i) => i.id);
    const index = ids.indexOf(itemId);
    if (index < 0) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= ids.length) return;
    const current = ids[index];
    const swap = ids[target];
    if (current === undefined || swap === undefined) return;
    ids[index] = swap;
    ids[target] = current;
    itemMutation.mutate(() => quizzesApi.reorderItems(tenantId!, quizId!, { orderedItemIds: ids }));
  }

  function onUpdateItemPoints(itemId: string, points: number) {
    if (!draft) return;
    const item = draft.items.find((i) => i.id === itemId);
    if (!item) return;
    itemMutation.mutate(() =>
      quizzesApi.updateItem(tenantId!, quizId!, itemId, { points, isRequired: item.isRequired }),
    );
  }

  /** GAP-C: تثبيت أحدث نسخة من السؤال المصدر على عنصر المسودة (409 عند تعارض BaseVersion). */
  function onUseLatestVersion(itemId: string) {
    itemMutation.mutate(() =>
      quizzesApi.useLatestItemVersion(tenantId!, quizId!, itemId, { baseVersion: versionRef.current }),
    );
  }

  const [pickerSearchInput, setPickerSearchInput] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerType, setPickerType] = useState('');
  const [pickerDifficulty, setPickerDifficulty] = useState('');
  const [pickerPage, setPickerPage] = useState(1);

  const pickerFilters = useMemo(
    () => ({
      search: pickerSearch || undefined,
      type: (pickerType || undefined) as QuestionType | undefined,
      difficulty: (pickerDifficulty || undefined) as QuestionDifficulty | undefined,
      page: pickerPage,
      pageSize: 10,
    }),
    [pickerSearch, pickerType, pickerDifficulty, pickerPage],
  );

  const pickerQuery = useQuery({
    queryKey: ['questions-picker', tenantId, pickerFilters],
    queryFn: ({ signal }) => questionsApi.list(tenantId!, pickerFilters, signal),
    enabled: Boolean(tenantId),
    placeholderData: (previous) => previous,
  });

  function onPickerSearchSubmit(event: FormEvent) {
    event.preventDefault();
    setPickerPage(1);
    setPickerSearch(pickerSearchInput.trim());
  }

  if (!tenantId) {
    return null;
  }

  if (draftQuery.isLoading) {
    return <div role="status" className="animate-pulse rounded-lg bg-slate-100 p-4 text-sm text-slate-600">جارٍ تجهيز منشئ الاختبار…</div>;
  }

  if (draftQuery.isError || !draft) {
    const error = draftQuery.error;
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error instanceof HttpError && error.status === 404
            ? 'الاختبار غير موجود أو لا توجد مسودة حالية.'
            : error instanceof HttpError && error.status === 403
              ? 'ليس لديك صلاحية عرض هذا الاختبار.'
              : 'تعذر تحميل المسودة. أعد المحاولة.'}
        </p>
        <Button variant="secondary" onClick={() => void draftQuery.refetch()}>إعادة المحاولة</Button>
        <Link to="/dashboard/quizzes" className="text-sm text-sky-700 hover:underline">
          عودة لقائمة الاختبارات
        </Link>
      </div>
    );
  }

  const existingQuestionIds = new Set(draft.items.map((i) => i.questionId));
  const totalPoints = draft.items.reduce((sum, i) => sum + i.points, 0);
  const saveLabel = saveState === 'saving' || saveState === 'pending'
    ? 'جارٍ الحفظ…'
    : saveState === 'error'
      ? 'تعذر الحفظ'
      : 'تم الحفظ ✓';
  const hasPendingContentChanges = saveState === 'pending' || saveState === 'saving' || saveState === 'error' || itemMutation.isPending;
  const headerPublicationState = draft.publicationState === 'PublishedCurrent' && hasPendingContentChanges
    ? 'PublishedWithChanges'
    : draft.publicationState;
  const primaryAction = headerPublicationState === 'PublishedCurrent'
    ? { label: 'إنشاء جلسة', path: `/dashboard/quizzes/${quizId}/sessions`, icon: 'play' as const }
    : headerPublicationState === 'PublishedWithChanges'
      ? { label: 'نشر التحديثات', path: `/dashboard/quizzes/${quizId}/publish`, icon: 'publish' as const }
      : { label: 'نشر الاختبار', path: `/dashboard/quizzes/${quizId}/publish`, icon: 'publish' as const };
  const timeSummary = timeMode === 'None'
    ? 'بدون وقت'
    : timeMode === 'TotalTime'
      ? `${timeLimitSeconds === '' ? '—' : Math.max(1, Math.round(Number(timeLimitSeconds) / 60))} دقيقة`
      : `${timeLimitSeconds === '' ? '—' : timeLimitSeconds} ثانية لكل سؤال`;

  function createQuestionPath(type: QuestionType) {
    const returnTo = `/dashboard/quizzes/${quizId}/edit`;
    const query = new URLSearchParams({ type, quizId: quizId!, returnTo });
    return `/dashboard/questions/new?${query.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="teacher-surface teacher-workspace-header z-30 bg-white p-4 lg:sticky lg:top-4 lg:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <Link to="/dashboard/quizzes" onClick={(event) => void saveBeforeNavigation(event, '/dashboard/quizzes')} className="inline-flex min-h-11 items-center text-sm font-bold text-slate-500 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">الاختبارات →</Link>
            <h1 dir="auto" className="truncate text-2xl font-black text-[var(--teacher-ink)] sm:text-3xl">{title || draft.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-[var(--teacher-muted)]">
              <span className="tabular-nums">{draft.items.length} أسئلة</span>
              <span className="tabular-nums">{totalPoints} نقطة</span>
              <span className="tabular-nums">النجاح {passingPercentage}%</span>
              <span>{timeSummary}</span>
              <span role="status" aria-live="polite" className={saveState === 'error' ? 'text-rose-700' : 'text-emerald-700'}>{saveLabel}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to={`/dashboard/quizzes/${quizId}/preview`} onClick={(event) => void saveBeforeNavigation(event, `/dashboard/quizzes/${quizId}/preview`)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
              <TeacherIcon name="preview" />معاينة
            </Link>
            <Link to={primaryAction.path} onClick={headerPublicationState === 'PublishedCurrent' ? undefined : (event) => void saveBeforeNavigation(event, primaryAction.path)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--teacher-primary)] px-5 text-sm font-black text-white hover:bg-[var(--teacher-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
              <TeacherIcon name={primaryAction.icon} />{primaryAction.label}
            </Link>
          </div>
        </div>
      </header>

      {conflictMessage ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">{conflictMessage}</p>
          <Button
            variant="secondary"
            onClick={() => {
              initializedRef.current = false;
              void draftQuery.refetch();
            }}>
            تحميل أحدث نسخة
          </Button>
        </div>
      ) : null}

      {saveError ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{saveError}</p>
      ) : null}

      <div className="quiz-builder-layout items-start">
        <main className="min-w-0 space-y-6">
          <section aria-labelledby="add-question-heading" className="teacher-surface p-4 sm:p-5">
            <div>
              <h2 id="add-question-heading" className="text-xl font-black text-[var(--teacher-ink)]">إضافة سؤال جديد</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--teacher-muted)]">اختر النوع؛ سيُحفظ السؤال في بنك الأسئلة ويُضاف إلى هذا الاختبار تلقائيًا.</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {questionTypeActions.map((action) => (
                <Link key={action.type} to={createQuestionPath(action.type)} className="group flex min-h-28 flex-col rounded-xl bg-slate-50 p-3 text-start hover:bg-[var(--teacher-primary-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
                  <TeacherIcon name={action.icon} className="h-6 w-6 text-[var(--teacher-primary-strong)]" />
                  <span className="mt-3 text-sm font-black text-slate-900">{action.label}</span>
                  <span className="mt-1 text-xs leading-5 text-slate-600">{action.description}</span>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="items-heading" className="teacher-surface overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
              <div>
                <h2 id="items-heading" className="scroll-mt-24 text-xl font-black text-[var(--teacher-ink)]">أسئلة الاختبار</h2>
                <p className="mt-1 text-sm text-[var(--teacher-muted)]">الترتيب الظاهر هو ترتيب الطالب ما لم تفعل الخلط.</p>
              </div>
              <span className="rounded-full bg-[var(--teacher-primary-soft)] px-3 py-1 text-sm font-black text-[var(--teacher-primary-strong)] tabular-nums">{draft.items.length}</span>
            </div>
            {draft.items.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <TeacherIcon name="questions" className="mx-auto h-10 w-10 text-[var(--teacher-primary)]" />
                <h3 className="mt-4 text-lg font-black text-slate-900">ابدأ بإضافة أول سؤال</h3>
                <p className="mx-auto mt-2 max-w-md text-base leading-7 text-[var(--teacher-muted)]">استخدم أنواع الأسئلة أعلاه، أو افتح بنك الأسئلة لاختيار سؤال موجود.</p>
                <a href="#question-bank-picker" className="mt-4 inline-flex min-h-11 items-center font-bold text-[var(--teacher-primary-strong)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">إضافة من بنك الأسئلة ↓</a>
              </div>
            ) : (
              <ol className="divide-y divide-slate-100">
                {draft.items.map((item, index) => (
                  <li key={item.id} className="px-4 py-3 sm:px-5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black tabular-nums text-slate-700">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p dir="auto" className="text-base font-bold leading-7 text-slate-900">{item.prompt}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-violet-800">
                            {item.questionType === 'Listening' ? <TeacherIcon name="audio" className="h-4 w-4" /> : null}
                            {QUESTION_TYPE_LABELS[item.questionType] ?? item.questionType}
                          </span>
                          <span aria-hidden="true">•</span>
                          <label className="inline-flex min-h-11 items-center gap-1.5">
                            <input type="number" min={1} max={100} value={item.points} onChange={(event) => {
                              const points = Number(event.target.value);
                              if (Number.isInteger(points) && points >= 1 && points <= 100) onUpdateItemPoints(item.id, points);
                            }} className="h-10 w-14 rounded-md border border-slate-300 bg-white px-2 text-center text-sm font-bold tabular-nums text-slate-800" aria-label={`نقاط السؤال ${index + 1}`} />
                            نقاط
                          </label>
                          {item.pinnedVersionNumber < item.latestVersionNumber ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">توجد تعديلات أحدث</span> : null}
                          {item.sourceQuestionArchived ? <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-800">السؤال المصدر مؤرشف</span> : null}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <button type="button" title="نقل لأعلى" onClick={() => onMoveItem(item.id, 'up')} disabled={index === 0 || itemMutation.isPending} aria-label={`نقل السؤال ${index + 1} لأعلى`} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-35"><TeacherIcon name="move-up" /></button>
                          <button type="button" title="نقل لأسفل" onClick={() => onMoveItem(item.id, 'down')} disabled={index === draft.items.length - 1 || itemMutation.isPending} aria-label={`نقل السؤال ${index + 1} لأسفل`} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-35"><TeacherIcon name="move-down" /></button>
                          <Link to={`/dashboard/questions/${item.questionId}/edit`} target="_blank" rel="noreferrer" aria-label={`تعديل السؤال ${index + 1}`} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">تعديل</Link>
                          <button type="button" title="إزالة من الاختبار" onClick={() => onRemoveItem(item.id)} disabled={itemMutation.isPending} aria-label={`إزالة السؤال ${index + 1} من الاختبار`} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-rose-700 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:opacity-35"><TeacherIcon name="remove" /></button>
                          {item.pinnedVersionNumber < item.latestVersionNumber && !item.sourceQuestionArchived ? (
                            <button type="button" onClick={() => onUseLatestVersion(item.id)} disabled={itemMutation.isPending} aria-label={`استخدام أحدث نسخة للسؤال ${index + 1}`} className="min-h-11 rounded-lg bg-amber-50 px-3 text-sm font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-40">استخدام التعديلات الأحدث</button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <details id="question-bank-picker" className="teacher-surface scroll-mt-24 p-4 sm:p-5">
            <summary id="picker-heading" className="flex min-h-11 cursor-pointer list-none items-center justify-between text-lg font-black text-[var(--teacher-ink)] marker:content-none">
              إضافة من بنك الأسئلة
              <span aria-hidden="true" className="text-slate-400">⌄</span>
            </summary>
            <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-5">
              <form onSubmit={onPickerSearchSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="search">
                <div className="sm:col-span-2"><FormField id="picker-search" label="ابحث في أسئلتك">{(props) => <TextInput {...props} value={pickerSearchInput} onChange={(event) => setPickerSearchInput(event.target.value)} placeholder="اكتب كلمات من السؤال…" />}</FormField></div>
                <FormField id="picker-type" label="النوع">{(props) => <SelectInput {...props} value={pickerType} onChange={(event) => { setPickerType(event.target.value); setPickerPage(1); }}><option value="">كل الأنواع</option>{Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput>}</FormField>
                <div className="flex items-end gap-2"><FormField id="picker-difficulty" label="الصعوبة">{(props) => <SelectInput {...props} value={pickerDifficulty} onChange={(event) => { setPickerDifficulty(event.target.value); setPickerPage(1); }}><option value="">الكل</option>{Object.entries(DIFFICULTY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput>}</FormField><Button type="submit" variant="secondary">بحث</Button></div>
              </form>

              {pickerQuery.isLoading ? <p className="text-sm text-slate-600">جارٍ تحميل الأسئلة…</p> : null}
              {pickerQuery.isError ? <div role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800"><p>تعذر تحميل بنك الأسئلة.</p><Button variant="secondary" onClick={() => void pickerQuery.refetch()}>إعادة المحاولة</Button></div> : null}
              {pickerQuery.data && pickerQuery.data.items.length === 0 ? <p className="py-4 text-center text-sm text-slate-600">لا توجد أسئلة مطابقة. جرّب بحثًا آخر أو أنشئ سؤالًا جديدًا أعلاه.</p> : null}
              {pickerQuery.data && pickerQuery.data.items.length > 0 ? (
                <ul className="divide-y divide-slate-100 border-y border-slate-100">
                  {pickerQuery.data.items.map((question) => {
                    const alreadyAdded = existingQuestionIds.has(question.id);
                    return <li key={question.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p dir="auto" className="truncate text-base font-bold text-slate-900">{question.prompt}</p><p className="mt-1 text-sm text-slate-600">{QUESTION_TYPE_LABELS[question.questionType]} · {DIFFICULTY_LABELS[question.difficulty]}</p></div><Button variant="secondary" disabled={alreadyAdded || itemMutation.isPending} onClick={() => onAddItem(question.id)}>{alreadyAdded ? 'مُضاف ✓' : 'إضافة للاختبار'}</Button></li>;
                  })}
                </ul>
              ) : null}
              {pickerQuery.data && pickerQuery.data.totalPages > 1 ? <nav className="flex items-center justify-center gap-2" aria-label="ترقيم الأسئلة"><Button variant="secondary" disabled={pickerPage <= 1} onClick={() => setPickerPage((page) => Math.max(1, page - 1))}>السابق</Button><span className="text-sm text-slate-600">صفحة {pickerQuery.data.page} من {pickerQuery.data.totalPages}</span><Button variant="secondary" disabled={pickerPage >= pickerQuery.data.totalPages} onClick={() => setPickerPage((page) => page + 1)}>التالي</Button></nav> : null}
            </div>
          </details>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-48">
          <section aria-labelledby="settings-heading" className="teacher-surface p-4">
            <h2 id="settings-heading" className="text-lg font-black text-[var(--teacher-ink)]">إعدادات الاختبار</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--teacher-muted)]">التغييرات تُحفظ تلقائيًا.</p>
            <div className="mt-5 flex flex-col gap-4">
              <FormField id="edit-passing" label="درجة النجاح (%)">{(props) => <TextInput {...props} type="number" min={0} max={100} value={passingPercentage} onChange={(event) => { setPassingPercentage(Number(event.target.value)); scheduleAutosave(); }} />}</FormField>
              <FormField id="edit-time-mode" label="مدة الاختبار">{(props) => <SelectInput {...props} value={timeMode} onChange={(event) => { setTimeMode(event.target.value as QuizTimeMode); scheduleAutosave(); }}>{Object.entries(TIME_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput>}</FormField>
              {timeMode !== 'None' ? (
                <FormField id="edit-time-limit" label={timeMode === 'TotalTime' ? 'المدة بالدقائق' : 'وقت كل سؤال بالثواني'}>
                  {(props) => <TextInput {...props} type="number" min={1} value={timeLimitSeconds === '' ? '' : timeMode === 'TotalTime' ? Math.max(1, Math.round(Number(timeLimitSeconds) / 60)) : timeLimitSeconds} onChange={(event) => {
                    const next = event.target.value === '' ? '' : Number(event.target.value);
                    setTimeLimitSeconds(next === '' ? '' : timeMode === 'TotalTime' ? next * 60 : next);
                    scheduleAutosave();
                  }} />}
                </FormField>
              ) : null}
            </div>
          </section>

          <details className="teacher-surface p-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-base font-black text-slate-900 marker:content-none">خيارات إضافية<span aria-hidden="true" className="text-slate-400">⌄</span></summary>
            <div className="mt-4 flex flex-col gap-5 border-t border-slate-100 pt-4">
              <div className="flex flex-col gap-2">
                <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={shuffleQuestions} onChange={(event) => { setShuffleQuestions(event.target.checked); scheduleAutosave(); }} className="h-5 w-5 rounded border-slate-300 accent-emerald-700" />خلط ترتيب الأسئلة</label>
                <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={shuffleOptions} onChange={(event) => { setShuffleOptions(event.target.checked); scheduleAutosave(); }} className="h-5 w-5 rounded border-slate-300 accent-emerald-700" />خلط ترتيب الخيارات</label>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <h3 className="mb-3 text-sm font-black text-slate-900">تفاصيل الاختبار</h3>
                <div className="flex flex-col gap-4">
                  <FormField id="edit-title" label="الاسم">{(props) => <TextInput {...props} value={title} onChange={(event) => { setTitle(event.target.value); scheduleAutosave(); }} required maxLength={200} />}</FormField>
                  <FormField id="edit-description" label="الوصف">{(props) => <TextArea {...props} value={description} onChange={(event) => { setDescription(event.target.value); scheduleAutosave(); }} rows={2} maxLength={2000} />}</FormField>
                  <FormField id="edit-instructions" label="تعليمات للطالب">{(props) => <TextArea {...props} value={instructions} onChange={(event) => { setInstructions(event.target.value); scheduleAutosave(); }} rows={3} maxLength={4000} placeholder="تظهر قبل بدء الاختبار…" />}</FormField>
                </div>
              </div>
              <details>
                <summary id="theme-heading" className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-black text-slate-900 marker:content-none">المظهر<span aria-hidden="true" className="text-slate-400">⌄</span></summary>
                <div className="mt-3 flex flex-col gap-4">
                  <FormField id="edit-theme-template" label="القالب">{(props) => <SelectInput {...props} value={themeTemplate} onChange={(event) => { setThemeTemplate(event.target.value as QuizThemeTemplate); scheduleAutosave(); }}>{QUIZ_THEME_TEMPLATES.map((template) => <option key={template} value={template}>{QUIZ_THEME_TEMPLATE_LABELS[template]}</option>)}</SelectInput>}</FormField>
                  <FormField id="edit-primary-color" label="اللون الأساسي">{(props) => <TextInput {...props} dir="ltr" value={primaryColor} onChange={(event) => { setPrimaryColor(event.target.value); scheduleAutosave(); }} placeholder="#0284c7" />}</FormField>
                  <FormField id="edit-secondary-color" label="اللون الثانوي">{(props) => <TextInput {...props} dir="ltr" value={secondaryColor} onChange={(event) => { setSecondaryColor(event.target.value); scheduleAutosave(); }} placeholder="#0f172a" />}</FormField>
                  <FormField id="edit-background-color" label="لون الخلفية">{(props) => <TextInput {...props} dir="ltr" value={backgroundColor} onChange={(event) => { setBackgroundColor(event.target.value); scheduleAutosave(); }} placeholder="#ffffff" />}</FormField>
                  {colorError ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{colorError}</p> : null}
                </div>
              </details>
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
