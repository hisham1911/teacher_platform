import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ActivityNewPage from './activity-new-page';

vi.mock('../../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/api-client/endpoints')>();
  return {
    ...actual,
    quizzesApi: { ...actual.quizzesApi, create: vi.fn() },
  };
});

const { quizzesApi } = await import('../../../data/api-client/endpoints');
const createQuizMock = vi.mocked(quizzesApi.create);

describe('ActivityNewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.setItem('teacher-platform:active-tenant-id', 'tenant-1');
  });

  it('يبدأ بالتحدي المتدرج وينقل المعلمة للمنشئ البسيط بعد تسمية النشاط', async () => {
    createQuizMock.mockResolvedValue({
      id: 'quiz-1', title: 'تحدي كلمات الفضاء', slug: 'spark-generated', description: null,
      status: 'Draft', currentDraftVersionId: 'draft-1', currentPublishedVersionId: null,
      currentPublishedVersionNumber: null, publicCode: 'public-1', subjectId: null, gradeId: null,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', version: 1,
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard/activities/new']}>
          <Routes>
            <Route path="/dashboard/activities/new" element={<ActivityNewPage />} />
            <Route path="/dashboard/activities/:quizId/build" element={<p>المنشئ البسيط</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('radio', { name: /التحدي المتدرج/ })).toBeChecked();
    fireEvent.change(screen.getByLabelText('اكتبي اسمًا بسيطًا'), { target: { value: 'تحدي كلمات الفضاء' } });
    fireEvent.click(screen.getByRole('button', { name: /التالي: أضيفي الأسئلة/ }));

    await waitFor(() => expect(createQuizMock).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ title: 'تحدي كلمات الفضاء', slug: expect.any(String) }),
    ));
    expect(await screen.findByText('المنشئ البسيط')).toBeInTheDocument();
  });
});
