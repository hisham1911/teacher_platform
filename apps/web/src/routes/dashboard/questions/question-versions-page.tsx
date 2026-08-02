import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { questionsApi } from '../../../data/api-client/endpoints';
import { getActiveTenantId } from '../../../lib/auth/session';
import { QUESTION_TYPE_LABELS, type QuestionType } from '../../../types/questions';

/** /dashboard/questions/:questionId/versions — سجل الإصدارات Immutable */
export default function QuestionVersionsPage() {
  const navigate = useNavigate();
  const tenantId = getActiveTenantId();
  const { questionId } = useParams<{ questionId: string }>();

  const { data: question } = useQuery({
    queryKey: ['question', tenantId, questionId],
    queryFn: ({ signal }) => questionsApi.get(tenantId!, questionId!, signal),
    enabled: Boolean(tenantId && questionId),
  });

  const { data: versions, isLoading, isError } = useQuery({
    queryKey: ['question-versions', tenantId, questionId],
    queryFn: ({ signal }) => questionsApi.listVersions(tenantId!, questionId!, signal),
    enabled: Boolean(tenantId && questionId),
  });

  if (!tenantId || !questionId) {
    navigate('/onboarding/choose', { replace: true });
    return null;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            سجل الإصدارات — {question?.currentVersion.prompt.slice(0, 60) ?? '…'}
          </h1>
          <p className="text-sm text-slate-600">
            كل نسخة Immutable بمجرد إنشائها. التعديل الحالي ينتج نسخة جديدة — القديمة لا تُحذف أبدًا.
          </p>
        </div>
        <Link
          to={`/dashboard/questions/${questionId}/preview`}
          className="min-h-11 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
          معاينة الحالية
        </Link>
      </header>

      {isLoading ? <p className="text-sm text-slate-500">جارٍ تحميل الإصدارات…</p> : null}
      {isError ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          تعذر تحميل الإصدارات.
        </p>
      ) : null}

      <ol className="flex flex-col gap-2" aria-label="نسخ السؤال">
        {(versions ?? []).map((version) => (
          <li key={version.id}>
            <Link
              to={`/dashboard/questions/${questionId}/preview?version=${version.versionNumber}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600">
              <div>
                <p className="text-sm font-semibold text-slate-900">الإصدار v{version.versionNumber}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {QUESTION_TYPE_LABELS[version.questionType as QuestionType] ?? version.questionType}
                  {' · '}
                  {new Date(version.createdAt).toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  version.isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                {version.isValid ? 'صالح' : 'غير صالح'}
              </span>
            </Link>
          </li>
        ))}
      </ol>

      {(versions ?? []).length === 0 && !isLoading && !isError ? (
        <p className="text-sm text-slate-500">لا توجد إصدارات بعد.</p>
      ) : null}
    </div>
  );
}
