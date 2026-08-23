import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionReport } from '../../../types/reports';
import SessionReportPage from './session-report-page';

vi.mock('../../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/api-client/endpoints')>();
  return {
    ...actual,
    reportsApi: {
      ...actual.reportsApi,
      getSessionReport: vi.fn(),
      listAttempts: vi.fn(),
      exportSessionCsv: vi.fn(),
    },
    sessionsApi: { ...actual.sessionsApi, get: vi.fn() },
    certificatesApi: { ...actual.certificatesApi, list: vi.fn() },
    surveysApi: { ...actual.surveysApi, list: vi.fn(), getResults: vi.fn() },
  };
});

const { certificatesApi, reportsApi, sessionsApi, surveysApi } = await import('../../../data/api-client/endpoints');
const getSessionReportMock = vi.mocked(reportsApi.getSessionReport);
const listAttemptsMock = vi.mocked(reportsApi.listAttempts);

const report: SessionReport = {
  sessionId: 'session-1',
  quizId: 'quiz-1',
  quizTitle: 'اختبار الوحدة الأولى',
  sessionLabel: 'المجموعة الصباحية',
  sessionStatus: 'Finished',
  sessionMode: 'SelfPaced',
  activatedAt: '2026-08-09T08:00:00Z',
  finishedAt: '2026-08-09T09:00:00Z',
  summary: {
    participantCount: 2,
    attemptCount: 2,
    completedCount: 2,
    inProgressCount: 0,
    timedOutCount: 1,
    passedCount: 1,
    failedCount: 1,
    averagePercentage: 75,
    averageDurationMs: 120_000,
  },
  questions: [
    {
      quizVersionItemId: 'item-1',
      questionVersionId: 'version-1',
      sortOrder: 0,
      prompt: 'Choose the correct answer',
      questionType: 'MultipleChoice',
      points: 5,
      answerCount: 2,
      correctCount: 1,
      incorrectCount: 1,
      successPercentage: 50,
      averageScorePercentage: 50,
      difficultySignal: 'ModerateDifficulty',
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard/reports/session-1?quizId=quiz-1']}>
        <Routes>
          <Route path="/dashboard/reports/:sessionId" element={<SessionReportPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SessionReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('teacher-platform:active-tenant-id', 'tenant-1');
    getSessionReportMock.mockResolvedValue(report);
    listAttemptsMock.mockResolvedValue({
      items: [
        {
          attemptId: 'attempt-1',
          participantId: 'participant-1',
          displayName: 'مريم',
          status: 'Finished',
          score: 10,
          maxScore: 10,
          percentage: 100,
          passed: true,
          mode: 'SelfPaced',
          maxLevelReached: null,
          durationMs: 90_000,
          startedAt: '2026-08-09T08:00:00Z',
          finishedAt: '2026-08-09T08:01:30Z',
        },
      ],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    });
    vi.mocked(sessionsApi.get).mockResolvedValue({
      id: 'session-1', quizId: 'quiz-1', quizTitle: report.quizTitle, quizVersionId: 'version-1', quizVersionNumber: 1,
      joinCode: 'JOIN123', mode: 'SelfPaced', status: 'Finished', label: report.sessionLabel,
      activatedAt: report.activatedAt, finishedAt: report.finishedAt, createdAt: report.activatedAt!, updatedAt: report.finishedAt!, version: 1, participants: [],
    });
    vi.mocked(certificatesApi.list).mockResolvedValue([{
      id: 'certificate-1', attemptId: 'attempt-1', certificateNumber: 'CERT-1', studentName: 'مريم',
      quizTitle: report.quizTitle, percentage: 100, status: 'Ready', issuedAt: report.finishedAt!, failureReason: null,
      publicUrl: 'https://example.test/certificate/token-1',
    }]);
    vi.mocked(surveysApi.list).mockResolvedValue([{
      id: 'survey-1', quizId: 'quiz-1', quizTitle: report.quizTitle, title: 'رأيك في الاختبار', status: 'Published',
      questionCount: 1, responseCount: 1, publishedAt: report.finishedAt, updatedAt: report.finishedAt!,
    }]);
    vi.mocked(surveysApi.getResults).mockResolvedValue({
      surveyId: 'survey-1', title: 'رأيك في الاختبار', responseCount: 1,
      questions: [{ id: 'survey-question-1', sortOrder: 0, questionType: 'ShortText', prompt: 'رأيك', answerCount: 1, ratingAverage: null, ratingDistribution: [], optionResults: [], textResponses: ['تجربة واضحة'] }],
    });
  });

  it('يعرض ملخصًا فعليًا وتحليل الأسئلة ورابط تفاصيل المحاولة', async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'تقرير اختبار الوحدة الأولى' })).toBeInTheDocument(),
    );

    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getAllByText('Choose the correct answer').length).toBeGreaterThan(1);
    expect(screen.getAllByText('أداء متوسط').length).toBeGreaterThan(1);
    expect(screen.getByText('ذاتي الإيقاع')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'عرض التفاصيل' })[0]).toHaveAttribute(
      'href',
      '/dashboard/attempts/attempt-1?sessionId=session-1&quizId=quiz-1',
    );
    expect(screen.getAllByRole('link', { name: 'عرض الشهادة' })[0]).toHaveAttribute('href', '/dashboard/certificates?certificateId=certificate-1');
    expect(await screen.findByRole('heading', { name: 'آراء الطلاب' })).toBeInTheDocument();
    expect(await screen.findByText('تجربة واضحة')).toBeInTheDocument();
  });

  it('يعرض نمط التحدي والمستوى الذي وصل إليه الطالب', async () => {
    getSessionReportMock.mockResolvedValue({
      ...report,
      sessionMode: 'ProgressiveChallenge',
      questions: [
        ...report.questions,
        { ...report.questions[0]!, quizVersionItemId: 'item-2', questionVersionId: 'version-2', sortOrder: 1 },
      ],
    });
    listAttemptsMock.mockResolvedValue({
      items: [
        {
          attemptId: 'attempt-progressive',
          participantId: 'participant-progressive',
          displayName: 'متحدية',
          status: 'Finished',
          score: 5,
          maxScore: 10,
          percentage: 50,
          passed: false,
          mode: 'ProgressiveChallenge',
          maxLevelReached: 2,
          durationMs: 45_000,
          startedAt: '2026-08-09T08:00:00Z',
          finishedAt: '2026-08-09T08:00:45Z',
        },
      ],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    });

    renderPage();

    expect(await screen.findByText('التحدي المتدرج')).toBeInTheDocument();
    expect(screen.getAllByTestId('challenge-report-progress')[0]).toHaveTextContent('المستوى 2 من 2');
  });

  it('يعرض حالة فراغ مفيدة عندما لا توجد محاولات', async () => {
    listAttemptsMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });

    renderPage();

    expect(await screen.findByText('لا توجد نتائج بعد')).toBeInTheDocument();
    expect(screen.getByText('ستظهر نتائج الطلاب هنا بعد بدء الاختبار.')).toBeInTheDocument();
  });
});
