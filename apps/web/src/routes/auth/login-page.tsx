import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
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
    <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-[0_28px_80px_rgb(76_29_149/0.12)] lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-violet-800 via-indigo-800 to-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <span aria-hidden="true" className="absolute -left-20 -top-16 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <span aria-hidden="true" className="absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-amber-300/15 blur-3xl" />
        <div className="relative">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black text-amber-200">ENGLISH SPARK STUDIO</span>
          <h2 className="mt-6 text-4xl font-black leading-tight">أنشئي النشاط.<br />واتركي الباقي علينا.</h2>
          <p className="mt-4 max-w-md text-base leading-8 text-violet-100">واجهة أبسط للمعلمة، من إنشاء الأسئلة حتى رابط الطلاب، بدون مصطلحات تقنية أو خطوات نشر معقدة.</p>
        </div>
        <div className="relative grid gap-3 text-sm font-bold text-violet-100">
          <SparkBenefit icon="✦" text="أنشطة ومسابقات من مكان واحد" />
          <SparkBenefit icon="⚡" text="تجهيز رابط الطلاب بخطوة واحدة" />
          <SparkBenefit icon="↗" text="نتائج وتقارير واضحة بعد النشاط" />
        </div>
      </aside>

      <section className="spark-auth-card border-0 p-5 shadow-none sm:p-8 lg:rounded-none lg:p-10">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-3 lg:hidden">
            <span aria-hidden="true" className="spark-brand-mark flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-2xl text-white">✦</span>
            <div>
              <p className="text-xs font-black tracking-[0.12em] text-violet-700">ENGLISH SPARK</p>
              <p className="text-sm font-bold text-slate-500">Teacher Studio</p>
            </div>
          </div>

          <div className="mt-7 lg:mt-0">
            <p className="text-sm font-black text-violet-700">مرحبًا بعودتك 👋</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">تسجيل الدخول</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">ادخلي لمساحة English Spark وابدئي نشاطك التالي بسهولة.</p>
          </div>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" noValidate>
            <FormField id="email" label="البريد الإلكتروني" error={errors.email}>
              {(props) => (
                <TextInput
                  {...props}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
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
                  placeholder="••••••••"
                />
              )}
            </FormField>

            <div className="flex justify-end">
              <Link to="/auth/forgot-password" className="inline-flex min-h-11 items-center text-sm font-bold text-violet-700 hover:text-violet-900 hover:underline">نسيت كلمة المرور؟</Link>
            </div>

            {authError ? (
              <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700">
                {authError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-base font-black text-white shadow-sm transition hover:bg-violet-800 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? (
                <>
                  <ButtonSpinner /> <span>جارٍ تسجيل الدخول…</span>
                </>
              ) : (
                <><span>دخول إلى English Spark</span><span aria-hidden="true">←</span></>
              )}
            </button>
          </form>

          <div className="mt-7 border-t border-slate-100 pt-6 text-center text-sm text-slate-600">
            ليس لديك حساب؟{' '}
            <Link to="/auth/signup" className="font-black text-violet-700 hover:text-violet-900 hover:underline">إنشاء حساب</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function SparkBenefit({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/7 p-3.5">
      <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-amber-200">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
