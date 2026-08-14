import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { publicQuizApi } from '../../data/api-client/endpoints';
import { HttpError } from '../../data/api-client/http-error';
import { TIME_MODE_LABELS } from '../../types/quizzes';

/**
 * صفحة الهبوط العامة للاختبار المنشور (/q/:publicCode).
 *
 * تعرض بيانات تعريفية فقط (metadata) — بدون أسئلة أو خيارات أو إجابات.
 * رابط الحل الفعلي يصدر من جلسة ينشئها المعلم.
 */
export default function PublicQuizPage() {
  const { publicCode } = useParams<{ publicCode: string }>();

  const query = useQuery({
    queryKey: ['public-quiz', publicCode],
    queryFn: ({ signal }) => publicQuizApi.getByCode(publicCode ?? '', signal),
    enabled: Boolean(publicCode),
    retry: false,
  });

  if (!publicCode) {
    return (
      <section className="mx-auto max-w-2xl space-y-4 p-6">
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          رابط الاختبار غير صالح.
        </p>
      </section>
    );
  }

  if (query.isPending) {
    return (
      <section className="mx-auto max-w-2xl space-y-4 p-6">
        <p className="text-slate-500">جارٍ تحميل بيانات الاختبار…</p>
      </section>
    );
  }

  if (query.isError) {
    const error = query.error;
    const notFound = error instanceof HttpError && error.status === 404;
    return (
      <section className="mx-auto max-w-2xl space-y-4 p-6">
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {notFound
            ? 'الاختبار غير موجود أو الرابط غير صالح.'
            : 'تعذر تحميل بيانات الاختبار. حاول مرة أخرى لاحقًا.'}
        </p>
      </section>
    );
  }

  const quiz = query.data;
  const theme = quiz.theme;

  if (!quiz.available) {
    return (
      <section
        className="mx-auto max-w-2xl space-y-4 rounded-xl p-6"
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <h1 className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
          {quiz.title}
        </h1>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          هذا الاختبار غير متاح حاليًا.
        </p>
      </section>
    );
  }

  return (
    <section
      className="mx-auto max-w-2xl space-y-6 rounded-xl p-6"
      style={{ backgroundColor: theme.backgroundColor }}
    >
      <header className="space-y-2">
        <h1 className="text-2xl font-bold" style={{ color: theme.primaryColor }}>
          {quiz.title}
        </h1>
        {quiz.description ? (
          <p className="text-slate-700">{quiz.description}</p>
        ) : null}
      </header>

      {quiz.instructions ? (
        <div className="rounded-lg border border-slate-200 bg-white/70 p-4">
          <h2 className="mb-2 text-sm font-semibold" style={{ color: theme.secondaryColor }}>
            التعليمات
          </h2>
          <p className="whitespace-pre-line text-slate-700">{quiz.instructions}</p>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white/70 p-4 text-sm">
        <dt className="text-slate-500">عدد الأسئلة</dt>
        <dd className="font-medium">{quiz.questionCount}</dd>

        <dt className="text-slate-500">إجمالي الدرجات</dt>
        <dd className="font-medium">{quiz.totalPoints}</dd>

        <dt className="text-slate-500">نسبة النجاح</dt>
        <dd className="font-medium">{quiz.passingPercentage}%</dd>

        <dt className="text-slate-500">الوقت</dt>
        <dd className="font-medium">
          {TIME_MODE_LABELS[quiz.timeMode]}
          {quiz.timeLimitSeconds != null
            ? ` (${Math.round(quiz.timeLimitSeconds / 60)} دقيقة)`
            : ''}
        </dd>
      </dl>

      <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        هذه صفحة تعريفية بالاختبار وليست صفحة الحل. استخدم رابط الجلسة أو رمز الانضمام الذي
        أرسله لك المعلم لبدء الإجابة.
      </p>
    </section>
  );
}
