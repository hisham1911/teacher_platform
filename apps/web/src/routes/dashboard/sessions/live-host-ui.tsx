import type { ReactNode } from 'react';
import { Link } from 'react-router';
import QRCode from 'react-qr-code';
import { ButtonSpinner } from '../../../components/ui/spinner';
import { MediaContentPreview } from '../../../features/questions/media-content-preview';
import { LiveCountdown } from '../../../features/live/live-countdown';
import type { LiveConnectionStatus } from '../../../features/live/use-live-connection';
import { QUESTION_TYPE_LABELS } from '../../../types/questions';
import type { LiveLeaderboardEntry, LiveSessionState } from '../../../types/live';
import type { SessionDetail } from '../../../types/sessions';

const PHASE_DETAILS = {
  Lobby: { label: 'في الانتظار', className: 'border-sky-400/30 bg-sky-400/10 text-sky-100' },
  QuestionOpen: { label: 'مباشر', className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100' },
  QuestionClosed: { label: 'انتهى السؤال', className: 'border-amber-300/30 bg-amber-300/10 text-amber-100' },
  Finished: { label: 'انتهت', className: 'border-slate-400/30 bg-slate-400/10 text-slate-200' },
} as const;

const CONNECTION_DETAILS: Record<LiveConnectionStatus, { label: string; notice?: string; tone: string }> = {
  idle: { label: 'جارٍ تجهيز الاتصال المباشر', tone: 'text-slate-300' },
  connecting: { label: 'جارٍ الاتصال المباشر…', tone: 'text-sky-200' },
  connected: { label: 'متصل لحظيًا', tone: 'text-emerald-200' },
  reconnecting: { label: 'إعادة الاتصال…', notice: 'فقد الاتصال مؤقتًا… نحاول إعادة الاتصال', tone: 'text-amber-200' },
  offline: { label: 'الاتصال اللحظي متوقف', notice: 'الاتصال اللحظي متوقف — التحديث الدوري مستمر', tone: 'text-amber-200' },
};

type CopyState = 'idle' | 'copied' | 'failed';

export function LiveHostView({
  state,
  session,
  tenantId,
  quizId,
  connectionStatus,
  durationSeconds,
  copyState,
  actionError,
  isPending,
  onDurationChange,
  onCopyStudentUrl,
  onOpen,
  onClose,
  onFinish,
}: {
  state: LiveSessionState;
  session: SessionDetail;
  tenantId: string;
  quizId: string;
  connectionStatus: LiveConnectionStatus;
  durationSeconds: number;
  copyState: CopyState;
  actionError: string | null;
  isPending: boolean;
  onDurationChange: (value: number) => void;
  onCopyStudentUrl: (url: string) => void;
  onOpen: () => void;
  onClose: () => void;
  onFinish: () => void;
}) {
  const studentUrl = `${window.location.origin}/play/${session.joinCode}`;

  return (
    <div className="live-host-shell min-h-dvh" dir="rtl">
      <div className="mx-auto flex min-h-dvh w-full max-w-screen-2xl flex-col px-4 pb-44 pt-4 sm:px-6 sm:pb-40 sm:pt-5 md:pb-32 lg:px-8">
        <LiveHeader
          state={state}
          session={session}
          quizId={quizId}
          connectionStatus={connectionStatus}
        />

        {connectionStatus === 'reconnecting' || connectionStatus === 'offline' ? (
          <p role="status" aria-live="polite" className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100">
            {CONNECTION_DETAILS[connectionStatus].notice}
          </p>
        ) : null}

        {actionError ? (
          <p role="alert" className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-100">
            {actionError}
          </p>
        ) : null}

        <main id="live-stage" className="mt-5 grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {state.phase === 'Lobby' ? (
            <LobbyStage
              state={state}
              session={session}
              studentUrl={studentUrl}
              copyState={copyState}
              onCopyStudentUrl={onCopyStudentUrl}
            />
          ) : state.phase === 'Finished' ? (
            <FinishedStage state={state} session={session} quizId={quizId} />
          ) : (
            <QuestionStage state={state} tenantId={tenantId} />
          )}

          <LiveSidePanel state={state} />
        </main>

        {state.phase !== 'Finished' ? (
          <HostControlBar
            state={state}
            session={session}
            quizId={quizId}
            durationSeconds={durationSeconds}
            isPending={isPending}
            onDurationChange={onDurationChange}
            onOpen={onOpen}
            onClose={onClose}
            onFinish={onFinish}
          />
        ) : null}
      </div>
    </div>
  );
}

function LiveHeader({
  state,
  session,
  quizId,
  connectionStatus,
}: {
  state: LiveSessionState;
  session: SessionDetail;
  quizId: string;
  connectionStatus: LiveConnectionStatus;
}) {
  const phase = PHASE_DETAILS[state.phase];
  const connection = CONNECTION_DETAILS[connectionStatus];

  return (
    <header className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-sm font-black ${phase.className}`}>
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${state.phase === 'QuestionOpen' ? 'live-status-pulse bg-emerald-300' : 'bg-current'}`} />
            {phase.label}
          </span>
          <span role="status" aria-live="polite" className={`text-sm font-semibold ${connection.tone}`}>{connection.label}</span>
        </div>
        <h1 className="mt-3 truncate text-2xl font-black text-white sm:text-3xl">{session.label ?? session.quizTitle}</h1>
        {session.label ? <p className="mt-1 truncate text-base text-slate-300">{session.quizTitle}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2">
          <p className="text-xs font-semibold text-slate-400">رمز الانضمام</p>
          <p dir="ltr" className="mt-1 font-mono text-xl font-black tracking-[0.14em] text-white">{session.joinCode}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-center">
          <p className="text-2xl font-black tabular-nums text-white">{state.participantCount}</p>
          <p className="text-xs font-semibold text-slate-400">مشارك</p>
        </div>
        <Link
          to={`/dashboard/sessions/${session.id}?quizId=${quizId}`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-4 text-sm font-bold text-slate-200 transition-colors hover:border-white/30 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
          الخروج من البث
        </Link>
      </div>
    </header>
  );
}

function LobbyStage({
  state,
  session,
  studentUrl,
  copyState,
  onCopyStudentUrl,
}: {
  state: LiveSessionState;
  session: SessionDetail;
  studentUrl: string;
  copyState: CopyState;
  onCopyStudentUrl: (url: string) => void;
}) {
  const isActive = state.sessionStatus === 'Active';

  return (
    <section aria-labelledby="lobby-heading" className="live-surface live-enter flex min-h-[34rem] flex-col justify-center p-5 sm:p-8 lg:p-10">
      <div className="mx-auto w-full max-w-3xl text-center">
        <p className="text-sm font-bold text-emerald-300">{isActive ? 'القاعة مفتوحة' : 'الجلسة لم تُفعّل بعد'}</p>
        <h2 id="lobby-heading" className="mt-2 text-3xl font-black text-white sm:text-4xl">بانتظار الطلاب</h2>
        <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-300">شارك هذا الرابط أو الرمز مع الطلاب للانضمام.</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-6 sm:flex-row">
          <div className="rounded-xl bg-white p-3">
            <QRCode value={studentUrl} size={148} aria-label="رمز QR لرابط الطلاب" />
          </div>
          <div className="min-w-0 text-center sm:text-start">
            <p className="text-sm font-bold text-slate-400">رمز الانضمام</p>
            <p dir="ltr" className="mt-2 font-mono text-4xl font-black tracking-[0.18em] text-white sm:text-6xl">{session.joinCode}</p>
            <p dir="ltr" className="mt-4 break-all text-sm text-slate-400">{studentUrl}</p>
            <button
              type="button"
              onClick={() => onCopyStudentUrl(studentUrl)}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-emerald-300/35 bg-emerald-300/10 px-5 text-sm font-black text-emerald-100 transition-colors hover:bg-emerald-300/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
              {copyState === 'copied' ? 'تم نسخ رابط الطلاب ✓' : 'نسخ رابط الطلاب'}
            </button>
            {copyState === 'failed' ? <p role="alert" className="mt-2 text-sm text-amber-200">تعذر النسخ تلقائيًا؛ انسخ الرابط الظاهر أعلاه.</p> : null}
          </div>
        </div>

        <div className="mx-auto mt-8 flex max-w-md items-center justify-center divide-x divide-x-reverse divide-white/10 rounded-xl border border-white/10 bg-white/5 py-4">
          <LobbyMetric value={state.participantCount} label="انضم" />
          <LobbyMetric value={state.attemptCount} label="بدأ" />
        </div>
      </div>
    </section>
  );
}

function LobbyMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-28 px-5 text-center">
      <p className="text-3xl font-black tabular-nums text-white">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-400">{label}</p>
    </div>
  );
}

function QuestionStage({ state, tenantId }: { state: LiveSessionState; tenantId: string }) {
  const question = state.currentQuestion;
  if (!question) {
    return <LiveStageMessage title="السؤال غير متاح" description="حدّث الصفحة أو عد إلى تفاصيل الجلسة ثم حاول مجددًا." />;
  }

  const progress = state.totalQuestions > 0 ? ((state.currentQuestionIndex + 1) / state.totalQuestions) * 100 : 0;
  const isClosed = state.phase === 'QuestionClosed';

  return (
    <section aria-labelledby="current-question-heading" className="live-surface live-enter flex min-h-[34rem] min-w-0 flex-col overflow-hidden">
      <div className="border-b border-white/10 px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-black text-emerald-200">السؤال {state.currentQuestionIndex + 1} من {state.totalQuestions}</p>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="rounded-full bg-violet-400/10 px-3 py-1 font-bold text-violet-200">{QUESTION_TYPE_LABELS[question.questionType]}</span>
            <span>{question.points} نقطة</span>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="تقدم المسابقة" aria-valuemin={0} aria-valuemax={state.totalQuestions} aria-valuenow={state.currentQuestionIndex + 1}>
          <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid flex-1 items-center gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="min-w-0">
          {isClosed ? (
            <p role="status" className="mb-4 inline-flex min-h-9 items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-4 text-sm font-black text-amber-100">انتهى السؤال</p>
          ) : null}
          <h2 id="current-question-heading" dir="auto" className="max-w-[34ch] text-2xl font-black leading-relaxed text-white sm:text-3xl lg:text-4xl">{question.prompt}</h2>

          {question.mediaAssetId ? (
            <div className="live-media-preview mt-5 max-w-2xl rounded-xl border border-white/10 bg-black/15 p-4">
              <MediaContentPreview tenantId={tenantId} mediaId={question.mediaAssetId} kind={question.questionType === 'Listening' ? 'Audio' : 'Image'} />
            </div>
          ) : null}

          {question.options.length > 0 ? (
            <ol className="mt-7 grid gap-3 sm:grid-cols-2">
              {question.options.map((option, index) => (
                <li key={option.optionId} dir="auto" className="flex min-h-16 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base font-bold text-slate-100 sm:text-lg">
                  <span dir="ltr" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 font-mono text-sm font-black text-emerald-100">{String.fromCharCode(65 + index)}</span>
                  <span className="min-w-0 break-words">{option.optionText}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        {state.phase === 'QuestionOpen' ? (
          <div className="order-first flex justify-center xl:order-none xl:justify-end">
            <LiveCountdown closesAt={state.questionClosesAt} startedAt={state.questionStartedAt} serverNow={state.serverNow} />
          </div>
        ) : (
          <div className="order-first rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-center xl:order-none">
            <p className="text-3xl font-black tabular-nums text-amber-100">{state.answeredCount}</p>
            <p className="mt-1 text-sm font-semibold text-amber-200">إجابة مسجلة</p>
          </div>
        )}
      </div>

      <AnswerProgress state={state} />
    </section>
  );
}

function AnswerProgress({ state }: { state: LiveSessionState }) {
  const answerableCount = state.attemptCount;
  const percentage = answerableCount > 0 ? Math.min(100, (state.answeredCount / answerableCount) * 100) : 0;
  const label = answerableCount > 0
    ? `${state.answeredCount} من ${answerableCount} أجابوا`
    : 'لم يبدأ أي طالب الإجابة بعد';

  return (
    <div className="border-t border-white/10 bg-black/10 px-5 py-4 sm:px-7">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-100">تقدم الإجابات</p>
        <p aria-live="polite" className="text-sm font-bold tabular-nums text-emerald-200">{label}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="تقدم إجابات الطلاب" aria-valuemin={0} aria-valuemax={answerableCount} aria-valuenow={state.answeredCount}>
        <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-200" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function LiveSidePanel({ state }: { state: LiveSessionState }) {
  const isLobby = state.phase === 'Lobby';
  const title = isLobby
    ? 'المشاركون'
    : state.phase === 'QuestionOpen'
      ? 'الترتيب قبل هذا السؤال'
      : 'لوحة الترتيب';

  return (
    <aside aria-labelledby="live-side-panel-heading" className="live-surface min-w-0 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="live-side-panel-heading" className="text-lg font-black text-white">{title}</h2>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-black text-slate-200">{state.participantCount}</span>
      </div>

      {state.leaderboard.length === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center text-center">
          <p className="text-base font-bold text-slate-200">{isLobby ? 'لم ينضم أحد بعد' : 'لا توجد درجات حتى الآن'}</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">{isLobby ? 'تظهر أسماء الطلاب هنا فور انضمامهم.' : 'يُحدّث الترتيب من الخادم بعد إغلاق السؤال.'}</p>
        </div>
      ) : (
        <ol className="mt-5 space-y-2">
          {state.leaderboard.slice(0, 10).map((entry) => (
            <LeaderboardRow key={`${entry.rank}-${entry.displayName}`} entry={entry} showScore={!isLobby} />
          ))}
        </ol>
      )}
    </aside>
  );
}

function LeaderboardRow({ entry, showScore }: { entry: LiveLeaderboardEntry; showScore: boolean }) {
  const rankClass = entry.rank === 1
    ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
    : entry.rank <= 3
      ? 'border-white/15 bg-white/10 text-white'
      : 'border-white/10 bg-white/5 text-slate-200';

  return (
    <li className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 ${rankClass}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/20 text-sm font-black tabular-nums">{entry.rank}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-bold">{entry.displayName}</span>
      {showScore ? <span dir="ltr" className="font-mono text-sm font-black tabular-nums">{formatScore(entry.score)}</span> : null}
    </li>
  );
}

function FinishedStage({ state, session, quizId }: { state: LiveSessionState; session: SessionDetail; quizId: string }) {
  const highestScore = state.leaderboard[0]?.score ?? null;

  return (
    <section aria-labelledby="finished-heading" className="live-surface live-enter flex min-h-[34rem] flex-col justify-center p-6 sm:p-10">
      <div className="mx-auto w-full max-w-3xl text-center">
        <span aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-3xl text-emerald-100">✓</span>
        <h2 id="finished-heading" className="mt-5 text-3xl font-black text-white sm:text-4xl">انتهت المسابقة</h2>
        <p className="mt-3 text-base text-slate-300">اكتملت {session.quizTitle}، والنتائج النهائية جاهزة للمراجعة.</p>

        <dl className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center divide-x divide-x-reverse divide-white/10 rounded-xl border border-white/10 bg-white/5 py-5">
          <SummaryMetric value={state.participantCount} label="انضم" />
          <SummaryMetric value={state.attemptCount} label="بدأ المسابقة" />
          {highestScore != null ? <SummaryMetric value={formatScore(highestScore)} label="أعلى نتيجة" /> : null}
        </dl>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to={`/dashboard/reports/${session.id}?quizId=${quizId}`} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-emerald-400 px-6 text-sm font-black text-slate-950 transition-colors hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">فتح التقرير</Link>
          <Link to="/dashboard/quizzes" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/15 px-6 text-sm font-black text-slate-200 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">العودة إلى الاختبارات</Link>
        </div>
      </div>
    </section>
  );
}

function SummaryMetric({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="min-w-32 flex-1 px-5 text-center">
      <dt className="text-sm font-semibold text-slate-400">{label}</dt>
      <dd className="mt-2 text-3xl font-black tabular-nums text-white">{value}</dd>
    </div>
  );
}

function HostControlBar({
  state,
  session,
  quizId,
  durationSeconds,
  isPending,
  onDurationChange,
  onOpen,
  onClose,
  onFinish,
}: {
  state: LiveSessionState;
  session: SessionDetail;
  quizId: string;
  durationSeconds: number;
  isPending: boolean;
  onDurationChange: (value: number) => void;
  onOpen: () => void;
  onClose: () => void;
  onFinish: () => void;
}) {
  const canOpen = state.sessionStatus === 'Active'
    && (state.phase === 'Lobby' || state.phase === 'QuestionClosed')
    && state.currentQuestionIndex + 1 < state.totalQuestions;
  const isLastQuestionClosed = state.phase === 'QuestionClosed' && !canOpen;
  const showDuration = state.sessionStatus === 'Active' && (state.phase === 'Lobby' || (state.phase === 'QuestionClosed' && canOpen));
  const showSecondaryFinish = state.sessionStatus === 'Active' && (state.phase === 'Lobby' || (state.phase === 'QuestionClosed' && canOpen));

  return (
    <section aria-label="أوامر المسابقة" className="live-control-bar fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[var(--live-surface-raised)] px-4 py-3 sm:px-6">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {showDuration ? (
            <label className="flex flex-col gap-1.5 text-sm font-bold text-slate-200">
              مدة السؤال
              <span className="flex min-h-11 items-center rounded-lg border border-white/15 bg-white/5 px-3 focus-within:border-emerald-300 focus-within:outline-2 focus-within:outline-emerald-300/40">
                <input
                  aria-label="مدة السؤال بالثواني"
                  type="number"
                  min={5}
                  max={300}
                  value={durationSeconds}
                  onChange={(event) => onDurationChange(Number(event.target.value))}
                  className="w-16 bg-transparent text-center text-base font-black tabular-nums text-white outline-none"
                />
                <span className="text-sm text-slate-400">ثانية</span>
              </span>
            </label>
          ) : null}

          {state.sessionStatus !== 'Active' ? (
            <Link to={`/dashboard/sessions/${session.id}?quizId=${quizId}`} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-amber-300 px-6 text-sm font-black text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100">فعّل الجلسة أولًا</Link>
          ) : state.phase === 'QuestionOpen' ? (
            <LivePrimaryAction tone="amber" isPending={isPending} onClick={onClose}>إغلاق السؤال</LivePrimaryAction>
          ) : isLastQuestionClosed ? (
            <LivePrimaryAction isPending={isPending} onClick={onFinish}>إنهاء المسابقة وعرض النتائج</LivePrimaryAction>
          ) : canOpen ? (
            <LivePrimaryAction isPending={isPending} onClick={onOpen}>{state.phase === 'Lobby' ? 'ابدأ المسابقة' : 'السؤال التالي'}</LivePrimaryAction>
          ) : null}
        </div>

        {showSecondaryFinish ? (
          <button type="button" onClick={onFinish} disabled={isPending} className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-bold text-rose-200 transition-colors hover:bg-rose-300/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:cursor-not-allowed disabled:opacity-60">إنهاء المسابقة</button>
        ) : null}
      </div>
    </section>
  );
}

function LivePrimaryAction({
  children,
  isPending,
  onClick,
  tone = 'emerald',
}: {
  children: ReactNode;
  isPending: boolean;
  onClick: () => void;
  tone?: 'emerald' | 'amber';
}) {
  const toneClass = tone === 'amber'
    ? 'bg-amber-300 hover:bg-amber-200 focus-visible:outline-amber-100'
    : 'bg-emerald-400 hover:bg-emerald-300 focus-visible:outline-emerald-200';
  return (
    <button type="button" onClick={onClick} disabled={isPending} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-7 text-base font-black text-slate-950 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${toneClass}`}>
      {isPending ? <ButtonSpinner /> : null}{children}
    </button>
  );
}

function LiveStageMessage({ title, description }: { title: string; description: string }) {
  return (
    <section className="live-surface flex min-h-[28rem] flex-col items-center justify-center p-8 text-center">
      <h2 className="text-2xl font-black text-white">{title}</h2>
      <p className="mt-3 max-w-lg text-base leading-7 text-slate-300">{description}</p>
    </section>
  );
}

export function LiveHostStatusScreen({ children }: { children: ReactNode }) {
  return (
    <main className="live-host-shell grid min-h-dvh place-items-center p-4" dir="rtl">
      <div className="live-surface w-full max-w-lg p-8 text-center text-slate-200">{children}</div>
    </main>
  );
}

function formatScore(score: number) {
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(score);
}
