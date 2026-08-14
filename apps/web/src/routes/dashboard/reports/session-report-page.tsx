import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { reportsApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import {
  DIFFICULTY_SIGNAL_LABELS,
  type ReportAttemptListItem,
} from '../../../types/reports';
import { ATTEMPT_STATUS_LABELS } from '../../../types/sessions';

const PAGE_SIZE = 20;

export default function SessionReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const quizId = searchParams.get('quizId');
  const tenantId = getActiveTenantId();
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const reportQuery = useQuery({
    queryKey: ['session-report', tenantId, sessionId],
    queryFn: ({ signal }) => reportsApi.getSessionReport(tenantId!, sessionId!, signal),
    enabled: Boolean(tenantId && sessionId),
    retry: false,
  });

  const attemptsQuery = useQuery({
    queryKey: ['session-report-attempts', tenantId, sessionId, page],
    queryFn: ({ signal }) => reportsApi.listAttempts(tenantId!, sessionId!, page, PAGE_SIZE, signal),
    enabled: Boolean(tenantId && sessionId),
    retry: false,
  });

  if (!tenantId) {
    return null;
  }

  async function exportCsv() {
    if (!tenantId || !sessionId) return;
    setExporting(true);
    setExportError(null);
    try {
      const blob = await reportsApi.exportSessionCsv(tenantId, sessionId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'session-results.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(
        error instanceof HttpError && error.status === 429
          ? 'تم طلب التصدير مرات كثيرة. انتظر قليلًا ثم حاول مجددًا.'
          : 'تعذر تصدير النتائج الآن.',
      );
    } finally {
      setExporting(false);
    }
  }

  if (reportQuery.isLoading) {
    return <ReportLoading />;
  }

  if (reportQuery.isError || !reportQuery.data) {
    const notFound = reportQuery.error instanceof HttpError && reportQuery.error.status === 404;
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">
          {notFound ? 'التقرير أو الجلسة غير موجودين.' : 'تعذر تحميل التقرير. أعد المحاولة.'}
        </p>
        <Button variant="secondary" onClick={() => void reportQuery.refetch()}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  const report = reportQuery.data;
  const summary = report.summary;
  const attempts = attemptsQuery.data;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="mb-1 text-sm text-slate-600">{report.sessionLabel ?? 'جلسة بدون عنوان'}</p>
          <h1 className="text-balance text-2xl font-bold text-slate-950">تقرير {report.quizTitle}</h1>
          <p className="mt-2 text-sm text-slate-600">
            نتائج حقيقية من المحاولات المسجلة؛ لا تشمل المحاولات غير المكتملة في متوسط النسبة.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quizId ? (
            <Link
              to={`/dashboard/sessions/${sessionId}?quizId=${quizId}`}
              className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
              تفاصيل الجلسة
            </Link>
          ) : null}
          <Button onClick={() => void exportCsv()} disabled={exporting}>
            {exporting ? 'جارٍ التصدير…' : 'تصدير CSV'}
          </Button>
        </div>
      </header>

      {exportError ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
          {exportError}
        </p>
      ) : null}

      <section aria-labelledby="summary-heading" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <h2 id="summary-heading" className="border-b border-slate-200 px-4 py-3 text-base font-semibold text-slate-950">
          ملخص الجلسة
        </h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryMetric label="المشاركون" value={summary.participantCount} />
          <SummaryMetric label="المكتملة" value={summary.completedCount} />
          <SummaryMetric label="قيد التنفيذ" value={summary.inProgressCount} />
          <SummaryMetric label="ناجحون" value={summary.passedCount} tone="success" />
          <SummaryMetric label="لم يجتازوا" value={summary.failedCount} tone="danger" />
          <SummaryMetric
            label="متوسط النسبة"
            value={summary.averagePercentage == null ? '—' : `${Math.round(summary.averagePercentage)}%`}
          />
        </dl>
      </section>

      <section aria-labelledby="attempts-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="attempts-heading" className="text-lg font-semibold text-slate-950">المحاولات</h2>
            <p className="text-sm text-slate-600">افتح أي محاولة لرؤية نتيجة كل سؤال.</p>
          </div>
          {attempts ? <p className="text-xs text-slate-500">الإجمالي: {attempts.totalItems}</p> : null}
        </div>

        {attemptsQuery.isLoading ? (
          <div className="h-36 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none" aria-label="جارٍ تحميل المحاولات" />
        ) : attemptsQuery.isError ? (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            تعذر تحميل المحاولات.
          </p>
        ) : !attempts || attempts.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="font-medium text-slate-800">لا توجد محاولات بعد</p>
            <p className="mt-1 text-sm text-slate-600">ستظهر النتائج هنا بعد أن يبدأ الطلاب الاختبار.</p>
          </div>
        ) : (
          <AttemptsTable attempts={attempts.items} sessionId={report.sessionId} quizId={report.quizId} />
        )}

        {attempts && attempts.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              السابق
            </Button>
            <span className="text-sm text-slate-600">صفحة {page} من {attempts.totalPages}</span>
            <Button
              variant="secondary"
              disabled={page >= attempts.totalPages}
              onClick={() => setPage((value) => value + 1)}>
              التالي
            </Button>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="analytics-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="analytics-heading" className="text-lg font-semibold text-slate-950">تحليل الأسئلة</h2>
          <p className="text-sm text-slate-600">
            إشارة الصعوبة مبنية على متوسط النقاط الفعلية: 80% فأكثر أداء مرتفع، و50–79% متوسط، وأقل من ذلك يحتاج مراجعة.
          </p>
        </div>
        {report.questions.length === 0 ? (
          <p className="rounded-lg bg-slate-100 p-4 text-sm text-slate-700">لا توجد أسئلة في نسخة الاختبار.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <th className="px-4 py-3 text-start font-medium">السؤال</th>
                  <th className="px-3 py-3 text-start font-medium">الإجابات</th>
                  <th className="px-3 py-3 text-start font-medium">صحيحة</th>
                  <th className="px-3 py-3 text-start font-medium">نسبة النجاح</th>
                  <th className="px-4 py-3 text-start font-medium">الإشارة</th>
                </tr>
              </thead>
              <tbody>
                {report.questions.map((question) => (
                  <tr key={question.quizVersionItemId} className="border-b border-slate-100 last:border-b-0">
                    <td className="max-w-xl px-4 py-3 font-medium text-slate-900">
                      <span className="me-2 text-xs text-slate-400">{question.sortOrder + 1}</span>
                      {question.prompt}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{question.answerCount}</td>
                    <td className="px-3 py-3 text-slate-700">{question.correctCount}</td>
                    <td className="px-3 py-3 text-slate-700" dir="ltr">
                      {question.successPercentage == null ? '—' : `${Math.round(question.successPercentage)}%`}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {DIFFICULTY_SIGNAL_LABELS[question.difficultySignal]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  tone?: 'neutral' | 'success' | 'danger';
}) {
  const valueClass = tone === 'success' ? 'text-emerald-700' : tone === 'danger' ? 'text-rose-700' : 'text-slate-950';
  return (
    <div className="border-b border-slate-100 p-4 last:border-b-0 sm:border-b-0 sm:border-e">
      <dt className="text-xs text-slate-600">{label}</dt>
      <dd className={`mt-1 text-xl font-bold ${valueClass}`}>{value}</dd>
    </div>
  );
}

function AttemptsTable({
  attempts,
  sessionId,
  quizId,
}: {
  attempts: ReportAttemptListItem[];
  sessionId: string;
  quizId: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
            <th className="px-4 py-3 text-start font-medium">الطالب</th>
            <th className="px-3 py-3 text-start font-medium">الحالة</th>
            <th className="px-3 py-3 text-start font-medium">الدرجة</th>
            <th className="px-3 py-3 text-start font-medium">النسبة</th>
            <th className="px-4 py-3 text-start font-medium">النتيجة</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((attempt) => (
            <tr key={attempt.attemptId} className="border-b border-slate-100 last:border-b-0">
              <td className="px-4 py-3">
                <Link
                  to={`/dashboard/attempts/${attempt.attemptId}?sessionId=${sessionId}&quizId=${quizId}`}
                  className="font-medium text-sky-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
                  {attempt.displayName}
                </Link>
              </td>
              <td className="px-3 py-3 text-slate-700">{ATTEMPT_STATUS_LABELS[attempt.status]}</td>
              <td className="px-3 py-3 text-slate-700" dir="ltr">
                {attempt.score == null || attempt.maxScore == null ? '—' : `${attempt.score} / ${attempt.maxScore}`}
              </td>
              <td className="px-3 py-3 text-slate-700" dir="ltr">
                {attempt.percentage == null ? '—' : `${Math.round(attempt.percentage)}%`}
              </td>
              <td className="px-4 py-3">
                {attempt.passed == null ? (
                  <span className="text-slate-500">لم تُحسم</span>
                ) : attempt.passed ? (
                  <span className="font-medium text-emerald-700">ناجح</span>
                ) : (
                  <span className="font-medium text-rose-700">لم يجتز</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-6 motion-reduce:animate-none" aria-label="جارٍ تحميل التقرير">
      <div className="h-20 rounded-xl bg-slate-200" />
      <div className="h-32 rounded-xl bg-slate-200" />
      <div className="h-56 rounded-xl bg-slate-200" />
    </div>
  );
}
