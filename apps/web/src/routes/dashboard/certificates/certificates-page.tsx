import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { Button } from '../../../components/ui/button';
import { FormField, TextArea, TextInput } from '../../../components/ui/form-field';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { certificatesApi, certificateTemplatesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import type { CertificateListItem, CertificateTemplate, SaveCertificateTemplateRequest } from '../../../types/certificates';

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

function templateErrorMessage(error: unknown) {
  if (error instanceof HttpError && error.status === 409) return 'تغيّر القالب في نافذة أخرى. أعد تحميل الصفحة قبل الحفظ.';
  return 'تعذر حفظ قالب الشهادة. راجع الحقول وحاول مجددًا.';
}

export default function CertificatesPage() {
  const tenantId = getActiveTenantId();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SaveCertificateTemplateRequest>(EMPTY_TEMPLATE);
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [selectedCertificateId, setSelectedCertificateId] = useState<string | null>(() => searchParams.get('certificateId'));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<{ id: string; status: 'copied' | 'failed' } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const templatesQuery = useQuery({
    queryKey: ['certificate-templates', tenantId],
    queryFn: ({ signal }) => certificateTemplatesApi.list(tenantId!, signal),
    enabled: Boolean(tenantId),
    retry: false,
  });
  const certificatesQuery = useQuery({
    queryKey: ['certificates', tenantId],
    queryFn: ({ signal }) => certificatesApi.list(tenantId!, signal),
    enabled: Boolean(tenantId),
    retry: false,
  });

  const currentTemplate = templatesQuery.data?.find((item) => item.isDefault) ?? templatesQuery.data?.[0] ?? null;
  const selectedCertificate = certificatesQuery.data?.find((item) => item.id === selectedCertificateId) ?? null;
  const previewQuery = useQuery({
    queryKey: ['certificate-preview', tenantId, selectedCertificateId],
    queryFn: ({ signal }) => certificatesApi.download(tenantId!, selectedCertificateId!, signal),
    enabled: Boolean(tenantId && selectedCertificateId && selectedCertificate?.status === 'Ready'),
    retry: false,
  });

  useEffect(() => {
    if (!currentTemplate || currentTemplate.id === loadedTemplateId) return;
    setDraft(templatePayload(currentTemplate));
    setLoadedTemplateId(currentTemplate.id);
  }, [currentTemplate, loadedTemplateId]);

  useEffect(() => {
    if (!previewQuery.data) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(previewQuery.data);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [previewQuery.data]);

  useEffect(() => {
    if (!selectedCertificateId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('certificate-preview')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedCertificate?.id, selectedCertificateId]);

  const saveMutation = useMutation({
    mutationFn: () => currentTemplate
      ? certificateTemplatesApi.update(tenantId!, currentTemplate.id, draft)
      : certificateTemplatesApi.create(tenantId!, draft),
    onSuccess: async (saved) => {
      setDraft(templatePayload(saved));
      setLoadedTemplateId(saved.id);
      setTemplateMessage('تم حفظ قالب الشهادة.');
      await queryClient.invalidateQueries({ queryKey: ['certificate-templates', tenantId] });
    },
    onError: (error) => setTemplateMessage(templateErrorMessage(error)),
  });
  const retryMutation = useMutation({
    mutationFn: (certificateId: string) => certificatesApi.retry(tenantId!, certificateId),
    onMutate: () => setActionError(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['certificates', tenantId] });
    },
    onError: () => setActionError('تعذر بدء إعادة التجهيز. حاول مجددًا.'),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setTemplateMessage(null);
    saveMutation.mutate();
  }

  async function download(certificate: CertificateListItem) {
    setDownloadingId(certificate.id);
    setActionError(null);
    try {
      const blob = await certificatesApi.download(tenantId!, certificate.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${certificate.certificateNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setActionError('تعذر تنزيل الشهادة الآن.');
    } finally {
      setDownloadingId(null);
    }
  }

  async function copyPublicLink(certificate: CertificateListItem) {
    if (!certificate.publicUrl) return;
    try {
      await navigator.clipboard.writeText(certificate.publicUrl);
      setCopyState({ id: certificate.id, status: 'copied' });
    } catch {
      setCopyState({ id: certificate.id, status: 'failed' });
    }
  }

  if (!tenantId) return <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">اختر مساحة عمل أولًا.</p>;

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h1 className="text-balance text-2xl font-black text-[var(--teacher-ink)]">الشهادات</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--teacher-muted)]">تابع شهادات الطلاب الناتجة عن الاختبارات الناجحة.</p>
      </header>

      <section aria-labelledby="issued-title">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="issued-title" className="text-xl font-black text-[var(--teacher-ink)]">شهادات الطلاب</h2>
            <p className="mt-1 text-sm text-[var(--teacher-muted)]">الأحدث أولًا، مع حالة واضحة لكل شهادة.</p>
          </div>
          {certificatesQuery.data ? <span className="text-sm font-bold text-slate-500">{certificatesQuery.data.length} شهادة</span> : null}
        </div>

        {actionError ? <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{actionError}</p> : null}
        {certificatesQuery.isLoading ? <CertificatesLoading /> : null}
        {certificatesQuery.isError ? (
          <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
            <p>تعذر تحميل الشهادات الآن.</p>
            <button type="button" onClick={() => void certificatesQuery.refetch()} className="mt-3 min-h-11 rounded-lg border border-rose-300 bg-white px-4 py-2 font-bold hover:bg-rose-100">إعادة المحاولة</button>
          </div>
        ) : null}
        {certificatesQuery.data?.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <p className="font-black text-slate-800">لا توجد شهادات بعد</p>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">تظهر الشهادات هنا بعد اجتياز الطلاب اختبارات تدعم إصدار الشهادة.</p>
          </div>
        ) : null}
        {certificatesQuery.data && certificatesQuery.data.length > 0 ? (
          <CertificatesList
            certificates={certificatesQuery.data}
            selectedCertificateId={selectedCertificateId}
            downloadingId={downloadingId}
            copyState={copyState}
            retrying={retryMutation.isPending}
            onPreview={setSelectedCertificateId}
            onDownload={(certificate) => void download(certificate)}
            onCopy={(certificate) => void copyPublicLink(certificate)}
            onRetry={(certificateId) => retryMutation.mutate(certificateId)}
          />
        ) : null}
      </section>

      {selectedCertificate ? (
        <CertificatePreview
          certificate={selectedCertificate}
          previewUrl={previewUrl}
          isPending={previewQuery.isPending}
          isError={previewQuery.isError}
          onRetry={() => void previewQuery.refetch()}
          onClose={() => setSelectedCertificateId(null)}
          onDownload={() => void download(selectedCertificate)}
        />
      ) : null}

      <details className="teacher-surface group overflow-hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--teacher-primary)]">
          <div>
            <h2 className="font-black text-[var(--teacher-ink)]">تخصيص قالب الشهادة</h2>
            <p className="mt-1 text-sm text-[var(--teacher-muted)]">تُحفظ بيانات القالب داخل كل شهادة وقت الإصدار.</p>
          </div>
          <span aria-hidden="true" className="text-xl text-slate-500 transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-slate-200 p-5 sm:p-6">
          {templatesQuery.isLoading ? <div className="h-44 rounded-xl bg-slate-100 motion-safe:animate-pulse" role="status" aria-label="جارٍ تحميل قالب الشهادة" /> : null}
          {templatesQuery.isError ? (
            <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
              <p>تعذر تحميل قالب الشهادة.</p>
              <button type="button" onClick={() => void templatesQuery.refetch()} className="mt-3 min-h-11 rounded-lg border border-rose-300 bg-white px-4 py-2 font-bold hover:bg-rose-100">إعادة المحاولة</button>
            </div>
          ) : null}
          {!templatesQuery.isLoading && !templatesQuery.isError ? (
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <FormField id="certificate-name" label="اسم القالب">{(props) => <TextInput {...props} required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />}</FormField>
              <FormField id="certificate-title" label="عنوان الشهادة">{(props) => <TextInput {...props} required maxLength={200} value={draft.titleText} onChange={(event) => setDraft({ ...draft, titleText: event.target.value })} />}</FormField>
              <div className="sm:col-span-2"><FormField id="certificate-body" label="عبارة التكريم">{(props) => <TextArea {...props} required maxLength={500} rows={3} value={draft.bodyText} onChange={(event) => setDraft({ ...draft, bodyText: event.target.value })} />}</FormField></div>
              <FormField id="certificate-issuer" label="اسم الجهة المصدرة">{(props) => <TextInput {...props} required maxLength={200} value={draft.issuerName} onChange={(event) => setDraft({ ...draft, issuerName: event.target.value })} />}</FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField id="certificate-primary" label="اللون الأساسي">{(props) => <TextInput {...props} type="color" value={draft.primaryColor} onChange={(event) => setDraft({ ...draft, primaryColor: event.target.value })} />}</FormField>
                <FormField id="certificate-secondary" label="لون التمييز">{(props) => <TextInput {...props} type="color" value={draft.secondaryColor} onChange={(event) => setDraft({ ...draft, secondaryColor: event.target.value })} />}</FormField>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? <ButtonSpinner /> : currentTemplate ? 'حفظ التعديلات' : 'إنشاء القالب'}</Button>
                {templateMessage ? <p role="status" className="text-sm text-slate-600">{templateMessage}</p> : null}
              </div>
            </form>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function CertificatesList({
  certificates,
  selectedCertificateId,
  downloadingId,
  copyState,
  retrying,
  onPreview,
  onDownload,
  onCopy,
  onRetry,
}: {
  certificates: CertificateListItem[];
  selectedCertificateId: string | null;
  downloadingId: string | null;
  copyState: { id: string; status: 'copied' | 'failed' } | null;
  retrying: boolean;
  onPreview: (certificateId: string) => void;
  onDownload: (certificate: CertificateListItem) => void;
  onCopy: (certificate: CertificateListItem) => void;
  onRetry: (certificateId: string) => void;
}) {
  return (
    <div className="teacher-surface overflow-hidden">
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 text-start font-bold">الطالب</th><th className="px-4 py-3 text-start font-bold">الاختبار</th><th className="px-4 py-3 text-start font-bold">التاريخ</th><th className="px-4 py-3 text-start font-bold">الحالة</th><th className="px-4 py-3 text-start font-bold">الإجراءات</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {certificates.map((certificate) => (
              <tr key={certificate.id} className={selectedCertificateId === certificate.id ? 'bg-emerald-50/50' : 'transition-colors hover:bg-slate-50/70'}>
                <td className="px-4 py-4"><p className="font-black text-slate-900">{certificate.studentName}</p><p className="mt-1 text-xs text-slate-500">{Math.round(certificate.percentage)}%</p></td>
                <td className="px-4 py-4 text-slate-700">{certificate.quizTitle}</td>
                <td className="px-4 py-4 text-slate-600"><time dateTime={certificate.issuedAt}>{formatDate(certificate.issuedAt)}</time></td>
                <td className="px-4 py-4"><StatusBadge status={certificate.status} /></td>
                <td className="px-4 py-4"><CertificateActions certificate={certificate} downloading={downloadingId === certificate.id} copyState={copyState?.id === certificate.id ? copyState.status : null} retrying={retrying} onPreview={onPreview} onDownload={onDownload} onCopy={onCopy} onRetry={onRetry} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-slate-200 md:hidden">
        {certificates.map((certificate) => (
          <li key={certificate.id} className="p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black text-slate-900">{certificate.studentName}</p><p className="mt-1 text-sm text-slate-600">{certificate.quizTitle}</p></div><StatusBadge status={certificate.status} /></div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500"><time dateTime={certificate.issuedAt}>{formatDate(certificate.issuedAt)}</time><span>{Math.round(certificate.percentage)}%</span></div>
            <div className="mt-4"><CertificateActions certificate={certificate} downloading={downloadingId === certificate.id} copyState={copyState?.id === certificate.id ? copyState.status : null} retrying={retrying} onPreview={onPreview} onDownload={onDownload} onCopy={onCopy} onRetry={onRetry} mobile /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CertificateActions({ certificate, downloading, copyState, retrying, onPreview, onDownload, onCopy, onRetry, mobile = false }: {
  certificate: CertificateListItem;
  downloading: boolean;
  copyState: 'copied' | 'failed' | null;
  retrying: boolean;
  onPreview: (certificateId: string) => void;
  onDownload: (certificate: CertificateListItem) => void;
  onCopy: (certificate: CertificateListItem) => void;
  onRetry: (certificateId: string) => void;
  mobile?: boolean;
}) {
  if (certificate.status === 'Failed') {
    return <button type="button" disabled={retrying} onClick={() => onRetry(certificate.id)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60">إعادة المحاولة</button>;
  }
  if (certificate.status === 'Pending') return <span className="text-sm text-amber-800">سيتم تحديث الحالة تلقائيًا.</span>;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${mobile ? '[&>button]:flex-1' : ''}`}>
      <button type="button" onClick={() => onPreview(certificate.id)} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--teacher-primary)] px-3 py-2 text-sm font-black text-white hover:bg-[var(--teacher-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teacher-primary)]">عرض الشهادة</button>
      <button type="button" disabled={downloading} onClick={() => onDownload(certificate)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{downloading ? 'جارٍ التنزيل…' : 'تنزيل'}</button>
      {certificate.publicUrl ? <button type="button" onClick={() => onCopy(certificate)} className="inline-flex min-h-11 items-center justify-center px-2 text-sm font-bold text-[var(--teacher-primary-strong)] hover:underline">{copyState === 'copied' ? 'تم نسخ رابط الشهادة ✓' : 'نسخ رابط الشهادة'}</button> : null}
      {copyState === 'failed' && certificate.publicUrl ? <p className="basis-full break-all rounded-lg bg-slate-50 p-2 text-xs text-slate-600" dir="ltr">{certificate.publicUrl}</p> : null}
    </div>
  );
}

function CertificatePreview({ certificate, previewUrl, isPending, isError, onRetry, onClose, onDownload }: { certificate: CertificateListItem; previewUrl: string | null; isPending: boolean; isError: boolean; onRetry: () => void; onClose: () => void; onDownload: () => void }) {
  return (
    <section id="certificate-preview" aria-labelledby="certificate-preview-heading" className="teacher-surface overflow-hidden scroll-mt-24">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><h2 id="certificate-preview-heading" className="text-lg font-black text-[var(--teacher-ink)]">شهادة {certificate.studentName}</h2><p className="mt-1 text-sm text-[var(--teacher-muted)]">{certificate.quizTitle}</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={onDownload}>تنزيل</Button><Button variant="secondary" onClick={onClose}>إغلاق المعاينة</Button></div>
      </div>
      {isPending ? <div className="h-[32rem] bg-slate-100 motion-safe:animate-pulse" role="status" aria-label="جارٍ تحميل معاينة الشهادة" /> : null}
      {isError ? <div role="alert" className="m-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800"><p>تعذر عرض الشهادة الآن.</p><button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-lg border border-rose-300 bg-white px-4 py-2 font-bold hover:bg-rose-100">إعادة المحاولة</button></div> : null}
      {previewUrl ? <iframe title="معاينة الشهادة" src={previewUrl} className="h-[70vh] min-h-[32rem] w-full bg-slate-100" /> : null}
    </section>
  );
}

function StatusBadge({ status }: { status: CertificateListItem['status'] }) {
  const labels = { Pending: 'جارٍ التجهيز', Ready: 'جاهزة', Failed: 'تعذر التجهيز' };
  const colors = { Pending: 'bg-amber-50 text-amber-800', Ready: 'bg-emerald-50 text-emerald-800', Failed: 'bg-rose-50 text-rose-800' };
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${colors[status]}`}>{labels[status]}</span>;
}

function CertificatesLoading() {
  return <div role="status" aria-label="جارٍ تحميل الشهادات" className="teacher-surface space-y-3 p-5 motion-safe:animate-pulse"><div className="h-16 rounded-xl bg-slate-100" /><div className="h-16 rounded-xl bg-slate-100" /></div>;
}

function formatDate(dateTime: string) {
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(dateTime));
}
