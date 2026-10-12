import { useState, useEffect } from 'react';
import {
  MessageCircleQuestion,
  Send,
  Heart,
  Sparkles,
  User,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ShieldCheck,
  X,
  Loader2,
  CornerDownLeft,
} from 'lucide-react';
import {
  guestbookClient,
  type GuestbookEntry,
  validateCommentContent,
  checkRateLimit,
  getLikedEntries,
  isTeacherLoggedIn,
  TEACHER_OFFICIAL_NAME,
} from '../../data/api-client/guestbook-client';

interface LessonDiscussionProps {
  topicSlug: string;
  topicTitle: string;
}

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

export function LessonDiscussion({ topicSlug, topicTitle }: LessonDiscussionProps) {
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

  // Teacher Moderation & Reply State
  const [isTeacherAdmin, setIsTeacherAdmin] = useState(false);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [teacherReplyText, setTeacherReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setIsTeacherAdmin(isTeacherLoggedIn());
    setLikedIds(new Set(getLikedEntries()));

    guestbookClient
      .getEntries(topicSlug)
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
  }, [topicSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');

    if (honeypot) return;

    const rateCheck = checkRateLimit();
    if (!rateCheck.isAllowed) {
      setErrorMsg(`يرجى الانتظار ${rateCheck.remainingSeconds} ثانية قبل إضافة استفسار آخر.`);
      return;
    }

    const validation = validateCommentContent(message);
    if (!validation.isValid) {
      setErrorMsg(validation.error || 'يرجى مراجعة محتوى الاستفسار.');
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
        topicSlug,
      });

      setEntries((prev) => [created, ...prev]);
      setName('');
      setMessage('');
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 5000);
    } catch {
      setErrorMsg('تعذر حفظ الاستفسار، يرجى المحاولة لاحقاً.');
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

    const res = await guestbookClient.toggleLike(id, currentLikes, topicSlug);
    setEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, likes: res.newLikes } : item))
    );
  }

  async function handleDelete(id: string) {
    if (!confirm('هل أنتِ متأكدة من حذف هذا الاستفسار نهائياً؟')) return;
    const ok = await guestbookClient.deleteEntry(id, undefined, topicSlug);
    if (ok) {
      setEntries((prev) => prev.filter((item) => item.id !== id));
    }
  }

  async function handleTeacherReplySubmit(id: string) {
    if (!teacherReplyText.trim()) return;
    setReplySubmitting(true);
    try {
      const ok = await guestbookClient.addTeacherReply(
        id,
        teacherReplyText.trim(),
        undefined,
        topicSlug
      );
      if (ok) {
        setEntries((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  teacherReply: teacherReplyText.trim(),
                  repliedAt: new Date().toISOString(),
                }
              : item
          )
        );
        setActiveReplyId(null);
        setTeacherReplyText('');
      } else {
        alert('حدث خطأ في صلاحية المعلمة، يرجى تسجيل الدخول من الرابط المخصص أولاً.');
      }
    } finally {
      setReplySubmitting(false);
    }
  }

  return (
    <section className="mt-10 rounded-2xl sm:rounded-3xl border border-violet-100/90 bg-gradient-to-br from-white via-white/95 to-violet-50/30 p-5 shadow-sm backdrop-blur-xl ring-1 ring-slate-900/5 sm:p-8" aria-label="استفسارات الدرس">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 shadow-xs">
            <MessageCircleQuestion className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              اسألي المعلمة {TEACHER_OFFICIAL_NAME} حول الدرس
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm font-semibold text-slate-500">
              هل توجد نقطة غير واضحة في قاعدة ({topicTitle})؟ اطرحي سؤالكِ هنا وستجيبكِ المعلمة
            </p>
          </div>
        </div>

        {/* Teacher Mode Indicator (Only shown if already logged in) */}
        {isTeacherAdmin && (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-200">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>أ. {TEACHER_OFFICIAL_NAME} (وضع الرد مفعّل)</span>
          </div>
        )}
      </div>

      {/* Question Form */}
      <form onSubmit={handleSubmit} className="mt-6 rounded-2xl bg-violet-50/40 p-4 sm:p-5 border border-violet-100/70">
        <h3 className="text-sm font-black text-violet-900 mb-3 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <span>كتابة استفسار أو سؤال جديد</span>
        </h3>

        {/* Honeypot for bots */}
        <input
          type="text"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden="true"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label htmlFor={`name-input-${topicSlug}`} className="block text-xs font-bold text-slate-700 mb-1">
              الاسم الكريم:
            </label>
            <input
              id={`name-input-${topicSlug}`}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: رغد الحربي"
              maxLength={40}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-hidden focus:ring-2 focus:ring-violet-200"
              required
            />
          </div>

          <div>
            <label htmlFor={`role-select-${topicSlug}`} className="block text-xs font-bold text-slate-700 mb-1">
              صفتك:
            </label>
            <select
              id={`role-select-${topicSlug}`}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-800 focus:border-violet-500 focus:outline-hidden focus:ring-2 focus:ring-violet-200"
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
          <label htmlFor={`question-text-${topicSlug}`} className="block text-xs font-bold text-slate-700 mb-1">
            سؤالكِ أو استفساركِ حول القاعدة:
          </label>
          <textarea
            id={`question-text-${topicSlug}`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`مثال: أستاذة مريم، متى أستخدم هذه الصيغة في جمل النفي؟`}
            rows={3}
            maxLength={350}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-hidden focus:ring-2 focus:ring-violet-200"
            required
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>الرجاء عدم إدراج أرقام هواتف أو روابط خارجية</span>
            <span>{message.length} / 350</span>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs font-bold text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-xs font-bold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>تم إرسال استفساركِ بنجاح! ستجيب المعلمة مريم الصميلي عليه قريباً.</span>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !message.trim() || !name.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-sm shadow-violet-700/20 transition hover:bg-violet-800 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري الإرسال...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4 rotate-180" />
                <span>إرسال الاستفسار</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Discussion List */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800">
            استفسارات الطالبات ({entries.length})
          </h3>
          <span className="text-xs text-slate-400">
            محدث مباشرة
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <Loader2 className="h-7 w-7 animate-spin text-violet-600 mb-2" />
            <p className="text-xs font-bold">جاري تحميل الاستفسارات...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-10 text-center">
            <MessageCircleQuestion className="h-10 w-10 text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-600">لا توجد استفسارات بعد حول هذه القاعدة</p>
            <p className="text-xs text-slate-400 mt-1">كوني أول من يطرح سؤالاً على المعلمة {TEACHER_OFFICIAL_NAME}!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const isLiked = likedIds.has(entry.id);
              return (
                <div
                  key={entry.id}
                  className="group relative rounded-2xl border border-violet-100/80 bg-gradient-to-br from-white via-white/95 to-violet-50/25 p-4 shadow-2xs transition hover:border-violet-300 hover:shadow-xs"
                >
                  {/* Entry Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700 font-black text-xs">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-black text-slate-900">
                            {entry.name}
                          </span>
                          <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {entry.role}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">
                          {formatTimeAgo(entry.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Like button with single-like toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleLike(entry.id, entry.likes)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition border ${
                          isLiked
                            ? 'border-rose-300 bg-rose-100 text-rose-800'
                            : 'border-slate-200/70 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600'
                        }`}
                        title={isLiked ? 'إلغاء الإعجاب' : 'إعجاب بالسؤال'}
                      >
                        <Heart
                          className={`h-3.5 w-3.5 transition-colors ${
                            isLiked ? 'fill-rose-500 text-rose-500' : 'text-slate-400'
                          }`}
                        />
                        <span>{entry.likes}</span>
                      </button>

                      {/* Teacher Admin Actions */}
                      {isTeacherAdmin && (
                        <div className="flex items-center gap-1 mr-1 border-r border-slate-200 pr-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReplyId(activeReplyId === entry.id ? null : entry.id);
                              setTeacherReplyText(entry.teacherReply || '');
                            }}
                            className="rounded-lg bg-violet-100 px-2 py-1 text-[11px] font-black text-violet-800 hover:bg-violet-200"
                          >
                            {entry.teacherReply ? 'تعديل الإجابة' : 'إجابة المعلمة'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="حذف الاستفسار"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Entry Message */}
                  <p className="mt-3 text-xs sm:text-sm font-medium leading-relaxed text-slate-800">
                    {entry.message}
                  </p>

                  {/* Teacher Reply Card (if answered) */}
                  {entry.teacherReply && (
                    <div className="mt-3.5 rounded-xl border border-violet-200/80 bg-white p-3.5 shadow-xs">
                      <div className="flex items-center justify-between border-b border-violet-100/60 pb-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white">
                            <Sparkles className="h-3 w-3" />
                          </div>
                          <span className="text-xs font-black text-violet-900">
                            إجابة المعلمة {TEACHER_OFFICIAL_NAME}
                          </span>
                          <span className="rounded-sm bg-violet-100 px-1.5 py-0.2 text-[10px] font-bold text-violet-700">
                            معلمة المادة
                          </span>
                        </div>
                        {entry.repliedAt && (
                          <span className="text-[10px] text-slate-400">
                            {formatTimeAgo(entry.repliedAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-medium leading-relaxed text-slate-700">
                        {entry.teacherReply}
                      </p>
                    </div>
                  )}

                  {/* Teacher Inline Reply Box (when activeReplyId === entry.id) */}
                  {isTeacherAdmin && activeReplyId === entry.id && (
                    <div className="mt-3 rounded-xl border border-violet-300 bg-violet-50/80 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-violet-900 flex items-center gap-1">
                          <CornerDownLeft className="h-3.5 w-3.5 text-violet-700" />
                          <span>كتابة إجابة المعلمة {TEACHER_OFFICIAL_NAME} على هذا السؤال:</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveReplyId(null)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea
                        value={teacherReplyText}
                        onChange={(e) => setTeacherReplyText(e.target.value)}
                        placeholder="اكتبي توضيحكِ وإجابتكِ للطالبة هنا..."
                        rows={3}
                        className="w-full resize-none rounded-lg border border-violet-200 bg-white p-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-hidden focus:ring-1 focus:ring-violet-300"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveReplyId(null)}
                          className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/50"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTeacherReplySubmit(entry.id)}
                          disabled={replySubmitting || !teacherReplyText.trim()}
                          className="inline-flex items-center gap-1 rounded-lg bg-violet-700 px-4 py-1.5 text-xs font-black text-white hover:bg-violet-800 disabled:opacity-50"
                        >
                          {replySubmitting ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>جاري الحفظ...</span>
                            </>
                          ) : (
                            <span>حفظ ونشر الإجابة</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </section>
  );
}
