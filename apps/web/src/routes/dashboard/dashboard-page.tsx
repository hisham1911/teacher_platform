import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { tenantsApi, authApi } from '../../data/api-client/endpoints';
import { clearSession, getActiveTenantId } from '../../lib/auth/session';
import { useSessionSnapshot } from '../../features/auth/use-session';

/** /dashboard — يعرض بيانات حقيقية فقط؛ لا إحصائيات وهمية في Phase 1 */
export default function DashboardPage() {
  const navigate = useNavigate();
  const session = useSessionSnapshot();
  const activeTenantId = getActiveTenantId();

  const { data: workspaces, isLoading } = useQuery({
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

      {!isLoading && workspaces && workspaces.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
          <p className="mb-4 text-sm text-slate-700">لا توجد مساحة عمل بعد. أنشئ أول مساحة لك.</p>
          <Button onClick={() => navigate('/onboarding')}>إنشاء مساحة عمل</Button>
        </div>
      ) : null}

      {!isLoading && workspaces && workspaces.length > 0 && activeWorkspace === null ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          اختر مساحة العمل من القائمة أعلاه لعرض بياناتها.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate('/dashboard/questions')}
          className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 text-start hover:border-sky-300 focus-visible:outline-2 focus-visible:outline-sky-600">
          <p className="text-sm font-semibold text-slate-900">بنك الأسئلة</p>
          <p className="mt-1 text-xs text-slate-500">إنشاء وتعديل أسئلة مع إصدارات Immutable ووسائط صوت/صورة.</p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/dashboard/settings')}
          className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 text-start hover:border-sky-300 focus-visible:outline-2 focus-visible:outline-sky-600">
          <p className="text-sm font-semibold text-slate-900">إعدادات مساحة العمل</p>
          <p className="mt-1 text-xs text-slate-500">اسم المعلم الظاهر والألوان واللغة.</p>
        </button>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-8">
        <p className="text-sm text-slate-600">
          إحصائيات الاختبارات والمحاولات ستظهر هنا في المرحلة القادمة.
        </p>
      </div>
    </div>
  );
}