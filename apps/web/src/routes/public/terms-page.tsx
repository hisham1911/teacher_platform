export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-7 leading-8 text-slate-700">
      <header>
        <p className="text-sm font-semibold text-sky-700">آخر تحديث: 9 أغسطس 2026</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">شروط الاستخدام</h1>
        <p className="mt-3">
          باستخدام منصة المعلم، يوافق صاحب الحساب على استخدام الخدمة لإدارة محتوى تعليمي مشروع
          وعلى حماية حسابه وبيانات طلابه.
        </p>
      </header>

      <section aria-labelledby="terms-account">
        <h2 id="terms-account" className="text-xl font-bold text-slate-950">الحساب ومساحة العمل</h2>
        <p className="mt-2">
          صاحب مساحة العمل مسؤول عن دقة بيانات الحساب، ومنح الأدوار للأشخاص المناسبين، وسحب وصول
          من لم يعد مخولًا. لا يجوز مشاركة بيانات الدخول أو محاولة تجاوز حدود الخطة.
        </p>
      </section>

      <section aria-labelledby="terms-content">
        <h2 id="terms-content" className="text-xl font-bold text-slate-950">المحتوى والطلاب</h2>
        <p className="mt-2">
          يظل صاحب مساحة العمل مسؤولًا عن حقه في استخدام الأسئلة والوسائط التي يرفعها، وعن الحصول
          على الموافقات اللازمة عند إشراك الطلاب، خصوصًا القُصّر. يمنع رفع محتوى ضار أو غير قانوني
          أو ينتهك حقوق الآخرين.
        </p>
      </section>

      <section aria-labelledby="terms-results">
        <h2 id="terms-results" className="text-xl font-bold text-slate-950">النتائج والشهادات</h2>
        <p className="mt-2">
          تحسب المنصة الدرجات وفق إعدادات الاختبار الحالية. على المعلم مراجعة الاختبار والنتائج قبل
          استخدامها في قرار أكاديمي رسمي؛ الشهادة الصادرة من المنصة لا تمثل اعتمادًا من جهة خارجية.
        </p>
      </section>

      <section aria-labelledby="terms-availability">
        <h2 id="terms-availability" className="text-xl font-bold text-slate-950">توفر الخدمة</h2>
        <p className="mt-2">
          قد تتوقف الخدمة مؤقتًا للصيانة أو عند حدوث عطل. يحتفظ مشغّل النشر بنسخ احتياطية وفق
          سياسة التشغيل المعلنة، ولا يغني ذلك صاحب مساحة العمل عن تصدير نسخة دورية من محتواه المهم.
        </p>
      </section>

      <section aria-labelledby="terms-changes">
        <h2 id="terms-changes" className="text-xl font-bold text-slate-950">التغييرات والتواصل</h2>
        <p className="mt-2">
          قد تتغير هذه الشروط عند إضافة قدرات أو متطلبات تشغيلية جديدة. تنشر النسخة المحدثة هنا مع
          تاريخها، وتوجّه الأسئلة إلى قناة الدعم المنشورة في بيئة الخدمة.
        </p>
      </section>
    </article>
  );
}
