import { useState } from 'react';
import {
  MessageSquareHeart,
  Send,
  Heart,
  Sparkles,
  User,
  School,
  CheckCircle2,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';

interface GuestbookEntry {
  id: string;
  name: string;
  role: string;
  message: string;
  date: string;
  likes: number;
}

const initialEntries: GuestbookEntry[] = [
  {
    id: '1',
    name: 'سارة خالد',
    role: 'طالبة — الصف الثاني متوسط',
    message: 'مبادرة رائعة ومفيدة جداً من المعلمة مريم، بطاقات القواعد والألوان جعلت حفظ الأزمنة وفهمها أسهل بكثير!',
    date: 'منذ يومين',
    likes: 18,
  },
  {
    id: '2',
    name: 'أ. هدى الحربي',
    role: 'معلمة لغة إنجليزية',
    message: 'بارك الله في هذه الجهود المميزة في إنتاج المعرفة. تصميم المنصة وتنوع المسابقات يرفع دافعية الطالبات للتعلم.',
    date: 'منذ 3 أيام',
    likes: 24,
  },
  {
    id: '3',
    name: 'ريناد محمد',
    role: 'طالبة — الصف الثالث متوسط',
    message: 'مسابقة المليون وتحدي السرعة من أمتع ما جربت! تنافسنا في الفصل وكان الحماس عالي جداً.',
    date: 'منذ 5 أيام',
    likes: 15,
  },
  {
    id: '4',
    name: 'أثير القحطاني',
    role: 'طالبة — المرحلة الثانوية',
    message: 'قسم الاستماع ونصوص القراءة ساعدني في الاستعداد للاختبارات وتحسين النطق. شكراً مدرستنا ومعلمتنا الفاضلة.',
    date: 'منذ أسبوع',
    likes: 12,
  },
];

export default function GuestbookPage() {
  const [entries, setEntries] = useState<GuestbookEntry[]>(initialEntries);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    const newEntry: GuestbookEntry = {
      id: Date.now().toString(),
      name: name.trim(),
      role: role.trim() || 'طالب/ـة زائر',
      message: message.trim(),
      date: 'الآن',
      likes: 1,
    };

    setEntries([newEntry, ...entries]);
    setName('');
    setRole('');
    setMessage('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  }

  function handleLike(id: string) {
    setEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, likes: item.likes + 1 } : item)),
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <div className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        {/* Header Hero */}
        <section className="animate-page-enter text-center max-w-2xl mx-auto">
          <div className="mx-auto mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white shadow-lg shadow-rose-500/20">
            <MessageSquareHeart className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100/80 px-3.5 py-1 text-xs font-black text-rose-800 mb-2">
            <Sparkles className="h-3 w-3 text-rose-600" />
            مجتمع وكلمات الزوار
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-950">
            سجل الزوار <span className="text-rose-600">Guestbook</span>
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm font-semibold text-slate-600 leading-relaxed">
            شاركنا كلمتك التشجيعية ورأيك في مبادرة إنتاج معرفي باللغة الإنجليزية
          </p>
        </section>

        {/* Input Form */}
        <section className="animate-page-enter mt-8 rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-5 sm:p-7 shadow-xs backdrop-blur-xl">
          <h2 className="text-base sm:text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
            <span>أضف رسالتك أو انطباعك</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  الاسم الكامل أو اللقب:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: ريم أحمد"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-rose-100 transition"
                  />
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  الصف أو الصفة:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="مثال: طالبة بالصف الثاني متوسط"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-rose-100 transition"
                  />
                  <School className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                رسالتك أو رأيك بالمنصة:
              </label>
              <textarea
                rows={3}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب كلمتك التشجيعية أو رأيك في المنصة..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-rose-100 transition"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              {submitted ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 animate-page-enter">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>شكراً لك! تم نشر كلمتك بنجاح</span>
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 font-semibold">
                  كلمتك تسعدنا وتدعم مسيرة المبادرة
                </span>
              )}

              <button
                type="submit"
                disabled={!name.trim() || !message.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 text-xs sm:text-sm font-black text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 transition active:scale-95 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>إرسال الرسالة</span>
              </button>
            </div>
          </form>
        </section>

        {/* Guestbook Entries Wall */}
        <section className="animate-page-enter mt-8 space-y-3.5">
          <h2 className="text-sm font-black text-slate-900 mb-2">
            رسائل وكلمات سابقة ({entries.length})
          </h2>

          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 sm:p-5 shadow-xs backdrop-blur-xl transition hover:border-rose-200"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-950">
                    {entry.name}
                  </h3>
                  <p className="text-[11px] font-semibold text-rose-700">
                    {entry.role}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  {entry.date}
                </span>
              </div>

              <p className="text-xs sm:text-sm font-semibold leading-relaxed text-slate-700 select-text">
                {entry.message}
              </p>

              <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
                <span className="text-[10px] text-slate-400 font-semibold">
                  English Spark • مدرسة متوسطة وثانوية الجرادية
                </span>
                <button
                  type="button"
                  onClick={() => handleLike(entry.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition active:scale-95"
                >
                  <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                  <span>{entry.likes}</span>
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>

      <PortalFooter />
    </div>
  );
}
