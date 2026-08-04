import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { FormField, SelectInput, TextArea, TextInput } from '../../../components/ui/form-field';
import { ButtonSpinner } from '../../../components/ui/spinner';
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

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** /dashboard/quizzes/:quizId/edit — بناء الاختبار (أساسيات + أسئلة + إعدادات + سمة) */
export default function QuizEditPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();

  // ---- Draft query ----
  const draftQuery = useQuery({
    queryKey: ['quiz-draft', tenantId, quizId],
    queryFn: ({ signal }) => quizzesApi.getDraft(tenantId!, quizId!, signal),
    enabled: Boolean(tenantId && quizId),
    staleTime: 0,
  });
  const draft = draftQuery.data;

  // ---- Local form state (synced from draft) ----
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

  // ---- Save (updateDraft) mutation ----
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
        setConflictMessage('تعارض تعديل متزامن (409): قام مستخدم آخر بتعديل هذه المسودة.');
        setSaveError(null);
      } else if (error instanceof HttpError && error.status === 403) {
        setSaveError('ليس لديك صلاحية تعديل الاختبارات (يلزم دور مالك أو معلم).');
      } else if (error instanceof HttpError) {
        const body = error.body as { title?: string; detail?: string } | null;
        setSaveError(
          body?.detail
            ? `تحقق من الإدخال: ${body.detail} (Code: ${body.title ?? error.status})`
            : `فشل الحفظ. الحالة: ${error.status}`,
        );
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

  function scheduleAutosave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(saveNow, AUTOSAVE_DEBOUNCE_MS);
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // ---- Item mutations ----
  const itemMutation = useMutation({
    mutationFn: (fn: () => Promise<QuizDraft>) => fn(),
    onSuccess: (updated) => {
      versionRef.current = updated.version;
      queryClient.setQueryData(['quiz-draft', tenantId, quizId], updated);
      setConflictMessage(null);
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        setConflictMessage('تعارض تعديل متزامن (409): أعد تحميل أحدث نسخة.');
      } else if (error instanceof HttpError) {
        const body = error.body as { title?: string; detail?: string } | null;
        setSaveError(
          body?.detail
            ? `فشل تحديث الأسئلة: ${body.detail} (Code: ${body.title ?? error.status})`
            : `فشل تحديث الأسئلة. الحالة: ${error.status}`,
        );
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

  // ---- Question picker state ----
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
    navigate('/onboarding/choose', { replace: true });
    return null;
  }

  if (draftQuery.isLoading) {
    return <p className="text-sm text-slate-500">جارٍ تحميل المسودة…</p>;
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
        <Link to="/dashboard/quizzes" className="text-sm text-sky-700 hover:underline">
          عودة لقائمة الاختبارات
        </Link>
      </div>
    );
  }

  const existingQuestionIds = new Set(draft.items.map((i) => i.questionId));
  const totalPoints = draft.items.reduce((sum, i) => sum + i.points, 0);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">بناء الاختبار</h1>
          <p className="text-sm text-slate-600">
            مسودة v{draft.versionNumber} · {draft.items.length} سؤال · {totalPoints} نقطة
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500" role="status" aria-live="polite">
            {saveState === 'saving' ? 'جارٍ الحفظ…' : null}
            {saveState === 'saved' ? 'تم الحفظ ✓' : null}
            {saveState === 'error' ? 'فشل الحفظ' : null}
          </span>
          <Link
            to={`/dashboard/quizzes/${quizId}/preview`}
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600">
            معاينة
          </Link>
          <Link
            to={`/dashboard/quizzes/${quizId}/publish`}
            className="min-h-11 rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-sky-600">
            نشر
          </Link>
          <Link
            to="/dashboard/quizzes"
            className="min-h-11 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-sky-600">
            عودة
          </Link>
        </div>
      </div>

      {/* Conflict banner */}
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

      {/* Section 1: Basics */}
      <section aria-labelledby="basics-heading" className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="basics-heading" className="text-base font-semibold text-slate-900">الأساسيات</h2>
        <FormField id="edit-title" label="العنوان">
          {(props) => (
            <TextInput {...props} value={title} onChange={(e) => { setTitle(e.target.value); scheduleAutosave(); }} required maxLength={200} />
          )}
        </FormField>
        <FormField id="edit-description" label="الوصف">
          {(props) => (
            <TextArea {...props} value={description} onChange={(e) => { setDescription(e.target.value); scheduleAutosave(); }} rows={2} maxLength={2000} />
          )}
        </FormField>
        <FormField id="edit-instructions" label="تعليمات للطالب">
          {(props) => (
            <TextArea {...props} value={instructions} onChange={(e) => { setInstructions(e.target.value); scheduleAutosave(); }} rows={3} maxLength={4000} placeholder="تظهر للطالب قبل بدء الاختبار…" />
          )}
        </FormField>
      </section>

      {/* Section 2: Current items */}
      <section aria-labelledby="items-heading" className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="items-heading" className="text-base font-semibold text-slate-900">
          أسئلة الاختبار ({draft.items.length})
        </h2>
        {draft.items.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد أسئلة بعد. أضف أسئلة من بنك الأسئلة أدناه.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {draft.items.map((item, index) => (
              <li key={item.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {index + 1}. {item.prompt}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {QUESTION_TYPE_LABELS[item.questionType] ?? item.questionType}
                      {' · '}
                      {DIFFICULTY_LABELS[item.difficulty] ?? item.difficulty}
                      {' · '}
                      v{item.pinnedVersionNumber}
                      {item.pinnedVersionNumber < item.latestVersionNumber ? (
                        <span className="ms-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                          توجد نسخة أحدث (v{item.latestVersionNumber})
                        </span>
                      ) : null}
                      {item.sourceQuestionArchived ? (
                        <span className="ms-1 rounded-full bg-rose-100 px-2 py-0.5 text-rose-800">
                          السؤال المصدر مؤرشف
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <label className="flex items-center gap-1 text-xs text-slate-600">
                      نقاط:
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={item.points}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (Number.isInteger(value) && value >= 1 && value <= 100) {
                            onUpdateItemPoints(item.id, value);
                          }
                        }}
                        className="h-9 w-16 rounded-md border border-slate-300 px-2 text-sm"
                        aria-label={`نقاط السؤال ${index + 1}`}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => onMoveItem(item.id, 'up')}
                      disabled={index === 0 || itemMutation.isPending}
                      aria-label={`نقل السؤال ${index + 1} لأعلى`}
                      className="min-h-11 rounded-md border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveItem(item.id, 'down')}
                      disabled={index === draft.items.length - 1 || itemMutation.isPending}
                      aria-label={`نقل السؤال ${index + 1} لأسفل`}
                      className="min-h-11 rounded-md border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      disabled={itemMutation.isPending}
                      aria-label={`إزالة السؤال ${index + 1}`}
                      className="min-h-11 rounded-md border border-rose-300 px-2 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40">
                      إزالة
                    </button>
                    {item.pinnedVersionNumber < item.latestVersionNumber && !item.sourceQuestionArchived ? (
                      <button
                        type="button"
                        onClick={() => onUseLatestVersion(item.id)}
                        disabled={itemMutation.isPending}
                        aria-label={`استخدام أحدث نسخة للسؤال ${index + 1}`}
                        className="min-h-11 rounded-md border border-amber-300 bg-amber-50 px-2 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-40">
                        استخدام أحدث نسخة
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Section 3: Question picker */}
      <section aria-labelledby="picker-heading" className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="picker-heading" className="text-base font-semibold text-slate-900">إضافة من بنك الأسئلة</h2>
        <form onSubmit={onPickerSearchSubmit} className="flex flex-wrap items-end gap-2" role="search">
          <FormField id="picker-search" label="بحث">
            {(props) => (
              <TextInput {...props} value={pickerSearchInput} onChange={(e) => setPickerSearchInput(e.target.value)} placeholder="ابحث في الأسئلة…" />
            )}
          </FormField>
          <FormField id="picker-type" label="النوع">
            {(props) => (
              <SelectInput {...props} value={pickerType} onChange={(e) => { setPickerType(e.target.value); setPickerPage(1); }}>
                <option value="">كل الأنواع</option>
                {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </SelectInput>
            )}
          </FormField>
          <FormField id="picker-difficulty" label="الصعوبة">
            {(props) => (
              <SelectInput {...props} value={pickerDifficulty} onChange={(e) => { setPickerDifficulty(e.target.value); setPickerPage(1); }}>
                <option value="">كل المستويات</option>
                {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </SelectInput>
            )}
          </FormField>
          <Button type="submit" variant="secondary">بحث</Button>
        </form>

        {pickerQuery.isLoading ? <p className="text-sm text-slate-500">جارٍ تحميل الأسئلة…</p> : null}
        {pickerQuery.isError ? (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">تعذر تحميل الأسئلة.</p>
        ) : null}

        {pickerQuery.data && pickerQuery.data.items.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد أسئلة مطابقة.</p>
        ) : null}

        {pickerQuery.data && pickerQuery.data.items.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {pickerQuery.data.items.map((question) => {
              const alreadyAdded = existingQuestionIds.has(question.id);
              return (
                <li key={question.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-900">{question.prompt}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {QUESTION_TYPE_LABELS[question.questionType] ?? question.questionType}
                      {' · '}
                      {DIFFICULTY_LABELS[question.difficulty] ?? question.difficulty}
                      {' · '}
                      v{question.currentVersionNumber}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={alreadyAdded || itemMutation.isPending}
                    onClick={() => onAddItem(question.id)}>
                    {alreadyAdded ? 'مُضاف ✓' : 'إضافة'}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {pickerQuery.data && pickerQuery.data.totalPages > 1 ? (
          <nav className="flex items-center justify-center gap-2" aria-label="ترقيم الأسئلة">
            <Button variant="secondary" disabled={pickerPage <= 1} onClick={() => setPickerPage((p) => Math.max(1, p - 1))}>
              السابق
            </Button>
            <span className="text-sm text-slate-600">
              صفحة {pickerQuery.data.page} من {pickerQuery.data.totalPages}
            </span>
            <Button variant="secondary" disabled={pickerPage >= pickerQuery.data.totalPages} onClick={() => setPickerPage((p) => p + 1)}>
              التالي
            </Button>
          </nav>
        ) : null}
      </section>

      {/* Section 4: Settings */}
      <section aria-labelledby="settings-heading" className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="settings-heading" className="text-base font-semibold text-slate-900">الإعدادات</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="edit-passing" label="نسبة النجاح (%)">
            {(props) => (
              <TextInput
                {...props}
                type="number"
                min={0}
                max={100}
                value={passingPercentage}
                onChange={(e) => { setPassingPercentage(Number(e.target.value)); scheduleAutosave(); }}
              />
            )}
          </FormField>
          <FormField id="edit-time-mode" label="وضع الوقت">
            {(props) => (
              <SelectInput
                {...props}
                value={timeMode}
                onChange={(e) => { setTimeMode(e.target.value as QuizTimeMode); scheduleAutosave(); }}>
                {Object.entries(TIME_MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </SelectInput>
            )}
          </FormField>
          {timeMode !== 'None' ? (
            <FormField id="edit-time-limit" label={timeMode === 'TotalTime' ? 'الوقت الإجمالي (ثانية)' : 'الوقت لكل سؤال (ثانية)'}>
              {(props) => (
                <TextInput
                  {...props}
                  type="number"
                  min={1}
                  value={timeLimitSeconds}
                  onChange={(e) => { setTimeLimitSeconds(e.target.value === '' ? '' : Number(e.target.value)); scheduleAutosave(); }}
                />
              )}
            </FormField>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={shuffleQuestions}
              onChange={(e) => { setShuffleQuestions(e.target.checked); scheduleAutosave(); }}
              className="h-4 w-4 rounded border-slate-300"
            />
            خلط ترتيب الأسئلة
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={shuffleOptions}
              onChange={(e) => { setShuffleOptions(e.target.checked); scheduleAutosave(); }}
              className="h-4 w-4 rounded border-slate-300"
            />
            خلط ترتيب الخيارات
          </label>
        </div>
      </section>

      {/* Section 5: Theme */}
      <section aria-labelledby="theme-heading" className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="theme-heading" className="text-base font-semibold text-slate-900">المظهر</h2>
        <FormField id="edit-theme-template" label="القالب">
          {(props) => (
            <SelectInput
              {...props}
              value={themeTemplate}
              onChange={(e) => { setThemeTemplate(e.target.value as QuizThemeTemplate); scheduleAutosave(); }}>
              {QUIZ_THEME_TEMPLATES.map((template) => (
                <option key={template} value={template}>{QUIZ_THEME_TEMPLATE_LABELS[template]}</option>
              ))}
            </SelectInput>
          )}
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField id="edit-primary-color" label="اللون الأساسي">
            {(props) => (
              <TextInput {...props} dir="ltr" value={primaryColor} onChange={(e) => { setPrimaryColor(e.target.value); scheduleAutosave(); }} placeholder="#0284c7" />
            )}
          </FormField>
          <FormField id="edit-secondary-color" label="اللون الثانوي">
            {(props) => (
              <TextInput {...props} dir="ltr" value={secondaryColor} onChange={(e) => { setSecondaryColor(e.target.value); scheduleAutosave(); }} placeholder="#0f172a" />
            )}
          </FormField>
          <FormField id="edit-background-color" label="لون الخلفية">
            {(props) => (
              <TextInput {...props} dir="ltr" value={backgroundColor} onChange={(e) => { setBackgroundColor(e.target.value); scheduleAutosave(); }} placeholder="#ffffff" />
            )}
          </FormField>
        </div>
        {colorError ? (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{colorError}</p>
        ) : null}
        <div className="flex justify-end">
          <Button onClick={saveNow} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <ButtonSpinner /> : null}
            حفظ الآن
          </Button>
        </div>
      </section>
    </div>
  );
}
