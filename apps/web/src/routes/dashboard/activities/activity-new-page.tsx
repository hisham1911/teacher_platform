import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { TeacherIcon } from '../../../components/ui/teacher-icon';
import { quizzesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import { ACTIVITY_MODES, type ActivityMode } from '../../../features/activities/activity-mode';
import { getActiveTenantId } from '../../../lib/auth/session';

export default function ActivityNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();
  const [mode, setMode] = useState<ActivityMode>('ProgressiveChallenge');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => quizzesApi.create(tenantId!, {
      title: title.trim(),
      slug: createActivitySlug(title),
    }),
    onSuccess: async (quiz) => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes', tenantId] });
      navigate(`/dashboard/activities/${quiz.id}/build?mode=${mode}`);
    },
    onError: (mutationError) => {
      if (mutationError instanceof HttpError) {
        const body = mutationError.body as { detail?: string } | null;
        setError(body?.detail ?? 'تعذر إنشاء النشاط. راجعي الاسم ثم حاولي مرة أخرى.');
      } else {
        setError('تعذر إنشاء النشاط الآن. تحققي من الاتصال ثم حاولي مرة أخرى.');
      }
    },
  });

  if (!tenantId) return null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setError(null);
    createMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <div className="flex items-center justify-between gap-3">
        <Link to="/dashboard" className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-bold text-slate-500 hover:bg-white hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700">
          → الرئيسية
        </Link>
        <span className="rounded-full border border-violet-100 bg-white px-3 py-1.5 text-xs font-black text-violet-700 shadow-sm">خطوة 1 من 2</span>
      </div>

      <header className="mt-4 rounded-3xl border border-violet-100 bg-gradient-to-br from-white via-white to-violet-50 p-5 shadow-sm sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">English Spark Studio</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">ماذا تريدين أن تنشئي؟</h1>
        <p className="mt-3 max-w-2xl text-base leading-8 text-slate-600">اختاري طريقة اللعب، اكتبي اسمًا واضحًا، وبعدها أضيفي الأسئلة. لا توجد إعدادات نشر أو جلسات تحتاجين لفهمها.</p>
      </header>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <fieldset className="teacher-surface p-4 sm:p-6">
          <legend className="px-2 text-lg font-black text-slate-950">اختاري طريقة اللعب</legend>
          <p className="px-2 text-sm leading-6 text-slate-500">يمكنك البدء بالخيار المقترح، أو اختيار ما يناسب الحصة.</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {ACTIVITY_MODES.map((definition) => {
              const selected = mode === definition.mode;
              const isRecommended = definition.mode === 'ProgressiveChallenge';
              return (
                <label
                  key={definition.mode}
                  className={`relative cursor-pointer rounded-2xl border p-4 transition-all focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-violet-700 sm:p-5 ${selected ? 'border-violet-500 bg-violet-50 shadow-[0_10px_30px_rgb(109_40_217/0.08)]' : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/40'}`}>
                  <input
                    type="radio"
                    name="activity-mode"
                    value={definition.mode}
                    checked={selected}
                    onChange={() => setMode(definition.mode)}
                    className="sr-only"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <span aria-hidden="true" className={`flex h-11 w-11 items-center justify-center rounded-xl ${selected ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <TeacherIcon name={definition.mode === 'Live' ? 'play' : definition.mode === 'ProgressiveChallenge' ? 'certificate' : 'quizzes'} />
                    </span>
                    <div className="flex items-center gap-2">
                      {isRecommended ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-900">مقترح</span> : null}
                      <span aria-hidden="true" className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-black ${selected ? 'border-violet-700 bg-violet-700 text-white' : 'border-slate-300 text-transparent'}`}>✓</span>
                    </div>
                  </div>
                  <h2 className="mt-4 text-lg font-black text-slate-950">{definition.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{definition.description}</p>
                  <p className="mt-4 border-t border-slate-100 pt-3 text-xs font-bold leading-5 text-slate-500">{definition.recommendedFor}</p>
                </label>
              );
            })}
          </div>
        </fieldset>

        <section className="teacher-surface p-5 sm:p-6" aria-labelledby="activity-name-heading">
          <div className="max-w-3xl">
            <h2 id="activity-name-heading" className="text-lg font-black text-slate-950">اسم النشاط</h2>
            <p className="mt-1 text-sm text-slate-500">هذا هو الاسم الذي سيظهر لك وللطلاب.</p>
            <label htmlFor="activity-title" className="mt-5 block text-sm font-bold text-slate-700">اكتبي اسمًا بسيطًا</label>
            <input
              id="activity-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={200}
              placeholder="مثال: تحدي كلمات الفضاء"
              className="mt-2 min-h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-950 shadow-sm transition focus:border-violet-500 focus:outline-2 focus:outline-violet-200"
            />
          </div>
        </section>

        {error ? <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</p> : null}

        <div className="sticky bottom-20 z-30 rounded-2xl border border-violet-100 bg-white/95 p-3 shadow-[0_12px_40px_rgb(76_29_149/0.12)] backdrop-blur lg:bottom-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="px-2 text-sm font-semibold text-slate-500">بعدها ستضيفين الأسئلة مباشرة.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link to="/dashboard/quizzes/new" className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800">خيارات متقدمة</Link>
              <button
                type="submit"
                disabled={!title.trim() || createMutation.isPending}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 text-sm font-black text-white shadow-sm transition hover:bg-violet-800 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
                {createMutation.isPending ? 'جارٍ إنشاء النشاط…' : 'التالي: أضيفي الأسئلة'}
                {!createMutation.isPending ? <span aria-hidden="true">←</span> : null}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function createActivitySlug(title: string) {
  const normalized = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return normalized || `spark-${Date.now().toString(36)}`;
}
