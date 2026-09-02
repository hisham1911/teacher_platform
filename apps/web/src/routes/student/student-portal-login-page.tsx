import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { HttpError } from '../../data/api-client/http-error';
import { studentPortalApi } from '../../data/api-client/student-portal-endpoints';
import { formatStudentAccessCode, normalizeStudentAccessCode } from '../../types/student-portal';
import { StudentButton, StudentLearningVisual, StudentLoading, StudentShell } from '../play/student-ui';

function safeReturnTo(value: string | null): string {
  return value?.startsWith('/play/') ? value : '/student/home';
}

export default function StudentPortalLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const availabilityQuery = useQuery({
    queryKey: ['student-portal', 'status'],
    queryFn: ({ signal }) => studentPortalApi.status(signal),
    retry: false,
    staleTime: 60_000,
  });
  const portalEnabled = availabilityQuery.data?.enabled === true;

  const sessionQuery = useQuery({
    queryKey: ['student-portal', 'me'],
    queryFn: ({ signal }) => studentPortalApi.me(signal),
    enabled: portalEnabled,
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (sessionQuery.isSuccess) navigate(returnTo, { replace: true });
  }, [navigate, returnTo, sessionQuery.isSuccess]);

  const loginMutation = useMutation({
    mutationFn: (code: string) => studentPortalApi.login(code),
    onSuccess: async () => {
      setError(null);
      await sessionQuery.refetch();
      navigate(returnTo, { replace: true });
    },
    onError: (mutationError) => {
      if (mutationError instanceof HttpError && mutationError.status === 401) {
        setError('كود الدخول غير صحيح أو تم تغييره. اطلب الكود الحالي من المعلم.');
      } else if (mutationError instanceof HttpError && mutationError.status === 429) {
        setError('محاولات كثيرة في وقت قصير. انتظر قليلًا ثم حاول مرة أخرى.');
      } else {
        setError('تعذر تسجيل الدخول الآن. تحقق من الاتصال ثم حاول مرة أخرى.');
      }
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeStudentAccessCode(accessCode);
    if (normalized.length < 12) {
      setError('اكتب كود الدخول كاملًا.');
      return;
    }
    setError(null);
    loginMutation.mutate(normalized);
  }

  if (availabilityQuery.isLoading) return <StudentLoading message="جارٍ فتح مساحتك…" />;

  if (availabilityQuery.isError) {
    return (
      <StudentShell centered width="wide">
        <section className="student-panel mx-auto w-full max-w-xl p-6 text-center sm:p-8">
          <div aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-xl">↻</div>
          <h1 className="mt-4 text-2xl font-black text-[var(--student-ink)]">تعذر التحقق من مساحة الطالب</h1>
          <p className="mt-2 text-sm leading-7 text-[var(--student-muted)]">تحقق من الاتصال ثم أعد المحاولة. الانضمام السريع للأنشطة ما زال متاحًا بشكل مستقل.</p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <StudentButton type="button" onClick={() => void availabilityQuery.refetch()}>إعادة المحاولة</StudentButton>
            <Link to="/join" className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-violet-700 hover:bg-violet-50">انضم لنشاط سريع</Link>
          </div>
        </section>
      </StudentShell>
    );
  }

  if (!portalEnabled) {
    return (
      <StudentShell centered width="wide">
        <section className="student-panel mx-auto w-full max-w-xl p-6 text-center sm:p-8">
          <div aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-xl">✦</div>
          <h1 className="mt-4 text-2xl font-black text-[var(--student-ink)]">مساحة الطالب غير متاحة الآن</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[var(--student-muted)]">لم يتم تفعيل الدخول الدائم للطلاب في هذه البيئة بعد. يمكنك الاستمرار عبر أي نشاط يرسله لك المعلم.</p>
          <Link to="/join" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-700 px-5 text-sm font-black text-white hover:bg-violet-800">انضم لنشاط سريع</Link>
        </section>
      </StudentShell>
    );
  }

  if (sessionQuery.isLoading) return <StudentLoading message="جارٍ فتح مساحتك…" />;

  return (
    <StudentShell centered width="wide">
      <section className="student-enter mx-auto grid w-full max-w-4xl gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
        <form onSubmit={submit} className="student-panel order-2 p-5 text-center sm:p-7 lg:order-1" noValidate>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--student-violet-soft)] text-2xl" aria-hidden="true">✦</div>
          <h1 className="mt-4 text-2xl font-black text-[var(--student-ink)] sm:text-3xl">ادخل إلى مساحتك</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[var(--student-muted)]">
            استخدم كود الدخول الشخصي الذي حصلت عليه من المعلم. هذا الكود يفتح ملفك وتقدمك في English Spark.
          </p>

          <label htmlFor="student-access-code" className="mt-6 block text-right text-sm font-bold text-[var(--student-ink)]">كود دخول الطالب</label>
          <input
            id="student-access-code"
            dir="ltr"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            autoFocus
            value={formatStudentAccessCode(accessCode)}
            onChange={(event) => {
              setAccessCode(normalizeStudentAccessCode(event.target.value));
              setError(null);
            }}
            placeholder="ABCD-EFGH-JKLM-NPQR"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'student-access-error' : 'student-access-hint'}
            className="mt-2 min-h-16 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-center font-mono text-xl font-black tracking-[0.1em] text-[var(--student-ink)] shadow-sm transition placeholder:text-slate-300 focus:border-[var(--student-primary)] focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:text-2xl"
          />
          {error ? (
            <p id="student-access-error" role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold leading-7 text-rose-700">{error}</p>
          ) : (
            <p id="student-access-hint" className="mt-3 text-xs leading-6 text-[var(--student-muted)]">الكود شخصي. لا تحتاج بريدًا إلكترونيًا أو كلمة مرور.</p>
          )}

          <StudentButton type="submit" className="mt-5 w-full" disabled={loginMutation.isPending || normalizeStudentAccessCode(accessCode).length < 12}>
            {loginMutation.isPending ? 'جارٍ الدخول…' : 'دخول'}
          </StudentButton>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="text-xs leading-6 text-[var(--student-muted)]">معك رمز نشاط فقط؟</p>
            <Link to="/join" className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-violet-700 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100">انضم لنشاط سريع</Link>
          </div>
        </form>

        <div className="order-1 flex flex-col items-center text-center lg:order-2">
          <StudentLearningVisual />
          <p className="mt-2 text-base font-black text-[var(--student-primary-strong)]">مساحتك معك كل مرة</p>
          <p className="mt-1 max-w-[230px] text-xs leading-6 text-[var(--student-muted)]">تابع ما بدأت، راجع نتائجك، وارجع لأنشطتك من مكان واحد.</p>
        </div>
      </section>
    </StudentShell>
  );
}
