import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { TeacherIcon } from '../../../components/ui/teacher-icon';
import { quizzesApi } from '../../../data/api-client/endpoints';
import { HttpError } from '../../../data/api-client/http-error';
import {
  ACTIVITY_MODES,
  type ActivityMode,
  type ActivityModeDefinition,
} from '../../../features/activities/activity-mode';
import { getActiveTenantId } from '../../../lib/auth/session';

const RECOMMENDED_MODE: ActivityMode = 'ProgressiveChallenge';
const STUDENT_EXPERIENCE: Record<ActivityMode, { icon: string; label: string }> = {
  ProgressiveChallenge: { icon: '🚀', label: 'يتقدم مستوى بعد مستوى' },
  SelfPaced: { icon: '🧠', label: 'يحل كل طالب في وقته' },
  Live: { icon: '⚡', label: 'الجميع يشارك في نفس الوقت' },
};

export default function ActivityNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = getActiveTenantId();
  const [mode, setMode] = useState<ActivityMode>(RECOMMENDED_MODE);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => quizzesApi.create(tenantId!, { title: title.trim(), slug: createActivitySlug(title) }),
    onSuccess: async (quiz) => {
      await queryClient.invalidateQueries({ queryKey: ['quizzes', tenantId] });
      navigate(`/dashboard/activities/${quiz.id}/build?mode=${mode}`);
    },
    onError: (mutationError) => {
      if (mutationError instanceof HttpError) {
        const body = mutationError.body as { detail?: string } | null;
        setError(body?.detail ?? 'تعذر إنشاء النشاط. راجع الاسم وحاول مرة أخرى.');
      } else {
        setError('تعذر إنشاء النشاط الآن. تحقق من الاتصال وحاول مرة أخرى.');
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

  const recommendedDefinition = ACTIVITY_MODES.find((definition) => definition.mode === RECOMMENDED_MODE)!;
  const alternativeModes = ACTIVITY_MODES.filter((definition) => definition.mode !== RECOMMENDED_MODE);
  const selectedAlternative = alternativeModes.find((definition) => definition.mode === mode);

  return (
    <div className="mx-auto max-w-5xl pb-36 lg:pb-20">
      <div className="flex items-center justify-between gap-3">
        <Link to="/dashboard" className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-slate-500 hover:bg-white hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700">→ الرئيسية</Link>
        <p className="text-xs font-semibold text-slate-400">إنشاء نشاط</p>
      </div>

      <header className="mt-4 text-center sm:text-right">
        <p className="text-sm font-bold text-violet-700">الخطوة الأولى</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">سمِّ النشاط</h1>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-8 text-slate-600 sm:mx-0">اكتب الاسم فقط. اخترنا لك طريقة لعب مناسبة كبداية، ويمكنك تغييرها لو احتجت.</p>
      </header>

      <WizardProgress />

      <form onSubmit={onSubmit} className="mt-4 space-y-5">
        <section className="teacher-surface p-5 sm:p-7" aria-labelledby="activity-name-heading">
          <div className="flex items-start gap-4">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-lg font-bold text-violet-800">1</span>
            <div className="min-w-0 flex-1">
              <h2 id="activity-name-heading" className="text-xl font-bold text-slate-950">اسم النشاط</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">اسم قصير يكفي. يمكنك تعديله بعد ذلك.</p>
              <label htmlFor="activity-title" className="sr-only">اسم النشاط</label>
              <input
                id="activity-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={200}
                autoFocus
                placeholder="مثال: تحدي كلمات الفضاء"
                className="mt-5 min-h-16 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-lg font-semibold text-slate-950 transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-4 focus:outline-violet-100"
              />
            </div>
          </div>
        </section>

        <fieldset className="teacher-surface p-5 sm:p-7">
          <legend className="sr-only">اختر طريقة اللعب</legend>
          <div className="flex items-start gap-4">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-lg font-bold text-amber-900">2</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-slate-950">طريقة اللعب</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">اترك الاختيار الحالي لو لم تكن تحتاج شيئًا مختلفًا.</p>
            </div>
          </div>

          <div className="mt-5">
            <ModeOption definition={recommendedDefinition} selected={mode === recommendedDefinition.mode} onSelect={setMode} featured />
          </div>

          <details open={mode !== RECOMMENDED_MODE} className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 text-sm font-semibold text-slate-700 marker:content-none hover:bg-slate-100/70 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-600">
              <span aria-hidden="true" className="text-base">⚙</span>
              <span>تغيير طريقة اللعب</span>
              <span className="mr-auto rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">{selectedAlternative?.title ?? 'اختياري'}</span>
              <span aria-hidden="true" className="text-slate-400">⌄</span>
            </summary>
            <div className="grid gap-3 border-t border-slate-200 p-3 lg:grid-cols-2 sm:p-4">
              {alternativeModes.map((definition) => <ModeOption key={definition.mode} definition={definition} selected={mode === definition.mode} onSelect={setMode} compact />)}
            </div>
          </details>
        </fieldset>

        {error ? <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</p> : null}

        <div className="sticky bottom-20 z-30 rounded-2xl border border-violet-100 bg-white/96 p-3 shadow-[0_18px_50px_rgb(76_29_149/0.14)] backdrop-blur lg:bottom-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="px-2 text-sm font-semibold text-slate-500">بعدها سنضيف الأسئلة.</p>
            <button type="submit" disabled={!title.trim() || createMutation.isPending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-violet-800 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:opacity-50">{createMutation.isPending ? 'جارٍ إنشاء النشاط…' : 'التالي: الأسئلة'}{!createMutation.isPending ? <span aria-hidden="true">←</span> : null}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ModeOption({ definition, selected, onSelect, featured = false, compact = false }: { definition: ActivityModeDefinition; selected: boolean; onSelect: (mode: ActivityMode) => void; featured?: boolean; compact?: boolean }) {
  const experience = STUDENT_EXPERIENCE[definition.mode];
  const icon = definition.mode === 'Live' ? 'play' : definition.mode === 'ProgressiveChallenge' ? 'certificate' : 'quizzes';
  return (
    <label className={`relative flex cursor-pointer flex-col rounded-2xl border-2 transition-all focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-violet-700 ${compact ? 'p-4' : 'p-5 sm:p-6'} ${selected ? 'border-violet-600 bg-violet-50 shadow-[0_12px_34px_rgb(109_40_217/0.1)]' : 'border-slate-200 bg-white hover:border-violet-300'}`}>
      <input type="radio" name="activity-mode" value={definition.mode} checked={selected} onChange={() => onSelect(definition.mode)} className="sr-only" />
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden="true" className={`flex h-11 w-11 items-center justify-center rounded-xl ${selected ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-600'}`}><TeacherIcon name={icon} /></span>
        <div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${featured ? 'bg-amber-100 text-amber-950' : 'bg-slate-100 text-slate-600'}`}>{featured ? 'الاختيار الافتراضي' : definition.badge}</span><span aria-hidden="true" className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${selected ? 'border-violet-700 bg-violet-700 text-white' : 'border-slate-300 text-transparent'}`}>✓</span></div>
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-950">{definition.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{definition.description}</p>
      <div className="mt-4 rounded-xl bg-white/80 p-3 ring-1 ring-slate-100"><p className="text-xs font-semibold text-slate-400">ما يراه الطالب</p><p className="mt-1 text-sm font-bold text-slate-800"><span aria-hidden="true">{experience.icon}</span> {experience.label}</p></div>
      {!compact ? <p className="mt-auto pt-4 text-xs font-semibold leading-5 text-slate-400">مناسب لـ {definition.recommendedFor}</p> : null}
    </label>
  );
}

function WizardProgress() {
  return <ol className="mt-6 grid grid-cols-3 gap-2" aria-label="مراحل إنشاء النشاط"><ProgressItem number="1" label="الاسم" active /><ProgressItem number="2" label="الأسئلة" /><ProgressItem number="3" label="المشاركة" /></ol>;
}

function ProgressItem({ number, label, active = false }: { number: string; label: string; active?: boolean }) {
  return <li className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-2 text-xs font-bold ${active ? 'border-violet-200 bg-violet-50 text-violet-800' : 'border-slate-100 bg-white text-slate-400'}`}><span aria-hidden="true" className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${active ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-500'}`}>{number}</span>{label}</li>;
}

function createActivitySlug(title: string) {
  const normalized = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  return normalized || `spark-${Date.now().toString(36)}`;
}
