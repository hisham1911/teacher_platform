import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { publicResultsApi } from '../../data/api-client/endpoints';

export default function PublicResultPage() {
  const { publicToken } = useParams<{ publicToken: string }>();
  const resultQuery = useQuery({
    queryKey: ['public-result', publicToken],
    queryFn: ({ signal }) => publicResultsApi.get(publicToken!, signal),
    enabled: Boolean(publicToken),
    retry: false,
  });

  if (resultQuery.isLoading) return <CenteredMessage>جارٍ تحميل النتيجة…</CenteredMessage>;
  if (resultQuery.isError || !resultQuery.data) return <CenteredMessage error>هذا الرابط غير صالح أو انتهت مدته.</CenteredMessage>;

  const result = resultQuery.data;
  const shareText = `${result.studentName} حصل على ${Math.round(result.percentage)}% في ${result.quizTitle}`;
  const whatsappUrl = `https://wa.me/?${new URLSearchParams({ text: `${shareText}\n${window.location.href}` }).toString()}`;

  return (
    <main className="mx-auto max-w-2xl py-8 sm:py-14" dir="rtl">
      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className={result.passed ? 'bg-emerald-700 px-6 py-8 text-white sm:px-10' : 'bg-slate-800 px-6 py-8 text-white sm:px-10'}>
          <p className="text-sm font-bold opacity-80">ملخص نتيجة موثّق</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">{result.studentName}</h1>
          <p className="mt-1 opacity-90">{result.quizTitle}</p>
        </div>
        <div className="p-6 sm:p-10">
          <div className="flex items-end justify-between gap-6 border-b border-slate-100 pb-7">
            <div>
              <p className="text-sm text-slate-500">النتيجة</p>
              <p dir="ltr" className="mt-1 text-4xl font-black text-slate-950">{Math.round(result.percentage)}%</p>
              <p dir="ltr" className="mt-1 text-sm text-slate-500">{result.score} / {result.maxScore}</p>
            </div>
            <span className={`rounded-full px-4 py-2 text-sm font-bold ${result.passed ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
              {result.passed ? 'اجتاز الاختبار' : 'لم يجتز الاختبار'}
            </span>
          </div>

          {result.reviewAreas.length > 0 ? (
            <section className="py-7" aria-labelledby="review-title">
              <h2 id="review-title" className="font-bold text-slate-900">موضوعات تحتاج مراجعة</h2>
              <ul className="mt-3 list-disc space-y-2 pr-5 text-sm text-slate-600">
                {result.reviewAreas.map((area) => <li key={area}>{area}</li>)}
              </ul>
            </section>
          ) : <p className="py-7 text-sm text-slate-600">لا توجد موضوعات إضافية مقترحة للمراجعة.</p>}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row">
            {result.certificateUrl ? (
              <a href={result.certificateUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800">فتح الشهادة</a>
            ) : null}
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">مشاركة عبر واتساب</a>
          </div>
          <p className="mt-5 text-xs text-slate-400">تاريخ الإكمال: {new Date(result.finishedAt).toLocaleDateString('ar-EG')}</p>
        </div>
      </article>
    </main>
  );
}

function CenteredMessage({ children, error = false }: { children: string; error?: boolean }) {
  return <main className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center"><p role={error ? 'alert' : 'status'} className={`rounded-xl p-5 text-center text-sm ${error ? 'bg-rose-50 text-rose-700' : 'text-slate-500'}`}>{children}</p></main>;
}
