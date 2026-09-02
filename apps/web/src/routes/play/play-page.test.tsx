import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../data/api-client/http-error';
import type { LiveSessionState } from '../../types/live';
import type {
  AttemptResult,
  JoinSessionResponse,
  PlayerQuestion,
  PlayerSession,
  StartAttemptResponse,
  SubmitAnswerResponse,
} from '../../types/sessions';
import PlayPage from './play-page';

vi.mock('../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/api-client/endpoints')>();
  return {
    ...actual,
    playerApi: {
      ...actual.playerApi,
      getSession: vi.fn(),
      getCurrentPlayer: vi.fn(),
      join: vi.fn(),
      joinWithStudentCode: vi.fn(),
      startAttempt: vi.fn(),
      getCurrentQuestion: vi.fn(),
      submitAnswer: vi.fn(),
      finish: vi.fn(),
      getResult: vi.fn(),
      getLiveState: vi.fn(),
      getLiveToken: vi.fn(),
      getSurvey: vi.fn(),
      submitSurvey: vi.fn(),
      mediaUrl: vi.fn(() => '/mock-media'),
    },
  };
});

vi.mock('../../features/live/use-live-connection', () => ({
  useLiveConnection: () => 'connected',
}));

const { playerApi } = await import('../../data/api-client/endpoints');
const getSessionMock = vi.mocked(playerApi.getSession);
const getCurrentPlayerMock = vi.mocked(playerApi.getCurrentPlayer);
const joinMock = vi.mocked(playerApi.join);
const managedJoinMock = vi.mocked(playerApi.joinWithStudentCode);
const startAttemptMock = vi.mocked(playerApi.startAttempt);

const activeSession: PlayerSession = {
  title: 'اختبار العلوم',
  description: 'وصف تجريبي',
  instructions: 'اقرأ بعناية',
  passingPercentage: 60,
  timeMode: 'None',
  timeLimitSeconds: null,
  questionCount: 2,
  totalPoints: 10,
  mode: 'SelfPaced',
  status: 'Active',
  canJoin: true,
};

const joinResponse: JoinSessionResponse = {
  participantId: 'p-1',
  displayName: 'لاعب تجريبي',
  attemptId: null,
  attemptStatus: null,
};

const startResponse: StartAttemptResponse = {
  attemptId: 'a-1',
  startedAt: new Date().toISOString(),
  deadlineAt: null,
  serverNow: new Date().toISOString(),
  totalQuestions: 2,
  currentQuestionIndex: 0,
  scoreSoFar: 0,
  status: 'InProgress',
};

function renderPage(joinCode = 'JOIN123') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/play/${joinCode}`]}>
        <Routes>
          <Route path="/play/:joinCode" element={<PlayPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PlayPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(playerApi.getCurrentQuestion).mockReset();
    vi.mocked(playerApi.submitAnswer).mockReset();
    localStorage.clear();
    // بلا كوكي صالح افتراضيًا ⇒ يُعرض نموذج الانضمام (بدون أي تخزين للاسم)
    getCurrentPlayerMock.mockRejectedValue(new HttpError(401, {}));
    vi.mocked(playerApi.getSurvey).mockRejectedValue(new HttpError(404, {}));
  });

  it('يعرض نموذج الانضمام عندما تكون الجلسة نشطة', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'اختبار العلوم' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'ابدأ النشاط' })).toBeInTheDocument();
    expect(getSessionMock).toHaveBeenCalledWith('JOIN123', expect.anything());
  });

  it('يعرض دخول التحدي المتدرج كتجربة مهمة لا كاختبار تقليدي', async () => {
    getSessionMock.mockResolvedValue({ ...activeSession, mode: 'ProgressiveChallenge' });
    renderPage();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'جاهز تبدأ المهمة؟' })).toBeInTheDocument());
    expect(screen.getByText('المستويات')).toBeInTheDocument();
    expect(screen.getByText('النقاط')).toBeInTheDocument();
    expect(screen.queryByText('النجاح')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ادخل إلى المهمة' })).toBeInTheDocument();
    expect(screen.getByLabelText('English Spark')).toBeInTheDocument();
  });

  it('يعرض رسالة انتظار عندما تكون الجلسة مجدولة', async () => {
    getSessionMock.mockResolvedValue({ ...activeSession, status: 'Scheduled', canJoin: false });
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('النشاط لم يبدأ بعد. انتظر إشارة المعلم.')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'ابدأ النشاط' })).not.toBeInTheDocument();
  });

  it('يعرض رسالة انتهاء عندما تكون الجلسة منتهية', async () => {
    getSessionMock.mockResolvedValue({ ...activeSession, status: 'Finished', canJoin: false });
    renderPage();

    await waitFor(() => expect(screen.getByText('انتهى هذا النشاط.')).toBeInTheDocument());
  });

  it('يرفض اسمًا أقصر من حرفين دون استدعاء الخادم', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'ابدأ النشاط' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'أ' } });
    fireEvent.click(screen.getByRole('button', { name: 'ابدأ النشاط' }));

    expect(screen.getByText('الاسم قصير جدًا (حرفان على الأقل).')).toBeInTheDocument();
    expect(joinMock).not.toHaveBeenCalled();
  });

  it('يرفض اسمًا أطول من 50 حرفًا دون استدعاء الخادم', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'ابدأ النشاط' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ا'.repeat(51) } });
    fireEvent.click(screen.getByRole('button', { name: 'ابدأ النشاط' }));

    expect(screen.getByText('الاسم طويل جدًا (50 حرفًا كحد أقصى).')).toBeInTheDocument();
    expect(joinMock).not.toHaveBeenCalled();
  });

  it('ينتقل إلى شاشة الاستعداد بعد انضمام ناجح', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    joinMock.mockResolvedValue(joinResponse);
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'ابدأ النشاط' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'لاعب تجريبي' } });
    fireEvent.click(screen.getByRole('button', { name: 'ابدأ النشاط' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /لاعب تجريبي/ })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'ابدأ الآن' })).toBeInTheDocument();
    expect(joinMock).toHaveBeenCalledWith('JOIN123', { displayName: 'لاعب تجريبي' });
  });

  it('يسمح للطالب بالدخول بكوده ويستخدم الاسم الموثوق من السجل', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    managedJoinMock.mockResolvedValue({ ...joinResponse, displayName: 'سارة من السجل' });
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'لدي كود طالب' }));
    fireEvent.click(screen.getByRole('button', { name: 'لدي كود طالب' }));
    fireEvent.change(screen.getByLabelText('كود الطالب'), { target: { value: 'abcd-1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'دخول بكود الطالب' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: /سارة من السجل/ })).toBeInTheDocument());
    expect(managedJoinMock).toHaveBeenCalledWith('JOIN123', 'ABCD1234');
    expect(joinMock).not.toHaveBeenCalled();
  });

  it('يعرض رسالة 409 عند رفض الانضمام', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    joinMock.mockRejectedValue(new HttpError(409, {}));
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'ابدأ النشاط' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'لاعب متأخر' } });
    fireEvent.click(screen.getByRole('button', { name: 'ابدأ النشاط' }));

    await waitFor(() =>
      expect(screen.getByText('النشاط لم يعد يقبل منضمّين جددًا.')).toBeInTheDocument(),
    );
  });

  it('يستأنف المحاولة تلقائيًا عند وجود محاولة جارية بعد الانضمام', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    joinMock.mockResolvedValue({ ...joinResponse, attemptId: 'a-1', attemptStatus: 'InProgress' });
    startAttemptMock.mockResolvedValue(startResponse);
    vi.mocked(playerApi.getCurrentQuestion).mockReturnValue(new Promise(() => {}));
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'ابدأ النشاط' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'لاعب عائد' } });
    fireEvent.click(screen.getByRole('button', { name: 'ابدأ النشاط' }));

    await waitFor(() => expect(startAttemptMock).toHaveBeenCalledWith('JOIN123'));
  });

  it('يعرض رسالة 400 InvalidAnswerPayload ويدع البطاقة على نفس السؤال ويعيد تفعيل الزر ثم يسمح بإعادة المحاولة', async () => {
    const playerQuestion: PlayerQuestion = {
      quizVersionItemId: 'q-1',
      index: 0,
      totalQuestions: 2,
      questionType: 'MultipleChoice',
      prompt: 'ما عاصمة مصر؟',
      points: 5,
      isRequired: true,
      mediaAssetId: null,
      options: [
        { optionId: 'opt-1', optionText: 'القاهرة' },
        { optionId: 'opt-2', optionText: 'الإسكندرية' },
      ],
      alreadyAnswered: false,
      deadlineAt: null,
      serverNow: new Date().toISOString(),
    };

    getSessionMock.mockResolvedValue(activeSession);
    joinMock.mockResolvedValue(joinResponse);
    startAttemptMock.mockResolvedValue(startResponse);
    vi.mocked(playerApi.getCurrentQuestion).mockResolvedValue(playerQuestion);
    const submitAnswerMock = vi.mocked(playerApi.submitAnswer);
    submitAnswerMock
      .mockRejectedValueOnce(new HttpError(400, { title: 'InvalidAnswerPayload' }))
      .mockResolvedValueOnce({
        attemptId: 'a-1',
        quizVersionItemId: 'q-1',
        isCorrect: true,
        scoreAwarded: 5,
        revision: 1,
        serverNow: new Date().toISOString(),
      });

    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'ابدأ النشاط' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'لاعب تجريبي' } });
    fireEvent.click(screen.getByRole('button', { name: 'ابدأ النشاط' }));

    await waitFor(() => screen.getByRole('button', { name: 'ابدأ الآن' }));
    fireEvent.click(screen.getByRole('button', { name: 'ابدأ الآن' }));

    await waitFor(() => expect(screen.getByText('ما عاصمة مصر؟')).toBeInTheDocument());

    const submit = async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'القاهرة' }));
      fireEvent.click(screen.getByRole('button', { name: 'تثبيت الإجابة' }));
    };

    await submit();
    await waitFor(() =>
      expect(screen.getByText('تعذر حفظ الإجابة — البيانات غير صالحة. أعد المحاولة.')).toBeInTheDocument(),
    );

    expect(screen.getByText('سؤال 1 من 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'السؤال التالي ←' })).toBeInTheDocument();
    expect(screen.queryByText(/إجابة صحيحة/)).not.toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: 'تثبيت الإجابة' });
    expect(submitButton).toBeEnabled();

    await submit();
    await waitFor(() => expect(screen.getByText(/إجابة صحيحة ✓/)).toBeInTheDocument());
    expect(submitAnswerMock).toHaveBeenCalledTimes(2);
  });

  it('يحذر قبل تجاوز سؤال بلا إجابة ويسمح بالتجاوز المتعمد', async () => {
    const firstQuestion: PlayerQuestion = {
      quizVersionItemId: 'q-1', index: 0, totalQuestions: 2, questionType: 'MultipleChoice',
      prompt: 'السؤال الأول', points: 5, isRequired: true, mediaAssetId: null,
      options: [{ optionId: 'o-1', optionText: 'أ' }, { optionId: 'o-2', optionText: 'ب' }],
      alreadyAnswered: false, deadlineAt: null, serverNow: new Date().toISOString(),
    };
    const secondQuestion = { ...firstQuestion, quizVersionItemId: 'q-2', index: 1, prompt: 'السؤال الثاني' };
    getSessionMock.mockResolvedValue(activeSession);
    joinMock.mockResolvedValue(joinResponse);
    startAttemptMock.mockResolvedValue(startResponse);
    vi.mocked(playerApi.getCurrentQuestion)
      .mockResolvedValueOnce(firstQuestion)
      .mockResolvedValueOnce(secondQuestion);

    renderPage();
    await waitFor(() => screen.getByRole('button', { name: 'ابدأ النشاط' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'لاعب تجريبي' } });
    fireEvent.click(screen.getByRole('button', { name: 'ابدأ النشاط' }));
    fireEvent.click(await screen.findByRole('button', { name: 'ابدأ الآن' }));
    await screen.findByText('السؤال الأول');

    fireEvent.click(screen.getByRole('button', { name: 'السؤال التالي ←' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('لم تجب عن هذا السؤال بعد');
    fireEvent.click(screen.getByRole('button', { name: 'ابقَ وأجب' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('السؤال الأول')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'السؤال التالي ←' }));
    fireEvent.click(screen.getByRole('button', { name: 'تجاوز هذا السؤال' }));
    expect(await screen.findByText('السؤال الثاني')).toBeInTheDocument();
  });

  it('prevents finishing the final question while its answer is still being saved', async () => {
    const playerQuestion: PlayerQuestion = {
      quizVersionItemId: 'q-final',
      index: 0,
      totalQuestions: 1,
      questionType: 'MultipleChoice',
      prompt: 'السؤال الأخير',
      points: 5,
      isRequired: true,
      mediaAssetId: null,
      options: [
        { optionId: 'opt-1', optionText: 'الإجابة الأولى' },
        { optionId: 'opt-2', optionText: 'الإجابة الثانية' },
      ],
      alreadyAnswered: false,
      deadlineAt: null,
      serverNow: new Date().toISOString(),
    };
    let completeAnswer: ((response: SubmitAnswerResponse) => void) | undefined;

    getSessionMock.mockResolvedValue({ ...activeSession, questionCount: 1 });
    joinMock.mockResolvedValue(joinResponse);
    startAttemptMock.mockResolvedValue({ ...startResponse, totalQuestions: 1 });
    vi.mocked(playerApi.getCurrentQuestion).mockResolvedValue(playerQuestion);
    vi.mocked(playerApi.submitAnswer).mockReturnValue(
      new Promise<SubmitAnswerResponse>((resolve) => {
        completeAnswer = resolve;
      }),
    );

    renderPage();
    await waitFor(() => screen.getByRole('button', { name: 'ابدأ النشاط' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'لاعب تجريبي' } });
    fireEvent.click(screen.getByRole('button', { name: 'ابدأ النشاط' }));
    await waitFor(() => screen.getByRole('button', { name: 'ابدأ الآن' }));
    fireEvent.click(screen.getByRole('button', { name: 'ابدأ الآن' }));
    await waitFor(() => expect(screen.getByText('السؤال الأخير')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('radio', { name: 'الإجابة الأولى' }));
    fireEvent.click(screen.getByRole('button', { name: 'تثبيت الإجابة' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'إنهاء النشاط' })).toBeDisabled());
    expect(playerApi.finish).not.toHaveBeenCalled();

    completeAnswer?.({
      attemptId: 'a-1',
      quizVersionItemId: 'q-final',
      isCorrect: true,
      scoreAwarded: 5,
      revision: 1,
      serverNow: new Date().toISOString(),
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'إنهاء النشاط' })).toBeEnabled());
  });

  it('يستعيد الجلسة من السيرفر عبر الكوكي ويستأنف المحاولة الجارية دون تفاعل', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    getCurrentPlayerMock.mockResolvedValue({ ...joinResponse, attemptId: 'a-1', attemptStatus: 'InProgress' });
    startAttemptMock.mockResolvedValue(startResponse);
    vi.mocked(playerApi.getCurrentQuestion).mockReturnValue(new Promise(() => {}));
    renderPage();

    await waitFor(() => expect(startAttemptMock).toHaveBeenCalledWith('JOIN123'));
    expect(screen.queryByRole('button', { name: 'ابدأ النشاط' })).not.toBeInTheDocument();
    expect(getCurrentPlayerMock).toHaveBeenCalledWith('JOIN123');
    expect(localStorage.getItem('tp-player-name')).toBeNull();
  });

  it('يستعيد ويعرض النتيجة مباشرة لمحاولة منتهية بعد إعادة التحميل', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    getCurrentPlayerMock.mockResolvedValue({ ...joinResponse, attemptId: 'a-1', attemptStatus: 'Finished' });
    const result: AttemptResult = {
      attemptId: 'a-1',
      status: 'Finished',
      displayName: 'لاعب سابق',
      score: 5,
      maxScore: 10,
      percentage: 50,
      passed: false,
      durationMs: 12_000,
      answeredCount: 1,
      totalQuestions: 2,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };
    vi.mocked(playerApi.getResult).mockResolvedValue(result);
    renderPage();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'لاعب سابق' })).toBeInTheDocument());
    expect(screen.getByText('لم تصل إلى درجة النجاح هذه المرة')).toBeInTheDocument();
    expect(screen.getByText('5 / 10')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ابدأ النشاط' })).not.toBeInTheDocument();
    expect(joinMock).not.toHaveBeenCalled();
    expect(getCurrentPlayerMock).toHaveBeenCalledWith('JOIN123');
  });

  it('يعرض نموذج الانضمام والاسم منتهي محليًا عند 401 (لا كوكي صالح)', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    getCurrentPlayerMock.mockRejectedValue(new HttpError(401, {}));
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'ابدأ النشاط' }));
    expect(getCurrentPlayerMock).toHaveBeenCalledWith('JOIN123');
    expect(localStorage.getItem('tp-player-name')).toBeNull();
  });

  it('لا يكتب أي شيء في localStorage بعد انضمام ناجح', async () => {
    getSessionMock.mockResolvedValue(activeSession);
    joinMock.mockResolvedValue(joinResponse);
    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'ابدأ النشاط' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'لاعب تجريبي' } });
    fireEvent.click(screen.getByRole('button', { name: 'ابدأ النشاط' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /لاعب تجريبي/ })).toBeInTheDocument(),
    );
    expect(localStorage.getItem('tp-player-name')).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('يستعيد اللاعب المباشر من الكوكي ويعرض قاعة الانتظار بلا نتيجة مبكرة', async () => {
    const liveSession: PlayerSession = { ...activeSession, mode: 'Live' };
    const liveState: LiveSessionState = {
      sessionId: 'session-live',
      sessionStatus: 'Active',
      phase: 'Lobby',
      currentQuestionIndex: -1,
      totalQuestions: 2,
      questionStartedAt: null,
      questionClosesAt: null,
      serverNow: '2026-08-09T12:00:00Z',
      revision: 0,
      participantCount: 3,
      attemptCount: 2,
      answeredCount: 0,
      currentQuestion: null,
      leaderboard: [],
    };
    getSessionMock.mockResolvedValue(liveSession);
    getCurrentPlayerMock.mockResolvedValue({
      ...joinResponse,
      attemptId: 'attempt-live',
      attemptStatus: 'InProgress',
    });
    vi.mocked(playerApi.getLiveState).mockResolvedValue(liveState);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'أنت داخل قاعة الانتظار' })).toBeInTheDocument();
    expect(screen.getByText('انضم 3 مشارك')).toBeInTheDocument();
    expect(screen.queryByText(/إجابة صحيحة/)).not.toBeInTheDocument();
    expect(startAttemptMock).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it('يعرض شاشة استعداد التحدي المتدرج بعد الانضمام ثم يبدأ من المستوى الأول', async () => {
    const challengeSession: PlayerSession = { ...activeSession, mode: 'ProgressiveChallenge' };
    getSessionMock.mockResolvedValue(challengeSession);
    joinMock.mockResolvedValue(joinResponse);
    startAttemptMock.mockResolvedValue({ ...startResponse, scoreSoFar: 0 });
    vi.mocked(playerApi.getCurrentQuestion).mockResolvedValue({
      quizVersionItemId: 'q-1',
      index: 0,
      totalQuestions: 2,
      questionType: 'MultipleChoice',
      prompt: 'مستوى أول',
      points: 5,
      isRequired: true,
      mediaAssetId: null,
      options: [
        { optionId: 'opt-1', optionText: 'أ' },
        { optionId: 'opt-2', optionText: 'ب' },
      ],
      alreadyAnswered: false,
      deadlineAt: null,
      serverNow: new Date().toISOString(),
    });

    renderPage();

    await waitFor(() => screen.getByRole('button', { name: 'ادخل إلى المهمة' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'متحدٍّ جديد' } });
    fireEvent.click(screen.getByRole('button', { name: 'ادخل إلى المهمة' }));

    expect(await screen.findByTestId('challenge-ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ابدأ المهمة' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ابدأ المهمة' }));

    expect(await screen.findByTestId('challenge-level-indicator')).toHaveTextContent('المستوى 1 / 2');
    expect(startAttemptMock).toHaveBeenCalledWith('JOIN123');
  });

  it('يستأنف محاولة تحدٍ متدرج قائمة مباشرة من المستوى المحفوظ', async () => {
    const challengeSession: PlayerSession = { ...activeSession, mode: 'ProgressiveChallenge' };
    getSessionMock.mockResolvedValue(challengeSession);
    getCurrentPlayerMock.mockResolvedValue({ ...joinResponse, attemptId: 'a-9', attemptStatus: 'InProgress' });
    startAttemptMock.mockResolvedValue({ ...startResponse, attemptId: 'a-9', currentQuestionIndex: 1, scoreSoFar: 5 });
    vi.mocked(playerApi.getCurrentQuestion).mockResolvedValue({
      quizVersionItemId: 'q-2',
      index: 1,
      totalQuestions: 2,
      questionType: 'TrueFalse',
      prompt: 'مستوى ثانٍ',
      points: 5,
      isRequired: true,
      mediaAssetId: null,
      options: [
        { optionId: 'opt-3', optionText: 'صح' },
        { optionId: 'opt-4', optionText: 'خطأ' },
      ],
      alreadyAnswered: false,
      deadlineAt: null,
      serverNow: new Date().toISOString(),
    });

    renderPage();

    expect(await screen.findByTestId('challenge-level-indicator')).toHaveTextContent('المستوى 2 / 2');
    expect(screen.getByTestId('challenge-score-indicator')).toHaveTextContent('النقاط: 5');
    expect(screen.getByRole('heading', { name: 'مستوى ثانٍ' })).toBeInTheDocument();
  });

  it('يعرض نتيجة التحدي المتدرج للمحاولة المنتهية بدل نتيجة الاختبار العادية', async () => {
    const challengeSession: PlayerSession = { ...activeSession, mode: 'ProgressiveChallenge' };
    getSessionMock.mockResolvedValue(challengeSession);
    getCurrentPlayerMock.mockResolvedValue({ ...joinResponse, attemptId: 'a-9', attemptStatus: 'Finished' });
    vi.mocked(playerApi.getResult).mockResolvedValue({
      attemptId: 'a-9',
      status: 'Finished',
      displayName: 'متحدٍ سابق',
      score: 5,
      maxScore: 10,
      percentage: 50,
      passed: false,
      durationMs: 60_000,
      answeredCount: 1,
      totalQuestions: 2,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    });

    renderPage();

    expect(await screen.findByTestId('challenge-result-banner')).toBeInTheDocument();
    expect(screen.getByTestId('challenge-reached-level')).toHaveTextContent('وصلت إلى المستوى 1 من 2');
    expect(screen.queryByText('لم تصل إلى درجة النجاح هذه المرة')).not.toBeInTheDocument();
  });
});
