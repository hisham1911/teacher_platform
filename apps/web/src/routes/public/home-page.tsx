import { useState } from 'react';
import { Link } from 'react-router';

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

const studentExperiences = [
  {
    icon: '⚡',
    label: 'نشاط سريع',
    title: 'معاك رمز؟ ادخل وابدأ فورًا',
    description: 'من غير حساب أو خطوات طويلة. اكتب رمز النشاط وابدأ اللعب على طول.',
    accent: 'emerald',
  },
  {
    icon: '🏁',
    label: 'مسابقة مباشرة',
    title: 'جاوب مع الفصل وشوف ترتيبك',
    description: 'في الـLive كل سؤال له وقته، ولوحة الصدارة بتخلي المنافسة واضحة وممتعة.',
    accent: 'amber',
  },
  {
    icon: '🚀',
    label: 'تحدّي متدرّج',
    title: 'كل إجابة تفتح مستوى جديد',
    description: 'اتقدّم مستوى وراء مستوى. أول إجابة غلط تنهي التحدّي، فكل اختيار يفرق.',
    accent: 'violet',
  },
  {
    icon: '🎒',
    label: 'مساحتك',
    title: 'ارجع وكمل من آخر نقطة',
    description: 'بكود الطالب الشخصي ترجع لمساحتك ومحاولاتك، وحتى من جهاز تاني.',
    accent: 'sky',
  },
  {
    icon: '🏅',
    label: 'إنجازك',
    title: 'شوف نتيجتك وما حققته',
    description: 'بعد ما تخلص تشوف نتيجتك، ولو النشاط له شهادة واستوفيت الشروط تقدر تفتحها.',
    accent: 'rose',
  },
] as const;

const adventureSteps = [
  ['01', 'ادخل', 'رمز نشاط لبداية سريعة، أو كود الطالب للرجوع لمساحتك.'],
  ['02', 'العب', 'نشاط فردي، مسابقة Live، أو تحدّي متدرّج.'],
  ['03', 'كمّل', 'لو خرجت من نشاطك، محاولتك تفضل محفوظة لما يكون الاستكمال متاحًا.'],
  ['04', 'شوف إنجازك', 'النتيجة والتقدم — والشهادة لو النشاط بيدعمها وحققت شروطها.'],
] as const;

export default function HomePage() {
  return (
    <div className="spark-home-page relative space-y-12 pb-8 sm:space-y-16 sm:pb-14">
      <PageBackdrop />

      <section className="relative z-10 grid min-h-[70vh] gap-9 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-12 lg:py-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/78 px-3 py-2 text-xs font-black text-violet-800 shadow-sm backdrop-blur-xl">
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-white shadow-sm">✦</span>
            ENGLISH SPARK · تعلّم • العب • اتحدّى
          </div>

          <h1 className="mt-6 text-4xl font-black leading-[1.08] text-slate-950 sm:text-5xl lg:text-6xl">
            جاهز؟
            <span className="mt-1 block bg-gradient-to-l from-emerald-600 via-violet-700 to-fuchsia-600 bg-clip-text text-transparent">التحدّي مستنيك.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-slate-600 sm:text-lg sm:leading-9">
            معاك رمز نشاط من معلمك؟ ادخل وابدأ فورًا. عندك كود طالب؟ افتح مساحتك وكمل من آخر نقطة.
          </p>

          <StudentEntryPanel />

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-bold text-slate-500">
            <span>مش طالب؟</span>
            <Link to="/auth/login" className="font-black text-violet-800 underline decoration-violet-300 decoration-2 underline-offset-4 hover:text-violet-950">دخول المعلم</Link>
          </div>
        </div>

        <InteractiveDemo />
      </section>

      <section aria-labelledby="experiences-heading" className="relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black tracking-[0.12em] text-violet-700">كل مرة تجربة مختلفة</p>
          <h2 id="experiences-heading" className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">إيه اللي ممكن تقابله جوه English Spark؟</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-600 sm:text-base">مش كل نشاط شكله واحد. المعلم يختار الطريقة، وإنت تدخل للتجربة اللي مستنياك.</p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {studentExperiences.map((experience) => (
            <article key={experience.title} className={`spark-experience-card spark-experience-${experience.accent} rounded-[1.8rem] border bg-white/82 p-5 backdrop-blur-xl`}>
              <div className="flex items-center justify-between gap-3">
                <span aria-hidden="true" className="spark-experience-icon flex h-12 w-12 items-center justify-center rounded-2xl text-2xl">{experience.icon}</span>
                <span className="text-[10px] font-black tracking-[0.08em] text-slate-400">{experience.label}</span>
              </div>
              <h3 className="mt-5 text-lg font-black leading-7 text-slate-950">{experience.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">{experience.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="adventure-heading" className="relative z-10 overflow-hidden rounded-[2.4rem] bg-slate-950 px-5 py-8 text-white shadow-[0_30px_90px_rgb(15_23_42/0.22)] sm:px-8 sm:py-10">
        <div aria-hidden="true" className="spark-home-grid absolute inset-0 opacity-80" />
        <div aria-hidden="true" className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-violet-500/30 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-28 left-0 h-72 w-72 rounded-full bg-emerald-400/18 blur-3xl" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <div>
            <p className="text-xs font-black tracking-[0.12em] text-amber-300">طريقك جوه المنصة</p>
            <h2 id="adventure-heading" className="mt-3 text-3xl font-black leading-tight sm:text-4xl">ادخل، العب، كمّل، وشوف إنجازك</h2>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-slate-300 sm:text-base">مش مطلوب منك تفهم النظام. كل مرة هتلاقي الخطوة اللي محتاج تعملها قدامك.</p>
          </div>

          <ol className="spark-adventure-path relative grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {adventureSteps.map(([number, title, description], index) => (
              <li key={number} className="spark-adventure-stop relative rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-xs font-black text-amber-300">{number}</span>
                  <span aria-hidden="true" className="text-lg text-slate-500">{index === adventureSteps.length - 1 ? '🏆' : '→'}</span>
                </div>
                <h3 className="mt-4 font-black text-white">{title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="portal-preview-heading" className="relative z-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="order-2 lg:order-1">
          <p className="text-xs font-black tracking-[0.12em] text-emerald-700">كود الطالب = مساحتك</p>
          <h2 id="portal-preview-heading" className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">مش لازم تبدأ من الأول كل مرة</h2>
          <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-slate-600 sm:text-base">لو معاك كود طالب شخصي، English Spark تفتح لك مساحتك وتعرض محاولاتك الأخيرة، نتيجتك، والشهادات اللي حصلت عليها. ولو فيه نشاط قابل للاستكمال ترجع له مباشرة.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/student" className="inline-flex min-h-13 items-center justify-center rounded-xl bg-violet-700 px-6 text-sm font-black text-white shadow-[0_12px_28px_rgb(109_40_217/0.2)] transition hover:-translate-y-0.5 hover:bg-violet-800 motion-reduce:transform-none">افتح مساحتي</Link>
            <Link to="/join" className="inline-flex min-h-13 items-center justify-center rounded-xl border border-emerald-200 bg-white/84 px-6 text-sm font-black text-emerald-900 shadow-sm transition hover:bg-emerald-50">معايا رمز نشاط</Link>
          </div>
        </div>

        <PortalPreview />
      </section>

      <section className="relative z-10 overflow-hidden rounded-[2.2rem] border border-violet-200/70 bg-white/78 px-5 py-8 text-center shadow-[0_22px_70px_rgb(76_29_149/0.1)] backdrop-blur-xl sm:px-8 sm:py-10">
        <div aria-hidden="true" className="absolute left-8 top-7 text-3xl opacity-15">Aa</div>
        <div aria-hidden="true" className="absolute right-10 top-8 text-3xl opacity-15">★</div>
        <div className="relative mx-auto max-w-2xl">
          <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-2xl text-white shadow-lg">✦</span>
          <h2 className="mt-5 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">معاك الكود؟ ابدأ دلوقتي</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-slate-600 sm:text-base">رمز النشاط لبداية سريعة. كود الطالب للرجوع لمساحتك وتقدمك.</p>
          <div className="mx-auto mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
            <Link to="/join" className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-emerald-600 px-6 text-base font-black text-white shadow-[0_12px_28px_rgb(5_150_105/0.2)] transition hover:bg-emerald-700">معايا رمز نشاط</Link>
            <Link to="/student" className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 px-6 text-base font-black text-violet-900 transition hover:bg-violet-100">أدخل مساحتي</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function StudentEntryPanel() {
  return (
    <div className="mt-7 max-w-2xl rounded-[1.8rem] border border-white/90 bg-white/78 p-3 shadow-[0_18px_44px_rgb(76_29_149/0.1)] backdrop-blur-xl sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-sm font-black text-slate-950">اختار اللي معاك</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">رمز النشاط غير كود الطالب الشخصي.</p>
        </div>
        <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-lg">🎒</span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Link to="/join" className="group rounded-2xl bg-emerald-600 p-4 text-white shadow-[0_12px_28px_rgb(5_150_105/0.2)] transition hover:-translate-y-0.5 hover:bg-emerald-700 motion-reduce:transform-none">
          <span className="flex items-center justify-between gap-3">
            <span className="text-base font-black">معايا رمز نشاط</span>
            <span aria-hidden="true" className="text-lg">⚡</span>
          </span>
          <span className="mt-1.5 block text-xs font-semibold leading-5 text-emerald-50">ابدأ النشاط اللي بعتهولك المعلم</span>
        </Link>
        <Link to="/student" className="group rounded-2xl border border-violet-200 bg-violet-50/84 p-4 text-violet-950 transition hover:-translate-y-0.5 hover:bg-violet-100 motion-reduce:transform-none">
          <span className="flex items-center justify-between gap-3">
            <span className="text-base font-black">أدخل مساحتي</span>
            <span aria-hidden="true" className="text-lg">🎯</span>
          </span>
          <span className="mt-1.5 block text-xs font-semibold leading-5 text-violet-600">معايا كود الطالب الشخصي</span>
        </Link>
      </div>
    </div>
  );
}

function InteractiveDemo() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = demoQuestions[questionIndex] ?? demoQuestions[0];
  const answered = selectedIndex !== null;
  const selectedCorrect = answered && selectedIndex === question.correctIndex;
  const isLastQuestion = questionIndex === demoQuestions.length - 1;
  const progress = finished ? 100 : Math.round(((questionIndex + (answered ? 1 : 0)) / demoQuestions.length) * 100);

  function chooseAnswer(index: number) {
    if (answered || finished) return;
    setSelectedIndex(index);
    if (index === question.correctIndex) setScore((current) => current + 1);
  }

  function continueDemo() {
    if (!answered) return;
    if (isLastQuestion) {
      setFinished(true);
      return;
    }
    setQuestionIndex((current) => current + 1);
    setSelectedIndex(null);
  }

  function restartDemo() {
    setQuestionIndex(0);
    setSelectedIndex(null);
    setScore(0);
    setFinished(false);
  }

  return (
    <div className="relative mx-auto w-full max-w-[32rem]" aria-label="جولة تجريبية تفاعلية من English Spark">
      <div aria-hidden="true" className="spark-home-float absolute -right-2 -top-5 z-20 flex h-14 w-14 items-center justify-center rounded-[1.25rem] border-4 border-white bg-amber-300 text-2xl shadow-xl sm:-right-5">⭐</div>
      <div aria-hidden="true" className="spark-home-float-delayed absolute -bottom-3 -left-2 z-20 flex h-13 w-13 items-center justify-center rounded-full border-4 border-white bg-sky-300 text-sm font-black text-sky-950 shadow-xl sm:-left-4">Aa</div>

      <div className="overflow-hidden rounded-[2.1rem] border border-violet-200/70 bg-slate-950 shadow-[0_34px_90px_rgb(76_29_149/0.22)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-white">
          <div>
            <p className="text-xs font-black text-amber-300">جولة تجريبية</p>
            <p className="mt-1 text-sm font-bold text-slate-300">3 أسئلة · جرّب بنفسك</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">صح {score}</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">{finished ? 'تم' : `${questionIndex + 1}/${demoQuestions.length}`}</span>
          </div>
        </div>

        <div className="h-1.5 bg-white/8">
          <div className="h-full bg-gradient-to-r from-emerald-400 via-amber-300 to-fuchsia-400 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
        </div>

        <div className="bg-gradient-to-b from-slate-950 via-violet-950 to-slate-950 p-5 sm:p-6">
          {finished ? (
            <div className="rounded-[1.7rem] bg-white p-6 text-center shadow-xl">
              <span aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">🏆</span>
              <h2 className="mt-4 text-2xl font-black text-slate-950">خلصت الجولة!</h2>
              <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">جبت {score} من {demoQuestions.length}. {score === demoQuestions.length ? 'كاملة 👏' : 'جرّب مرة كمان وهات الكاملة.'}</p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                <button type="button" onClick={restartDemo} className="min-h-12 rounded-xl border border-violet-200 bg-violet-50 px-5 text-sm font-black text-violet-900 transition hover:bg-violet-100">جرّب من جديد</button>
                <Link to="/join" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700">ادخل نشاطك الحقيقي</Link>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.7rem] bg-white p-5 shadow-xl sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black text-violet-700">سؤال {questionIndex + 1}</p>
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700">English</span>
              </div>
              <h2 className="mt-3 text-xl font-black leading-8 text-slate-950 sm:text-2xl">{question.prompt}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">{question.helper}</p>

              <div className="mt-5 grid gap-2.5">
                {question.options.map((option, index) => {
                  const selected = selectedIndex === index;
                  const correct = index === question.correctIndex;
                  const answerState = answered
                    ? correct
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                      : selected
                        ? 'border-rose-300 bg-rose-50 text-rose-950'
                        : 'border-slate-200 bg-white text-slate-700'
                    : 'border-slate-200 bg-white text-slate-900 hover:border-violet-300 hover:bg-violet-50';

                  return (
                    <button key={option} type="button" disabled={answered} onClick={() => chooseAnswer(index)} className={`min-h-13 rounded-xl border px-4 text-right text-sm font-black transition disabled:cursor-default ${answerState}`}>
                      {option}
                    </button>
                  );
                })}
              </div>

              {answered ? (
                <div aria-live="polite" className={`mt-4 rounded-xl px-4 py-3 text-sm font-black ${selectedCorrect ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
                  {selectedCorrect ? 'صح! كمّل 👏' : `مش دي. الإجابة الصحيحة: ${question.options[question.correctIndex]}`}
                </div>
              ) : null}

              <button type="button" disabled={!answered} onClick={continueDemo} className="mt-4 min-h-12 w-full rounded-xl bg-violet-700 px-4 text-sm font-black text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                {isLastQuestion ? 'شوف نتيجتي' : 'السؤال اللي بعده'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PortalPreview() {
  return (
    <div className="order-1 mx-auto w-full max-w-[36rem] lg:order-2" aria-label="مثال توضيحي لمساحة الطالب">
      <div className="spark-portal-preview rounded-[2rem] border border-white/90 bg-white/84 p-4 shadow-[0_26px_75px_rgb(5_150_105/0.12)] backdrop-blur-xl sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-black text-emerald-700">مثال لمساحة الطالب</p>
            <p className="mt-1 font-black text-slate-950">أهلًا يا نور 👋</p>
          </div>
          <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-lg">🎒</span>
        </div>

        <div className="mt-4 rounded-2xl border-2 border-emerald-200 bg-gradient-to-l from-emerald-50 to-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black text-emerald-700">أكمل من حيث توقفت</p>
              <p className="mt-1 truncate font-black text-slate-950">Vocabulary Mission</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">محاولتك محفوظة</p>
            </div>
            <span className="inline-flex min-h-10 shrink-0 items-center rounded-xl bg-emerald-600 px-3 text-xs font-black text-white">متابعة</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <PreviewStat value="8" label="مكتمل" />
          <PreviewStat value="82%" label="متوسطك" />
          <PreviewStat value="2" label="شهادات" />
        </div>

        <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-black text-slate-950">Grammar Sprint</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">مكتمل · النتيجة 90%</p>
            </div>
            <span aria-hidden="true" className="text-lg">✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-2 py-3 text-center">
      <p dir="ltr" className="text-lg font-black text-slate-950">{value}</p>
      <p className="mt-1 text-[10px] font-bold text-slate-500">{label}</p>
    </div>
  );
}

function PageBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[-3rem] -z-10 h-[calc(100%+7rem)] w-screen -translate-x-1/2 overflow-hidden">
      <div className="spark-home-world absolute inset-0" />
      <div className="spark-home-orbit absolute left-[-16rem] top-[14rem] h-[38rem] w-[38rem] rounded-full" />
      <div className="spark-home-orbit spark-home-orbit-secondary absolute right-[-20rem] top-[72rem] h-[44rem] w-[44rem] rounded-full" />
      <span className="spark-home-float absolute right-[5%] top-[13rem] text-4xl opacity-20">✦</span>
      <span className="spark-home-float-delayed absolute left-[7%] top-[34rem] text-3xl opacity-20">Aa</span>
      <span className="spark-home-float absolute right-[8%] top-[58rem] text-4xl opacity-15">★</span>
      <span className="spark-home-float-delayed absolute left-[10%] top-[88rem] text-4xl opacity-15">?</span>
      <span className="spark-home-float absolute right-[10%] top-[118rem] text-4xl opacity-14">Bb</span>
      <span className="spark-home-float-delayed absolute left-[8%] top-[145rem] text-4xl opacity-12">123</span>
    </div>
  );
}
