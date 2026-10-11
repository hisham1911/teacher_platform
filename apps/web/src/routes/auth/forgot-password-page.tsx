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
      <h1 className="mb-2 text-2xl font-black text-slate-900">استعادة كلمة المرور</h1>
      <p className="mb-6 text-sm leading-6 text-slate-500">
        أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً لإعادة تعيين كلمة المرور بأمان.
      </p>

      {submitted ? (
        <div role="status" className="rounded-xl bg-emerald-50 p-5 text-sm leading-7 text-emerald-900 border border-emerald-100">
          <p className="font-bold">تم إرسال الطلب بنجاح ✓</p>
          <p className="mt-1">
            إذا كان البريد مسجلًا لدينا، ستصلك رسالة تحتوي رابط إعادة التعيين خلال دقائق.
          </p>
          <div className="mt-5">
            <Link to="/auth/login" className="inline-flex items-center gap-1 font-bold text-violet-700 hover:text-violet-800">
              ← العودة إلى تسجيل الدخول
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
                placeholder="teacher@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </FormField>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <ButtonSpinner /> : 'إرسال رابط الاستعادة'}
          </Button>

          <div className="mt-3 text-center">
            <Link to="/auth/login" className="text-sm font-bold text-violet-700 hover:text-violet-800">
              ← تذكرت كلمة المرور؟ تسجيل الدخول
            </Link>
          </div>
        </form>
      )}
    </section>
  );
}
