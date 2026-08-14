import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizDraft } from '../../../types/quizzes';
import QuizEditPage from './quiz-edit-page';

vi.mock('../../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/api-client/endpoints')>();
  return {
    ...actual,
    quizzesApi: {
      ...actual.quizzesApi,
      getDraft: vi.fn(),
      updateDraft: vi.fn(),
      addItem: vi.fn(),
      removeItem: vi.fn(),
      reorderItems: vi.fn(),
      updateItem: vi.fn(),
      useLatestItemVersion: vi.fn(),
    },
    questionsApi: {
      ...actual.questionsApi,
      list: vi.fn(),
    },
  };
});

const { quizzesApi, questionsApi } = await import('../../../data/api-client/endpoints');
const getDraftMock = vi.mocked(quizzesApi.getDraft);
const updateDraftMock = vi.mocked(quizzesApi.updateDraft);
const useLatestMock = vi.mocked(quizzesApi.useLatestItemVersion);
const listQuestionsMock = vi.mocked(questionsApi.list);

const TENANT_ID = 'tenant-1';
const QUIZ_ID = 'quiz-1';

function makeDraft(overrides?: Partial<QuizDraft['items'][0]>): QuizDraft {
  return {
    id: 'draft-1',
    quizId: QUIZ_ID,
    versionNumber: 1,
    title: 'اختبار',
    description: null,
    instructions: null,
    passingPercentage: 50,
    timeMode: 'None',
    timeLimitSeconds: null,
    shuffleQuestions: false,
    shuffleOptions: false,
    theme: {
      template: 'default',
      primaryColor: '#0284c7',
      secondaryColor: '#0f172a',
      backgroundColor: '#ffffff',
    },
    items: [
      {
        id: 'item-1',
        questionVersionId: 'qv-1',
        questionId: 'q-1',
        sortOrder: 1,
        points: 5,
        isRequired: true,
        questionType: 'MultipleChoice',
        prompt: 'سؤال تجريبي',
        explanation: null,
        difficulty: 'Easy',
        language: 'ar',
        configJson: '{}',
        mediaAssetId: null,
        options: [{ sortOrder: 1, optionText: 'أ', isCorrect: true }],
        pinnedVersionNumber: 1,
        latestVersionNumber: 1,
        sourceQuestionArchived: false,
        ...overrides,
      },
    ],
    totalPoints: 5,
    version: 3,
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/dashboard/quizzes/${QUIZ_ID}/edit`]}>
        <Routes>
          <Route path="/dashboard/quizzes/:quizId/edit" element={<QuizEditPage />} />
          <Route path="/dashboard/quizzes/:quizId/preview" element={<p>صفحة المعاينة</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('QuizEditPage — GAP-C: استخدام أحدث نسخة', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('teacher-platform:active-tenant-id', TENANT_ID);
    listQuestionsMock.mockResolvedValue({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
  });

  it('يعرض الزر عندما توجد نسخة أحدث والسؤال غير مؤرشف', async () => {
    getDraftMock.mockResolvedValue(makeDraft({ pinnedVersionNumber: 1, latestVersionNumber: 2 }));

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /استخدام أحدث نسخة للسؤال 1/ })).toBeInTheDocument(),
    );
  });

  it('يخفي الزر عندما تكون النسخة المثبتة هي الأحدث', async () => {
    getDraftMock.mockResolvedValue(makeDraft({ pinnedVersionNumber: 2, latestVersionNumber: 2 }));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/سؤال تجريبي/)).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: /استخدام أحدث نسخة/ })).not.toBeInTheDocument();
  });

  it('يخفي الزر عندما يكون السؤال المصدر مؤرشفًا', async () => {
    getDraftMock.mockResolvedValue(
      makeDraft({ pinnedVersionNumber: 1, latestVersionNumber: 2, sourceQuestionArchived: true }),
    );

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/سؤال تجريبي/)).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: /استخدام أحدث نسخة/ })).not.toBeInTheDocument();
  });

  it('يستدعي useLatestItemVersion مع baseVersion الصحيح عند النقر', async () => {
    const draft = makeDraft({ pinnedVersionNumber: 1, latestVersionNumber: 2 });
    getDraftMock.mockResolvedValue(draft);
    useLatestMock.mockResolvedValue({
      ...draft,
      items: [{ ...draft.items[0]!, pinnedVersionNumber: 2, latestVersionNumber: 2 }],
      version: 4,
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /استخدام أحدث نسخة للسؤال 1/ })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /استخدام أحدث نسخة للسؤال 1/ }));

    await waitFor(() =>
      expect(useLatestMock).toHaveBeenCalledWith(TENANT_ID, QUIZ_ID, 'item-1', { baseVersion: 3 }),
    );
  });

  it('يحفظ أحدث قيم الوقت قبل الانتقال إلى المعاينة', async () => {
    const draft = makeDraft();
    getDraftMock.mockResolvedValue(draft);
    updateDraftMock.mockResolvedValue({
      ...draft,
      timeMode: 'TotalTime',
      timeLimitSeconds: 300,
      version: 4,
    });

    renderPage();
    await screen.findByDisplayValue('اختبار');

    fireEvent.change(screen.getByLabelText('وضع الوقت'), { target: { value: 'TotalTime' } });
    fireEvent.change(screen.getByLabelText('الوقت الإجمالي (ثانية)'), { target: { value: '300' } });
    fireEvent.click(screen.getAllByRole('link', { name: 'معاينة' })[0]!);

    await waitFor(() => expect(updateDraftMock).toHaveBeenCalledWith(
      TENANT_ID,
      QUIZ_ID,
      expect.objectContaining({ timeMode: 'TotalTime', timeLimitSeconds: 300, baseVersion: 3 }),
    ));
    expect(await screen.findByText('صفحة المعاينة')).toBeInTheDocument();
  });
});
