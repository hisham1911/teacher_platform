import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { Button } from '../../../components/ui/button';
import { FormField, TextArea, TextInput } from '../../../components/ui/form-field';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { studentsApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import { ATTEMPT_STATUS_LABELS, SESSION_MODE_LABELS } from '../../../types/sessions';
import { formatStudentCode, type Student, type StudentResult } from '../../../types/students';

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const tenantId = getActiveTenantId();
  const queryClient = useQueryClient();
  const location = useLocation();

  const studentQuery = useQuery({
    queryKey: ['student', tenantId, studentId],
    queryFn: ({ signal }) => studentsApi.get(tenantId!, studentId!, signal),
    enabled: Boolean(tenantId && studentId),
  });

  const resultsQuery = useQuery({
    queryKey: ['student-results', tenantId, studentId],
    queryFn: ({ signal }) => studentsApi.listResults(tenantId!, studentId!, 30, signal),
    enabled: Boolean(tenantId && studentId && studentQuery.isSuccess),
  });

  async function refreshStudent() {
    await queryClient.invalidateQueries({ queryKey: ['student', tenantId, studentId] });
    await queryClient.invalidateQueries({ queryKey: ['students', tenantId] });
  }

  if (studentQuery.isLoading) return <StudentDetailSkeleton />;

  if (studentQuery.isError || !studentQuery.data) {
    const notFound = studentQuery.error instanceof HttpError && studentQuery.error.status === 404;
    return (
      <section role="alert" className="teacher-surface mx-auto max-w-2xl p-7 text-center sm:p-10">
        <div aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">{notFound ? '⌕' : '!'}</div>
        <h1 className="mt-4 text-2xl font-bold text-slate-950">{notFound ? 'الطالب غير موجود' : 'تعذر تحميل الطالب'}</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">
          {notFound ? 'قد يكون الرابط قديمًا أو الطالب تابعًا لمساحة عمل أخرى.' : 'لم نتمكن من تحميل الملف الآن. تحقق من الاتصال ثم أعد المحاولة.'}
        </p>
        <Link to="/dashboard/students" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-violet-700 px-5 text-sm font-bold text-white hover:bg-violet-800">
          العودة إلى الطلاب
        </Link>
      </section>
    );
  }

  const student = studentQuery.data;
  const justCreated = Boolean((location.state as { justCreated?: boolean } | null)?.justCreated);

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <Link
          to="/dashboard/students"
          className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-violet-700 hover:text-violet-900 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100">
          <span aria-hidden="true">→</span>
          الطلاب
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <h1 className="text-[1.75rem] font-bold leading-tight text-slate-950 sm:text-[2rem]">{student.fullName}</h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${student.isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'}`}>
            {student.isActive ? 'نشط' : 'غير نشط'}
          </span>
        </div>
        <p className="mt-2 text-base leading-8 text-slate-600">بيانات الطالب، كود الدخول، وآخر النتائج في ملف واحد.</p>
      </header>

      {justCreated ? (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-900">
          <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">✓</span>
          <div>
            <p className="font-bold">تمت إضافة الطالب بنجاح</p>
            <p>انسخ كود الدخول أدناه وشاركه مع الطالب. لا يحتاج إلى إنشاء حساب.</p>
          </div>
        </div>
      ) : null}

      <StudentCodeCard student={student} onChanged={refreshStudent} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
        <StudentEditor student={student} onChanged={refreshStudent} />
        <StudentResults query={resultsQuery} />
      </div>
    </div>
  );
}

function StudentCodeCard({ student, onChanged }: { student: Student; onChanged: () => Promise<void> }) {
  const tenantId = getActiveTenantId();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regenerateMutation = useMutation({
    mutationFn: () => studentsApi.regenerateCode(tenantId!, student.id, { baseVersion: student.version }),
    onSuccess: async () => {
      setError(null);
      await onChanged();
    },
    onError: (mutationError) => {
      if (mutationError instanceof HttpError && mutationError.status === 409) {
        setError('تغيرت بيانات الطالب في مكان آخر. تم تحديث الملف؛ راجع الكود الحالي ثم أعد المحاولة.');
        void onChanged();
        return;
      }
      setError('تعذر إنشاء كود جديد الآن. أعد المحاولة بعد قليل.');
    },
  });

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(student.studentCode);
      setError(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('تعذر النسخ تلقائيًا. حدّد الكود وانسخه يدويًا.');
    }
  }

  function regenerate() {
    if (!window.confirm('إنشاء كود جديد سيوقف الكود الحالي فورًا. هل تريد المتابعة؟')) return;
    regenerateMutation.mutate();
  }

  return (
    <section className="teacher-surface overflow-hidden" aria-labelledby="student-code-title">
      <div className="grid md:grid-cols-[minmax(0,1fr)_auto] md:items-stretch">
        <div className="p-5 sm:p-6">
          <p id="student-code-title" className="text-sm font-bold text-slate-900">كود دخول الطالب</p>
          <p className="mt-1 text-sm leading-7 text-slate-500">استخدم نفس الكود في كل الأنشطة. لا يحتاج الطالب بريدًا أو كلمة مرور.</p>
          <p dir="ltr" className="mt-4 inline-flex select-all rounded-xl bg-violet-50 px-4 py-3 font-mono text-2xl font-bold tracking-[0.14em] text-violet-900 ring-1 ring-violet-100 sm:text-3xl">
            {formatStudentCode(student.studentCode)}
          </p>
        </div>

        <div className="flex flex-col justify-center gap-2 border-t border-slate-200 bg-slate-50/70 p-4 md:min-w-48 md:border-r md:border-t-0">
          <button
            type="button"
            onClick={() => void copyCode()}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200">
            {copied ? 'تم النسخ ✓' : 'نسخ الكود'}
          </button>
          <button
            type="button"
            onClick={regenerate}
            disabled={regenerateMutation.isPending}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-55">
            {regenerateMutation.isPending ? 'جارٍ التغيير…' : 'تغيير الكود'}
          </button>
        </div>
      </div>
      {error ? <p role="alert" className="border-t border-rose-200 bg-rose-50 px-5 py-3 text-sm leading-7 text-rose-800 sm:px-6">{error}</p> : null}
    </section>
  );
}

function StudentEditor({ student, onChanged }: { student: Student; onChanged: () => Promise<void> }) {
  const tenantId = getActiveTenantId();
  const [fullName, setFullName] = useState(student.fullName);
  const [grade, setGrade] = useState(student.grade ?? '');
  const [notes, setNotes] = useState(student.notes ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(student.fullName);
    setGrade(student.grade ?? '');
    setNotes(student.notes ?? '');
  }, [student.id, student.version, student.fullName, student.grade, student.notes]);

  const updateMutation = useMutation({
    mutationFn: () => studentsApi.update(tenantId!, student.id, {
      fullName: fullName.trim(),
      grade: grade.trim() || null,
      notes: notes.trim() || null,
      baseVersion: student.version,
    }),
    onSuccess: async () => {
      setError(null);
      setMessage('تم حفظ التعديلات.');
      await onChanged();
    },
    onError: async (mutationError) => {
      if (mutationError instanceof HttpError && mutationError.status === 409) {
        setError('تم تعديل هذا الطالب من مكان آخر. حدّثنا البيانات إلى أحدث نسخة؛ راجعها ثم احفظ من جديد.');
        await onChanged();
      } else if (mutationError instanceof HttpError && mutationError.status === 403) {
        setError('هذا الحساب لا يملك صلاحية تعديل الطلاب في مساحة العمل الحالية.');
      } else if (mutationError instanceof HttpError && mutationError.status >= 500) {
        setError('حدث خطأ في الخدمة أثناء الحفظ. لم نفقد تعديلاتك؛ أعد المحاولة بعد قليل.');
      } else {
        setError('تعذر حفظ التعديلات الآن. أعد المحاولة.');
      }
    },
  });

  const statusMutation = useMutation({
    mutationFn: () => studentsApi.setStatus(tenantId!, student.id, { isActive: !student.isActive, baseVersion: student.version }),
    onSuccess: async () => {
      setError(null);
      setMessage(student.isActive ? 'تم إيقاف دخول الطالب مع الاحتفاظ بنتائجه.' : 'تم تفعيل الطالب من جديد.');
      await onChanged();
    },
    onError: async (mutationError) => {
      if (mutationError instanceof HttpError && mutationError.status === 409) await onChanged();
      setError('تعذر تغيير حالة الطالب. حدّث الصفحة ثم أعد المحاولة.');
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (fullName.trim().length < 2) {
      setNameError('أدخل اسم الطالب بحرفين على الأقل.');
      return;
    }

    setNameError(null);
    updateMutation.mutate();
  }

  function toggleStatus() {
    if (student.isActive && !window.confirm('إيقاف الطالب يمنع استخدام كوده في انضمامات جديدة، لكن النتائج ستظل محفوظة. هل تريد المتابعة؟')) return;
    setMessage(null);
    setError(null);
    statusMutation.mutate();
  }

  return (
    <section className="teacher-surface overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
        <h2 className="text-lg font-bold text-slate-950">بيانات الطالب</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">حدّث البيانات التنظيمية بدون التأثير في النتائج السابقة.</p>
      </div>

      <form onSubmit={submit} className="space-y-5 p-5 sm:p-6" noValidate>
        <FormField id="student-edit-name" label="الاسم" error={nameError}>
          {(props) => <TextInput {...props} value={fullName} onChange={(event) => { setFullName(event.target.value); if (nameError && event.target.value.trim().length >= 2) setNameError(null); }} minLength={2} maxLength={100} />}
        </FormField>
        <FormField id="student-edit-grade" label="المستوى أو الصف" optional>
          {(props) => <TextInput {...props} value={grade} onChange={(event) => setGrade(event.target.value)} maxLength={50} />}
        </FormField>
        <FormField id="student-edit-notes" label="ملاحظات" optional>
          {(props) => <TextArea {...props} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={4} />}
        </FormField>

        {message ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-7 text-emerald-800">{message}</p> : null}
        {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-7 text-rose-800">{error}</p> : null}

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <ButtonSpinner /> : null}
            {updateMutation.isPending ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
          </Button>
          <Button variant={student.isActive ? 'danger' : 'secondary'} disabled={statusMutation.isPending} onClick={toggleStatus}>
            {statusMutation.isPending ? 'جارٍ التحديث…' : student.isActive ? 'إيقاف الطالب' : 'إعادة تفعيل الطالب'}
          </Button>
        </div>
      </form>
    </section>
  );
}

function StudentResults({ query }: { query: UseQueryResult<StudentResult[], Error> }) {
  return (
    <section className="teacher-surface overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
        <h2 className="text-lg font-bold text-slate-950">آخر النتائج</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">أحدث المحاولات المرتبطة بكود هذا الطالب.</p>
      </div>

      {query.isLoading ? (
        <div className="space-y-2 p-5 sm:p-6" role="status" aria-label="جارٍ تحميل النتائج">
          {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : null}

      {query.isError ? <p role="alert" className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 sm:m-6">تعذر تحميل النتائج الآن.</p> : null}

      {query.data?.length === 0 ? (
        <div className="p-8 text-center">
          <div aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">↗</div>
          <p className="mt-3 font-semibold text-slate-800">لا توجد محاولات بعد</p>
          <p className="mt-1 text-sm leading-7 text-slate-500">ستظهر النتائج هنا تلقائيًا بعد دخول الطالب بكوده.</p>
        </div>
      ) : null}

      {query.data && query.data.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {query.data.map((result) => (
            <li key={result.attemptId} className="p-4 sm:px-6 sm:py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold text-slate-950">{result.quizTitle || 'نشاط'}</h3>
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-100">{SESSION_MODE_LABELS[result.mode]}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    {new Date(result.startedAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })} · {ATTEMPT_STATUS_LABELS[result.status]}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <div className="text-left">
                    <p dir="ltr" className="text-lg font-bold text-slate-950">{result.percentage == null ? '—' : `${Math.round(result.percentage)}%`}</p>
                    {result.score != null && result.maxScore != null ? <p dir="ltr" className="text-xs text-slate-500">{result.score} / {result.maxScore}</p> : null}
                  </div>
                  <Link to={`/dashboard/attempts/${result.attemptId}`} className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:border-violet-300 hover:text-violet-800">
                    التفاصيل
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function StudentDetailSkeleton() {
  return (
    <div role="status" aria-label="جارٍ تحميل الطالب" className="animate-pulse space-y-6">
      <div className="h-20 max-w-xl rounded-2xl bg-slate-200" />
      <div className="h-40 rounded-2xl bg-slate-200" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-96 rounded-2xl bg-slate-200" />
        <div className="h-96 rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}
