import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { FormField, TextInput } from '../../components/ui/form-field';
import { ButtonSpinner } from '../../components/ui/spinner';
import { tenantsApi } from '../../data/api-client/endpoints';
import { HttpError } from '../../data/api-client/http-error';
import { setActiveWorkspaceId } from '../../lib/auth/session';
import { useSessionSnapshot } from '../../features/auth/use-session';

const COUNTRY_OPTIONS = [
  { code: 'SA', name: 'السعودية' },
  { code: 'EG', name: 'مصر' },
  { code: 'AE', name: 'الإمارات' },
  { code: 'JO', name: 'الأردن' },
  { code: 'KW', name: 'الكويت' },
];

const TIMEZONE_OPTIONS = [
  'Asia/Riyadh',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Amman',
  'Asia/Kuwait',
];

/** /onboarding — ينشئ Workspace حقيقية عبر API */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSessionSnapshot();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [countryCode, setCountryCode] = useState('SA');
  const [timezone, setTimezone] = useState('Asia/Riyadh');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugAuto, setSlugAuto] = useState(true);

  // توليد slug تلقائي من الاسم إذا لم يعدّله المستخدم يدويًا
  useEffect(() => {
    if (slugAuto) {
      const generated = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, '') // يحافظ على العربية أحرف/أرقام
        .replace(/\s+/g, '-')
        .slice(0, 40);
      setSlug(generated);
    }
  }, [name, slugAuto]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!session.user) return;

    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'اسم مساحة العمل مطلوب (حرفان على الأقل)';
    if (slug.trim().length < 3) next.slug = 'الرابط القصير مطلوب (3 أحرف على الأقل)';
    if (!/^[a-zA-Z0-9-_]+$/.test(slug.trim())) next.slug = 'الرابط القصير يقبل أحرفًا إنجليزية وأرقامًا وشرطات فقط';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSubmitting(true);
    setApiError(null);
    try {
      const created = await tenantsApi.create({
        name: name.trim(),
        slug: slug.trim(),
        countryCode,
        timezone,
        defaultLocale: 'ar',
      });
      setActiveWorkspaceId(created.id);
      // أعلِم TanStack Query بأن قائمة Workspaces تغيّرت
      await queryClient.invalidateQueries({ queryKey: ['tenants', 'mine'] });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        setApiError('هذا الرابط القصير مستخدم بالفعل. غيّره قليلًا وحاول مجددًا.');
      } else if (error instanceof HttpError && error.status === 400) {
        setApiError('البيانات غير مكتملة. راجع الحقول وأعد المحاولة.');
      } else {
        setApiError('تعذر إنشاء مساحة العمل. حاول مرة أخرى لاحقًا.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-xl font-bold text-slate-900">إنشاء مساحة عملك</h1>
      <p className="mb-6 text-sm text-slate-600">
        هذه خطوة واحدة تُكمل بها إعداد حسابك. ستصبح تلقائيًا مالك مساحة العمل.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormField id="name" label="اسم مساحة العمل" error={errors.name}>
          {(props) => (
            <TextInput
              {...props}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: صف اللغة الإنجليزية"
            />
          )}
        </FormField>

        <FormField id="slug" label="رابط مساحة العمل" error={errors.slug}>
          {(props) => (
            <TextInput
              {...props}
              dir="ltr"
              value={slug}
              onChange={(e) => {
                setSlugAuto(false);
                setSlug(e.target.value);
              }}
              placeholder="english-class-101"
              aria-describedby="slug-hint"
            />
          )}
        </FormField>
        <p id="slug-hint" className="text-xs text-slate-500">
          اختر رابطًا قصيرًا بالإنجليزية، مثل: {slug || 'english-class-101'}
        </p>

        <FormField id="country" label="الدولة" error={errors.countryCode}>
          {(props) => (
            <select
              {...props}
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-2 focus:outline-sky-600">
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField id="timezone" label="المنطقة الزمنية" error={errors.timezone}>
          {(props) => (
            <select
              {...props}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-2 focus:outline-sky-600">
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          )}
        </FormField>

        {apiError ? (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {apiError}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <ButtonSpinner /> : 'إنشاء ودخول لوحة التحكم'}
        </Button>
      </form>
    </section>
  );
}
