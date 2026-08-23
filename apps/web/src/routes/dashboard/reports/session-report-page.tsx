import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { certificatesApi, reportsApi, surveysApi } from '../../../data/api-client/endpoints';
import { SurveyResultsSummary } from '../../../features/surveys/survey-results-summary';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import type { CertificateListItem } from '../../../types/certificates';
import {
  DIFFICULTY_SIGNAL_LABELS,
  type QuestionAnalytics,
  type ReportAttemptListItem,
} from '../../../types/reports';
import { ATTEMPT_STATUS_LABELS, SESSION_MODE_LABELS, SESSION_STATUS_LABELS } from '../../../types/sessions';

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

  const certificatesQuery = useQuery({
    queryKey: ['certificates', tenantId],
    queryFn: ({ signal }) => certificatesApi.list(tenantId!, signal),
    enabled: Boolean(tenantId),
    retry: false,
  });

  const certificatesByAttempt = useMemo(
    () => new Map((certificatesQuery.data ?? []).map((certificate) => [certificate.attemptId, certificate])),
    [certificatesQuery.data],
  );

  if (!tenantId) return null;

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

  if (reportQuery.isLoading) return <ReportLoading />;

  if (reportQuery.isError || !reportQuery.data) {
    const notFound = reportQuery.error instanceof HttpError && reportQuery.error.status === 404;
    return (
      <div className="flex flex-col items-start gap-4">
        <p role="alert" className="w-full rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          {notFound ? 'التقرير أو الجلسة غير موجودين.' : 'تعذر تحميل التقرير الآن.'}
        </p>
        <Button variant="secondary" onClick={() => void reportQuery.refetch()}>إعادة المحاولة</Button>
      </div>
    );
  }

  const report = reportQuery.data;
  const summary = report.summary;
  const attempts = attemptsQuery.data;
  const reportDate = report.finishedAt ?? report.activatedAt;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <Link to="/dashboard/reports" className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--teacher-primary-strong)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teacher-primary)]">
            العودة إلى النتائج والتقارير
          </Link>
          <h1 className="mt-2 text-balance text-2xl font-black text-[var(--teacher-ink)]">تقرير {report.quizTitle}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--teacher-muted)]">
            <span className="font-bold text-slate-800">{report.sessionLabel ?? 'جلسة بدون عنوان'}</span>
            <span>{SESSION_MODE_LABELS[report.sessionMode]}</span>
            <span>{SESSION_STATUS_LABELS[report.sessionStatus]}</span>
            {reportDate ? <time dateTime={reportDate}>{formatDate(reportDate)}</time> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {quizId ? (
            <Link to={`/dashboard/sessions/${sessionId}?quizId=${quizId}`} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teacher-primary)]">
              تفاصيل الجلسة
            </Link>
          ) : null}
          <Button variant="secondary" onClick={() => void exportCsv()} disabled={exporting}>
            {exporting ? 'جارٍ التصدير…' : 'تصدير CSV'}
          </Button>
        </div>
      </header>

      {exportError ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{exportError}</p> : null}

      <section aria-labelledby="summary-heading" className="teacher-surface overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 id="summary-heading" className="text-lg font-black text-[var(--teacher-ink)]">نظرة سريعة</h2>
          <p className="mt-1 text-sm text-[var(--teacher-muted)]">أهم ما حدث في هذه الجلسة.</p>
        </div>
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          <SummaryMetric label="المشاركون" value={summary.participantCount} />
          <SummaryMetric label="أكملوا" value={summary.completedCount} />
          <SummaryMetric label="نجحوا" value={summary.passedCount} tone="success" />
          <SummaryMetric label="متوسط الدرجة" value={summary.averagePercentage == null ? '—' : `${Math.round(summary.averagePercentage)}%`} />
        </dl>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-600">
          <InlineMetric label="قيد التنفيذ" value={summary.inProgressCount} />
          <InlineMetric label="لم يجتازوا" value={summary.failedCount} />
          <InlineMetric label="انتهى الوقت" value={summary.timedOutCount} />
          {summary.averageDurationMs != null ? <InlineMetric label="متوسط المدة" value={formatDuration(summary.averageDurationMs)} /> : null}
        </dl>
      </section>

      <section aria-labelledby="attempts-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="attempts-heading" className="text-xl font-black text-[var(--teacher-ink)]">نتائج الطلاب</h2>
            <p className="mt-1 text-sm text-[var(--teacher-muted)]">افتح نتيجة الطالب لمراجعة إجاباته ودرجاته بالتفصيل.</p>
          </div>
          {attempts ? <p className="text-sm text-slate-500">{attempts.totalItems} طالب</p> : null}
        </div>

        {attemptsQuery.isLoading ? (
          <div className="h-40 rounded-xl bg-slate-200 motion-safe:animate-pulse" role="status" aria-label="جارٍ تحميل نتائج الطلاب" />
        ) : attemptsQuery.isError ? (
          <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
            <p>تعذر تحميل نتائج الطلاب.</p>
            <button type="button" onClick={() => void attemptsQuery.refetch()} className="mt-3 min-h-11 rounded-lg border border-rose-300 bg-white px-4 py-2 font-bold hover:bg-rose-100">إعادة المحاولة</button>
          </div>
        ) : !attempts || attempts.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-bold text-slate-800">لا توجد نتائج بعد</p>
            <p className="mt-1 text-sm text-slate-600">ستظهر نتائج الطلاب هنا بعد بدء الاختبار.</p>
          </div>
        ) : (
          <AttemptsList
            attempts={attempts.items}
            sessionId={report.sessionId}
            quizId={report.quizId}
            certificatesByAttempt={certificatesByAttempt}
            totalLevels={report.questions.length}
          />
        )}

        {attempts && attempts.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>السابق</Button>
            <span className="text-sm text-slate-600">صفحة {page} من {attempts.totalPages}</span>
            <Button variant="secondary" disabled={page >= attempts.totalPages} onClick={() => setPage((value) => value + 1)}>التالي</Button>
          </div>
        ) : null}
      </section>

      <QuestionAnalyticsSection questions={report.questions} />
      <ReportSurveyResults tenantId={tenantId} quizId={report.quizId} />
    </div>
  );
}

function SummaryMetric({ label, value, tone = 'neutral' }: { label: string; value: number | string; tone?: 'neutral' | 'success' }) {
  return (
    <div className="border-b border-slate-100 p-5 last:border-b-0 odd:border-e lg:border-b-0 lg:border-e">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className={`mt-2 text-2xl font-black tabular-nums ${tone === 'success' ? 'text-emerald-700' : 'text-slate-950'}`}>{value}</dd>
    </div>
  );
}

function InlineMetric({ label, value }: { label: string; value: number | string }) {
  return <div className="flex gap-1.5"><dt>{label}:</dt><dd className="font-bold text-slate-800">{value}</dd></div>;
}

function AttemptsList({
  attempts,
  sessionId,
  quizId,
  certificatesByAttempt,
  totalLevels,
}: {
  attempts: ReportAttemptListItem[];
  sessionId: string;
  quizId: string;
  certificatesByAttempt: Map<string, CertificateListItem>;
  totalLevels: number;
}) {
  const showsChallengeProgress = attempts.some((attempt) => attempt.mode === 'ProgressiveChallenge');

  return (
    <div className="teacher-surface overflow-hidden">
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-start font-bold">الطالب</th>
              <th className="px-3 py-3 text-start font-bold">الدرجة</th>
              <th className="px-3 py-3 text-start font-bold">النسبة</th>
              <th className="px-3 py-3 text-start font-bold">النتيجة</th>
              {showsChallengeProgress ? <th className="px-3 py-3 text-start font-bold">المستوى</th> : null}
              <th className="px-3 py-3 text-start font-bold">المدة</th>
              <th className="px-3 py-3 text-start font-bold">الشهادة</th>
              <th className="px-4 py-3 text-start font-bold"><span className="sr-only">الإجراء</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {attempts.map((attempt) => (
              <tr key={attempt.attemptId} className="transition-colors hover:bg-slate-50/70">
                <td className="px-4 py-4"><p className="font-bold text-slate-900">{attempt.displayName}</p><p className="mt-1 text-xs text-slate-500">{ATTEMPT_STATUS_LABELS[attempt.status]}</p></td>
                <td className="px-3 py-4 text-slate-700" dir="ltr">{formatScore(attempt)}</td>
                <td className="px-3 py-4 font-bold text-slate-800" dir="ltr">{formatPercentage(attempt.percentage)}</td>
                <td className="px-3 py-4"><AttemptOutcome attempt={attempt} /></td>
                {showsChallengeProgress ? (
                  <td className="px-3 py-4 text-slate-700">
                    <ChallengeProgress attempt={attempt} totalLevels={totalLevels} />
                  </td>
                ) : null}
                <td className="px-3 py-4 text-slate-600">{formatDuration(attempt.durationMs)}</td>
                <td className="px-3 py-4"><CertificateHandoff certificate={certificatesByAttempt.get(attempt.attemptId)} /></td>
                <td className="px-4 py-4 text-end"><AttemptDetailsLink attemptId={attempt.attemptId} sessionId={sessionId} quizId={quizId} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-slate-200 md:hidden">
        {attempts.map((attempt) => (
          <li key={attempt.attemptId} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate font-black text-slate-900">{attempt.displayName}</p><p className="mt-1 text-sm text-slate-500">{ATTEMPT_STATUS_LABELS[attempt.status]}</p></div>
              <AttemptOutcome attempt={attempt} />
            </div>
            <dl className={`mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm ${showsChallengeProgress ? 'grid-cols-2' : 'grid-cols-3'}`}>
              <div><dt className="text-slate-500">الدرجة</dt><dd className="mt-1 font-bold text-slate-900" dir="ltr">{formatScore(attempt)}</dd></div>
              <div><dt className="text-slate-500">النسبة</dt><dd className="mt-1 font-bold text-slate-900" dir="ltr">{formatPercentage(attempt.percentage)}</dd></div>
              {showsChallengeProgress ? <div><dt className="text-slate-500">المستوى</dt><dd className="mt-1 font-bold text-slate-900"><ChallengeProgress attempt={attempt} totalLevels={totalLevels} /></dd></div> : null}
              <div><dt className="text-slate-500">المدة</dt><dd className="mt-1 font-bold text-slate-900">{formatDuration(attempt.durationMs)}</dd></div>
            </dl>
            <div className="mt-4 flex flex-col gap-3">
              <CertificateHandoff certificate={certificatesByAttempt.get(attempt.attemptId)} />
              <AttemptDetailsLink attemptId={attempt.attemptId} sessionId={sessionId} quizId={quizId} fullWidth />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChallengeProgress({ attempt, totalLevels }: { attempt: ReportAttemptListItem; totalLevels: number }) {
  if (attempt.mode !== 'ProgressiveChallenge' || attempt.maxLevelReached == null) return <span>—</span>;
  return <span data-testid="challenge-report-progress">المستوى {attempt.maxLevelReached} من {totalLevels}</span>;
}

function AttemptOutcome({ attempt }: { attempt: ReportAttemptListItem }) {
  if (attempt.passed == null) return <span className="text-sm text-slate-500">لم تُحسم</span>;
  return attempt.passed
    ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">ناجح</span>
    : <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800">لم يجتز</span>;
}

function CertificateHandoff({ certificate }: { certificate: CertificateListItem | undefined }) {
  if (!certificate) return <span className="text-sm text-slate-400">—</span>;
  if (certificate.status === 'Ready') {
    return <Link to={`/dashboard/certificates?certificateId=${certificate.id}`} className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--teacher-primary-strong)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teacher-primary)]">عرض الشهادة</Link>;
  }
  if (certificate.status === 'Failed') return <span className="text-sm font-medium text-rose-700">تعذر تجهيز الشهادة</span>;
  return <span className="text-sm font-medium text-amber-800">جارٍ تجهيز الشهادة</span>;
}

function AttemptDetailsLink({ attemptId, sessionId, quizId, fullWidth = false }: { attemptId: string; sessionId: string; quizId: string; fullWidth?: boolean }) {
  return (
    <Link
      to={`/dashboard/attempts/${attemptId}?sessionId=${sessionId}&quizId=${quizId}`}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teacher-primary)] ${fullWidth ? 'w-full' : ''}`}>
      عرض التفاصيل
    </Link>
  );
}

function QuestionAnalyticsSection({ questions }: { questions: QuestionAnalytics[] }) {
  return (
    <section aria-labelledby="analytics-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="analytics-heading" className="text-xl font-black text-[var(--teacher-ink)]">أداء الأسئلة</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--teacher-muted)]">تساعدك نسبة النجاح في معرفة الأسئلة التي تحتاج إلى مراجعة مع الطلاب.</p>
      </div>
      {questions.length === 0 ? (
        <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">لا توجد أسئلة في نسخة الاختبار.</p>
      ) : (
        <div className="teacher-surface overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr><th className="px-4 py-3 text-start font-bold">السؤال</th><th className="px-3 py-3 text-start font-bold">الإجابات</th><th className="px-3 py-3 text-start font-bold">صحيحة</th><th className="px-3 py-3 text-start font-bold">نسبة النجاح</th><th className="px-4 py-3 text-start font-bold">المؤشر</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {questions.map((question) => (
                  <tr key={question.quizVersionItemId}>
                    <td className="max-w-xl px-4 py-4 font-medium text-slate-900"><span className="me-2 text-xs text-slate-400">{question.sortOrder + 1}</span>{question.prompt}</td>
                    <td className="px-3 py-4 text-slate-700">{question.answerCount}</td>
                    <td className="px-3 py-4 text-slate-700">{question.correctCount}</td>
                    <td className="px-3 py-4 font-bold text-slate-800" dir="ltr">{formatPercentage(question.successPercentage)}</td>
                    <td className="px-4 py-4 text-slate-700">{DIFFICULTY_SIGNAL_LABELS[question.difficultySignal]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ol className="divide-y divide-slate-200 md:hidden">
            {questions.map((question) => (
              <li key={question.quizVersionItemId} className="p-4">
                <h3 className="text-pretty font-bold leading-6 text-slate-900"><span className="me-2 text-slate-400">{question.sortOrder + 1}</span>{question.prompt}</h3>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-slate-500">الإجابات</dt><dd className="mt-1 font-bold text-slate-900">{question.answerCount}</dd></div>
                  <div><dt className="text-slate-500">صحيحة</dt><dd className="mt-1 font-bold text-slate-900">{question.correctCount}</dd></div>
                  <div><dt className="text-slate-500">النجاح</dt><dd className="mt-1 font-bold text-slate-900" dir="ltr">{formatPercentage(question.successPercentage)}</dd></div>
                </dl>
                <p className="mt-3 text-sm font-medium text-slate-700">{DIFFICULTY_SIGNAL_LABELS[question.difficultySignal]}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function ReportSurveyResults({ tenantId, quizId }: { tenantId: string; quizId: string }) {
  const surveysQuery = useQuery({
    queryKey: ['quiz-surveys', tenantId, quizId, 'report'],
    queryFn: ({ signal }) => surveysApi.list(tenantId, quizId, signal),
    retry: false,
  });
  const survey = surveysQuery.data?.find((item) => item.status === 'Published') ?? null;
  const resultsQuery = useQuery({
    queryKey: ['survey-results', tenantId, survey?.id, 'report'],
    queryFn: ({ signal }) => surveysApi.getResults(tenantId, survey!.id, signal),
    enabled: Boolean(survey),
    retry: false,
  });

  if (surveysQuery.isPending) return null;
  if (surveysQuery.isError) {
    return <SurveyResultsSummary results={undefined} isPending={false} isError onRetry={() => void surveysQuery.refetch()} description="تعذر التحقق من الاستبيان المرتبط بهذا الاختبار." />;
  }
  if (!survey) return null;
  return (
    <SurveyResultsSummary
      results={resultsQuery.data}
      isPending={resultsQuery.isPending}
      isError={resultsQuery.isError}
      onRetry={() => void resultsQuery.refetch()}
      description="إجابات مجمّعة من استبيان هذا الاختبار عبر جميع جلساته."
    />
  );
}

function formatScore(attempt: ReportAttemptListItem) {
  return attempt.score == null || attempt.maxScore == null ? '—' : `${attempt.score} / ${attempt.maxScore}`;
}

function formatPercentage(percentage: number | null) {
  return percentage == null ? '—' : `${Math.round(percentage)}%`;
}

function formatDuration(durationMs: number | null) {
  if (durationMs == null) return '—';
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} ث`;
  return seconds === 0 ? `${minutes} د` : `${minutes} د ${seconds} ث`;
}

function formatDate(dateTime: string) {
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateTime));
}

function ReportLoading() {
  return (
    <div className="flex flex-col gap-6 motion-safe:animate-pulse" role="status" aria-label="جارٍ تحميل التقرير">
      <div className="h-24 rounded-xl bg-slate-200" />
      <div className="h-44 rounded-xl bg-slate-200" />
      <div className="h-64 rounded-xl bg-slate-200" />
    </div>
  );
}
