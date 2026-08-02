import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { HttpError } from '../../../data/api-client/http-error';
import { questionsApi } from '../../../data/api-client/endpoints';
import { getActiveTenantId } from '../../../lib/auth/session';
import type { QuestionOptionInput } from '../../../types/questions';
import { QuestionForm, type QuestionFormValue } from '../../../features/questions/question-form';
import type { CreateQuestionVersionRequest } from '../../../types/questions';

/** /dashboard/questions/:questionId/edit — تعديل المحتوى = إصدار جديد Immutable */
export default function QuestionEditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();
  const { questionId } = useParams<{ questionId: string }>();

  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [invalidDetail, setInvalidDetail] = useState<string | null>(null);

  const {
    data: question,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['question', tenantId, questionId],
    queryFn: ({ signal }) => questionsApi.get(tenantId!, questionId!, signal),
    enabled: Boolean(tenantId && questionId),
    staleTime: 0,
  });

  const versionMutation = useMutation({
    mutationFn: (payload: CreateQuestionVersionRequest) =>
      questionsApi.createNewVersion(tenantId!, questionId!, payload),
    onSuccess: async (updated) => {
      setConflictMessage(null);
      setApiError(null);
      setInvalidDetail(null);
      await queryClient.invalidateQueries({ queryKey: ['questions', tenantId] });
      await queryClient.invalidateQueries({ queryKey: ['question', tenantId, questionId] });
      await queryClient.invalidateQueries({ queryKey: ['question-versions', tenantId, questionId] });
      navigate(`/dashboard/questions/${updated.id}/preview`, { replace: true });
    },
    onError: (error) => {
      if (error instanceof HttpError) {
        if (error.status === 409) {
          setConflictMessage(
            'تم تعديل هذا السؤال بواسطة شخص آخر أثناء تحريرك. لم يُحفظ تعديلك على النسخة القديمة. حدّث الصفحة لتحميل أحدث نسخة ثم أعد إدخال تعديلاتك.',
          );
        } else if (error.status === 400) {
          const body = error.body as { title?: string; detail?: string } | null;
          if (body?.title === 'QuestionInvalid' && body.detail) {
            setInvalidDetail(`السؤال غير صالح: ${body.detail}`);
          } else {
            setInvalidDetail(body?.detail ?? 'المدخلات غير صالحة.');
          }
        } else if (error.status === 403) {
          setApiError('ليس لديك صلاحية تعديل الأسئلة (يلزم دور مالك أو معلم).');
        } else {
          setApiError('تعذر الحفظ. أعد المحاولة.');
        }
      } else {
        setApiError('تعذر الحفظ. أعد المحاولة.');
      }
    },
  });

  if (!tenantId || !questionId) {
    navigate('/onboarding/choose', { replace: true });
    return null;
  }

  if (question?.status === 'Archived') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        هذا السؤال مؤرشف ولا يقبل التعديل. يمكنك الرجوع إلى{' '}
        <Link to="/dashboard/questions" className="underline">
          قائمة الأسئلة
        </Link>
        .
      </div>
    );
  }

  function submit(value: QuestionFormValue) {
    if (!question) {
      return;
    }
    setConflictMessage(null);
    setApiError(null);
    setInvalidDetail(null);

    const payload: CreateQuestionVersionRequest = {
      prompt: value.prompt,
      explanation: value.explanation,
      difficulty: value.difficulty,
      language: value.language,
      mediaAssetId: value.mediaAssetId,
      tags: value.tags,
      options: value.options,
      acceptedAnswers: value.acceptedAnswers.length > 0 ? value.acceptedAnswers : undefined,
      baseVersion: question.version,
    };

    versionMutation.mutate(payload);
  }

  const initial = question
    ? {
        questionType: question.currentVersion.questionType,
        prompt: question.currentVersion.prompt,
        explanation: question.currentVersion.explanation,
        difficulty: question.currentVersion.difficulty,
        language: question.currentVersion.language,
        mediaAssetId: question.currentVersion.mediaAssetId,
        tags: question.tags,
        options: mapInitialOptions(question.currentVersion),
        acceptedAnswers: parseAcceptedAnswers(question.currentVersion.configJson),
      }
    : undefined;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            تعديل السؤال — إنشاء نسخة v{(question?.currentVersionNumber ?? 0) + 1}
          </h1>
          <p className="text-sm text-slate-600">
            النسخة الحالية (v{question?.currentVersionNumber}) تبقى Immutable؛ الحفظ ينتج نسخة جديدة.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/dashboard/questions/${questionId}/versions`}
            className="min-h-11 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            الإصدارات
          </Link>
          <Link
            to={`/dashboard/questions/${questionId}/preview`}
            className="min-h-11 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            معاينة
          </Link>
        </div>
      </header>

      {conflictMessage ? (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">تعارض تعديل متزامن (409)</p>
          <p className="mt-1">{conflictMessage}</p>
          <Button
            variant="secondary"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ['question', tenantId, questionId] })}>
            تحميل أحدث نسخة
          </Button>
        </div>
      ) : null}

      {invalidDetail ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {invalidDetail}
        </p>
      ) : null}

      {apiError ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {apiError}
        </p>
      ) : null}

      {isLoading ? <p className="text-sm text-slate-500">جارٍ تحميل أحدث نسخة للتحرير…</p> : null}
      {isError ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          تعذر تحميل السؤال. ربما تغيّر أو تم أرشفته أو ليس لديك وصول.
        </p>
      ) : null}

      {initial ? (
        <QuestionForm
          tenantId={tenantId}
          initialValue={initial}
          typeLocked
          submitLabel={`حفظ كنسخة v${question!.currentVersionNumber + 1}`}
          isPending={versionMutation.isPending}
          onSubmit={submit}
        />
      ) : null}
    </div>
  );
}

function mapInitialOptions(version: { questionType: string; options: Array<{ optionText: string; isCorrect: boolean; sortOrder: number }> }): QuestionOptionInput[] {
  return version.options
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((o) => ({ text: o.optionText, isCorrect: o.isCorrect }));
}

function parseAcceptedAnswers(configJson: string): string[] {
  try {
    const parsed = JSON.parse(configJson) as { acceptedAnswers?: unknown };
    if (Array.isArray(parsed.acceptedAnswers)) {
      return parsed.acceptedAnswers.filter((v): v is string => typeof v === 'string');
    }
  } catch {
    // ignore
  }
  return [];
}
