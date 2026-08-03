import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { MediaContentPreview } from '../../../features/questions/media-content-preview';
import { quizzesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import { QUESTION_TYPE_LABELS } from '../../../types/questions';
import { TIME_MODE_LABELS, type QuizDraftItem } from '../../../types/quizzes';

/** /dashboard/quizzes/:quizId/preview — معاينة المعلم للمسودة (لا تنشئ محاولة) */
export default function QuizPreviewPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const tenantId = getActiveTenantId();

  const previewQuery = useQuery({
    queryKey: ['quiz-preview', tenantId, quizId],
    queryFn: ({ signal }) => quizzesApi.getPreview(tenantId!, quizId!, signal),
    enabled: Boolean(tenantId && quizId),
    staleTime: 0,
  });

  if (!tenantId) {
    navigate('/onboarding/choose', { replace: true });
    return null;
  }

  if (previewQuery.isLoading) {
    return <p className="text-sm text-slate-500">جارٍ تحميل المعاينة…</p>;
  }

  if (previewQuery.isError || !previewQuery.data) {
    const error = previewQuery.error;
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {error instanceof HttpError && error.status === 404
            ? 'الاختبار غير موجود.'
            : error instanceof HttpError && error.status === 403
              ? 'ليس لديك صلاحية معاينة هذا الاختبار.'
              : 'تعذر تحميل المعاينة. أعد المحاولة.'}
        </p>
        <Link to="/dashboard/quizzes" className="text-sm text-sky-700 hover:underline">
          عودة لقائمة الاختبارات
        </Link>
      </div>
    );
  }

  const draft = previewQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">معاينة: {draft.title}</h1>
          <p className="text-sm text-slate-600">
            مسودة v{draft.versionNumber} · {draft.items.length} سؤال · {draft.totalPoints} نقطة
            {' · '}
            {TIME_MODE_LABELS[draft.timeMode] ?? draft.timeMode}
            {draft.timeLimitSeconds ? ` (${draft.timeLimitSeconds} ثانية)` : ''}
            {' · '}
            نسبة النجاح {draft.passingPercentage}%
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/dashboard/quizzes/${quizId}/edit`}
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600">
            تعديل
          </Link>
          <Link
            to={`/dashboard/quizzes/${quizId}/publish`}
            className="min-h-11 rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-sky-600">
            نشر
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-sky-300 bg-sky-50 p-4 text-sm text-sky-900">
        <p className="font-medium">معاينة للمعلم فقط</p>
        <p>هذه المعاينة لا تنشئ محاولة ولا تُسجَّل. تظهر الإجابات الصحيحة والشروحات هنا للمراجعة فقط.</p>
      </div>

      {draft.instructions ? (
        <section aria-labelledby="instructions-heading" className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 id="instructions-heading" className="mb-2 text-base font-semibold text-slate-900">تعليمات للطالب</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{draft.instructions}</p>
        </section>
      ) : null}

      {draft.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center text-sm text-slate-700">
          لا توجد أسئلة في هذه المسودة بعد.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {draft.items.map((item, index) => (
            <li key={item.id}>
              <QuizPreviewItem item={item} index={index} tenantId={tenantId} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function QuizPreviewItem({
  item,
  index,
  tenantId,
}: {
  item: QuizDraftItem;
  index: number;
  tenantId: string;
}) {
  const dir = item.language === 'en' ? 'ltr' : 'rtl';

  return (
    <article
      dir={dir}
      className="rounded-xl border border-slate-200 bg-white p-4"
      aria-label={`السؤال ${index + 1}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">
            {index + 1}. {item.prompt}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {QUESTION_TYPE_LABELS[item.questionType] ?? item.questionType}
            {' · '}
            {item.points} نقطة
            {item.isRequired ? ' · إجباري' : ' · اختياري'}
          </p>
        </div>
      </div>

      {/* Media */}
      {item.mediaAssetId ? (
        <div className="mb-3">
          <MediaContentPreview
            tenantId={tenantId}
            mediaId={item.mediaAssetId}
            kind={item.questionType === 'Listening' ? 'Audio' : 'Image'}
          />
        </div>
      ) : null}

      {/* Type-specific rendering */}
      {item.questionType === 'MultipleChoice' || item.questionType === 'TrueFalse' ? (
        <ul className="flex flex-col gap-2">
          {item.options.map((option) => (
            <li key={option.sortOrder} className="flex items-center gap-2">
              <input type="radio" disabled name={`preview-${item.id}`} className="h-4 w-4" />
              <span className="text-sm text-slate-700">{option.optionText}</span>
              {option.isCorrect ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  إجابة صحيحة
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {item.questionType === 'Ordering' ? (
        <ol className="flex flex-col gap-1">
          {item.options.map((option) => (
            <li key={option.sortOrder} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {option.sortOrder}. {option.optionText}
            </li>
          ))}
        </ol>
      ) : null}

      {item.questionType === 'ShortAnswer' ? (
        <input
          type="text"
          disabled
          placeholder="إجابة الطالب تظهر هنا…"
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-400"
        />
      ) : null}

      {item.questionType === 'Listening' ? (
        <p className="text-sm text-slate-500">سؤال استماع — يعتمد على المقطع الصوتي أعلاه.</p>
      ) : null}

      {/* Teacher-only: explanation */}
      {item.explanation ? (
        <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            الشرح (للمعلم فقط)
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.explanation}</p>
        </details>
      ) : null}
    </article>
  );
}
