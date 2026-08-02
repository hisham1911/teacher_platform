import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { ButtonSpinner } from '../../components/ui/spinner';
import { authApi } from '../../data/api-client/endpoints';

/** /auth/confirm-email — يقرأ uid و token من Query String */
export default function ConfirmEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('pending');
    setErrorMessage(null);
    try {
      await authApi.confirmEmail({ uid, token });
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMessage('رابط التأكيد غير صالح أو انتهت صلاحيته.');
    }
  }

  if (!uid || !token) {
    return (
      <section className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-slate-900">رابط تأكيد غير مكتمل</h1>
        <p className="mb-6 text-sm text-slate-600">
          الرابط الذي فتحته يفتقد جزءًا من البيانات. استخدم الرابط الكامل الذي وصلك في البريد.
        </p>
        <Link to="/auth/login" className="text-sm font-medium text-sky-700 underline underline-offset-4">
          العودة إلى تسجيل الدخول
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
      <h1 className="mb-2 text-xl font-bold text-slate-900">تأكيد البريد الإلكتروني</h1>

      {status === 'success' ? (
        <div role="status" className="rounded-lg bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
          تم تأكيد بريدك بنجاح.
          <div className="mt-4">
            <Button onClick={() => navigate('/auth/login', { replace: true })}>متابعة إلى تسجيل الدخول</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            اضغط الزر أدناه لتأكيد بريدك الإلكتروني المرتبط بهذا الرابط.
          </p>
          {status === 'error' ? (
            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}
          <Button type="submit" disabled={status === 'pending'}>
            {status === 'pending' ? <ButtonSpinner /> : 'تأكيد البريد'}
          </Button>
          <Link to="/auth/login" className="text-sm text-sky-700 underline underline-offset-4">
            العودة إلى تسجيل الدخول
          </Link>
        </form>
      )}
    </section>
  );
}
