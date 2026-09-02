import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { FormField, TextArea, TextInput } from '../../components/ui/form-field';
import { ButtonSpinner } from '../../components/ui/spinner';
import { commercialWorkspaceApi } from '../../data/api-client/commercial-endpoints';
import { tenantTransferApi, tenantsApi } from '../../data/api-client/endpoints';
import { HttpError } from '../../data/api-client/http-error';
import { getActiveTenantId } from '../../lib/auth/session';

interface BrandingDraft {
  publicTeacherName: string;
  brandDisplayName: string;
  studentPortalWelcomeText: string;
  primaryColor: string;
  secondaryColor: string;
  supportContact: string;
}

const entitlementLabels: Array<[keyof NonNullable<ReturnType<typeof entitlementShape>>, string]> = [
  ['bulkImport', 'استيراد جماعي'],
  ['advancedReports', 'تقارير متقدمة'],
  ['certificates', 'شهادات'],
  ['customBranding', 'هوية مساحة العمل'],
  ['dataExport', 'تصدير البيانات'],
];

function entitlementShape() {
  return {
    bulkImport: false,
    advancedReports: false,
    certificates: false,
    customBranding: false,
    dataExport: false,
  };
}

function statusLabel(status?: string) {
  switch (status) {
    case 'Active': return 'نشطة';
    case 'Expired': return 'منتهية';
    case 'Inactive': return 'لم تبدأ بعد';
    case 'Suspended': return 'موقوفة';
    case 'Cancelled': return 'ملغاة';
    case 'Grandfathered': return 'حساب حالي محفوظ';
    default: return status || 'غير محددة';
  }
}

function usageTone(value: number, limit: number) {
  if (limit <= 0) return 'border-slate-200 bg-slate-50';
  const ratio = value / limit;
  if (ratio >= 1) return 'border-rose-200 bg-rose-50';
  if (ratio >= 0.8) return 'border-amber-200 bg-amber-50';
  return 'border-slate-200 bg-white';
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const activeTenantId = getActiveTenantId();

  const settingsQuery = useQuery({
    queryKey: ['tenant', activeTenantId, 'settings'],
    queryFn: ({ signal }) => tenantsApi.getSettings(activeTenantId!, signal),
    enabled: Boolean(activeTenantId),
  });
  const commercialQuery = useQuery({
    queryKey: ['tenant', activeTenantId, 'commercial'],
    queryFn: ({ signal }) => commercialWorkspaceApi.get(activeTenantId!, signal),
    enabled: Boolean(activeTenantId),
  });

  const [draft, setDraft] = useState<BrandingDraft>({
    publicTeacherName: '',
    brandDisplayName: '',
    studentPortalWelcomeText: '',
    primaryColor: '',
    secondaryColor: '',
    supportContact: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transferFile, setTransferFile] = useState<File | null>(null);
  const [validatedFileKey, setValidatedFileKey] = useState<string | null>(null);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    const settings = settingsQuery.data;
    if (!settings) return;
    setDraft({
      publicTeacherName: settings.publicTeacherName ?? '',
      brandDisplayName: settings.brandDisplayName ?? '',
      studentPortalWelcomeText: settings.studentPortalWelcomeText ?? '',
      primaryColor: settings.primaryColor ?? '',
      secondaryColor: settings.secondaryColor ?? '',
      supportContact: settings.supportContact ?? '',
    });
  }, [settingsQuery.data]);

  const commercial = commercialQuery.data;
  const brandingEnabled = commercial?.isGrandfathered || commercial?.entitlements.customBranding === true;
  const dataExportEnabled = commercial?.isGrandfathered || commercial?.entitlements.dataExport === true;

  const usageItems = useMemo(() => {
    if (!commercial) return [];
    return [
      { label: 'الطلاب', value: commercial.usage.students, limit: commercial.limits.maxStudents },
      { label: 'أعضاء الفريق', value: commercial.usage.members, limit: commercial.limits.maxMembers },
      commercial.usage.classes == null
        ? { label: 'الفصول', value: null, limit: commercial.limits.maxClasses }
        : { label: 'الفصول', value: commercial.usage.classes, limit: commercial.limits.maxClasses },
      commercial.usage.activeAssignments == null
        ? { label: 'التكليفات النشطة', value: null, limit: commercial.limits.maxActiveAssignments }
        : {
            label: 'التكليفات النشطة',
            value: commercial.usage.activeAssignments,
            limit: commercial.limits.maxActiveAssignments,
          },
    ];
  }, [commercial]);

  if (!activeTenantId) return null;

  function validate() {
    const next: Record<string, string> = {};
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    if (draft.primaryColor && !hexPattern.test(draft.primaryColor)) {
      next.primaryColor = 'اللون يجب أن يكون بصيغة #RRGGBB';
    }
    if (draft.secondaryColor && !hexPattern.test(draft.secondaryColor)) {
      next.secondaryColor = 'اللون يجب أن يكون بصيغة #RRGGBB';
    }
    if (draft.brandDisplayName.length > 120) next.brandDisplayName = 'الاسم طويل أكثر من اللازم.';
    if (draft.studentPortalWelcomeText.length > 500) next.studentPortalWelcomeText = 'النص يجب ألا يتجاوز 500 حرف.';
    if (draft.supportContact.length > 200) next.supportContact = 'بيانات التواصل طويلة أكثر من اللازم.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate() || !brandingEnabled) return;

    setIsSubmitting(true);
    setApiError(null);
    setSuccessMessage(null);
    try {
      await commercialWorkspaceApi.updateBranding(activeTenantId!, {
        publicTeacherName: draft.publicTeacherName || null,
        brandDisplayName: draft.brandDisplayName || null,
        studentPortalWelcomeText: draft.studentPortalWelcomeText || null,
        primaryColor: draft.primaryColor || null,
        secondaryColor: draft.secondaryColor || null,
        supportContact: draft.supportContact || null,
      });
      setSuccessMessage('تم حفظ هوية مساحة العمل بنجاح.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tenant', activeTenantId, 'settings'] }),
        queryClient.invalidateQueries({ queryKey: ['tenant', activeTenantId, 'commercial'] }),
      ]);
    } catch (error) {
      if (error instanceof HttpError && error.status === 403) {
        setApiError('هذه الميزة غير متاحة في خطتك الحالية. يمكن لمالك المساحة طلب ترقية الخطة.');
      } else if (error instanceof HttpError && error.status === 400) {
        setApiError('بعض بيانات الهوية غير صحيحة. راجع الحقول ثم أعد المحاولة.');
      } else {
        setApiError('تعذر حفظ الإعدادات. حاول مرة أخرى.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function fileKey(file: File) {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }

  async function exportContent() {
    if (!dataExportEnabled) {
      setTransferMessage('تصدير البيانات غير متاح في خطتك الحالية. اطلب ترقية الخطة لتفعيل الميزة.');
      return;
    }
    setIsTransferring(true);
    setTransferMessage(null);
    try {
      const archive = await tenantTransferApi.exportArchive(activeTenantId!);
      const url = URL.createObjectURL(archive);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `workspace-content-${new Date().toISOString().slice(0, 10)}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      setTransferMessage('تم تجهيز نسخة المحتوى وتنزيلها.');
    } catch (error) {
      setTransferMessage(error instanceof HttpError && error.status === 403
        ? 'تصدير البيانات غير متاح في خطتك الحالية.'
        : 'تعذر تصدير المحتوى. حاول مجددًا.');
    } finally {
      setIsTransferring(false);
    }
  }

  async function importContent(dryRun: boolean) {
    if (!transferFile) return;
    setIsTransferring(true);
    setTransferMessage(null);
    try {
      const summary = await tenantTransferApi.importArchive(activeTenantId!, transferFile, dryRun);
      const contentCount = Object.values(summary.counts).reduce((total, count) => total + count, 0);
      if (dryRun) {
        setValidatedFileKey(fileKey(transferFile));
        setTransferMessage(`الفحص ناجح: ${contentCount.toLocaleString('ar-EG')} سجل محتوى جاهز للاستيراد.`);
      } else {
        setValidatedFileKey(null);
        setTransferFile(null);
        setTransferMessage('تم استيراد المحتوى وإعادة ربطه بمساحة العمل الحالية.');
      }
    } catch (error) {
      setValidatedFileKey(null);
      setTransferMessage(error instanceof HttpError && error.status === 403
        ? 'تجاوز الاستيراد حدود الخطة أو لا تملك الصلاحية المطلوبة.'
        : 'الملف غير صالح أو تعذر استيراده. لم تُحفظ تغييرات جزئية.');
    } finally {
      setIsTransferring(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="commercial-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black text-violet-700">English Spark</p>
            <h1 id="commercial-heading" className="mt-1 text-2xl font-black text-slate-950">الخطة والاستخدام</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">صورة هادئة عن سعة مساحة العمل والميزات المتاحة للمالك.</p>
          </div>
          {commercial ? (
            <div className="rounded-xl bg-slate-950 px-4 py-3 text-left text-white" dir="ltr">
              <p className="text-xs text-slate-300">{statusLabel(commercial.commercialStatus)}</p>
              <p className="mt-1 font-black">{commercial.plan?.name ?? (commercial.isGrandfathered ? 'Current account' : 'No plan')}</p>
            </div>
          ) : null}
        </div>

        {commercialQuery.isLoading ? <p className="mt-5 text-sm text-slate-500">جارٍ تحميل بيانات الخطة…</p> : null}
        {commercialQuery.isError ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">تعذر تحميل بيانات الخطة الآن.</p> : null}

        {commercial ? (
          <>
            {commercial.isGrandfathered ? (
              <p className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
                هذا حساب قائم قبل العقد التجاري الحالي؛ تم الحفاظ على إمكاناته حتى لا يتعطل بسبب الحدود الجديدة.
              </p>
            ) : null}
            {commercial.subscription?.endsAt ? (
              <p className="mt-4 text-sm text-slate-600">انتهاء الاشتراك: <strong>{new Date(commercial.subscription.endsAt).toLocaleDateString('ar-EG')}</strong></p>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {usageItems.map((item) => (
                <div key={item.label} className={`rounded-xl border p-4 ${item.value == null ? 'border-slate-200 bg-slate-50' : usageTone(item.value, item.limit)}`}>
                  <p className="text-xs font-bold text-slate-500">{item.label}</p>
                  {item.value == null ? (
                    <p className="mt-2 text-sm font-bold text-slate-600">يُربط بعد مزامنة Classes + Assignments</p>
                  ) : (
                    <>
                      <p className="mt-2 text-xl font-black text-slate-950">{item.value.toLocaleString('ar-EG')} / {item.limit.toLocaleString('ar-EG')}</p>
                      {item.limit > 0 && item.value / item.limit >= 0.8 ? <p className="mt-1 text-xs font-bold text-amber-800">اقتربت من الحد</p> : null}
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2" aria-label="ميزات الخطة">
              {entitlementLabels.map(([key, label]) => {
                const enabled = commercial.isGrandfathered || commercial.entitlements[key];
                return <span key={key} className={`rounded-full px-3 py-1.5 text-xs font-bold ${enabled ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{enabled ? '✓' : '—'} {label}</span>;
              })}
            </div>
          </>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">هوية مساحة العمل</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">English Spark تظل هوية المنصة، وهنا تضبط هوية العميل داخل الحدود الآمنة فقط.</p>
          </div>
          {!commercialQuery.isLoading && !brandingEnabled ? <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">تحتاج خطة تدعم الهوية المخصصة</span> : null}
        </div>

        {settingsQuery.isLoading ? <p className="mt-5 text-sm text-slate-500">جارٍ تحميل الإعدادات…</p> : null}
        {settingsQuery.isError ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">تعذر تحميل الإعدادات الحالية.</p> : null}

        {!settingsQuery.isLoading && !settingsQuery.isError ? (
          <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2" noValidate>
            <FormField id="brandDisplayName" label="اسم الجهة الظاهر" error={errors.brandDisplayName}>
              {(props) => <TextInput {...props} disabled={!brandingEnabled} value={draft.brandDisplayName} onChange={(e) => setDraft((d) => ({ ...d, brandDisplayName: e.target.value }))} />}
            </FormField>
            <FormField id="publicTeacherName" label="اسم المعلم الظاهر للطلاب">
              {(props) => <TextInput {...props} disabled={!brandingEnabled} value={draft.publicTeacherName} onChange={(e) => setDraft((d) => ({ ...d, publicTeacherName: e.target.value }))} />}
            </FormField>
            <FormField id="primaryColor" label="اللون الأساسي" error={errors.primaryColor}>
              {(props) => <TextInput {...props} dir="ltr" disabled={!brandingEnabled} value={draft.primaryColor} placeholder="#0ea5e9" onChange={(e) => setDraft((d) => ({ ...d, primaryColor: e.target.value }))} />}
            </FormField>
            <FormField id="secondaryColor" label="اللون الثانوي" error={errors.secondaryColor}>
              {(props) => <TextInput {...props} dir="ltr" disabled={!brandingEnabled} value={draft.secondaryColor} placeholder="#f59e0b" onChange={(e) => setDraft((d) => ({ ...d, secondaryColor: e.target.value }))} />}
            </FormField>
            <FormField id="supportContact" label="بيانات تواصل الدعم" error={errors.supportContact} optional>
              {(props) => <TextInput {...props} disabled={!brandingEnabled} value={draft.supportContact} placeholder="بريد أو رقم تواصل" onChange={(e) => setDraft((d) => ({ ...d, supportContact: e.target.value }))} />}
            </FormField>
            <FormField id="studentPortalWelcomeText" label="رسالة ترحيب بوابة الطالب" error={errors.studentPortalWelcomeText} className="sm:col-span-2" optional>
              {(props) => <TextArea {...props} rows={3} disabled={!brandingEnabled} value={draft.studentPortalWelcomeText} onChange={(e) => setDraft((d) => ({ ...d, studentPortalWelcomeText: e.target.value }))} />}
            </FormField>

            {apiError ? <p role="alert" className="sm:col-span-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{apiError}</p> : null}
            {successMessage ? <p role="status" className="sm:col-span-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{successMessage}</p> : null}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={isSubmitting || !brandingEnabled}>{isSubmitting ? <ButtonSpinner /> : 'حفظ الهوية'}</Button>
            </div>
          </form>
        ) : null}
      </section>

      <section aria-labelledby="transfer-heading" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 id="transfer-heading" className="text-lg font-black text-slate-950">نقل محتوى مساحة العمل</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">صدّر البنوك والأسئلة والاختبارات والاستبانات وقوالب الشهادات والوسائط. لا يتضمن الملف كلمات المرور أو النتائج أو الاشتراك.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={isTransferring || !dataExportEnabled} onClick={() => void exportContent()}>{isTransferring ? <ButtonSpinner /> : 'تنزيل نسخة المحتوى'}</Button>
          {!commercialQuery.isLoading && !dataExportEnabled ? <span className="text-xs font-bold text-amber-800">التصدير يحتاج ميزة Data Export في الخطة.</span> : null}
        </div>
        <div className="mt-6 border-t border-slate-100 pt-5">
          <label htmlFor="tenant-import" className="block text-sm font-medium text-slate-700">نسخة محتوى مساحة العمل بصيغة ZIP</label>
          <input id="tenant-import" type="file" accept=".zip,application/zip" className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm file:ml-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2" onChange={(event) => { const file = event.target.files?.[0] ?? null; setTransferFile(file); setValidatedFileKey(null); setTransferMessage(null); }} />
          <p className="mt-2 text-xs text-slate-500">الحد الأقصى 250 م.ب. افحص الملف أولًا؛ الاستيراد يضيف نسخًا جديدة ولا يستبدل المحتوى الحالي.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="secondary" disabled={!transferFile || isTransferring} onClick={() => void importContent(true)}>فحص الملف</Button>
            <Button disabled={!transferFile || validatedFileKey !== fileKey(transferFile) || isTransferring} onClick={() => void importContent(false)}>استيراد المحتوى</Button>
          </div>
        </div>
        {transferMessage ? <p role="status" className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{transferMessage}</p> : null}
      </section>
    </div>
  );
}
