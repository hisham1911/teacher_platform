import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ButtonSpinner } from '../../components/ui/spinner';
import { playerApi } from '../../data/api-client/endpoints';
import { StudentButton } from './student-ui';

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function PlayerDeliveryPanel({
  joinCode,
  attemptId,
  passed,
  surveyAction,
}: {
  joinCode: string;
  attemptId: string;
  passed: boolean;
  surveyAction?: ReactNode;
}) {
  const [copied, setCopied] = useState<'certificate' | 'result' | null>(null);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const [certificateWaitIsLong, setCertificateWaitIsLong] = useState(false);

  const certificateQuery = useQuery({
    queryKey: ['player-certificate', joinCode, attemptId],
    queryFn: ({ signal }) => playerApi.issueCertificate(joinCode, attemptId, signal),
    enabled: passed,
    retry: false,
    refetchInterval: (query) => query.state.data?.status === 'Pending' ? 1_500 : false,
  });

  const parentShareMutation = useMutation({
    mutationFn: () => playerApi.createParentShare(joinCode, attemptId),
  });

  const certificate = certificateQuery.data;
  const parentShare = parentShareMutation.data;

  useEffect(() => {
    if (!passed || (certificate && certificate.status !== 'Pending')) {
      setCertificateWaitIsLong(false);
      return;
    }
    const timer = window.setTimeout(() => setCertificateWaitIsLong(true), 8_000);
    return () => window.clearTimeout(timer);
  }, [certificate, passed]);

  async function copy(kind: 'certificate' | 'result', text: string) {
    try {
      await copyText(text);
      setCopied(kind);
      setCopyFallback(null);
    } catch {
      setCopyFallback(text);
    }
  }

  return (
    <section aria-labelledby="delivery-title" className="student-panel overflow-hidden">
      <div className="px-5 py-5 sm:px-7">
        <p className="text-sm font-bold text-[var(--student-primary-strong)]">الخطوة التالية</p>
        <h2 id="delivery-title" className="mt-1 text-xl font-black text-[var(--student-ink)]">
          {passed ? 'شهادتك ونتيجتك' : 'احتفظ بنتيجتك'}
        </h2>
      </div>

      {passed ? (
        <div className="border-t border-emerald-100 bg-emerald-50/55 px-5 py-5 sm:px-7">
          <h3 className="text-base font-black text-[var(--student-ink)]">الشهادة</h3>
          {certificateQuery.isError ? (
            <div className="mt-3">
              <p role="alert" className="mb-3 text-sm text-rose-700">تعذر تجهيز الشهادة الآن.</p>
              <StudentButton variant="secondary" onClick={() => void certificateQuery.refetch()}>إعادة المحاولة</StudentButton>
            </div>
          ) : !certificate || certificate.status === 'Pending' ? (
            <div className="mt-3 text-sm leading-7 text-[var(--student-muted)]">
              <p role="status" className="flex items-center gap-2 font-semibold text-slate-700">
                <ButtonSpinner /> جاري تجهيز شهادتك…
              </p>
              <p>سيتم تحديث الصفحة تلقائيًا عند اكتمالها.</p>
              {certificateWaitIsLong ? (
                <div className="mt-3 rounded-xl bg-amber-50 p-4 text-amber-950">
                  <p>ما زالت الشهادة قيد التجهيز. يمكنك تحديث حالتها دون مغادرة الصفحة.</p>
                  <StudentButton variant="secondary" onClick={() => void certificateQuery.refetch()} className="mt-3">تحديث الحالة</StudentButton>
                </div>
              ) : null}
            </div>
          ) : certificate.status === 'Failed' ? (
            <div role="alert" className="mt-3 text-sm text-rose-700">
              <p>تعذر تجهيز الشهادة الآن.</p>
              <StudentButton variant="secondary" onClick={() => void certificateQuery.refetch()} className="mt-3">إعادة المحاولة</StudentButton>
            </div>
          ) : (
            <div className="mt-4">
              <a
                href={playerApi.certificateDownloadUrl(joinCode, attemptId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--student-primary)] px-5 py-3 text-sm font-black text-white shadow-[0_2px_8px_rgb(5_150_105/0.22)] transition-colors duration-200 hover:bg-[var(--student-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--student-primary)]">
                عرض الشهادة
              </a>
            </div>
          )}
        </div>
      ) : null}

      {surveyAction}

      <div className="border-t border-slate-200 px-5 py-5 sm:px-7">
        <h3 className="text-base font-black text-[var(--student-ink)]">مشاركة النتيجة</h3>
        <p className="mt-2 text-sm leading-7 text-[var(--student-muted)]">أنشئ رابطًا خاصًا مؤقتًا لولي الأمر يعرض ملخص النتيجة فقط.</p>
        {parentShareMutation.isError ? <p role="alert" className="mt-3 text-sm text-rose-700">تعذر إنشاء الرابط. حاول مجددًا.</p> : null}
        {parentShare ? (
          <div className="mt-4 flex flex-col gap-3">
            <a
              href={parentShare.shareUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 transition-colors duration-200 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
              فتح رابط ولي الأمر
            </a>
            <StudentButton variant="quiet" onClick={() => void copy('result', parentShare.shareUrl)}>
              {copied === 'result' ? 'تم نسخ الرابط ✓' : 'نسخ الرابط'}
            </StudentButton>
            <p className="text-center text-xs text-[var(--student-muted)]">صالح حتى {new Date(parentShare.expiresAt).toLocaleDateString('ar-EG')}</p>
          </div>
        ) : (
          <StudentButton variant="secondary" disabled={parentShareMutation.isPending} onClick={() => parentShareMutation.mutate()} className="mt-4 w-full sm:w-auto">
            {parentShareMutation.isPending ? <ButtonSpinner /> : 'إنشاء رابط المشاركة'}
          </StudentButton>
        )}
      </div>

      {passed && certificate?.status === 'Ready' ? (
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-7">
          <h3 className="text-sm font-black text-[var(--student-ink)]">تفاصيل إضافية</h3>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {certificate.publicUrl ? (
              <StudentButton variant="quiet" onClick={() => void copy('certificate', certificate.publicUrl!)}>
                {copied === 'certificate' ? 'تم نسخ رابط الشهادة ✓' : 'نسخ رابط الشهادة'}
              </StudentButton>
            ) : null}
            <p dir="ltr" className="text-xs text-[var(--student-muted)]">{certificate.certificateNumber}</p>
          </div>
        </div>
      ) : null}

      {copyFallback ? (
        <div role="alert" className="border-t border-slate-200 bg-amber-50 px-5 py-4 sm:px-7">
          <label htmlFor="manual-share-link" className="text-sm font-bold text-amber-950">تعذر النسخ تلقائيًا — انسخ الرابط يدويًا</label>
          <input id="manual-share-link" dir="ltr" readOnly value={copyFallback} onFocus={(event) => event.currentTarget.select()} className="mt-2 min-h-12 w-full rounded-xl border border-amber-300 bg-white px-3 text-sm text-slate-900 focus:outline-2 focus:outline-amber-700" />
        </div>
      ) : null}
    </section>
  );
}
