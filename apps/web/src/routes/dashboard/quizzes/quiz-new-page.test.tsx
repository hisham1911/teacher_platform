import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuizNewPage from './quiz-new-page';

vi.mock('../../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/api-client/endpoints')>();
  return {
    ...actual,
    quizzesApi: { ...actual.quizzesApi, create: vi.fn() },
  };
});

const { quizzesApi } = await import('../../../data/api-client/endpoints');
const createQuizMock = vi.mocked(quizzesApi.create);

describe('QuizNewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('teacher-platform:active-tenant-id', 'tenant-1');
  });

  it('ينشئ رابطًا آمنًا تلقائيًا وينقل المعلم مباشرة إلى المنشئ', async () => {
    createQuizMock.mockResolvedValue({
      id: 'quiz-1', title: 'مراجعة الوحدة الأولى', slug: 'quiz-generated', description: null,
      status: 'Draft', currentDraftVersionId: 'draft-1', currentPublishedVersionId: null,
      currentPublishedVersionNumber: null, publicCode: 'public-1', subjectId: null, gradeId: null,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 1,
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard/quizzes/new']}>
          <Routes>
            <Route path="/dashboard/quizzes/new" element={<QuizNewPage />} />
            <Route path="/dashboard/quizzes/:quizId/edit" element={<p>منشئ الاختبار</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText('اسم الاختبار'), { target: { value: 'مراجعة الوحدة الأولى' } });
    fireEvent.click(screen.getByRole('button', { name: 'ابدأ إضافة الأسئلة' }));

    await waitFor(() => expect(createQuizMock).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ title: 'مراجعة الوحدة الأولى', slug: expect.stringMatching(/^quiz-/) }),
    ));
    expect(await screen.findByText('منشئ الاختبار')).toBeInTheDocument();
  });
});
