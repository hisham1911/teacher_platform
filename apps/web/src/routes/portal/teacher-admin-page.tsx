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
  Plus,
  Edit3,
  FileSpreadsheet,
  Printer,
  Check,
  Upload,
  Loader2,
  Image as ImageIcon,
  Video,
  X,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Copy,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter, SaudiEmblemIcon } from '../../components/portal/portal-nav';
import { PortalVideoPlayer } from '../../components/portal/portal-video-player';
import { toEmbedVideoUrl } from '../../components/portal/video-utils';
import {
  guestbookClient,
  studentResultsClient,
  customLessonsClient,
  uploadMediaToSupabase,
  getMergedGrammarTopics,
  getMergedReadingPassages,
  getMergedListeningActivities,
  getMergedWritingPrompts,
  type GuestbookEntry,
  type StudentQuizResultRecord,
  loginTeacher,
  logoutTeacher,
  isTeacherLoggedIn,
  getTeacherSession,
  TEACHER_OFFICIAL_NAME,
  TEACHER_USERNAME,
} from '../../data/api-client/guestbook-client';
import {
  parseVoiceMessage,
} from '../../data/content/national-journey-data';
import { grammarTopics } from '../../data/content/grammar';
import type {
  GrammarTopic,
  ReadingPassage,
  ListeningActivity,
  WritingPrompt,
  QuizQuestion,
} from '../../data/content/types';

const TOPIC_LABELS: Record<string, string> = {
  ...Object.fromEntries(grammarTopics.map((t) => [t.slug, t.titleAr])),
  'national-pride': '🇸🇦 مبادرة في القلب وطن وقيادة (أصوات تحب الوطن)',
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

function getResultStatus(percentage: number): { label: string; badgeClass: string } {
  if (percentage >= 85) {
    return {
      label: 'ممتاز · متقن 🌟',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
  }
  if (percentage >= 60) {
    return {
      label: 'جيد جداً · مجتاز ✓',
      badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
    };
  }
  return {
    label: 'بحاجة لدعم ومراجعة',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  };
}

/**
 * مكون محرر بنك الأسئلة الموحد (يدعم نص السؤال + الملاحظة/الشرح التوضيحي Hint + الخيارات + التكرار وإعادة الترتيب)
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

  function handleDuplicateQuestion(idx: number) {
    const target = questions[idx];
    if (!target) return;
    const duplicated: QuizQuestion = {
      ...target,
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      prompt: target.prompt,
      options: target.options.map((o) => ({ ...o })),
    };
    const next = [...questions];
    next.splice(idx + 1, 0, duplicated);
    onChange(next);
  }

  function handleMoveQuestion(idx: number, direction: 'up' | 'down') {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const next = [...questions];
    const moved = next[idx];
    if (!moved) return;
    next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    onChange(next);
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
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-100 px-3 py-1.5 text-xs font-black text-violet-800 hover:bg-violet-200 transition cursor-pointer"
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-slate-200/80 px-2.5 py-0.5 text-[11px] font-black text-slate-700">
                سؤال #{qIdx + 1}
              </span>
              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  disabled={qIdx === 0}
                  onClick={() => handleMoveQuestion(qIdx, 'up')}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                  title="تحريك للأعلى ↑"
                  aria-label="تحريك للأعلى"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={qIdx === questions.length - 1}
                  onClick={() => handleMoveQuestion(qIdx, 'down')}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                  title="تحريك للأسفل ↓"
                  aria-label="تحريك للأسفل"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDuplicateQuestion(qIdx)}
                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                title="نسخ هذا السؤال بكل خياراته"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>نسخ السؤال</span>
              </button>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveQuestion(qIdx)}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                  title="حذف السؤال"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>حذف</span>
                </button>
              )}
            </div>
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
  const [dashboardSection, setDashboardSection] = useState<'qna' | 'results' | 'lessons' | 'national'>('qna');

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
  const [resultCategoryFilter, setResultCategoryFilter] = useState<'all' | 'placement' | 'competition'>('all');
  const [refreshingResults, setRefreshingResults] = useState(false);

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

  async function handleRefreshResults() {
    setRefreshingResults(true);
    try {
      const fresh = await studentResultsClient.getAllResults();
      setResults(fresh);
      showToast('تم تحديث قائمة النتائج بنجاح! 🔄');
    } catch {
      showToast('تعذر تحديث النتائج، يرجى المحاولة لاحقاً');
    } finally {
      setRefreshingResults(false);
    }
  }

  function handleExportResultsCsv() {
    const headers = [
      'اسم الطالبة',
      'التفاصيل / الرصيد',
      'النشاط / الاختبار',
      'الدرجة',
      'الدرجة الكلية',
      'النسبة المئوية',
      'التقدير والحالة',
      'التاريخ',
    ];
    const rows = results.map((r) => [
      `"${r.studentName}"`,
      `"${r.studentGrade || '—'}"`,
      `"${r.activityTitle}"`,
      r.score,
      r.totalQuestions,
      `"${r.percentage}%"`,
      `"${getResultStatus(r.percentage || 0).label}"`,
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

  async function handleDeleteResult(id: string) {
    if (!window.confirm('هل أنتِ متأكدة من حذف هذه النتيجة نهائياً من السجل؟')) return;
    const ok = await studentResultsClient.deleteResult(id);
    if (ok) {
      setResults((prev) => prev.filter((r) => r.id !== id));
      showToast('تم حذف النتيجة من السجل بنجاح! 🗑️');
    }
  }

  function handleExportNationalCsv() {
    const headers = [
      'اسم الطالبة / السفيرة',
      'الصف الدراسي',
      'حلمي للمملكة (Dream)',
      'عهدي وعملي (Promise)',
      'رسالة الفخر (Pride)',
      'إشادة وتوثيق المعلمة',
      'الإعجابات',
      'التاريخ',
    ];
    const rows = nationalEntries.map((e) => {
      const parsed = parseVoiceMessage(e.message);
      return [
        `"${e.name}"`,
        `"${e.role}"`,
        `"${parsed.dream.replace(/"/g, '""')}"`,
        `"${parsed.promise.replace(/"/g, '""')}"`,
        `"${parsed.pride.replace(/"/g, '""')}"`,
        `"${(e.teacherReply || '').replace(/"/g, '""')}"`,
        e.likes,
        `"${new Date(e.createdAt).toLocaleDateString('ar-SA')}"`,
      ];
    });
    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `national_voices_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('تم تصدير سجل أصوات الوطن بصيغة Excel (CSV) بنجاح! 🇸🇦');
  }

  // --- Handlers: Grammar ---
  async function handleSaveTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTopic || !editingTopic.titleAr.trim() || !editingTopic.titleEn.trim()) return;
    const normalized: GrammarTopic = {
      ...editingTopic,
      videoUrl: editingTopic.videoUrl ? toEmbedVideoUrl(editingTopic.videoUrl) : '',
      imageUrl: editingTopic.imageUrl?.trim() || '',
    };
    await customLessonsClient.saveGrammarTopic(normalized);
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

  // --- Media Upload (Audio / Video / Image) ---
  async function handleMediaUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'grammar-video' | 'grammar-image' | 'listening-audio' | 'grammar' | 'listening'
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    setUploadMessage(null);
    try {
      const folder =
        target === 'grammar-image'
          ? 'images'
          : target === 'listening' || target === 'listening-audio'
          ? 'audio'
          : 'videos';
      const res = await uploadMediaToSupabase(file, folder);
      if (res.url) {
        if ((target === 'grammar-video' || target === 'grammar') && editingTopic) {
          setEditingTopic({ ...editingTopic, videoUrl: res.url });
        } else if (target === 'grammar-image' && editingTopic) {
          setEditingTopic({ ...editingTopic, imageUrl: res.url });
        } else if ((target === 'listening-audio' || target === 'listening') && editingListening) {
          setEditingListening({ ...editingListening, mediaUrl: res.url, audioUrl: res.url });
        }
        setUploadMessage('تم رفع الملف بنجاح! ✅');
      } else {
        setUploadMessage(res.error || 'تعذر رفع الملف');
      }
    } finally {
      setUploadingMedia(false);
    }
  }

  const nationalEntries = useMemo(() => {
    return entries.filter((e) => e.topicSlug === 'national-pride');
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Exclude national initiative entries from general Q&A
      if (entry.topicSlug === 'national-pride') return false;

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
    let list = results;
    if (resultCategoryFilter === 'placement') {
      list = list.filter((r) => r.category === 'placement');
    } else if (resultCategoryFilter === 'competition') {
      list = list.filter((r) => r.category === 'million' || r.category === 'speed');
    }

    if (!resultSearch.trim()) return list;
    const q = resultSearch.toLowerCase();
    return list.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.studentGrade.toLowerCase().includes(q) ||
        r.activityTitle.toLowerCase().includes(q)
    );
  }, [results, resultSearch, resultCategoryFilter]);

  const resultStats = useMemo(() => {
    if (results.length === 0) {
      return { totalAttempts: 0, avgPercentage: 0, passedCount: 0, needsSupportCount: 0, highestScore: 0 };
    }
    const totalPercentage = results.reduce((acc, r) => acc + (r.percentage || 0), 0);
    const avgPercentage = Math.round(totalPercentage / results.length);
    const passedCount = results.filter((r) => (r.percentage || 0) >= 60).length;
    const needsSupportCount = results.filter((r) => (r.percentage || 0) < 60).length;
    const highestScore = Math.max(...results.map((r) => r.percentage || 0));
    return {
      totalAttempts: results.length,
      avgPercentage,
      passedCount,
      needsSupportCount,
      highestScore,
    };
  }, [results]);

  const stats = useMemo(() => {
    const questionEntries = entries.filter(
      (e) => Boolean(e.topicSlug) && e.topicSlug !== 'national-pride'
    );
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
            <span>استفسارات الدروس وسجل الزوار ({entries.length - nationalEntries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardSection('national')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
              dashboardSection === 'national'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <SaudiEmblemIcon
              className={`h-4 w-4 ${dashboardSection === 'national' ? 'text-amber-300' : 'text-emerald-700'}`}
            />
            <span>وطن وقيادة · أصوات الوطن ({nationalEntries.length})</span>
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
                  <option value="national-pride">🇸🇦 أصوات تحب الوطن</option>
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
                  توثيق تلقائي لنتائج اختبارات تحديد المستوى والمسابقات مع إمكانية التصفية والتصدير لملف Excel.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRefreshResults}
                  disabled={refreshingResults}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition cursor-pointer"
                  title="تحديث النتائج سحابياً"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshingResults ? 'animate-spin text-indigo-600' : ''}`} />
                  <span>تحديث القائمة 🔄</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportResultsCsv}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>تصدير لملف Excel (CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>طباعة الكشف</span>
                </button>
              </div>
            </div>

            {/* Top Results Metrics Cards (4 Analytical Pillars) */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                <span className="block text-xs font-bold text-indigo-800">إجمالي المحاولات والاختبارات</span>
                <p className="mt-1 text-2xl font-black text-indigo-950">{resultStats.totalAttempts}</p>
                <span className="text-[10px] text-slate-500">عبر جميع الأقسام والمسابقات</span>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <span className="block text-xs font-bold text-emerald-800">متوسط نسبة الإتقان</span>
                <p className="mt-1 text-2xl font-black text-emerald-950">{resultStats.avgPercentage}%</p>
                <span className="text-[10px] text-slate-500">متوسط درجات الطالبات</span>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                <span className="block text-xs font-bold text-sky-800">الطالبات المجتازات (≥ 60%)</span>
                <p className="mt-1 text-2xl font-black text-sky-950">{resultStats.passedCount}</p>
                <span className="text-[10px] text-slate-500">إتقان واجتياز ناجح</span>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                <span className="block text-xs font-bold text-amber-800">بحاجة لدعم ومراجعة (&lt; 60%)</span>
                <p className="mt-1 text-2xl font-black text-amber-950">{resultStats.needsSupportCount}</p>
                <span className="text-[10px] text-slate-500">تتطلب خطة دعم ومتابعة</span>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
                <button
                  type="button"
                  onClick={() => setResultCategoryFilter('all')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer ${
                    resultCategoryFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  الكل ({results.length})
                </button>
                <button
                  type="button"
                  onClick={() => setResultCategoryFilter('placement')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer ${
                    resultCategoryFilter === 'placement'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  تحديد المستوى ({results.filter((r) => r.category === 'placement').length})
                </button>
                <button
                  type="button"
                  onClick={() => setResultCategoryFilter('competition')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer ${
                    resultCategoryFilter === 'competition'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  التحديات والمسابقات (
                  {results.filter((r) => r.category === 'million' || r.category === 'speed').length})
                </button>
              </div>

              <div className="relative max-w-sm w-full">
                <input
                  type="text"
                  value={resultSearch}
                  onChange={(e) => setResultSearch(e.target.value)}
                  placeholder="ابحثي باسم الطالبة أو الصف..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs font-bold"
                />
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-black">
                    <th className="p-3">اسم الطالبة</th>
                    <th className="p-3">التفاصيل / الرصيد</th>
                    <th className="p-3">الاختبار / النشاط</th>
                    <th className="p-3">الدرجة</th>
                    <th className="p-3">النسبة</th>
                    <th className="p-3">التقدير والحالة</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        لا توجد نتائج مسجلة حتى الآن
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((r) => {
                      const status = getResultStatus(r.percentage || 0);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="p-3 font-black text-slate-900">{r.studentName}</td>
                          <td className="p-3 font-semibold text-slate-700">{r.studentGrade || '—'}</td>
                          <td className="p-3 font-bold text-indigo-900">{r.activityTitle}</td>
                          <td className="p-3 font-mono font-bold" dir="ltr">
                            {r.score} / {r.totalQuestions}
                          </td>
                          <td className="p-3">
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-black text-slate-800">
                              {r.percentage}%
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-black ${status.badgeClass}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-slate-400">{formatTimeAgo(r.createdAt)}</td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteResult(r.id)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                              title="حذف النتيجة من السجل"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* =============================================================== */}
        {/* SECTION 4: NATIONAL INITIATIVE & VOICES OF SAUDI PRIDE         */}
        {/* =============================================================== */}
        {dashboardSection === 'national' && (
          <section className="rounded-3xl border border-emerald-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <SaudiEmblemIcon className="h-6 w-6 text-emerald-700" />
                  <h2 className="text-lg sm:text-xl font-black text-slate-950">
                    مبادرة في القلب وطن وقيادة · أصوات سفيرات الوطن
                  </h2>
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  متابعة رسائل العهد وأحلام الطالبات لمستقبل المملكة مع إمكانية إضافة إشادة وتوثيق المعلمة المعتمد.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportNationalCsv}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-emerald-800 transition"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>تصدير أصوات الوطن Excel (CSV)</span>
                </button>
                <Link
                  to="/national-journey"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition"
                >
                  <SaudiEmblemIcon className="h-3.5 w-3.5 text-emerald-700" />
                  <span>معاينة صفحة المبادرة</span>
                </Link>
              </div>
            </div>

            {/* Metric Cards for National Pride */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4">
                <span className="block text-xs font-bold text-emerald-800">إجمالي سفيرات الوطن المشاركات</span>
                <p className="mt-1 text-2xl font-black text-emerald-950">{nationalEntries.length}</p>
                <span className="text-[10px] text-slate-500">رسائل عهد وأحلام موثقة</span>
              </div>
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4">
                <span className="block text-xs font-bold text-amber-800">مشاركات بإشادة وتوثيق المعلمة</span>
                <p className="mt-1 text-2xl font-black text-amber-950">
                  {nationalEntries.filter((e) => Boolean(e.teacherReply)).length}
                </p>
                <span className="text-[10px] text-slate-500">تحفيز ودعم معتمد منشور</span>
              </div>
              <div className="rounded-2xl border border-teal-200/80 bg-teal-50/60 p-4">
                <span className="block text-xs font-bold text-teal-800">إجمالي تفاعلات الإعجاب</span>
                <p className="mt-1 text-2xl font-black text-teal-950">
                  {nationalEntries.reduce((acc, e) => acc + (e.likes || 0), 0)}
                </p>
                <span className="text-[10px] text-slate-500">إعجابات بالرسائل الوطنية</span>
              </div>
            </div>

            {/* List of National Entries with 3 Axes */}
            {nationalEntries.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center text-xs font-bold text-slate-500">
                لا توجد مشاركات مسجلة في مبادرة الوطن حتى الآن.
              </div>
            ) : (
              <div className="space-y-4">
                {nationalEntries.map((entry) => {
                  const parsed = parseVoiceMessage(entry.message);
                  const isReplying = activeReplyId === entry.id;

                  return (
                    <article
                      key={entry.id}
                      className="rounded-2xl border border-emerald-200/90 bg-white p-4 sm:p-5 shadow-xs transition hover:border-emerald-400"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 gap-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-800 text-amber-300 font-black text-sm">
                            {entry.name.slice(0, 1)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-black text-slate-950">{entry.name}</h3>
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                                سفيرة الوطن
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-slate-500">
                              {entry.role} • {formatTimeAgo(entry.createdAt)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => {
                              if (isReplying) {
                                setActiveReplyId(null);
                                setReplyText('');
                              } else {
                                setActiveReplyId(entry.id);
                                setReplyText(entry.teacherReply || '');
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-black text-amber-900 hover:bg-amber-100 transition"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                            <span>
                              {entry.teacherReply
                                ? 'تعديل إشادة المعلمة ✨'
                                : 'إضافة إشادة وتوثيق المعلمة ✨'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(entry)}
                            className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-600 hover:bg-rose-100 transition"
                            title="حذف المشاركة"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 3 Axes Breakdown */}
                      <div className="mt-3.5 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-left" dir="ltr">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                          <span className="block text-[10px] font-black text-emerald-900 uppercase">
                            🌟 01. My Dream for Saudi Arabia
                          </span>
                          <p className="mt-1 text-xs font-bold text-slate-800 leading-relaxed">
                            {parsed.dream || '—'}
                          </p>
                        </div>

                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                          <span className="block text-[10px] font-black text-amber-900 uppercase">
                            🤝 02. My Promise in Action
                          </span>
                          <p className="mt-1 text-xs font-bold text-slate-800 leading-relaxed">
                            {parsed.promise || '—'}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <span className="flex items-center gap-1 text-[10px] font-black text-slate-800 uppercase">
                            <SaudiEmblemIcon className="h-3 w-3 text-emerald-700" />
                            <span>03. Message of Pride</span>
                          </span>
                          <p className="mt-1 text-xs font-bold text-slate-800 leading-relaxed">
                            {parsed.pride || '—'}
                          </p>
                        </div>
                      </div>

                      {/* Existing Teacher Commendation */}
                      {entry.teacherReply && !isReplying && (
                        <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-right">
                          <span className="block text-xs font-black text-emerald-900">
                            ✨ إشادة وتوثيق المعلمة ({TEACHER_OFFICIAL_NAME}):
                          </span>
                          <p className="mt-1 text-xs font-bold text-slate-800">
                            {entry.teacherReply}
                          </p>
                        </div>
                      )}

                      {/* Reply Editor Form */}
                      {isReplying && (
                        <div className="mt-3 rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-3.5 sm:p-4 text-right animate-page-enter">
                          <label className="block text-xs font-black text-amber-950 mb-1.5">
                            كتابة إشادة وتوثيق المعلمة المعتمد للطالبة (يظهر فوراً على جدار الوطن والشهادة):
                          </label>
                          <textarea
                            rows={2}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="مثال: فخورة بكِ يا بطلتي الغالية وبكلماتكِ المضيئة لوطننا الغالي! بارك الله في همتكِ ونفع بكِ."
                            className="w-full rounded-xl border border-amber-300 bg-white p-3 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                          />
                          <div className="mt-2.5 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveReplyId(null);
                                setReplyText('');
                              }}
                              className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReplySubmit(entry)}
                              disabled={submittingReply || !replyText.trim()}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-emerald-800 transition disabled:opacity-50"
                            >
                              <Send className="h-3.5 w-3.5 rotate-180" />
                              <span>اعتماد ونشر الإشادة للطالبة</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
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
                            imageUrl: '',
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

                    {/* Optional Infographic Card Image */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <ImageIcon className="h-4 w-4 text-violet-600" />
                          <span>صورة بطاقة القاعدة (إنفوجرافيك اختياري)</span>
                        </label>
                        <span className="text-[11px] text-slate-500 font-medium">
                          اتركيها فارغة إذا لم تكن هناك بطاقة مصممة للقاعدة
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          dir="ltr"
                          value={editingTopic.imageUrl || ''}
                          onChange={(e) => setEditingTopic({ ...editingTopic, imageUrl: e.target.value })}
                          placeholder="https://... أو /content/grammar/... (اختياري)"
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
                        />
                        <label className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100 cursor-pointer transition shrink-0">
                          <Upload className="h-3.5 w-3.5" />
                          <span>{uploadingMedia ? 'جاري الرفع...' : 'رفع صورة بطاقة'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="hidden"
                            disabled={uploadingMedia}
                            onChange={(e) => handleMediaUpload(e, 'grammar-image')}
                          />
                        </label>
                      </div>

                      {editingTopic.imageUrl?.trim() ? (
                        <div className="flex items-center gap-3 rounded-xl border border-violet-100 bg-white p-2.5">
                          <img
                            src={editingTopic.imageUrl}
                            alt="معاينة بطاقة القاعدة"
                            className="h-16 w-24 rounded-lg border border-slate-200 object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate" dir="ltr">
                              {editingTopic.imageUrl}
                            </p>
                            <p className="text-[11px] text-emerald-600 font-bold">
                              ستظهر هذه البطاقة أعلى صفحة الدرس مع إمكانية التكبير
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingTopic({ ...editingTopic, imageUrl: '' })}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>إزالة الصورة</span>
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 font-medium">
                          💡 لن تظهر أي بطاقة عشوائية أو سابقة عند ترك هذا الحقل فارغاً.
                        </p>
                      )}
                    </div>

                    {/* Video URL & Upload with Live Preview */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Video className="h-4 w-4 text-violet-600" />
                          <span>رابط الفيديو التعليمي أو الإثرائي (اختياري)</span>
                        </label>
                        <span className="text-[11px] text-slate-500 font-medium">
                          يدعم روابط YouTube العادية والمباشرة
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          dir="ltr"
                          value={editingTopic.videoUrl || ''}
                          onChange={(e) => setEditingTopic({ ...editingTopic, videoUrl: e.target.value })}
                          onBlur={(e) => {
                            const trimmed = e.target.value.trim();
                            if (trimmed) {
                              setEditingTopic({ ...editingTopic, videoUrl: toEmbedVideoUrl(trimmed) });
                            }
                          }}
                          placeholder="https://www.youtube.com/watch?v=... أو https://youtu.be/... أو MP4"
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
                        />
                        <label className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100 cursor-pointer transition shrink-0">
                          <Upload className="h-3.5 w-3.5" />
                          <span>{uploadingMedia ? 'جاري الرفع...' : 'رفع مقطع MP4'}</span>
                          <input
                            type="file"
                            accept="video/mp4,video/*"
                            className="hidden"
                            disabled={uploadingMedia}
                            onChange={(e) => handleMediaUpload(e, 'grammar-video')}
                          />
                        </label>
                      </div>

                      {uploadMessage && (
                        <p className="text-xs font-bold text-violet-800 pt-1">{uploadMessage}</p>
                      )}

                      {editingTopic.videoUrl?.trim() ? (
                        <div className="mt-2 space-y-2 rounded-xl border border-violet-100 bg-white p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-violet-900 flex items-center gap-1">
                              <Video className="h-3.5 w-3.5 text-violet-600" />
                              معاينة مشغل الفيديو المباشرة في الدرس:
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingTopic({ ...editingTopic, videoUrl: '' })}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                            >
                              <X className="h-3 w-3" />
                              <span>إزالة الفيديو</span>
                            </button>
                          </div>
                          <div className="max-w-md mx-auto overflow-hidden rounded-xl border border-slate-200 shadow-xs">
                            <PortalVideoPlayer
                              src={editingTopic.videoUrl}
                              title={editingTopic.titleAr || 'معاينة الفيديو'}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 font-medium">
                          💡 يمكنكِ لصق أي رابط يوتيوب عادي وسيتكفل النظام بتهيئته تلقائياً ليعمل بسلاسة وبدون شاشة سوداء.
                        </p>
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

      </main>

      <PortalFooter />
    </div>
  );
}
