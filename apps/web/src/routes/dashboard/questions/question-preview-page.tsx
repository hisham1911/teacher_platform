import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { questionsApi } from '../../../data/api-client/endpoints';
import { MediaContentPreview } from '../../../features/questions/media-content-preview';
import { getActiveTenantId } from '../../../lib/auth/session';

/** /dashboard/questions/:questionId/preview — معاينة المعلم للنسخة الحالية */
export default function QuestionPreviewPage() {
  const navigate = useNavigate();
  const tenantId = getActiveTenantId();
  const { questionId } = useParams<{ questionId: string }>();

  const { data: question, isLoading, isError } = useQuery({
    queryKey: ['question', tenantId, questionId],
    queryFn: ({ signal }) => questionsApi.get(tenantId!, questionId!, signal),
    enabled: Boolean(tenantId && questionId),
    staleTime: 30_000,
  });

  const mediaAssetId = question?.currentVersion.mediaAssetId ?? null;

  if (!tenantId || !questionId) {
    navigate('/onboarding/choose', { replace: true });
    return null;
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">جارٍ تحميل المعاينة…</p>;
  }

  if (isError || !question) {
    return (
      <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
        تعذر تحميل المعاينة. ربما ليس لديك وصول أو السؤال ليس موجودًا.
      </p>
    );
  }

  const version = question.currentVersion;
  const isListening = version.questionType === 'Listening';
  const isOrdering = version.questionType === 'Ordering';
  const isShortAnswer = version.questionType === 'ShortAnswer';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            معاينة المعلم — v{version.versionNumber}
          </h1>
          <p className="text-sm text-slate-600">
            ما يراه الطالب بالضبط (بدون كشف الصحة هنا — التصحيح في السيرفر لاحقًا).
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/dashboard/questions/${questionId}/versions`}
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            سجل الإصدارات
          </Link>
          <Link
            to={`/dashboard/questions/${questionId}/edit`}
            className="min-h-11 rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700">
            تعديل
          </Link>
        </div>
      </header>

      {!version.isValid ? (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          تحذير: هذه النسخة لا تجتاز تحقق المجال ({version.validationErrors.join('، ')}). لا تصلح للنشر بعد.
        </p>
      ) : null}

      <article className="rounded-2xl border border-slate-200 bg-white p-6" dir={version.language === 'en' ? 'ltr' : 'rtl'}>
        {isListening ? (
          <figure className="mb-4">
            <figcaption className="mb-2 text-sm text-slate-600">استمع ثم أجب:</figcaption>
            {mediaAssetId ? (
              <MediaContentPreview tenantId={tenantId} mediaId={mediaAssetId} kind="Audio" />
            ) : (
              <p className="text-sm text-rose-600">لا يوجد ملف صوتي مرفوع لهذا السؤال.</p>
            )}
          </figure>
        ) : null}

        {!isListening && mediaAssetId ? (
          <div className="mb-4">
            <MediaContentPreview tenantId={tenantId} mediaId={mediaAssetId} kind="Image" />
          </div>
        ) : null}

        <h2 className="mb-4 text-lg font-medium text-slate-900" dir={version.language === 'en' ? 'ltr' : 'rtl'}>
          {version.prompt}
        </h2>

        {!isShortAnswer && !isOrdering ? (
          <ul className="flex flex-col gap-2" role="group" aria-label="اختيارات السؤال">
            {version.options
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((option) => (
                <li key={option.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-300 px-4 py-3">
                    <input type="radio" name="preview-answer" disabled className="h-5 w-5 accent-sky-600" />
                    <span className="text-sm text-slate-800">{option.optionText}</span>
                  </label>
                </li>
              ))}
          </ul>
        ) : null}

        {isOrdering ? (
          <ol className="flex list-decimal flex-col gap-2 pr-6" aria-label="ترتيب العناصر الصحيح">
            {version.options
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((option) => (
                <li key={option.id} className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-800">
                  {option.optionText}
                </li>
              ))}
          </ol>
        ) : null}

        {isShortAnswer ? (
          <div>
            <input
              type="text"
              disabled
              placeholder="اكتب إجابتك هنا…"
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm"
              dir={version.language === 'en' ? 'ltr' : 'rtl'}
            />
            <p className="mt-1 text-xs text-slate-500">التصحيح النصي يحدث في الخادم — لا يكشف المعاينة الإجابة المقبولة.</p>
          </div>
        ) : null}

        {version.explanation ? (
          <details className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
            <summary className="cursor-pointer font-medium">تفسير الإجابة (يظهر للطالب بعد التصحيح)</summary>
            <p className="mt-2 text-slate-700">{version.explanation}</p>
          </details>
        ) : null}
      </article>

      <p className="text-xs text-slate-500">
        صحّة الاختيارات تُخفى عن المعاينة عمدًا — تُعرض للمعلم فقط من مسارات التحرير، وللطالب بعد إرسال الإجابة في Phase 4.
      </p>
    </div>
  );
}
