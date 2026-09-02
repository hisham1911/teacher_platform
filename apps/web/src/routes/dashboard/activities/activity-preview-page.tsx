import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { MediaContentPreview } from '../../../features/questions/media-content-preview';
import { quizzesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import { QUESTION_TYPE_LABELS } from '../../../types/questions';
import { TIME_MODE_LABELS, type QuizDraftItem } from '../../../types/quizzes';

export default function ActivityPreviewPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const tenantId = getActiveTenantId();

  const previewQuery = useQuery({
    queryKey: ['quiz-preview', tenantId, quizId],
    queryFn: ({ signal }) => quizzesApi.getPreview(tenantId!, quizId!, signal),
    enabled: Boolean(tenantId && quizId),
    staleTime: 0,
  });

  if (!tenantId) return null;
  if (previewQuery.isLoading) return <p role="status" className="text-sm text-slate-500">جارٍ تحميل المعاينة…</p>;
  if (previewQuery.isError || !previewQuery.data) {
    const error = previewQuery.error;
    return <div className="flex flex-col gap-4"><p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error instanceof HttpError && error.status === 404 ? 'النشاط غير موجود.' : error instanceof HttpError && error.status === 403 ? 'ليس لديك صلاحية معاينة هذا النشاط.' : 'تعذر تحميل المعاينة. أعد المحاولة.'}</p><Link to="/dashboard/quizzes" className="inline-flex min-h-11 items-center text-sm font-black text-violet-700 hover:underline">عودة إلى الأنشطة</Link></div>;
  }

  const draft = previewQuery.data;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><Link to={`/dashboard/activities/${quizId}/manage`} className="inline-flex min-h-11 items-center text-sm font-black text-slate-500 hover:text-violet-800">→ إدارة النشاط</Link><p className="mt-2 text-xs font-black tracking-[0.14em] text-violet-700">معاينة المعلم</p><h1 dir="auto" className="mt-1 text-2xl font-black text-slate-950">{draft.title}</h1><p className="mt-2 text-sm text-slate-600">{draft.items.length} سؤال · {draft.totalPoints} نقطة · {TIME_MODE_LABELS[draft.timeMode] ?? draft.timeMode}{draft.timeLimitSeconds ? ` (${draft.timeLimitSeconds} ثانية)` : ''} · النجاح {draft.passingPercentage}%</p></div>
        <div className="flex flex-wrap gap-2"><Link to={`/dashboard/activities/${quizId}/build?mode=SelfPaced&editOnly=1`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:border-violet-300 hover:text-violet-800">تعديل المحتوى</Link><Link to={`/dashboard/activities/${quizId}/manage#deliver-activity`} className="inline-flex min-h-11 items-center rounded-xl bg-violet-700 px-4 text-sm font-black text-white hover:bg-violet-800">اختيار طريقة الوصول</Link></div>
      </header>

      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-7 text-violet-950"><p className="font-black">هذه معاينة للمراجعة فقط</p><p>لا تُسجل محاولة ولا نتيجة. تظهر الإجابات الصحيحة والشروحات هنا حتى تراجع المحتوى قبل إرساله للطلاب.</p></div>

      {draft.instructions ? <section aria-labelledby="instructions-heading" className="rounded-xl border border-slate-200 bg-white p-4"><h2 id="instructions-heading" className="mb-2 text-base font-black text-slate-900">تعليمات الطالب</h2><p className="whitespace-pre-wrap text-sm text-slate-700">{draft.instructions}</p></section> : null}

      {draft.items.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center text-sm text-slate-700">لا توجد أسئلة في النشاط بعد.</p> : <ol className="flex flex-col gap-4">{draft.items.map((item, index) => <li key={item.id}><ActivityPreviewItem item={item} index={index} tenantId={tenantId} /></li>)}</ol>}
    </div>
  );
}

function ActivityPreviewItem({ item, index, tenantId }: { item: QuizDraftItem; index: number; tenantId: string }) {
  const dir = item.language === 'en' ? 'ltr' : 'rtl';
  return (
    <article dir={dir} className="rounded-xl border border-slate-200 bg-white p-4" aria-label={`السؤال ${index + 1}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-black text-slate-900">{index + 1}. {item.prompt}</p><p className="mt-1 text-xs text-slate-500">{QUESTION_TYPE_LABELS[item.questionType] ?? item.questionType} · {item.points} نقطة{item.isRequired ? ' · مطلوب' : ' · اختياري'}</p></div></div>
      {item.mediaAssetId ? <div className="mb-3"><MediaContentPreview tenantId={tenantId} mediaId={item.mediaAssetId} kind={item.questionType === 'Listening' ? 'Audio' : 'Image'} /></div> : null}
      {item.questionType === 'MultipleChoice' || item.questionType === 'TrueFalse' ? <ul className="flex flex-col gap-2">{item.options.map((option) => <li key={option.sortOrder} className="flex min-h-11 items-center gap-2"><span aria-hidden="true" className={`h-4 w-4 rounded-full border ${option.isCorrect ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`} /><span className="text-sm text-slate-700">{option.optionText}</span>{option.isCorrect ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-800">الإجابة الصحيحة</span> : null}</li>)}</ul> : null}
      {item.questionType === 'Ordering' ? <ol className="flex flex-col gap-1">{item.options.map((option, optionIndex) => <li key={option.sortOrder} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{optionIndex + 1}. {option.optionText}</li>)}</ol> : null}
      {item.questionType === 'ShortAnswer' ? <input type="text" disabled placeholder="إجابة الطالب تظهر هنا…" className="min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-400" /> : null}
      {item.questionType === 'Listening' ? <p className="text-sm text-slate-500">سؤال استماع — يعتمد على المقطع الصوتي أعلاه.</p> : null}
      {item.explanation ? <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3"><summary className="min-h-11 cursor-pointer content-center text-sm font-black text-slate-700">الشرح للمعلم</summary><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.explanation}</p></details> : null}
    </article>
  );
}
