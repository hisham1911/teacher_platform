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

const studentBenefits = [
  {
    icon: '⚡',
    title: 'يدخل بسرعة',
    description: 'رمز النشاط يفتح له المهمة مباشرة، من غير حساب أو خطوات طويلة.',
  },
  {
    icon: '🎯',
    title: 'يعرف هو وصل لفين',
    description: 'تقدّم واضح أثناء النشاط، ونتيجة مفهومة بعد ما يخلص.',
  },
  {
    icon: '↗',
    title: 'يكمل من جهاز تاني',
    description: 'بكود الطالب الشخصي يقدر يرجع لمساحته ومحاولاته ويكمل من حيث توقف.',
  },
] as const;

const teacherBenefits = [
  ['أنشئ النشاط', 'ابنِ الأسئلة واختر طريقة اللعب المناسبة للدرس.'],
  ['شارك الطلاب', 'أرسل رمز النشاط أو استخدم حساب الطالب للمتابعة المستمرة.'],
  ['راجع النتائج', 'شاهد المحاولات والنتائج من مكان واحد بدل التجميع اليدوي.'],
] as const;

export default function HomePage() {
  return (
    <div className="spark-home-page relative space-y-10 pb-8 sm:space-y-14 sm:pb-14">
      <PageBackdrop />

      <section className="relative z-10 grid gap-8 lg:grid-cols-[1fr_0.92fr] lg:items-center lg:gap-12 lg:py-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/80 px-3 py-2 text-xs font-black text-violet-800 shadow-sm backdrop-blur">
            <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-white">✦</span>
            ENGLISH SPARK
          </div>

          <h1 className="mt-6 text-4xl font-black leading-[1.16] text-slate-950 sm:text-5xl lg:text-6xl">
            تعلّم الإنجليزية بالممارسة،
            <span className="mt-1 block bg-gradient-to-l from-emerald-600 via-violet-700 to-fuchsia-600 bg-clip-text text-transparent">لا بالحفظ فقط.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base font-semibold leading-8 text-slate-600 sm:text-lg sm:leading-9">
            أنشطة قصيرة ومسابقات تفاعلية تساعد الطالب يفهم ويشارك، وتخلّي المعلم يعرف بسهولة مين تقدّم ومين محتاج متابعة.
          </p>

          <StudentEntryPanel />

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="font-bold text-slate-500">للمعلم:</span>
            <Link to="/auth/login" className="font-black text-violet-800 underline decoration-violet-300 decoration-2 underline-offset-4 hover:text-violet-950">تسجيل الدخول</Link>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-slate-300" />
            <Link to="/auth/signup" className="font-bold text-slate-500 hover:text-violet-800">إنشاء حساب</Link>
          </div>
        </div>

        <InteractiveDemo />
      </section>

      <section aria-labelledby="student-benefits-heading" className="relative z-10 rounded-[2rem] border border-white/80 bg-white/72 p-5 shadow-[0_24px_70px_rgb(76_29_149/0.08)] backdrop-blur-xl sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-xs font-black tracking-[0.12em] text-emerald-700">للطالب</p>
            <h2 id="student-benefits-heading" className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">التجربة واضحة من أول دخول لحد النتيجة</h2>
            <p className="mt-3 max-w-lg text-sm font-semibold leading-7 text-slate-600 sm:text-base">الطالب مش محتاج يفهم النظام كله. كل مرة يشوف الخطوة اللي محتاج يعملها فقط.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {studentBenefits.map((item) => (
              <article key={item.title} className="rounded-[1.6rem] border border-violet-100 bg-white/88 p-5 shadow-[0_12px_30px_rgb(15_23_42/0.05)]">
                <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-xl">{item.icon}</span>
                <h3 className="mt-4 text-lg font-black text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="teacher-benefits-heading" className="relative z-10 overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-[0_28px_80px_rgb(15_23_42/0.18)] sm:p-9">
        <div aria-hidden="true" className="spark-home-grid absolute inset-0 opacity-80" />
        <div aria-hidden="true" className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/25 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div>
            <p className="text-xs font-black tracking-[0.12em] text-amber-300">للمعلم</p>
            <h2 id="teacher-benefits-heading" className="mt-3 text-3xl font-black leading-tight sm:text-4xl">أنشئ النشاط وتابع الفصل من مكان واحد</h2>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-7 text-slate-300 sm:text-base">من إنشاء النشاط ومشاركته، لحد متابعة المحاولات والنتائج. بدون ملفات متفرقة أو خطوات معقدة.</p>
            <Link to="/auth/login" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-black text-violet-900 transition hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">دخول المعلم</Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {teacherBenefits.map(([title, description], index) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                <span className="text-xs font-black text-amber-300">0{index + 1}</span>
                <h3 className="mt-3 font-black text-white">{title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 rounded-[2rem] border border-violet-200/80 bg-white/76 px-5 py-8 text-center shadow-[0_20px_60px_rgb(76_29_149/0.09)] backdrop-blur-xl sm:px-8 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <span aria-hidden="true" className="mx-auto flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-xl font-black text-white shadow-lg">✦</span>
          <h2 className="mt-4 text-3xl font-black text-slate-950 sm:text-4xl">اختار طريقة الدخول المناسبة</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-slate-600 sm:text-base">رمز النشاط لبدء مهمة سريعة، وكود الطالب للرجوع لمساحتك وتقدمك.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link to="/join" className="inline-flex min-h-13 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700">ابدأ نشاطًا</Link>
            <Link to="/student" className="inline-flex min-h-13 items-center justify-center rounded-xl border border-violet-200 bg-white px-6 text-sm font-black text-violet-800 shadow-sm transition hover:bg-violet-50">متابعة تقدمي</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function StudentEntryPanel() {
  return (
    <div className="mt-7 rounded-[1.7rem] border border-white/90 bg-white/78 p-3 shadow-[0_18px_44px_rgb(76_29_149/0.1)] backdrop-blur-xl sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-sm font-black text-slate-950">دخول الطالب</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">اختار حسب الكود اللي معاك.</p>
        </div>
        <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-lg">🎒</span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Link to="/join" className="group rounded-2xl bg-emerald-600 p-4 text-white shadow-[0_12px_28px_rgb(5_150_105/0.2)] transition hover:-translate-y-0.5 hover:bg-emerald-700 motion-reduce:transform-none">
          <span className="block text-base font-black">ابدأ نشاطًا</span>
          <span className="mt-1 block text-xs font-semibold text-emerald-50">معك رمز النشاط من المعلم</span>
        </Link>
        <Link to="/student" className="group rounded-2xl border border-violet-200 bg-violet-50/80 p-4 text-violet-950 transition hover:-translate-y-0.5 hover:bg-violet-100 motion-reduce:transform-none">
          <span className="block text-base font-black">متابعة تقدمي</span>
          <span className="mt-1 block text-xs font-semibold text-violet-600">معك كود الطالب الشخصي</span>
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
    <div className="relative mx-auto w-full max-w-[31rem]" aria-label="تجربة تفاعلية مصغرة من English Spark">
      <div aria-hidden="true" className="spark-home-float absolute -right-2 -top-4 z-20 flex h-14 w-14 items-center justify-center rounded-[1.25rem] border-4 border-white bg-amber-300 text-2xl shadow-xl sm:-right-5">⭐</div>
      <div aria-hidden="true" className="spark-home-float-delayed absolute -bottom-3 -left-2 z-20 flex h-13 w-13 items-center justify-center rounded-full border-4 border-white bg-sky-300 text-sm font-black text-sky-950 shadow-xl sm:-left-4">Aa</div>

      <div className="overflow-hidden rounded-[2rem] border border-violet-200/80 bg-slate-950 shadow-[0_30px_80px_rgb(46_16_101/0.24)]">
        <div className="spark-home-grid relative border-b border-white/10 px-5 py-5 text-white sm:px-6">
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black tracking-[0.12em] text-amber-300">تجربة سريعة</p>
              <h2 className="mt-1 text-xl font-black">جرّب سؤالًا بنفسك</h2>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white">{finished ? `${score}/${demoQuestions.length}` : `${questionIndex + 1}/${demoQuestions.length}`}</span>
          </div>
          <div className="relative z-10 mt-4 h-2 overflow-hidden rounded-full bg-white/10" aria-label={`التقدم ${progress}%`}>
            <div className="h-full rounded-full bg-gradient-to-l from-amber-300 via-fuchsia-400 to-violet-400 transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6">
          {finished ? (
            <div className="py-4 text-center" aria-live="polite">
              <span aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-emerald-100 text-3xl">🏆</span>
              <h3 className="mt-4 text-2xl font-black text-slate-950">خلصت التجربة</h3>
              <p className="mt-2 text-sm font-semibold text-slate-600">نتيجتك {score} من {demoQuestions.length}. دي مجرد عينة صغيرة من شكل التفاعل داخل الأنشطة.</p>
              <button type="button" onClick={restartDemo} className="mt-5 min-h-11 rounded-xl bg-violet-700 px-5 text-sm font-black text-white transition hover:bg-violet-800">جرّب من جديد</button>
            </div>
          ) : (
            <>
              <p className="text-xs font-black text-violet-700">{question.helper}</p>
              <h3 className="mt-2 text-2xl font-black leading-tight text-slate-950" dir="ltr">{question.prompt}</h3>

              <div className="mt-5 grid gap-2.5">
                {question.options.map((option, index) => {
                  const isCorrectOption = answered && index === question.correctIndex;
                  const isWrongSelection = answered && selectedIndex === index && index !== question.correctIndex;
                  const stateClass = isCorrectOption
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                    : isWrongSelection
                      ? 'border-rose-300 bg-rose-50 text-rose-900'
                      : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-violet-300 hover:bg-violet-50';

                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={answered}
                      onClick={() => chooseAnswer(index)}
                      className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 text-right text-sm font-black transition disabled:cursor-default ${stateClass}`}>
                      <span>{option}</span>
                      {isCorrectOption ? <span aria-hidden="true">✓</span> : null}
                      {isWrongSelection ? <span aria-hidden="true">×</span> : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 min-h-12" aria-live="polite">
                {answered ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                    <span className={`text-sm font-black ${selectedCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>{selectedCorrect ? 'إجابة صحيحة 👏' : 'مش دي. الإجابة الصحيحة موضحة فوق.'}</span>
                    <button type="button" onClick={continueDemo} className="min-h-10 rounded-lg bg-violet-700 px-4 text-xs font-black text-white transition hover:bg-violet-800">{isLastQuestion ? 'شوف النتيجة' : 'السؤال التالي'}</button>
                  </div>
                ) : (
                  <p className="px-1 text-xs font-semibold text-slate-400">اختار إجابة علشان تكمل.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PageBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[-3rem] -z-10 h-[calc(100%+7rem)] w-screen -translate-x-1/2 overflow-hidden">
      <div className="spark-home-world absolute inset-0" />
      <span className="spark-home-float absolute right-[5%] top-[14rem] text-4xl opacity-20">✦</span>
      <span className="spark-home-float-delayed absolute left-[7%] top-[35rem] text-3xl opacity-20">Aa</span>
      <span className="spark-home-float absolute right-[8%] top-[58rem] text-4xl opacity-15">★</span>
      <span className="spark-home-float-delayed absolute left-[10%] top-[82rem] text-4xl opacity-15">?</span>
    </div>
  );
}
