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
  { code: 'SA', name: 'Ø§Ù„Ø³Ø¹ÙˆØ¯ÙŠØ©' },
  { code: 'EG', name: 'Ù…ØµØ±' },
  { code: 'AE', name: 'Ø§Ù„Ø¥Ù…Ø§Ø±Ø§Øª' },
  { code: 'JO', name: 'Ø§Ù„Ø£Ø±Ø¯Ù†' },
  { code: 'KW', name: 'Ø§Ù„ÙƒÙˆÙŠØª' },
];

const TIMEZONE_OPTIONS = [
  'Asia/Riyadh',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Amman',
  'Asia/Kuwait',
];

/** /onboarding â€” ÙŠÙ†Ø´Ø¦ Workspace Ø­Ù‚ÙŠÙ‚ÙŠØ© Ø¹Ø¨Ø± API */
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

  // ØªÙˆÙ„ÙŠØ¯ slug ØªÙ„Ù‚Ø§Ø¦ÙŠ Ù…Ù† Ø§Ù„Ø§Ø³Ù… Ø¥Ø°Ø§ Ù„Ù… ÙŠØ¹Ø¯Ù‘Ù„Ù‡ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ÙŠØ¯ÙˆÙŠÙ‹Ø§
  useEffect(() => {
    if (slugAuto) {
      const generated = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, '') // ÙŠØ­Ø§ÙØ¸ Ø¹Ù„Ù‰ Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© Ø£Ø­Ø±Ù/Ø£Ø±Ù‚Ø§Ù…
        .replace(/\s+/g, '-')
        .slice(0, 40);
      setSlug(generated);
    }
  }, [name, slugAuto]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!session.user) return;

    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Ø§Ø³Ù… Workspace Ù…Ø·Ù„ÙˆØ¨ (Ø­Ø±ÙØ§Ù† Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„)';
    if (slug.trim().length < 3) next.slug = 'Slug Ù…Ø·Ù„ÙˆØ¨ (3 Ø£Ø­Ø±Ù Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„)';
    if (!/^[a-zA-Z0-9-_]+$/.test(slug.trim())) next.slug = 'Slug ÙŠØ¬Ø¨ Ø£Ù† ÙŠØ­ØªÙˆÙŠ Ø£Ø­Ø±ÙÙ‹Ø§ ÙˆØ£Ø±Ù‚Ø§Ù…Ù‹Ø§ ÙˆØ´Ø±Ø·Ø§Øª ÙÙ‚Ø·';
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
      // Ø£Ø¹Ù„ÙÙ… TanStack Query Ø¨Ø£Ù† Ù‚Ø§Ø¦Ù…Ø© Workspaces ØªØºÙŠÙ‘Ø±Øª
      await queryClient.invalidateQueries({ queryKey: ['tenants', 'mine'] });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        setApiError('Ù‡Ø°Ø§ Ø§Ù„Ù€Slug Ù…Ø³ØªØ®Ø¯Ù… Ø¨Ø§Ù„ÙØ¹Ù„. ØºÙŠÙ‘Ø±Ù‡ Ù‚Ù„ÙŠÙ„Ù‹Ø§ ÙˆØ­Ø§ÙˆÙ„ Ù…Ø¬Ø¯Ø¯Ù‹Ø§.');
      } else if (error instanceof HttpError && error.status === 400) {
        setApiError('Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª ØºÙŠØ± Ù…ÙƒØªÙ…Ù„Ø©. Ø±Ø§Ø¬Ø¹ Ø§Ù„Ø­Ù‚ÙˆÙ„ ÙˆØ£Ø¹Ø¯ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø©.');
      } else {
        setApiError('ØªØ¹Ø°Ø± Ø¥Ù†Ø´Ø§Ø¡ Workspace. Ø­Ø§ÙˆÙ„ Ù…Ø±Ø© Ø£Ø®Ø±Ù‰ Ù„Ø§Ø­Ù‚Ù‹Ø§.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-xl font-bold text-slate-900">Ø¥Ù†Ø´Ø§Ø¡ Ù…Ø³Ø§Ø­Ø© Ø¹Ù…Ù„Ùƒ</h1>
      <p className="mb-6 text-sm text-slate-600">
        Ù‡Ø°Ù‡ Ø®Ø·ÙˆØ© ÙˆØ§Ø­Ø¯Ø© ØªÙÙƒÙ…Ù„ Ø¨Ù‡Ø§ Ø¥Ø¹Ø¯Ø§Ø¯ Ø­Ø³Ø§Ø¨Ùƒ. Ø³ØªØµØ¨Ø­ ØªÙ„Ù‚Ø§Ø¦ÙŠÙ‹Ø§ Ù…Ø§Ù„Ùƒ Workspace.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormField id="name" label="Ø§Ø³Ù… Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„" error={errors.name}>
          {(props) => (
            <TextInput
              {...props}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ù…Ø«Ø§Ù„: ØµÙ Ø§Ù„Ù„ØºØ© Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ©"
            />
          )}
        </FormField>

        <FormField id="slug" label="Slug (Ø±Ø§Ø¨Ø· Ù‚ØµÙŠØ± ÙØ±ÙŠØ¯)" error={errors.slug}>
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
          Ø³ÙŠÙØ³ØªØ®Ø¯Ù… ÙÙŠ Ø±ÙˆØ§Ø¨Ø· Ù…Ø´Ø§Ø±ÙƒØ© Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø±Ø§Øª: {slug || 'your-slug'}
        </p>

        <FormField id="country" label="Ø§Ù„Ø¯ÙˆÙ„Ø©" error={errors.countryCode}>
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

        <FormField id="timezone" label="Ø§Ù„Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø²Ù…Ù†ÙŠØ©" error={errors.timezone}>
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
          {isSubmitting ? <ButtonSpinner /> : 'Ø¥Ù†Ø´Ø§Ø¡ ÙˆØ¯Ø®ÙˆÙ„ Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…'}
        </Button>
      </form>
    </section>
  );
}
