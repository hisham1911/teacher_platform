import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { extractJoinCode, normalizeJoinCode } from './student-join-input';

type DemoQuestion = {
  prompt: string;
  helper: string;
  options: readonly string[];
  correctIndex: number;
};

const demoQuestions: readonly [DemoQuestion, ...DemoQuestion[]] = [
  {
    prompt: 'What does “Book” mean?',
    helper: 'اختر المعنى الصحيح.',
    options: ['كتاب', 'قلم', 'باب'],
    correctIndex: 0,
  },
  {
    prompt: 'Complete: I ___ happy.',
    helper: 'اختر الكلمة المناسبة.',
    options: ['am', 'is', 'are'],
    correctIndex: 0,
  },
  {
    prompt: 'Which word matches this? 🍎',
    helper: 'اختر الكلمة التي تناسب الصورة.',
    options: ['Apple', 'Chair', 'House'],
    correctIndex: 0,
  },
];

const studentMoments = [
  ['⚡', 'ادخل بسرعة', 'معك رمز نشاط؟ اكتبه وابدأ مباشرة، من غير حساب أو خطوات طويلة.'],
  ['🏆', 'العب بطريقتك', 'نشاط فردي، مسابقة مباشرة، أو تحدٍ متدرج مستوى بعد مستوى.'],
  ['↩️', 'كمّل من مكانك', 'إذا كان لديك كود طالب، ترجع لمساحتك وتكمل المحاولة المحفوظة.'],
  ['📈', 'شاهد تقدمك', 'راجع نتائجك ومحاولاتك، وتجد شهاداتك عندما تستحقها.'],
] as const;

export default function HomePage() {
  return (
    <div className="spark-student-home min-h-dvh overflow-x-hidden bg-[var(--student-bg)] text-slate-950" dir="rtl">
      <PublicBackdrop />
      <header className="relative z-20 mx-auto flex min-h-18 w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200">
          <span aria-hidden="true" className="spark-brand-mark flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-xl text-white">✦</span>
          <span className="font-black tracking-wide">English Spark</span>
        </Link>
        <Link to="/teachers" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-black text-violet-800 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200">هل أنت معلم؟</Link>
      </header>

      <main className="animate-page-enter relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24">
        <section className="grid min-h-[calc(100dvh-5rem)] items-center gap-8 py-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12 lg:py-10">
          <div className="max-w-2xl">
            <h1 className="mt-5 text-balance text-4xl font-black leading-[1.18] text-slate-950 sm:text-5xl">
              جاهز تبدأ؟
              <span className="mt-1 block text-[var(--spark-violet)]">ادخل النشاط وابدأ.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base font-semibold leading-8 text-slate-600 sm:text-lg">
              عندك رمز نشاط من المعلم؟ اكتبه هنا. وعندك كود طالب؟ ادخل لمساحتك وتابع ما بدأت ونتائجك من نفس المكان.
            </p>

            <ActivityCodeCard />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link to="/student" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-violet-200 bg-white/85 px-5 text-sm font-black text-violet-900 shadow-sm hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200">عندي كود طالب</Link>
              <span className="text-xs font-semibold text-slate-500">كود الطالب يفتح مساحتك وتقدمك، وليس نشاطًا واحدًا فقط.</span>
            </div>
          </div>

          <MiniGame />
        </section>

        <section aria-labelledby="student-moments-title" className="py-8 sm:py-12">
          <div className="max-w-2xl">
            <h2 id="student-moments-title" className="mt-2 text-3xl font-black leading-tight sm:text-4xl">كل خطوة واضحة من غير قوائم معقدة</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 sm:text-base">الرابط أو الرمز يأخذك للنشاط مباشرة، ومساحة الطالب تجمع التقدم والنتائج التي تخصك.</p>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {studentMoments.map(([icon, title, description]) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-lg">
                <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-2xl">{icon}</span>
                <h3 className="mt-4 text-lg font-black">{title}</h3>
                <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="my-8 overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-[0_26px_70px_rgb(15_23_42/0.2)] sm:p-9">
          <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black tracking-[0.12em] text-amber-300">ترجع كل مرة بنفسك</p>
              <h2 className="mt-2 text-3xl font-black">عندك كود طالب؟ مساحتك مستنياك.</h2>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-300 sm:text-base">سجّل بكودك الشخصي لتكمل محاولة بدأتَها، تراجع آخر نتائجك، وتجد شهاداتك في مكان واحد.</p>
            </div>
            <Link to="/student" className="inline-flex min-h-13 items-center justify-center rounded-xl bg-white px-6 text-sm font-black text-slate-950 shadow-sm transition-shadow hover:shadow-lg hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300">الدخول إلى مساحتي</Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/70 bg-white/45 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs font-semibold text-slate-500 sm:px-6">
          <span>English Spark</span>
          <nav className="flex items-center gap-4" aria-label="روابط عامة">
            <Link className="min-h-11 content-center hover:text-violet-800" to="/privacy">الخصوصية</Link>
            <Link className="min-h-11 content-center hover:text-violet-800" to="/terms">الشروط</Link>
            <Link className="min-h-11 content-center font-black text-violet-700 hover:text-violet-900" to="/teachers">للمعلمين</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function ActivityCodeCard() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = extractJoinCode(code);
    if (normalized.length < 4) {
      setError('اكتب رمز النشاط أو الصق الرابط الذي أرسله لك المعلم.');
      return;
    }
    navigate(`/play/${normalized}`);
  }

  return (
    <form onSubmit={submit} className="mt-7 rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-lg backdrop-blur-xl sm:p-5" aria-label="الدخول برمز النشاط">
      <label htmlFor="home-join-code" className="text-sm font-black text-slate-800">رمز النشاط</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="home-join-code"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          value={code}
          onChange={(event) => {
            const value = event.target.value;
            setCode(value.includes('/') || value.includes('://') ? extractJoinCode(value) : normalizeJoinCode(value));
            setError(null);
          }}
          placeholder="SPARK123"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'home-join-error' : 'home-join-hint'}
          className="min-h-14 min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-white px-4 text-center font-mono text-xl font-black tracking-[0.12em] outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        />
        <button type="submit" className="inline-flex min-h-14 items-center justify-center rounded-xl bg-emerald-700 px-6 text-base font-black text-white shadow-sm hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">ابدأ النشاط</button>
      </div>
      {error ? <p id="home-join-error" role="alert" className="mt-2 text-sm font-bold text-rose-700">{error}</p> : <p id="home-join-hint" className="mt-2 text-xs font-semibold text-slate-500">يمكنك أيضًا لصق رابط النشاط كاملًا.</p>}
    </form>
  );
}

function MiniGame() {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const question = demoQuestions[index] ?? demoQuestions[0];

  function choose(optionIndex: number) {
    if (selected !== null) return;
    setSelected(optionIndex);
    if (optionIndex === question.correctIndex) setScore((current) => current + 1);
  }

  function next() {
    if (index === demoQuestions.length - 1) {
      setFinished(true);
      return;
    }
    setIndex((current) => current + 1);
    setSelected(null);
  }

  function restart() {
    setIndex(0);
    setScore(0);
    setSelected(null);
    setFinished(false);
  }

  return (
    <section className="relative mx-auto w-full max-w-xl" aria-label="تجربة مصغرة">
      <div className="overflow-hidden rounded-[2rem] border border-white/90 bg-white/86 shadow-[0_28px_80px_rgb(76_29_149/0.16)] backdrop-blur-xl">
        <div className="bg-gradient-to-l from-violet-800 via-indigo-800 to-slate-950 px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-black text-violet-200">تجربة سريعة</p><h2 className="mt-1 text-lg font-black">جرّب سؤالًا بنفسك</h2></div>
            {!finished ? <span dir="ltr" className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">{index + 1} / {demoQuestions.length}</span> : null}
          </div>
        </div>
        <div className="p-5 sm:p-7">
          {finished ? (
            <div className="py-4 text-center">
              <div aria-hidden="true" className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">🏅</div>
              <h2 className="mt-4 text-2xl font-black">خلصت التجربة</h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">نتيجتك {score} من {demoQuestions.length}. هذه مجرد تجربة صغيرة؛ الأنشطة الحقيقية تحفظ تقدمك ونتيجتك.</p>
              <button type="button" onClick={restart} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-5 text-sm font-black text-violet-800 hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200">جرّب من جديد</button>
            </div>
          ) : (
            <>
              <p className="text-xs font-black text-emerald-700">{question.helper}</p>
              <h3 dir="auto" className="mt-2 text-balance text-2xl font-black leading-10">{question.prompt}</h3>
              <div className="mt-5 grid gap-2">
                {question.options.map((option, optionIndex) => {
                  const isSelected = selected === optionIndex;
                  const isCorrect = optionIndex === question.correctIndex;
                  const revealCorrect = selected !== null && isCorrect;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => choose(optionIndex)}
                      disabled={selected !== null}
                      className={`min-h-14 rounded-xl border-2 px-4 text-start text-base font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 ${revealCorrect ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : isSelected ? 'border-amber-400 bg-amber-50 text-amber-950' : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50'} disabled:cursor-default`}>
                      {option}
                    </button>
                  );
                })}
              </div>
              <div aria-live="polite" className="mt-4 min-h-8">
                {selected !== null ? <p className={`text-sm font-black ${selected === question.correctIndex ? 'text-emerald-700' : 'text-amber-800'}`}>{selected === question.correctIndex ? 'إجابة صحيحة ✓' : 'مش دي — شوف الإجابة الصحيحة وجرب السؤال اللي بعده.'}</p> : null}
              </div>
              <button type="button" onClick={next} disabled={selected === null} className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-violet-700 px-5 text-sm font-black text-white hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-40">{index === demoQuestions.length - 1 ? 'شوف النتيجة' : 'السؤال التالي'}</button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// Removed PageBackdrop, using PublicBackdrop from root-layout
