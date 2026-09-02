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

const productStories = [
  {
    icon: '🧰',
    eyebrow: 'أنشئ أسرع',
    title: 'ابنِ النشاط من محتوى تقدر تستخدمه مرة بعد مرة',
    description: 'أنشئ سؤالًا بسرعة، اسحب أسئلة من بنك الأسئلة، أضف الميديا، أو استورد مجموعة كاملة من Excel وCSV مع مراجعة قبل الحفظ.',
    highlights: ['بنك أسئلة + ميديا', 'استيراد Excel / CSV', 'إنشاء جماعي'],
  },
  {
    icon: '⚡',
    eyebrow: 'شغّل بطريقتك',
    title: 'نفس المحتوى يتحول إلى أكثر من تجربة للطالب',
    description: 'شغّله كنشاط فردي، أو مسابقة مباشرة داخل الفصل، أو تحدٍ متدرج ينتهي عند الخطأ ويُظهر التقدم مستوى بعد مستوى.',
    highlights: ['نشاط فردي', 'Live + لوحة صدارة', 'تحدٍ متدرج'],
  },
  {
    icon: '👥',
    eyebrow: 'تابع الطلاب',
    title: 'الضيف يدخل فورًا، والطالب الدائم يرجع لمساحته وتقدمه',
    description: 'رمز نشاط للدخول السريع، وقائمة طلاب دائمة بأكواد شخصية، ومساحة طالب تحفظ المحاولات وتسهّل الرجوع للنشاط من جديد.',
    highlights: ['دخول سريع', 'قائمة طلاب', 'مساحة الطالب'],
  },
  {
    icon: '📊',
    eyebrow: 'اعرف النتيجة',
    title: 'كل محاولة تتحول إلى معلومة تقدر تتصرف على أساسها',
    description: 'راجع النتائج والتفاصيل، صدّر CSV، قِس أثر النشاط باستبيان، وشارك النتيجة مع ولي الأمر أو أصدر شهادة PDF عند الاستحقاق.',
    highlights: ['تقارير + CSV', 'استبيان أثر', 'شهادة + مشاركة النتيجة'],
  },
] as const;

const capabilities = [
  ['🧠', 'بنك أسئلة', 'احتفظ بالأسئلة ونظّمها وأعد استخدامها بدل البدء من الصفر كل مرة.'],
  ['🖼️', 'أسئلة وميديا', 'ادمج النص والصور والصوت داخل تجربة الطالب.'],
  ['📥', 'استيراد جماعي', 'جهّز عشرات الأسئلة من Excel أو CSV وراجعها قبل الحفظ.'],
  ['🎮', 'نشاط فردي', 'الطالب يحل في وقته مع حفظ المحاولة والنتيجة.'],
  ['🏁', 'مسابقة مباشرة', 'تحكم في الجلسة والوقت وشاهد لوحة الصدارة أثناء الفصل.'],
  ['🪜', 'تحدٍ متدرج', 'مستويات متتابعة وتوقف عند الخطأ وتجربة مخصصة للتحدي.'],
  ['👨‍🎓', 'إدارة الطلاب', 'طلاب دائمون، تفعيل وتعطيل، وأكواد دخول شخصية.'],
  ['🔁', 'استكمال التقدم', 'الطالب يرجع لمساحته ومحاولاته بدل أن يبدأ من جديد كل مرة.'],
  ['📈', 'تقارير تفصيلية', 'راجع المحاولات والنتائج ومستويات التحدي وصدّر البيانات.'],
  ['📝', 'استبيان أثر', 'اجمع رأي الطالب وقيّم أثر النشاط بعد الانتهاء.'],
  ['🏅', 'شهادات PDF', 'حوّل النجاح إلى شهادة إلكترونية قابلة للمشاركة.'],
  ['👪', 'مشاركة مع ولي الأمر', 'شارك نتيجة الطالب من رابط مخصص بدون تعقيد.'],
] as const;

const workflow = [
  ['01', 'جهّز المحتوى', 'أنشئ، أعد استخدام أو استورد الأسئلة.'],
  ['02', 'اختر طريقة اللعب', 'فردي، Live أو تحدٍ متدرج.'],
  ['03', 'أرسل للطلاب', 'برمز نشاط سريع أو من خلال مساحة الطالب.'],
  ['04', 'تابع كل محاولة', 'نتائج، تقارير، تقدم ولوحة صدارة.'],
  ['05', 'شارك الإنجاز', 'نتيجة، استبيان، أو شهادة PDF.'],
] as const;

export default function HomePage() {
  return (
    <div className="spark-home-page relative space-y-12 pb-8 sm:space-y-16 sm:pb-14">
      <PageBackdrop />

      <section className="relative z-10 grid gap-9 lg:grid-cols-[1.04fr_0.96fr] lg:items-center lg:gap-12 lg:py-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/82 px-3 py-2 text-xs font-black text-violet-800 shadow-sm backdrop-blur">
            <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-white">✦</span>
            منصة أنشطة ومسابقات للمعلم والطالب
          </div>

          <h1 className="mt-6 text-4xl font-black leading-[1.14] text-slate-950 sm:text-5xl lg:text-6xl">
            من أول سؤال…
            <span className="mt-1 block bg-gradient-to-l from-emerald-600 via-violet-700 to-fuchsia-600 bg-clip-text text-transparent">لحد النتيجة والشهادة.</span>
          </h1>

          <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-slate-600 sm:text-lg sm:leading-9">
            ابنِ نشاطك مرة، وشغّله كنشاط فردي أو مسابقة Live أو تحدٍ متدرج. English Spark تحفظ المحاولات، تجمع النتائج، وتكمل الرحلة حتى الاستبيان والشهادة—من غير ما توزّع شغلك على أدوات وملفات مختلفة.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/auth/login" className="inline-flex min-h-13 items-center justify-center rounded-xl bg-violet-700 px-6 text-sm font-black text-white shadow-[0_14px_30px_rgb(109_40_217/0.22)] transition hover:-translate-y-0.5 hover:bg-violet-800 motion-reduce:transform-none">دخول المعلم</Link>
            <Link to="/auth/signup" className="inline-flex min-h-13 items-center justify-center rounded-xl border border-violet-200 bg-white/85 px-6 text-sm font-black text-violet-900 shadow-sm transition hover:bg-violet-50">إنشاء حساب</Link>
          </div>

          <div className="mt-7 grid max-w-2xl grid-cols-2 gap-2.5 sm:grid-cols-5">
            {['بنك أسئلة', 'Live', 'تحدٍ متدرج', 'تقارير', 'شهادات'].map((item) => (
              <span key={item} className="rounded-xl border border-white/90 bg-white/70 px-3 py-2 text-center text-xs font-black text-slate-700 shadow-sm backdrop-blur">{item}</span>
            ))}
          </div>

          <StudentEntryPanel />
        </div>

        <InteractiveDemo />
      </section>

      <section aria-labelledby="product-story-heading" className="relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black tracking-[0.12em] text-violet-700">English Spark في الشغل الحقيقي</p>
          <h2 id="product-story-heading" className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">أكثر من اختبار. دورة نشاط كاملة.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-600 sm:text-base">بدل أداة للأسئلة، وأداة للمسابقة، وملف للنتائج، وطريقة منفصلة للشهادات؛ كل خطوة في رحلة النشاط موجودة في مكان واحد.</p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {productStories.map((story) => (
            <article key={story.title} className="rounded-[2rem] border border-white/90 bg-white/78 p-5 shadow-[0_20px_55px_rgb(76_29_149/0.08)] backdrop-blur-xl sm:p-7">
              <div className="flex items-start gap-4">
                <span aria-hidden="true" className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-2xl">{story.icon}</span>
                <div>
                  <p className="text-xs font-black text-violet-700">{story.eyebrow}</p>
                  <h3 className="mt-1.5 text-xl font-black leading-8 text-slate-950 sm:text-2xl">{story.title}</h3>
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold leading-7 text-slate-600 sm:text-base">{story.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {story.highlights.map((highlight) => (
                  <span key={highlight} className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-800">{highlight}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="capabilities-heading" className="relative z-10 overflow-hidden rounded-[2.25rem] bg-slate-950 p-6 text-white shadow-[0_30px_90px_rgb(15_23_42/0.2)] sm:p-9">
        <div aria-hidden="true" className="spark-home-grid absolute inset-0 opacity-80" />
        <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />

        <div className="relative z-10">
          <div className="max-w-3xl">
            <p className="text-xs font-black tracking-[0.12em] text-amber-300">كل أدواتك في مكان واحد</p>
            <h2 id="capabilities-heading" className="mt-3 text-3xl font-black leading-tight sm:text-4xl">من صناعة المحتوى إلى متابعة النتيجة</h2>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-300 sm:text-base">كل اللي تحتاجه لتصنع تجربة كاملة للطالب من غير ما تشتت شغلك بين منصات وملفات وروابط مختلفة.</p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {capabilities.map(([icon, title, description]) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-white/7 p-4 backdrop-blur-sm">
                <span aria-hidden="true" className="text-2xl">{icon}</span>
                <h3 className="mt-3 font-black text-white">{title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="workflow-heading" className="relative z-10 rounded-[2rem] border border-white/90 bg-white/76 p-5 shadow-[0_22px_65px_rgb(76_29_149/0.08)] backdrop-blur-xl sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[0.68fr_1.32fr] lg:items-start">
          <div>
            <p className="text-xs font-black tracking-[0.12em] text-emerald-700">دورة واحدة بدل أدوات متفرقة</p>
            <h2 id="workflow-heading" className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">من فكرة الدرس إلى إنجاز يقدر الطالب يشارك به</h2>
            <p className="mt-4 text-sm font-semibold leading-7 text-slate-600 sm:text-base">المعلم يركز على المحتوى، والمنصة تتولى رحلة النشاط: الدخول، اللعب، حفظ المحاولات، النتائج وما بعدها.</p>
          </div>

          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {workflow.map(([number, title, description]) => (
              <li key={number} className="rounded-2xl border border-violet-100 bg-white/88 p-4 shadow-sm">
                <span className="text-xs font-black text-violet-600">{number}</span>
                <h3 className="mt-2 font-black text-slate-950">{title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative z-10 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-emerald-200/70 bg-emerald-50/72 p-6 shadow-[0_18px_50px_rgb(5_150_105/0.08)] backdrop-blur sm:p-8">
          <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-200 text-2xl">🎒</span>
          <p className="mt-5 text-xs font-black text-emerald-800">للطالب</p>
          <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">يدخل بسرعة… ويرجع لتقدمه لما يحتاج</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 sm:text-base">النشاط السريع لا يحتاج حسابًا. ولو الطالب له ملف دائم، يدخل بكوده الشخصي لمساحته ويرى محاولاته ويكمل بدل ما يبدأ كل مرة من جديد.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link to="/join" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700">ابدأ نشاطًا</Link>
            <Link to="/student" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-emerald-200 bg-white px-5 text-sm font-black text-emerald-900 transition hover:bg-emerald-100">متابعة تقدمي</Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-violet-200/70 bg-violet-50/72 p-6 shadow-[0_18px_50px_rgb(109_40_217/0.08)] backdrop-blur sm:p-8">
          <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-200 text-2xl">🧑‍🏫</span>
          <p className="mt-5 text-xs font-black text-violet-800">للمعلم أو الأكاديمية</p>
          <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">جهّز التجربة مرة… وخلّي المتابعة منظمة</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 sm:text-base">بنك أسئلة، أنشطة قابلة لإعادة الاستخدام، طلاب دائمون، تقارير وشهادات؛ بدل ما تتوزع العملية بين نماذج وملفات وروابط مختلفة.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/auth/login" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-700 px-5 text-sm font-black text-white transition hover:bg-violet-800">دخول المعلم</Link>
            <Link to="/auth/signup" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-violet-200 bg-white px-5 text-sm font-black text-violet-900 transition hover:bg-violet-100">ابدأ حسابك</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function StudentEntryPanel() {
  return (
    <div className="mt-7 max-w-2xl rounded-[1.7rem] border border-white/90 bg-white/78 p-3 shadow-[0_18px_44px_rgb(76_29_149/0.1)] backdrop-blur-xl sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-sm font-black text-slate-950">طالب؟ ادخل من هنا</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">اختار حسب نوع الكود اللي معاك.</p>
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

      <div className="overflow-hidden rounded-[2rem] border border-violet-200/80 bg-slate-950 shadow-[0_30px_80px_rgb(76_29_149/0.2)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-white">
          <div>
            <p className="text-xs font-black text-amber-300">جرّب تجربة الطالب</p>
            <p className="mt-1 text-sm font-bold text-slate-300">Mini activity · 3 questions</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black">{finished ? 'تم' : `${questionIndex + 1} / ${demoQuestions.length}`}</span>
        </div>

        <div className="h-1.5 bg-white/8">
          <div className="h-full bg-gradient-to-r from-emerald-400 via-amber-300 to-fuchsia-400 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
        </div>

        <div className="bg-gradient-to-b from-slate-950 to-violet-950 p-5 sm:p-6">
          {finished ? (
            <div className="rounded-[1.6rem] bg-white p-6 text-center shadow-xl">
              <span aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">🏆</span>
              <h2 className="mt-4 text-2xl font-black text-slate-950">خلصت التجربة</h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">نتيجتك {score} من {demoQuestions.length}</p>
              <button type="button" onClick={restartDemo} className="mt-5 min-h-12 rounded-xl bg-violet-700 px-5 text-sm font-black text-white transition hover:bg-violet-800">جرّب من جديد</button>
            </div>
          ) : (
            <div className="rounded-[1.6rem] bg-white p-5 shadow-xl sm:p-6">
              <p className="text-xs font-black text-violet-700">سؤال {questionIndex + 1}</p>
              <h2 className="mt-2 text-xl font-black leading-8 text-slate-950 sm:text-2xl">{question.prompt}</h2>
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
                    <button key={option} type="button" disabled={answered} onClick={() => chooseAnswer(index)} className={`min-h-12 rounded-xl border px-4 text-right text-sm font-black transition disabled:cursor-default ${answerState}`}>
                      {option}
                    </button>
                  );
                })}
              </div>

              {answered ? (
                <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-black ${selectedCorrect ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
                  {selectedCorrect ? 'إجابة صحيحة ✨' : `مش دي. الإجابة الصحيحة: ${question.options[question.correctIndex]}`}
                </div>
              ) : null}

              <button type="button" disabled={!answered} onClick={continueDemo} className="mt-4 min-h-12 w-full rounded-xl bg-violet-700 px-4 text-sm font-black text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                {isLastQuestion ? 'شوف النتيجة' : 'السؤال التالي'}
              </button>
            </div>
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
