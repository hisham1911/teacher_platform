import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { TeacherIcon } from '../../../components/ui/teacher-icon';
import { FormField, TextArea, TextInput } from '../../../components/ui/form-field';
import { quizzesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';
import type { CreateQuizRequest } from '../../../types/quizzes';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default function QuizNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [slugError, setSlugError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (request: CreateQuizRequest) => quizzesApi.create(tenantId!, request),
    onSuccess: async (quiz) => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes', tenantId] });
      navigate(`/dashboard/quizzes/${quiz.id}/edit`);
    },
    onError: (error) => {
      if (error instanceof HttpError) {
        const body = error.body as { detail?: string } | null;
        setSubmitError(body?.detail ? `تعذر إنشاء الاختبار: ${body.detail}` : 'تعذر إنشاء الاختبار. راجع البيانات ثم حاول مرة أخرى.');
      } else {
        setSubmitError('تعذر إنشاء الاختبار الآن. تحقق من الاتصال ثم حاول مرة أخرى.');
      }
    },
  });

  if (!tenantId) return null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setSlugError(null);

    const customSlug = slug.trim();
    if (customSlug && !SLUG_PATTERN.test(customSlug)) {
      setSlugError('استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط، مثل: unit-1-review.');
      return;
    }

    createMutation.mutate({
      title: title.trim(),
      slug: customSlug || createQuizSlug(title),
      description: description.trim() || undefined,
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/dashboard" className="inline-flex min-h-11 items-center text-sm font-bold text-slate-600 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">العودة إلى الرئيسية →</Link>

      <header className="mt-6 max-w-2xl">
        <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--teacher-primary-soft)] text-[var(--teacher-primary-strong)]"><TeacherIcon name="create" className="h-6 w-6" /></span>
        <h1 className="mt-5 text-3xl font-black text-[var(--teacher-ink)]">أنشئ اختبارك</h1>
        <p className="mt-2 max-w-xl text-base leading-7 text-[var(--teacher-muted)]">ابدأ بالاسم فقط. ستضيف الأسئلة والإعدادات داخل مساحة البناء في الخطوة التالية.</p>
      </header>

      <form onSubmit={onSubmit} className="mt-8 flex max-w-2xl flex-col gap-5">
        <FormField id="quiz-title" label="اسم الاختبار">
          {(props) => (
            <TextInput
              {...props}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              autoFocus
              maxLength={200}
              placeholder="مثال: مراجعة Unit 1"
              className="min-h-14 text-base"
            />
          )}
        </FormField>

        <details className="border-y border-slate-200 py-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-bold text-slate-700 marker:content-none">
            تفاصيل اختيارية
            <span aria-hidden="true" className="text-lg text-slate-400">⌄</span>
          </summary>
          <div className="mt-4 flex flex-col gap-4 pb-2">
            <FormField id="quiz-description" label="وصف مختصر">
              {(props) => (
                <TextArea {...props} value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={2000} placeholder="ما الذي يغطيه هذا الاختبار؟" />
              )}
            </FormField>
            <FormField id="quiz-slug" label="رابط مخصص" error={slugError ?? undefined}>
              {(props) => (
                <TextInput {...props} value={slug} onChange={(event) => setSlug(event.target.value)} maxLength={100} dir="ltr" placeholder="unit-1-review" />
              )}
            </FormField>
            <p className="text-sm leading-6 text-slate-600">اختياري. إذا تركته فارغًا سننشئ رابطًا آمنًا تلقائيًا.</p>
          </div>
        </details>

        {submitError ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm leading-6 text-rose-800">{submitError}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="submit" disabled={createMutation.isPending || !title.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--teacher-primary)] px-6 text-sm font-black text-white hover:bg-[var(--teacher-primary-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
            {createMutation.isPending ? 'جارٍ إنشاء مساحة الاختبار…' : 'ابدأ إضافة الأسئلة'}
            {!createMutation.isPending ? <span aria-hidden="true">←</span> : null}
          </button>
          <Link to="/dashboard/quizzes" className="inline-flex min-h-11 items-center justify-center px-4 text-sm font-bold text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">عرض اختباراتي</Link>
        </div>
      </form>
    </div>
  );
}

function createQuizSlug(title: string) {
  const englishWords = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return englishWords || `quiz-${Date.now().toString(36)}`;
}
