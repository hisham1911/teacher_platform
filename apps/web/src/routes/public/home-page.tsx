import { Link } from 'react-router';

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
            أنشئ اختبارك الأول
          </Link>
          <Link
            to="/auth/login"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
            تسجيل الدخول
          </Link>
        </div>
      </div>
    </section>
  );
}
