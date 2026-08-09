import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { FormField, TextInput } from '../../components/ui/form-field';
import { ButtonSpinner } from '../../components/ui/spinner';
import { tenantTransferApi, tenantsApi } from '../../data/api-client/endpoints';
import type { TenantSettings } from '../../types/auth';
import { getActiveTenantId } from '../../lib/auth/session';
import { HttpError } from '../../data/api-client/http-error';

/** /dashboard/settings — يقرأ ويحدّث الإعدادات المسموح بها فقط عبر Owner */
export default function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeTenantId = getActiveTenantId();

  const { data: settings, isLoading, isError } = useQuery({
    queryKey: ['tenant', activeTenantId, 'settings'],
    queryFn: ({ signal }) => tenantsApi.getSettings(activeTenantId!, signal),
    enabled: Boolean(activeTenantId),
  });

  const [draft, setDraft] = useState<Partial<TenantSettings>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transferFile, setTransferFile] = useState<File | null>(null);
  const [validatedFileKey, setValidatedFileKey] = useState<string | null>(null);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    if (settings) {
      setDraft({
        publicTeacherName: settings.publicTeacherName ?? '',
        primaryColor: settings.primaryColor ?? '',
        secondaryColor: settings.secondaryColor ?? '',
      });
    }
  }, [settings]);

  if (!activeTenantId) {
    navigate('/onboarding/choose', { replace: true });
    return null;
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    if (draft.primaryColor && !hexPattern.test(draft.primaryColor)) {
      next.primaryColor = 'اللون يجب أن يكون hex بصيغة #RRGGBB';
    }
    if (draft.secondaryColor && !hexPattern.test(draft.secondaryColor)) {
      next.secondaryColor = 'اللون يجب أن يكون hex بصيغة #RRGGBB';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setApiError(null);
    setSuccessMessage(null);
    try {
      await tenantsApi.updateSettings(activeTenantId!, {
        publicTeacherName: draft.publicTeacherName || null,
        primaryColor: draft.primaryColor || null,
        secondaryColor: draft.secondaryColor || null,
      });
      setSuccessMessage('تم حفظ الإعدادات بنجاح.');
      await queryClient.invalidateQueries({ queryKey: ['tenant', activeTenantId, 'settings'] });
    } catch (error) {
      if (error instanceof HttpError && (error.status === 403 || error.status === 401)) {
        setApiError('ليس لديك صلاحية تعديل إعدادات مساحة العمل. تواصل مع مالكها.');
      } else if (error instanceof HttpError && error.status === 400) {
        setApiError('المدخلات غير صحيحة. راجع الألوان والحقول ثم أعد المحاولة.');
      } else {
        setApiError('تعذر حفظ الإعدادات. حاول مرة أخرى لاحقًا.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function fileKey(file: File) {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }

  async function exportContent() {
    setIsTransferring(true);
    setTransferMessage(null);
    try {
      const archive = await tenantTransferApi.exportArchive(activeTenantId!);
      const url = URL.createObjectURL(archive);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `tenant-export-${new Date().toISOString().slice(0, 10)}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      setTransferMessage('تم تجهيز نسخة المحتوى وتنزيلها.');
    } catch {
      setTransferMessage('تعذر تصدير المحتوى. تأكد أنك مالك مساحة العمل وحاول مجددًا.');
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
    <div className="mx-auto max-w-2xl space-y-6">
    <section className="rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-xl font-bold text-slate-900">إعدادات مساحة العمل</h1>
      <p className="mb-6 text-sm text-slate-600">
        عدّل اسم المعلم الظاهر للطلاب والألوان الأساسية.
      </p>

      {isLoading ? <p className="text-sm text-slate-500">جارٍ تحميل الإعدادات…</p> : null}
      {isError ? (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          تعذر تحميل الإعدادات الحالية.
        </p>
      ) : null}

      {!isLoading && !isError ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormField id="publicTeacherName" label="اسم المعلم الظاهر للطلاب" error={errors.publicTeacherName}>
            {(props) => (
              <TextInput
                {...props}
                value={draft.publicTeacherName ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, publicTeacherName: e.target.value }))}
              />
            )}
          </FormField>

          <FormField id="primaryColor" label="اللون الأساسي" error={errors.primaryColor}>
            {(props) => (
              <TextInput
                {...props}
                dir="ltr"
                value={draft.primaryColor ?? ''}
                placeholder="#0ea5e9"
                onChange={(e) => setDraft((d) => ({ ...d, primaryColor: e.target.value }))}
              />
            )}
          </FormField>

          <FormField id="secondaryColor" label="اللون الثانوي" error={errors.secondaryColor}>
            {(props) => (
              <TextInput
                {...props}
                dir="ltr"
                value={draft.secondaryColor ?? ''}
                placeholder="#f59e0b"
                onChange={(e) => setDraft((d) => ({ ...d, secondaryColor: e.target.value }))}
              />
            )}
          </FormField>

          {apiError ? (
            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              {apiError}
            </p>
          ) : null}

          {successMessage ? (
            <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              {successMessage}
            </p>
          ) : null}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <ButtonSpinner /> : 'حفظ الإعدادات'}
          </Button>
        </form>
      ) : null}
    </section>

    <section aria-labelledby="transfer-heading" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <h2 id="transfer-heading" className="text-lg font-bold text-slate-900">نقل محتوى مساحة العمل</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        صدّر البنوك والأسئلة والاختبارات والاستبانات وقوالب الشهادات والوسائط. لا يتضمن الملف حسابات المستخدمين أو كلمات المرور أو النتائج.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="secondary" disabled={isTransferring} onClick={() => void exportContent()}>
          {isTransferring ? <ButtonSpinner /> : 'تنزيل نسخة المحتوى'}
        </Button>
      </div>
      <div className="mt-6 border-t border-slate-100 pt-5">
        <label htmlFor="tenant-import" className="block text-sm font-medium text-slate-700">ملف Tenant Export بصيغة ZIP</label>
        <input
          id="tenant-import"
          type="file"
          accept=".zip,application/zip"
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm file:ml-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setTransferFile(file);
            setValidatedFileKey(null);
            setTransferMessage(null);
          }}
        />
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
