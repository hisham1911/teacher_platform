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
    return <section role="alert" className="teacher-surface mx-auto max-w-2xl p-7 text-center"><h1 className="text-2xl font-black text-slate-950">{notFound ? 'الطالب غير موجود' : 'تعذر تحميل الطالب'}</h1><p className="mt-2 text-sm text-slate-500">{notFound ? 'قد يكون الرابط قديمًا أو الطالب تابعًا لمساحة عمل أخرى.' : 'تحقق من الاتصال ثم حاول مرة أخرى.'}</p><Link to="/dashboard/students" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-violet-700 px-5 text-sm font-black text-white">العودة للطلاب</Link></section>;
  }

  const justCreated = Boolean((location.state as { justCreated?: boolean } | null)?.justCreated);
  return (
    <div className="space-y-6">
      <header>
        <Link to="/dashboard/students" className="inline-flex min-h-11 items-center text-sm font-black text-violet-700 hover:underline">→ الطلاب</Link>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-black text-slate-950">{studentQuery.data.fullName}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-black ${studentQuery.data.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{studentQuery.data.isActive ? 'نشط' : 'غير نشط'}</span>
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-500">البيانات وكود الدخول ونتائج الأنشطة في مكان واحد.</p>
          </div>
        </div>
      </header>

      {justCreated ? <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">تمت إضافة الطالب. أرسلي له كود الدخول الظاهر بالأسفل.</div> : null}

      <StudentCodeCard student={studentQuery.data} onChanged={refreshStudent} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
        <StudentEditor student={studentQuery.data} onChanged={refreshStudent} />
        <StudentResults studentId={studentQuery.data.id} query={resultsQuery} />
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
    onSuccess: async () => { setError(null); await onChanged(); },
    onError: (mutationError) => setError(mutationError instanceof HttpError && mutationError.status === 409 ? 'تغيرت بيانات الطالب في مكان آخر. تمسكي بالنسخة الأحدث ثم أعيدي المحاولة.' : 'تعذر إنشاء كود جديد.'),
  });

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(student.studentCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('تعذر النسخ تلقائيًا. حددي الكود وانسخيه يدويًا.');
    }
  }

  function regenerate() {
    if (!window.confirm('إنشاء كود جديد سيوقف الكود الحالي فورًا. هل تريدين المتابعة؟')) return;
    regenerateMutation.mutate();
  }

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-800 via-indigo-800 to-slate-950 p-5 text-white shadow-[0_20px_60px_rgb(76_29_149/0.17)] sm:p-7">
      <span aria-hidden="true" className="absolute -left-16 -top-20 h-56 w-56 rounded-full bg-fuchsia-400/15 blur-3xl" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-amber-200">كود دخول الطالب</p>
          <p dir="ltr" className="mt-3 select-all font-mono text-3xl font-black tracking-[0.18em] text-white sm:text-4xl">{formatStudentCode(student.studentCode)}</p>
          <p className="mt-2 max-w-xl text-sm leading-7 text-violet-100">هذا الكود ثابت لكل الأنشطة. لا يحتاج الطالب حسابًا أو كلمة مرور.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copyCode()} className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-black text-violet-900 hover:bg-violet-50">{copied ? 'تم النسخ ✓' : 'نسخ الكود'}</button>
          <button type="button" onClick={regenerate} disabled={regenerateMutation.isPending} className="inline-flex min-h-11 items-center rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-black text-white hover:bg-white/15 disabled:opacity-60">{regenerateMutation.isPending ? 'جارٍ التغيير…' : 'تغيير الكود'}</button>
        </div>
      </div>
      {error ? <p role="alert" className="relative mt-4 rounded-xl bg-rose-500/20 p-3 text-sm font-bold text-rose-50">{error}</p> : null}
    </section>
  );
}

function StudentEditor({ student, onChanged }: { student: Student; onChanged: () => Promise<void> }) {
  const tenantId = getActiveTenantId();
  const [fullName, setFullName] = useState(student.fullName);
  const [grade, setGrade] = useState(student.grade ?? '');
  const [notes, setNotes] = useState(student.notes ?? '');
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
    onSuccess: async () => { setError(null); setMessage('تم حفظ التعديلات.'); await onChanged(); },
    onError: async (mutationError) => {
      if (mutationError instanceof HttpError && mutationError.status === 409) {
        setError('تم تعديل الطالب من مكان آخر. حدّثنا البيانات حتى لا نفقد أي تغيير؛ راجعيها ثم احفظي من جديد.');
        await onChanged();
      } else {
        setError('تعذر حفظ التعديلات.');
      }
    },
  });

  const statusMutation = useMutation({
    mutationFn: () => studentsApi.setStatus(tenantId!, student.id, { isActive: !student.isActive, baseVersion: student.version }),
    onSuccess: async () => { setError(null); setMessage(student.isActive ? 'تم إيقاف دخول الطالب مع الاحتفاظ بنتائجه.' : 'تم تفعيل الطالب من جديد.'); await onChanged(); },
    onError: async (mutationError) => {
      if (mutationError instanceof HttpError && mutationError.status === 409) await onChanged();
      setError('تعذر تغيير حالة الطالب. حاولي مرة أخرى بعد تحديث الصفحة.');
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (fullName.trim().length < 2) { setError('اسم الطالب يجب أن يكون حرفين على الأقل.'); return; }
    updateMutation.mutate();
  }

  function toggleStatus() {
    if (student.isActive && !window.confirm('إيقاف الطالب يمنع استخدام كوده في انضمامات جديدة، لكن النتائج ستظل محفوظة. هل تريدين المتابعة؟')) return;
    setMessage(null);
    setError(null);
    statusMutation.mutate();
  }

  return (
    <section className="teacher-surface p-5 sm:p-6">
      <h2 className="text-xl font-black text-slate-950">بيانات الطالب</h2>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <FormField id="student-edit-name" label="الاسم">{(props) => <TextInput {...props} value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={100} />}</FormField>
        <FormField id="student-edit-grade" label="المستوى أو الصف">{(props) => <TextInput {...props} value={grade} onChange={(event) => setGrade(event.target.value)} maxLength={50} />}</FormField>
        <FormField id="student-edit-notes" label="ملاحظات">{(props) => <TextArea {...props} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={4} />}</FormField>
        {message ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p> : null}
        {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
          <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? <ButtonSpinner /> : null}{updateMutation.isPending ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}</Button>
          <Button variant={student.isActive ? 'danger' : 'secondary'} disabled={statusMutation.isPending} onClick={toggleStatus}>{statusMutation.isPending ? 'جارٍ التحديث…' : student.isActive ? 'إيقاف الطالب' : 'إعادة تفعيل الطالب'}</Button>
        </div>
      </form>
    </section>
  );
}

function StudentResults({ query }: { studentId: string; query: UseQueryResult<StudentResult[], Error> }) {
  return (
    <section className="teacher-surface p-5 sm:p-6">
      <div><h2 className="text-xl font-black text-slate-950">آخر النتائج</h2><p className="mt-1 text-sm text-slate-500">المحاولات المرتبطة بكود هذا الطالب عبر الأنشطة.</p></div>
      {query.isLoading ? <div className="mt-5 space-y-2" role="status">{[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div> : null}
      {query.isError ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">تعذر تحميل النتائج.</p> : null}
      {query.data?.length === 0 ? <div className="mt-5 rounded-2xl bg-slate-50 p-6 text-center"><p className="font-black text-slate-800">لا توجد محاولات بعد</p><p className="mt-1 text-sm text-slate-500">ستظهر النتائج هنا تلقائيًا بعد دخول الطالب بكوده.</p></div> : null}
      {query.data && query.data.length > 0 ? <ul className="mt-5 divide-y divide-slate-100">{query.data.map((result) => <li key={result.attemptId} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-black text-slate-950">{result.quizTitle || 'نشاط'}</h3><span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-black text-violet-800">{SESSION_MODE_LABELS[result.mode]}</span></div><p className="mt-1 text-xs text-slate-500">{new Date(result.startedAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })} · {ATTEMPT_STATUS_LABELS[result.status]}</p></div><div className="flex items-center gap-3"><div className="text-left"><p dir="ltr" className="text-lg font-black text-slate-950">{result.percentage == null ? '—' : `${Math.round(result.percentage)}%`}</p>{result.score != null && result.maxScore != null ? <p dir="ltr" className="text-xs text-slate-500">{result.score} / {result.maxScore}</p> : null}</div><Link to={`/dashboard/attempts/${result.attemptId}`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-3 text-xs font-black text-slate-700 hover:border-violet-400 hover:text-violet-800">التفاصيل</Link></div></div></li>)}</ul> : null}
    </section>
  );
}

function StudentDetailSkeleton() {
  return <div role="status" aria-label="جارٍ تحميل الطالب" className="animate-pulse space-y-6"><div className="h-20 rounded-2xl bg-slate-200" /><div className="h-44 rounded-[2rem] bg-slate-300" /><div className="grid gap-6 xl:grid-cols-2"><div className="h-96 rounded-2xl bg-slate-200" /><div className="h-96 rounded-2xl bg-slate-200" /></div></div>;
}
