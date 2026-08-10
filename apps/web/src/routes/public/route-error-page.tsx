import { Link, isRouteErrorResponse, useRouteError } from 'react-router';

export default function RouteErrorPage() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <main dir="rtl" className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-sky-700">{notFound ? '404' : 'تعذر عرض الصفحة'}</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-950">
        {notFound ? 'الصفحة غير موجودة' : 'حدث خطأ غير متوقع'}
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        {notFound
          ? 'تحقق من الرابط أو ارجع إلى الصفحة الرئيسية.'
          : 'أعد تحميل الصفحة. إذا تكرر الخطأ، أرسل معرّف الطلب الظاهر في استجابة الخدمة إلى الدعم.'}
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-sky-700 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
        العودة إلى الرئيسية
      </Link>
    </main>
  );
}
