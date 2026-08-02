import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { FormField, TextInput } from '../../components/ui/form-field';
import { ButtonSpinner } from '../../components/ui/spinner';
import { authApi } from '../../data/api-client/endpoints';

/** /auth/reset-password — يقرأ uid و token من Query String، يتحقق من تطابق كلمتي المرور */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [apiError, setApiError] = useState<string | null>(null);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (newPassword.length < 8) next.newPassword = 'كلمة المرور يجب ألا تقل عن 8 أحرف';
    if (newPassword !== confirmPassword) next.confirmPassword = 'تأكيد كلمة المرور لا يطابق';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setStatus('pending');
    setApiError(null);
    try {
      await authApi.resetPassword({ uid, token, newPassword });
      setStatus('success');
    } catch {
      setStatus('error');
      setApiError('الرابط غير صالح أو انتهت صلاحيته.');
    }
  }

  if (!uid || !token) {
    return (
      <section className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-slate-900">رابط إعادة التعيين غير مكتمل</h1>
        <p className="mb-6 text-sm text-slate-600">استخدم الرابط الكامل الذي وصلك في البريد.</p>
        <Link to="/auth/forgot-password" className="text-sm font-medium text-sky-700 underline underline-offset-4">
          طلب رابط جديد
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-xl font-bold text-slate-900">اختيار كلمة مرور جديدة</h1>

      {status === 'success' ? (
        <div role="status" className="rounded-lg bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
          تم تغيير كلمة المرور بنجاح.
          <div className="mt-4">
            <Button onClick={() => navigate('/auth/login', { replace: true })}>تسجيل الدخول الآن</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <FormField id="newPassword" label="كلمة المرور الجديدة" error={errors.newPassword}>
            {(props) => (
              <TextInput
                {...props}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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

          <Button type="submit" disabled={status === 'pending'}>
            {status === 'pending' ? <ButtonSpinner /> : 'تغيير كلمة المرور'}
          </Button>
        </form>
      )}
    </section>
  );
}
