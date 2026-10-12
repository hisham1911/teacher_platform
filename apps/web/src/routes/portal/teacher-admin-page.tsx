import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import {
  ShieldCheck,
  Lock,
  User,
  LogOut,
  Sparkles,
  MessageCircleQuestion,
  CheckCircle2,
  Clock,
  Trash2,
  Send,
  CornerDownLeft,
  X,
  Search,
  BookOpen,
  MessageSquareHeart,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import {
  guestbookClient,
  type GuestbookEntry,
  loginTeacher,
  logoutTeacher,
  isTeacherLoggedIn,
  getTeacherSession,
  TEACHER_OFFICIAL_NAME,
  TEACHER_USERNAME,
} from '../../data/api-client/guestbook-client';
import { grammarTopics } from '../../data/content/grammar';

const TOPIC_LABELS: Record<string, string> = {
  'present-simple': 'المضارع البسيط',
  'present-progressive': 'المضارع المستمر',
  'relative-clauses': 'ضمائر الوصل',
  'simple-future': 'المستقبل البسيط',
  'future-perfect': 'المستقبل التام',
  'past-simple': 'الماضي البسيط',
  'past-progressive': 'الماضي المستمر',
  'present-perfect': 'المضارع التام',
  'future-progressive': 'المستقبل المستمر',
};

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

export default function TeacherAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState(TEACHER_USERNAME);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  // Data
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'answered' | 'guestbook'>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Replying state
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    setIsAuthenticated(isTeacherLoggedIn());
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;
    setLoading(true);

    guestbookClient
      .getAllEntriesAcrossPlatform()
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
  }, [isAuthenticated]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const ok = loginTeacher(usernameInput, passwordInput);
    if (ok) {
      setIsAuthenticated(true);
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  }

  function handleLogout() {
    logoutTeacher();
    setIsAuthenticated(false);
    setPasswordInput('');
  }

  async function handleReplySubmit(entry: GuestbookEntry) {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const ok = await guestbookClient.addTeacherReply(
        entry.id,
        replyText.trim(),
        undefined,
        entry.topicSlug
      );
      if (ok) {
        setEntries((prev) =>
          prev.map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  teacherReply: replyText.trim(),
                  repliedAt: new Date().toISOString(),
                }
              : item
          )
        );
        setActiveReplyId(null);
        setReplyText('');
      }
    } finally {
      setSubmittingReply(false);
    }
  }

  async function handleDelete(entry: GuestbookEntry) {
    if (!window.confirm('هل أنتِ متأكدة من حذف هذا الاستفسار/التعليق نهائياً؟')) return;
    const ok = await guestbookClient.deleteEntry(entry.id, undefined, entry.topicSlug);
    if (ok) {
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
    }
  }

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Tab filter
      if (activeTab === 'pending') {
        if (!entry.topicSlug || entry.teacherReply) return false;
      } else if (activeTab === 'answered') {
        if (!entry.teacherReply) return false;
      } else if (activeTab === 'guestbook') {
        if (entry.topicSlug) return false;
      }

      // Topic filter
      if (selectedTopic !== 'all') {
        if (entry.topicSlug !== selectedTopic) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inName = entry.name.toLowerCase().includes(q);
        const inMessage = entry.message.toLowerCase().includes(q);
        const inReply = entry.teacherReply?.toLowerCase().includes(q) ?? false;
        if (!inName && !inMessage && !inReply) return false;
      }

      return true;
    });
  }, [entries, activeTab, selectedTopic, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const totalQuestions = entries.filter((e) => e.topicSlug).length;
    const pendingQuestions = entries.filter((e) => e.topicSlug && !e.teacherReply).length;
    const answeredQuestions = entries.filter((e) => e.topicSlug && e.teacherReply).length;
    const guestbookCount = entries.filter((e) => !e.topicSlug).length;
    return { totalQuestions, pendingQuestions, answeredQuestions, guestbookCount };
  }, [entries]);

  // If NOT authenticated, show the Teacher Login screen
  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
        <PublicBackdrop />
        <PortalNav />

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-12">
          <div className="w-full rounded-3xl border border-violet-100 bg-white/95 p-6 sm:p-8 shadow-xl backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-600/30">
              <ShieldCheck className="h-8 w-8" />
            </div>

            <div className="text-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100/90 px-3 py-1 text-xs font-black text-violet-800">
                <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                إدارة المنصة التعليمية
              </span>
              <h1 className="mt-2 text-2xl font-black text-slate-900">
                لوحة المعلمة {TEACHER_OFFICIAL_NAME}
              </h1>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                مدرسة متوسطة وثانوية الجرادية — متابعة الاستفسارات والردود
              </p>
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم المستخدم:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="maryam"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-violet-500 focus:outline-hidden focus:ring-2 focus:ring-violet-200 transition"
                  />
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  كلمة المرور:
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setLoginError(false);
                    }}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-violet-500 focus:outline-hidden focus:ring-2 focus:ring-violet-200 transition"
                    autoFocus
                  />
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              {loginError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-700 text-center">
                  اسم المستخدم أو كلمة المرور غير صحيحة.
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-2xl bg-gradient-to-r from-violet-700 to-indigo-700 py-3 text-sm font-black text-white shadow-md shadow-violet-700/20 hover:from-violet-800 hover:to-indigo-800 transition active:scale-98"
              >
                تسجيل الدخول إلى اللوحة
              </button>

              <div className="pt-2 text-center">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-violet-700"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span>العودة إلى بوابة English Spark</span>
                </Link>
              </div>
            </form>
          </div>
        </div>

        <PortalFooter />
      </div>
    );
  }

  // Teacher Dashboard View
  const teacherSession = getTeacherSession();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-8 sm:px-6 sm:pt-10">
        {/* Top Header Card */}
        <section className="rounded-2xl sm:rounded-3xl border border-violet-100 bg-white/95 p-5 shadow-sm backdrop-blur-xl sm:p-6 mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-md shadow-violet-600/20">
                <Sparkles className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-2xl font-black text-slate-900">
                    أهلاً بكِ أ. {teacherSession?.name || TEACHER_OFFICIAL_NAME} 🌸
                  </h1>
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-800">
                    جلسة نشطة
                  </span>
                </div>
                <p className="mt-0.5 text-xs sm:text-sm font-semibold text-slate-500">
                  لوحة تحكم المعلمة • مدرسة متوسطة وثانوية الجرادية — متابعة استفسارات الدروس وسجل الزوار
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/grammar"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
              >
                <BookOpen className="h-3.5 w-3.5 text-violet-600" />
                <span>تصفح القواعد</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 border-t border-slate-100 pt-5">
            <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-violet-700">إجمالي الأسئلة</span>
                <MessageCircleQuestion className="h-4 w-4 text-violet-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-violet-950">{stats.totalQuestions}</p>
              <span className="text-[10px] text-slate-400">حول جميع القواعد</span>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800">بانتظار الإجابة</span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-amber-950">{stats.pendingQuestions}</p>
              <span className="text-[10px] text-amber-700">تحتاج رد المعلمة</span>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800">تمت الإجابة</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-950">{stats.answeredQuestions}</p>
              <span className="text-[10px] text-emerald-700">إجابات منشورة للطالبات</span>
            </div>

            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-700">سجل الزوار</span>
                <MessageSquareHeart className="h-4 w-4 text-rose-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-rose-950">{stats.guestbookCount}</p>
              <span className="text-[10px] text-slate-400">رسائل وكلمات داعمة</span>
            </div>
          </div>
        </section>

        {/* Filters and Search */}
        <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                activeTab === 'all'
                  ? 'bg-violet-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              الكل ({entries.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                activeTab === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              أسئلة بانتظار الإجابة ({stats.pendingQuestions})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('answered')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                activeTab === 'answered'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              أسئلة تمت الإجابة عليها ({stats.answeredQuestions})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guestbook')}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                activeTab === 'guestbook'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              سجل الزوار العام ({stats.guestbookCount})
            </button>
          </div>

          {/* Lesson filter & search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs focus:border-violet-500 focus:outline-hidden"
              >
                <option value="all">جميع القواعد والدروس</option>
                {grammarTopics.map((topic) => (
                  <option key={topic.slug} value={topic.slug}>
                    {topic.titleAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 sm:w-56">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في الاستفسارات..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-hidden shadow-xs"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
        </section>

        {/* Questions and Messages Stream */}
        <section className="space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
              <Sparkles className="mx-auto h-8 w-8 animate-spin text-violet-600 mb-2" />
              <p className="text-xs font-bold">جاري تحميل استفسارات المنصة...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <MessageCircleQuestion className="mx-auto h-10 w-10 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">لا توجد استفسارات مطابقة لهذا التصنيف</p>
              <p className="text-xs text-slate-400 mt-1">جربي تغيير خيارات الفلترة أو البحث</p>
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const topicName = entry.topicSlug
                ? TOPIC_LABELS[entry.topicSlug] || entry.topicSlug
                : 'سجل الزوار العام';
              const isReplying = activeReplyId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-violet-200"
                >
                  {/* Card Header */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 font-bold text-xs">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">{entry.name}</span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {entry.role}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {formatTimeAgo(entry.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                          entry.topicSlug
                            ? 'bg-violet-50 text-violet-800 border border-violet-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {topicName}
                      </span>
                      {entry.topicSlug && (
                        <Link
                          to={`/grammar/${entry.topicSlug}`}
                          className="rounded-lg p-1 text-slate-400 hover:text-violet-700 hover:bg-slate-100 transition"
                          title="عرض صفحة الدرس"
                          target="_blank"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Question Message */}
                  <div className="py-3">
                    <p className="text-sm font-semibold leading-relaxed text-slate-800">
                      {entry.message}
                    </p>
                  </div>

                  {/* Teacher Reply if already answered */}
                  {entry.teacherReply && !isReplying && (
                    <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3.5">
                      <div className="flex items-center justify-between mb-1.5 border-b border-violet-200/50 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                          <span className="text-xs font-black text-violet-900">
                            إجابة المعلمة {TEACHER_OFFICIAL_NAME}
                          </span>
                        </div>
                        {entry.repliedAt && (
                          <span className="text-[10px] text-slate-400">
                            {formatTimeAgo(entry.repliedAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-medium leading-relaxed text-slate-800">
                        {entry.teacherReply}
                      </p>
                    </div>
                  )}

                  {/* Inline Reply Form */}
                  {isReplying && (
                    <div className="mt-3 rounded-xl border border-violet-300 bg-violet-50/80 p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-violet-900 flex items-center gap-1.5">
                          <CornerDownLeft className="h-4 w-4 text-violet-700" />
                          <span>كتابة إجابة المعلمة {TEACHER_OFFICIAL_NAME}:</span>
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
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="اكتبي توضيحكِ للطالبة أو الرد على استفسارها هنا..."
                        rows={3}
                        className="w-full resize-none rounded-xl border border-violet-200 bg-white p-3 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-hidden focus:ring-2 focus:ring-violet-200"
                      />
                      <div className="mt-2.5 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveReplyId(null)}
                          className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/50"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReplySubmit(entry)}
                          disabled={submittingReply || !replyText.trim()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-4 py-1.5 text-xs font-black text-white hover:bg-violet-800 transition disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5 rotate-180" />
                          <span>نشر وحفظ الإجابة</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                    <span className="text-[11px] font-semibold text-slate-400">
                      عدد الإعجابات: {entry.likes}
                    </span>

                    <div className="flex items-center gap-2">
                      {entry.topicSlug ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveReplyId(isReplying ? null : entry.id);
                            setReplyText(entry.teacherReply || '');
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-black text-violet-800 hover:bg-violet-200 transition"
                        >
                          <CornerDownLeft className="h-3.5 w-3.5" />
                          <span>{entry.teacherReply ? 'تعديل الإجابة' : 'إجابة المعلمة'}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                          سجل الزوار (شكر وتقدير)
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(entry)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        title="حذف هذا التعليق"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>

      <PortalFooter />
    </div>
  );
}
