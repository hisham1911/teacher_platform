import { Link } from 'react-router';

const highlights = [
  ['🏆', 'Spark Challenge', 'مسابقات وتحديات متدرجة تجعل المراجعة أكثر تشويقًا.'],
  ['🎧', 'Listen & Learn', 'أسئلة استماع ومحتوى قصير يربط المفردات بالصوت.'],
  ['📊', 'نتائج واضحة', 'المعلمة تتابع المحاولات والنتائج بدون خطوات تقنية معقدة.'],
] as const;

export default function HomePage() {
  return (
    <div className="space-y-12 py-4 sm:py-8">
      <section className="relative overflow-hidden rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-amber-50 px-6 py-10 sm:px-10 sm:py-14">
        <span aria-hidden="true" className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-violet-200/35 blur-3xl" />
        <span aria-hidden="true" className="absolute -bottom-24 right-10 h-64 w-64 rounded-full bg-amber-200/45 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-700">English Spark</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-slate-950 sm:text-5xl">تعلم • العب • استكشف</h1>
          <p className="mt-5 max-w-2xl text-lg leading-9 text-slate-600">تجربة تعليم إنجليزي تفاعلية تجعل الاختبارات والمسابقات جزءًا من رحلة ممتعة، وتمنح المعلمة أدوات بسيطة لإنشاء المحتوى ومشاركته مع الطلاب.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link to="/auth/login" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-violet-700 px-6 text-sm font-black text-white hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700">دخول المعلمة</Link>
            <Link to="/auth/signup" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-violet-200 bg-white px-6 text-sm font-black text-violet-800 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700">إنشاء حساب</Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="spark-highlights-heading">
        <div className="max-w-2xl">
          <p className="text-sm font-black text-amber-700">البداية الحالية</p>
          <h2 id="spark-highlights-heading" className="mt-1 text-2xl font-black text-slate-950">أساس قوي، وتجربة أبسط</h2>
          <p className="mt-2 text-base leading-7 text-slate-600">English Spark تبدأ بالمسابقات والأنشطة الموجودة بالفعل، مع واجهة أسهل للمعلمة وقابلة للتوسع لاحقًا إلى العوالم التعليمية والألعاب.</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {highlights.map(([icon, title, description]) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <span aria-hidden="true" className="text-3xl">{icon}</span>
              <h3 className="mt-3 text-lg font-black text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
