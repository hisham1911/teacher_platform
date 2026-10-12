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
  Star,
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
  'الصف الأول متوسط',
  'الصف الثاني متوسط',
  'الصف الثالث متوسط',
  'المرحلة الثانوية — أول ثانوي',
  'المرحلة الثانوية — ثاني ثانوي',
  'المرحلة الثانوية — ثالث ثانوي',
  'ولي أمر',
  'معلم / مهتم باللغة',
  'زائر كريم',
];

export default function PlacementTestPage() {
  const [stage, setStage] = useState<Stage>('select-level');
  const [selectedLevelId, setSelectedLevelId] = useState<LevelChoiceId>('comprehensive');
  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState<string>(GRADE_OPTIONS[0] ?? 'الصف الأول متوسط');
  const [verificationCode] = useState(
    () => 'SPARK-PL-' + Math.random().toString(36).substring(2, 8).toUpperCase()
  );

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
    let cefrTitleAr = 'المستوى التأسيسي (A1 Breakthrough)';
    let cefrTitleEn = 'A1 Breakthrough • Foundation Level';
    let standingAr = 'مستوى تأسيسي في مسار التمكين';
    let standingEn = 'Foundation Pathway (Active Learner)';
    let standingBadgeClass = 'bg-teal-50 text-teal-800 border-teal-300';
    let evaluationStatementAr =
      'أتم المشارك متطلبات التقييم التشخيصي الاستكشافي لتحديد المنطلق التعليمي، واستحق التوجيه لمسار التأسيس والمفردات اليومية.';
    let evaluationStatementEn =
      'Completed the exploratory diagnostic evaluation, establishing the essential baseline for targeted foundational practice.';
    let levelBadgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    let summaryAr =
      'أداء تأسيسي في استيعاب المفردات والقواعد الأساسية. يُنصح بمتابعة بطاقات القواعد المصورة لتثبيت الأزمنة البسيطة وحل تمارين المحادثة اليومية.';

    if (selectedLevelId === 'comprehensive') {
      if (correctCount >= 21) {
        cefrCode = 'B2';
        cefrTitleAr = 'المستوى فوق المتوسط المتقدم (B2 Vantage)';
        cefrTitleEn = 'B2 Vantage • High Upper-Intermediate';
        standingAr = 'امتياز مع مرتبة الشرف العليا';
        standingEn = 'High Distinction & Honors';
        standingBadgeClass = 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white border-amber-300';
        levelBadgeColor = 'bg-purple-50 text-purple-800 border-purple-300';
        evaluationStatementAr =
          'أظهر المشارك تميزاً استثنائياً وجدارة لغوية متقدمة في القواعد المركبة والمفردات الأكاديمية ومهارات التفكير التحليلي، مما يؤهله بثقة للاختبارات الدولية والمستويات الجامعية.';
        evaluationStatementEn =
          'Demonstrated outstanding linguistic excellence and advanced command across complex grammar, lexical context, and critical reasoning benchmarks.';
        summaryAr =
          'مستوى ممتاز واستثنائي! حصيلة لغوية رفيعة واستيعاب عالٍ للتراكيب المعقدة ومهارات التفكير الناقد والجاهزية للاختبارات الدولية والمتقدمة.';
      } else if (correctCount >= 16) {
        cefrCode = 'B1';
        cefrTitleAr = 'المستوى المتوسط المستقل (B1 Threshold)';
        cefrTitleEn = 'B1 Threshold • Independent Intermediate';
        standingAr = 'جيد جداً بجدارة واستحقاق';
        standingEn = 'Merit & Solid Proficiency';
        standingBadgeClass = 'bg-gradient-to-r from-indigo-600 to-blue-700 text-white border-indigo-300';
        levelBadgeColor = 'bg-blue-50 text-blue-800 border-blue-300';
        evaluationStatementAr =
          'أظهر المشارك استيعاباً متقناً للجمل والأزمنة المركبة ومفردات التواصل الواقعي، مع كفاءة مستقلة تؤهله للانتقال الواثق نحو المستويات المتقدمة.';
        evaluationStatementEn =
          'Demonstrated sound linguistic competence and solid control of core tenses and functional vocabulary, demonstrating independent communicative fluency.';
        summaryAr =
          'مستوى متوسط وجيد جداً! فهم متقن للجمل والأزمنة المركبة ومفردات الحياة اليومية. يُنصح بالاستمرار في قراءة النصوص وتحديات السرعة.';
      } else if (correctCount >= 10) {
        cefrCode = 'A2';
        cefrTitleAr = 'المستوى الابتدائي المتقدم (A2 Waystage)';
        cefrTitleEn = 'A2 Waystage • Strong Elementary';
        standingAr = 'كفاءة لغوية أساسية معتمدة';
        standingEn = 'Certified Elementary Competence';
        standingBadgeClass = 'bg-gradient-to-r from-teal-600 to-emerald-700 text-white border-teal-300';
        levelBadgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
        evaluationStatementAr =
          'أظهر المشارك معرفة سليمة بالمبادئ النحوية التأسيسية ومفردات المحادثة اليومية، مع قابلية عالية للتقدم السريع نحو المستوى المتوسط.';
        evaluationStatementEn =
          'Demonstrated solid foundational grounding and daily communicative lexical control with high potential for progression.';
        summaryAr =
          'أساسيات جيدة، مع الحاجة لتثبيت تراكيب الجمل وصيغ الأزمنة. قسم القواعد النحوية وتمارين الكتابة الموجهة سيعززان المستوى سريعاً.';
      }
    } else if (selectedLevelId === 'level-1') {
      if (percent >= 85) {
        cefrCode = 'A1+';
        cefrTitleAr = 'المستوى التأسيسي المتقدم (A1+ Advanced Basics)';
        cefrTitleEn = 'A1+ Advanced Foundation Mastery';
        standingAr = 'امتياز مع مرتبة الشرف';
        standingEn = 'High Distinction';
        standingBadgeClass = 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-300';
        levelBadgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
        evaluationStatementAr =
          'إتقان متميز للتحيات والأرقام والألوان وأفعال الكينونة والضمائر وتصنيف الكلمات، مع جاهزية تامة للمستوى الثاني المتوسط.';
        evaluationStatementEn =
          'Outstanding mastery of English basic expressions, verbs of being, pronouns, and vocabulary categorization.';
        summaryAr =
          'إتقان تام لأسئلة المحادثة، الألوان، الأرقام، والضمائر وأفعال Be بشكل كامل. الجاهزية ممتازة للانتقال إلى المستوى الثاني (المتوسط).';
      } else if (percent >= 60) {
        cefrCode = 'A1';
        cefrTitleAr = 'المستوى التأسيسي المعتمد (A1 Foundation)';
        cefrTitleEn = 'A1 Certified Foundation Level';
        standingAr = 'جيد جداً بجدارة';
        standingEn = 'Merit & Proficiency';
        standingBadgeClass = 'bg-gradient-to-r from-teal-600 to-cyan-700 text-white border-teal-300';
        levelBadgeColor = 'bg-teal-50 text-teal-800 border-teal-300';
        evaluationStatementAr =
          'استيعاب سليم لقواعد البدايات ومفردات التواصل اليومي، مع التوصية بتثبيت بعض أدوات التعريف والتصنيفات.';
        evaluationStatementEn =
          'Solid comprehension of introductory English communicative patterns and everyday vocabulary.';
        summaryAr =
          'استيعاب طيب للأساسيات، مع الحاجة لمراجعة بعض أفعال (am / is / are) وتصنيفات الكلمات.';
      } else {
        cefrCode = 'A1 (Prep)';
        cefrTitleAr = 'المستوى التأسيسي في مسار البناء (A1 Developing)';
        cefrTitleEn = 'A1 Emerging Foundation';
        standingAr = 'مشارك في مسار التعزيز التأسيسي';
        standingEn = 'Foundation Pathway';
        standingBadgeClass = 'bg-gradient-to-r from-indigo-600 to-blue-700 text-white border-indigo-300';
        levelBadgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
        evaluationStatementAr =
          'أتم المشارك التقييم التشخيصي التأسيسي، وجرى تحديد الأولويات لتعزيز المفردات اليومية وأفعال الكينونة.';
        evaluationStatementEn =
          'Completed the foundational diagnostic check, establishing target priorities for daily vocabulary and basic structures.';
        summaryAr =
          'يُنصح بمراجعة درس المضارع البسيط والبطاقات المصورة لتثبيت نطق وكتابة الكلمات اليومية.';
      }
    } else if (selectedLevelId === 'level-2') {
      if (percent >= 85) {
        cefrCode = 'B1';
        cefrTitleAr = 'المستوى المتوسط المتقدم (B1 Independent Mastery)';
        cefrTitleEn = 'B1 Independent User • High Mastery';
        standingAr = 'امتياز مع مرتبة الشرف';
        standingEn = 'High Distinction';
        standingBadgeClass = 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-blue-300';
        levelBadgeColor = 'bg-blue-50 text-blue-800 border-blue-300';
        evaluationStatementAr =
          'تمكن رفيع من أزمنة الأفعال وصيغ المقارنة ومعلومات المملكة والعلوم، مع مهارات تواصلية واستيعابية متقدمة تؤهل للمستوى الثالث.';
        evaluationStatementEn =
          'Superior command of English verb tenses, comparative models, and Saudi & global knowledge, fully prepared for Level 3.';
        summaryAr =
          'نتيجة باهرة وتمكن عالٍ في الأزمنة وصيغ المقارنة ومعلومات المملكة العامة. الجاهزية ممتازة لخوض تحدي المستوى الثالث.';
      } else if (percent >= 60) {
        cefrCode = 'A2+';
        cefrTitleAr = 'المستوى المتوسط الواعد (A2+ Strong Intermediate)';
        cefrTitleEn = 'A2+ Promising Intermediate';
        standingAr = 'جيد جداً بجدارة';
        standingEn = 'Merit & Proficiency';
        standingBadgeClass = 'bg-gradient-to-r from-indigo-600 to-violet-700 text-white border-indigo-300';
        levelBadgeColor = 'bg-indigo-50 text-indigo-800 border-indigo-300';
        evaluationStatementAr =
          'أداء متقن وفهم سليم لقواعد الأزمنة وتراكيب الأسئلة، مع التوصية بتدريبات إضافية على الماضي المستمر والمضارع التام.';
        evaluationStatementEn =
          'Proficient grasp of grammatical tenses and comparative models, demonstrating high readiness for advanced intermediate tasks.';
        summaryAr =
          'أداء جيد جداً وفهم سليم لقواعد الأزمنة، مع التوصية بالتدرب أكثر على الماضي المستمر والمضارع التام.';
      } else {
        cefrCode = 'A2';
        cefrTitleAr = 'كفاءة لغوية ابتدائية معتمدة (A2 Elementary Competency)';
        cefrTitleEn = 'A2 Elementary Proficiency Level';
        standingAr = 'مستوى تأسيسي في مسار التمكين';
        standingEn = 'Competent Foundation';
        standingBadgeClass = 'bg-gradient-to-r from-teal-600 to-indigo-700 text-white border-teal-300';
        levelBadgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
        evaluationStatementAr =
          'أتم المشارك التقييم التشخيصي للمرحلة المتوسطة محققاً الكفاءة الأساسية، مع التوجيه لمسار مراجعة الأزمنة والتراكيب النحوية.';
        evaluationStatementEn =
          'Successfully completed intermediate diagnostic assessment, establishing baseline competence and identifying core grammar growth areas.';
        summaryAr =
          'يُنصح بمراجعة بطاقات الأزمنة (الماضي البسيط والمستمر) وقواعد المقارنة لتعزيز الحصيلة اللغوية.';
      }
    } else {
      // Level 3
      if (percent >= 85) {
        cefrCode = 'B2';
        cefrTitleAr = 'المستوى الثانوي المتقدم (B2 Vantage Proficiency)';
        cefrTitleEn = 'B2 Vantage • High Secondary Proficiency';
        standingAr = 'امتياز مع مرتبة الشرف العليا';
        standingEn = 'High Distinction & Honors';
        standingBadgeClass = 'bg-gradient-to-r from-purple-600 to-pink-700 text-white border-purple-300';
        levelBadgeColor = 'bg-purple-50 text-purple-800 border-purple-300';
        evaluationStatementAr =
          'إتقان استثنائي للقواعد المتقدمة (Conditionals, Passive) ووعي نقدي عميق بالمواطنة الرقمية والذكاء الاصطناعي ومهارات العمل والقرارات.';
        evaluationStatementEn =
          'Exceptional mastery of advanced grammar and critical reasoning in digital citizenship, artificial intelligence, and career competencies.';
        summaryAr =
          'إتقان متميز للقواعد المتقدمة ووعي رائع بالمواطنة الرقمية والذكاء الاصطناعي ومهارات العمل والقرارات!';
      } else if (percent >= 60) {
        cefrCode = 'B1+';
        cefrTitleAr = 'المستوى الثانوي الكفء (B1+ Strong Secondary)';
        cefrTitleEn = 'B1+ Solid Secondary Proficiency';
        standingAr = 'جيد جداً بجدارة';
        standingEn = 'Merit & Proficiency';
        standingBadgeClass = 'bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white border-fuchsia-300';
        levelBadgeColor = 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-300';
        evaluationStatementAr =
          'أداء متقدم في التراكيب الثانوية ومهارات التفكير الناقد وحل المشكلات، مع التوصية بتدريبات إضافية في الجمل الشرطية والمبني للمجهول.';
        evaluationStatementEn =
          'Strong competence in secondary grammar patterns and critical thinking, well prepared for standardized English testing.';
        summaryAr =
          'أداء ممتاز! مهارات التفكير الناقد واللغة قوية، مع التوصية بتدريبات إضافية في الجمل الشرطية والمبني للمجهول.';
      } else {
        cefrCode = 'B1';
        cefrTitleAr = 'المستوى الثانوي في مسار التمكين (B1 Secondary Foundation)';
        cefrTitleEn = 'B1 Secondary Intermediate Level';
        standingAr = 'كفاءة متوسطة مؤهلة';
        standingEn = 'Progressing Intermediate';
        standingBadgeClass = 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white border-indigo-300';
        levelBadgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
        evaluationStatementAr =
          'أتم المشارك التقييم التشخيصي للمرحلة الثانوية محققاً الكفاءة المتوسطة، مع التوجيه للتركيز على القواعد المتقدمة وقراءة المقالات التحليلية.';
        evaluationStatementEn =
          'Completed secondary diagnostic assessment, establishing the foundation for advanced syntax, critical reading, and vocabulary enrichment.';
        summaryAr =
          'يُنصح بالتركيز على قواعد المرحلة الثانوية وقراءة المقالات المتقدمة في قسم القراءة.';
      }
    }

    return {
      correctCount,
      percent,
      cefrCode,
      cefrTitle: cefrTitleAr,
      cefrTitleAr,
      cefrTitleEn,
      standingAr,
      standingEn,
      standingBadgeClass,
      evaluationStatementAr,
      evaluationStatementEn,
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
                منصة معتمدة وموجهة لطلاب وطالبات مدرسة متوسطة وثانوية الجرادية وكافة الزوار بإشراف المعلمة{' '}
                <span className="font-black text-indigo-900">{TEACHER_OFFICIAL_NAME}</span>.
                اختر مستواك المناسب أو خُض التقييم الشامل للحصول على تقرير أداء وشهادة تشخيصية رقمية.
              </p>

              {/* Participant Identity Inputs */}
              <div className="mx-auto mt-7 max-w-xl rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-6 text-right">
                <h2 className="text-xs sm:text-sm font-black text-indigo-950 mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  <span>بيانات المشارك للشهادة والتقرير:</span>
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
                    اختر مسار التقييم المناسب لك
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    يمكنك خوض التشخيص المتدرج أو اختيار المستوى المطلوب مباشرة
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
                  المشارك: <span className="font-black text-slate-900">{studentName}</span> {studentGrade && `• (${studentGrade})`}
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
            <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 sm:p-10 shadow-xs text-center backdrop-blur-xl print:hidden">
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
            {/* OFFICIAL DIGITAL CERTIFICATE DIPLOMA (MASTERPIECE) */}
            {/* ============================================================= */}
            <div className="relative overflow-hidden rounded-3xl border-8 border-double border-indigo-950 bg-gradient-to-b from-[#fdfbf7] via-white to-[#f7f9fd] p-6 sm:p-12 shadow-2xl text-center ring-1 ring-amber-400/50 print:border-4 print:p-6 print:shadow-none print:m-0">
              {/* Classical Corner Accent Flourishes */}
              <div className="absolute top-3 right-3 h-8 w-8 rounded-tr-md border-t-2 border-r-2 border-amber-500/80 pointer-events-none" />
              <div className="absolute top-3 left-3 h-8 w-8 rounded-tl-md border-t-2 border-l-2 border-amber-500/80 pointer-events-none" />
              <div className="absolute bottom-3 right-3 h-8 w-8 rounded-br-md border-b-2 border-r-2 border-amber-500/80 pointer-events-none" />
              <div className="absolute bottom-3 left-3 h-8 w-8 rounded-bl-md border-b-2 border-l-2 border-amber-500/80 pointer-events-none" />

              {/* Inner Double Inset Border */}
              <div className="absolute inset-2 sm:inset-3 rounded-2xl border border-amber-400/60 pointer-events-none" />
              <div className="absolute inset-3.5 sm:inset-5 rounded-xl border border-dashed border-indigo-200/50 pointer-events-none" />

              {/* Top Bilingual Institutional Strip */}
              <div className="relative z-10 flex flex-wrap items-start justify-between border-b border-indigo-100/80 pb-4 mb-6 gap-3 text-right">
                <div>
                  <span className="block text-[11px] font-black tracking-wider text-indigo-950 uppercase">
                    المملكة العربية السعودية • وزارة التعليم
                  </span>
                  <span className="block text-[10px] font-bold text-slate-500">
                    إدارة التعليم بمنطقة جازان • مدرسة متوسطة وثانوية الجرادية
                  </span>
                  <span className="block text-[10px] font-black text-indigo-700">
                    منصة ومبادرة English Spark للتميز والابتكار اللغوي
                  </span>
                </div>

                {/* Center Medallion Emblem */}
                <div className="mx-auto hidden md:flex flex-col items-center justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-950 text-amber-300 shadow-md ring-2 ring-amber-400/50">
                    <GraduationCap className="h-8 w-8" />
                  </div>
                </div>

                <div className="text-left" dir="ltr">
                  <span className="inline-block rounded-full bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 text-[10px] font-black text-indigo-900">
                    Official Diagnostic Credential
                  </span>
                  <span className="block text-[10px] font-mono font-bold text-slate-500 mt-1">
                    ID: {verificationCode}
                  </span>
                  <span className="block text-[9px] font-bold text-emerald-700">
                    Digitally Verified ✓
                  </span>
                </div>
              </div>

              {/* Certificate Title (Bilingual & Prestigious) */}
              <div className="relative z-10 mb-6">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/80 px-3.5 py-1 text-xs font-black text-amber-950 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  <span>ACCREDITED ENGLISH PROFICIENCY ASSESSMENT</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
                  شهادة تحديد المستوى والتشخيص اللغوي
                </h2>
                <p className="text-xs sm:text-sm font-black tracking-widest text-indigo-900 uppercase mt-1">
                  Certificate of English Language Proficiency & Placement
                </p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <div className="h-0.5 w-16 bg-gradient-to-r from-transparent to-amber-400" />
                  <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
                  <div className="h-0.5 w-16 bg-gradient-to-l from-transparent to-amber-400" />
                </div>
              </div>

              {/* Awardee Presentation */}
              <div className="relative z-10 my-4 max-w-2xl mx-auto">
                <p className="text-xs sm:text-sm font-semibold text-slate-500">
                  تَفخَر المنصة ومبادرة English Spark بمنح هذه الشهادة الرسمية إلى / This is to Proudly Certify that:
                </p>
                <h3 className="text-3xl sm:text-5xl font-black text-indigo-950 my-2.5 tracking-tight font-serif">
                  {studentName}
                </h3>
                {studentGrade && (
                  <div className="my-1.5">
                    <span className="inline-block text-xs sm:text-sm font-bold text-indigo-900 bg-indigo-50 border border-indigo-200/90 px-4 py-1 rounded-full shadow-2xs">
                      {studentGrade}
                    </span>
                  </div>
                )}
                <p className="text-xs sm:text-sm font-medium text-slate-700 mt-3 leading-relaxed">
                  تقديرًا لإتمام تقييم تحديد المستوى اللغوي والتشخيص التحريري لمسار{' '}
                  <span className="font-black text-indigo-950">({activeLevelMeta.titleAr})</span>، وأظهر أداءً معتمدًا يعكس مستوى الكفاءة والمعايير الآتية وفق الإطار الأوروبي المشترك (CEFR):
                </p>
              </div>

              {/* The Grand Proficiency & Honors Banner */}
              <div className="relative z-10 my-6 max-w-3xl mx-auto rounded-2xl border-2 border-indigo-200/90 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 p-5 sm:p-7 shadow-md">
                {/* Level + Standing Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-4 mb-4">
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-slate-500 block">المستوى المعياري الدولي (CEFR Framework)</span>
                    <span className="text-base sm:text-xl font-black text-indigo-950 flex items-center gap-2 mt-0.5">
                      <Award className="h-5 w-5 text-indigo-600" />
                      <span>{resultData.cefrTitleAr}</span>
                    </span>
                    <span className="text-xs font-bold text-indigo-700 block mt-0.5" dir="ltr">
                      {resultData.cefrTitleEn}
                    </span>
                  </div>

                  <div className="text-center sm:text-left">
                    <span className="text-[11px] font-bold text-slate-500 block">التقدير الأكاديمي العام</span>
                    <div className={`mt-1 inline-block rounded-xl px-4 py-1.5 text-xs sm:text-sm font-black border shadow-2xs ${resultData.standingBadgeClass}`}>
                      {resultData.standingAr}
                    </div>
                    <span className="block text-[10px] font-bold text-slate-400 mt-0.5" dir="ltr">
                      {resultData.standingEn} • {resultData.percent}%
                    </span>
                  </div>
                </div>

                {/* Academic Evaluation Statement */}
                <div className="rounded-xl bg-white/95 border border-slate-100 p-3.5 text-right shadow-2xs">
                  <p className="text-xs sm:text-sm font-semibold leading-relaxed text-slate-800">
                    {resultData.evaluationStatementAr}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-slate-500 italic text-left" dir="ltr">
                    {resultData.evaluationStatementEn}
                  </p>
                </div>

                {/* In-Certificate Skills Mini-Matrix */}
                <div className="mt-4 pt-3 border-t border-indigo-100/70">
                  <span className="block text-[11px] font-bold text-slate-500 text-right mb-2">
                    مصفوفة كفاءة المهارات اللغوية (Language Domains Matrix):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-right">
                    {resultData.skillStats.grammar.total > 0 && (
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-200/60">
                        <span className="block text-[10px] font-bold text-slate-500">القواعد والتراكيب (Grammar)</span>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="text-xs font-black text-indigo-950">
                            {Math.round((resultData.skillStats.grammar.correct / resultData.skillStats.grammar.total) * 100)}%
                          </span>
                          <span className="text-[10px] text-slate-400" dir="ltr">
                            {resultData.skillStats.grammar.correct}/{resultData.skillStats.grammar.total}
                          </span>
                        </div>
                      </div>
                    )}
                    {resultData.skillStats.vocabulary.total > 0 && (
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-200/60">
                        <span className="block text-[10px] font-bold text-slate-500">المفردات والسياق (Vocabulary)</span>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="text-xs font-black text-indigo-950">
                            {Math.round((resultData.skillStats.vocabulary.correct / resultData.skillStats.vocabulary.total) * 100)}%
                          </span>
                          <span className="text-[10px] text-slate-400" dir="ltr">
                            {resultData.skillStats.vocabulary.correct}/{resultData.skillStats.vocabulary.total}
                          </span>
                        </div>
                      </div>
                    )}
                    {resultData.skillStats.knowledge.total > 0 && (
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-200/60">
                        <span className="block text-[10px] font-bold text-slate-500">المعرفة العامة والوطنية</span>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="text-xs font-black text-indigo-950">
                            {Math.round((resultData.skillStats.knowledge.correct / resultData.skillStats.knowledge.total) * 100)}%
                          </span>
                          <span className="text-[10px] text-slate-400" dir="ltr">
                            {resultData.skillStats.knowledge.correct}/{resultData.skillStats.knowledge.total}
                          </span>
                        </div>
                      </div>
                    )}
                    {resultData.skillStats['life-skills'].total > 0 && (
                      <div className="rounded-lg bg-slate-50 p-2 border border-slate-200/60">
                        <span className="block text-[10px] font-bold text-slate-500">مهارات الحياة والتفكير</span>
                        <div className="flex items-baseline justify-between mt-0.5">
                          <span className="text-xs font-black text-indigo-950">
                            {Math.round((resultData.skillStats['life-skills'].correct / resultData.skillStats['life-skills'].total) * 100)}%
                          </span>
                          <span className="text-[10px] text-slate-400" dir="ltr">
                            {resultData.skillStats['life-skills'].correct}/{resultData.skillStats['life-skills'].total}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dual Signatures, Gold Seal & Accreditation Footer */}
              <div className="relative z-10 mt-6 pt-5 border-t border-indigo-200/80 grid grid-cols-1 sm:grid-cols-3 items-center gap-4">
                {/* Supervising Teacher */}
                <div className="text-center sm:text-right">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Supervising Teacher</span>
                  <span className="block text-xs sm:text-sm font-black text-indigo-950 mt-0.5">
                    أ. {TEACHER_OFFICIAL_NAME}
                  </span>
                  <span className="block text-[10px] font-bold text-slate-500">
                    معلمة اللغة الإنجليزية المشرفة
                  </span>
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                    <span>اعتماد أكاديمي معتمد ✓</span>
                  </div>
                </div>

                {/* Official Gold Embossed Medallion */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-600 p-1 shadow-lg ring-4 ring-amber-400/40">
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 p-1 text-white border-2 border-dashed border-amber-200/80 text-center">
                      <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                      <span className="text-[8px] font-black tracking-widest text-amber-200 uppercase">OFFICIAL</span>
                      <span className="text-[9px] font-black text-white">ختم الاعتماد</span>
                      <span className="text-[7px] font-bold text-amber-300">2026 ACADEMY</span>
                    </div>
                  </div>
                  <span className="mt-1 text-[9px] font-black tracking-widest text-indigo-950 uppercase">
                    Verified Diagnostic Credential
                  </span>
                </div>

                {/* Assessment Board */}
                <div className="text-center sm:text-left" dir="ltr">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Assessment Board</span>
                  <span className="block text-xs sm:text-sm font-black text-indigo-950 mt-0.5">
                    English Spark Academy
                  </span>
                  <span className="block text-[10px] font-bold text-slate-500" dir="rtl">
                    مدرسة متوسطة وثانوية الجرادية
                  </span>
                  <div className="mt-1.5 text-[10px] font-bold text-slate-500">
                    <span>Issued: </span>
                    <span className="font-mono text-indigo-900 font-black">{new Date().toLocaleDateString('ar-SA')}</span>
                  </div>
                </div>
              </div>

              {/* Verification Footnote Bar */}
              <div className="relative z-10 mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-[10px] font-bold text-slate-400 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>كود التحقق الرقمي المعتمد:</span>
                  <span className="font-mono font-black text-indigo-950">{verificationCode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>الدرجة: {resultData.correctCount} من {totalQuestions} ({resultData.percent}%)</span>
                  <span>•</span>
                  <span>المدة: {Math.max(1, Math.round(elapsedSeconds / 60))} دقيقة</span>
                  <span>•</span>
                  <span>المملكة العربية السعودية</span>
                </div>
              </div>
            </div>

            {/* Skills Breakdown */}
            <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-xs print:hidden">
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
            <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-xs print:hidden">
              <div className="border-b border-slate-100 pb-4 mb-5">
                <h2 className="text-base sm:text-lg font-black text-slate-950">
                  مراجعة تفصيلية للإجابات والشروحات التعليمية
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  استفد من توضيحات المعلمة {TEACHER_OFFICIAL_NAME} للأسئلة لتعزيز فهمك وتجنب الأخطاء مستقبلاً:
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
