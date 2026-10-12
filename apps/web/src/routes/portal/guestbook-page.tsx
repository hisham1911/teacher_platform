import { useState, useEffect } from 'react';
import {
  MessageSquareHeart,
  Send,
  Heart,
  Sparkles,
  User,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Loader2,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import {
  guestbookClient,
  type GuestbookEntry,
  validateCommentContent,
  checkRateLimit,
  getLikedEntries,
  isTeacherLoggedIn,
  TEACHER_OFFICIAL_NAME,
} from '../../data/api-client/guestbook-client';

const ROLE_OPTIONS = [
  { label: 'طالبة — متوسطة الجرادية', value: 'طالبة — متوسطة الجرادية' },
  { label: 'طالبة — ثانوية الجرادية', value: 'طالبة — ثانوية الجرادية' },
  { label: 'ولي أمر طالبـ/ـة', value: 'ولي أمر' },
  { label: 'معلمـ/ـة أو كادر تعليمي', value: 'كادر تعليمي' },
  { label: 'زائر / مهتم باللغة', value: 'زائر مهتم' },
];

function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return 'الآن';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `منذ ${diffHour} ساعة`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return 'أمس';
    if (diffDay < 7) return `منذ ${diffDay} أيام`;
    return date.toLocaleDateString('ar-SA');
  } catch {
    return 'مؤخراً';
  }
}

export default function GuestbookPage() {
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [role, setRole] = useState('طالبة — متوسطة الجرادية');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);

  // Liked IDs set to prevent infinite likes
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const isTeacherAdmin = isTeacherLoggedIn();

  useEffect(() => {
    let mounted = true;
    setLikedIds(new Set(getLikedEntries()));

    guestbookClient
      .getEntries()
      .then((data) => {
        if (mounted) {
          setEntries(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');

    if (honeypot) return;

    const rateCheck = checkRateLimit();
    if (!rateCheck.isAllowed) {
      setErrorMsg(`يرجى الانتظار ${rateCheck.remainingSeconds} ثانية قبل إضافة تعليق آخر.`);
      return;
    }

    const validation = validateCommentContent(message);
    if (!validation.isValid) {
      setErrorMsg(validation.error || 'يرجى مراجعة محتوى التعليق.');
      return;
    }

    if (!name.trim()) {
      setErrorMsg('يرجى كتابة الاسم.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await guestbookClient.addEntry({
        name: name.trim(),
        role: role.trim(),
        message: message.trim(),
      });

      setEntries((prev) => [created, ...prev]);
      setName('');
      setMessage('');
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 5000);
    } catch {
      setErrorMsg('تعذر حفظ التعليق، يرجى المحاولة لاحقاً.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleLike(id: string, currentLikes: number) {
    const isCurrentlyLiked = likedIds.has(id);
    const optimisticLikes = isCurrentlyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

    setLikedIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlyLiked) next.delete(id);
      else next.add(id);
      return next;
    });

    setEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, likes: optimisticLikes } : item))
    );

    const res = await guestbookClient.toggleLike(id, currentLikes);
    setEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, likes: res.newLikes } : item))
    );
  }

  async function handleDelete(id: string) {
    if (!window.confirm('هل أنتِ متأكدة من حذف هذا التعليق؟')) return;
    const ok = await guestbookClient.deleteEntry(id);
    if (ok) {
      setEntries((prev) => prev.filter((item) => item.id !== id));
    }
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
            سجل الزوار والتعليقات <span className="text-rose-600" dir="ltr">Guestbook</span>
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm font-semibold text-slate-600 leading-relaxed">
            مساحة تواصل لطالبات وأولياء أمور ومعلمات مدرسة متوسطة وثانوية الجرادية لمشاركة كلمات الدعم والتقدير لمبادرة المعلمة {TEACHER_OFFICIAL_NAME}
          </p>
        </section>

        {/* Comment Submission Form */}
        <section className="animate-page-enter mt-8 rounded-2xl sm:rounded-3xl border border-rose-100/90 bg-gradient-to-br from-white via-white/95 to-rose-50/30 p-5 sm:p-7 shadow-xs backdrop-blur-xl ring-1 ring-slate-900/5">
          <h2 className="text-base font-black text-slate-950 mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-rose-600" />
            <span>شاركينا كلمتكِ التشجيعية أو انطباعكِ</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              className="hidden"
              aria-hidden="true"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="guestbook-name" className="block text-xs font-bold text-slate-700 mb-1">
                  الاسم الكريم <span className="text-rose-500">*</span>
                </label>
                <input
                  id="guestbook-name"
                  type="text"
                  required
                  maxLength={40}
                  placeholder="مثال: نورة محمد"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-rose-500 focus:outline-hidden focus:ring-2 focus:ring-rose-200 transition"
                />
              </div>

              <div>
                <label htmlFor="guestbook-role" className="block text-xs font-bold text-slate-700 mb-1">
                  صفتكِ الكريمة
                </label>
                <select
                  id="guestbook-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:border-rose-500 focus:outline-hidden focus:ring-2 focus:ring-rose-200 transition"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="guestbook-message" className="block text-xs font-bold text-slate-700 mb-1">
                رسالتكِ أو تعليقكِ <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="guestbook-message"
                required
                rows={3}
                maxLength={350}
                placeholder="اكتبي كلمة طيبة أو رأيكِ في بطاقات القواعد والمسابقات..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-rose-500 focus:outline-hidden focus:ring-2 focus:ring-rose-200 transition resize-none"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                <span>يُمنع نشر أرقام الهواتف أو الروابط لحماية الخصوصية</span>
                <span dir="ltr" className="tabular-nums">{message.length} / 350</span>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs font-bold text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>شكراً لمشاركتكِ! تم نشر كلمتكِ بنجاح في سجل الزوار. 🌸</span>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-fuchsia-600 px-6 text-xs sm:text-sm font-black text-white shadow-md shadow-rose-600/20 transition-all hover:from-rose-700 hover:to-fuchsia-700 active:scale-95 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جاري النشر...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 rotate-180" />
                    <span>نشر الكلمة في السجل</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Entries List */}
        <section className="mt-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900">
              كلمات الزوار السابقة ({entries.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-rose-500 mb-2" />
              <span className="text-xs font-bold">جاري تحميل رسائل الزوار...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-center">
              <p className="text-xs sm:text-sm font-semibold text-slate-500">
                لا توجد تعليقات حتى الآن، كوني أول من يشارك كلمته التشجيعية! ✨
              </p>
            </div>
          ) : (
            entries.map((entry) => {
              const isLiked = likedIds.has(entry.id);
              return (
                <div
                  key={entry.id}
                  className="group relative rounded-2xl border border-rose-100/90 bg-gradient-to-br from-white via-white/95 to-rose-50/25 p-4 sm:p-5 shadow-xs backdrop-blur-xl ring-1 ring-slate-900/5 transition hover:border-rose-300 hover:shadow-md hover:shadow-rose-900/5"
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

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400">
                        {formatTimeAgo(entry.createdAt)}
                      </span>
                      {isTeacherAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          title="حذف هذا التعليق"
                          className="rounded-md bg-rose-50 p-1 text-rose-600 hover:bg-rose-100 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm font-semibold leading-relaxed text-slate-700 select-text whitespace-pre-line">
                    {entry.message}
                  </p>

                  <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
                    <span className="text-[10px] text-slate-400 font-semibold">
                      English Spark • متوسطة وثانوية الجرادية
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleLike(entry.id, entry.likes)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition active:scale-95 border ${
                        isLiked
                          ? 'border-rose-300 bg-rose-100 text-rose-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                      }`}
                      title={isLiked ? 'إلغاء الإعجاب' : 'إعجاب'}
                    >
                      <Heart
                        className={`h-3.5 w-3.5 transition-colors ${
                          isLiked ? 'fill-rose-500 text-rose-500' : 'text-slate-400'
                        }`}
                      />
                      <span>{entry.likes}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      <PortalFooter />
    </div>
  );
}
