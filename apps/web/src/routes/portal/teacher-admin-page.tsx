import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Search,
  BookOpen,
  BookText,
  Headphones,
  PenLine,
  Lightbulb,
  MessageSquareHeart,
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
  getMergedReadingPassages,
  getMergedListeningActivities,
  getMergedWritingPrompts,
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
import type {
  GrammarTopic,
  ReadingPassage,
  ListeningActivity,
  WritingPrompt,
  QuizQuestion,
} from '../../data/content/types';

const TOPIC_LABELS: Record<string, string> = Object.fromEntries(
  grammarTopics.map((t) => [t.slug, t.titleAr]),
);

const HONOR_BADGES = [
  { id: 'grammar_star', title: 'نجمة القواعد', icon: '✨', color: 'bg-violet-100 text-violet-800 border-violet-300' },
  { id: 'million_winner', title: 'بطلة المليون', icon: '🏆', color: 'bg-amber-100 text-amber-900 border-amber-300' },
  { id: 'active_reader', title: 'قارئة متميزة', icon: '📖', color: 'bg-sky-100 text-sky-800 border-sky-300' },
  { id: 'listening_pro', title: 'سفيرة الاستماع', icon: '🎧', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { id: 'writing_talent', title: 'موهوبة الكتابة', icon: '✍️', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { id: 'fluent_speaker', title: 'متحدثة لبقة', icon: '🎙️', color: 'bg-pink-100 text-pink-800 border-pink-300' },
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

/**
 * مكون محرر بنك الأسئلة الموحد (يدعم نص السؤال + الملاحظة/الشرح التوضيحي Hint + الخيارات)
 */
function QuestionsListEditor({
  questions,
  onChange,
}: {
  questions: QuizQuestion[];
  onChange: (updated: QuizQuestion[]) => void;
}) {
  function handleAddQuestion() {
    const newQ: QuizQuestion = {
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
    onChange([...questions, newQ]);
  }

  function handleRemoveQuestion(idx: number) {
    if (questions.length <= 1) return;
    onChange(questions.filter((_, i) => i !== idx));
  }

  function handleUpdatePrompt(idx: number, prompt: string) {
    onChange(
      questions.map((q, i) => (i === idx ? { ...q, prompt } : q))
    );
  }

  function handleUpdateHint(idx: number, hint: string) {
    onChange(
      questions.map((q, i) => (i === idx ? { ...q, hint } : q))
    );
  }

  function handleSetCorrectOption(qIdx: number, optIdx: number) {
    onChange(
      questions.map((q, i) => {
        if (i !== qIdx) return q;
        return {
          ...q,
          options: q.options.map((o, oIdx) => ({
            ...o,
            isCorrect: oIdx === optIdx,
          })),
        };
      })
    );
  }

  function handleUpdateOptionText(qIdx: number, optIdx: number, text: string) {
    onChange(
      questions.map((q, i) => {
        if (i !== qIdx) return q;
        return {
          ...q,
          options: q.options.map((o, oIdx) => (oIdx === optIdx ? { ...o, text } : o)),
        };
      })
    );
  }

  return (
    <div className="space-y-4 pt-3">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
        <div className="flex items-center gap-2">
          <h4 className="text-xs sm:text-sm font-black text-slate-900">
            بنك الأسئلة التفاعلية والملاحظات ({questions.length})
          </h4>
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-800">
            تغذية راجعة فورية
          </span>
        </div>
        <button
          type="button"
          onClick={handleAddQuestion}
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-100 px-3 py-1.5 text-xs font-black text-violet-800 hover:bg-violet-200 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>إضافة سؤال</span>
        </button>
      </div>

      {questions.map((q, qIdx) => (
        <div
          key={q.id || qIdx}
          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="rounded-lg bg-slate-200/80 px-2.5 py-0.5 text-[11px] font-black text-slate-700">
              سؤال #{qIdx + 1}
            </span>
            {questions.length > 1 && (
              <button
                type="button"
                onClick={() => handleRemoveQuestion(qIdx)}
                className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>حذف السؤال</span>
              </button>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              نص السؤال (بالإنجليزية)
            </label>
            <input
              type="text"
              dir="ltr"
              required
              placeholder="e.g. She usually ______ to school by bus."
              value={q.prompt}
              onChange={(e) => handleUpdatePrompt(qIdx, e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-hidden"
            />
          </div>

          {/* حقل الملاحظة التوضيحية والشرح Hint */}
          <div className="rounded-xl border border-amber-200/90 bg-amber-50/70 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
              <Lightbulb className="h-4 w-4 text-amber-600 shrink-0" />
              <span>ملاحظة وتوضيح الإجابة (Hint / Explanation)</span>
              <span className="text-[10px] font-normal text-amber-800">
                (تظهر للطالبة في صندوق المصباح 💡 عند الحل)
              </span>
            </div>
            <input
              type="text"
              dir="ltr"
              value={q.hint || ''}
              onChange={(e) => handleUpdateHint(qIdx, e.target.value)}
              placeholder="e.g. Notice that 'usually' is a keyword for Present Simple with 3rd-person singular 'goes'."
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          <div>
            <span className="block text-[11px] font-bold text-slate-700 mb-2">
              الخيارات الأربعة (حددي الإجابة الصحيحة بالضغط على الدائرة):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {q.options.map((opt, optIdx) => (
                <div
                  key={optIdx}
                  className={`flex items-center gap-2 rounded-xl border p-2 transition ${
                    opt.isCorrect
                      ? 'border-emerald-400 bg-emerald-50/50 shadow-xs'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name={`correct-q-${qIdx}`}
                    checked={opt.isCorrect}
                    onChange={() => handleSetCorrectOption(qIdx, optIdx)}
                    className="h-4 w-4 text-emerald-600 accent-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    title="تحديد كإجابة صحيحة"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    required
                    placeholder={`الخيار ${optIdx + 1}${opt.isCorrect ? ' (الصحيح)' : ''}...`}
                    value={opt.text}
                    onChange={(e) => handleUpdateOptionText(qIdx, optIdx, e.target.value)}
                    className="flex-1 bg-transparent text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-hidden"
                  />
                  {opt.isCorrect && (
                    <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-800">
                      صحيح
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TeacherAdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState(TEACHER_USERNAME);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  // Main Dashboard Section Switcher
  const [dashboardSection, setDashboardSection] = useState<'qna' | 'results' | 'lessons' | 'honor'>('qna');

  // Sub-skill Switcher inside CMS
  const [activeSkill, setActiveSkill] = useState<'grammar' | 'reading' | 'listening' | 'writing'>('grammar');

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

  // 3. Multi-Skill Educational Content Data
  const [topicsList, setTopicsList] = useState<GrammarTopic[]>(() => getMergedGrammarTopics());
  const [passagesList, setPassagesList] = useState<ReadingPassage[]>(() => getMergedReadingPassages());
  const [listeningList, setListeningList] = useState<ListeningActivity[]>(() => getMergedListeningActivities());
  const [writingList, setWritingList] = useState<WritingPrompt[]>(() => getMergedWritingPrompts());

  // Editing items
  const [editingTopic, setEditingTopic] = useState<GrammarTopic | null>(null);
  const [editingPassage, setEditingPassage] = useState<ReadingPassage | null>(null);
  const [editingListening, setEditingListening] = useState<ListeningActivity | null>(null);
  const [editingWriting, setEditingWriting] = useState<WritingPrompt | null>(null);

  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

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

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      guestbookClient.getAllEntriesAcrossPlatform(),
      studentResultsClient.getAllResults(),
    ])
      .then(([qnaData, resultsData]) => {
        setEntries(qnaData);
        setResults(resultsData);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
  }, [isAuthenticated, loadData]);

  function showToast(msg: string) {
    setFeedbackNotice(msg);
    setTimeout(() => {
      setFeedbackNotice(null);
    }, 4500);
  }

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
        showToast('تم إرسال الرد المعتمد للطالبة بنجاح! ✅');
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
      showToast('تم حذف المشاركة بنجاح');
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
    showToast('تم تصدير كشف الدرجات بصيغة Excel (CSV) بنجاح! 📊');
  }

  // --- Handlers: Grammar ---
  async function handleSaveTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTopic || !editingTopic.titleAr.trim() || !editingTopic.titleEn.trim()) return;
    await customLessonsClient.saveGrammarTopic(editingTopic);
    setTopicsList(getMergedGrammarTopics());
    setEditingTopic(null);
    setUploadMessage(null);
    showToast('تم حفظ درس القواعد والأسئلة بنجاح وستظهر للطالبات فوراً! ✅');
  }

  async function handleDeleteTopic(slug: string) {
    if (!window.confirm('هل أنتِ متأكدة من حذف هذا الدرس؟')) return;
    await customLessonsClient.deleteGrammarTopic(slug);
    setTopicsList(getMergedGrammarTopics());
    showToast('تم حذف الدرس بنجاح');
  }

  // --- Handlers: Reading ---
  async function handleSavePassage(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPassage || !editingPassage.titleAr.trim() || !editingPassage.titleEn.trim()) return;
    await customLessonsClient.saveReadingPassage(editingPassage);
    setPassagesList(getMergedReadingPassages());
    setEditingPassage(null);
    showToast('تم حفظ نص القراءة وأسئلة الفهم بنجاح! ✅');
  }

  async function handleDeletePassage(slug: string) {
    if (!window.confirm('هل أنتِ متأكدة من حذف هذا النص القرائي؟')) return;
    await customLessonsClient.deleteReadingPassage(slug);
    setPassagesList(getMergedReadingPassages());
    showToast('تم حذف نص القراءة بنجاح');
  }

  // --- Handlers: Listening ---
  async function handleSaveListening(e: React.FormEvent) {
    e.preventDefault();
    if (!editingListening || !editingListening.titleAr.trim() || !editingListening.titleEn.trim()) return;
    await customLessonsClient.saveListeningActivity(editingListening);
    setListeningList(getMergedListeningActivities());
    setEditingListening(null);
    showToast('تم حفظ نشاط الاستماع وأسئلته بنجاح! ✅');
  }

  async function handleDeleteListening(slug: string) {
    if (!window.confirm('هل أنتِ متأكدة من حذف نشاط الاستماع هذا؟')) return;
    await customLessonsClient.deleteListeningActivity(slug);
    setListeningList(getMergedListeningActivities());
    showToast('تم حذف نشاط الاستماع بنجاح');
  }

  // --- Handlers: Writing ---
  async function handleSaveWriting(e: React.FormEvent) {
    e.preventDefault();
    if (!editingWriting || !editingWriting.titleAr.trim() || !editingWriting.titleEn.trim()) return;
    await customLessonsClient.saveWritingPrompt(editingWriting);
    setWritingList(getMergedWritingPrompts());
    setEditingWriting(null);
    showToast('تم حفظ تدريب الكتابة ونموذج الإجابة بنجاح! ✅');
  }

  async function handleDeleteWriting(idOrSlug: string) {
    if (!window.confirm('هل أنتِ متأكدة من حذف هذا التدريب؟')) return;
    await customLessonsClient.deleteWritingPrompt(idOrSlug);
    setWritingList(getMergedWritingPrompts());
    showToast('تم حذف تدريب الكتابة بنجاح');
  }

  // --- Media Upload (Audio / Video) ---
  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>, target: 'grammar' | 'listening') {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    setUploadMessage(null);
    try {
      const res = await uploadMediaToSupabase(file, 'videos');
      if (res.url) {
        if (target === 'grammar' && editingTopic) {
          setEditingTopic({ ...editingTopic, videoUrl: res.url });
        } else if (target === 'listening' && editingListening) {
          setEditingListening({ ...editingListening, mediaUrl: res.url, audioUrl: res.url });
        }
        setUploadMessage('تم رفع الملف السحابي وحفظ الرابط بنجاح! ✅');
      } else {
        setUploadMessage(res.error || 'تعذر رفع الملف');
      }
    } finally {
      setUploadingMedia(false);
    }
  }

  // --- Honor Roll Handlers ---
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
    showToast('تمت إضافة الطالبة إلى لوحة الشرف! 🌟');
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
        if (selectedTopic === 'guestbook') {
          if (entry.topicSlug) return false;
        } else if (entry.topicSlug !== selectedTopic) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inName = entry.name.toLowerCase().includes(q);
        const inMsg = entry.message.toLowerCase().includes(q);
        const inReply = (entry.teacherReply || '').toLowerCase().includes(q);
        if (!inName && !inMsg && !inReply) return false;
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
        r.studentGrade.toLowerCase().includes(q) ||
        r.activityTitle.toLowerCase().includes(q)
    );
  }, [results, resultSearch]);

  const stats = useMemo(() => {
    const questionEntries = entries.filter((e) => Boolean(e.topicSlug));
    const pending = questionEntries.filter((e) => !e.teacherReply).length;
    const answered = questionEntries.filter((e) => Boolean(e.teacherReply)).length;
    const guestbookCount = entries.filter((e) => !e.topicSlug).length;
    return {
      totalQuestions: questionEntries.length,
      pending,
      answered,
      guestbookCount,
      resultsCount: results.length,
    };
  }, [entries, results]);

  // LOGIN SCREEN (Strictly matches vitest tests)
  if (!isAuthenticated) {
    return (
      <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-slate-50/50" dir="rtl">
        <PublicBackdrop />
        <PortalNav />

        <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl border border-violet-100 bg-white/95 p-6 shadow-xl backdrop-blur-xl sm:p-8">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-600/30">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-0.5 text-xs font-black text-violet-800">
                <Sparkles className="h-3 w-3" />
                English Spark
              </span>
              <h1 className="mt-2 text-xl sm:text-2xl font-black text-slate-900">
                لوحة معلمات اللغة الإنجليزية
              </h1>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-500">
                إدارة المحتوى وسجل درجات الطالبات واستفسارات المنهج
              </p>
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المعلمة</label>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">الرقم السري</label>
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
                  اسم المستخدم أو كلمة المرور غير صحيحة
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
                  <span>العودة إلى <span dir="ltr">English Spark</span></span>
                </Link>
              </div>
            </form>
          </div>
        </div>
        <PortalFooter />
      </div>
    );
  }

  const teacherSession = getTeacherSession();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      {/* Floating feedback toast */}
      {feedbackNotice && (
        <div className="fixed bottom-6 left-6 z-50 rounded-2xl bg-slate-900/95 text-white px-5 py-3 shadow-2xl backdrop-blur-md text-xs sm:text-sm font-bold border border-slate-800 animate-page-enter">
          {feedbackNotice}
        </div>
      )}

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
                    أهلاً بكم: {teacherSession?.name || TEACHER_OFFICIAL_NAME}
                  </h1>
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-800">
                    جلسة نشطة
                  </span>
                </div>
                <p className="mt-0.5 text-xs sm:text-sm font-semibold text-slate-500">
                  لوحة إشراف المعلمات • إدارة تعليم جازان — متوسطة وثانوية الجرادية — متابعة استفسارات الدروس والنتائج
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

            <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700">بانتظار الإجابة</span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-amber-950">{stats.pending}</p>
              <span className="text-[10px] text-slate-400">تحتاج رد المعلمة</span>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700">تمت الإجابة</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-950">{stats.answered}</p>
              <span className="text-[10px] text-slate-400">إجابات منشورة للجميع</span>
            </div>

            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-700">سجل الزوار</span>
                <MessageSquareHeart className="h-4 w-4 text-rose-600" />
              </div>
              <p className="mt-2 text-2xl font-black text-rose-950">{stats.guestbookCount}</p>
              <span className="text-[10px] text-slate-400">رسائل وصلت داعمة</span>
            </div>
          </div>
        </section>

        {/* Main 4 Section Tabs */}
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
            <span>إدارة المحتوى التعليمي والدروس ({topicsList.length + passagesList.length + listeningList.length + writingList.length})</span>
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

        {/* =============================================================== */}
        {/* SECTION 1: Q&A AND GUESTBOOK                                    */}
        {/* =============================================================== */}
        {dashboardSection === 'qna' && (
          <>
            <section className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                    activeTab === 'all'
                      ? 'bg-violet-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  الكل ({entries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pending')}
                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                    activeTab === 'pending'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  <span>بانتظار الرد ({stats.pending})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('answered')}
                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                    activeTab === 'answered'
                      ? 'bg-emerald-600 text-white'
                      : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>تم الرد ({stats.answered})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('guestbook')}
                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black transition ${
                    activeTab === 'guestbook'
                      ? 'bg-rose-600 text-white'
                      : 'text-rose-800 bg-rose-50 hover:bg-rose-100'
                  }`}
                >
                  <MessageSquareHeart className="h-3 w-3" />
                  <span>سجل الزوار ({stats.guestbookCount})</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs focus:border-violet-500 focus:outline-hidden"
                >
                  <option value="all">جميع المواضيع</option>
                  <option value="guestbook">سجل الزوار العام</option>
                  {topicsList.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.titleAr}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث في الأسئلة والأسماء..."
                    className="w-44 sm:w-56 rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-hidden"
                  />
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              {loading ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-400">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-600" />
                  <p className="mt-2 text-xs font-bold">جاري تحميل الاستفسارات والمشاركات...</p>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-400">
                  <MessageCircleQuestion className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-slate-600">لا توجد مشاركات مطابقة</p>
                </div>
              ) : (
                filteredEntries.map((entry) => {
                  const isReplying = activeReplyId === entry.id;
                  const isQuestion = Boolean(entry.topicSlug);
                  const topicName = entry.topicSlug
                    ? TOPIC_LABELS[entry.topicSlug] || entry.topicSlug
                    : 'سجل الزوار';

                  return (
                    <div
                      key={entry.id}
                      className={`rounded-2xl sm:rounded-3xl border p-4 sm:p-5 transition shadow-xs ${
                        entry.teacherReply
                          ? 'border-emerald-100 bg-white'
                          : isQuestion
                          ? 'border-amber-200 bg-amber-50/30'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xs font-black text-violet-800">
                            {entry.name.slice(0, 1)}
                          </div>
                          <div>
                            <span className="font-black text-sm text-slate-900">{entry.name}</span>
                            <span className="mr-2 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                              {entry.role}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                              isQuestion
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                            }`}
                          >
                            {topicName}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            {formatTimeAgo(entry.createdAt)}
                          </span>
                        </div>
                      </div>

                      <p className="mt-3 text-xs sm:text-sm font-semibold leading-relaxed text-slate-800">
                        {entry.message}
                      </p>

                      {entry.teacherReply && (
                        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 sm:p-3.5">
                          <div className="flex items-center justify-between text-xs font-black text-emerald-900 mb-1">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              <span>رد المعلمة المعتمد</span>
                            </span>
                            <span className="text-[10px] font-normal text-slate-400">
                              {entry.repliedAt ? formatTimeAgo(entry.repliedAt) : ''}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm font-semibold leading-relaxed text-slate-800">
                            {entry.teacherReply}
                          </p>
                        </div>
                      )}

                      {isReplying && (
                        <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-2">
                          <textarea
                            rows={3}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="اكتبي الرد الشافي للطالبة..."
                            className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-hidden"
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveReplyId(null)}
                              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              disabled={submittingReply || !replyText.trim()}
                              onClick={() => handleReplySubmit(entry)}
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

        {/* =============================================================== */}
        {/* SECTION 2: STUDENT RESULTS & EXCEL EXPORT                       */}
        {/* =============================================================== */}
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

        {/* =============================================================== */}
        {/* SECTION 3: MULTI-SKILL CONTENT CMS (GRAMMAR, READING, LISTENING, WRITING) */}
        {/* =============================================================== */}
        {dashboardSection === 'lessons' && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-6">
            {/* Sub-skill Tab Navigation */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
              <button
                type="button"
                onClick={() => {
                  setActiveSkill('grammar');
                  setEditingTopic(null);
                  setEditingPassage(null);
                  setEditingListening(null);
                  setEditingWriting(null);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
                  activeSkill === 'grammar'
                    ? 'bg-violet-700 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>📘 القواعد Grammar ({topicsList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSkill('reading');
                  setEditingTopic(null);
                  setEditingPassage(null);
                  setEditingListening(null);
                  setEditingWriting(null);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
                  activeSkill === 'reading'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <BookText className="h-4 w-4" />
                <span>📖 القراءة والفهم Reading ({passagesList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSkill('listening');
                  setEditingTopic(null);
                  setEditingPassage(null);
                  setEditingListening(null);
                  setEditingWriting(null);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
                  activeSkill === 'listening'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <Headphones className="h-4 w-4" />
                <span>🎧 الاستماع Listening ({listeningList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSkill('writing');
                  setEditingTopic(null);
                  setEditingPassage(null);
                  setEditingListening(null);
                  setEditingWriting(null);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
                  activeSkill === 'writing'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <PenLine className="h-4 w-4" />
                <span>✍️ الكتابة Writing ({writingList.length})</span>
              </button>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* SUB-SKILL 1: GRAMMAR CMS                                      */}
            {/* ------------------------------------------------------------- */}
            {activeSkill === 'grammar' && (
              <>
                {!editingTopic ? (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-base sm:text-lg font-black text-slate-950">
                          دروس القواعد والأسئلة والفيديوهات
                        </h2>
                        <p className="text-xs text-slate-500">
                          عدّلي أي قاعدة حالية أو أضيفي درساً جديداً مع رابط فيديو وأسئلة تفاعلية وملاحظات.
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
                        <span>إضافة قاعدة جديدة</span>
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
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingTopic(JSON.parse(JSON.stringify(topic)))}
                                className="inline-flex items-center gap-1 rounded-xl bg-violet-100 px-3 py-1.5 text-xs font-black text-violet-800 hover:bg-violet-200"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>تعديل</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTopic(topic.slug)}
                                className="rounded-xl border border-slate-200 p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                title="حذف"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveTopic} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="text-base font-black text-slate-950">
                        {editingTopic.titleAr || 'درس قواعد جديد'}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingTopic(null)}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-black text-white"
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
                      <label className="block text-xs font-bold text-slate-700 mb-1">شرح مختصر للقاعدة</label>
                      <textarea
                        rows={2}
                        value={editingTopic.description}
                        onChange={(e) => setEditingTopic({ ...editingTopic, description: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        رابط الفيديو (YouTube Embed أو MP4)
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          dir="ltr"
                          value={editingTopic.videoUrl || ''}
                          onChange={(e) => setEditingTopic({ ...editingTopic, videoUrl: e.target.value })}
                          placeholder="https://www.youtube.com/embed/... أو رابط فيديو"
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                        />
                        <label className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100 cursor-pointer transition">
                          <Upload className="h-3.5 w-3.5" />
                          <span>{uploadingMedia ? 'جاري الرفع...' : 'رفع مقطع MP4'}</span>
                          <input
                            type="file"
                            accept="video/mp4,video/*"
                            className="hidden"
                            disabled={uploadingMedia}
                            onChange={(e) => handleMediaUpload(e, 'grammar')}
                          />
                        </label>
                      </div>
                      {uploadMessage && (
                        <p className="text-xs font-bold text-violet-800 pt-1.5">{uploadMessage}</p>
                      )}
                    </div>

                    <QuestionsListEditor
                      questions={editingTopic.questions}
                      onChange={(questions) => setEditingTopic({ ...editingTopic, questions })}
                    />
                  </form>
                )}
              </>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SUB-SKILL 2: READING CMS                                      */}
            {/* ------------------------------------------------------------- */}
            {activeSkill === 'reading' && (
              <>
                {!editingPassage ? (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-base sm:text-lg font-black text-slate-950">
                          نصوص القراءة والفهم والاستيعاب
                        </h2>
                        <p className="text-xs text-slate-500">
                          أضيفي أو عدلي النصوص القرائية الكاملة وحددي مستواها مع أسئلة فهم المقروء وملاحظاتها.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingPassage({
                            slug: `reading-${Date.now().toString(36)}`,
                            titleAr: '',
                            titleEn: '',
                            level: 'easy',
                            text: '',
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
                        className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-sky-700"
                      >
                        <Plus className="h-4 w-4" />
                        <span>إضافة نص قراءة جديد</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {passagesList.map((passage) => (
                        <div
                          key={passage.slug}
                          className="rounded-2xl border border-slate-200 p-4 flex flex-col justify-between bg-slate-50/50 hover:bg-white hover:border-sky-300 transition"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-black text-sky-700" dir="ltr">
                                {passage.titleEn}
                              </span>
                              <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-800">
                                {passage.level === 'easy' ? 'مبتدئ' : passage.level === 'medium' ? 'متوسط' : 'متقدم'}
                              </span>
                            </div>
                            <h3 className="text-base font-black text-slate-950 mt-0.5">{passage.titleAr}</h3>
                            <p className="text-xs text-slate-600 mt-2 line-clamp-3 font-mono leading-relaxed" dir="ltr">
                              {passage.text}
                            </p>
                          </div>
                          <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3">
                            <span className="text-xs font-bold text-sky-700">
                              {passage.questions.length} أسئلة فهم
                            </span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingPassage(JSON.parse(JSON.stringify(passage)))}
                                className="inline-flex items-center gap-1 rounded-xl bg-sky-100 px-3 py-1.5 text-xs font-black text-sky-800 hover:bg-sky-200"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>تعديل</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePassage(passage.slug)}
                                className="rounded-xl border border-slate-200 p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                title="حذف"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSavePassage} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="text-base font-black text-slate-950">
                        {editingPassage.titleAr || 'نص قراءة جديد'}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingPassage(null)}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-black text-white"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>حفظ النص القرائي</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">عنوان النص (عربي)</label>
                        <input
                          type="text"
                          required
                          value={editingPassage.titleAr}
                          onChange={(e) => setEditingPassage({ ...editingPassage, titleAr: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">عنوان النص (إنجليزي)</label>
                        <input
                          type="text"
                          required
                          dir="ltr"
                          value={editingPassage.titleEn}
                          onChange={(e) => setEditingPassage({ ...editingPassage, titleEn: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">مستوى الصعوبة</label>
                        <select
                          value={editingPassage.level}
                          onChange={(e) =>
                            setEditingPassage({
                              ...editingPassage,
                              level: e.target.value as ReadingPassage['level'],
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
                        >
                          <option value="easy">مبتدئ (Easy - A1/A2)</option>
                          <option value="medium">متوسط (Medium - B1)</option>
                          <option value="hard">متقدم (Advanced - B2)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        النص القرائي الكامل (Full Passage Text — بالإنجليزية)
                      </label>
                      <textarea
                        rows={7}
                        dir="ltr"
                        required
                        value={editingPassage.text}
                        onChange={(e) => setEditingPassage({ ...editingPassage, text: e.target.value })}
                        placeholder="Type or paste the full reading passage text here..."
                        className="w-full rounded-xl border border-slate-200 p-3 text-xs sm:text-sm font-medium leading-relaxed font-mono focus:border-sky-500 focus:outline-hidden"
                      />
                    </div>

                    <QuestionsListEditor
                      questions={editingPassage.questions}
                      onChange={(questions) => setEditingPassage({ ...editingPassage, questions })}
                    />
                  </form>
                )}
              </>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SUB-SKILL 3: LISTENING CMS                                    */}
            {/* ------------------------------------------------------------- */}
            {activeSkill === 'listening' && (
              <>
                {!editingListening ? (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-base sm:text-lg font-black text-slate-950">
                          أنشطة ومقاطع الاستماع والفهم السمعي
                        </h2>
                        <p className="text-xs text-slate-500">
                          أضيفي أو عدلي مقاطع الاستماع مع نصوص الحوار المفرغة والأسئلة التفاعلية والملاحظات.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingListening({
                            slug: `listening-${Date.now().toString(36)}`,
                            titleAr: '',
                            titleEn: '',
                            level: 'easy',
                            mediaUrl: '',
                            audioUrl: '',
                            audioScript: '',
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
                        className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-purple-700"
                      >
                        <Plus className="h-4 w-4" />
                        <span>إضافة نشاط استماع جديد</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {listeningList.map((item) => (
                        <div
                          key={item.slug}
                          className="rounded-2xl border border-slate-200 p-4 flex flex-col justify-between bg-slate-50/50 hover:bg-white hover:border-purple-300 transition"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-black text-purple-700" dir="ltr">
                                {item.titleEn}
                              </span>
                              <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-black text-purple-800">
                                {item.level === 'easy' ? 'مبتدئ' : item.level === 'medium' ? 'متوسط' : 'متقدم'}
                              </span>
                            </div>
                            <h3 className="text-base font-black text-slate-950 mt-0.5">{item.titleAr}</h3>
                            {item.audioScript && (
                              <p className="text-xs text-slate-600 mt-2 line-clamp-2 font-mono leading-relaxed" dir="ltr">
                                {item.audioScript}
                              </p>
                            )}
                          </div>
                          <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3">
                            <span className="text-xs font-bold text-purple-700">
                              {item.questions.length} أسئلة استماع
                            </span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingListening(JSON.parse(JSON.stringify(item)))}
                                className="inline-flex items-center gap-1 rounded-xl bg-purple-100 px-3 py-1.5 text-xs font-black text-purple-800 hover:bg-purple-200"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>تعديل</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteListening(item.slug)}
                                className="rounded-xl border border-slate-200 p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                title="حذف"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveListening} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="text-base font-black text-slate-950">
                        {editingListening.titleAr || 'نشاط استماع جديد'}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingListening(null)}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-black text-white"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>حفظ نشاط الاستماع</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">عنوان النشاط (عربي)</label>
                        <input
                          type="text"
                          required
                          value={editingListening.titleAr}
                          onChange={(e) => setEditingListening({ ...editingListening, titleAr: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">عنوان النشاط (إنجليزي)</label>
                        <input
                          type="text"
                          required
                          dir="ltr"
                          value={editingListening.titleEn}
                          onChange={(e) => setEditingListening({ ...editingListening, titleEn: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">مستوى الصعوبة</label>
                        <select
                          value={editingListening.level}
                          onChange={(e) =>
                            setEditingListening({
                              ...editingListening,
                              level: e.target.value as ListeningActivity['level'],
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
                        >
                          <option value="easy">مبتدئ (Easy)</option>
                          <option value="medium">متوسط (Medium)</option>
                          <option value="hard">متقدم (Advanced)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        رابط ملف الصوت أو الفيديو (URL / MP3 / MP4)
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          dir="ltr"
                          value={editingListening.mediaUrl || editingListening.audioUrl || ''}
                          onChange={(e) =>
                            setEditingListening({
                              ...editingListening,
                              mediaUrl: e.target.value,
                              audioUrl: e.target.value,
                            })
                          }
                          placeholder="https://... رابط الصوت أو الفيديو"
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                        />
                        <label className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-bold text-purple-800 hover:bg-purple-100 cursor-pointer transition">
                          <Upload className="h-3.5 w-3.5" />
                          <span>{uploadingMedia ? 'جاري الرفع...' : 'رفع ملف وسائط'}</span>
                          <input
                            type="file"
                            accept="audio/*,video/*"
                            className="hidden"
                            disabled={uploadingMedia}
                            onChange={(e) => handleMediaUpload(e, 'listening')}
                          />
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        تفريغ الحوار ونصوص الاستماع (Audio Script / Dialogue Transcript)
                      </label>
                      <textarea
                        rows={5}
                        dir="ltr"
                        value={editingListening.audioScript || ''}
                        onChange={(e) => setEditingListening({ ...editingListening, audioScript: e.target.value })}
                        placeholder="Speaker 1: Welcome to the library!&#10;Speaker 2: Thank you, I am looking for..."
                        className="w-full rounded-xl border border-slate-200 p-3 text-xs sm:text-sm font-medium leading-relaxed font-mono focus:border-purple-500 focus:outline-hidden"
                      />
                    </div>

                    <QuestionsListEditor
                      questions={editingListening.questions}
                      onChange={(questions) => setEditingListening({ ...editingListening, questions })}
                    />
                  </form>
                )}
              </>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SUB-SKILL 4: WRITING CMS                                      */}
            {/* ------------------------------------------------------------- */}
            {activeSkill === 'writing' && (
              <>
                {!editingWriting ? (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-base sm:text-lg font-black text-slate-950">
                          تدريبات ونماذج الكتابة والتعبير
                        </h2>
                        <p className="text-xs text-slate-500">
                          أضيفي أو عدلي تدريبات ترتيب الجمل وتصحيح الأخطاء وكتابة الفقرات مع نماذج الإجابات والشرح.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingWriting({
                            id: `writing-${Date.now()}`,
                            slug: `writing-${Date.now().toString(36)}`,
                            titleAr: '',
                            titleEn: '',
                            category: 'sentence',
                            level: 'easy',
                            instructionAr: 'رتّبي الكلمات المبعثرة لتكوين جملة إنجليزية صحيحة',
                            instructionEn: 'Unscramble the words to make a correct sentence.',
                            promptText: '',
                            modelAnswer: '',
                            explanationAr: '',
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-emerald-700"
                      >
                        <Plus className="h-4 w-4" />
                        <span>إضافة تدريب كتابة جديد</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {writingList.map((item) => (
                        <div
                          key={item.id || item.slug}
                          className="rounded-2xl border border-slate-200 p-4 flex flex-col justify-between bg-slate-50/50 hover:bg-white hover:border-emerald-300 transition"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-black text-emerald-700" dir="ltr">
                                {item.titleEn}
                              </span>
                              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                                {item.category === 'sentence'
                                  ? 'ترتيب جمل'
                                  : item.category === 'correction'
                                  ? 'تصحيح أخطاء'
                                  : 'كتابة فقرة'}
                              </span>
                            </div>
                            <h3 className="text-base font-black text-slate-950 mt-0.5">{item.titleAr}</h3>
                            <p className="text-xs text-slate-600 mt-2 line-clamp-2" dir="ltr">
                              {item.promptText}
                            </p>
                          </div>
                          <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3">
                            <span className="text-[11px] font-bold text-slate-500">
                              {item.modelAnswer ? 'نموذج إجابة متوفر' : 'تعبير حر'}
                            </span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingWriting(JSON.parse(JSON.stringify(item)))}
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800 hover:bg-emerald-200"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>تعديل</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteWriting(item.id || item.slug)}
                                className="rounded-xl border border-slate-200 p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                                title="حذف"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveWriting} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="text-base font-black text-slate-950">
                        {editingWriting.titleAr || 'تدريب كتابة جديد'}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingWriting(null)}
                          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-black text-white"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>حفظ تدريب الكتابة</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">عنوان التدريب (عربي)</label>
                        <input
                          type="text"
                          required
                          value={editingWriting.titleAr}
                          onChange={(e) => setEditingWriting({ ...editingWriting, titleAr: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">عنوان التدريب (إنجليزي)</label>
                        <input
                          type="text"
                          required
                          dir="ltr"
                          value={editingWriting.titleEn}
                          onChange={(e) => setEditingWriting({ ...editingWriting, titleEn: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">نوع تدريب الكتابة</label>
                        <select
                          value={editingWriting.category}
                          onChange={(e) =>
                            setEditingWriting({
                              ...editingWriting,
                              category: e.target.value as WritingPrompt['category'],
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
                        >
                          <option value="sentence">ترتيب جمل مبعثرة (Scrambled Words)</option>
                          <option value="correction">تصحيح أخطاء لغوية (Error Correction)</option>
                          <option value="paragraph">كتابة فقرة متكاملة (Paragraph Writing)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">المستوى (Level)</label>
                        <select
                          value={editingWriting.level || 'easy'}
                          onChange={(e) =>
                            setEditingWriting({
                              ...editingWriting,
                              level: e.target.value as WritingPrompt['level'],
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
                        >
                          <option value="easy">سهل (Easy)</option>
                          <option value="medium">متوسط (Medium)</option>
                          <option value="hard">متقدم (Hard)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">التعليمات (عربي)</label>
                        <input
                          type="text"
                          value={editingWriting.instructionAr}
                          onChange={(e) => setEditingWriting({ ...editingWriting, instructionAr: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">التعليمات (إنجليزي)</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={editingWriting.instructionEn}
                          onChange={(e) => setEditingWriting({ ...editingWriting, instructionEn: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        نص التدريب / السؤال أو الكلمات المبعثرة
                      </label>
                      <textarea
                        rows={3}
                        dir="ltr"
                        required
                        value={editingWriting.promptText}
                        onChange={(e) => setEditingWriting({ ...editingWriting, promptText: e.target.value })}
                        placeholder="e.g. always / English / practices / She / everyday"
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        نموذج الإجابة المثالي (Model Answer — يظهر للطالبة)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        required
                        value={editingWriting.modelAnswer}
                        onChange={(e) => setEditingWriting({ ...editingWriting, modelAnswer: e.target.value })}
                        placeholder="e.g. She always practices English everyday."
                        className="w-full rounded-xl border border-emerald-300 bg-emerald-50/40 px-3 py-2 text-xs font-bold text-emerald-950"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الشرح التوضيحي والتغذية الراجعة بالعربي
                      </label>
                      <input
                        type="text"
                        value={editingWriting.explanationAr}
                        onChange={(e) => setEditingWriting({ ...editingWriting, explanationAr: e.target.value })}
                        placeholder="شرح بسيط لتوضيح سبب الترتيب أو تصحيح الخطأ للطالبة..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold"
                      />
                    </div>
                  </form>
                )}
              </>
            )}
          </section>
        )}

        {/* =============================================================== */}
        {/* SECTION 4: HONOR ROLL & BADGES                                  */}
        {/* =============================================================== */}
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
