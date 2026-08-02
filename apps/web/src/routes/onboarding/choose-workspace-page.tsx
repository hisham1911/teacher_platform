import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { tenantsApi } from '../../data/api-client/endpoints';
import { setActiveWorkspaceId } from '../../lib/auth/session';

/** /onboarding/choose — تُعرض إذا كان للمستخدم أكثر من Workspace */
export default function ChooseWorkspacePage() {
  const { data: workspaces, isLoading, isError } = useQuery({
    queryKey: ['tenants', 'mine'],
    queryFn: ({ signal }) => tenantsApi.listMine(signal),
  });

  return (
    <section className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-xl font-bold text-slate-900">اختيار مساحة العمل</h1>
      <p className="mb-6 text-sm text-slate-600">أنت عضو في أكثر من مساحة. اختر الوجهة الآن.</p>

      {isLoading ? (
        <p className="text-sm text-slate-500">جارٍ تحميل المساحات…</p>
      ) : null}

      {isError ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          تعذر تحميل المساحات. أعد المحاولة لاحقًا.
        </p>
      ) : null}

      {!isLoading && !isError ? (
        <ul className="flex flex-col gap-3" role="list">
          {workspaces!.map((workspace) => (
            <li key={workspace.id}>
              <Link
                to="/dashboard"
                onClick={() => setActiveWorkspaceId(workspace.id)}
                className="flex min-h-11 w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-start transition-colors hover:border-sky-300 hover:bg-sky-50/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{workspace.name}</span>
                  <span className="block font-mono text-xs text-slate-500">{workspace.slug}</span>
                </span>
                <span className="text-xs font-medium text-slate-500">{workspace.myRole}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-8 border-t border-slate-200 pt-4">
        <Button variant="secondary" onClick={() => window.history.back()}>
          العودة
        </Button>
      </div>
    </section>
  );
}
