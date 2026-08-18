import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import QRCode from 'react-qr-code';
import { Button } from '../../../components/ui/button';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { TeacherIcon } from '../../../components/ui/teacher-icon';
import { quizzesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import {
  QUIZ_VERSION_STATUS_LABELS,
  type PublishQuizResponse,
  type QuizVersionSummary,
} from '../../../types/quizzes';

export default function QuizPublishPage() {
  const { quizId } = useParams<{ quizId: string }>();
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
        setConflictMessage('تم تعديل الاختبار في مكان آخر. حمّل أحدث نسخة ثم حاول النشر مجددًا.');
        setPublishError(null);
      } else if (error instanceof HttpError && error.status === 403) {
        setPublishError('ليس لديك صلاحية نشر الاختبارات (يلزم دور مالك أو معلم).');
        setConflictMessage(null);
      } else if (error instanceof HttpError) {
        const body = error.body as { title?: string; detail?: string } | null;
        setPublishError(
          body?.detail
            ? `تعذر نشر الاختبار: ${body.detail}`
            : 'تعذر نشر الاختبار. راجع الجاهزية ثم حاول مرة أخرى.',
        );
        setConflictMessage(null);
      } else {
        setPublishError('فشل النشر. تحقق من الاتصال.');
        setConflictMessage(null);
      }
    },
  });

  if (!tenantId) {
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
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <Link to={`/dashboard/quizzes/${quizId}/edit`} className="inline-flex min-h-11 items-center text-sm font-bold text-slate-600 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">العودة إلى منشئ الاختبار →</Link>
        <div className="mt-4 flex items-start gap-4">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--teacher-primary-soft)] text-[var(--teacher-primary-strong)]"><TeacherIcon name="publish" className="h-6 w-6" /></span>
          <div>
            <p className="text-sm font-bold text-[var(--teacher-primary-strong)]">الخطوة الأخيرة</p>
            <h1 className="mt-1 text-3xl font-black text-[var(--teacher-ink)]">مراجعة ونشر {draft.title}</h1>
            <p className="mt-2 text-base leading-7 text-[var(--teacher-muted)]">{draft.items.length} سؤال · {draft.totalPoints} نقطة · النجاح من {draft.passingPercentage}%</p>
          </div>
        </div>
      </header>

      {conflictMessage ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">{conflictMessage}</p>
          <Button variant="secondary" onClick={() => void draftQuery.refetch()}>
            إعادة التحميل
          </Button>
        </div>
      ) : null}

      {publishError ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm leading-6 text-rose-800">{publishError}</p>
      ) : null}

      {!publishResult ? (
        <section aria-labelledby="readiness-heading" className={`teacher-surface p-5 sm:p-6 ${allReady ? 'bg-emerald-50/60' : 'bg-white'}`}>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${allReady ? 'bg-emerald-700 text-white' : 'bg-amber-100 text-amber-900'}`}>{allReady ? '✓' : '!'}</span>
            <div>
              <h2 id="readiness-heading" className="text-xl font-black text-slate-900">{allReady ? 'الاختبار جاهز للنشر' : 'أكمل الاختبار قبل النشر'}</h2>
              <p className="mt-1 text-base leading-7 text-slate-600">{allReady ? 'راجع الملخص ثم انشر. يمكنك متابعة التعديل لاحقًا.' : 'صحح النقاط التالية ثم عُد إلى هذه الصفحة.'}</p>
            </div>
          </div>
          {!allReady ? (
            <ul className="mt-4 space-y-2 text-sm font-semibold text-rose-800">
              {!hasItems ? <li>أضف سؤالًا واحدًا على الأقل.</li> : null}
              {hasArchivedSource ? <li>استبدل الأسئلة التي أصبح مصدرها مؤرشفًا.</li> : null}
              {!hasTimeLimitWhenNeeded ? <li>حدد مدة صالحة للاختبار.</li> : null}
            </ul>
          ) : null}
          <button type="button" onClick={() => publishMutation.mutate()} disabled={!allReady || publishMutation.isPending} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--teacher-primary)] px-6 text-sm font-black text-white hover:bg-[var(--teacher-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
            {publishMutation.isPending ? <ButtonSpinner /> : <TeacherIcon name="publish" />}
            {publishMutation.isPending ? 'جارٍ نشر الاختبار…' : 'نشر الاختبار'}
          </button>
        </section>
      ) : null}

      {publishResult ? (
        <section aria-labelledby="success-heading" className="teacher-surface overflow-hidden">
          <div className="bg-emerald-50 px-5 py-6 sm:px-6">
            <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-700 text-xl font-black text-white">✓</span>
            <h2 id="success-heading" className="mt-4 text-2xl font-black text-emerald-950">تم نشر الاختبار</h2>
            <p className="mt-2 text-base text-emerald-900">الخطوة التالية: أنشئ جلسة للطلاب واختر طريقة التشغيل.</p>
            <Link to={`/dashboard/quizzes/${quizId}/sessions`} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-lg bg-[var(--teacher-primary)] px-6 text-sm font-black text-white hover:bg-[var(--teacher-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"><TeacherIcon name="play" />إنشاء جلسة للطلاب</Link>
          </div>
          <div className="grid gap-5 px-5 py-5 sm:grid-cols-[1fr_auto] sm:px-6">
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900">صفحة تعريف الاختبار</p>
              <p dir="ltr" className="mt-2 break-all text-sm text-slate-600">{publishResult.shareUrl}</p>
              <Button variant="secondary" onClick={() => onCopyShareUrl(publishResult.shareUrl)}>{copied ? 'تم النسخ ✓' : 'نسخ الصفحة التعريفية'}</Button>
            </div>
            <div dir="ltr" className="w-fit rounded-lg bg-white p-2" data-testid="share-qr-code"><QRCode value={publishResult.shareUrl} size={120} /></div>
          </div>
        </section>
      ) : null}

      {!publishResult && shareQuery.data ? (
        <section aria-labelledby="share-heading" className="teacher-surface p-5">
          <h2 id="share-heading" className="text-lg font-black text-slate-900">هذا الاختبار منشور بالفعل</h2>
          <p className="mt-1 text-base leading-7 text-slate-600">أنشئ جلسة للحصول على رابط الحل ورمز الانضمام، أو انسخ صفحة التعريف الحالية.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <p dir="ltr" className="break-all text-sm text-slate-600">{shareQuery.data.shareUrl}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Link to={`/dashboard/quizzes/${quizId}/sessions`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--teacher-primary)] px-5 text-sm font-black text-white hover:bg-[var(--teacher-primary-strong)]">إنشاء جلسة للطلاب</Link>
                <Button variant="secondary" onClick={() => onCopyShareUrl(shareQuery.data.shareUrl)}>{copied ? 'تم النسخ ✓' : 'نسخ صفحة التعريف'}</Button>
              </div>
            </div>
            <div dir="ltr" className="w-fit rounded-lg bg-white p-2" data-testid="share-qr-code"><QRCode value={shareQuery.data.shareUrl} size={120} /></div>
          </div>
        </section>
      ) : null}

      <div className="flex justify-between gap-3 border-t border-slate-200 pt-5">
        <Link to={`/dashboard/quizzes/${quizId}/survey`} className="inline-flex min-h-11 items-center text-sm font-bold text-slate-600 hover:text-emerald-800">إعداد استبيان الطلاب</Link>
        <Link to={`/dashboard/quizzes/${quizId}/edit`} className="inline-flex min-h-11 items-center text-sm font-bold text-slate-600 hover:text-emerald-800">تعديل الاختبار</Link>
      </div>

      <details className="teacher-surface p-4">
        <summary id="versions-heading" className="flex min-h-11 cursor-pointer list-none items-center justify-between text-base font-black text-slate-900 marker:content-none">سجل النشر<span aria-hidden="true" className="text-slate-400">⌄</span></summary>
        <div className="mt-4 border-t border-slate-100 pt-4">
          {versionsQuery.isLoading ? <p className="text-sm text-slate-600">جارٍ تحميل سجل النشر…</p> : null}
          {versionsQuery.isError ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">تعذر تحميل سجل النشر.</p> : null}
          {versionsQuery.data && versionsQuery.data.length === 0 ? <p className="text-sm text-slate-600">لم يُنشر الاختبار بعد.</p> : null}
          {versionsQuery.data && versionsQuery.data.length > 0 ? (
            <ol className="divide-y divide-slate-100">
              {versionsQuery.data.map((version: QuizVersionSummary) => (
                <li key={version.id} className="flex items-center justify-between gap-3 py-3">
                  <div><p className="text-sm font-bold text-slate-900">{version.itemCount} سؤال · {version.totalPoints} نقطة</p><p className="mt-1 text-xs text-slate-600">{version.publishedAt ? `نُشر ${new Date(version.publishedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}` : 'تعديلات لم تُنشر بعد'}</p></div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${version.status === 'Published' ? 'bg-emerald-100 text-emerald-800' : version.status === 'Retired' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-900'}`}>{QUIZ_VERSION_STATUS_LABELS[version.status]}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </details>
    </div>
  );
}
