import { Link } from 'react-router';

const highlights = [
  ['🏆', 'Spark Challenge', 'تحديات متدرجة تحول المراجعة إلى رحلة مستويات بدل اختبار تقليدي.'],
  ['🎧', 'Listen & Learn', 'دمج الصوت والمفردات داخل أنشطة قصيرة وواضحة.'],
  ['📚', 'Question Bank', 'إعادة استخدام الأسئلة وبناء أنشطة جديدة بسرعة بدل كتابة المحتوى من الصفر.'],
] as const;

const creatorSteps = [
  ['01', 'اختيار النشاط', 'فردي، مباشر، أو تحدٍ متدرج.'],
  ['02', 'إضافة المحتوى', 'سؤال جديد، بنك الأسئلة، أو مجموعة من Excel/CSV.'],
  ['03', 'مشاركة الرابط', 'English Spark تتولى النشر والجلسة والرابط تلقائيًا.'],
] as const;

export default function HomePage() {
  return (
    <div className="space-y-10 pb-5 sm:space-y-14 sm:pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-violet-100 bg-white px-5 py-7 shadow-[0_24px_70px_rgb(76_29_149/0.08)] sm:px-9 sm:py-10 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-8 lg:px-12 lg:py-14">
        <span aria-hidden="true" className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-200/35 blur-3xl" />
        <span aria-hidden="true" className="absolute -bottom-24 right-10 h-72 w-72 rounded-full bg-amber-200/45 blur-3xl" />

        <div className="relative z-10">
          <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-800">ENGLISH SPARK · LEARN • PLAY • EXPLORE</span>
          <h1 className="mt-5 text-4xl font-black leading-[1.15] text-slate-950 sm:text-5xl lg:text-6xl">التعلّم يبدأ بشرارة.</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg sm:leading-9">منصة تعلم تفاعلية تضع تجربة الطالب في المركز، وتمنح صانع المحتوى أدوات سريعة لبناء التحديات والأنشطة ومتابعة النتائج.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link to="/auth/login" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 text-base font-black text-white shadow-sm transition hover:bg-violet-800 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700">تسجيل الدخول <span aria-hidden="true">←</span></Link>
            <Link to="/auth/signup" className="inline-flex min-h-13 items-center justify-center rounded-xl border border-violet-200 bg-white px-6 text-base font-black text-violet-800 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700">إنشاء مساحة جديدة</Link>
          </div>
          <p className="mt-5 text-sm font-semibold text-slate-500">الطالب يستطيع فتح رابط النشاط والبدء بالاسم مباشرة — بدون حساب أو كلمة مرور.</p>
        </div>

        <div className="relative z-10 mt-9 lg:mt-0" aria-label="معاينة تجربة English Spark">
          <div className="mx-auto max-w-md rounded-[1.75rem] border border-violet-100 bg-gradient-to-br from-violet-700 via-indigo-700 to-slate-950 p-4 shadow-2xl sm:p-5">
            <div className="flex items-center justify-between"><div><p className="text-xs font-black text-amber-200">MISSION 03 · SPACE RUN</p><p className="mt-1 text-xl font-black text-white">Reach Mars 🚀</p></div><span className="spark-brand-mark flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-600 text-xl text-white">✦</span></div>
            <div className="mt-5 flex items-center gap-2" aria-hidden="true"><span className="h-2.5 flex-1 rounded-full bg-emerald-400" /><span className="h-2.5 flex-1 rounded-full bg-emerald-400" /><span className="h-2.5 flex-1 rounded-full bg-amber-300" /><span className="h-2.5 flex-1 rounded-full bg-white/15" /><span className="h-2.5 flex-1 rounded-full bg-white/15" /></div>
            <div className="mt-4 rounded-2xl bg-white p-4 text-slate-950"><p className="text-xs font-black text-violet-700">PLANET 03 · +100 ⭐</p><p className="mt-2 text-lg font-black leading-7">Which planet is known as the Red Planet?</p><div className="mt-4 grid grid-cols-2 gap-2 text-sm font-bold"><span className="rounded-xl border border-slate-200 p-3">Earth</span><span className="rounded-xl border border-violet-300 bg-violet-50 p-3 text-violet-900">Mars ✦</span><span className="rounded-xl border border-slate-200 p-3">Venus</span><span className="rounded-xl border border-slate-200 p-3">Jupiter</span></div></div>
            <div className="mt-3 flex items-center justify-between text-xs font-bold text-violet-100"><span>🚀 3 / 10 محطات</span><span>Score 300 ⭐</span></div>
          </div>
        </div>
      </section>

      <section aria-labelledby="spark-highlights-heading">
        <div className="max-w-2xl"><p className="text-sm font-black text-violet-700">الطالب أولًا</p><h2 id="spark-highlights-heading" className="mt-2 text-3xl font-black text-slate-950">محتوى أسهل في الإنشاء، وتجربة أقوى في اللعب</h2><p className="mt-3 text-base leading-8 text-slate-600">Studio هادئة وعملية لصناعة المحتوى، وتجربة طالب منفصلة بصريًا ومصممة للموبايل.</p></div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">{highlights.map(([icon, title, description]) => <article key={title} className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none"><span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-2xl">{icon}</span><h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{description}</p></article>)}</div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2rem] border border-violet-100 bg-white p-5 sm:p-8" aria-labelledby="creator-flow-heading"><p className="text-sm font-black text-amber-700">English Spark Studio</p><h2 id="creator-flow-heading" className="mt-2 text-3xl font-black text-slate-950">من الفكرة إلى رابط الطلاب في 3 خطوات</h2><div className="mt-7 grid gap-5 md:grid-cols-3">{creatorSteps.map(([number, title, description]) => <div key={number} className="relative border-r-2 border-violet-100 pr-4"><span className="text-sm font-black text-violet-500">{number}</span><h3 className="mt-2 text-lg font-black text-slate-950">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{description}</p></div>)}</div></div>
        <div className="rounded-[2rem] bg-slate-950 p-6 text-white sm:p-8"><p className="text-sm font-black text-amber-300">Student Flow</p><h2 className="mt-2 text-3xl font-black">ادخل. العب. تقدم.</h2><div className="mt-6 space-y-4 text-sm leading-7 text-slate-300"><p><b className="text-white">1. الرابط أو الرمز:</b> فتح النشاط مباشرة.</p><p><b className="text-white">2. الاسم:</b> لا بريد ولا كلمة مرور للعب السريع.</p><p><b className="text-white">3. التجربة:</b> مستوى، نقاط، تقدم بصري ونتيجة واضحة.</p><p><b className="text-white">4. العودة:</b> نفس المتصفح يستطيع استعادة المحاولة عند التحديث.</p></div></div>
      </section>
    </div>
  );
}
