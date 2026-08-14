import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { FormField, SelectInput, TextArea, TextInput } from '../../../components/ui/form-field';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { surveysApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import type {
  SurveyDetail,
  SurveyQuestionInput,
  SurveyQuestionType,
} from '../../../types/surveys';

type EditableQuestion = SurveyQuestionInput & { clientId: string };

const QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  Rating: 'تقييم من 1 إلى 5',
  SingleChoice: 'اختيار واحد',
  ShortText: 'إجابة قصيرة',
};

function newClientId() {
  return `question-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function newQuestion(questionType: SurveyQuestionType = 'Rating'): EditableQuestion {
  return {
    clientId: newClientId(),
    questionType,
    prompt: '',
    isRequired: true,
    options: questionType === 'SingleChoice' ? [{ optionText: '' }, { optionText: '' }] : [],
  };
}

function toEditableQuestions(detail: SurveyDetail): EditableQuestion[] {
  return detail.questions.map((question) => ({
    clientId: question.id,
    questionType: question.questionType,
    prompt: question.prompt,
    isRequired: question.isRequired,
    options: question.options.map((option) => ({ optionText: option.optionText })),
  }));
}

function getErrorMessage(error: unknown) {
  if (error instanceof HttpError) {
    if (error.status === 409) {
      return 'تغيّرت المسودة في نافذة أخرى أو سبق نشرها. أعد تحميل الصفحة ثم حاول مجددًا.';
    }
    const body = error.body as { detail?: string } | null;
    return body?.detail ?? 'تعذر حفظ الاستبيان. راجع البيانات وحاول مجددًا.';
  }
  return 'تعذر الاتصال بالخادم. حاول مجددًا.';
}

function validate(title: string, questions: EditableQuestion[]) {
  if (!title.trim()) return 'اكتب عنوانًا للاستبيان.';
  if (questions.length === 0) return 'أضف سؤالًا واحدًا على الأقل.';
  if (questions.length > 50) return 'الحد الأقصى 50 سؤالًا.';

  for (const [index, question] of questions.entries()) {
    if (!question.prompt.trim()) return `اكتب نص السؤال رقم ${index + 1}.`;
    if (question.questionType === 'SingleChoice') {
      const options = question.options.map((option) => option.optionText.trim());
      if (options.length < 2 || options.some((option) => !option)) {
        return `أضف خيارين مكتملين على الأقل للسؤال رقم ${index + 1}.`;
      }
      if (new Set(options).size !== options.length) {
        return `خيارات السؤال رقم ${index + 1} يجب ألا تتكرر.`;
      }
    }
  }

  return null;
}

export default function SurveyBuilderPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const tenantId = getActiveTenantId();
  const queryClient = useQueryClient();
  const queryKey = ['quiz-survey', tenantId, quizId] as const;

  const [title, setTitle] = useState('استبيان ما بعد الاختبار');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<EditableQuestion[]>([newQuestion()]);
  const [loadedSurveyId, setLoadedSurveyId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const surveyQuery = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const surveys = await surveysApi.list(tenantId!, quizId!, signal);
      const survey = surveys[0];
      return survey ? surveysApi.get(tenantId!, survey.id, signal) : null;
    },
    enabled: Boolean(tenantId && quizId),
    staleTime: 0,
  });

  useEffect(() => {
    const survey = surveyQuery.data;
    if (!survey || survey.id === loadedSurveyId) return;
    setTitle(survey.title);
    setDescription(survey.description ?? '');
    setQuestions(toEditableQuestions(survey));
    setLoadedSurveyId(survey.id);
    setDirty(false);
  }, [loadedSurveyId, surveyQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const error = validate(title, questions);
      if (error) throw new Error(error);

      const normalizedQuestions = questions.map((question) => ({
        questionType: question.questionType,
        prompt: question.prompt.trim(),
        isRequired: question.isRequired,
        options: question.options.map((option) => ({ optionText: option.optionText.trim() })),
      }));
      const current = surveyQuery.data;
      return current
        ? surveysApi.update(tenantId!, current.id, {
            title: title.trim(),
            description: description.trim() || null,
            questions: normalizedQuestions,
            baseVersion: current.version,
          })
        : surveysApi.create(tenantId!, {
            quizId: quizId!,
            title: title.trim(),
            description: description.trim() || null,
            questions: normalizedQuestions,
          });
    },
    onMutate: () => setValidationError(null),
    onSuccess: (survey) => {
      queryClient.setQueryData(queryKey, survey);
      setLoadedSurveyId(survey.id);
      setDirty(false);
    },
    onError: (error) => {
      setValidationError(error instanceof Error && !(error instanceof HttpError)
        ? error.message
        : getErrorMessage(error));
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => surveysApi.publish(
      tenantId!,
      surveyQuery.data!.id,
      surveyQuery.data!.version,
    ),
    onSuccess: (survey) => {
      queryClient.setQueryData(queryKey, survey);
      setLoadedSurveyId(survey.id);
      setDirty(false);
      setValidationError(null);
    },
    onError: (error) => setValidationError(getErrorMessage(error)),
  });

  const survey = surveyQuery.data;
  const published = survey?.status === 'Published';
  const resultsQuery = useQuery({
    queryKey: ['survey-results', tenantId, survey?.id],
    queryFn: ({ signal }) => surveysApi.getResults(tenantId!, survey!.id, signal),
    enabled: Boolean(tenantId && published && survey),
  });

  if (!tenantId) {
    return null;
  }

  if (!quizId) return null;

  if (surveyQuery.isLoading) {
    return <p className="text-sm text-slate-500">جارٍ تحميل الاستبيان…</p>;
  }

  if (surveyQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          تعذر تحميل الاستبيان.
        </p>
        <Button variant="secondary" onClick={() => void surveyQuery.refetch()}>إعادة المحاولة</Button>
      </div>
    );
  }

  function changeQuestion(index: number, next: EditableQuestion) {
    setQuestions((current) => current.map((question, i) => i === index ? next : question));
    setDirty(true);
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setQuestions((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
    setDirty(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-sm font-medium text-sky-700">استبيان ما بعد الاختبار</p>
          <h1 className="text-2xl font-bold text-slate-950">
            {survey?.quizTitle ?? 'إنشاء استبيان'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            اجمع رأي الطلاب بعد ظهور النتيجة. يمكن لكل محاولة إرسال رد واحد فقط.
          </p>
        </div>
        <Link
          to={`/dashboard/quizzes/${quizId}/publish`}
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-sky-600">
          العودة للاختبار
        </Link>
      </header>

      {published ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div>
            <p className="font-semibold text-emerald-900">الاستبيان منشور ويظهر للطلاب بعد النتيجة</p>
            <p className="mt-1 text-sm text-emerald-800">
              حفاظًا على اتساق الردود، لا يمكن تعديل الأسئلة بعد النشر.
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
            {survey.responseCount} رد
          </span>
        </div>
      ) : null}

      {published ? (
        <SurveyResultsSection
          isPending={resultsQuery.isPending}
          isError={resultsQuery.isError}
          results={resultsQuery.data}
          onRetry={() => void resultsQuery.refetch()}
        />
      ) : null}

      {validationError ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {validationError}
        </p>
      ) : null}

      <section aria-labelledby="survey-details" className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 id="survey-details" className="mb-4 text-lg font-semibold text-slate-900">بيانات الاستبيان</h2>
        <div className="grid gap-4">
          <FormField id="survey-title" label="العنوان">
            {(props) => (
              <TextInput
                {...props}
                value={title}
                maxLength={200}
                disabled={published}
                onChange={(event) => { setTitle(event.target.value); setDirty(true); }}
              />
            )}
          </FormField>
          <FormField id="survey-description" label="وصف اختياري">
            {(props) => (
              <TextArea
                {...props}
                value={description}
                rows={3}
                maxLength={2000}
                disabled={published}
                onChange={(event) => { setDescription(event.target.value); setDirty(true); }}
              />
            )}
          </FormField>
        </div>
      </section>

      <section aria-labelledby="survey-questions" className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="survey-questions" className="text-lg font-semibold text-slate-900">الأسئلة</h2>
            <p className="text-sm text-slate-500">{questions.length} من 50 سؤالًا</p>
          </div>
          {!published ? (
            <Button
              variant="secondary"
              disabled={questions.length >= 50}
              onClick={() => { setQuestions((current) => [...current, newQuestion()]); setDirty(true); }}>
              إضافة سؤال
            </Button>
          ) : null}
        </div>

        <ol className="divide-y divide-slate-200">
          {questions.map((question, index) => (
            <li key={question.clientId} className="py-6 first:pt-0 last:pb-0">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-800">السؤال {index + 1}</p>
                {!published ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label={`نقل السؤال ${index + 1} للأعلى`}
                      disabled={index === 0}
                      onClick={() => moveQuestion(index, -1)}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`نقل السؤال ${index + 1} للأسفل`}
                      disabled={index === questions.length - 1}
                      onClick={() => moveQuestion(index, 1)}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                      ↓
                    </button>
                    <button
                      type="button"
                      aria-label={`حذف السؤال ${index + 1}`}
                      disabled={questions.length === 1}
                      onClick={() => { setQuestions((current) => current.filter((_, i) => i !== index)); setDirty(true); }}
                      className="min-h-11 rounded-lg px-3 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40">
                      حذف
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_15rem]">
                <FormField id={`survey-question-${index}`} label="نص السؤال">
                  {(props) => (
                    <TextInput
                      {...props}
                      value={question.prompt}
                      maxLength={500}
                      disabled={published}
                      onChange={(event) => changeQuestion(index, { ...question, prompt: event.target.value })}
                    />
                  )}
                </FormField>
                <FormField id={`survey-question-type-${index}`} label="نوع الإجابة">
                  {(props) => (
                    <SelectInput
                      {...props}
                      value={question.questionType}
                      disabled={published}
                      onChange={(event) => {
                        const questionType = event.target.value as SurveyQuestionType;
                        changeQuestion(index, {
                          ...question,
                          questionType,
                          options: questionType === 'SingleChoice'
                            ? question.options.length >= 2 ? question.options : [{ optionText: '' }, { optionText: '' }]
                            : [],
                        });
                      }}>
                      {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </SelectInput>
                  )}
                </FormField>
              </div>

              <label className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={question.isRequired}
                  disabled={published}
                  onChange={(event) => changeQuestion(index, { ...question, isRequired: event.target.checked })}
                  className="h-4 w-4 accent-sky-600"
                />
                إجابة مطلوبة
              </label>

              {question.questionType === 'SingleChoice' ? (
                <fieldset className="mt-4 rounded-lg bg-slate-50 p-4">
                  <legend className="px-1 text-sm font-semibold text-slate-700">الخيارات</legend>
                  <div className="grid gap-3">
                    {question.options.map((option, optionIndex) => (
                      <div key={`${question.clientId}-option-${optionIndex}`} className="flex items-center gap-2">
                        <TextInput
                          aria-label={`خيار ${optionIndex + 1} للسؤال ${index + 1}`}
                          value={option.optionText}
                          maxLength={200}
                          disabled={published}
                          onChange={(event) => changeQuestion(index, {
                            ...question,
                            options: question.options.map((current, i) => i === optionIndex
                              ? { optionText: event.target.value }
                              : current),
                          })}
                        />
                        {!published ? (
                          <button
                            type="button"
                            aria-label={`حذف الخيار ${optionIndex + 1}`}
                            disabled={question.options.length <= 2}
                            onClick={() => changeQuestion(index, {
                              ...question,
                              options: question.options.filter((_, i) => i !== optionIndex),
                            })}
                            className="min-h-11 rounded-lg px-3 text-sm text-rose-700 hover:bg-rose-100 disabled:opacity-40">
                            حذف
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {!published && question.options.length < 20 ? (
                    <button
                      type="button"
                      onClick={() => changeQuestion(index, {
                        ...question,
                        options: [...question.options, { optionText: '' }],
                      })}
                      className="mt-3 min-h-11 rounded-lg px-3 text-sm font-medium text-sky-700 hover:bg-sky-50">
                      إضافة خيار
                    </button>
                  ) : null}
                </fieldset>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {!published ? (
        <footer className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          <p className="text-sm text-slate-600">
            {survey ? (dirty ? 'لديك تعديلات غير محفوظة.' : 'المسودة محفوظة.') : 'احفظ المسودة قبل النشر.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={saveMutation.isPending || (!dirty && Boolean(survey))}
              onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? <ButtonSpinner /> : null}
              {saveMutation.isPending ? 'جارٍ الحفظ…' : 'حفظ المسودة'}
            </Button>
            <Button
              disabled={!survey || dirty || publishMutation.isPending}
              onClick={() => publishMutation.mutate()}>
              {publishMutation.isPending ? <ButtonSpinner /> : null}
              {publishMutation.isPending ? 'جارٍ النشر…' : 'نشر الاستبيان'}
            </Button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}

function SurveyResultsSection({
  isPending,
  isError,
  results,
  onRetry,
}: {
  isPending: boolean;
  isError: boolean;
  results: import('../../../types/surveys').SurveyResults | undefined;
  onRetry: () => void;
}) {
  return (
    <section aria-labelledby="survey-results" className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 id="survey-results" className="text-lg font-semibold text-slate-900">نتائج الاستبيان</h2>
      {isPending ? <p role="status" className="mt-3 animate-pulse rounded-lg bg-slate-100 p-4 text-sm text-slate-600">جارٍ تجميع الردود…</p> : null}
      {isError ? (
        <div role="alert" className="mt-3 rounded-lg bg-rose-50 p-4 text-sm text-rose-800">
          <p>تعذر تحميل نتائج الاستبيان.</p>
          <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-md border border-rose-300 bg-white px-4 py-2 font-semibold">إعادة المحاولة</button>
        </div>
      ) : null}
      {results?.responseCount === 0 ? <p className="mt-3 text-sm text-slate-600">لم تصل ردود بعد. ستظهر الملخصات هنا تلقائيًا.</p> : null}
      {results && results.responseCount > 0 ? (
        <ol className="mt-4 divide-y divide-slate-200">
          {results.questions.map((question) => (
            <li key={question.id} className="py-5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{question.sortOrder + 1}. {question.prompt}</h3>
                <span className="text-xs text-slate-500">{question.answerCount} إجابة</span>
              </div>
              {question.questionType === 'Rating' ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-slate-700">المتوسط: <strong>{question.ratingAverage?.toFixed(2) ?? '—'} من 5</strong></p>
                  {question.ratingDistribution.map((entry) => <ResultBar key={entry.value} label={`${entry.value} نجوم`} count={entry.count} percentage={entry.percentage} />)}
                </div>
              ) : null}
              {question.questionType === 'SingleChoice' ? (
                <div className="mt-3 space-y-2">{question.optionResults.map((option) => <ResultBar key={option.optionId} label={option.optionText} count={option.count} percentage={option.percentage} />)}</div>
              ) : null}
              {question.questionType === 'ShortText' ? (
                question.textResponses.length > 0
                  ? <ul className="mt-3 space-y-2">{question.textResponses.map((response, index) => <li key={`${question.id}-${index}`} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{response}</li>)}</ul>
                  : <p className="mt-3 text-sm text-slate-500">لا توجد إجابات نصية.</p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function ResultBar({ label, count, percentage }: { label: string; count: number; percentage: number }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,1fr)_minmax(8rem,2fr)_auto] items-center gap-2 text-sm">
      <span className="truncate text-slate-700">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><span className="block h-full rounded-full bg-sky-600" style={{ width: `${percentage}%` }} /></span>
      <span dir="ltr" className="tabular-nums text-slate-600">{count} ({Math.round(percentage)}%)</span>
    </div>
  );
}
