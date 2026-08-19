import type { SurveyResults } from '../../types/surveys';

export function SurveyResultsSummary({
  results,
  isPending,
  isError,
  onRetry,
  description = 'ملخص مجمّع من الردود التي أرسلها الطلاب.',
}: {
  results: SurveyResults | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  description?: string;
}) {
  return (
    <section aria-labelledby="survey-results-heading" className="teacher-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="survey-results-heading" className="text-lg font-black text-[var(--teacher-ink)]">آراء الطلاب</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--teacher-muted)]">{description}</p>
        </div>
        {results ? (
          <span className="rounded-full bg-[var(--teacher-primary-soft)] px-3 py-1.5 text-sm font-black text-[var(--teacher-primary-strong)]">
            {results.responseCount} استجابة
          </span>
        ) : null}
      </div>

      {isPending ? <SurveyResultsLoading /> : null}
      {isError ? (
        <div role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          <p>تعذر تحميل آراء الطلاب الآن.</p>
          <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-lg border border-rose-300 bg-white px-4 py-2 font-bold transition-colors hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700">
            إعادة المحاولة
          </button>
        </div>
      ) : null}
      {results?.responseCount === 0 ? (
        <div className="mt-5 rounded-xl bg-slate-50 px-5 py-8 text-center">
          <p className="font-bold text-slate-800">لم تصل ردود على الاستبيان بعد</p>
          <p className="mt-1 text-sm text-slate-600">ستظهر الإجابات المجمّعة هنا بعد إرسال الطلاب ردودهم.</p>
        </div>
      ) : null}
      {results && results.responseCount > 0 ? (
        <ol className="mt-5 divide-y divide-slate-200">
          {results.questions.map((question) => (
            <li key={question.id} className="py-5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-pretty font-bold leading-7 text-slate-900">
                  <span className="me-2 text-sm text-slate-400">{question.sortOrder + 1}</span>
                  {question.prompt}
                </h3>
                <span className="text-sm text-slate-500">{question.answerCount} إجابة</span>
              </div>

              {question.questionType === 'Rating' ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-[10rem_minmax(0,1fr)] lg:items-start">
                  <div className="rounded-xl bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-900">متوسط التقييم</p>
                    <p className="mt-1 text-2xl font-black tabular-nums text-amber-950" dir="ltr">
                      {question.ratingAverage?.toFixed(1) ?? '—'} / 5
                    </p>
                  </div>
                  <div className="space-y-3">
                    {question.ratingDistribution.map((entry) => (
                      <ResultBar key={entry.value} label={`${entry.value} نجوم`} count={entry.count} percentage={entry.percentage} tone="amber" />
                    ))}
                  </div>
                </div>
              ) : null}

              {question.questionType === 'SingleChoice' ? (
                <div className="mt-4 space-y-3">
                  {question.optionResults.map((option) => (
                    <ResultBar key={option.optionId} label={option.optionText} count={option.count} percentage={option.percentage} />
                  ))}
                </div>
              ) : null}

              {question.questionType === 'ShortText' ? (
                question.textResponses.length > 0
                  ? (
                    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                      {question.textResponses.map((response, index) => (
                        <li key={`${question.id}-${index}`} className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                          {response}
                        </li>
                      ))}
                    </ul>
                  )
                  : <p className="mt-4 text-sm text-slate-500">لا توجد إجابات نصية.</p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function ResultBar({
  label,
  count,
  percentage,
  tone = 'primary',
}: {
  label: string;
  count: number;
  percentage: number;
  tone?: 'primary' | 'amber';
}) {
  const width = Math.min(100, Math.max(0, percentage));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-sm">
      <span className="min-w-0 truncate font-medium text-slate-700" title={label}>{label}</span>
      <span dir="ltr" className="tabular-nums text-slate-600">{count} · {Math.round(percentage)}%</span>
      <span
        role="progressbar"
        aria-label={`${label}: ${Math.round(percentage)}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        className="col-span-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <span className={`block h-full rounded-full ${tone === 'amber' ? 'bg-amber-500' : 'bg-[var(--teacher-primary)]'}`} style={{ width: `${width}%` }} />
      </span>
    </div>
  );
}

function SurveyResultsLoading() {
  return (
    <div role="status" aria-label="جارٍ تحميل آراء الطلاب" className="mt-5 space-y-3 motion-safe:animate-pulse">
      <div className="h-5 w-2/5 rounded bg-slate-200" />
      <div className="h-12 rounded-xl bg-slate-100" />
      <div className="h-12 rounded-xl bg-slate-100" />
    </div>
  );
}
