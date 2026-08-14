import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router';
import { reportsApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import { ATTEMPT_STATUS_LABELS } from '../../../types/sessions';

export default function AttemptDetailPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [searchParams] = useSearchParams();
  const fallbackSessionId = searchParams.get('sessionId');
  const fallbackQuizId = searchParams.get('quizId');
  const tenantId = getActiveTenantId();

  const attemptQuery = useQuery({
    queryKey: ['attempt-detail', tenantId, attemptId],
    queryFn: ({ signal }) => reportsApi.getAttempt(tenantId!, attemptId!, signal),
    enabled: Boolean(tenantId && attemptId),
    retry: false,
  });

  if (!tenantId) {
    return null;
  }

  if (attemptQuery.isLoading) {
    return <div className="h-72 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none" aria-label="جارٍ تحميل المحاولة" />;
  }

  if (attemptQuery.isError || !attemptQuery.data) {
    const notFound = attemptQuery.error instanceof HttpError && attemptQuery.error.status === 404;
    return (
      <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">
        {notFound ? 'المحاولة غير موجودة.' : 'تعذر تحميل تفاصيل المحاولة.'}
      </p>
    );
  }

  const attempt = attemptQuery.data;
  const reportLink = `/dashboard/reports/${attempt.sessionId}?quizId=${attempt.quizId}`;
  const durationSeconds = attempt.durationMs == null ? null : Math.round(attempt.durationMs / 1000);

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm text-slate-600">{attempt.quizTitle} · {attempt.sessionLabel ?? 'جلسة بدون عنوان'}</p>
          <h1 className="text-balance text-2xl font-bold text-slate-950">محاولة {attempt.displayName}</h1>
        </div>
        <Link
          to={fallbackSessionId && fallbackQuizId
            ? `/dashboard/reports/${fallbackSessionId}?quizId=${fallbackQuizId}`
            : reportLink}
          className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
          عودة للتقرير
        </Link>
      </header>

      <section aria-labelledby="attempt-summary-heading" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <h2 id="attempt-summary-heading" className="border-b border-slate-200 px-4 py-3 text-base font-semibold text-slate-950">
          النتيجة
        </h2>
        <dl className="grid grid-cols-2 md:grid-cols-5">
          <ResultMetric label="الحالة" value={ATTEMPT_STATUS_LABELS[attempt.status]} />
          <ResultMetric label="الدرجة" value={attempt.score == null || attempt.maxScore == null ? '—' : `${attempt.score} / ${attempt.maxScore}`} />
          <ResultMetric label="النسبة" value={attempt.percentage == null ? '—' : `${Math.round(attempt.percentage)}%`} />
          <ResultMetric label="الاجتياز" value={attempt.passed == null ? 'لم تُحسم' : attempt.passed ? 'ناجح' : 'لم يجتز'} />
          <ResultMetric label="المدة" value={durationSeconds == null ? '—' : `${durationSeconds} ثانية`} />
        </dl>
      </section>

      <section aria-labelledby="question-results-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="question-results-heading" className="text-lg font-semibold text-slate-950">نتائج الأسئلة</h2>
          <p className="text-sm text-slate-600">الإجابة والدرجة المعروضتان هما ما حفظه وصححه الخادم.</p>
        </div>

        <ol className="flex flex-col divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {attempt.questions.map((question) => (
            <li key={question.quizVersionItemId} className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                  {question.sortOrder + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-pretty font-semibold text-slate-950">{question.prompt}</h3>
                    <span className={question.isCorrect === true
                      ? 'text-sm font-medium text-emerald-700'
                      : question.isCorrect === false
                        ? 'text-sm font-medium text-rose-700'
                        : 'text-sm text-slate-500'}>
                      {question.isCorrect === true ? 'صحيحة' : question.isCorrect === false ? 'غير صحيحة' : 'بلا إجابة'}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-slate-500">إجابة الطالب</dt>
                      <dd className="mt-0.5 break-words text-slate-800">{question.answerSummary ?? 'لم يُجب'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">الدرجة</dt>
                      <dd className="mt-0.5 text-slate-800" dir="ltr">
                        {question.scoreAwarded ?? 0} / {question.pointsPossible}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 p-4 last:border-b-0 md:border-b-0 md:border-e">
      <dt className="text-xs text-slate-600">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
