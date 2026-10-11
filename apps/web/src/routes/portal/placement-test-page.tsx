import { useState } from 'react';
import { Link } from 'react-router';
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
    const pickedIdx = userAnswers[idx];
    const isCorrect = pickedIdx !== undefined && q.options[pickedIdx]?.isCorrect === true;
    if (isCorrect) totalCorrect += 1;

    skillScores[q.skill].total += 1;
    if (isCorrect) skillScores[q.skill].correct += 1;
  });

  // Determine Level
  let levelTitle = 'مبتدئ (Elementary - A1/A2)';
  let levelColor = 'text-amber-700 bg-amber-50 border-amber-200';
  let levelDesc = 'لديك معرفة بالأساسيات، وننصحك بالتركيز على قواعد المضارع البسيط والماضي البسيط وحفظ المفردات اليومية.';
  let recommendedLink = '/grammar/present-simple';
  let recommendedText = 'ابدأ بقاعدة المضارع البسيط';

  if (totalCorrect >= 12) {
    levelTitle = 'متقدم (Advanced - B2)';
    levelColor = 'text-emerald-800 bg-emerald-50 border-emerald-300';
    levelDesc = 'مستواك ممتاز ومتقدم! تمتلك فهماً دقيقاً للقواعد المعقدة والمفردات المتقدمة. ننصحك بالتركيز على مهارات الكتابة والمحادثة.';
    recommendedLink = '/writing';
    recommendedText = 'تحدّ نفسك في قسم الكتابة المتقدمة';
  } else if (totalCorrect >= 7) {
    levelTitle = 'متوسط (Intermediate - B1)';
    levelColor = 'text-indigo-800 bg-indigo-50 border-indigo-300';
    levelDesc = 'مستواك متوسط وجيد جداً! لديك قاعدة متينة، وننصحك بالتركيز على أزمنة المضارع التام وقواعد المقارنة وقراءة نصوص أطول.';
    recommendedLink = '/reading';
    recommendedText = 'طوّر استيعابك مع نصوص القراءة';
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-slate-50/50" dir="rtl">
      <PublicBackdrop />
      <PortalNav />

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-20 pt-8 sm:pt-12">
        {/* Breadcrumb Navigation */}
        <div className="mb-6 flex items-center gap-2 text-xs font-bold text-slate-500">
          <Link to="/competitions" className="hover:text-violet-700">
            المسابقات
          </Link>
          <span>/</span>
          <span className="text-violet-700">اختبار تحديد المستوى</span>
        </div>

        {/* STAGE 1: INTRO */}
        {stage === 'intro' && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-700 text-3xl text-white shadow-md">
              🎯
            </span>
            <span className="mt-4 inline-block text-xs font-black uppercase tracking-wider text-indigo-700">
              LEVEL PLACEMENT TEST
            </span>
            <h1 className="mt-2 text-3xl font-black text-slate-900 sm:text-4xl">
              اختبار تحديد المستوى في اللغة الإنجليزية
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-relaxed text-slate-600 sm:text-base">
              اختبار تشخيصي دقيق مكون من 15 سؤالاً يغطي المهارات الأساسية: القواعد، المفردات، والاستيعاب، لمساعدتك على معرفة مستواك الحقيقي وتحديد خطتك التعليمية.
            </p>

            {/* Test Structure Cards */}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 text-right">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <span className="text-xs font-black text-slate-600">المرحلة الأولى</span>
                <h2 className="mt-1 font-bold text-slate-900">5 أسئلة تمهيدية</h2>
                <p className="mt-1 text-xs text-slate-500">مستوى A1-A2 (مبتدئ)</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <span className="text-xs font-black text-indigo-600">المرحلة الثانية</span>
                <h2 className="mt-1 font-bold text-slate-900">5 أسئلة متوسطة</h2>
                <p className="mt-1 text-xs text-slate-500">مستوى B1 (متوسط)</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <span className="text-xs font-black text-violet-600">المرحلة الثالثة</span>
                <h2 className="mt-1 font-bold text-slate-900">5 أسئلة متقدمة</h2>
                <p className="mt-1 text-xs text-slate-500">مستوى B2 (متقدم)</p>
              </div>
            </div>

            {/* Name Input */}
            <div className="mx-auto mt-8 max-w-md">
              <label htmlFor="student-name" className="mb-2 block text-right text-xs font-black text-slate-700">
                اسم الطالب / الطالبة:
              </label>
              <input
                id="student-name"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="اكتب اسمك للبدء..."
                className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-center text-base font-bold text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={handleStart}
                disabled={studentName.trim().length < 2}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-base font-black text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-40"
              >
                <span>ابدأ الاختبار التشخيصي</span>
                <span aria-hidden="true">←</span>
              </button>
            </div>
          </div>
        )}

        {/* STAGE 2: TESTING */}
        {stage === 'testing' && currentQ && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
            {/* Top Bar: Progress & Stage Badge */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                  السؤال {currentIndex + 1} من {total}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {currentQ.stage === 'elementary' && 'مستوى مبتدئ (Elementary)'}
                  {currentQ.stage === 'intermediate' && 'مستوى متوسط (Intermediate)'}
                  {currentQ.stage === 'advanced' && 'مستوى متقدم (Advanced)'}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-500">الطالب: {studentName}</span>
            </div>

            {/* Progress Bar */}
            <div className="mb-8 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
              />
            </div>

            {/* Question Prompt */}
            <div className="mb-8 rounded-2xl bg-indigo-50/50 p-6 text-left" dir="ltr">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-600">
                {currentQ.skill.toUpperCase()}
              </span>
              <p className="mt-2 text-xl font-bold leading-relaxed text-slate-900 sm:text-2xl">
                {currentQ.prompt}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3" dir="ltr">
              {currentQ.options.map((opt, oIdx) => {
                const isSelected = selectedOption === oIdx;
                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => setSelectedOption(oIdx)}
                    className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left font-semibold transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-xs ring-2 ring-indigo-600'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base sm:text-lg">{opt.text}</span>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-black ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 text-slate-400'
                      }`}
                    >
                      {String.fromCharCode(65 + oIdx)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
              <span className="text-xs font-bold text-slate-600">
                اختر إجابة واحدة ثم اضغط على زر المتابعة
              </span>
              <button
                type="button"
                onClick={handleNext}
                disabled={selectedOption === null}
                className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-7 py-3 text-sm font-black text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-40"
              >
                <span>{currentIndex + 1 === total ? 'إنهاء وحساب النتيجة' : 'السؤال التالي'}</span>
                <span aria-hidden="true">←</span>
              </button>
            </div>
          </div>
        )}

        {/* STAGE 3: RESULT */}
        {stage === 'result' && (
          <div className="space-y-8">
            {/* Header Result Card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 text-center">
              <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 text-4xl text-white shadow-lg">
                🏅
              </span>
              <h1 className="mt-4 text-2xl font-black text-slate-900 sm:text-3xl">
                نتيجة اختبار تحديد المستوى لـ {studentName}
              </h1>

              {/* Level Badge */}
              <div
                className={`mx-auto mt-4 inline-flex items-center gap-2 rounded-2xl border px-6 py-2.5 text-base font-black ${levelColor}`}
              >
                <span>المستوى المُقدَّر:</span>
                <span>{levelTitle}</span>
              </div>

              {/* Score pill */}
              <div className="mt-4 text-3xl font-black text-slate-900">
                {totalCorrect} <span className="text-base text-slate-500 font-bold">من أصل {total} أسئلة</span>
                <span className="mr-2 text-sm font-bold text-indigo-600">
                  ({Math.round((totalCorrect / total) * 100)}%)
                </span>
              </div>

              <p className="mx-auto mt-4 max-w-xl text-sm font-semibold leading-relaxed text-slate-600">
                {levelDesc}
              </p>

              {/* Recommended Action */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  to={recommendedLink}
                  className="rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-black text-white shadow-md hover:bg-indigo-700"
                >
                  {recommendedText} ←
                </Link>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="rounded-2xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50"
                >
                  إعادة الاختبار 🔄
                </button>
                <Link
                  to="/competitions"
                  className="rounded-2xl border border-slate-200 bg-slate-100 px-6 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
                >
                  العودة لقسم المسابقات
                </Link>
              </div>
            </div>

            {/* Skills Breakdown */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-black text-slate-900">تحليل المهارات التفصيلي</h2>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
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

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
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

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
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
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-lg font-black text-slate-900">
                مراجعة إجاباتك وشروحات الأسئلة
              </h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                راجع أخطاءك واستفد من التوضيح التعليمي لكل سؤال:
              </p>

              <div className="mt-6 space-y-4">
                {placementQuestions.map((q, idx) => {
                  const pickedIdx = userAnswers[idx];
                  const pickedOpt = pickedIdx !== undefined ? q.options[pickedIdx] : null;
                  const isCorrect = pickedOpt?.isCorrect === true;
                  const correctOpt = q.options.find((o) => o.isCorrect);

                  return (
                    <div
                      key={q.id}
                      className={`rounded-2xl border p-5 ${
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
                          className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                            isCorrect
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isCorrect ? 'إجابة صحيحة ✓' : 'إجابة خاطئة ✗'}
                        </span>
                      </div>

                      <p className="mt-2 text-base font-bold text-slate-900" dir="ltr">
                        {q.prompt}
                      </p>

                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs font-bold sm:grid-cols-2">
                        <div className="rounded-xl bg-white p-3 border border-slate-100">
                          <span className="text-slate-500">إجابتك: </span>
                          <span
                            className={isCorrect ? 'text-emerald-700 font-black' : 'text-rose-700 font-black'}
                            dir="ltr"
                          >
                            {pickedOpt ? pickedOpt.text : 'لم تُجب'}
                          </span>
                        </div>
                        {!isCorrect && (
                          <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-100">
                            <span className="text-emerald-800">الإجابة الصحيحة: </span>
                            <span className="text-emerald-900 font-black" dir="ltr">
                              {correctOpt?.text}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-700">
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
