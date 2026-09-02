import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'react-qr-code';
import { HttpError } from '../../../data/api-client/http-error';
import { studentPortalApi, teacherStudentPortalApi } from '../../../data/api-client/student-portal-endpoints';
import { getActiveTenantId } from '../../../lib/auth/session';
import { formatStudentAccessCode } from '../../../types/student-portal';

interface StudentPortalAccessCardProps {
  studentId: string;
  studentName: string;
  isActive: boolean;
}

export function StudentPortalAccessCard({ studentId, studentName, isActive }: StudentPortalAccessCardProps) {
  const tenantId = getActiveTenantId();
  const queryClient = useQueryClient();
  const printCardRef = useRef<HTMLDivElement>(null);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availabilityQuery = useQuery({
    queryKey: ['student-portal', 'status'],
    queryFn: ({ signal }) => studentPortalApi.status(signal),
    retry: false,
    staleTime: 60_000,
  });
  const portalEnabled = availabilityQuery.data?.enabled === true;

  const statusQuery = useQuery({
    queryKey: ['student-portal-access', tenantId, studentId],
    queryFn: ({ signal }) => teacherStudentPortalApi.getAccessStatus(tenantId!, studentId, signal),
    enabled: Boolean(tenantId && studentId && portalEnabled),
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

  function printAccessCard() {
    const card = printCardRef.current;
    if (!card) return;
    const popup = window.open('', '_blank', 'width=720,height=860');
    if (!popup) {
      setError('تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.');
      return;
    }

    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>بطاقة دخول English Spark</title><style>body{font-family:Arial,sans-serif;margin:0;padding:32px;background:#fff;color:#0f172a}.card{max-width:560px;margin:auto;border:2px solid #ddd6fe;border-radius:24px;padding:28px;text-align:center}.card svg{max-width:180px;height:auto}.code{display:inline-block;margin-top:16px;padding:12px 18px;border-radius:12px;background:#f5f3ff;font-family:monospace;font-size:24px;font-weight:800;letter-spacing:.08em;direction:ltr}.url{margin-top:12px;font-family:monospace;font-size:12px;direction:ltr}.hint{margin-top:16px;font-size:13px;line-height:1.8;color:#475569}@media print{body{padding:0}.card{border-color:#c4b5fd}}</style></head><body><div class="card">${card.innerHTML}</div></body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  if (availabilityQuery.isLoading) {
    return <section className="teacher-surface p-5 text-sm text-slate-500 sm:p-6">جارٍ التحقق من تفعيل دخول الطلاب…</section>;
  }

  if (availabilityQuery.isError) {
    return (
      <section className="teacher-surface p-5 sm:p-6">
        <p className="font-bold text-slate-950">دخول الطالب إلى English Spark</p>
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm leading-7 text-rose-800">تعذر التحقق من حالة بوابة الطالب. أعد تحميل الصفحة.</p>
      </section>
    );
  }

  if (!portalEnabled) {
    return (
      <section className="teacher-surface p-5 sm:p-6" aria-labelledby="portal-access-disabled-title">
        <p id="portal-access-disabled-title" className="text-base font-bold text-slate-950">دخول الطالب إلى English Spark</p>
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-bold text-amber-950">بوابة الطالب غير مفعّلة في هذه البيئة</p>
          <p className="mt-1 text-sm leading-7 text-amber-900">لن تُنشأ أكواد دخول دائمة حتى يتم تفعيل Student Portal صراحةً. الانضمام السريع للأنشطة يظل متاحًا.</p>
        </div>
      </section>
    );
  }

  const portalUrl = `${window.location.origin}/student`;

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
              <div ref={printCardRef} className="mt-4 rounded-2xl bg-white p-4 text-center ring-1 ring-emerald-200">
                <p className="text-lg font-black text-slate-950">English Spark</p>
                <p className="mt-1 text-sm font-bold text-slate-700">بطاقة دخول {studentName}</p>
                <div data-testid="student-portal-qr-code" className="mx-auto mt-4 w-fit rounded-xl bg-white p-2 ring-1 ring-slate-200">
                  <QRCode value={portalUrl} size={156} aria-label="رمز QR لصفحة دخول الطالب" />
                </div>
                <code dir="ltr" className="code mt-4 inline-block select-all rounded-xl bg-violet-50 px-4 py-3 font-mono text-lg font-black tracking-[0.09em] text-violet-950 sm:text-xl">{formatStudentAccessCode(revealedCode)}</code>
                <p dir="ltr" className="url mt-3 break-all font-mono text-xs text-slate-500">{portalUrl}</p>
                <p className="hint mt-3 text-xs leading-6 text-slate-500">امسح QR لفتح صفحة الدخول، ثم اكتب الكود الشخصي المطبوع على البطاقة.</p>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <button type="button" onClick={() => void copyCode()} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">{copied ? 'تم النسخ ✓' : 'نسخ الكود'}</button>
                <button type="button" onClick={printAccessCard} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-50">طباعة بطاقة الدخول</button>
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
