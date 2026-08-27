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
        setError(body?.detail ?? 'تعذر إنشاء النشاط. راجع الاسم ثم حاول مرة أخرى.');
      } else {
        setError('تعذر إنشاء النشاط الآن. تحقق من الاتصال ثم حاول مرة أخرى.');
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
    <div className="mx-auto max-w-5xl">
      <Link to="/dashboard" className="inline-flex min-h-11 items-center text-sm font-bold text-slate-600 hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700">
        العودة إلى الرئيسية →
      </Link>

      <header className="mt-5 max-w-3xl">
        <p className="text-sm font-black text-violet-700">English Spark Studio</p>
        <h1 className="mt-2 text-3xl font-black text-[var(--teacher-ink)] sm:text-4xl">أنشئي نشاطًا جديدًا</h1>
        <p className="mt-3 text-base leading-7 text-[var(--teacher-muted)]">اختاري طريقة اللعب، اكتبي اسم النشاط، وبعدها سنأخذك مباشرة لإضافة الأسئلة.</p>
      </header>

      <form onSubmit={onSubmit} className="mt-8 space-y-8">
        <fieldset>
          <legend className="text-lg font-black text-slate-900">1. كيف تريدين أن يلعب الطلاب؟</legend>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {ACTIVITY_MODES.map((definition) => {
              const selected = mode === definition.mode;
              return (
                <label
                  key={definition.mode}
                  className={`relative cursor-pointer rounded-2xl border p-5 transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-violet-700 ${selected ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-slate-200 bg-white hover:border-violet-300'}`}>
                  <input
                    type="radio"
                    name="activity-mode"
                    value={definition.mode}
                    checked={selected}
                    onChange={() => setMode(definition.mode)}
                    className="sr-only"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <span aria-hidden="true" className={`flex h-11 w-11 items-center justify-center rounded-xl ${selected ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                      <TeacherIcon name={definition.mode === 'Live' ? 'play' : definition.mode === 'ProgressiveChallenge' ? 'certificate' : 'quizzes'} />
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${selected ? 'bg-violet-200 text-violet-900' : 'bg-slate-100 text-slate-600'}`}>{definition.badge}</span>
                  </div>
                  <h2 className="mt-4 text-xl font-black text-slate-950">{definition.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{definition.description}</p>
                  <p className="mt-4 border-t border-slate-200 pt-3 text-xs font-bold leading-5 text-slate-500">مناسب لـ: {definition.recommendedFor}</p>
                </label>
              );
            })}
          </div>
        </fieldset>

        <section className="teacher-surface max-w-3xl p-5 sm:p-6" aria-labelledby="activity-name-heading">
          <h2 id="activity-name-heading" className="text-lg font-black text-slate-900">2. ما اسم النشاط؟</h2>
          <label htmlFor="activity-title" className="mt-4 block text-sm font-bold text-slate-700">اسم واضح سيظهر للطلاب</label>
          <input
            id="activity-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            autoFocus
            maxLength={200}
            placeholder="مثال: Space Adventure — تحدي الفضاء"
            className="mt-2 min-h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-900 focus:border-violet-600 focus:outline-2 focus:outline-violet-200"
          />
          <p className="mt-2 text-sm text-slate-500">لا تحتاجين إعداد رابط أو رمز أو نسخة نشر؛ English Spark ستجهز ذلك تلقائيًا.</p>
        </section>

        {error ? <p role="alert" className="max-w-3xl rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={!title.trim() || createMutation.isPending}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 text-sm font-black text-white hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
            {createMutation.isPending ? 'جارٍ تجهيز النشاط…' : 'التالي: إضافة الأسئلة'}
            {!createMutation.isPending ? <span aria-hidden="true">←</span> : null}
          </button>
          <Link to="/dashboard/quizzes/new" className="inline-flex min-h-11 items-center justify-center px-4 text-sm font-bold text-slate-500 hover:text-slate-800">المنشئ المتقدم</Link>
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
