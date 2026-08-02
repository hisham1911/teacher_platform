import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { FormField, TextInput } from '../../components/ui/form-field';
import { ButtonSpinner } from '../../components/ui/spinner';
import { tenantsApi } from '../../data/api-client/endpoints';
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

  return (
    <section className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-sm">
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
  );
}
