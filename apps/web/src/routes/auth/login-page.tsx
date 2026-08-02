import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { FormField, TextInput } from '../../components/ui/form-field';
import { ButtonSpinner } from '../../components/ui/spinner';
import { authApi, tenantsApi } from '../../data/api-client/endpoints';
import { HttpError } from '../../data/api-client/http-error';
import { setActiveWorkspaceId } from '../../lib/auth/session';

/** /auth/login — بعد النجاح: لا Workspace → onboarding، واحدة → dashboard، أكثر → اختيار */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'صيغة البريد الإلكتروني غير صحيحة';
    if (password.length === 0) next.password = 'كلمة المرور مطلوبة';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function redirectAfterLogin() {
    const workspaces = await tenantsApi.listMine();
    if (workspaces.length === 0) {
      navigate('/onboarding', { replace: true });
      return;
    }
    if (workspaces.length === 1) {
      setActiveWorkspaceId(workspaces[0]!.id);
      navigate(from && from !== '/auth/login' ? from : '/dashboard', { replace: true });
      return;
    }
    navigate('/onboarding/choose', { replace: true, state: { workspaces } });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setAuthError(null);
    try {
      await authApi.login({ email: email.trim(), password });
      await redirectAfterLogin();
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 401) {
          setAuthError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
        } else if (error.status === 403) {
          setAuthError('يرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول.');
        } else if (error.status === 423) {
          setAuthError('الحساب مقفل مؤقتًا بسبب محاولات فاشلة متكررة. حاول لاحقًا.');
        } else {
          setAuthError('حدث خطأ غير متوقع. حاول مرة أخرى لاحقًا.');
        }
      } else {
        setAuthError('تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-xl font-bold text-slate-900">تسجيل الدخول</h1>
      <p className="mb-6 text-sm text-slate-600">عد إلى مساحتك التعليمية.</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormField id="email" label="البريد الإلكتروني" error={errors.email}>
          {(props) => (
            <TextInput
              {...props}
              type="email"
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </FormField>

        <FormField id="password" label="كلمة المرور" error={errors.password}>
          {(props) => (
            <TextInput
              {...props}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </FormField>

        {authError ? (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {authError}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <ButtonSpinner /> <span className="sr-only">جارٍ تسجيل الدخول…</span>
            </>
          ) : (
            'تسجيل الدخول'
          )}
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2 text-sm">
        <Link to="/auth/forgot-password" className="text-sky-700 underline underline-offset-4">
          نسيت كلمة المرور؟
        </Link>
        <p className="text-slate-600">
          ليس لديك حساب؟{' '}
          <Link to="/auth/signup" className="font-medium text-sky-700 underline underline-offset-4">
            إنشاء حساب
          </Link>
        </p>
      </div>
    </section>
  );
}
