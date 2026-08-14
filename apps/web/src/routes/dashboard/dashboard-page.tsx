import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { tenantsApi } from '../../data/api-client/endpoints';
import { getActiveTenantId } from '../../lib/auth/session';
import { useSessionSnapshot } from '../../features/auth/use-session';

/** /dashboard — نقطة دخول عملية إلى وظائف مساحة العمل، بلا مؤشرات أو بيانات مختلقة. */
export default function DashboardPage() {
  const navigate = useNavigate();
  const session = useSessionSnapshot();
  const activeTenantId = getActiveTenantId();

  const { data: workspaces, isLoading, isError, refetch } = useQuery({
    queryKey: ['tenants', 'mine'],
    queryFn: ({ signal }) => tenantsApi.listMine(signal),
  });

  const activeWorkspace = workspaces?.find((w) => w.id === activeTenantId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            لوحة التحكم{activeWorkspace ? ` — ${activeWorkspace.name}` : ''}
          </h1>
          <p className="text-sm text-slate-600">مرحبًا {session.user?.fullName ?? 'ضيف'}.</p>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">جارٍ تحميل مساحات العمل…</p> : null}

      {isError ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p>تعذر تحميل مساحات العمل. تحقق من الاتصال ثم حاول مرة أخرى.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 min-h-11 rounded-lg border border-rose-300 bg-white px-4 py-2 font-semibold text-rose-800 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700">
            إعادة المحاولة
          </button>
        </div>
      ) : null}

      {!isLoading && !isError && workspaces && workspaces.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
          <p className="mb-4 text-sm text-slate-700">لا توجد مساحة عمل بعد. أنشئ أول مساحة لك.</p>
          <button type="button" onClick={() => navigate('/onboarding')} className="min-h-11 rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">إنشاء مساحة عمل</button>
        </div>
      ) : null}

      {!isLoading && !isError && workspaces && workspaces.length > 0 && activeWorkspace === null ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          اختر مساحة العمل من القائمة أعلاه لعرض بياناتها.
        </div>
      ) : null}

      {activeWorkspace && !isError ? <>
        <section className="rounded-xl border border-sky-200 bg-sky-50 p-5">
          <h2 className="text-lg font-bold text-slate-950">ابدأ أول اختبار في أربع خطوات</h2>
          <ol className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <li><b>1.</b> أضف أسئلتك إلى بنك الأسئلة.</li>
            <li><b>2.</b> أنشئ اختبارًا وانشره.</li>
            <li><b>3.</b> أنشئ جلسة وشارك رابط الطلاب.</li>
            <li><b>4.</b> راجع النتائج والتقارير بعد الحل.</li>
          </ol>
          <button type="button" onClick={() => navigate('/dashboard/questions')} className="mt-4 min-h-11 rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">ابدأ ببنك الأسئلة</button>
        </section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate('/dashboard/questions')}
          className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 text-start hover:border-sky-300 focus-visible:outline-2 focus-visible:outline-sky-600">
          <p className="text-sm font-semibold text-slate-900">بنك الأسئلة</p>
          <p className="mt-1 text-xs text-slate-500">أنشئ أسئلة نصية وصوتية ومصورة واحتفظ بتاريخ تعديلاتك.</p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/dashboard/certificates')}
          className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 text-start hover:border-sky-300 focus-visible:outline-2 focus-visible:outline-sky-600">
          <p className="text-sm font-semibold text-slate-900">الشهادات</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">خصص قالب الشهادة وتابع ملفات الشهادات الصادرة أو أعد معالجة المتعثر منها.</p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/dashboard/quizzes')}
          className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 text-start hover:border-sky-300 focus-visible:outline-2 focus-visible:outline-sky-600">
          <p className="text-sm font-semibold text-slate-900">الاختبارات</p>
          <p className="mt-1 text-xs text-slate-500">بناء اختبارات من بنك الأسئلة ونشرها برابط عام.</p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/dashboard/reports')}
          className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 text-start hover:border-sky-300 focus-visible:outline-2 focus-visible:outline-sky-600">
          <p className="text-sm font-semibold text-slate-900">النتائج والتقارير</p>
          <p className="mt-1 text-xs text-slate-500">افتح نتائج الجلسات ومحاولات الطلاب وتحليلات الأسئلة.</p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/dashboard/settings')}
          className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 text-start hover:border-sky-300 focus-visible:outline-2 focus-visible:outline-sky-600">
          <p className="text-sm font-semibold text-slate-900">إعدادات مساحة العمل</p>
          <p className="mt-1 text-xs text-slate-500">اسم المعلم الظاهر والألوان واللغة.</p>
        </button>
        </div>
      </> : null}
    </div>
  );
}
