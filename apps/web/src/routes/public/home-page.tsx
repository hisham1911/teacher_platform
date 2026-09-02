import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
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
    helper: 'اختار المعنى الصحيح.',
    options: ['كتاب', 'قلم', 'باب'],
    correctIndex: 0,
  },
  {
    prompt: 'Complete: I ___ happy.',
    helper: 'اختار الكلمة المناسبة.',
    options: ['am', 'is', 'are'],
    correctIndex: 0,
  },
  {
    prompt: 'Which word matches this? 🍎',
    helper: 'اختار الكلمة اللي تناسب الصورة.',
    options: ['Chair', 'Apple', 'House'],
    correctIndex: 1,
  },
];

const playModes = [
  {
    icon: '⚡',
    title: 'نشاط فردي',
    description: 'جاوب على مهلك، وراجع نتيجتك بعد ما تخلص.',
  },
  {
    icon: '🏁',
    title: 'مسابقة مباشرة',
    description: 'جاوب مع الفصل في نفس الوقت وتابع ترتيبك.',
  },
  {
    icon: '🚀',
    title: 'تحدّي متدرّج',
    description: 'عدّي المستوى علشان تفتح اللي بعده وتكمل التحدّي.',
  },
] as const;

export default function HomePage() {
  return (
    <div className="spark-home-page pb-8 sm:pb-12">
      <section className="spark-home-hero grid gap-10 py-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-14 lg:py-14">
        <div className="max-w-2xl">
          <p className="spark-home-kicker">ENGLISH SPARK · للطالب</p>
          <h1 className="mt-4 text-4xl font-black leading-[1.12] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.55rem]">
            ادخل النشاط.
            <span className="block text-violet-700">وخلي تركيزك في السؤال.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base font-semibold leading-8 text-slate-600 sm:text-lg">
            معاك رمز نشاط من المعلم؟ اكتبه وابدأ فورًا. من غير حساب ولا خطوات زيادة.
          </p>

          <ActivityQuickJoin />

          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="font-semibold">عندك كود طالب شخصي؟</span>
            <Link to="/student" className="font-black text-violet-700 underline decoration-violet-200 decoration-2 underline-offset-4 hover:text-violet-900">
              ادخل مساحتك
            </Link>
          </div>
        </div>

        <MiniChallenge />
      </section>

      <section aria-labelledby="play-modes-heading" className="spark-home-section py-14 sm:py-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.12em] text-emerald-700">مش كل نشاط بنفس الشكل</p>
            <h2 id="play-modes-heading" className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">3 طرق للعب</h2>
          </div>
          <p className="max-w-lg text-sm font-semibold leading-7 text-slate-500 sm:text-left">
            المعلم يحدد نوع النشاط، وإنت تدخل مباشرة للتجربة المطلوبة.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {playModes.map((mode, index) => (
            <article key={mode.title} className="spark-mode-card">
              <div className="flex items-center justify-between gap-4">
                <span aria-hidden="true" className="spark-mode-icon">{mode.icon}</span>
                <span className="text-xs font-black text-slate-300">0{index + 1}</span>
              </div>
              <h3 className="mt-7 text-xl font-black text-slate-950">{mode.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">{mode.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="student-space-heading" className="spark-student-space my-14 grid overflow-hidden lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <StudentSpacePreview />

        <div className="p-6 sm:p-9 lg:p-11">
          <p className="text-xs font-black tracking-[0.12em] text-violet-700">مساحة الطالب</p>
          <h2 id="student-space-heading" className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            كل اللي عملته، في مكان واحد.
          </h2>
          <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-slate-600 sm:text-base">
            كود الطالب الشخصي بيرجعك لمساحتك بدل ما تبدأ من جديد كل مرة.
          </p>

          <ul className="mt-7 space-y-4 text-sm font-bold text-slate-700">
            <StudentSpaceBenefit>كمّل محاولة محفوظة من آخر نقطة.</StudentSpaceBenefit>
            <StudentSpaceBenefit>راجع نتائجك والمحاولات اللي خلصتها.</StudentSpaceBenefit>
            <StudentSpaceBenefit>افتح شهاداتك لما تكون متاحة.</StudentSpaceBenefit>
          </ul>

          <Link to="/student" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-700 px-6 text-sm font-black text-white shadow-sm transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200">
            دخول مساحتي
          </Link>
        </div>
      </section>
    </div>
  );
}

function ActivityQuickJoin() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = extractJoinCode(code);

    if (normalized.length < 4) {
      setError('اكتب رمز النشاط اللي بعتهولك المعلم.');
      return;
    }

    navigate(`/play/${normalized}`);
  }

  return (
    <form onSubmit={submit} className="spark-join-card mt-7" aria-label="الدخول برمز النشاط">
      <label htmlFor="home-activity-code" className="text-sm font-black text-slate-800">رمز النشاط</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="home-activity-code"
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
          aria-describedby={error ? 'home-activity-error' : 'home-activity-hint'}
          className="min-h-14 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-center font-mono text-xl font-black tracking-[0.12em] text-slate-950 outline-none transition placeholder:text-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        />
        <button type="submit" className="inline-flex min-h-14 items-center justify-center rounded-xl bg-emerald-600 px-6 text-base font-black text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">
          دخول النشاط
        </button>
      </div>
      {error ? (
        <p id="home-activity-error" role="alert" className="mt-2 text-sm font-bold text-rose-700">{error}</p>
      ) : (
        <p id="home-activity-hint" className="mt-2 text-xs font-semibold text-slate-400">ينفع كمان تلصق رابط النشاط كامل.</p>
      )}
    </form>
  );
}

function MiniChallenge() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = demoQuestions[questionIndex] ?? demoQuestions[0];
  const answered = selectedIndex !== null;
  const selectedCorrect = answered && selectedIndex === question.correctIndex;
  const isLastQuestion = questionIndex === demoQuestions.length - 1;

  function chooseAnswer(index: number) {
    if (answered || finished) return;
    setSelectedIndex(index);
    if (index === question.correctIndex) setScore((current) => current + 1);
  }

  function nextQuestion() {
    if (!answered) return;
    if (isLastQuestion) {
      setFinished(true);
      return;
    }
    setQuestionIndex((current) => current + 1);
    setSelectedIndex(null);
  }

  function restart() {
    setQuestionIndex(0);
    setSelectedIndex(null);
    setScore(0);
    setFinished(false);
  }

  return (
    <div className="spark-demo-card" aria-label="تجربة تفاعلية مصغرة">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-xs font-black text-emerald-300">جرّب بنفسك</p>
          <p className="mt-1 text-sm font-bold text-slate-300">3 أسئلة سريعة</p>
        </div>
        {!finished ? <span dir="ltr" className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white">{questionIndex + 1} / {demoQuestions.length}</span> : null}
      </div>

      <div className="p-5 sm:p-6">
        {finished ? (
          <div className="py-5 text-center">
            <span aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-300 text-3xl">🏆</span>
            <h2 className="mt-4 text-2xl font-black text-white">خلصت التجربة</h2>
            <p className="mt-2 text-sm font-semibold text-slate-300">جبت {score} من {demoQuestions.length}.</p>
            <button type="button" onClick={restart} className="mt-5 min-h-11 rounded-xl border border-white/15 bg-white/10 px-5 text-sm font-black text-white transition hover:bg-white/15">
              جرّب من جديد
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs font-bold text-slate-400">{question.helper}</p>
            <h2 dir="ltr" className="mt-2 text-left text-2xl font-black leading-tight text-white">{question.prompt}</h2>

            <div className="mt-6 grid gap-2.5">
              {question.options.map((option, index) => {
                const correct = answered && index === question.correctIndex;
                const selectedWrong = answered && index === selectedIndex && !correct;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={answered}
                    onClick={() => chooseAnswer(index)}
                    className={`spark-demo-option ${correct ? 'spark-demo-option-correct' : ''} ${selectedWrong ? 'spark-demo-option-wrong' : ''}`}>
                    {option}
                  </button>
                );
              })}
            </div>

            {answered ? (
              <div aria-live="polite" className={`mt-4 rounded-xl px-4 py-3 text-sm font-black ${selectedCorrect ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200'}`}>
                {selectedCorrect ? 'صح 👏' : `الإجابة الصحيحة: ${question.options[question.correctIndex]}`}
              </div>
            ) : null}

            <button type="button" disabled={!answered} onClick={nextQuestion} className="mt-4 min-h-12 w-full rounded-xl bg-white px-4 text-sm font-black text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35">
              {isLastQuestion ? 'شوف النتيجة' : 'السؤال التالي'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StudentSpacePreview() {
  return (
    <div className="spark-space-preview-wrap p-5 sm:p-8" role="img" aria-label="مثال توضيحي لمساحة الطالب">
      <div className="spark-space-preview">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-black text-emerald-700">مساحة الطالب</p>
            <p className="mt-1 text-lg font-black text-slate-950">أهلًا يا نور 👋</p>
          </div>
          <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">🎒</span>
        </div>

        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-black text-emerald-700">كمّل من آخر نقطة</p>
          <p className="mt-1 font-black text-slate-950">Vocabulary Mission</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full w-2/3 rounded-full bg-emerald-500" />
          </div>
          <p className="mt-2 text-xs font-bold text-slate-500">66% مكتمل</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-2xl font-black text-slate-950">8</p>
            <p className="mt-1 text-xs font-bold text-slate-500">أنشطة مكتملة</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-2xl font-black text-slate-950">82%</p>
            <p className="mt-1 text-xs font-bold text-slate-500">متوسط النتائج</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentSpaceBenefit({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">✓</span>
      <span className="leading-6">{children}</span>
    </li>
  );
}
