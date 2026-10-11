import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { PublicBackdrop } from '../../components/layout/root-layout';

export default function RouteErrorPage() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="relative min-h-dvh flex flex-col justify-center items-center overflow-x-hidden bg-slate-50/50 px-4 py-12 text-center" dir="rtl">
      <PublicBackdrop />

      <main className="relative z-10 w-full max-w-lg rounded-3xl border border-white/80 bg-white/80 p-8 shadow-xl backdrop-blur-xl sm:p-12">
        <span
          aria-hidden="true"
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 text-3xl font-black text-white shadow-lg shadow-violet-700/20"
        >
          {notFound ? '404' : '⚠️'}
        </span>

        <p className="mt-6 text-xs font-black tracking-widest text-violet-600">
          ENGLISH SPARK
        </p>

        <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
          {notFound ? 'الصفحة غير موجودة' : 'تعذر عرض الصفحة'}
        </h1>

        <p className="mt-4 text-sm font-semibold leading-7 text-slate-600">
          {notFound
            ? 'يبدو أن الرابط الذي طلبته غير صحيح أو تم نقله. يمكنك العودة للصفحة الرئيسية أو استكشاف الأقسام التعليمية.'
            : 'أعد تحميل الصفحة. إذا استمر الخطأ، تحقق من الاتصال بالشبكة أو أعد المحاولة لاحقاً.'}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="w-full inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-700 px-6 text-sm font-black text-white shadow-md shadow-violet-700/20 transition hover:bg-violet-800 hover:shadow-lg sm:w-auto"
          >
            العودة إلى الرئيسية
          </Link>
          <Link
            to="/challenge"
            className="w-full inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-6 text-sm font-black text-amber-900 transition hover:bg-amber-100 sm:w-auto"
          >
            <span>🏆</span>
            <span>مسابقة المليون</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
