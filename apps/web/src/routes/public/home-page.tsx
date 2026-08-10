import { Link } from 'react-router';
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
        : 'تعذر الوصول إلى الخدمة الآن. حاول مرة أخرى بعد قليل.';
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
    <section className="space-y-8">
      <div className="max-w-3xl">
        <p className="mb-2 text-sm font-semibold text-sky-700">اختبارات ومسابقات تعليمية في مساحة عمل واحدة</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">منصة المعلم والاختبارات</h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
          أنشئ بنك أسئلة واختبارات قابلة للنشر، شغّل جلسات ذاتية أو مباشرة، ثم راجع النتائج
          والاستبيانات وأصدر الشهادات من لوحة المعلم.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/auth/signup"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-sky-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
            إنشاء حساب معلم
          </Link>
          <Link
            to="/auth/login"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
            تسجيل الدخول
          </Link>
        </div>
      </div>

      <div className="max-w-xl rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold">حالة الخدمة</h2>
        <ApiStatusCard />
      </div>
    </section>
  );
}
