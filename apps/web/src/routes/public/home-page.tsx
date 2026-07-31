import { HttpError } from '../../data/api-client/http-error';
import { useSystemInfoQuery } from '../../data/queries/system-info';

function ApiStatusCard() {
  const { data, isPending, error, isError } = useSystemInfoQuery();

  if (isPending) {
    return <p className="text-sm text-slate-500">جاري الاتصال بالـAPI…</p>;
  }

  if (isError) {
    const unreachable =
      error instanceof HttpError
        ? `الـAPI ردّ بالحالة ${error.status}`
        : 'تعذر الوصول إلى الـAPI. تأكد من تشغيله ومن عنوان VITE_API_BASE_URL.';
    return <p className="text-sm text-amber-700">{unreachable}</p>;
  }

  return (
    <dl className="grid grid-cols-2 gap-2 text-sm">
      <dt className="text-slate-500">الخدمة</dt>
      <dd className="font-medium">{data.service}</dd>
      <dt className="text-slate-500">الحالة</dt>
      <dd className="font-medium text-emerald-600">{data.status}</dd>
      <dt className="text-slate-500">إصدار الـAPI</dt>
      <dd className="font-medium">{data.apiVersion}</dd>
    </dl>
  );
}

export default function HomePage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">منصة المعلم والاختبارات</h1>
        <p className="mt-2 text-slate-600">
          المرحلة التأسيسية: هيكل التطبيق والتوجيهات وحدود الاتصال بالـAPI جاهزة للبناء عليها.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">حالة الاتصال بالـAPI</h2>
        <ApiStatusCard />
      </div>
    </section>
  );
}
