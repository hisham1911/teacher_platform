import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { publicResultsApi } from '../../data/api-client/endpoints';

export default function PublicCertificatePage() {
  const { publicToken } = useParams<{ publicToken: string }>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const certificateQuery = useQuery({
    queryKey: ['public-certificate', publicToken],
    queryFn: ({ signal }) => publicResultsApi.fetchCertificate(publicToken!, signal),
    enabled: Boolean(publicToken),
    retry: false,
  });

  useEffect(() => {
    if (!certificateQuery.data) return;
    const objectUrl = URL.createObjectURL(certificateQuery.data);
    setPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [certificateQuery.data]);

  if (!publicToken) {
    return <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">رابط الشهادة غير صالح.</p>;
  }

  const certificateUrl = publicResultsApi.certificateUrl(publicToken);

  return (
    <main className="mx-auto max-w-5xl py-6" dir="rtl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-slate-900">شهادة الإنجاز</h1><p className="mt-1 text-sm text-slate-500">ملف PDF صادر من منصة المعلم.</p></div>
        <div className="flex flex-wrap gap-2">
          <a href={certificateUrl} download className="inline-flex min-h-11 items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800">تنزيل الشهادة</a>
          <a href={certificateUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">فتح في نافذة جديدة</a>
        </div>
      </div>
      {certificateQuery.isPending ? (
        <div role="status" className="flex h-[72vh] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-600">جارٍ تجهيز معاينة الشهادة…</div>
      ) : null}
      {certificateQuery.isError ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          <p>تعذر عرض معاينة الشهادة. يمكنك تنزيل الملف مباشرة أو إعادة المحاولة.</p>
          <button type="button" onClick={() => void certificateQuery.refetch()} className="mt-3 min-h-11 rounded-md border border-rose-300 bg-white px-4 py-2 font-semibold hover:bg-rose-100">إعادة المحاولة</button>
        </div>
      ) : null}
      {previewUrl ? (
        <iframe title="شهادة الإنجاز" src={previewUrl} className="h-[72vh] w-full rounded-xl border border-slate-200 bg-white" />
      ) : null}
    </main>
  );
}
