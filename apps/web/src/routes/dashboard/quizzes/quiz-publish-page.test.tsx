import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishQuizResponse, QuizDraft, QuizVersionSummary } from '../../../types/quizzes';
import QuizPublishPage from './quiz-publish-page';

vi.mock('../../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/api-client/endpoints')>();
  return {
    ...actual,
    quizzesApi: {
      ...actual.quizzesApi,
      getDraft: vi.fn(),
      listVersions: vi.fn(),
      publish: vi.fn(),
      getShare: vi.fn(),
    },
  };
});

const { quizzesApi } = await import('../../../data/api-client/endpoints');
const getDraftMock = vi.mocked(quizzesApi.getDraft);
const listVersionsMock = vi.mocked(quizzesApi.listVersions);
const publishMock = vi.mocked(quizzesApi.publish);
const getShareMock = vi.mocked(quizzesApi.getShare);

const TENANT_ID = 'tenant-1';
const QUIZ_ID = 'quiz-1';

const draft: QuizDraft = {
  id: 'draft-1',
  quizId: QUIZ_ID,
  versionNumber: 1,
  title: 'اختبار العلوم',
  description: null,
  instructions: null,
  passingPercentage: 50,
  timeMode: 'None',
  timeLimitSeconds: null,
  shuffleQuestions: false,
  shuffleOptions: false,
  theme: {
    template: 'default',
    primaryColor: '#1e40af',
    secondaryColor: '#64748b',
    backgroundColor: '#ffffff',
  },
  items: [
    {
      id: 'item-1',
      questionVersionId: 'qv-1',
      questionId: 'q-1',
      sortOrder: 1,
      points: 10,
      isRequired: true,
      questionType: 'MultipleChoice',
      prompt: 'ما عاصمة مصر؟',
      explanation: null,
      difficulty: 'Easy',
      language: 'ar',
      configJson: '{}',
      mediaAssetId: null,
      options: [{ sortOrder: 1, optionText: 'القاهرة', isCorrect: true }],
      pinnedVersionNumber: 1,
      latestVersionNumber: 1,
      sourceQuestionArchived: false,
    },
  ],
  totalPoints: 10,
  version: 7,
  updatedAt: '2026-01-01T00:00:00Z',
};

const publishResponse: PublishQuizResponse = {
  quizId: QUIZ_ID,
  publishedVersionId: 'pv-1',
  versionNumber: 2,
  publishedAt: '2026-01-02T00:00:00Z',
  checksum: 'abcdef0123456789abcdef0123456789',
  publicCode: 'pub-code-1',
  shareUrl: 'https://example.com/q/pub-code-1',
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/dashboard/quizzes/${QUIZ_ID}/publish`]}>
        <Routes>
          <Route path="/dashboard/quizzes/:quizId/publish" element={<QuizPublishPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('QuizPublishPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('teacher-platform:active-tenant-id', TENANT_ID);
    listVersionsMock.mockResolvedValue([] as QuizVersionSummary[]);
    getShareMock.mockRejectedValue(new Error('not published'));
  });

  it('يعرض رابط المشاركة ورمز QR بعد نشر ناجح', async () => {
    getDraftMock.mockResolvedValue(draft);
    publishMock.mockResolvedValue(publishResponse);

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /نشر: اختبار العلوم/ })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'نشر الآن' }));

    await waitFor(() =>
      expect(screen.getByText('تم النشر بنجاح ✓')).toBeInTheDocument(),
    );

    expect(screen.getByText('https://example.com/q/pub-code-1')).toBeInTheDocument();
    expect(screen.getByText('pub-code-1')).toBeInTheDocument();

    const qrContainer = screen.getByTestId('share-qr-code');
    expect(qrContainer.querySelector('svg')).not.toBeNull();
  });

  it('يعرض رمز QR لاختبار منشور مسبقًا عبر getShare', async () => {
    getDraftMock.mockResolvedValue(draft);
    listVersionsMock.mockResolvedValue([
      {
        id: 'pv-1',
        versionNumber: 2,
        status: 'Published',
        itemCount: 1,
        totalPoints: 10,
        publishedAt: '2026-01-02T00:00:00Z',
        checksum: 'abc',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ] as QuizVersionSummary[]);
    getShareMock.mockResolvedValue({
      quizId: QUIZ_ID,
      publicCode: 'pub-code-1',
      shareUrl: 'https://example.com/q/pub-code-1',
      status: 'Published',
      publishedVersionNumber: 2,
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId('share-qr-code').querySelector('svg')).not.toBeNull(),
    );
    expect(screen.getAllByText('https://example.com/q/pub-code-1').length).toBeGreaterThan(0);
  });
});
