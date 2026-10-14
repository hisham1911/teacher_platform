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
  GraduationCap,
  Trophy,
  Plus,
  Edit3,
  FileSpreadsheet,
  Printer,
  Check,
  Upload,
  Loader2,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import {
  guestbookClient,
  studentResultsClient,
  customLessonsClient,
  honorRollClient,
  uploadMediaToSupabase,
  getMergedGrammarTopics,
  type GuestbookEntry,
  type StudentQuizResultRecord,
  type HonorStudentRecord,
  loginTeacher,
  logoutTeacher,
  isTeacherLoggedIn,
  getTeacherSession,
  TEACHER_OFFICIAL_NAME,
  TEACHER_USERNAME,
} from '../../data/api-client/guestbook-client';
import { grammarTopics } from '../../data/content/grammar';
import type { GrammarTopic } from '../../data/content/types';

const TOPIC_LABELS: Record<string, string> = Object.fromEntries(
  grammarTopics.map((t) => [t.slug, t.titleAr]),
);

const HONOR_BADGES = [
  { id: 'grammar_star', title: 'نجمة القواعد', icon: '✨', color: 'bg-violet-100 text-violet-800 border-violet-300' },
  { id: 'million_winner', title: 'بطلة المليون', icon: '🏆', color: 'bg-amber-100 text-amber-900 border-amber-300' },
  { id: 'active_reader', title: 'قارئة متميزة', icon: '📖', color: 'bg-sky-100 text-sky-800 border-sky-300' },
  { id: 'listening_pro', title: 'سفيرة الاستماع', icon: '🎧', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'fluent_speaker', title: 'متحدثة لبقة', icon: '🎙️', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
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

export default function TeacherAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState(TEACHER_USERNAME);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  // Main Dashboard Section Switcher
  const [dashboardSection, setDashboardSection] = useState<'qna' | 'results' | 'lessons' | 'honor'>('qna');

  // 1. Q&A Data
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'answered' | 'guestbook'>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // 2. Student Results Data
  const [results, setResults] = useState<StudentQuizResultRecord[]>([]);
  const [resultSearch, setResultSearch] = useState('');

  // 3. Lessons & Questions Data
  const [topicsList, setTopicsList] = useState<GrammarTopic[]>(() => getMergedGrammarTopics());
  const [editingTopic, setEditingTopic] = useState<GrammarTopic | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  // 4. Honor Roll Data
  const [honorStudents, setHonorStudents] = useState<HonorStudentRecord[]>(() =>
    honorRollClient.getHonorStudents()
  );
  const [newHonorName, setNewHonorName] = useState('');
  const [newHonorGrade, setNewHonorGrade] = useState('الأول الثانوي');
  const [newHonorNote, setNewHonorNote] = useState('');

  useEffect(() => {
    setIsAuthenticated(isTeacherLoggedIn());
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;
    setLoading(true);

    Promise.all([
      guestbookClient.getAllEntriesAcrossPlatform(),
      studentResultsClient.getAllResults(),
    ])
      .then(([qnaData, resultsData]) => {
        if (mounted) {
          setEntries(qnaData);
          setResults(resultsData);
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

  function handleExportResultsCsv() {
    const headers = ['اسم الطالبة', 'الصف الدراسي', 'النشاط / الاختبار', 'الدرجة', 'الدرجة الكلية', 'النسبة المئوية', 'رمز التحقق', 'التاريخ'];
    const rows = results.map((r) => [
      `"${r.studentName}"`,
      `"${r.studentGrade}"`,
      `"${r.activityTitle}"`,
      r.score,
      r.totalQuestions,
      `"${r.percentage}%"`,
      `"${r.verificationCode || ''}"`,
      `"${new Date(r.createdAt).toLocaleDateString('ar-SA')}"`,
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student_results_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleSaveTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTopic || !editingTopic.titleAr.trim() || !editingTopic.titleEn.trim()) return;
    await customLessonsClient.saveLesson({
      id: editingTopic.slug,
      section: 'grammar',
      slug: editingTopic.slug,
      titleAr: editingTopic.titleAr.trim(),
      titleEn: editingTopic.titleEn.trim(),
      description: editingTopic.description.trim(),
      imageUrl: editingTopic.imageUrl || '/content/grammar/present-simple.jpg',
      videoUrl: editingTopic.videoUrl || '',
      questions: editingTopic.questions,
    });
    setTopicsList(getMergedGrammarTopics());
    setEditingTopic(null);
    setUploadMessage(null);
  }

  async function handleVideoFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingTopic) return;
    setUploadingVideo(true);
    setUploadMessage(null);
    try {
      const res = await uploadMediaToSupabase(file, 'videos');
      if (res.url) {
        setEditingTopic({ ...editingTopic, videoUrl: res.url });
        setUploadMessage('تم رفع الفيديو وحفظ الرابط بنجاح! ✅');
      } else {
        setUploadMessage(res.error || 'تعذر رفع الفيديو');
      }
    } finally {
      setUploadingVideo(false);
    }
  }

  function handleAddHonorStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!newHonorName.trim()) return;
    const updated: HonorStudentRecord[] = [
      {
        id: `honor-${Date.now()}`,
        studentName: newHonorName.trim(),
        studentGrade: newHonorGrade,
        badges: ['grammar_star'],
        note: newHonorNote.trim() || 'تميز ومشاركة فاعلة في أنشطة المنصة.',
        createdAt: new Date().toISOString(),
      },
      ...honorStudents,
    ];
    setHonorStudents(updated);
    honorRollClient.saveHonorStudents(updated);
    setNewHonorName('');
    setNewHonorNote('');
  }

  function handleToggleBadge(studentId: string, badgeId: string) {
    const updated = honorStudents.map((st) => {
      if (st.id !== studentId) return st;
      const exists = st.badges.includes(badgeId);
      return {
        ...st,
        badges: exists ? st.badges.filter((b) => b !== badgeId) : [...st.badges, badgeId],
      };
    });
    setHonorStudents(updated);
    honorRollClient.saveHonorStudents(updated);
  }

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (activeTab === 'pending') {
        if (!entry.topicSlug || entry.teacherReply) return false;
      } else if (activeTab === 'answered') {
        if (!entry.teacherReply) return false;
      } else if (activeTab === 'guestbook') {
        if (entry.topicSlug) return false;
      }
      if (selectedTopic !== 'all') {
        if (entry.topicSlug !== selectedTopic) return false;
      }
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

  const filteredResults = useMemo(() => {
    if (!resultSearch.trim()) return results;
    const q = resultSearch.toLowerCase();
    return results.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.activityTitle.toLowerCase().includes(q) ||
        r.studentGrade.toLowerCase().includes(q)
    );
  }, [results, resultSearch]);

  const stats = useMemo(() => {
    const totalQuestions = entries.filter((e) => e.topicSlug).length;
    const pendingQuestions = entries.filter((e) => e.topicSlug && !e.teacherReply).length;
    const answeredQuestions = entries.filter((e) => e.topicSlug && e.teacherReply).length;
    const guestbookCount = entries.filter((e) => !e.topicSlug).length;
    return { totalQuestions, pendingQuestions, answeredQuestions, guestbookCount };
  }, [entries]);

  // Login view
  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-slate-50/50" dir="rtl">
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
                لوحة معلمات اللغة الإنجليزية
              </h1>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                إدارة تعليم جازان • متوسطة وثانوية الجرادية — متابعة الاستفسارات والدرجات
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
                  <span>العودة إلى بوابة <span dir="ltr">English Spark</span></span>
                </Link>
              </div>
            </form>
          </div>
        </div>

        <PortalFooter />
      </div>
    );
  }

  // Authenticated View
  const teacherSession = getTeacherSession();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-8 sm:px-6 sm:pt-10">
        {/* Top Header Card */}
        <section className="rounded-2xl sm:rounded-3xl border border-violet-100 bg-white/95 p-5 shadow-sm backdrop-blur-xl sm:p-6 mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-md shadow-violet-600/20">
                <Sparkles className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-2xl font-black text-slate-900">
                    أهلاً بكم: {teacherSession?.name || TEACHER_OFFICIAL_NAME} 🌸
                  </h1>
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-800">
                    جلسة نشطة
                  </span>
                </div>
                <p className="mt-0.5 text-xs sm:text-sm font-semibold text-slate-500">
                  لوحة إشراف المعلمات • إدارة تعليم جازان • متوسطة وثانوية الجرادية — متابعة استفسارات الدروس والنتائج
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/grammar"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
              >
                <BookOpen className="h-3.5 w-3.5 text-violet-600" />
                <span>تصفح الدروس</span>
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
              <span className="text-[10px] text-slate-400">حول جميع الدروس</span>
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
              <span className="text-[10px] text-emerald-700">إجابات منشورة للجميع</span>
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

        {/* 4 Main Section Tabs */}
        <section className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xs">
          <button
            type="button"
            onClick={() => setDashboardSection('qna')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
              dashboardSection === 'qna'
                ? 'bg-violet-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MessageCircleQuestion className="h-4 w-4" />
            <span>استفسارات الدروس وسجل الزوار ({entries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardSection('results')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
              dashboardSection === 'results'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            <span>سجل درجات الطالبات والشهادات ({results.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardSection('lessons')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
              dashboardSection === 'lessons'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>إدارة الدروس والأسئلة والفيديوهات ({topicsList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardSection('honor')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
              dashboardSection === 'honor'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Trophy className="h-4 w-4" />
            <span>لوحة الشرف والأوسمة ({honorStudents.length})</span>
          </button>
        </section>

        {/* SECTION 1: Q&A & GUESTBOOK */}
        {dashboardSection === 'qna' && (
          <>
            <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                    activeTab === 'all' ? 'bg-violet-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  الكل ({entries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pending')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                    activeTab === 'pending' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  بانتظار الرد ({stats.pendingQuestions})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('answered')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                    activeTab === 'answered' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  تم الرد ({stats.answeredQuestions})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('guestbook')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                    activeTab === 'guestbook' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  سجل الزوار ({stats.guestbookCount})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-48">
                  <select
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs focus:border-violet-500 focus:outline-hidden"
                  >
                    <option value="all">جميع الدروس</option>
                    {topicsList.map((topic) => (
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
                    placeholder="بحث في الرسائل..."
                    className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-hidden shadow-xs"
                  />
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400">
                  <Sparkles className="mx-auto h-8 w-8 animate-spin text-violet-600 mb-2" />
                  <p className="text-xs font-bold">جاري تحميل المشاركات...</p>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                  <MessageCircleQuestion className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-700">لا توجد رسائل مطابقة</p>
                </div>
              ) : (
                filteredEntries.map((entry) => {
                  const topicName = entry.topicSlug
                    ? TOPIC_LABELS[entry.topicSlug] || entry.topicSlug
                    : 'سجل الزوار';
                  const isReplying = activeReplyId === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-violet-200"
                    >
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
                              target="_blank"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="py-3">
                        <p className="text-sm font-semibold leading-relaxed text-slate-800">
                          {entry.message}
                        </p>
                      </div>

                      {entry.teacherReply && !isReplying && (
                        <div className="mt-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3.5">
                          <div className="flex items-center justify-between mb-1.5 border-b border-violet-200/50 pb-1.5">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                              <span className="text-xs font-black text-violet-900">
                                إجابة المعلمة {TEACHER_OFFICIAL_NAME}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs sm:text-sm font-medium leading-relaxed text-slate-800">
                            {entry.teacherReply}
                          </p>
                        </div>
                      )}

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
                            placeholder="اكتبي الإجابة للطالبة..."
                            rows={3}
                            className="w-full resize-none rounded-xl border border-violet-200 bg-white p-3 text-xs sm:text-sm font-medium text-slate-800"
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
                              <span>إرسال الرد</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                        <span className="text-[11px] font-semibold text-slate-400">
                          الإعجابات: {entry.likes}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReplyId(isReplying ? null : entry.id);
                              setReplyText(entry.teacherReply || '');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-black text-violet-800 hover:bg-violet-200 transition"
                          >
                            <CornerDownLeft className="h-3.5 w-3.5" />
                            <span>{entry.teacherReply ? 'تعديل الرد' : 'الرد على السؤال'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(entry)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="حذف"
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
          </>
        )}

        {/* SECTION 2: RESULTS & EXCEL */}
        {dashboardSection === 'results' && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-950">سجل درجات الطالبات والشهادات</h2>
                <p className="text-xs font-semibold text-slate-500">
                  توثيق تلقائي لنتائج اختبارات تحديد المستوى وأوراق عمل الدروس مع إمكانية التصدير لملف Excel.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportResultsCsv}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-emerald-700 transition"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>تصدير لملف Excel (CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4" />
                  <span>طباعة الكشف</span>
                </button>
              </div>
            </div>

            <div className="relative max-w-sm">
              <input
                type="text"
                value={resultSearch}
                onChange={(e) => setResultSearch(e.target.value)}
                placeholder="ابحثي باسم الطالبة أو الصف..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs font-bold"
              />
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-black">
                    <th className="p-3">اسم الطالبة</th>
                    <th className="p-3">الصف الدراسي</th>
                    <th className="p-3">الاختبار / الدرس</th>
                    <th className="p-3">الدرجة</th>
                    <th className="p-3">النسبة</th>
                    <th className="p-3">رمز التحقق</th>
                    <th className="p-3">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        لا توجد نتائج مسجلة حتى الآن
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="p-3 font-black text-slate-900">{r.studentName}</td>
                        <td className="p-3 font-semibold text-slate-600">{r.studentGrade}</td>
                        <td className="p-3 font-bold text-indigo-900">{r.activityTitle}</td>
                        <td className="p-3 font-mono font-bold" dir="ltr">
                          {r.score} / {r.totalQuestions}
                        </td>
                        <td className="p-3">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-black text-emerald-800">
                            {r.percentage}%
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs text-slate-500">{r.verificationCode || '—'}</td>
                        <td className="p-3 text-xs text-slate-400">{formatTimeAgo(r.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* SECTION 3: LESSONS & QUESTIONS CMS */}
        {dashboardSection === 'lessons' && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
            {!editingTopic ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-950">إدارة الدروس والأسئلة والفيديوهات</h2>
                    <p className="text-xs font-semibold text-slate-500">
                      عدّلي أي درس حالي أو أضيفي درساً جديداً مع رفع فيديو أو رابط يوتيوب والأسئلة التفاعلية.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingTopic({
                        slug: `custom-${Date.now().toString(36)}`,
                        titleAr: '',
                        titleEn: '',
                        description: '',
                        imageUrl: '/content/grammar/present-simple.jpg',
                        videoUrl: '',
                        questions: [
                          {
                            id: `q-${Date.now()}`,
                            prompt: '',
                            hint: '',
                            options: [
                              { text: '', isCorrect: true },
                              { text: '', isCorrect: false },
                              { text: '', isCorrect: false },
                              { text: '', isCorrect: false },
                            ],
                          },
                        ],
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-violet-800"
                  >
                    <Plus className="h-4 w-4" />
                    <span>إضافة درس جديد</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {topicsList.map((topic) => (
                    <div
                      key={topic.slug}
                      className="rounded-2xl border border-slate-200 p-4 flex flex-col justify-between bg-slate-50/50 hover:bg-white hover:border-violet-300 transition"
                    >
                      <div>
                        <span className="text-[11px] font-black text-violet-700" dir="ltr">
                          {topic.titleEn}
                        </span>
                        <h3 className="text-base font-black text-slate-950 mt-0.5">{topic.titleAr}</h3>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{topic.description}</p>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3">
                        <span className="text-xs font-bold text-emerald-700">
                          {topic.questions.length} أسئلة
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingTopic(JSON.parse(JSON.stringify(topic)))}
                          className="inline-flex items-center gap-1 rounded-xl bg-violet-100 px-3 py-1.5 text-xs font-black text-violet-800 hover:bg-violet-200"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>تعديل</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <form onSubmit={handleSaveTopic} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-black text-slate-950">
                    {editingTopic.titleAr || 'درس جديد'}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTopic(null);
                        setUploadMessage(null);
                      }}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-black text-white hover:bg-emerald-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>حفظ الدرس</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">عنوان الدرس (عربي)</label>
                    <input
                      type="text"
                      required
                      value={editingTopic.titleAr}
                      onChange={(e) => setEditingTopic({ ...editingTopic, titleAr: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">عنوان الدرس (إنجليزي)</label>
                    <input
                      type="text"
                      required
                      dir="ltr"
                      value={editingTopic.titleEn}
                      onChange={(e) => setEditingTopic({ ...editingTopic, titleEn: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">شرح مختصر للدرس</label>
                  <textarea
                    rows={2}
                    value={editingTopic.description}
                    onChange={(e) => setEditingTopic({ ...editingTopic, description: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold"
                  />
                </div>

                {/* Video Upload + Direct Link */}
                <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    الفيديو التعليمي (ارفعي مقطع MP4 من جوالك أو الصقي رابط يوتيوب)
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      dir="ltr"
                      value={editingTopic.videoUrl || ''}
                      onChange={(e) => setEditingTopic({ ...editingTopic, videoUrl: e.target.value })}
                      placeholder="https://www.youtube.com/... أو ارفعي فيديو من الزر المجاور"
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 placeholder-slate-400"
                    />

                    <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs font-black transition shrink-0 shadow-xs">
                      {uploadingVideo ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>جاري الرفع...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          <span>📤 رفع فيديو من الجوال</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        disabled={uploadingVideo}
                        onChange={handleVideoFileUpload}
                      />
                    </label>
                  </div>

                  {uploadMessage && (
                    <p className="text-xs font-bold text-violet-800 pt-1">
                      {uploadMessage}
                    </p>
                  )}
                </div>

                {/* Questions Builder */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800">
                      الأسئلة التفاعلية للدرس ({editingTopic.questions.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        const newQ = {
                          id: `q-${Date.now()}`,
                          prompt: '',
                          hint: '',
                          options: [
                            { text: '', isCorrect: true },
                            { text: '', isCorrect: false },
                            { text: '', isCorrect: false },
                            { text: '', isCorrect: false },
                          ],
                        };
                        setEditingTopic({
                          ...editingTopic,
                          questions: [...editingTopic.questions, newQ],
                        });
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:text-violet-900"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>إضافة سؤال</span>
                    </button>
                  </div>

                  {editingTopic.questions.map((q, qIdx) => (
                    <div key={q.id || qIdx} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-slate-600">سؤال #{qIdx + 1}</span>
                        {editingTopic.questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = editingTopic.questions.filter((_, idx) => idx !== qIdx);
                              setEditingTopic({ ...editingTopic, questions: updated });
                            }}
                            className="text-rose-500 hover:text-rose-700 text-xs font-bold"
                          >
                            حذف السؤال
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="نص السؤال (بالإنجليزية)..."
                        value={q.prompt}
                        dir="ltr"
                        onChange={(e) => {
                          const updated = editingTopic.questions.map((item, idx) =>
                            idx === qIdx ? { ...item, prompt: e.target.value } : item
                          );
                          setEditingTopic({ ...editingTopic, questions: updated });
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-q-${qIdx}`}
                              checked={opt.isCorrect}
                              onChange={() => {
                                const updated = editingTopic.questions.map((item, idx) => {
                                  if (idx !== qIdx) return item;
                                  return {
                                    ...item,
                                    options: item.options.map((o, oIdx) => ({
                                      ...o,
                                      isCorrect: oIdx === optIdx,
                                    })),
                                  };
                                });
                                setEditingTopic({ ...editingTopic, questions: updated });
                              }}
                            />
                            <input
                              type="text"
                              dir="ltr"
                              placeholder={`الخيار ${optIdx + 1}${opt.isCorrect ? ' (الصحيح)' : ''}`}
                              value={opt.text}
                              onChange={(e) => {
                                const updated = editingTopic.questions.map((item, idx) => {
                                  if (idx !== qIdx) return item;
                                  return {
                                    ...item,
                                    options: item.options.map((o, oIdx) =>
                                      oIdx === optIdx ? { ...o, text: e.target.value } : o
                                    ),
                                  };
                                });
                                setEditingTopic({ ...editingTopic, questions: updated });
                              }}
                              className={`flex-1 rounded-lg border px-2.5 py-1 text-xs font-medium bg-white ${
                                opt.isCorrect ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-200'
                              }`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </form>
            )}
          </section>
        )}

        {/* SECTION 4: HONOR ROLL & BADGES */}
        {dashboardSection === 'honor' && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
            <div>
              <h2 className="text-lg font-black text-slate-950">إدارة لوحة الشرف والأوسمة التشجيعية</h2>
              <p className="text-xs font-semibold text-slate-500">
                أضيفي أسماء الطالبات المتفوقات وامنحيهن الأوسمة التشجيعية لمشاركتها مع المدرسة وأولياء الأمور.
              </p>
            </div>

            <form onSubmit={handleAddHonorStudent} className="grid grid-cols-1 sm:grid-cols-4 gap-3 rounded-2xl bg-amber-50/60 border border-amber-200 p-4">
              <input
                type="text"
                required
                value={newHonorName}
                onChange={(e) => setNewHonorName(e.target.value)}
                placeholder="اسم الطالبة..."
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
              />
              <input
                type="text"
                value={newHonorGrade}
                onChange={(e) => setNewHonorGrade(e.target.value)}
                placeholder="الصف الدراسي..."
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
              />
              <input
                type="text"
                value={newHonorNote}
                onChange={(e) => setNewHonorNote(e.target.value)}
                placeholder="سبب التكريم..."
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
              />
              <button
                type="submit"
                className="rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-2 px-4 shadow-xs"
              >
                + إضافة للوحة الشرف
              </button>
            </form>

            <div className="space-y-3">
              {honorStudents.map((st) => (
                <div
                  key={st.id}
                  className="rounded-2xl border border-slate-200 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <span className="font-black text-sm text-slate-950">{st.studentName}</span>
                    <span className="mr-2 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                      {st.studentGrade}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">{st.note}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {HONOR_BADGES.map((b) => {
                      const has = st.badges.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleToggleBadge(st.id, b.id)}
                          className={`rounded-xl border px-2.5 py-1 text-xs font-bold transition ${
                            has ? b.color : 'border-slate-200 bg-slate-50 text-slate-400'
                          }`}
                        >
                          {b.icon} {b.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <PortalFooter />
    </div>
  );
}
