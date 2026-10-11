import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { FormField, TextInput } from '../../components/ui/form-field';
import { ButtonSpinner } from '../../components/ui/spinner';
import { authApi } from '../../data/api-client/endpoints';
import { HttpError } from '../../data/api-client/http-error';

/** /auth/signup — نموذج تسجيل بسيط */
export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCheckEmail, setShowCheckEmail] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (fullName.trim().length < 2) next.fullName = 'الاسم الكامل مطلوب';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'صيغة البريد الإلكتروني غير صحيحة';
    if (password.length < 8) next.password = 'كلمة المرور يجب ألا تقل عن 8 أحرف';
    if (password !== confirmPassword) next.confirmPassword = 'تأكيد كلمة المرور لا يطابق';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setApiError(null);
    try {
      await authApi.register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      });
      setShowCheckEmail(true);
    } catch (error) {
      if (error instanceof HttpError && error.status === 400) {
        setApiError('البيانات المدخلة غير مكتملة أو البريد مستخدم بالفعل.');
      } else {
        setApiError('حدث خطأ غير متوقع. حاول مرة أخرى لاحقًا.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (showCheckEmail) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center rounded-2xl bg-white p-8 text-center shadow-sm" aria-live="polite">
        <h1 className="mb-3 text-xl font-bold text-slate-900">تحقق من بريدك الإلكتروني</h1>
        <p className="mb-6 text-sm leading-6 text-slate-600">
          أرسلنا رابط التفعيل إلى <span className="font-mono font-semibold text-slate-900">{email}</span>.
          <br />
          بعد تأكيد البريد، تستطيع تسجيل الدخول.
        </p>
        <Link to="/auth/login" className="text-sm font-medium text-violet-700 underline underline-offset-4">
          العودة إلى تسجيل الدخول
        </Link>
      </section>
    );
  }

  return (
    <div className="animate-page-enter mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-violet-100 bg-white/85 shadow-[0_28px_80px_rgb(76_29_149/0.12)] backdrop-blur-2xl lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-violet-800 via-indigo-800 to-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-center">
        <span aria-hidden="true" className="absolute -left-20 -top-16 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <span aria-hidden="true" className="absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-amber-300/15 blur-3xl" />
        <div className="relative">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black text-amber-200">ENGLISH SPARK</span>
          <h2 className="mt-6 text-4xl font-black leading-tight">ابدأ رحلتك<br />في دقائق.</h2>
          <p className="mt-4 max-w-md text-base leading-8 text-violet-100">أنشئ مساحتك التعليمية، ابنِ أول نشاط، وشاركه مع طلابك مباشرة. كل شيء جاهز من أول خطوة.</p>
        </div>
      </aside>
      <section className="p-5 sm:p-8 lg:p-10">
      <h1 className="mb-2 text-xl font-bold text-slate-900">إنشاء حساب جديد</h1>
      <p className="mb-6 text-sm text-slate-600">ابدأ بإنشاء مساحتك التعليمية الخاصة.</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormField id="fullName" label="الاسم الكامل" error={errors.fullName}>
          {(props) => (
            <TextInput
              {...props}
              type="text"
              autoComplete="name"
              placeholder="مثال: أ. أحمد علي"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )}
        </FormField>

        <FormField id="email" label="البريد الإلكتروني" error={errors.email}>
          {(props) => (
            <TextInput
              {...props}
              type="email"
              autoComplete="email"
              dir="ltr"
              placeholder="teacher@example.com"
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
              autoComplete="new-password"
              placeholder="8 أحرف على الأقل"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </FormField>

        <FormField id="confirmPassword" label="تأكيد كلمة المرور" error={errors.confirmPassword}>
          {(props) => (
            <TextInput
              {...props}
              type="password"
              autoComplete="new-password"
              placeholder="أعد إدخال كلمة المرور"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          )}
        </FormField>

        {apiError ? (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {apiError}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <ButtonSpinner /> <span className="sr-only">جارٍ الإرسال…</span>
            </>
          ) : (
            'إنشاء الحساب'
          )}
        </Button>

        <p className="text-center text-xs leading-6 text-slate-500">
          بإنشاء الحساب أنت توافق على{' '}
          <Link className="font-medium text-violet-700 underline underline-offset-4" to="/terms">شروط الاستخدام</Link>
          {' '}وتقر بقراءة{' '}
          <Link className="font-medium text-violet-700 underline underline-offset-4" to="/privacy">سياسة الخصوصية</Link>.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        لديك حساب بالفعل؟{' '}
        <Link to="/auth/login" className="font-medium text-violet-700 underline underline-offset-4">
          تسجيل الدخول
        </Link>
      </p>
      </section>
    </div>
  );
}
