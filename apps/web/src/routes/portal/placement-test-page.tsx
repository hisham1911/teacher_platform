import { useState } from 'react';
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
} from 'lucide-react';
import { PublicBackdrop } from '../../components/layout/root-layout';
import { PortalNav, PortalFooter } from '../../components/portal/portal-nav';
import { placementQuestions } from '../../data/content/competitions';

type Stage = 'intro' | 'testing' | 'result';

export default function PlacementTestPage() {
  const [stage, setStage] = useState<Stage>('intro');
  const [studentName, setStudentName] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const currentQ = placementQuestions[currentIndex];
  const total = placementQuestions.length;

  function handleStart() {
    if (studentName.trim().length < 2) return;
    setStage('testing');
    setCurrentIndex(0);
    setUserAnswers({});
    setSelectedOption(null);
  }

  function handleNext() {
    if (selectedOption === null) return;
    const updated = { ...userAnswers, [currentIndex]: selectedOption };
    setUserAnswers(updated);
    setSelectedOption(null);

    if (currentIndex + 1 < total) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setStage('result');
    }
  }

  function handleRestart() {
    setStage('intro');
    setCurrentIndex(0);
    setUserAnswers({});
    setSelectedOption(null);
  }

  // Calculate scores
  let totalCorrect = 0;
  type SkillKey = 'grammar' | 'vocabulary' | 'comprehension';
  const skillScores: Record<SkillKey, { correct: number; total: number }> = {
    grammar: { correct: 0, total: 0 },
    vocabulary: { correct: 0, total: 0 },
    comprehension: { correct: 0, total: 0 },
  };

  placementQuestions.forEach((q, idx) => {
    const userOptIdx = userAnswers[idx];
    skillScores[q.skill].total += 1;
    if (userOptIdx !== undefined && q.options[userOptIdx]?.isCorrect) {
      totalCorrect += 1;
      skillScores[q.skill].correct += 1;
    }
  });

  // CEFR Determination
  let levelTitle = 'A1 — مبتدئ (Beginner)';
  let levelDesc =
    'لديك معرفة أساسية بمفردات وقواعد اللغة البسيطة. ننصحك بالبدء بقسم القواعد لدراسة الأزمنة الأساسية مع البطاقات المصورة.';
  let levelColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
  let recommendedLink = '/grammar';
  let recommendedText = 'ابدأ بدراسة بطاقات القواعد';

  if (totalCorrect >= 13) {
    levelTitle = 'B2 — متقدم (Upper Intermediate)';
    levelDesc =
      'مستواك ممتاز ومتقدم! لديك استيعاب قوي للتراكيب المعقدة والمفردات. ننصحك بالانتقال لقسم الكتابة والتنافس في مسابقة المليون.';
    levelColor = 'bg-purple-50 text-purple-800 border-purple-300';
    recommendedLink = '/challenge';
    recommendedText = 'تحدّ نفسك في مسابقة المليون';
  } else if (totalCorrect >= 9) {
    levelTitle = 'B1 — متوسط (Intermediate)';
    levelDesc =
      'مستواك متوسط وجيد جداً! تستطيع فهم النصوص والمفردات في السياقات اليومية. ننصحك بتمارين القراءة والاستماع لتعزيز حصيلتك.';
    levelColor = 'bg-sky-50 text-sky-800 border-sky-300';
    recommendedLink = '/reading';
    recommendedText = 'استكشف نصوص القراءة';
  } else if (totalCorrect >= 5) {
    levelTitle = 'A2 — فوق المبتدئ (Elementary)';
    levelDesc =
      'لديك أساسيات جيدة، لكنك بحاجة إلى تثبيت تراكيب الجمل وصيغ الأفعال. قسم القواعد وتمارين الكتابة الموجهة ستفيدك بشكل كبير.';
    levelColor = 'bg-amber-50 text-amber-800 border-amber-300';
    recommendedLink = '/grammar';
    recommendedText = 'راجع قواعد اللغة مع التمارين';
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-20 pt-6 sm:pt-10">
        {/* Breadcrumb Navigation */}
        <div className="mb-5 flex items-center gap-1.5 text-xs font-bold text-slate-500">
          <Link to="/competitions" className="hover:text-violet-700 transition">
            المسابقات
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-violet-700 font-black">اختبار تحديد المستوى</span>
        </div>

        {/* STAGE 1: INTRO */}
        {stage === 'intro' && (
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-xs sm:p-10 text-center">
            <span className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-700 text-white shadow-lg shadow-indigo-600/20">
              <GraduationCap className="h-7 w-7 sm:h-8 sm:w-8" />
            </span>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-black tracking-wider text-indigo-700">
              <Sparkles className="h-3 w-3" />
              LEVEL PLACEMENT TEST
            </span>
            <h1 className="mt-1 text-2xl sm:text-4xl font-black text-slate-900">
              اختبار تحديد المستوى التشخيصي
            </h1>
            <p className="mx-auto mt-2.5 max-w-xl text-xs sm:text-sm font-semibold leading-relaxed text-slate-600">
              اختبار تشخيصي دقيق مكون من 15 سؤالاً يغطي المهارات الأساسية: القواعد، المفردات، والاستيعاب، لمساعدتك على معرفة مستواك وتحديد مسار تعلمك.
            </p>

            {/* Test Structure Cards */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 text-right">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-xs font-black text-slate-600">المرحلة الأولى</span>
                <h2 className="mt-0.5 text-sm font-bold text-slate-900">5 أسئلة تمهيدية</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">مستوى A1-A2 (مبتدئ)</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-xs font-black text-indigo-600">المرحلة الثانية</span>
                <h2 className="mt-0.5 text-sm font-bold text-slate-900">5 أسئلة متوسطة</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">مستوى B1 (متوسط)</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                <span className="text-xs font-black text-violet-600">المرحلة الثالثة</span>
                <h2 className="mt-0.5 text-sm font-bold text-slate-900">5 أسئلة متقدمة</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">مستوى B2 (متقدم)</p>
              </div>
            </div>

            {/* Name Input */}
            <div className="mx-auto mt-6 max-w-md">
              <label htmlFor="student-name" className="mb-1.5 block text-right text-xs font-black text-slate-700">
                اسم الطالب / الطالبة:
              </label>
              <input
                id="student-name"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="اكتب اسمك للبدء..."
                className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-center text-sm sm:text-base font-bold text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={handleStart}
                disabled={studentName.trim().length < 2}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-xs sm:text-sm font-black text-white shadow-md transition hover:bg-indigo-700 active:scale-95 disabled:opacity-40"
              >
                <span>ابدأ الاختبار التشخيصي</span>
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STAGE 2: TESTING */}
        {stage === 'testing' && currentQ && (
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-xs sm:p-8">
            {/* Top Bar: Progress */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-3 py-0.5 text-xs font-black text-indigo-700">
                  السؤال {currentIndex + 1} من {total}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                  {currentQ.stage === 'elementary' && 'مبتدئ (Elementary)'}
                  {currentQ.stage === 'intermediate' && 'متوسط (Intermediate)'}
                  {currentQ.stage === 'advanced' && 'متقدم (Advanced)'}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-500">الطالب: {studentName}</span>
            </div>

            {/* Progress Bar */}
            <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
              />
            </div>

            {/* Prompt */}
            <p className="text-base sm:text-xl font-bold leading-relaxed text-slate-900 select-text" dir="ltr">
              {currentQ.prompt}
            </p>

            {/* Options */}
            <div className="mt-6 flex flex-col gap-2.5">
              {currentQ.options.map((opt, oIdx) => {
                const isSelected = selectedOption === oIdx;
                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => setSelectedOption(oIdx)}
                    className={`flex items-center justify-between rounded-xl sm:rounded-2xl border-2 px-4 py-3 sm:px-5 sm:py-3.5 text-right transition active:scale-[0.99] min-h-[50px] ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 font-black text-indigo-950 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50 font-bold text-slate-800'
                    }`}
                    dir="ltr"
                  >
                    <span className="text-left text-sm sm:text-base flex-1">{opt.text}</span>
                    <span
                      className={`flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg sm:rounded-xl text-xs font-black ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {String.fromCharCode(65 + oIdx)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <span className="text-xs font-bold text-slate-500">
                اختر إجابة واحدة ثم اضغط على زر المتابعة
              </span>
              <button
                type="button"
                onClick={handleNext}
                disabled={selectedOption === null}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-7 py-3 text-xs sm:text-sm font-black text-white shadow-md transition hover:bg-indigo-700 active:scale-95 disabled:opacity-40"
              >
                <span>{currentIndex + 1 === total ? 'إنهاء وحساب النتيجة' : 'السؤال التالي'}</span>
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STAGE 3: RESULT */}
        {stage === 'result' && (
          <div className="space-y-6">
            {/* Header Result Card */}
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-xs sm:p-10 text-center">
              <span className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 text-white shadow-lg shadow-indigo-600/20">
                <Award className="h-8 w-8 sm:h-10 sm:w-10" />
              </span>
              <h1 className="mt-4 text-xl sm:text-3xl font-black text-slate-900">
                نتيجة اختبار تحديد المستوى لـ {studentName}
              </h1>

              {/* Level Badge */}
              <div
                className={`mx-auto mt-4 inline-flex items-center gap-2 rounded-2xl border px-5 py-2 text-sm sm:text-base font-black ${levelColor}`}
              >
                <span>المستوى المُقدَّر:</span>
                <span>{levelTitle}</span>
              </div>

              {/* Score pill */}
              <div className="mt-4 text-2xl sm:text-3xl font-black text-slate-900">
                {totalCorrect}{' '}
                <span className="text-sm sm:text-base text-slate-500 font-bold">
                  من أصل {total} أسئلة
                </span>
                <span className="mr-2 text-xs sm:text-sm font-bold text-indigo-600">
                  ({Math.round((totalCorrect / total) * 100)}%)
                </span>
              </div>

              <p className="mx-auto mt-3 max-w-xl text-xs sm:text-sm font-semibold leading-relaxed text-slate-600">
                {levelDesc}
              </p>

              {/* Recommended Action */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to={recommendedLink}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-xs sm:text-sm font-black text-white shadow-md hover:bg-indigo-700 transition"
                >
                  <span>{recommendedText}</span>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-xs sm:text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>إعادة الاختبار</span>
                </button>
                <Link
                  to="/competitions"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-5 py-3 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-200 transition"
                >
                  العودة للمسابقات
                </Link>
              </div>
            </div>

            {/* Skills Breakdown */}
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-5 sm:p-7 shadow-xs">
              <h2 className="text-base sm:text-lg font-black text-slate-900">تحليل المهارات التفصيلي</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>القواعد (Grammar)</span>
                    <span className="font-black text-slate-900">
                      {skillScores.grammar.correct} / {skillScores.grammar.total}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-indigo-600"
                      style={{
                        width: `${(skillScores.grammar.correct / skillScores.grammar.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>المفردات (Vocabulary)</span>
                    <span className="font-black text-slate-900">
                      {skillScores.vocabulary.correct} / {skillScores.vocabulary.total}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-violet-600"
                      style={{
                        width: `${(skillScores.vocabulary.correct / skillScores.vocabulary.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>الاستيعاب (Comprehension)</span>
                    <span className="font-black text-slate-900">
                      {skillScores.comprehension.correct} / {skillScores.comprehension.total}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-emerald-600"
                      style={{
                        width: `${(skillScores.comprehension.correct / skillScores.comprehension.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Questions Review & Explanations */}
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-5 sm:p-7 shadow-xs">
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                مراجعة إجاباتك وشروحات الأسئلة
              </h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                راجع أخطاءك واستفد من التوضيح التعليمي لكل سؤال:
              </p>

              <div className="mt-5 space-y-3">
                {placementQuestions.map((q, idx) => {
                  const pickedIdx = userAnswers[idx];
                  const pickedOpt = pickedIdx !== undefined ? q.options[pickedIdx] : null;
                  const isCorrect = pickedOpt?.isCorrect === true;
                  const correctOpt = q.options.find((o) => o.isCorrect);

                  return (
                    <div
                      key={q.id}
                      className={`rounded-2xl border p-4 ${
                        isCorrect
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : 'border-rose-200 bg-rose-50/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs font-black text-slate-600">
                          سؤال {idx + 1} • {q.stage}
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
                              <CheckCircle2 className="h-3 w-3" />
                              <span>صحيحة</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3" />
                              <span>خاطئة</span>
                            </>
                          )}
                        </span>
                      </div>

                      <p className="mt-2 text-sm sm:text-base font-bold text-slate-900" dir="ltr">
                        {q.prompt}
                      </p>

                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs font-bold sm:grid-cols-2">
                        <div className="rounded-xl bg-white p-2.5 border border-slate-100">
                          <span className="text-slate-500">إجابتك: </span>
                          <span
                            className={isCorrect ? 'text-emerald-700 font-black' : 'text-rose-700 font-black'}
                            dir="ltr"
                          >
                            {pickedOpt ? pickedOpt.text : 'لم تُجب'}
                          </span>
                        </div>
                        {!isCorrect && (
                          <div className="rounded-xl bg-emerald-50 p-2.5 border border-emerald-100">
                            <span className="text-emerald-800">الإجابة الصحيحة: </span>
                            <span className="text-emerald-900 font-black" dir="ltr">
                              {correctOpt?.text}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5 rounded-xl bg-slate-50 p-2.5 text-xs font-semibold text-slate-700">
                        <span className="font-black text-indigo-700">الشرح التعليمي: </span>
                        {q.explanation}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      <PortalFooter />
    </div>
  );
}
