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
  };
});

const { reportsApi } = await import('../../../data/api-client/endpoints');
const getSessionReportMock = vi.mocked(reportsApi.getSessionReport);
const listAttemptsMock = vi.mocked(reportsApi.listAttempts);

const report: SessionReport = {
  sessionId: 'session-1',
  quizId: 'quiz-1',
  quizTitle: 'اختبار الوحدة الأولى',
  sessionLabel: 'المجموعة الصباحية',
  sessionStatus: 'Finished',
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
  });

  it('يعرض ملخصًا فعليًا وتحليل الأسئلة ورابط تفاصيل المحاولة', async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'تقرير اختبار الوحدة الأولى' })).toBeInTheDocument(),
    );

    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Choose the correct answer')).toBeInTheDocument();
    expect(screen.getByText('أداء متوسط')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'مريم' })).toHaveAttribute(
      'href',
      '/dashboard/attempts/attempt-1?sessionId=session-1&quizId=quiz-1',
    );
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

    expect(await screen.findByText('لا توجد محاولات بعد')).toBeInTheDocument();
    expect(screen.getByText('ستظهر النتائج هنا بعد أن يبدأ الطلاب الاختبار.')).toBeInTheDocument();
  });
});
