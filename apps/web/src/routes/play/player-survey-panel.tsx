import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { TextArea } from '../../components/ui/form-field';
import { ButtonSpinner } from '../../components/ui/spinner';
import { playerApi } from '../../data/api-client/endpoints';
import { HttpError } from '../../data/api-client/http-error';
import type { PlayerSurvey, SubmitSurveyRequest } from '../../types/surveys';

type AnswerValue = number | string;

export function PlayerSurveyPanel({ joinCode, attemptId }: { joinCode: string; attemptId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ['player-survey', joinCode, attemptId] as const;
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [error, setError] = useState<string | null>(null);

  const surveyQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => playerApi.getSurvey(joinCode, attemptId, signal),
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: (payload: SubmitSurveyRequest) => playerApi.submitSurvey(joinCode, attemptId, payload),
    onSuccess: () => {
      queryClient.setQueryData<PlayerSurvey>(queryKey, (current) => current
        ? { ...current, submitted: true }
        : current);
      setError(null);
    },
    onError: (submissionError) => {
      if (submissionError instanceof HttpError && submissionError.status === 409) {
        queryClient.setQueryData<PlayerSurvey>(queryKey, (current) => current
          ? { ...current, submitted: true }
          : current);
        setError(null);
        return;
      }
      setError('تعذر إرسال الاستبيان. راجع إجاباتك وحاول مجددًا.');
    },
  });

  if (surveyQuery.isLoading) {
    return <p className="py-4 text-center text-sm text-slate-500">جارٍ تحميل الاستبيان…</p>;
  }

  if (surveyQuery.isError) {
    if (surveyQuery.error instanceof HttpError && surveyQuery.error.status === 404) return null;
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 text-center">
        <p role="alert" className="mb-3 text-sm text-rose-700">تعذر تحميل استبيان ما بعد الاختبار.</p>
        <Button variant="secondary" onClick={() => void surveyQuery.refetch()}>إعادة المحاولة</Button>
      </section>
    );
  }

  const survey = surveyQuery.data;
  if (!survey) return null;
  const availableSurvey = survey;

  if (survey.submitted) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-bold text-emerald-900">شكرًا لمشاركتك</p>
        <p className="mt-1 text-sm text-emerald-800">تم استلام ردك على الاستبيان.</p>
      </section>
    );
  }

  function submit() {
    const missingQuestion = availableSurvey.questions.find((question) => {
      if (!question.isRequired) return false;
      const value = answers[question.questionId];
      return value == null || (typeof value === 'string' && !value.trim());
    });
    if (missingQuestion) {
      setError(`أجب عن السؤال المطلوب: ${missingQuestion.prompt}`);
      return;
    }

    const payload: SubmitSurveyRequest = {
      answers: availableSurvey.questions.flatMap((question) => {
        const value = answers[question.questionId];
        if (value == null || (typeof value === 'string' && !value.trim())) return [];
        return [{
          questionId: question.questionId,
          ratingValue: question.questionType === 'Rating' ? Number(value) : null,
          optionId: question.questionType === 'SingleChoice' ? String(value) : null,
          text: question.questionType === 'ShortText' ? String(value).trim() : null,
        }];
      }),
    };

    setError(null);
    submitMutation.mutate(payload);
  }

  return (
    <section aria-labelledby="player-survey-title" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="mb-6 text-center">
        <p className="mb-1 text-sm font-semibold text-sky-700">رأيك يهمنا</p>
        <h2 id="player-survey-title" className="text-xl font-bold text-slate-900">{survey.title}</h2>
        {survey.description ? <p className="mt-2 text-sm text-slate-600">{survey.description}</p> : null}
      </div>

      <div className="divide-y divide-slate-200">
        {survey.questions.map((question, index) => (
          <fieldset key={question.questionId} className="py-5 first:pt-0">
            <legend className="mb-3 block w-full text-sm font-semibold text-slate-800">
              <span className="text-slate-400">{index + 1}.</span> {question.prompt}
              {question.isRequired ? <span className="mr-1 text-rose-600" aria-label="مطلوب">*</span> : null}
            </legend>

            {question.questionType === 'Rating' ? (
              <div className="grid grid-cols-5 gap-2" dir="ltr">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <label key={rating} className="cursor-pointer">
                    <input
                      type="radio"
                      name={`survey-${question.questionId}`}
                      value={rating}
                      checked={answers[question.questionId] === rating}
                      onChange={() => setAnswers((current) => ({ ...current, [question.questionId]: rating }))}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-700 peer-checked:border-sky-600 peer-checked:bg-sky-50 peer-checked:text-sky-800 peer-focus-visible:outline-2 peer-focus-visible:outline-sky-600">
                      {rating}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}

            {question.questionType === 'SingleChoice' ? (
              <div className="grid gap-2">
                {question.options.map((option) => (
                  <label
                    key={option.optionId}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 has-[:checked]:border-sky-600 has-[:checked]:bg-sky-50">
                    <input
                      type="radio"
                      name={`survey-${question.questionId}`}
                      value={option.optionId}
                      checked={answers[question.questionId] === option.optionId}
                      onChange={() => setAnswers((current) => ({
                        ...current,
                        [question.questionId]: option.optionId,
                      }))}
                      className="h-4 w-4 accent-sky-600"
                    />
                    {option.optionText}
                  </label>
                ))}
              </div>
            ) : null}

            {question.questionType === 'ShortText' ? (
              <TextArea
                aria-label={question.prompt}
                value={String(answers[question.questionId] ?? '')}
                rows={3}
                maxLength={1000}
                placeholder="اكتب إجابتك هنا"
                onChange={(event) => setAnswers((current) => ({
                  ...current,
                  [question.questionId]: event.target.value,
                }))}
              />
            ) : null}
          </fieldset>
        ))}
      </div>

      {error ? <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      <Button disabled={submitMutation.isPending} onClick={submit}>
        {submitMutation.isPending ? <ButtonSpinner /> : null}
        {submitMutation.isPending ? 'جارٍ الإرسال…' : 'إرسال الاستبيان'}
      </Button>
    </section>
  );
}
