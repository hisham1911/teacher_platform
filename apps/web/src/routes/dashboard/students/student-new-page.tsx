import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../../components/ui/button';
import { FormField, TextArea, TextInput } from '../../../components/ui/form-field';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { studentsApi } from '../../../data/api-client/endpoints';
import { getActiveTenantId } from '../../../lib/auth/session';

export default function StudentNewPage() {
  const navigate = useNavigate();
  const tenantId = getActiveTenantId();
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => studentsApi.create(tenantId!, {
      fullName: fullName.trim(),
      grade: grade.trim() || null,
      notes: notes.trim() || null,
    }),
    onSuccess: (student) => navigate(`/dashboard/students/${student.id}`, { replace: true, state: { justCreated: true } }),
    onError: () => setFormError('تعذر حفظ الطالب الآن. راجعي البيانات ثم حاولي مرة أخرى.'),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (fullName.trim().length < 2) {
      setFormError('اكتبي اسم الطالب بحرفين على الأقل.');
      return;
    }
    createMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link to="/dashboard/students" className="inline-flex min-h-11 items-center text-sm font-black text-violet-700 hover:underline">→ الطلاب</Link>
        <h1 className="mt-2 text-3xl font-black text-slate-950">إضافة طالب</h1>
        <p className="mt-2 text-sm leading-7 text-slate-500">يكفي الاسم. المستوى والملاحظات اختيارية، وكود الدخول سيُنشأ تلقائيًا.</p>
      </header>

      <form onSubmit={submit} className="teacher-surface space-y-5 p-5 sm:p-7">
        <FormField id="student-name" label="اسم الطالب">
          {(props) => <TextInput {...props} value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={100} autoFocus autoComplete="off" placeholder="مثال: سارة أحمد" />}
        </FormField>

        <FormField id="student-grade" label="المستوى أو الصف — اختياري">
          {(props) => <TextInput {...props} value={grade} onChange={(event) => setGrade(event.target.value)} maxLength={50} autoComplete="off" placeholder="مثال: Grade 6 أو Level A2" />}
        </FormField>

        <FormField id="student-notes" label="ملاحظات — اختيارية">
          {(props) => <TextArea {...props} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={4} placeholder="أي معلومة تساعدك في متابعة الطالب" />}
        </FormField>

        {formError ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{formError}</p> : null}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <Link to="/dashboard/students" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50">إلغاء</Link>
          <Button type="submit" disabled={createMutation.isPending || fullName.trim().length < 2}>
            {createMutation.isPending ? <ButtonSpinner /> : null}
            {createMutation.isPending ? 'جارٍ الحفظ…' : 'حفظ الطالب'}
          </Button>
        </div>
      </form>
    </div>
  );
}
