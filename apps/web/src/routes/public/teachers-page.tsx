import { Link } from 'react-router';

const workflows = [
  {
    icon: '🧠',
    title: 'بدل ما تبدأ كل نشاط من الصفر',
    description: 'احتفظ بالأسئلة في بنك واحد، أعد استخدامها، أضف صورة أو صوت، واستورد مجموعة كبيرة من Excel أو CSV مع مراجعة قبل الحفظ.',
    points: ['بنك أسئلة قابل لإعادة الاستخدام', 'صور وصوت داخل السؤال', 'استيراد جماعي مع معاينة'],
  },
  {
    icon: '🎮',
    title: 'نفس المحتوى، أكثر من طريقة للطلاب',
    description: 'جهّز النشاط مرة ثم اختر ما يناسب الموقف: حل فردي، مسابقة مباشرة داخل الفصل، أو تحدٍ متدرج مستوى بعد مستوى.',
    points: ['حل فردي', 'Live + لوحة صدارة', 'تحدٍ متدرج'],
  },
  {
    icon: '👨‍🎓',
    title: 'الطالب لا يبدأ من الصفر كل مرة',
    description: 'احتفظ بقائمة طلابك، امنح كل طالب كود دخول لمساحته، واترك الانضمام السريع متاحًا للضيوف عندما تحتاج أقل قدر من الخطوات.',
    points: ['قائمة طلاب دائمة', 'مساحة الطالب', 'دخول سريع للضيف'],
  },
  {
    icon: '📊',
    title: 'بعد النشاط تعرف ماذا حدث فعلًا',
    description: 'راجع المحاولات والنتائج، صدّر CSV، شارك نتيجة محدودة مع ولي الأمر، وأصدر شهادة للطالب المستحق.',
    points: ['تقارير ومحاولات', 'مشاركة نتيجة محدودة', 'شهادات PDF'],
  },
] as const;

export default function TeachersPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-slate-50 text-slate-950" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/teachers" className="inline-flex min-h-11 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200">
            <span aria-hidden="true" className="spark-brand-mark flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-fuchsia-500 to-violet-700 text-xl text-white">✦</span>
            <span><span className="block font-black tracking-wide">English Spark</span><span className="block text-[10px] font-bold text-violet-600">للمعلمين والأكاديميات</span></span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="تنقل صفحة المعلمين">
            <Link to="/" className="hidden min-h-11 items-center rounded-xl px-3 text-sm font-bold text-slate-600 hover:bg-slate-100 sm:inline-flex">واجهة الطلاب</Link>
            <Link to="/auth/login" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-black text-violet-800 hover:bg-violet-50">تسجيل الدخول</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-violet-100 bg-white">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgb(221_214_254/0.8),transparent_28rem),radial-gradient(circle_at_15%_70%,rgb(167_243_208/0.38),transparent_25rem)]" />
          <div className="relative mx-auto grid min-h-[36rem] w-full max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
            <div className="max-w-3xl">
              <p className="text-sm font-black text-violet-700">English Spark Studio</p>
              <h1 className="mt-3 text-balance text-4xl font-black leading-[1.18] sm:text-5xl">اصنع النشاط، جرّبه، ثم أوصله للطلاب من نفس المكان.</h1>
              <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-slate-600 sm:text-lg">بدل التنقل بين ملف للأسئلة وأداة للمسابقة وطريقة منفصلة للنتائج، English Spark تجمع دورة النشاط في Studio واضح وتترك التفاصيل التقنية خلف الكواليس.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/auth/signup" className="inline-flex min-h-13 items-center justify-center rounded-xl bg-violet-700 px-6 text-sm font-black text-white shadow-[0_14px_30px_rgb(109_40_217/0.18)] hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200">إنشاء حساب</Link>
                <Link to="/auth/login" className="inline-flex min-h-13 items-center justify-center rounded-xl border border-violet-200 bg-white px-6 text-sm font-black text-violet-900 shadow-sm hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200">تسجيل الدخول</Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white bg-slate-950 p-5 text-white shadow-[0_28px_70px_rgb(15_23_42/0.2)] sm:p-7">
              <p className="text-xs font-black text-amber-300">المسار اليومي</p>
              <ol className="mt-4 space-y-3">
                {[
                  ['01', 'ابنِ النشاط', 'أسئلة جديدة، بنك الأسئلة، أو استيراد جماعي.'],
                  ['02', 'عاينه كطالب', 'تأكد من المحتوى قبل إرساله.'],
                  ['03', 'اختر طريقة الوصول', 'شارك رابطًا أو شغّل مسابقة Live حسب الموقف.'],
                  ['04', 'راجع النتائج', 'محاولات ودرجات وتقارير مرتبطة بالنشاط.'],
                ].map(([number, title, description]) => (
                  <li key={number} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <span dir="ltr" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 font-mono text-xs font-black text-violet-200">{number}</span>
                    <div><h2 className="font-black">{title}</h2><p className="mt-1 text-xs font-semibold leading-6 text-slate-300">{description}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="teacher-problems-title">
          <div className="max-w-3xl">
            <p className="text-xs font-black tracking-[0.12em] text-violet-700">المشكلة أولًا</p>
            <h2 id="teacher-problems-title" className="mt-3 text-3xl font-black sm:text-4xl">الأدوات موجودة لخدمة شغلك، لا لزيادة الخطوات.</h2>
            <p className="mt-4 text-base font-semibold leading-8 text-slate-600">الواجهة تستخدم لغة النشاط والطالب والنتيجة. النسخ والجلسات وحالات النشر تبقى تفاصيل داخلية ما دمت لا تحتاجها لاتخاذ قرار.</p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {workflows.map((item) => (
              <article key={item.title} className="rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-2xl">{item.icon}</span>
                <h3 className="mt-4 text-xl font-black">{item.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">{item.description}</p>
                <ul className="mt-4 flex flex-wrap gap-2" aria-label={`يشمل ${item.title}`}>
                  {item.points.map((point) => <li key={point} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">{point}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div><h2 className="text-3xl font-black">جاهز تفتح Studio؟</h2><p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600">ابدأ بنشاط واحد، جرّبه كطالب، ثم شاركه. لا تحتاج إعداد نظام تعليمي كامل قبل أول استخدام.</p></div>
            <div className="flex flex-wrap gap-2"><Link to="/auth/signup" className="inline-flex min-h-13 items-center justify-center rounded-xl bg-violet-700 px-6 text-sm font-black text-white hover:bg-violet-800">إنشاء حساب</Link><Link to="/auth/login" className="inline-flex min-h-13 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-black text-slate-800 hover:bg-slate-50">تسجيل الدخول</Link></div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 text-slate-300">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs font-semibold sm:px-6"><span>English Spark Studio</span><nav className="flex items-center gap-4" aria-label="روابط عامة"><Link className="min-h-11 content-center hover:text-white" to="/">واجهة الطلاب</Link><Link className="min-h-11 content-center hover:text-white" to="/privacy">الخصوصية</Link><Link className="min-h-11 content-center hover:text-white" to="/terms">الشروط</Link></nav></div>
      </footer>
    </div>
  );
}
