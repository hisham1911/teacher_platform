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
  ShieldCheck,
  Lock,
  X,
  Loader2,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import {
  guestbookClient,
  type GuestbookEntry,
  validateCommentContent,
  checkRateLimit,
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
  const [honeypot, setHoneypot] = useState(''); // Anti-bot field
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);

  // وضع إدارة المعلمة
  const [teacherAdminOpen, setTeacherAdminOpen] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [isTeacherAdmin, setIsTeacherAdmin] = useState(false);
  const [passcodeError, setPasscodeError] = useState(false);

  useEffect(() => {
    let mounted = true;
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

    // Anti-bot check
    if (honeypot) return;

    // Rate limit check
    const rateCheck = checkRateLimit();
    if (!rateCheck.isAllowed) {
      setErrorMsg(`يرجى الانتظار ${rateCheck.remainingSeconds} ثانية قبل إضافة تعليق آخر.`);
      return;
    }

    // Validation
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

  async function handleLike(id: string, currentLikes: number) {
    // Optimistic UI update
    setEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, likes: item.likes + 1 } : item))
    );
    await guestbookClient.likeEntry(id, currentLikes);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('هل أنتِ متأكدة من حذف هذا التعليق؟')) return;
    const ok = await guestbookClient.deleteEntry(id, passcode);
    if (ok) {
      setEntries((prev) => prev.filter((item) => item.id !== id));
    }
  }

  function handleUnlockTeacherAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (passcode.trim() === 'maryam2026') {
      setIsTeacherAdmin(true);
      setTeacherAdminOpen(false);
      setPasscodeError(false);
    } else {
      setPasscodeError(true);
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
            مساحة تواصل لطالبات وأولياء أمور ومعلمات مدرسة متوسطة وثانوية الجرادية لمشاركة كلمات الدعم والتقدير لمبادرة المعلمة مريم
          </p>
        </section>

        {/* Input Form */}
        <section className="animate-page-enter mt-8 rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-5 sm:p-7 shadow-xs backdrop-blur-xl">
          <h2 className="text-base sm:text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
            <span>شاركونا كلماتكم وانطباعاتكم</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot field for anti-bot */}
            <input
              type="text"
              name="bot_field"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  الاسم الكامل أو اللقب:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={40}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: ريم أحمد / أم نورة"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-rose-100 transition"
                  />
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  الصفة أو الدور:
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-800 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-rose-100 transition"
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  رسالتك أو رأيك بالمبادرة:
                </label>
                <span className="text-[11px] font-semibold text-slate-400">
                  {message.length} / 350
                </span>
              </div>
              <textarea
                rows={3}
                required
                maxLength={350}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب كلماتك الطيبة، ملاحظاتك، أو أثر التمارين على التعلم..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-3 focus:ring-rose-100 transition"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-800">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              {successMsg ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 animate-page-enter">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>شكراً لك! تم حفظ ونشر كلمتك بنجاح 🌸</span>
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 font-semibold">
                  * تُنشر التعليقات مباشرة لجميع زوار المنصة
                </span>
              )}

              <button
                type="submit"
                disabled={submitting || !name.trim() || !message.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 text-xs sm:text-sm font-black text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 transition active:scale-95 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جاري النشر...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>إرسال التعليق</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Guestbook Entries Wall */}
        <section className="animate-page-enter mt-8 space-y-3.5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span>سجل كلمات الزوار</span>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-black text-rose-800">
                {entries.length}
              </span>
            </h2>

            {isTeacherAdmin ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>وضع المعلمة مفعّل</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setTeacherAdminOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition"
              >
                <Lock className="h-3 w-3" />
                <span>إدارة المعلمة</span>
              </button>
            )}
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
            entries.map((entry) => (
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
                    onClick={() => handleLike(entry.id, entry.likes)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition active:scale-95"
                  >
                    <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
                    <span>{entry.likes}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      {/* Teacher Moderation Passcode Modal */}
      {teacherAdminOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 animate-page-enter">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-rose-600" />
                <span>دخول وضع إدارة المعلمة</span>
              </h3>
              <button
                type="button"
                onClick={() => setTeacherAdminOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs font-medium text-slate-600 mb-4">
              أدخلي رمز المرور الخاص بكِ لتفعيل صلاحية حذف التعليقات غير المرغوبة.
            </p>

            <form onSubmit={handleUnlockTeacherAdmin} className="space-y-3">
              <input
                type="password"
                required
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setPasscodeError(false);
                }}
                placeholder="رمز مرور المعلمة"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
              />

              {passcodeError && (
                <p className="text-xs font-bold text-rose-600">رمز المرور غير صحيح.</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTeacherAdminOpen(false)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-black text-white hover:bg-rose-700"
                >
                  تأكيد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PortalFooter />
    </div>
  );
}
