import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { tenantsApi, authApi } from '../../data/api-client/endpoints';
import { clearSession, getActiveTenantId } from '../../lib/auth/session';
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

  async function onLogout() {
    try {
      await authApi.logout();
    } finally {
      clearSession();
      navigate('/auth/login', { replace: true });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            لوحة التحكم{activeWorkspace ? ` — ${activeWorkspace.name}` : ''}
          </h1>
          <p className="text-sm text-slate-600">مرحبًا {session.user?.fullName ?? 'ضيف'}.</p>
        </div>
        <Button variant="secondary" onClick={() => void onLogout()}>
          تسجيل الخروج
        </Button>
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
          <Button onClick={() => navigate('/onboarding')}>إنشاء مساحة عمل</Button>
        </div>
      ) : null}

      {!isLoading && !isError && workspaces && workspaces.length > 0 && activeWorkspace === null ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          اختر مساحة العمل من القائمة أعلاه لعرض بياناتها.
        </div>
      ) : null}

      {activeWorkspace && !isError ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate('/dashboard/questions')}
          className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 text-start hover:border-sky-300 focus-visible:outline-2 focus-visible:outline-sky-600">
          <p className="text-sm font-semibold text-slate-900">بنك الأسئلة</p>
          <p className="mt-1 text-xs text-slate-500">إنشاء وتعديل أسئلة مع إصدارات Immutable ووسائط صوت/صورة.</p>
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
          onClick={() => navigate('/dashboard/settings')}
          className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 text-start hover:border-sky-300 focus-visible:outline-2 focus-visible:outline-sky-600">
          <p className="text-sm font-semibold text-slate-900">إعدادات مساحة العمل</p>
          <p className="mt-1 text-xs text-slate-500">اسم المعلم الظاهر والألوان واللغة.</p>
        </button>
      </div> : null}
    </div>
  );
}
