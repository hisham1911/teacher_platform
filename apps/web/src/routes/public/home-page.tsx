import { Link } from 'react-router';

const adventureCards = [
  {
    icon: '🏆',
    eyebrow: 'CHALLENGE',
    title: 'تحديات تشبه اللعبة',
    description: 'مستويات، نقاط، تقدم واضح وهدف يخلي الطالب عايز يكمل للنهاية.',
    className: 'border-amber-200 bg-amber-50/80',
    iconClassName: 'bg-amber-200 text-amber-950',
  },
  {
    icon: '🎧',
    eyebrow: 'LISTEN',
    title: 'اسمع وتعلّم',
    description: 'الصوت والمفردات والأسئلة في تجربة سريعة ومريحة على الموبايل.',
    className: 'border-sky-200 bg-sky-50/80',
    iconClassName: 'bg-sky-200 text-sky-950',
  },
  {
    icon: '⚡',
    eyebrow: 'QUICK PLAY',
    title: 'دخول في ثوانٍ',
    description: 'رمز نشاط سريع أو كود طالب شخصي، بدون تعقيد أو خطوات كثيرة.',
    className: 'border-emerald-200 bg-emerald-50/80',
    iconClassName: 'bg-emerald-200 text-emerald-950',
  },
] as const;

const journeySteps = [
  ['01', 'ادخل', 'برمز نشاط أو كودك الشخصي.'],
  ['02', 'العب', 'جاوب، اسمع، وتقدم خطوة بخطوة.'],
  ['03', 'تطور', 'ارجع لمحاولاتك وشوف تقدمك ونتائجك.'],
] as const;

export default function HomePage() {
  return (
    <div className="space-y-9 pb-6 sm:space-y-12 sm:pb-12">
      <section className="spark-home-hero student-enter relative isolate overflow-hidden rounded-[2.25rem] border border-white/70 px-5 py-7 shadow-[0_30px_90px_rgb(76_29_149/0.16)] sm:px-8 sm:py-10 lg:min-h-[38rem] lg:px-12 lg:py-12">
        <HomeHeroBackdrop />

        <div className="relative z-10 grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/80 px-3 py-2 text-[11px] font-black tracking-[0.08em] text-violet-800 shadow-sm backdrop-blur sm:text-xs">
              <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-xs text-white">✦</span>
              ENGLISH SPARK · LEARN • PLAY • EXPLORE
            </div>

            <h1 className="mt-6 text-4xl font-black leading-[1.12] text-slate-950 sm:text-5xl lg:text-7xl">
              التعلّم يبدأ{' '}
              <span className="mt-1 block bg-gradient-to-l from-emerald-600 via-violet-700 to-fuchsia-600 bg-clip-text text-transparent">بشرارة.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base font-semibold leading-8 text-slate-600 sm:text-lg sm:leading-9">
              مساحة ممتعة تخلي الإنجليزي تحديات ومغامرات قصيرة بدل ما يكون مجرد اختبار. الطالب يلعب ويتقدم، والمعلم يصنع التجربة ويتابع النتيجة بسهولة.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Link
                to="/join"
                className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-500 px-5 text-base font-black text-white shadow-[0_16px_34px_rgb(5_150_105/0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgb(5_150_105/0.3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 motion-reduce:transform-none">
                <span aria-hidden="true" className="text-xl transition-transform group-hover:-translate-y-0.5 motion-reduce:transform-none">🚀</span>
                دخول الطالب بالرمز
              </Link>
              <Link
                to="/student"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-violet-200 bg-white/90 px-5 text-base font-black text-violet-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 motion-reduce:transform-none">
                <span aria-hidden="true">✨</span>
                عندي كود طالب
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <Link to="/auth/login" className="font-black text-slate-800 underline decoration-violet-300 decoration-2 underline-offset-4 hover:text-violet-800">أنا معلم · دخول Studio</Link>
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-slate-300" />
              <Link to="/auth/signup" className="font-bold text-slate-500 hover:text-violet-800">إنشاء مساحة جديدة</Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-2.5 text-xs font-black text-slate-600">
              <span className="rounded-full border border-white bg-white/75 px-3 py-1.5 shadow-sm">✓ مناسب للموبايل</span>
              <span className="rounded-full border border-white bg-white/75 px-3 py-1.5 shadow-sm">✓ تقدم محفوظ</span>
              <span className="rounded-full border border-white bg-white/75 px-3 py-1.5 shadow-sm">✓ بدون تعقيد</span>
            </div>
          </div>

          <HeroGamePreview />
        </div>
      </section>

      <section aria-labelledby="adventure-heading" className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black tracking-[0.14em] text-emerald-700">STUDENT-FIRST EXPERIENCE</p>
          <h2 id="adventure-heading" className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">كل نشاط له إحساس بالمغامرة</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600 sm:text-base">مش مجرد شاشة سؤال وإجابة. كل جزء مصمم عشان الطالب يفهم هو فين، عمل إيه، وإيه الخطوة اللي بعدها.</p>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {adventureCards.map((card) => (
            <article key={card.title} className={`group rounded-[1.75rem] border p-5 shadow-[0_12px_30px_rgb(15_23_42/0.05)] transition hover:-translate-y-1 hover:shadow-[0_18px_38px_rgb(15_23_42/0.09)] motion-reduce:transform-none ${card.className}`}>
              <div className="flex items-start justify-between gap-4">
                <span aria-hidden="true" className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shadow-sm ${card.iconClassName}`}>{card.icon}</span>
                <span className="rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-black tracking-[0.1em] text-slate-500">{card.eyebrow}</span>
              </div>
              <h3 className="mt-5 text-xl font-black text-slate-950">{card.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 p-6 text-white shadow-[0_24px_60px_rgb(15_23_42/0.16)] sm:p-8">
          <span aria-hidden="true" className="absolute -left-12 -top-12 h-36 w-36 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <span aria-hidden="true" className="absolute -bottom-14 right-0 h-44 w-44 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="relative z-10">
            <p className="text-xs font-black tracking-[0.13em] text-amber-300">YOUR LEARNING SPACE</p>
            <h2 className="mt-3 text-3xl font-black leading-tight">مساحة الطالب تفضل معاه</h2>
            <p className="mt-3 max-w-lg text-sm font-semibold leading-7 text-slate-300">يدخل بكوده الشخصي، يكمل النشاط اللي وقف عنده، ويرجع لآخر محاولاته ونتائجه من أي جهاز.</p>

            <div className="mt-6 grid grid-cols-3 gap-2">
              <MiniStat value="12" label="نشاط" icon="✓" />
              <MiniStat value="88%" label="متوسط" icon="★" />
              <MiniStat value="3" label="شهادات" icon="◇" />
            </div>

            <Link to="/student" className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-black text-violet-900 transition hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">فتح بوابة الطالب</Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-violet-100 bg-white/90 p-6 shadow-[0_18px_50px_rgb(76_29_149/0.07)] backdrop-blur sm:p-8" aria-labelledby="journey-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.13em] text-violet-700">THE JOURNEY</p>
              <h2 id="journey-heading" className="mt-2 text-3xl font-black text-slate-950">3 خطوات… ويبدأ اللعب</h2>
            </div>
            <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-2xl">🧭</span>
          </div>

          <div className="mt-7 space-y-3">
            {journeySteps.map(([number, title, description], index) => (
              <div key={number} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition hover:border-violet-200 hover:bg-violet-50/60">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-violet-700 shadow-sm">{number}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-slate-950">{title}</h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{description}</p>
                </div>
                <span aria-hidden="true" className="text-lg text-slate-300">{index === journeySteps.length - 1 ? '🏁' : '←'}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="spark-home-final relative overflow-hidden rounded-[2.25rem] border border-violet-200 px-5 py-8 text-center shadow-[0_24px_60px_rgb(76_29_149/0.1)] sm:px-8 sm:py-10">
        <div className="relative z-10 mx-auto max-w-2xl">
          <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-2xl font-black text-white shadow-lg">✦</span>
          <p className="mt-4 text-xs font-black tracking-[0.14em] text-violet-700">READY FOR THE NEXT SPARK?</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">ادخل وجربها بنفسك</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-slate-600 sm:text-base">طالب؟ ابدأ برمز أو كودك الشخصي. معلم؟ افتح Studio وابنِ أول نشاط.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/join" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-700 px-6 text-sm font-black text-white shadow-sm hover:bg-violet-800">🚀 ابدأ كنشاط سريع</Link>
            <Link to="/auth/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-violet-200 bg-white px-6 text-sm font-black text-violet-800 shadow-sm hover:bg-violet-50">دخول المعلم إلى Studio</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroGamePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[30rem] lg:max-w-none" aria-label="معاينة تجربة English Spark للطالب">
      <div aria-hidden="true" className="spark-home-float absolute -right-3 -top-5 z-20 flex h-16 w-16 items-center justify-center rounded-[1.4rem] border-4 border-white bg-amber-300 text-2xl shadow-xl sm:-right-5">⭐</div>
      <div aria-hidden="true" className="spark-home-float-delayed absolute -bottom-4 -left-3 z-20 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-sky-300 text-xl shadow-xl sm:-left-5">Aa</div>

      <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-gradient-to-br from-violet-700 via-indigo-700 to-slate-950 p-4 shadow-[0_32px_70px_rgb(49_46_129/0.36)] sm:p-5">
        <div aria-hidden="true" className="spark-home-grid absolute inset-0 opacity-30" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-amber-200 ring-1 ring-white/10">MISSION 03 · SPACE RUN</div>
              <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Reach Mars 🚀</h2>
              <p className="mt-1 text-xs font-bold text-violet-200">Keep going — you’re doing great!</p>
            </div>
            <span aria-hidden="true" className="spark-brand-mark flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-600 text-xl text-white">✦</span>
          </div>

          <div className="mt-5 rounded-full bg-white/10 p-1">
            <div className="h-2 w-[58%] rounded-full bg-gradient-to-l from-emerald-300 to-emerald-400" />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-black text-violet-200"><span>LEVEL 3 OF 5</span><span>580 XP</span></div>

          <div className="mt-4 rounded-[1.5rem] bg-white p-4 shadow-xl sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black text-violet-700">PLANET 03 · +100 ⭐</span>
              <span className="text-xs font-black text-emerald-700">2 streak 🔥</span>
            </div>
            <p className="mt-4 text-lg font-black leading-7 text-slate-950 sm:text-xl">Which planet is known as the Red Planet?</p>
            <div className="mt-4 grid grid-cols-2 gap-2.5 text-sm font-black">
              <span className="rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-center text-slate-600">Earth</span>
              <span className="relative rounded-xl border-2 border-emerald-400 bg-emerald-50 p-3 text-center text-emerald-900 shadow-sm">Mars ✦</span>
              <span className="rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-center text-slate-600">Venus</span>
              <span className="rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-center text-slate-600">Jupiter</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-black text-white">
            <div className="rounded-xl bg-white/10 px-2 py-2.5 ring-1 ring-white/10"><span className="block text-base">🚀</span><span className="mt-1 block text-violet-100">3 / 10</span></div>
            <div className="rounded-xl bg-white/10 px-2 py-2.5 ring-1 ring-white/10"><span className="block text-base">⭐</span><span className="mt-1 block text-violet-100">300</span></div>
            <div className="rounded-xl bg-white/10 px-2 py-2.5 ring-1 ring-white/10"><span className="block text-base">🔥</span><span className="mt-1 block text-violet-100">x2</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-2 py-3 text-center ring-1 ring-white/10 backdrop-blur">
      <span aria-hidden="true" className="text-sm text-amber-300">{icon}</span>
      <p dir="ltr" className="mt-1 text-xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-bold text-slate-300">{label}</p>
    </div>
  );
}

function HomeHeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-violet-300/35 blur-3xl" />
      <span className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-emerald-200/55 blur-3xl" />
      <span className="absolute left-[38%] top-[8%] h-44 w-44 rounded-full bg-amber-200/35 blur-3xl" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 650" preserveAspectRatio="xMidYMid slice" fill="none">
        <g opacity="0.1" stroke="#6D28D9" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M72 186h72v58H72z" />
          <path d="M72 186l36 25 36-25" />
          <path d="M1080 165c18-19 48-18 65 1 16 18 14 45-3 60l-28 26-28-26c-18-16-20-44-6-61Z" />
          <path d="M115 515h70M150 480v70" />
          <path d="m1017 485 12 25 28 4-20 19 5 28-25-13-24 13 5-28-20-19 27-4 12-25Z" />
        </g>
        <g fill="#7C3AED" opacity="0.1" fontFamily="ui-rounded, system-ui, sans-serif" fontWeight="900">
          <text x="64" y="110" fontSize="60">Aa</text>
          <text x="1040" y="105" fontSize="56">Bb</text>
          <text x="90" y="600" fontSize="54">123</text>
          <text x="1090" y="570" fontSize="72">?</text>
        </g>
        <g opacity="0.18" fill="#F59E0B">
          <path d="m270 104 6 13 14 6-14 6-6 13-6-13-14-6 14-6 6-13Z" />
          <path d="m852 96 7 15 15 7-15 7-7 15-7-15-15-7 15-7 7-15Z" />
          <path d="m410 570 5 11 11 5-11 5-5 11-5-11-11-5 11-5 5-11Z" />
        </g>
      </svg>
    </div>
  );
}
