import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HttpError } from '../../../data/api-client/http-error';
import { teacherStudentPortalApi } from '../../../data/api-client/student-portal-endpoints';
import { getActiveTenantId } from '../../../lib/auth/session';
import { formatStudentAccessCode } from '../../../types/student-portal';

export function StudentPortalAccessCard({ studentId, isActive }: { studentId: string; isActive: boolean }) {
  const tenantId = getActiveTenantId();
  const queryClient = useQueryClient();
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['student-portal-access', tenantId, studentId],
    queryFn: ({ signal }) => teacherStudentPortalApi.getAccessStatus(tenantId!, studentId, signal),
    enabled: Boolean(tenantId && studentId),
    retry: false,
  });

  const rotateMutation = useMutation({
    mutationFn: () => teacherStudentPortalApi.rotateAccessCode(tenantId!, studentId),
    onSuccess: async (result) => {
      setError(null);
      setCopied(false);
      setRevealedCode(result.accessCode);
      await queryClient.invalidateQueries({ queryKey: ['student-portal-access', tenantId, studentId] });
    },
    onError: (mutationError) => {
      if (mutationError instanceof HttpError && mutationError.status === 403) {
        setError('الحساب الحالي لا يملك صلاحية إدارة دخول الطلاب.');
      } else {
        setError('تعذر إنشاء كود الدخول الآن. أعد المحاولة بعد قليل.');
      }
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => teacherStudentPortalApi.revokeAccess(tenantId!, studentId),
    onSuccess: async () => {
      setError(null);
      setRevealedCode(null);
      await queryClient.invalidateQueries({ queryKey: ['student-portal-access', tenantId, studentId] });
    },
    onError: () => setError('تعذر إلغاء كود الدخول الآن. أعد المحاولة.'),
  });

  async function copyCode() {
    if (!revealedCode) return;
    try {
      await navigator.clipboard.writeText(revealedCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('تعذر النسخ تلقائيًا. حدّد الكود وانسخه يدويًا.');
    }
  }

  function rotate() {
    if (statusQuery.data?.hasAccessCode && !window.confirm('إنشاء كود دخول جديد سيوقف الكود الحالي ويسجل خروج الطالب من أجهزته. هل تريد المتابعة؟')) return;
    rotateMutation.mutate();
  }

  function revoke() {
    if (!window.confirm('إلغاء الوصول سيوقف كود الدخول الحالي ويسجل خروج الطالب من أجهزته. النتائج ستظل محفوظة. هل تريد المتابعة؟')) return;
    revokeMutation.mutate();
  }

  return (
    <section className="teacher-surface overflow-hidden" aria-labelledby="portal-access-title">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p id="portal-access-title" className="text-base font-bold text-slate-950">دخول الطالب إلى English Spark</p>
              <p className="mt-1 max-w-2xl text-sm leading-7 text-slate-500">كود شخصي يفتح مساحة الطالب وتقدمه. لا يرتبط بنشاط واحد، ولا يحتاج بريدًا أو كلمة مرور.</p>
            </div>
            {statusQuery.data ? (
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusQuery.data.hasAccessCode ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'}`}>
                {statusQuery.data.hasAccessCode ? 'الدخول مفعّل' : 'لم يُنشأ كود بعد'}
              </span>
            ) : null}
          </div>

          {statusQuery.isLoading ? <p className="mt-4 text-sm text-slate-500">جارٍ التحقق من حالة الدخول…</p> : null}
          {statusQuery.isError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">تعذر تحميل حالة دخول الطالب. أعد تحميل الصفحة.</p> : null}

          {statusQuery.data?.hasAccessCode && !revealedCode ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold text-slate-500">الكود الحالي مخفي للحماية</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">ينتهي بـ <span dir="ltr" className="font-mono font-black tracking-wider">••••-{statusQuery.data.codeSuffix}</span></p>
              <p className="mt-1 text-xs leading-6 text-slate-500">لا نخزن الكود بصورته الأصلية. إذا فُقد، أنشئ كودًا جديدًا.</p>
            </div>
          ) : null}

          {revealedCode ? (
            <div role="status" className="mt-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-black text-emerald-900">انسخ الكود الآن</p>
              <p className="mt-1 text-xs leading-6 text-emerald-800">لن نعرض الكود كاملًا مرة أخرى بعد مغادرة الصفحة.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <code dir="ltr" className="select-all rounded-xl bg-white px-4 py-3 text-center font-mono text-lg font-black tracking-[0.09em] text-slate-950 ring-1 ring-emerald-200 sm:text-xl">{formatStudentAccessCode(revealedCode)}</code>
                <button type="button" onClick={() => void copyCode()} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">{copied ? 'تم النسخ ✓' : 'نسخ الكود'}</button>
              </div>
            </div>
          ) : null}

          {!isActive ? <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-7 text-amber-900">الطالب غير نشط حاليًا، لذلك لن يستطيع الدخول حتى يتم تفعيله.</p> : null}
          {error ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm leading-7 text-rose-800">{error}</p> : null}
        </div>

        <div className="flex flex-col justify-center gap-2 border-t border-slate-200 bg-slate-50/70 p-4 lg:border-r lg:border-t-0">
          <button
            type="button"
            onClick={rotate}
            disabled={rotateMutation.isPending || statusQuery.isLoading || statusQuery.isError}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">
            {rotateMutation.isPending ? 'جارٍ الإنشاء…' : statusQuery.data?.hasAccessCode ? 'إنشاء كود جديد' : 'إنشاء كود دخول'}
          </button>
          {statusQuery.data?.hasAccessCode ? (
            <button type="button" onClick={revoke} disabled={revokeMutation.isPending} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
              {revokeMutation.isPending ? 'جارٍ الإلغاء…' : 'إلغاء الوصول'}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
