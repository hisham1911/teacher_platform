import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { FormField, TextInput } from '../../components/ui/form-field';
import { ButtonSpinner } from '../../components/ui/spinner';
import { authApi } from '../../data/api-client/endpoints';

/** /auth/forgot-password — رسالة عامة دائمًا (لا نكشف هل البريد موجود) */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('صيغة البريد الإلكتروني غير صحيحة');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await authApi.forgotPassword({ email: email.trim() });
      setSubmitted(true);
    } catch {
      setSubmitted(true); // نفس الرسالة العامة حتى مع خطأ الشبكة — نحذف تفصيل التنفيذ
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-xl font-bold text-slate-900">استعادة كلمة المرور</h1>

      {submitted ? (
        <div role="status" className="rounded-lg bg-sky-50 p-4 text-sm leading-6 text-sky-900">
          إذا كان البريد مسجلًا لدينا، ستصلك رسالة تحتوي رابط إعادة التعيين خلال دقائق.
          <div className="mt-4">
            <Link to="/auth/login" className="font-medium text-sky-700 underline underline-offset-4">
              العودة إلى تسجيل الدخول
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormField id="email" label="البريد الإلكتروني" error={error}>
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

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <ButtonSpinner /> : 'إرسال رابط الاستعادة'}
          </Button>
        </form>
      )}
    </section>
  );
}
