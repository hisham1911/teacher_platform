import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import {
  GraduationCap,
  Award,
  RotateCcw,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Sparkles,
  Clock,
  Printer,
  BookOpen,
  Trophy,
  ShieldCheck,
  ChevronLeft,
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import {
  PLACEMENT_LEVELS_META,
  getQuestionsForLevel,
  type PlacementQuestionItem,
  type SkillCategory,
} from '../../data/content/placement-data';
import { TEACHER_OFFICIAL_NAME } from '../../data/api-client/guestbook-client';

type Stage = 'select-level' | 'testing' | 'result';
type LevelChoiceId = 'comprehensive' | 'level-1' | 'level-2' | 'level-3';

const GRADE_OPTIONS = [
  'طالبة — الصف الأول متوسط',
  'طالبة — الصف الثاني متوسط',
  'طالبة — الصف الثالث متوسط',
  'طالبة — المرحلة الثانوية (الصف الأول)',
  'طالبة — المرحلة الثانوية (الصف الثاني)',
  'طالبة — المرحلة الثانوية (الصف الثالث)',
  'طالب — زائر',
  'ولي أمر',
  'معلمـ/ـة أو مهتمـ/ـة باللغة',
  'أخرى / زائر كريم',
];

function getParticipantPrefix(role: string = ''): string {
  if (role.startsWith('طالبة')) return 'الطالبة الكريمة:';
  if (role.startsWith('طالب')) return 'الطالب الكريم:';
  if (role.includes('ولي أمر')) return 'ولي الأمر الكريم:';
  if (role.includes('معلم')) return 'المعلمـ/ـة:';
  return 'المشاركـ/ـة الكريمـ/ـة:';
}

function getParticipantEnrollment(role: string = ''): string {
  if (role.startsWith('طالبة')) return `المقيدة في (${role})`;
  if (role.startsWith('طالب')) return `المقيد في (${role})`;
  if (role.includes('ولي أمر')) return `المشارك بصفة (${role})`;
  return `المسجلـ/ـة بصفة (${role})`;
}

export default function PlacementTestPage() {
  const [stage, setStage] = useState<Stage>('select-level');
  const [selectedLevelId, setSelectedLevelId] = useState<LevelChoiceId>('comprehensive');
  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState<string>(GRADE_OPTIONS[0] ?? 'طالبة — الصف الأول متوسط');

  // Testing stage state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({}); // index -> optionId
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Active question set
  const questions: PlacementQuestionItem[] = useMemo(() => {
    return getQuestionsForLevel(selectedLevelId);
  }, [selectedLevelId]);

  const activeLevelMeta = useMemo(() => {
    return (
      PLACEMENT_LEVELS_META.find((m) => m.id === selectedLevelId) ?? PLACEMENT_LEVELS_META[0]!
    );
  }, [selectedLevelId]);

  const totalQuestions = questions.length;
  const currentQ = questions[currentIndex];

  function handleStartTest(levelId?: LevelChoiceId) {
    if (studentName.trim().length < 2) return;
    if (levelId) {
      setSelectedLevelId(levelId);
    }
    setStage('testing');
    setCurrentIndex(0);
    setUserAnswers({});
    setSelectedOptionId(null);
    setStartTime(Date.now());
  }

  function handleNextQuestion() {
    if (!selectedOptionId) return;
    const updated = { ...userAnswers, [currentIndex]: selectedOptionId };
    setUserAnswers(updated);
    setSelectedOptionId(null);

    if (currentIndex + 1 < totalQuestions) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      if (startTime) {
        setElapsedSeconds(Math.round((Date.now() - startTime) / 1000));
      }
      setStage('result');
    }
  }

  function handlePreviousQuestion() {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setSelectedOptionId(userAnswers[prevIdx] ?? null);
    }
  }

  function handleRestart() {
    setStage('select-level');
    setCurrentIndex(0);
    setUserAnswers({});
    setSelectedOptionId(null);
    setStartTime(null);
  }

  // Calculate scores and breakdowns
  const resultData = useMemo(() => {
    let correctCount = 0;
    const skillStats: Record<SkillCategory, { correct: number; total: number }> = {
      grammar: { correct: 0, total: 0 },
      vocabulary: { correct: 0, total: 0 },
      knowledge: { correct: 0, total: 0 },
      'life-skills': { correct: 0, total: 0 },
    };

    questions.forEach((q, idx) => {
      const pickedId = userAnswers[idx];
      const correctOption = q.options.find((o) => o.isCorrect);
      skillStats[q.skill].total += 1;

      if (pickedId && pickedId === correctOption?.id) {
        correctCount += 1;
        skillStats[q.skill].correct += 1;
      }
    });

    const percent = Math.round((correctCount / totalQuestions) * 100);

    // CEFR & Level Determination
    let cefrCode = 'A1';
    let cefrTitle = 'A1 — تأسيسي ومبتدئ (Beginner)';
    let levelBadgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    let summaryAr =
      'أداء تأسيسي في استيعاب المفردات والقواعد الأساسية. يُنصح بمتابعة بطاقات القواعد المصورة لتثبيت الأزمنة البسيطة وحل تمارين المحادثة اليومية.';

    if (selectedLevelId === 'comprehensive') {
      if (correctCount >= 21) {
        cefrCode = 'B2';
        cefrTitle = 'B2 — متقدم ومتمكن (Upper Intermediate)';
        levelBadgeColor = 'bg-purple-50 text-purple-800 border-purple-300';
        summaryAr =
          'مستوى ممتاز واستثنائي! حصيلة لغوية رفيعة واستيعاب عالٍ للتراكيب المعقدة ومهارات التفكير الناقد والجاهزية للاختبارات الدولية والمتقدمة.';
      } else if (correctCount >= 16) {
        cefrCode = 'B1';
        cefrTitle = 'B1 — متوسط متمكن (Intermediate)';
        levelBadgeColor = 'bg-blue-50 text-blue-800 border-blue-300';
        summaryAr =
          'مستوى متوسط وجيد جداً! فهم متقن للجمل والأزمنة المركبة ومفردات الحياة اليومية. يُنصح بالاستمرار في قراءة النصوص وتحديات السرعة.';
      } else if (correctCount >= 10) {
        cefrCode = 'A2';
        cefrTitle = 'A2 — فوق المبتدئ (Elementary)';
        levelBadgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
        summaryAr =
          'أساسيات جيدة، مع الحاجة لتثبيت تراكيب الجمل وصيغ الأزمنة. قسم القواعد النحوية وتمارين الكتابة الموجهة سيعززان المستوى سريعاً.';
      }
    } else if (selectedLevelId === 'level-1') {
      if (percent >= 85) {
        cefrCode = 'A1+';
        cefrTitle = 'إتقان تام للأساسيات (Mastery of Basics)';
        levelBadgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
        summaryAr =
          'إتقان تام لأسئلة المحادثة، الألوان، الأرقام، والضمائر وأفعال Be بشكل كامل. الجاهزية ممتازة للانتقال إلى المستوى الثاني (المتوسط).';
      } else if (percent >= 60) {
        cefrCode = 'A1';
        cefrTitle = 'مستوى تأسيسي جيد (Good Foundation)';
        levelBadgeColor = 'bg-teal-50 text-teal-800 border-teal-300';
        summaryAr =
          'استيعاب طيب للأساسيات، مع الحاجة لمراجعة بعض أفعال (am / is / are) وتصنيفات الكلمات.';
      } else {
        cefrCode = 'Beginner';
        cefrTitle = 'بحاجة لتعزيز الأساسيات (Needs Support)';
        levelBadgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
        summaryAr =
          'يُنصح بمراجعة درس المضارع البسيط والبطاقات المصورة لتثبيت نطق وكتابة الكلمات اليومية.';
      }
    } else if (selectedLevelId === 'level-2') {
      if (percent >= 85) {
        cefrCode = 'B1';
        cefrTitle = 'مستوى متوسط متفوق (Advanced Intermediate)';
        levelBadgeColor = 'bg-blue-50 text-blue-800 border-blue-300';
        summaryAr =
          'نتيجة باهرة وتمكن عالٍ في الأزمنة وصيغ المقارنة ومعلومات المملكة العامة. الجاهزية ممتازة لخوض تحدي المستوى الثالث.';
      } else if (percent >= 60) {
        cefrCode = 'A2+';
        cefrTitle = 'مستوى متوسط واعد (Promising Intermediate)';
        levelBadgeColor = 'bg-indigo-50 text-indigo-800 border-indigo-300';
        summaryAr =
          'أداء جيد جداً وفهم سليم لقواعد الأزمنة، مع التوصية بالتدرب أكثر على الماضي المستمر والمضارع التام.';
      } else {
        cefrCode = 'A2';
        cefrTitle = 'بحاجة لمراجعة القواعد (Grammar Reinforcement)';
        levelBadgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
        summaryAr =
          'يُنصح بمراجعة بطاقات الأزمنة (الماضي البسيط والمستمر) وقواعد المقارنة لتعزيز الحصيلة اللغوية.';
      }
    } else {
      // Level 3
      if (percent >= 85) {
        cefrCode = 'B2';
        cefrTitle = 'مستوى ثانوي متقدم (High Proficiency B2)';
        levelBadgeColor = 'bg-purple-50 text-purple-800 border-purple-300';
        summaryAr =
          'إتقان متميز للقواعد المتقدمة (Passive, Conditionals) ووعي رائع بالمواطنة الرقمية والذكاء الاصطناعي ومهارات العمل والقرارات!';
      } else if (percent >= 60) {
        cefrCode = 'B1+';
        cefrTitle = 'مستوى ثانوي جيد جداً (Solid Secondary B1+)';
        levelBadgeColor = 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-300';
        summaryAr =
          'أداء ممتاز! مهارات التفكير الناقد واللغة قوية، مع التوصية بتدريبات إضافية في الجمل الشرطية والمبني للمجهول.';
      } else {
        cefrCode = 'B1';
        cefrTitle = 'بحاجة لتعزيز التراكيب المتقدمة';
        levelBadgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
        summaryAr =
          'يُنصح بالتركيز على قواعد المرحلة الثانوية وقراءة المقالات المتقدمة في قسم القراءة.';
      }
    }

    return {
      correctCount,
      percent,
      cefrCode,
      cefrTitle,
      levelBadgeColor,
      summaryAr,
      skillStats,
    };
  }, [questions, userAnswers, totalQuestions, selectedLevelId]);

  function handlePrintCertificate() {
    window.print();
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-slate-50/50 print:bg-white" dir="rtl">
      <div className="print:hidden">
        <PublicBackdrop />
        <PortalNav />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-20 pt-6 sm:pt-10 print:p-0 print:max-w-none">
        {/* Breadcrumb Navigation */}
        <div className="mb-5 flex items-center gap-1.5 text-xs font-bold text-slate-500 print:hidden">
          <Link to="/competitions" className="hover:text-violet-700 transition">
            المسابقات والتقييم
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-violet-700 font-black">اختبار تحديد المستوى والتشخيص اللغوي</span>
        </div>

        {/* ================================================================= */}
        {/* STAGE 1: LEVEL SELECTION HUB */}
        {/* ================================================================= */}
        {stage === 'select-level' && (
          <div className="space-y-8 animate-page-enter">
            {/* Hero Header */}
            <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-white/95 to-indigo-50/30 p-6 sm:p-10 shadow-xs backdrop-blur-xl ring-1 ring-slate-900/5 text-center">
              <span className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white shadow-xl shadow-indigo-600/25">
                <GraduationCap className="h-8 w-8 sm:h-10 sm:w-10" />
              </span>

              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-100/80 px-3.5 py-1 text-xs font-black text-indigo-900">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span>ENGLISH LEVEL PLACEMENT & DIAGNOSTIC SYSTEM</span>
              </div>

              <h1 className="mt-3 text-2xl sm:text-4xl font-black text-slate-950">
                اختبار تحديد المستوى والتشخيص اللغوي
              </h1>
              <p className="mx-auto mt-2.5 max-w-2xl text-xs sm:text-sm font-semibold leading-relaxed text-slate-600">
                منصة معتمدة وموجهة لطالبات مدرسة متوسطة وثانوية الجرادية بإشراف المعلمة{' '}
                <span className="font-black text-indigo-900">{TEACHER_OFFICIAL_NAME}</span>.
                اختاري مستواكِ المناسب أو خوضي التقييم الشامل للحصول على تقرير أداء وشهادة تشخيصية رقمية.
              </p>

              {/* Participant Identity Inputs */}
              <div className="mx-auto mt-7 max-w-xl rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-6 text-right">
                <h2 className="text-xs sm:text-sm font-black text-indigo-950 mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  <span>بيانات المشاركـ/ـة للشهادة والتقرير:</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="student-name-input" className="block text-xs font-bold text-slate-700 mb-1">
                      اسم الكريم <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="student-name-input"
                      type="text"
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="مثال: رغد إبراهيم / هشام محمد"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-200 transition"
                    />
                  </div>

                  <div>
                    <label htmlFor="student-grade-select" className="block text-xs font-bold text-slate-700 mb-1">
                      الصف / الصفة
                    </label>
                    <select
                      id="student-grade-select"
                      value={studentGrade}
                      onChange={(e) => setStudentGrade(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-200 transition"
                    >
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {studentName.trim().length < 2 && (
                  <p className="mt-2 text-[11px] font-semibold text-indigo-700">
                    * يرجى إدخال الاسم لتفعيل أزرار بدء الاختبار وإصدار الشهادة.
                  </p>
                )}
              </div>
            </div>

            {/* Level Choices Grid */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900">
                    اختاري مسار التقييم المناسب لكِ
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    يمكنكِ خوض التشخيص المتدرج أو اختيار المستوى الذي تدرسينه مباشرة
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {PLACEMENT_LEVELS_META.map((lvl) => {
                  const isSelected = selectedLevelId === lvl.id;
                  const isReady = studentName.trim().length >= 2;

                  return (
                    <div
                      key={lvl.id}
                      className={`group relative flex flex-col justify-between rounded-3xl border-2 p-5 sm:p-6 transition-all duration-200 shadow-xs backdrop-blur-xl ${
                        isSelected
                          ? 'border-indigo-600 bg-white ring-4 ring-indigo-100 shadow-md'
                          : 'border-slate-200/80 bg-white/95 hover:border-indigo-300 hover:shadow-md'
                      }`}
                    >
                      <div>
                        {/* Card Top Row: Badge & Metadata Pills */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-black ${lvl.badgeColor}`}
                          >
                            {lvl.badge}
                          </span>

                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                            <span className="whitespace-nowrap inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3 py-1 text-xs font-bold text-slate-700">
                              <BookOpen className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                              <span>{lvl.questionCount} سؤالاً</span>
                            </span>
                            <span className="whitespace-nowrap inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 px-3 py-1 text-xs font-bold text-slate-600">
                              <Clock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <span>{lvl.durationMinutes} دقيقة</span>
                            </span>
                          </div>
                        </div>

                        {/* Title & Icon */}
                        <div className="mt-4 flex items-start gap-3.5">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50/80 text-2xl border border-indigo-100/80 group-hover:scale-105 transition-transform duration-200">
                            {lvl.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-black text-slate-950 leading-tight">
                              {lvl.titleAr}
                            </h3>
                            <p className="mt-1 text-xs font-semibold text-slate-400 font-sans tracking-wide" dir="ltr">
                              {lvl.titleEn}
                            </p>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="mt-3 text-xs sm:text-sm font-medium leading-relaxed text-slate-600">
                          {lvl.description}
                        </p>

                        {/* Audience Pill */}
                        <div className="mt-3.5 rounded-xl bg-slate-50 p-2.5 sm:p-3 text-xs font-semibold text-slate-700 border border-slate-200/60 flex items-start gap-2">
                          <span className="inline-flex items-center gap-1 font-black text-slate-900 shrink-0">
                            <GraduationCap className="h-4 w-4 text-indigo-600 shrink-0" />
                            الفئة المستهدفة:
                          </span>
                          <span className="text-slate-600 leading-normal">{lvl.targetAudience}</span>
                        </div>

                        {/* Topics Covered */}
                        <div className="mt-4 rounded-2xl bg-indigo-50/30 p-3 sm:p-3.5 border border-indigo-100/50">
                          <span className="text-[11px] font-extrabold text-indigo-950 block mb-2">
                            المحاور التعليمية المغطاة:
                          </span>
                          <ul className="space-y-1.5 text-xs font-bold text-slate-700">
                            {lvl.topicsCovered.map((topic, tIdx) => (
                              <li key={tIdx} className="flex items-start gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                                <span className="leading-snug break-words" dir="auto">{topic}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-6 border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLevelId(lvl.id);
                            if (isReady) {
                              handleStartTest(lvl.id);
                            }
                          }}
                          disabled={!isReady}
                          className={`group/btn w-full flex items-center justify-center gap-2 rounded-2xl py-3 px-4 text-xs sm:text-sm font-black transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700'
                              : 'bg-slate-100 text-slate-800 hover:bg-indigo-50 hover:text-indigo-800'
                          }`}
                        >
                          <span>ابدأ تقييم {lvl.titleAr}</span>
                          <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover/btn:-translate-x-1" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STAGE 2: INTERACTIVE TESTING SCREEN */}
        {/* ================================================================= */}
        {stage === 'testing' && currentQ && (
          <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-5 sm:p-9 shadow-sm backdrop-blur-xl animate-page-enter">
            {/* Top Navigation & Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-800 border border-indigo-200/60">
                  السؤال {currentIndex + 1} من {totalQuestions}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                  {activeLevelMeta.titleAr}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">
                  الطالبة: <span className="font-black text-slate-900">{studentName}</span> ({studentGrade})
                </span>
              </div>
            </div>

            {/* Glowing Progress Bar */}
            <div className="mt-4 mb-6">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1.5">
                <span>التقدم في التقييم</span>
                <span>{Math.round(((currentIndex + 1) / totalQuestions) * 100)}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-600 to-purple-600 transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
                />
              </div>
            </div>

            {/* Question Section Badge */}
            <div className="mb-3">
              <span className="inline-block rounded-lg bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-900 border border-indigo-100">
                {currentQ.sectionTitle}
              </span>
            </div>

            {/* Question Prompt */}
            <div className="rounded-2xl bg-slate-50/70 p-5 border border-slate-100">
              <p
                className="text-base sm:text-xl font-bold leading-relaxed text-slate-950 select-text"
                dir="ltr"
              >
                {currentQ.prompt}
              </p>
            </div>

            {/* Options List */}
            <div className="mt-6 flex flex-col gap-3">
              {currentQ.options.map((opt, oIdx) => {
                const isSelected = selectedOptionId === opt.id;
                const letter = String.fromCharCode(65 + oIdx);

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedOptionId(opt.id)}
                    className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3.5 sm:px-5 sm:py-4 text-right transition active:scale-[0.99] min-h-[56px] ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 font-black text-indigo-950 shadow-xs ring-2 ring-indigo-200'
                        : 'border-slate-200/80 bg-white hover:border-indigo-300 hover:bg-slate-50 font-bold text-slate-800'
                    }`}
                    dir="ltr"
                  >
                    <span className="text-left text-sm sm:text-base font-semibold leading-relaxed flex-1 mr-3">
                      {opt.text}
                    </span>
                    <span
                      className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black transition ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-800'
                      }`}
                    >
                      {letter}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Actions Bar */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {currentIndex > 0 && (
                  <button
                    type="button"
                    onClick={handlePreviousQuestion}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span>السؤال السابق</span>
                  </button>
                )}
                <span className="text-xs font-bold text-slate-400">
                  سؤال {currentIndex + 1} من {totalQuestions}
                </span>
              </div>

              <button
                type="button"
                onClick={handleNextQuestion}
                disabled={!selectedOptionId}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-8 py-3 text-xs sm:text-sm font-black text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-95 disabled:opacity-40"
              >
                <span>
                  {currentIndex + 1 === totalQuestions
                    ? 'إنهاء التقييم وعرض النتيجة'
                    : 'تأكيد والانتقال للسؤال التالي'}
                </span>
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STAGE 3: COMPREHENSIVE RESULT & DIGITAL CERTIFICATE */}
        {/* ================================================================= */}
        {stage === 'result' && (
          <div className="space-y-8 animate-page-enter">
            {/* Header Result Card */}
            <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 sm:p-10 shadow-xs text-center backdrop-blur-xl">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 text-white shadow-xl shadow-indigo-600/25">
                <Trophy className="h-10 w-10" />
              </span>

              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3.5 py-1 text-xs font-black text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>اكتمل التقييم بنجاح</span>
              </span>

              <h1 className="mt-3 text-2xl sm:text-4xl font-black text-slate-950">
                تقرير تشخيص المستوى: {studentName}
              </h1>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-500">
                {studentGrade} • مدرسة متوسطة وثانوية الجرادية • إشراف أ. {TEACHER_OFFICIAL_NAME}
              </p>

              {/* CEFR Level Badge */}
              <div
                className={`mx-auto mt-5 inline-flex items-center gap-2.5 rounded-2xl border px-6 py-2.5 text-sm sm:text-lg font-black ${resultData.levelBadgeColor}`}
              >
                <Award className="h-5 w-5" />
                <span>المستوى المُقدَّر: {resultData.cefrTitle}</span>
              </div>

              {/* Numerical Score */}
              <div className="mt-5 text-3xl sm:text-5xl font-black text-slate-950">
                {resultData.correctCount}{' '}
                <span className="text-base sm:text-xl text-slate-400 font-bold">
                  من {totalQuestions} أسئلة
                </span>
                <span className="mr-3 text-lg sm:text-2xl font-black text-indigo-600">
                  ({resultData.percent}%)
                </span>
              </div>

              {/* Summary Description */}
              <p className="mx-auto mt-4 max-w-2xl text-xs sm:text-sm font-semibold leading-relaxed text-slate-600">
                {resultData.summaryAr}
              </p>

              {/* Actions Bar */}
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3 print:hidden">
                <button
                  type="button"
                  onClick={handlePrintCertificate}
                  className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-xs sm:text-sm font-black text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition"
                >
                  <Printer className="h-4 w-4" />
                  <span>طباعة / حفظ الشهادة الرقمية</span>
                </button>

                <button
                  type="button"
                  onClick={handleRestart}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-xs sm:text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>خوض مستوى آخر</span>
                </button>

                <Link
                  to="/grammar"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-5 py-3 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-200 transition"
                >
                  <span>استكشاف بطاقات القواعد</span>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* ============================================================= */}
            {/* OFFICIAL DIGITAL CERTIFICATE CARD */}
            {/* ============================================================= */}
            <div className="overflow-hidden rounded-3xl border-4 border-indigo-200 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/30 p-6 sm:p-10 shadow-lg text-center relative ring-1 ring-slate-900/5 print:border-2 print:shadow-none">
              <div className="absolute top-4 right-4 text-xs font-black text-indigo-700 border border-indigo-200 bg-white/80 px-3 py-1 rounded-full">
                English Spark Official Assessment
              </div>
              <div className="absolute top-4 left-4 text-[10px] font-bold text-slate-400">
                كود التحقق: SPARK-PL-{Date.now().toString(36).toUpperCase().slice(-6)}
              </div>

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md mb-3">
                <GraduationCap className="h-9 w-9" />
              </div>

              <span className="text-xs font-black tracking-widest text-indigo-900 uppercase">
                المملكة العربية السعودية • وزارة التعليم
              </span>
              <h2 className="text-xl sm:text-3xl font-black text-slate-950 mt-1">
                شهادة إتمام اختبار تحديد المستوى في اللغة الإنجليزية
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                مدرسة متوسطة وثانوية الجرادية — منصة المعلمة {TEACHER_OFFICIAL_NAME}
              </p>

              <div className="my-6 border-y border-dashed border-indigo-200 py-6 max-w-2xl mx-auto">
                <p className="text-xs sm:text-sm font-medium text-slate-600">
                  تشهد المنصة بأن {getParticipantPrefix(studentGrade)}
                </p>
                <h3 className="text-xl sm:text-3xl font-black text-indigo-950 mt-1 mb-2">
                  {studentName}
                </h3>
                <p className="text-xs sm:text-sm font-semibold text-slate-700">
                  {getParticipantEnrollment(studentGrade)} قد أتمـ/ـت بنجاح تقييم{' '}
                  <span className="font-black text-indigo-900">({activeLevelMeta.titleAr})</span> وحصلـ/ـت على تقدير:
                </p>
                <div className="mt-3 inline-block rounded-xl bg-indigo-100/90 px-4 py-1.5 text-sm sm:text-base font-black text-indigo-950">
                  {resultData.cefrTitle} بنسبة إتقان {resultData.percent}%
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-2xl mx-auto text-xs font-bold text-slate-600">
                <div className="rounded-xl bg-white/80 p-2.5 border border-slate-100">
                  <span className="block text-[10px] text-slate-400">تاريخ التقييم</span>
                  <span>{new Date().toLocaleDateString('ar-SA')}</span>
                </div>
                <div className="rounded-xl bg-white/80 p-2.5 border border-slate-100">
                  <span className="block text-[10px] text-slate-400">الدرجة المكتسبة</span>
                  <span>
                    {resultData.correctCount} من {totalQuestions}
                  </span>
                </div>
                <div className="rounded-xl bg-white/80 p-2.5 border border-slate-100">
                  <span className="block text-[10px] text-slate-400">المدة المستغرقة</span>
                  <span>
                    {Math.max(1, Math.round(elapsedSeconds / 60))} دقيقة
                  </span>
                </div>
                <div className="rounded-xl bg-white/80 p-2.5 border border-slate-100">
                  <span className="block text-[10px] text-slate-400">معلمة المادة المشرفة</span>
                  <span className="text-indigo-900 font-black">أ. {TEACHER_OFFICIAL_NAME}</span>
                </div>
              </div>
            </div>

            {/* Skills Breakdown */}
            <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-xs">
              <h2 className="text-base sm:text-lg font-black text-slate-950">
                تحليل المهارات والمحاور التشخيصية
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Grammar */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>القواعد النحوية (Grammar)</span>
                    <span className="font-black text-slate-900" dir="ltr">
                      {resultData.skillStats.grammar.correct} / {resultData.skillStats.grammar.total}
                    </span>
                  </div>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-indigo-600 transition-all"
                      style={{
                        width: `${
                          resultData.skillStats.grammar.total > 0
                            ? (resultData.skillStats.grammar.correct /
                                resultData.skillStats.grammar.total) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Vocabulary */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>المفردات (Vocabulary)</span>
                    <span className="font-black text-slate-900" dir="ltr">
                      {resultData.skillStats.vocabulary.correct} /{' '}
                      {resultData.skillStats.vocabulary.total}
                    </span>
                  </div>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-violet-600 transition-all"
                      style={{
                        width: `${
                          resultData.skillStats.vocabulary.total > 0
                            ? (resultData.skillStats.vocabulary.correct /
                                resultData.skillStats.vocabulary.total) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Knowledge */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>المعرفة العامة والمملكة</span>
                    <span className="font-black text-slate-900" dir="ltr">
                      {resultData.skillStats.knowledge.correct} /{' '}
                      {resultData.skillStats.knowledge.total}
                    </span>
                  </div>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-emerald-600 transition-all"
                      style={{
                        width: `${
                          resultData.skillStats.knowledge.total > 0
                            ? (resultData.skillStats.knowledge.correct /
                                resultData.skillStats.knowledge.total) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Life Skills */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>مهارات الحياة والمواطنة</span>
                    <span className="font-black text-slate-900" dir="ltr">
                      {resultData.skillStats['life-skills'].correct} /{' '}
                      {resultData.skillStats['life-skills'].total}
                    </span>
                  </div>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-purple-600 transition-all"
                      style={{
                        width: `${
                          resultData.skillStats['life-skills'].total > 0
                            ? (resultData.skillStats['life-skills'].correct /
                                resultData.skillStats['life-skills'].total) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Questions Review & Bilingual Explanations */}
            <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-xs">
              <div className="border-b border-slate-100 pb-4 mb-5">
                <h2 className="text-base sm:text-lg font-black text-slate-950">
                  مراجعة تفصيلية للإجابات والشروحات التعليمية
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  استفيدي من توضيحات المعلمة {TEACHER_OFFICIAL_NAME} للأسئلة لتعزيز فهمكِ وتجنب الأخطاء مستقبلاً:
                </p>
              </div>

              <div className="space-y-4">
                {questions.map((q, idx) => {
                  const pickedId = userAnswers[idx];
                  const pickedOpt = q.options.find((o) => o.id === pickedId);
                  const isCorrect = pickedOpt?.isCorrect === true;
                  const correctOpt = q.options.find((o) => o.isCorrect);

                  return (
                    <div
                      key={q.id}
                      className={`rounded-2xl border p-4 sm:p-5 transition ${
                        isCorrect
                          ? 'border-emerald-200/90 bg-emerald-50/20'
                          : 'border-rose-200/90 bg-rose-50/20'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-black text-slate-600">
                          سؤال {idx + 1} • <span className="text-indigo-700">{q.sectionTitle}</span>
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                            isCorrect
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isCorrect ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>إجابة صحيحة</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5" />
                              <span>بحاجة لمراجعة</span>
                            </>
                          )}
                        </span>
                      </div>

                      <p className="text-sm sm:text-base font-bold text-slate-950" dir="ltr">
                        {q.prompt}
                      </p>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold">
                        <div className="rounded-xl bg-white p-2.5 border border-slate-200/80">
                          <span className="text-slate-500">إجابتك: </span>
                          <span
                            className={
                              isCorrect ? 'text-emerald-700 font-black' : 'text-rose-700 font-black'
                            }
                            dir="ltr"
                          >
                            {pickedOpt ? pickedOpt.text : 'لم يتم الاختيار'}
                          </span>
                        </div>

                        {!isCorrect && (
                          <div className="rounded-xl bg-emerald-50 p-2.5 border border-emerald-200">
                            <span className="text-emerald-800">الإجابة النموذجية: </span>
                            <span className="text-emerald-950 font-black" dir="ltr">
                              {correctOpt?.text}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 rounded-xl bg-slate-50/90 p-3 text-xs leading-relaxed text-slate-700 border border-slate-100">
                        <div className="font-black text-indigo-900 mb-0.5">
                          توضيح المعلمة {TEACHER_OFFICIAL_NAME}:
                        </div>
                        <p className="text-slate-800 font-medium">{q.explanationAr}</p>
                        <p className="text-[11px] text-slate-500 font-sans mt-1" dir="ltr">
                          {q.explanationEn}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      <div className="print:hidden">
        <PortalFooter />
      </div>
    </div>
  );
}
