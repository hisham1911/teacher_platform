import { useParams } from 'react-router';
import { publicResultsApi } from '../../data/api-client/endpoints';

export default function PublicCertificatePage() {
  const { publicToken } = useParams<{ publicToken: string }>();
  if (!publicToken) return null;
  const certificateUrl = publicResultsApi.certificateUrl(publicToken);

  return (
    <main className="mx-auto max-w-5xl py-6" dir="rtl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-slate-900">شهادة الإنجاز</h1><p className="mt-1 text-sm text-slate-500">ملف PDF صادر من منصة المعلم.</p></div>
        <a href={certificateUrl} download className="inline-flex min-h-11 items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700">تنزيل الشهادة</a>
      </div>
      <iframe title="شهادة الإنجاز" src={certificateUrl} className="h-[72vh] w-full rounded-2xl border border-slate-200 bg-white" />
    </main>
  );
}
