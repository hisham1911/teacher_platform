import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../data/api-client/http-error';
import type { AttemptResult, StartAttemptResponse } from '../../types/sessions';
import { ProgressivePlayerView, ProgressiveResultView } from './progressive-player';

vi.mock('../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/api-client/endpoints')>();
  return {
    ...actual,
    playerApi: {
      ...actual.playerApi,
      getCurrentQuestion: vi.fn(),
      submitAnswer: vi.fn(),
      finish: vi.fn(),
      getResult: vi.fn(),
      getSurvey: vi.fn(),
      issueCertificate: vi.fn(),
      createParentShare: vi.fn(),
      mediaUrl: vi.fn(() => '/mock-media'),
    },
  };
});

const { playerApi } = await import('../../data/api-client/endpoints');
const getCurrentQuestionMock = vi.mocked(playerApi.getCurrentQuestion);
const submitAnswerMock = vi.mocked(playerApi.submitAnswer);
const finishMock = vi.mocked(playerApi.finish);
const getResultMock = vi.mocked(playerApi.getResult);

function renderView(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function makeAttempt(overrides: Partial<StartAttemptResponse> = {}): StartAttemptResponse {
  return {
    attemptId: 'a-1',
    startedAt: new Date().toISOString(),
    deadlineAt: null,
    serverNow: new Date().toISOString(),
    totalQuestions: 3,
    currentQuestionIndex: 0,
    scoreSoFar: 0,
    status: 'InProgress',
    ...overrides,
  };
}

function makeQuestion(index: number, total = 3) {
  return {
    quizVersionItemId: `q-${index + 1}`,
    index,
    totalQuestions: total,
    questionType: 'MultipleChoice' as const,
    prompt: `سؤال المستوى ${index + 1}`,
    points: 5,
    isRequired: true,
    mediaAssetId: null,
    options: [
      { optionId: `opt-${index + 1}-a`, optionText: 'الخيار أ' },
      { optionId: `opt-${index + 1}-b`, optionText: 'الخيار ب' },
    ],
    alreadyAnswered: false,
    deadlineAt: null,
    serverNow: new Date().toISOString(),
  };
}

describe('ProgressivePlayerView', () => {
  const onFinished = vi.fn();
  const clockSync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(playerApi.getSurvey).mockRejectedValue(new HttpError(404, {}));
  });

  it('يعرض شريط التقدم المختصر والسؤال الحالي للمستوى الأول', async () => {
    getCurrentQuestionMock.mockResolvedValue(makeQuestion(0));
    renderView(
      <ProgressivePlayerView joinCode="JOIN123" attempt={makeAttempt()} quizTitle="تحدي الجمع" clockSync={clockSync} onFinished={onFinished} autoAdvanceMs={0} />,
    );

    expect(await screen.findByTestId('challenge-level-indicator')).toHaveTextContent('المستوى 1 / 3');
    expect(screen.getByTestId('challenge-score-indicator')).toHaveTextContent('النقاط: 0');
    expect(screen.getByRole('heading', { name: 'سؤال المستوى 1' })).toBeInTheDocument();
    expect(screen.getAllByTestId('challenge-option')).toHaveLength(2);
  });

  it('يستأنف من المستوى والنقاط المحفوظين على الخادم (بعد تحديث الصفحة)', async () => {
    getCurrentQuestionMock.mockResolvedValue(makeQuestion(5, 10));
    renderView(
      <ProgressivePlayerView
        joinCode="JOIN123"
        attempt={makeAttempt({ currentQuestionIndex: 5, totalQuestions: 10, scoreSoFar: 450 })}
        quizTitle="تحدي الجمع"
        clockSync={clockSync}
        onFinished={onFinished}
        autoAdvanceMs={0}
      />,
    );

    expect(await screen.findByTestId('challenge-level-indicator')).toHaveTextContent('المستوى 6 / 10');
    expect(screen.getByTestId('challenge-score-indicator')).toHaveTextContent('النقاط: 450');
    expect(screen.getByRole('heading', { name: 'سؤال المستوى 6' })).toBeInTheDocument();
  });

  it('الإجابة الصحيحة تجمع النقاط وتنتقل تلقائيًا للمستوى التالي', async () => {
    getCurrentQuestionMock
      .mockResolvedValueOnce(makeQuestion(0))
      .mockResolvedValueOnce(makeQuestion(1));
    submitAnswerMock.mockResolvedValue({
      attemptId: 'a-1',
      quizVersionItemId: 'q-1',
      isCorrect: true,
      scoreAwarded: 5,
      revision: 1,
      serverNow: new Date().toISOString(),
    });
    renderView(
      <ProgressivePlayerView joinCode="JOIN123" attempt={makeAttempt()} quizTitle="تحدي الجمع" clockSync={clockSync} onFinished={onFinished} autoAdvanceMs={0} />,
    );

    await screen.findByRole('heading', { name: 'سؤال المستوى 1' });
    fireEvent.click(screen.getAllByTestId('challenge-option')[1]!);
    fireEvent.click(screen.getByTestId('challenge-lock-answer'));

    await waitFor(() =>
      expect(submitAnswerMock).toHaveBeenCalledWith('JOIN123', 'a-1', {
        quizVersionItemId: 'q-1',
        answerJson: JSON.stringify({ optionId: 'opt-1-b' }),
      }),
    );

    // النقاط تُجمع من قيمة الخادم، ثم انتقال تلقائي للمستوى التالي دون إنهاء التحدي
    await waitFor(() => expect(screen.getByTestId('challenge-score-indicator')).toHaveTextContent('النقاط: 5'));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'سؤال المستوى 2' })).toBeInTheDocument(), { timeout: 2000 });
    expect(onFinished).not.toHaveBeenCalled();
  });

  it('يعرض تغذية راجعة للإجابة الصحيحة مع زر متابعة فوري', async () => {
    getCurrentQuestionMock.mockResolvedValueOnce(makeQuestion(0)).mockResolvedValueOnce(makeQuestion(1));
    submitAnswerMock.mockResolvedValue({
      attemptId: 'a-1',
      quizVersionItemId: 'q-1',
      isCorrect: true,
      scoreAwarded: 5,
      revision: 1,
      serverNow: new Date().toISOString(),
    });
    renderView(
      <ProgressivePlayerView joinCode="JOIN123" attempt={makeAttempt()} quizTitle="تحدي الجمع" clockSync={clockSync} onFinished={onFinished} autoAdvanceMs={5000} />,
    );

    await screen.findByRole('heading', { name: 'سؤال المستوى 1' });
    fireEvent.click(screen.getAllByTestId('challenge-option')[0]!);
    fireEvent.click(screen.getByTestId('challenge-lock-answer'));

    expect(await screen.findByTestId('challenge-feedback-correct')).toBeInTheDocument();

    // زر المتابعة يتجاوز مهلة الانتقال التلقائي فورًا
    fireEvent.click(screen.getByRole('button', { name: 'متابعة الآن' }));
    expect(await screen.findByRole('heading', { name: 'سؤال المستوى 2' })).toBeInTheDocument();
    expect(onFinished).not.toHaveBeenCalled();
  });

  it('الإجابة الخاطئة تنهي التحدي وتنتقل إلى شاشة النتيجة', async () => {
    getCurrentQuestionMock.mockResolvedValue(makeQuestion(2));
    submitAnswerMock.mockResolvedValue({
      attemptId: 'a-1',
      quizVersionItemId: 'q-3',
      isCorrect: false,
      scoreAwarded: 0,
      revision: 4,
      serverNow: new Date().toISOString(),
    });
    renderView(
      <ProgressivePlayerView
        joinCode="JOIN123"
        attempt={makeAttempt({ currentQuestionIndex: 2, scoreSoFar: 10 })}
        quizTitle="تحدي الجمع"
        clockSync={clockSync}
        onFinished={onFinished}
        autoAdvanceMs={0}
      />,
    );

    await screen.findByRole('heading', { name: 'سؤال المستوى 3' });
    fireEvent.click(screen.getAllByTestId('challenge-option')[0]!);
    fireEvent.click(screen.getByTestId('challenge-lock-answer'));

    expect(await screen.findByTestId('challenge-feedback-wrong')).toBeInTheDocument();
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith('a-1'), { timeout: 2000 });
  });

  it('الإجابة الصحيحة على آخر مستوى تنهي التحدي كمكتمل', async () => {
    getCurrentQuestionMock.mockResolvedValue(makeQuestion(2));
    submitAnswerMock.mockResolvedValue({
      attemptId: 'a-1',
      quizVersionItemId: 'q-3',
      isCorrect: true,
      scoreAwarded: 5,
      revision: 3,
      serverNow: new Date().toISOString(),
    });
    renderView(
      <ProgressivePlayerView
        joinCode="JOIN123"
        attempt={makeAttempt({ currentQuestionIndex: 2, totalQuestions: 3 })}
        quizTitle="تحدي الجمع"
        clockSync={clockSync}
        onFinished={onFinished}
        autoAdvanceMs={0}
      />,
    );

    await screen.findByRole('heading', { name: 'سؤال المستوى 3' });
    fireEvent.click(screen.getAllByTestId('challenge-option')[0]!);
    fireEvent.click(screen.getByTestId('challenge-lock-answer'));

    expect(await screen.findByTestId('challenge-feedback-correct')).toBeInTheDocument();
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith('a-1'), { timeout: 2000 });
  });

  it('ينهي محاولة المستوى عند انتهاء مهلة السؤال ولا يسمح بإجابة متأخرة', async () => {
    getCurrentQuestionMock.mockResolvedValue({
      ...makeQuestion(1),
      deadlineAt: '2026-08-23T12:00:00Z',
      serverNow: '2026-08-23T12:00:01Z',
    });
    finishMock.mockResolvedValue({
      attemptId: 'a-1',
      status: 'TimedOut',
      score: 5,
      maxScore: 15,
      percentage: 33.33,
      passed: false,
      durationMs: 30_000,
      finishedAt: '2026-08-23T12:00:01Z',
    });

    renderView(
      <ProgressivePlayerView
        joinCode="JOIN123"
        attempt={makeAttempt({ currentQuestionIndex: 1, scoreSoFar: 5 })}
        quizTitle="تحدي الجمع"
        clockSync={clockSync}
        clockNow={() => new Date('2026-08-23T12:00:01Z')}
        onFinished={onFinished}
        autoAdvanceMs={0}
      />,
    );

    expect(await screen.findByTestId('challenge-feedback-timeout')).toHaveTextContent('انتهى وقت المستوى');
    await waitFor(() => expect(finishMock).toHaveBeenCalledWith('JOIN123', 'a-1'));
    expect(screen.getByTestId('challenge-lock-answer')).toBeDisabled();
    await waitFor(() => expect(onFinished).toHaveBeenCalledWith('a-1'));
  });

  it('يرفض زر التثبيت قبل اختيار إجابة', async () => {
    getCurrentQuestionMock.mockResolvedValue(makeQuestion(0));
    renderView(
      <ProgressivePlayerView joinCode="JOIN123" attempt={makeAttempt()} quizTitle="تحدي الجمع" clockSync={clockSync} onFinished={onFinished} autoAdvanceMs={0} />,
    );

    await screen.findByRole('heading', { name: 'سؤال المستوى 1' });
    expect(screen.getByTestId('challenge-lock-answer')).toBeDisabled();
    expect(submitAnswerMock).not.toHaveBeenCalled();
  });
});

describe('ProgressiveResultView', () => {
  function makeResult(overrides: Partial<AttemptResult> = {}): AttemptResult {
    return {
      attemptId: 'a-1',
      status: 'Finished',
      displayName: 'طالب متدرج',
      score: 40,
      maxScore: 50,
      percentage: 80,
      passed: true,
      durationMs: 120_000,
      answeredCount: 8,
      totalQuestions: 10,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(playerApi.getSurvey).mockRejectedValue(new HttpError(404, {}));
    vi.mocked(playerApi.issueCertificate).mockRejectedValue(new HttpError(409, {}));
    vi.mocked(playerApi.createParentShare).mockRejectedValue(new HttpError(500, {}));
  });

  it('يعرض شاشة خسارة التحدي مع أعلى مستوى تم الوصول إليه', async () => {
    getResultMock.mockResolvedValue(makeResult({ passed: false, percentage: 30, score: 15, maxScore: 50, answeredCount: 3 }));
    renderView(<ProgressiveResultView joinCode="JOIN123" attemptId="a-1" />);

    expect(await screen.findByTestId('challenge-result-banner')).toHaveTextContent('انتهى التحدي');
    expect(screen.getByTestId('challenge-reached-level')).toHaveTextContent('وصلت إلى المستوى 3 من 10');
    expect(screen.getByText('15 / 50')).toBeInTheDocument();
  });

  it('لا يعرض الفوز عند الخطأ في المستوى الأخير حتى لو تجاوزت النتيجة درجة النجاح', async () => {
    getResultMock.mockResolvedValue(makeResult({ answeredCount: 10, passed: false, percentage: 90, score: 45, maxScore: 50 }));
    renderView(<ProgressiveResultView joinCode="JOIN123" attemptId="a-1" />);

    expect(await screen.findByTestId('challenge-result-banner')).toHaveTextContent('انتهى التحدي');
    expect(screen.queryByText('أكملت التحدي!')).not.toBeInTheDocument();
    expect(screen.getByTestId('challenge-reached-level')).toHaveTextContent('وصلت إلى المستوى 10 من 10');
  });

  it('يعرض حالة انتهاء الوقت والمستوى الذي توقفت عنده المحاولة', async () => {
    getResultMock.mockResolvedValue(makeResult({ status: 'TimedOut', answeredCount: 3, passed: false, percentage: 30, score: 15 }));
    renderView(<ProgressiveResultView joinCode="JOIN123" attemptId="a-1" />);

    expect(await screen.findByTestId('challenge-result-banner')).toHaveTextContent('انتهى الوقت');
    expect(screen.getByTestId('challenge-reached-level')).toHaveTextContent('توقف التحدي عند المستوى 4 من 10');
  });

  it('يعرض شاشة الفوز عند إكمال جميع المستويات', async () => {
    getResultMock.mockResolvedValue(makeResult({ answeredCount: 10, passed: true, percentage: 100, score: 50, maxScore: 50 }));
    renderView(<ProgressiveResultView joinCode="JOIN123" attemptId="a-1" />);

    const banner = await screen.findByTestId('challenge-result-banner');
    expect(banner).toHaveTextContent('أكملت التحدي!');
    expect(screen.queryByTestId('challenge-reached-level')).not.toBeInTheDocument();
    expect(screen.getByText('50 / 50')).toBeInTheDocument();
  });
});
