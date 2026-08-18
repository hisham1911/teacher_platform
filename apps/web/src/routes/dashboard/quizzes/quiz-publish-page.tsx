import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
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
  type QuizDraft,
  type QuizPublicationState,
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

  const shareQuery = useQuery({
    queryKey: ['quiz-share', tenantId, quizId],
    queryFn: ({ signal }) => quizzesApi.getShare(tenantId!, quizId!, signal),
    enabled: Boolean(tenantId && quizId && draftQuery.data?.publicationState !== 'NeverPublished' && !publishResult),
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
        setConflictMessage('تم تعديل الاختبار في مكان آخر. حمّل أحدث التغييرات ثم حاول النشر مجددًا.');
        setPublishError(null);
      } else if (error instanceof HttpError && error.status === 403) {
        setPublishError('ليس لديك صلاحية نشر الاختبارات.');
        setConflictMessage(null);
      } else if (error instanceof HttpError) {
        const body = error.body as { detail?: string } | null;
        setPublishError(body?.detail ? `تعذر نشر الاختبار: ${body.detail}` : 'تعذر نشر الاختبار. راجع الجاهزية ثم حاول مرة أخرى.');
        setConflictMessage(null);
      } else {
        setPublishError('فشل النشر. تحقق من الاتصال ثم حاول مرة أخرى.');
        setConflictMessage(null);
      }
    },
  });

  if (!tenantId) return null;
  if (draftQuery.isLoading) return <p className="text-sm text-slate-600">جارٍ تحميل بيانات الاختبار…</p>;

  if (draftQuery.isError || !draftQuery.data) {
    const error = draftQuery.error;
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
          {error instanceof HttpError && error.status === 404
            ? 'الاختبار غير موجود.'
            : error instanceof HttpError && error.status === 403
              ? 'ليس لديك صلاحية عرض هذا الاختبار.'
              : 'تعذر تحميل البيانات. أعد المحاولة.'}
        </p>
        <Link to="/dashboard/quizzes" className="text-sm font-bold text-emerald-800 hover:underline">عودة لقائمة الاختبارات</Link>
      </div>
    );
  }

  const draft = draftQuery.data;
  const publicationState: QuizPublicationState = publishResult ? 'PublishedCurrent' : draft.publicationState;
  const shareUrl = publishResult?.shareUrl ?? shareQuery.data?.shareUrl ?? null;
  const readiness = getReadiness(draft);

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
            <h1 className="text-3xl font-black text-[var(--teacher-ink)]">نشر {draft.title}</h1>
            <p className="mt-2 text-base leading-7 text-[var(--teacher-muted)]">{draft.items.length} سؤال · {draft.totalPoints} نقطة · النجاح من {draft.passingPercentage}%</p>
          </div>
        </div>
      </header>

      {conflictMessage ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">{conflictMessage}</p>
          <Button variant="secondary" onClick={() => void draftQuery.refetch()}>إعادة التحميل</Button>
        </div>
      ) : null}
      {publishError ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm leading-6 text-rose-800">{publishError}</p> : null}

      <PublicationHero
        state={publicationState}
        quizId={quizId!}
        readiness={readiness}
        isPublishing={publishMutation.isPending}
        onPublish={() => publishMutation.mutate()}
      />

      {publicationState === 'PublishedCurrent' ? (
        <PublishedSharePanel
          heading="مشاركة الاختبار"
          shareUrl={shareUrl}
          copied={copied}
          onCopy={onCopyShareUrl}
          shareError={shareQuery.isError}
        />
      ) : null}

      {publicationState === 'PublishedWithChanges' ? (
        <PublishedSharePanel
          heading="النسخة المنشورة الحالية"
          shareUrl={shareUrl}
          copied={copied}
          onCopy={onCopyShareUrl}
          shareError={shareQuery.isError}
          sessionHref={`/dashboard/quizzes/${quizId}/sessions`}
        />
      ) : null}

      <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5">
        <Link to={`/dashboard/quizzes/${quizId}/survey`} className="inline-flex min-h-11 items-center text-sm font-bold text-slate-600 hover:text-emerald-800">إعداد استبيان الطلاب</Link>
        <Link to={`/dashboard/quizzes/${quizId}/edit`} className="inline-flex min-h-11 items-center text-sm font-bold text-slate-600 hover:text-emerald-800">تعديل الاختبار</Link>
      </div>

      {publicationState !== 'NeverPublished' ? <PublicationHistory query={versionsQuery} /> : null}
    </div>
  );
}

function PublicationHero({
  state,
  quizId,
  readiness,
  isPublishing,
  onPublish,
}: {
  state: QuizPublicationState;
  quizId: string;
  readiness: PublicationReadiness;
  isPublishing: boolean;
  onPublish: () => void;
}) {
  if (state === 'PublishedCurrent') {
    return (
      <section aria-labelledby="publication-state-heading" className="teacher-surface bg-emerald-50/70 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 font-black text-white">✓</span>
          <div>
            <h2 id="publication-state-heading" className="text-xl font-black text-emerald-950">الاختبار منشور ✓</h2>
            <p className="mt-1 max-w-2xl text-base leading-7 text-emerald-900">يمكنك الآن إنشاء جلسة ومشاركة رابط الحل مع الطلاب.</p>
          </div>
        </div>
        <Link to={`/dashboard/quizzes/${quizId}/sessions`} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-lg bg-[var(--teacher-primary)] px-6 text-sm font-black text-white hover:bg-[var(--teacher-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"><TeacherIcon name="play" />إنشاء جلسة للطلاب</Link>
      </section>
    );
  }

  const hasUnpublishedChanges = state === 'PublishedWithChanges';
  const heading = hasUnpublishedChanges
    ? 'لديك تعديلات جديدة لم تُنشر بعد'
    : readiness.isReady
      ? 'اختبارك جاهز للنشر'
      : 'أكمل الاختبار قبل النشر';
  const description = hasUnpublishedChanges
    ? 'الطلاب الذين يستخدمون النسخة المنشورة الحالية لن يروا هذه التعديلات حتى تنشرها.'
    : readiness.isReady
      ? 'راجع الأسئلة والإعدادات، ثم انشر الاختبار لتتمكن من إنشاء جلسة للطلاب.'
      : 'صحح النقاط التالية، ثم عُد لنشر الاختبار.';
  const publishLabel = hasUnpublishedChanges ? 'نشر التحديثات' : 'نشر الاختبار';
  const previewLabel = hasUnpublishedChanges ? 'معاينة التعديلات' : 'معاينة';
  const stateIcon = hasUnpublishedChanges ? '!' : readiness.isReady ? '✓' : '!';
  const stateIconClass = hasUnpublishedChanges || !readiness.isReady
    ? 'bg-amber-200 text-amber-950'
    : 'bg-emerald-700 text-white';

  return (
    <section aria-labelledby="publication-state-heading" className={`teacher-surface p-5 sm:p-6 ${hasUnpublishedChanges ? 'bg-amber-50/70' : 'bg-white'}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black ${stateIconClass}`}>{stateIcon}</span>
        <div>
          <h2 id="publication-state-heading" className="text-xl font-black text-slate-950">{heading}</h2>
          <p className="mt-1 max-w-2xl text-base leading-7 text-slate-700">{description}</p>
        </div>
      </div>
      {!readiness.isReady ? <ReadinessIssues readiness={readiness} /> : null}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={onPublish} disabled={!readiness.isReady || isPublishing} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--teacher-primary)] px-6 text-sm font-black text-white hover:bg-[var(--teacher-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
          {isPublishing ? <ButtonSpinner /> : <TeacherIcon name="publish" />}
          {isPublishing ? 'جارٍ النشر…' : publishLabel}
        </button>
        <Link to={`/dashboard/quizzes/${quizId}/preview`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"><TeacherIcon name="preview" />{previewLabel}</Link>
      </div>
    </section>
  );
}

function PublishedSharePanel({
  heading,
  shareUrl,
  copied,
  onCopy,
  shareError,
  sessionHref,
}: {
  heading: string;
  shareUrl: string | null;
  copied: boolean;
  onCopy: (url: string) => Promise<void>;
  shareError: boolean;
  sessionHref?: string;
}) {
  return (
    <section aria-labelledby="published-share-heading" className="border-t border-slate-200 pt-5">
      <h2 id="published-share-heading" className="text-lg font-black text-slate-900">{heading}</h2>
      {sessionHref ? <Link to={sessionHref} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-800">إنشاء جلسة باستخدام النسخة المنشورة</Link> : null}
      {shareError ? <p role="alert" className="mt-3 text-sm text-rose-800">تعذر تحميل رابط الاختبار المنشور.</p> : null}
      {shareUrl ? (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p dir="ltr" className="break-all text-sm text-slate-600">{shareUrl}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <a href={shareUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-800">فتح صفحة تعريف الاختبار</a>
              <Button variant="secondary" onClick={() => void onCopy(shareUrl)}>{copied ? 'تم نسخ الرابط ✓' : 'نسخ الرابط'}</Button>
            </div>
          </div>
          <div dir="ltr" className="w-fit rounded-lg bg-white p-2" data-testid="share-qr-code"><QRCode value={shareUrl} size={112} /></div>
        </div>
      ) : null}
    </section>
  );
}

interface PublicationReadiness {
  isReady: boolean;
  hasItems: boolean;
  hasArchivedSource: boolean;
  hasTimeLimitWhenNeeded: boolean;
}

function getReadiness(draft: QuizDraft): PublicationReadiness {
  const hasItems = draft.items.length > 0;
  const hasArchivedSource = draft.items.some((item) => item.sourceQuestionArchived);
  const hasTimeLimitWhenNeeded = draft.timeMode === 'None' || (draft.timeLimitSeconds != null && draft.timeLimitSeconds > 0);
  return { isReady: hasItems && !hasArchivedSource && hasTimeLimitWhenNeeded, hasItems, hasArchivedSource, hasTimeLimitWhenNeeded };
}

function ReadinessIssues({ readiness }: { readiness: PublicationReadiness }) {
  return (
    <ul className="mt-4 space-y-2 text-sm font-semibold text-rose-800">
      {!readiness.hasItems ? <li>أضف سؤالًا واحدًا على الأقل.</li> : null}
      {readiness.hasArchivedSource ? <li>استبدل الأسئلة التي أصبح مصدرها مؤرشفًا.</li> : null}
      {!readiness.hasTimeLimitWhenNeeded ? <li>حدد مدة صالحة للاختبار.</li> : null}
    </ul>
  );
}

function PublicationHistory({ query }: { query: UseQueryResult<QuizVersionSummary[]> }) {
  const publishedVersions = query.data?.filter((version) => version.status !== 'Draft') ?? [];
  return (
    <details className="teacher-surface p-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-base font-black text-slate-900 marker:content-none">سجل النشر<span aria-hidden="true" className="text-slate-400">⌄</span></summary>
      <div className="mt-4 border-t border-slate-100 pt-4">
        {query.isLoading ? <p className="text-sm text-slate-600">جارٍ تحميل سجل النشر…</p> : null}
        {query.isError ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">تعذر تحميل سجل النشر.</p> : null}
        {publishedVersions.length > 0 ? (
          <ol className="divide-y divide-slate-100">
            {publishedVersions.map((version) => (
              <li key={version.id} className="flex items-center justify-between gap-3 py-3">
                <div><p className="text-sm font-bold text-slate-900">{version.itemCount} سؤال · {version.totalPoints} نقطة</p><p className="mt-1 text-xs text-slate-600">{version.publishedAt ? `نُشر ${new Date(version.publishedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}` : null}</p></div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${version.status === 'Published' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{QUIZ_VERSION_STATUS_LABELS[version.status]}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </details>
  );
}
