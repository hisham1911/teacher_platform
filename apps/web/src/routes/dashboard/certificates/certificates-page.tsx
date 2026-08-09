import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../components/ui/button';
import { FormField, TextArea, TextInput } from '../../../components/ui/form-field';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { certificatesApi, certificateTemplatesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import type { CertificateTemplate, SaveCertificateTemplateRequest } from '../../../types/certificates';

const EMPTY_TEMPLATE: SaveCertificateTemplateRequest = {
  name: 'الشهادة الافتراضية',
  titleText: 'شهادة إتمام',
  bodyText: 'تقديرًا لاجتياز الاختبار بنجاح',
  issuerName: 'منصة المعلم',
  primaryColor: '#0F766E',
  secondaryColor: '#D97706',
  isDefault: true,
  baseVersion: null,
};

function templatePayload(template: CertificateTemplate): SaveCertificateTemplateRequest {
  return {
    name: template.name,
    titleText: template.titleText,
    bodyText: template.bodyText,
    issuerName: template.issuerName,
    primaryColor: template.primaryColor,
    secondaryColor: template.secondaryColor,
    isDefault: template.isDefault,
    baseVersion: template.version,
  };
}

function errorMessage(error: unknown) {
  if (error instanceof HttpError && error.status === 409) {
    return 'تغيّر القالب في نافذة أخرى. أعد تحميل الصفحة قبل الحفظ.';
  }
  return 'تعذر حفظ قالب الشهادة. راجع الحقول وحاول مجددًا.';
}

export default function CertificatesPage() {
  const tenantId = getActiveTenantId();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SaveCertificateTemplateRequest>(EMPTY_TEMPLATE);
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const templatesQuery = useQuery({
    queryKey: ['certificate-templates', tenantId],
    queryFn: ({ signal }) => certificateTemplatesApi.list(tenantId!, signal),
    enabled: Boolean(tenantId),
  });
  const certificatesQuery = useQuery({
    queryKey: ['certificates', tenantId],
    queryFn: ({ signal }) => certificatesApi.list(tenantId!, signal),
    enabled: Boolean(tenantId),
  });

  const currentTemplate = templatesQuery.data?.find((item) => item.isDefault) ?? templatesQuery.data?.[0] ?? null;

  useEffect(() => {
    if (!currentTemplate || currentTemplate.id === loadedTemplateId) return;
    setDraft(templatePayload(currentTemplate));
    setLoadedTemplateId(currentTemplate.id);
  }, [currentTemplate, loadedTemplateId]);

  const saveMutation = useMutation({
    mutationFn: () => currentTemplate
      ? certificateTemplatesApi.update(tenantId!, currentTemplate.id, draft)
      : certificateTemplatesApi.create(tenantId!, draft),
    onSuccess: async (saved) => {
      setDraft(templatePayload(saved));
      setLoadedTemplateId(saved.id);
      setMessage('تم حفظ قالب الشهادة.');
      await queryClient.invalidateQueries({ queryKey: ['certificate-templates', tenantId] });
    },
    onError: (error) => setMessage(errorMessage(error)),
  });

  const retryMutation = useMutation({
    mutationFn: (certificateId: string) => certificatesApi.retry(tenantId!, certificateId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['certificates', tenantId] });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    saveMutation.mutate();
  }

  async function download(certificateId: string, number: string) {
    setDownloadingId(certificateId);
    try {
      const blob = await certificatesApi.download(tenantId!, certificateId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${number}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
    }
  }

  if (!tenantId) {
    return <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">اختر مساحة عمل أولًا.</p>;
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-bold text-sky-700">التسليم والإنجاز</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">الشهادات</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          خصّص القالب الافتراضي وتابع ملفات الطلاب التي أُنشئت بعد اجتياز الاختبارات.
        </p>
      </header>

      <section aria-labelledby="template-title" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 id="template-title" className="text-lg font-bold text-slate-900">القالب الافتراضي</h2>
            <p className="mt-1 text-sm text-slate-500">تُحفظ بيانات القالب داخل كل شهادة وقت الإصدار.</p>
          </div>
          {currentTemplate ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">نشط</span> : null}
        </div>

        {templatesQuery.isLoading ? <p className="text-sm text-slate-500">جارٍ تحميل القالب…</p> : (
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <FormField id="certificate-name" label="اسم القالب">
              {(props) => <TextInput {...props} required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />}
            </FormField>
            <FormField id="certificate-title" label="عنوان الشهادة">
              {(props) => <TextInput {...props} required maxLength={200} value={draft.titleText} onChange={(event) => setDraft({ ...draft, titleText: event.target.value })} />}
            </FormField>
            <div className="sm:col-span-2">
              <FormField id="certificate-body" label="عبارة التكريم">
                {(props) => <TextArea {...props} required maxLength={500} rows={3} value={draft.bodyText} onChange={(event) => setDraft({ ...draft, bodyText: event.target.value })} />}
              </FormField>
            </div>
            <FormField id="certificate-issuer" label="اسم الجهة المصدرة">
              {(props) => <TextInput {...props} required maxLength={200} value={draft.issuerName} onChange={(event) => setDraft({ ...draft, issuerName: event.target.value })} />}
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField id="certificate-primary" label="اللون الأساسي">
                {(props) => <TextInput {...props} type="color" value={draft.primaryColor} onChange={(event) => setDraft({ ...draft, primaryColor: event.target.value })} />}
              </FormField>
              <FormField id="certificate-secondary" label="لون التمييز">
                {(props) => <TextInput {...props} type="color" value={draft.secondaryColor} onChange={(event) => setDraft({ ...draft, secondaryColor: event.target.value })} />}
              </FormField>
            </div>
            <div className="flex items-end gap-3 sm:col-span-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <ButtonSpinner /> : currentTemplate ? 'حفظ التعديلات' : 'إنشاء القالب'}
              </Button>
              {message ? <p role="status" className="pb-3 text-sm text-slate-600">{message}</p> : null}
            </div>
          </form>
        )}
      </section>

      <section aria-labelledby="issued-title">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="issued-title" className="text-lg font-bold text-slate-900">الشهادات الصادرة</h2>
            <p className="mt-1 text-sm text-slate-500">الأحدث أولًا، مع إمكانية إعادة محاولة الإنشاء عند الفشل.</p>
          </div>
          <span className="text-sm font-bold text-slate-500">{certificatesQuery.data?.length ?? 0}</span>
        </div>

        {certificatesQuery.isLoading ? <p className="text-sm text-slate-500">جارٍ تحميل الشهادات…</p> : null}
        {certificatesQuery.isError ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">تعذر تحميل الشهادات.</p> : null}
        {certificatesQuery.data?.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">لا توجد شهادات صادرة بعد.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-right text-xs text-slate-500">
                <tr><th className="px-4 py-3">الطالب</th><th className="px-4 py-3">الاختبار</th><th className="px-4 py-3">النتيجة</th><th className="px-4 py-3">الحالة</th><th className="px-4 py-3">الإجراء</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {certificatesQuery.data?.map((certificate) => (
                  <tr key={certificate.id}>
                    <td className="px-4 py-4"><p className="font-bold text-slate-900">{certificate.studentName}</p><p dir="ltr" className="text-xs text-slate-400">{certificate.certificateNumber}</p></td>
                    <td className="px-4 py-4 text-slate-600">{certificate.quizTitle}</td>
                    <td dir="ltr" className="px-4 py-4 text-right font-bold text-slate-700">{Math.round(certificate.percentage)}%</td>
                    <td className="px-4 py-4"><StatusBadge status={certificate.status} /></td>
                    <td className="px-4 py-4">
                      {certificate.status === 'Ready' ? (
                        <Button variant="secondary" disabled={downloadingId === certificate.id} onClick={() => void download(certificate.id, certificate.certificateNumber)}>
                          {downloadingId === certificate.id ? <ButtonSpinner /> : 'تنزيل PDF'}
                        </Button>
                      ) : certificate.status === 'Failed' ? (
                        <Button variant="secondary" disabled={retryMutation.isPending} onClick={() => retryMutation.mutate(certificate.id)}>إعادة المحاولة</Button>
                      ) : <span className="text-xs text-slate-500">قيد التجهيز</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: 'Pending' | 'Ready' | 'Failed' }) {
  const labels = { Pending: 'قيد التجهيز', Ready: 'جاهزة', Failed: 'فشلت' };
  const colors = { Pending: 'bg-amber-50 text-amber-800', Ready: 'bg-emerald-50 text-emerald-800', Failed: 'bg-rose-50 text-rose-800' };
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${colors[status]}`}>{labels[status]}</span>;
}
