export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-7 leading-8 text-slate-700">
      <header>
        <p className="text-sm font-semibold text-sky-700">آخر تحديث: 9 أغسطس 2026</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">سياسة الخصوصية</h1>
        <p className="mt-3">
          توضح هذه السياسة البيانات التي تعالجها منصة المعلم لتقديم الاختبارات والجلسات والتقارير،
          والخيارات المتاحة لمشغّل مساحة العمل والطلاب.
        </p>
      </header>

      <section aria-labelledby="privacy-data">
        <h2 id="privacy-data" className="text-xl font-bold text-slate-950">البيانات التي نعالجها</h2>
        <ul className="mt-2 list-disc space-y-2 pr-6">
          <li>بيانات حساب المعلم مثل الاسم والبريد الإلكتروني وعضويات مساحات العمل.</li>
          <li>محتوى الأسئلة والاختبارات والوسائط وإعدادات الجلسات.</li>
          <li>اسم العرض الذي يدخله الطالب، وإجاباته ودرجاته ووقت المحاولة.</li>
          <li>بيانات تشغيل وأمان محدودة مثل معرّف الطلب وسجلات الأخطاء ومحاولات الدخول الفاشلة.</li>
        </ul>
      </section>

      <section aria-labelledby="privacy-use">
        <h2 id="privacy-use" className="text-xl font-bold text-slate-950">لماذا نستخدم البيانات</h2>
        <p className="mt-2">
          نستخدمها لتشغيل الحسابات والجلسات، وحساب الدرجات على الخادم، وإظهار التقارير، وإصدار
          الشهادات، وحماية الخدمة وتشخيص الأعطال. لا تُستخدم إجابات الطلاب للإعلانات.
        </p>
      </section>

      <section aria-labelledby="privacy-cookies">
        <h2 id="privacy-cookies" className="text-xl font-bold text-slate-950">ملفات الارتباط</h2>
        <p className="mt-2">
          تستخدم المنصة ملفات ارتباط ضرورية ومحمية بـHttpOnly لتحديث جلسة المعلم واستعادة جلسة
          الطالب. لا تعتمد استعادة اللاعب على تخزين اسمه أو رمز جلسته في localStorage.
        </p>
      </section>

      <section aria-labelledby="privacy-sharing">
        <h2 id="privacy-sharing" className="text-xl font-bold text-slate-950">المشاركة والاحتفاظ</h2>
        <p className="mt-2">
          تُعرض بيانات الطالب للمعلمين المخولين داخل مساحة العمل. روابط النتائج المرسلة لولي الأمر
          محدودة المدة، بينما قد تكون روابط الشهادات عامة لمن يملك الرمز. يحدد مشغّل النشر مدة
          الاحتفاظ والنسخ الاحتياطي وفق احتياجاته والتزاماته المحلية.
        </p>
      </section>

      <section aria-labelledby="privacy-rights">
        <h2 id="privacy-rights" className="text-xl font-bold text-slate-950">الطلبات والأسئلة</h2>
        <p className="mt-2">
          لطلب تصحيح البيانات أو تصديرها أو حذفها، تواصل مع مشغّل المنصة أو مسؤول مساحة العمل عبر
          قناة الدعم المنشورة في بيئة الخدمة. قد يتطلب الطلب التحقق من الهوية والصلاحية قبل تنفيذه.
        </p>
      </section>
    </article>
  );
}
