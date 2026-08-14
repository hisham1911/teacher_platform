import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { ButtonSpinner } from '../../components/ui/spinner';
import { playerApi } from '../../data/api-client/endpoints';

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function PlayerDeliveryPanel({
  joinCode,
  attemptId,
  passed,
}: {
  joinCode: string;
  attemptId: string;
  passed: boolean;
}) {
  const [copied, setCopied] = useState<'certificate' | 'result' | null>(null);
  const [copyError, setCopyError] = useState(false);
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

  async function copy(kind: 'certificate' | 'result', value: string) {
    try {
      await copyText(value);
      setCopied(kind);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <section aria-labelledby="delivery-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <p className="text-xs font-bold tracking-wide text-sky-700">الخطوة التالية</p>
        <h2 id="delivery-title" className="mt-1 text-lg font-bold text-slate-900">احتفظ بالنتيجة وشاركها</h2>
      </div>

      <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
        <div className="bg-white p-5 sm:p-6">
          <h3 className="font-bold text-slate-900">شهادة النجاح</h3>
          {!passed ? (
            <p className="mt-2 text-sm text-slate-600">تُصدر الشهادة تلقائيًا عند تجاوز درجة النجاح.</p>
          ) : certificateQuery.isError ? (
            <div className="mt-3">
              <p role="alert" className="mb-3 text-sm text-rose-700">تعذر تجهيز الشهادة الآن.</p>
              <Button variant="secondary" onClick={() => void certificateQuery.refetch()}>إعادة المحاولة</Button>
            </div>
          ) : !certificate || certificate.status === 'Pending' ? (
            <div className="mt-3 text-sm text-slate-600">
              <p role="status" className="flex items-center gap-2">
                <ButtonSpinner /> تُجهّز الشهادة تلقائيًا، وستتحدث هذه الصفحة عند اكتمالها.
              </p>
              {certificateWaitIsLong ? (
                <div className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-900">
                  <p>ما زالت قيد التجهيز. يمكنك تحديث الحالة دون مغادرة الصفحة.</p>
                  <Button variant="secondary" onClick={() => void certificateQuery.refetch()}>تحديث حالة الشهادة</Button>
                </div>
              ) : null}
            </div>
          ) : certificate.status === 'Failed' ? (
            <div role="alert" className="mt-2 text-sm text-rose-700">
              <p>تعذر إنشاء الشهادة. أبلغ المعلم ليعيد المحاولة من صفحة الشهادات.</p>
              <Button variant="secondary" onClick={() => void certificateQuery.refetch()}>تحديث الحالة</Button>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              <a
                href={playerApi.certificateDownloadUrl(joinCode, attemptId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
                تنزيل الشهادة PDF
              </a>
              {certificate.publicUrl ? (
                <Button variant="secondary" onClick={() => void copy('certificate', certificate.publicUrl!)}>
                  {copied === 'certificate' ? 'تم نسخ رابط الشهادة' : 'نسخ رابط الشهادة'}
                </Button>
              ) : null}
              <p dir="ltr" className="text-center text-xs text-slate-500">{certificate.certificateNumber}</p>
            </div>
          )}
        </div>

        <div className="bg-white p-5 sm:p-6">
          <h3 className="font-bold text-slate-900">مشاركة النتيجة مع ولي الأمر</h3>
          <p className="mt-2 text-sm text-slate-600">أنشئ رابطًا خاصًا مؤقتًا يعرض ملخص النتيجة فقط.</p>
          {parentShareMutation.isError ? (
            <p role="alert" className="mt-3 text-sm text-rose-700">تعذر إنشاء رابط المشاركة. حاول مجددًا.</p>
          ) : null}
          {parentShare ? (
            <div className="mt-3 flex flex-col gap-2">
              <a
                href={parentShare.shareUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
                فتح رابط ولي الأمر
              </a>
              <Button variant="secondary" onClick={() => void copy('result', parentShare.shareUrl)}>
                {copied === 'result' ? 'تم نسخ رابط النتيجة' : 'نسخ رابط النتيجة'}
              </Button>
              <p className="text-xs text-slate-500">
                صالح حتى {new Date(parentShare.expiresAt).toLocaleDateString('ar-EG')}
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <Button
                variant="secondary"
                disabled={parentShareMutation.isPending}
                onClick={() => parentShareMutation.mutate()}>
                {parentShareMutation.isPending ? <ButtonSpinner /> : 'إنشاء رابط المشاركة'}
              </Button>
            </div>
          )}
        </div>
      </div>
      {copyError ? <p role="alert" className="border-t border-slate-100 bg-rose-50 px-5 py-3 text-sm text-rose-700">تعذر النسخ تلقائيًا. افتح الرابط ثم انسخه من شريط العنوان.</p> : null}
    </section>
  );
}
