import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../../components/ui/button';
import { FormField, TextArea, TextInput } from '../../../components/ui/form-field';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { studentsApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';

function createStudentErrorMessage(error: unknown): string {
  if (!(error instanceof HttpError)) {
    return 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت ثم أعد المحاولة.';
  }

  if (error.status === 400 || error.status === 422) {
    return 'تعذر حفظ البيانات لأن أحد الحقول غير صالح. راجع الحقول المعلَّمة ثم أعد المحاولة.';
  }
  if (error.status === 401) {
    return 'انتهت جلسة تسجيل الدخول. سجّل الدخول من جديد ثم أعد إضافة الطالب.';
  }
  if (error.status === 403) {
    return 'هذا الحساب لا يملك صلاحية إضافة طلاب في مساحة العمل الحالية.';
  }
  if (error.status === 409) {
    return 'حدث تعارض مؤقت أثناء إنشاء الطالب. لم يتم حفظ نسخة مكررة؛ أعد المحاولة.';
  }
  if (error.status >= 500) {
    return 'حدث خطأ في الخدمة أثناء الحفظ. لم يتم حفظ الطالب؛ أعد المحاولة بعد قليل.';
  }

  return `تعذر حفظ الطالب الآن (رمز الخطأ ${error.status}). أعد المحاولة، وإذا تكرر الخطأ احتفظ بهذا الرمز.`;
}

export default function StudentNewPage() {
  const navigate = useNavigate();
  const tenantId = getActiveTenantId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState('');
  const [notes, setNotes] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => studentsApi.create(tenantId!, {
      fullName: fullName.trim(),
      grade: grade.trim() || null,
      notes: notes.trim() || null,
    }),
    onSuccess: (student) => navigate(`/dashboard/students/${student.id}`, { replace: true, state: { justCreated: true } }),
    onError: (error) => setFormError(createStudentErrorMessage(error)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const normalizedName = fullName.trim();
    if (normalizedName.length < 2) {
      setNameError('أدخل اسم الطالب بحرفين على الأقل.');
      nameInputRef.current?.focus();
      return;
    }

    setNameError(null);
    createMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="max-w-2xl">
        <Link
          to="/dashboard/students"
          className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-violet-700 hover:text-violet-900 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100">
          <span aria-hidden="true">→</span>
          الطلاب
        </Link>
        <p className="mt-3 text-xs font-semibold tracking-[0.08em] text-violet-700">إدارة الطلاب</p>
        <h1 className="mt-1 text-[1.75rem] font-bold leading-tight text-slate-950 sm:text-[2rem]">إضافة طالب</h1>
        <p className="mt-2 text-base leading-8 text-slate-600">
          اكتب الاسم فقط وسننشىء كود دخول ثابتًا للطالب. المستوى والملاحظات يمكن إضافتهما الآن أو لاحقًا.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,640px)_minmax(220px,1fr)] lg:items-start">
        <form onSubmit={submit} className="teacher-surface overflow-hidden" noValidate>
          <div className="space-y-5 p-5 sm:p-7">
            <FormField
              id="student-name"
              label="اسم الطالب"
              hint="هذا هو الاسم الذي سيظهر في النتائج والتقارير."
              error={nameError}>
              {(props) => (
                <TextInput
                  {...props}
                  ref={nameInputRef}
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value);
                    if (nameError && event.target.value.trim().length >= 2) setNameError(null);
                  }}
                  minLength={2}
                  maxLength={100}
                  autoFocus
                  autoComplete="off"
                  placeholder="مثال: هشام محمد"
                />
              )}
            </FormField>

            <details className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 text-sm font-semibold text-slate-700 marker:content-none hover:bg-slate-100/70 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600">
                <span aria-hidden="true">＋</span>
                <span>إضافة مستوى أو ملاحظة</span>
                <span className="mr-auto rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">اختياري</span>
                <span aria-hidden="true" className="text-slate-400">⌄</span>
              </summary>
              <div className="space-y-5 border-t border-slate-200 bg-white p-4 sm:p-5">
                <FormField
                  id="student-grade"
                  label="المستوى أو الصف"
                  hint="يساعدك في البحث والتنظيم فقط، ويمكن إضافته لاحقًا."
                  optional>
                  {(props) => (
                    <TextInput
                      {...props}
                      value={grade}
                      onChange={(event) => setGrade(event.target.value)}
                      maxLength={50}
                      autoComplete="off"
                      placeholder="مثال: Grade 6 أو Level A2"
                    />
                  )}
                </FormField>

                <FormField
                  id="student-notes"
                  label="ملاحظات"
                  hint="معلومة داخلية لك فقط؛ لا تظهر للطالب أثناء اللعب."
                  optional>
                  {(props) => (
                    <TextArea
                      {...props}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      maxLength={500}
                      rows={4}
                      placeholder="مثال: يحتاج متابعة في الاستماع"
                    />
                  )}
                </FormField>
              </div>
            </details>

            {formError ? (
              <div role="alert" aria-live="assertive" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">
                <p className="font-bold">لم نتمكن من حفظ الطالب</p>
                <p className="mt-0.5">{formError}</p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <Link
              to="/dashboard/students"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200">
              إلغاء
            </Link>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? <ButtonSpinner /> : null}
              {createMutation.isPending ? 'جارٍ الحفظ…' : 'حفظ وإنشاء الكود'}
            </Button>
          </div>
        </form>

        <aside className="rounded-2xl border border-violet-100 bg-violet-50/60 p-5" aria-label="ماذا يحدث بعد الحفظ؟">
          <p className="text-sm font-bold text-slate-900">بعد الحفظ مباشرة</p>
          <ol className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
            <li className="flex gap-3"><StepNumber value="1" /><span>يُنشأ كود دخول خاص بالطالب تلقائيًا.</span></li>
            <li className="flex gap-3"><StepNumber value="2" /><span>شارك الكود مع الطالب مرة واحدة؛ لا يحتاج بريدًا أو كلمة مرور.</span></li>
            <li className="flex gap-3"><StepNumber value="3" /><span>بعدها أرسل رابط أي نشاط، وسيستخدم الطالب نفس كوده لتسجيل نتيجته.</span></li>
          </ol>
        </aside>
      </div>
    </div>
  );
}

function StepNumber({ value }: { value: string }) {
  return (
    <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-violet-700 shadow-sm ring-1 ring-violet-100">
      {value}
    </span>
  );
}
