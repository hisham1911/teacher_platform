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
        <Link to="/auth/login" className="text-sm font-medium text-sky-700 underline underline-offset-4">
          العودة إلى تسجيل الدخول
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-xl font-bold text-slate-900">إنشاء حساب جديد</h1>
      <p className="mb-6 text-sm text-slate-600">ابدأ بإنشاء مساحتك التعليمية الخاصة.</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormField id="fullName" label="الاسم الكامل" error={errors.fullName}>
          {(props) => (
            <TextInput
              {...props}
              type="text"
              autoComplete="name"
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
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        لديك حساب بالفعل؟{' '}
        <Link to="/auth/login" className="font-medium text-sky-700 underline underline-offset-4">
          تسجيل الدخول
        </Link>
      </p>
    </section>
  );
}
