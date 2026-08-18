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
const reorderItemsMock = vi.mocked(quizzesApi.reorderItems);
const removeItemMock = vi.mocked(quizzesApi.removeItem);
const listQuestionsMock = vi.mocked(questionsApi.list);

const TENANT_ID = 'tenant-1';
const QUIZ_ID = 'quiz-1';

function makeDraft(
  overrides?: Partial<QuizDraft['items'][0]>,
  publicationState: QuizDraft['publicationState'] = 'NeverPublished',
): QuizDraft {
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
    publicationState,
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
          <Route path="/dashboard/quizzes/:quizId/publish" element={<p>صفحة النشر</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('QuizEditPage', () => {
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

  it('يحفظ أحدث درجة نجاح قبل الانتقال السريع إلى المعاينة', async () => {
    const draft = makeDraft();
    getDraftMock.mockResolvedValue(draft);
    updateDraftMock.mockResolvedValue({
      ...draft,
      passingPercentage: 60,
      version: 4,
    });

    renderPage();
    await screen.findByDisplayValue('اختبار');

    fireEvent.change(screen.getByLabelText('درجة النجاح (%)'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('link', { name: 'معاينة' }));

    await waitFor(() => expect(updateDraftMock).toHaveBeenCalledWith(
      TENANT_ID,
      QUIZ_ID,
      expect.objectContaining({ passingPercentage: 60, baseVersion: 3 }),
    ));
    expect(await screen.findByText('صفحة المعاينة')).toBeInTheDocument();
  });

  it('يحفظ أحدث مدة قبل الانتقال السريع إلى النشر', async () => {
    const draft = makeDraft();
    getDraftMock.mockResolvedValue(draft);
    updateDraftMock.mockResolvedValue({ ...draft, timeMode: 'TotalTime', timeLimitSeconds: 300, version: 4 });

    renderPage();
    await screen.findByDisplayValue('اختبار');

    fireEvent.change(screen.getByLabelText('مدة الاختبار'), { target: { value: 'TotalTime' } });
    fireEvent.change(screen.getByLabelText('المدة بالدقائق'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('link', { name: 'نشر الاختبار' }));

    await waitFor(() => expect(updateDraftMock).toHaveBeenCalledWith(
      TENANT_ID,
      QUIZ_ID,
      expect.objectContaining({ timeMode: 'TotalTime', timeLimitSeconds: 300, baseVersion: 3 }),
    ));
    expect(await screen.findByText('صفحة النشر')).toBeInTheDocument();
  });

  it.each([
    ['NeverPublished', 'نشر الاختبار', `/dashboard/quizzes/${QUIZ_ID}/publish`],
    ['PublishedWithChanges', 'نشر التحديثات', `/dashboard/quizzes/${QUIZ_ID}/publish`],
    ['PublishedCurrent', 'إنشاء جلسة', `/dashboard/quizzes/${QUIZ_ID}/sessions`],
  ] as const)('يعرض الإجراء المناسب لحالة النشر %s', async (publicationState, label, href) => {
    getDraftMock.mockResolvedValue(makeDraft(undefined, publicationState));
    renderPage();

    const action = await screen.findByRole('link', { name: label });
    expect(action).toHaveAttribute('href', href);
  });

  it('يحافظ على الترتيب والتعديل والإزالة مع تسلسل بصري أخف', async () => {
    const firstDraft = makeDraft();
    const secondItem = {
      ...firstDraft.items[0]!,
      id: 'item-2',
      questionId: 'q-2',
      questionVersionId: 'qv-2',
      sortOrder: 2,
      prompt: 'السؤال الثاني',
    };
    const twoItemDraft = { ...firstDraft, items: [firstDraft.items[0]!, secondItem], totalPoints: 10 };
    getDraftMock.mockResolvedValue(twoItemDraft);
    reorderItemsMock.mockResolvedValue(twoItemDraft);
    removeItemMock.mockResolvedValue({ ...twoItemDraft, items: [firstDraft.items[0]!], totalPoints: 5 });

    renderPage();

    expect(await screen.findByRole('button', { name: 'نقل السؤال 1 لأعلى' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'نقل السؤال 2 لأسفل' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'تعديل السؤال 1' })).toHaveAttribute('href', '/dashboard/questions/q-1/edit');

    fireEvent.click(screen.getByRole('button', { name: 'نقل السؤال 1 لأسفل' }));
    await waitFor(() => expect(reorderItemsMock).toHaveBeenCalledWith(
      TENANT_ID,
      QUIZ_ID,
      { orderedItemIds: ['item-2', 'item-1'] },
    ));

    const removeButton = screen.getByRole('button', { name: 'إزالة السؤال 2 من الاختبار' });
    await waitFor(() => expect(removeButton).toBeEnabled());
    fireEvent.click(removeButton);
    await waitFor(() => expect(removeItemMock).toHaveBeenCalledWith(TENANT_ID, QUIZ_ID, 'item-2'));
  });
});
