import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../../components/ui/button';
import { FormField, TextArea, TextInput } from '../../../components/ui/form-field';
import { quizzesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { getActiveTenantId } from '../../../lib/auth/session';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** /dashboard/quizzes/new — إنشاء اختبار جديد */
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
    mutationFn: () =>
      quizzesApi.create(tenantId!, {
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: async (quiz) => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes', tenantId] });
      navigate(`/dashboard/quizzes/${quiz.id}/edit`);
    },
    onError: (error) => {
      if (error instanceof HttpError) {
        const body = error.body as { title?: string; detail?: string } | null;
        setSubmitError(
          body?.detail
            ? `تحقق من الإدخال: ${body.detail} (Code: ${body.title ?? error.status})`
            : `فشل الإنشاء. الحالة: ${error.status}`,
        );
      } else {
        setSubmitError('فشل الإنشاء. أعد المحاولة.');
      }
    },
  });

  if (!tenantId) {
    navigate('/onboarding/choose', { replace: true });
    return null;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setSlugError(null);

    const trimmedSlug = slug.trim();
    if (!SLUG_PATTERN.test(trimmedSlug)) {
      setSlugError('الرابط يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط (مثال: math-quiz-1).');
      return;
    }

    createMutation.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">اختبار جديد</h1>
          <p className="text-sm text-slate-600">أدخل البيانات الأساسية ثم انتقل لبناء الأسئلة.</p>
        </div>
        <Link
          to="/dashboard/quizzes"
          className="min-h-11 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-sky-600">
          عودة للقائمة
        </Link>
      </div>

      <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4">
        <FormField id="quiz-title" label="عنوان الاختبار">
          {(props) => (
            <TextInput
              {...props}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              placeholder="مثال: اختبار الوحدة الأولى — رياضيات"
            />
          )}
        </FormField>

        <FormField id="quiz-slug" label="الرابط (Slug)" error={slugError ?? undefined}>
          {(props) => (
            <TextInput
              {...props}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              maxLength={100}
              dir="ltr"
              placeholder="math-unit-1-quiz"
            />
          )}
        </FormField>
        <p className="-mt-3 text-xs text-slate-500">
          أحرف إنجليزية صغيرة وأرقام وشرطات فقط. يُستخدم في روابط المشاركة.
        </p>

        <FormField id="quiz-description" label="الوصف (اختياري)">
          {(props) => (
            <TextArea
              {...props}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="وصف مختصر للاختبار…"
            />
          )}
        </FormField>

        {submitError ? (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {submitError}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={createMutation.isPending || !title.trim() || !slug.trim()}>
            {createMutation.isPending ? 'جارٍ الإنشاء…' : 'إنشاء الاختبار'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/dashboard/quizzes')}>
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  );
}
