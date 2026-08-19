import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { certificatesApi, reportsApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import type { CertificateListItem } from '../../../types/certificates';
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
  const certificatesQuery = useQuery({
    queryKey: ['certificates', tenantId],
    queryFn: ({ signal }) => certificatesApi.list(tenantId!, signal),
    enabled: Boolean(tenantId),
    retry: false,
  });

  if (!tenantId) return null;

  if (attemptQuery.isLoading) {
    return <div className="h-72 rounded-xl bg-slate-200 motion-safe:animate-pulse" role="status" aria-label="جارٍ تحميل نتيجة الطالب" />;
  }

  if (attemptQuery.isError || !attemptQuery.data) {
    const notFound = attemptQuery.error instanceof HttpError && attemptQuery.error.status === 404;
    return (
      <div className="flex flex-col items-start gap-4">
        <p role="alert" className="w-full rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          {notFound ? 'نتيجة الطالب غير موجودة.' : 'تعذر تحميل نتيجة الطالب الآن.'}
        </p>
        <Button variant="secondary" onClick={() => void attemptQuery.refetch()}>إعادة المحاولة</Button>
      </div>
    );
  }

  const attempt = attemptQuery.data;
  const reportLink = fallbackSessionId && fallbackQuizId
    ? `/dashboard/reports/${fallbackSessionId}?quizId=${fallbackQuizId}`
    : `/dashboard/reports/${attempt.sessionId}?quizId=${attempt.quizId}`;
  const certificate = certificatesQuery.data?.find((item) => item.attemptId === attempt.attemptId);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--teacher-muted)]">{attempt.quizTitle} · {attempt.sessionLabel ?? 'جلسة بدون عنوان'}</p>
          <h1 className="mt-2 text-balance text-2xl font-black text-[var(--teacher-ink)]">نتيجة {attempt.displayName}</h1>
        </div>
        <Link to={reportLink} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teacher-primary)]">
          العودة إلى التقرير
        </Link>
      </header>

      <section aria-labelledby="attempt-summary-heading" className="teacher-surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="attempt-summary-heading" className="text-lg font-black text-[var(--teacher-ink)]">النتيجة</h2>
            <p className="mt-1 text-sm text-[var(--teacher-muted)]">{ATTEMPT_STATUS_LABELS[attempt.status]}</p>
          </div>
          <AttemptOutcome passed={attempt.passed} />
        </div>
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          <ResultMetric label="الدرجة" value={attempt.score == null || attempt.maxScore == null ? '—' : `${attempt.score} / ${attempt.maxScore}`} />
          <ResultMetric label="النسبة" value={attempt.percentage == null ? '—' : `${Math.round(attempt.percentage)}%`} />
          <ResultMetric label="المدة" value={formatDuration(attempt.durationMs)} />
          <ResultMetric label="انتهت في" value={attempt.finishedAt ? formatDate(attempt.finishedAt) : 'لم تنتهِ بعد'} compact />
        </dl>
      </section>

      {certificate ? <CertificateResultHandoff certificate={certificate} /> : null}

      <section aria-labelledby="question-results-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="question-results-heading" className="text-xl font-black text-[var(--teacher-ink)]">تفاصيل الإجابات</h2>
          <p className="mt-1 text-sm text-[var(--teacher-muted)]">الإجابة والدرجة المعروضتان هما ما حفظه وصححه الخادم.</p>
        </div>

        {attempt.questions.length === 0 ? (
          <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">لا توجد إجابات مسجلة لهذه النتيجة.</p>
        ) : (
          <ol className="teacher-surface divide-y divide-slate-200 overflow-hidden">
            {attempt.questions.map((question) => (
              <li key={question.quizVersionItemId} className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-700">{question.sortOrder + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-pretty font-bold leading-7 text-slate-950">{question.prompt}</h3>
                      <QuestionOutcome isCorrect={question.isCorrect} />
                    </div>
                    <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-[minmax(0,1fr)_10rem]">
                      <div><dt className="text-slate-500">إجابة الطالب</dt><dd className="mt-1 break-words font-medium text-slate-800">{question.answerSummary ?? 'لم يُجب'}</dd></div>
                      <div><dt className="text-slate-500">النقاط</dt><dd className="mt-1 font-bold text-slate-800" dir="ltr">{question.scoreAwarded ?? 0} / {question.pointsPossible}</dd></div>
                    </dl>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function AttemptOutcome({ passed }: { passed: boolean | null }) {
  if (passed == null) return <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">لم تُحسم بعد</span>;
  return passed
    ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-800">اجتاز الاختبار</span>
    : <span className="rounded-full bg-rose-50 px-3 py-1.5 text-sm font-bold text-rose-800">لم يجتز الاختبار</span>;
}

function QuestionOutcome({ isCorrect }: { isCorrect: boolean | null }) {
  if (isCorrect == null) return <span className="text-sm font-medium text-slate-500">بلا إجابة</span>;
  return isCorrect
    ? <span className="text-sm font-bold text-emerald-700">صحيحة</span>
    : <span className="text-sm font-bold text-rose-700">غير صحيحة</span>;
}

function CertificateResultHandoff({ certificate }: { certificate: CertificateListItem }) {
  const body = certificate.status === 'Ready'
    ? 'شهادة هذا الطالب جاهزة للعرض والمشاركة.'
    : certificate.status === 'Failed'
      ? 'تعذر تجهيز شهادة هذا الطالب. يمكنك إعادة المحاولة من صفحة الشهادات.'
      : 'جارٍ تجهيز شهادة هذا الطالب، وستتحدث حالتها تلقائيًا.';
  return (
    <section aria-labelledby="attempt-certificate-heading" className="rounded-xl bg-[var(--teacher-primary-soft)] p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
      <div>
        <h2 id="attempt-certificate-heading" className="font-black text-[var(--teacher-primary-strong)]">الشهادة</h2>
        <p className="mt-1 text-sm leading-6 text-slate-700">{body}</p>
      </div>
      {certificate.status === 'Ready' ? (
        <Link to={`/dashboard/certificates?certificateId=${certificate.id}`} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--teacher-primary)] px-4 py-2 text-sm font-black text-white hover:bg-[var(--teacher-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teacher-primary)] sm:mt-0">
          عرض الشهادة
        </Link>
      ) : null}
    </section>
  );
}

function ResultMetric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="border-b border-slate-100 p-5 last:border-b-0 odd:border-e lg:border-b-0 lg:border-e">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className={`mt-2 font-black text-slate-950 ${compact ? 'text-base' : 'text-xl tabular-nums'}`}>{value}</dd>
    </div>
  );
}

function formatDuration(durationMs: number | null) {
  if (durationMs == null) return '—';
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes === 0 ? `${seconds} ث` : seconds === 0 ? `${minutes} د` : `${minutes} د ${seconds} ث`;
}

function formatDate(dateTime: string) {
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateTime));
}
