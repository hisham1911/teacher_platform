import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttemptDetail } from '../../../types/reports';
import AttemptDetailPage from './attempt-detail-page';

vi.mock('../../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/api-client/endpoints')>();
  return {
    ...actual,
    reportsApi: {
      ...actual.reportsApi,
      getAttempt: vi.fn(),
    },
    certificatesApi: { ...actual.certificatesApi, list: vi.fn() },
  };
});

const { certificatesApi, reportsApi } = await import('../../../data/api-client/endpoints');
const getAttemptMock = vi.mocked(reportsApi.getAttempt);

const attemptDetail: AttemptDetail = {
  attemptId: 'attempt-1',
  sessionId: 'session-1',
  quizId: 'quiz-1',
  quizTitle: 'اختبار اللغة',
  sessionLabel: 'المجموعة الأولى',
  participantId: 'participant-1',
  displayName: 'مريم',
  status: 'Finished',
  score: 8,
  maxScore: 10,
  percentage: 80,
  passed: true,
  mode: 'SelfPaced',
  maxLevelReached: null,
  totalLevels: null,
  durationMs: 90_000,
  startedAt: '2026-08-09T08:00:00Z',
  finishedAt: '2026-08-09T08:01:30Z',
  questions: [
    {
      quizVersionItemId: 'item-1',
      questionVersionId: 'version-1',
      sortOrder: 0,
      prompt: 'Complete the sentence',
      questionType: 'ShortAnswer',
      pointsPossible: 5,
      answered: true,
      answerSummary: 'went',
      isCorrect: true,
      scoreAwarded: 5,
      answeredAt: '2026-08-09T08:01:00Z',
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard/attempts/attempt-1']}>
        <Routes>
          <Route path="/dashboard/attempts/:attemptId" element={<AttemptDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AttemptDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('teacher-platform:active-tenant-id', 'tenant-1');
    getAttemptMock.mockResolvedValue(attemptDetail);
    vi.mocked(certificatesApi.list).mockResolvedValue([{
      id: 'certificate-1', attemptId: 'attempt-1', certificateNumber: 'CERT-1', studentName: 'مريم',
      quizTitle: 'اختبار اللغة', percentage: 80, status: 'Ready', issuedAt: '2026-08-09T08:02:00Z', failureReason: null,
      publicUrl: 'https://example.test/certificate/token-1',
    }]);
  });

  it('يعرض النتيجة وإجابة كل سؤال كما صححها الخادم', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'نتيجة مريم' })).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Complete the sentence')).toBeInTheDocument();
    expect(screen.getByText('went')).toBeInTheDocument();
    expect(screen.getByText('صحيحة')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'عرض الشهادة' })).toHaveAttribute('href', '/dashboard/certificates?certificateId=certificate-1');
  });

  it('يعرض تقدم المستويات لمحاولة التحدي المتدرج', async () => {
    getAttemptMock.mockResolvedValue({
      ...attemptDetail,
      mode: 'ProgressiveChallenge',
      maxLevelReached: 2,
      totalLevels: 3,
      passed: false,
    });

    renderPage();

    expect(await screen.findByTestId('challenge-attempt-progress')).toHaveTextContent('وصل إلى المستوى 2 من 3');
    expect(screen.getByText(/التحدي المتدرج/)).toBeInTheDocument();
  });
});
