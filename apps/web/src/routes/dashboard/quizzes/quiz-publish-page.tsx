import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import QRCode from 'react-qr-code';
import { Button } from '../../../components/ui/button';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { quizzesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import {
  QUIZ_VERSION_STATUS_LABELS,
  type PublishQuizResponse,
  type QuizVersionSummary,
} from '../../../types/quizzes';

/** /dashboard/quizzes/:quizId/publish — نشر الاختبار + قائمة الإصدارات */
export default function QuizPublishPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();

  const [publishError, setPublishError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<PublishQuizResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const draftQuery = useQuery({
    queryKey: ['quiz-draft', tenantId, quizId],
    queryFn: ({ signal }) => quizzesApi.getDraft(tenantId!, quizId!, signal),
    enabled: Boolean(tenantId && quizId),
    staleTime: 0,
  });

  const versionsQuery = useQuery({
    queryKey: ['quiz-versions', tenantId, quizId],
    queryFn: ({ signal }) => quizzesApi.listVersions(tenantId!, quizId!, signal),
    enabled: Boolean(tenantId && quizId),
  });

  const hasPublishedVersion = Boolean(
    versionsQuery.data?.some((v) => v.status === 'Published'),
  );

  const shareQuery = useQuery({
    queryKey: ['quiz-share', tenantId, quizId],
    queryFn: ({ signal }) => quizzesApi.getShare(tenantId!, quizId!, signal),
    enabled: Boolean(tenantId && quizId) && hasPublishedVersion && !publishResult,
  });

  const publishMutation = useMutation({
    mutationFn: () => quizzesApi.publish(tenantId!, quizId!, { baseVersion: draftQuery.data!.version }),
    onSuccess: async (result) => {
      setPublishResult(result);
      setPublishError(null);
      setConflictMessage(null);
      await queryClient.invalidateQueries({ queryKey: ['quizzes', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['quiz-versions', tenantId, quizId] });
      await queryClient.invalidateQueries({ queryKey: ['quiz-draft', tenantId, quizId] });
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        setConflictMessage('تعارض تعديل متزامن (409): أعد تحميل الصفحة ثم حاول النشر مجددًا.');
        setPublishError(null);
      } else if (error instanceof HttpError && error.status === 403) {
        setPublishError('ليس لديك صلاحية نشر الاختبارات (يلزم دور مالك أو معلم).');
        setConflictMessage(null);
      } else if (error instanceof HttpError) {
        const body = error.body as { title?: string; detail?: string } | null;
        setPublishError(
          body?.detail
            ? `فشل النشر: ${body.detail} (Code: ${body.title ?? error.status})`
            : `فشل النشر. الحالة: ${error.status}`,
        );
        setConflictMessage(null);
      } else {
        setPublishError('فشل النشر. تحقق من الاتصال.');
        setConflictMessage(null);
      }
    },
  });

  if (!tenantId) {
    navigate('/onboarding/choose', { replace: true });
    return null;
  }

  if (draftQuery.isLoading) {
    return <p className="text-sm text-slate-500">جارٍ تحميل بيانات الاختبار…</p>;
  }

  if (draftQuery.isError || !draftQuery.data) {
    const error = draftQuery.error;
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error instanceof HttpError && error.status === 404
            ? 'الاختبار غير موجود.'
            : error instanceof HttpError && error.status === 403
              ? 'ليس لديك صلاحية عرض هذا الاختبار.'
              : 'تعذر تحميل البيانات. أعد المحاولة.'}
        </p>
        <Link to="/dashboard/quizzes" className="text-sm text-sky-700 hover:underline">
          عودة لقائمة الاختبارات
        </Link>
      </div>
    );
  }

  const draft = draftQuery.data;

  // Readiness checklist
  const hasItems = draft.items.length > 0;
  const hasArchivedSource = draft.items.some((i) => i.sourceQuestionArchived);
  const hasTimeLimitWhenNeeded = draft.timeMode === 'None' || (draft.timeLimitSeconds != null && draft.timeLimitSeconds > 0);
  const allReady = hasItems && !hasArchivedSource && hasTimeLimitWhenNeeded;

  async function onCopyShareUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">نشر: {draft.title}</h1>
          <p className="text-sm text-slate-600">
            مسودة v{draft.versionNumber} · {draft.items.length} سؤال · {draft.totalPoints} نقطة
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/dashboard/quizzes/${quizId}/edit`}
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600">
            تعديل
          </Link>
          <Link
            to="/dashboard/quizzes"
            className="min-h-11 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-sky-600">
            عودة
          </Link>
        </div>
      </div>

      {/* Readiness checklist */}
      <section aria-labelledby="readiness-heading" className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="readiness-heading" className="mb-3 text-base font-semibold text-slate-900">جاهزية النشر</h2>
        <ul className="flex flex-col gap-2 text-sm">
          <li className={hasItems ? 'text-emerald-700' : 'text-rose-700'}>
            {hasItems ? '✓' : '✗'} يحتوي على أسئلة ({draft.items.length})
          </li>
          <li className={!hasArchivedSource ? 'text-emerald-700' : 'text-rose-700'}>
            {!hasArchivedSource ? '✓' : '✗'} لا توجد أسئلة مصدرها مؤرشف
          </li>
          <li className={hasTimeLimitWhenNeeded ? 'text-emerald-700' : 'text-rose-700'}>
            {hasTimeLimitWhenNeeded ? '✓' : '✗'} الوقت محدد عند اختيار وضع وقت
          </li>
        </ul>
      </section>

      {/* Conflict banner */}
      {conflictMessage ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">{conflictMessage}</p>
          <Button variant="secondary" onClick={() => void draftQuery.refetch()}>
            إعادة التحميل
          </Button>
        </div>
      ) : null}

      {publishError ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{publishError}</p>
      ) : null}

      {/* Publish action */}
      {!publishResult ? (
        <section aria-labelledby="publish-heading" className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 id="publish-heading" className="mb-2 text-base font-semibold text-slate-900">تأكيد النشر</h2>
          <p className="mb-4 text-sm text-slate-600">
            سيؤدي النشر إلى تجميد المسودة الحالية كإصدار منشور غير قابل للتعديل، وإنشاء مسودة جديدة للتعديلات المستقبلية.
          </p>
          <Button
            onClick={() => publishMutation.mutate()}
            disabled={!allReady || publishMutation.isPending}>
            {publishMutation.isPending ? <ButtonSpinner /> : null}
            {publishMutation.isPending ? 'جارٍ النشر…' : 'نشر الآن'}
          </Button>
          {!allReady ? (
            <p className="mt-2 text-xs text-slate-500">أكمل عناصر الجاهزية أعلاه قبل النشر.</p>
          ) : null}
        </section>
      ) : null}

      {/* Success panel */}
      {publishResult ? (
        <section aria-labelledby="success-heading" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <h2 id="success-heading" className="mb-3 text-base font-semibold text-emerald-900">
            تم النشر بنجاح ✓
          </h2>
          <dl className="flex flex-col gap-2 text-sm text-emerald-900">
            <div className="flex gap-2">
              <dt className="font-medium">رقم الإصدار:</dt>
              <dd>v{publishResult.versionNumber}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">تاريخ النشر:</dt>
              <dd>{new Date(publishResult.publishedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">البصمة (Checksum):</dt>
              <dd dir="ltr" className="font-mono text-xs">{publishResult.checksum.slice(0, 16)}…</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">الرمز العام:</dt>
              <dd dir="ltr" className="font-mono">{publishResult.publicCode}</dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="font-medium">رابط المشاركة:</dt>
              <dd dir="ltr" className="font-mono text-xs">{publishResult.shareUrl}</dd>
              <Button variant="secondary" onClick={() => onCopyShareUrl(publishResult.shareUrl)}>
                {copied ? 'تم النسخ ✓' : 'نسخ الرابط'}
              </Button>
            </div>
          </dl>
          <div className="mt-4 flex flex-col items-start gap-2">
            <span className="text-sm font-medium text-emerald-900">رمز QR للمشاركة:</span>
            <div dir="ltr" className="rounded-lg bg-white p-3" data-testid="share-qr-code">
              <QRCode value={publishResult.shareUrl} size={160} />
            </div>
          </div>
          <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
            ملاحظة: واجهة الطالب (Player) ستتوفر في المرحلة 4. الرابط العام يعرض صفحة تعريفية بالاختبار فقط حاليًا.
          </p>
        </section>
      ) : null}

      {/* Share section for already-published quiz (when no fresh publish result) */}
      {!publishResult && shareQuery.data ? (
        <section aria-labelledby="share-heading" className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 id="share-heading" className="mb-3 text-base font-semibold text-slate-900">المشاركة</h2>
          <dl className="flex flex-col gap-2 text-sm text-slate-800">
            <div className="flex gap-2">
              <dt className="font-medium">الرمز العام:</dt>
              <dd dir="ltr" className="font-mono">{shareQuery.data.publicCode}</dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="font-medium">رابط المشاركة:</dt>
              <dd dir="ltr" className="font-mono text-xs">{shareQuery.data.shareUrl}</dd>
              <Button variant="secondary" onClick={() => onCopyShareUrl(shareQuery.data.shareUrl)}>
                {copied ? 'تم النسخ ✓' : 'نسخ الرابط'}
              </Button>
            </div>
          </dl>
          <div className="mt-4 flex flex-col items-start gap-2">
            <span className="text-sm font-medium text-slate-800">رمز QR للمشاركة:</span>
            <div dir="ltr" className="rounded-lg bg-white p-3" data-testid="share-qr-code">
              <QRCode value={shareQuery.data.shareUrl} size={160} />
            </div>
          </div>
        </section>
      ) : null}

      {/* Versions list */}
      <section aria-labelledby="versions-heading" className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="versions-heading" className="mb-3 text-base font-semibold text-slate-900">الإصدارات</h2>
        {versionsQuery.isLoading ? <p className="text-sm text-slate-500">جارٍ تحميل الإصدارات…</p> : null}
        {versionsQuery.isError ? (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">تعذر تحميل الإصدارات.</p>
        ) : null}
        {versionsQuery.data && versionsQuery.data.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد إصدارات بعد.</p>
        ) : null}
        {versionsQuery.data && versionsQuery.data.length > 0 ? (
          <ol className="flex flex-col gap-2">
            {versionsQuery.data.map((version: QuizVersionSummary) => (
              <li
                key={version.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">الإصدار v{version.versionNumber}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {version.itemCount} سؤال · {version.totalPoints} نقطة
                    {version.publishedAt
                      ? ` · نُشر ${new Date(version.publishedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                      : ''}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    version.status === 'Published'
                      ? 'bg-emerald-100 text-emerald-800'
                      : version.status === 'Retired'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-amber-100 text-amber-800'
                  }`}>
                  {QUIZ_VERSION_STATUS_LABELS[version.status] ?? version.status}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </div>
  );
}
