import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsIndexPage from './reports-index-page';

vi.mock('../../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/api-client/endpoints')>();
  return {
    ...actual,
    quizzesApi: { ...actual.quizzesApi, list: vi.fn() },
    sessionsApi: { ...actual.sessionsApi, list: vi.fn() },
  };
});

const { quizzesApi, sessionsApi } = await import('../../../data/api-client/endpoints');

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><ReportsIndexPage /></MemoryRouter></QueryClientProvider>);
}

describe('ReportsIndexPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('teacher-platform:active-tenant-id', 'tenant-1');
  });

  it('يقود المستخدم من النشاط إلى نتائج جلسة موجودة', async () => {
    vi.mocked(quizzesApi.list).mockResolvedValue({
      items: [{ id: 'quiz-1', title: 'اختبار العلوم', slug: 'science', status: 'Published', currentPublishedVersionNumber: 1, itemCount: 5, createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
      page: 1, pageSize: 100, totalItems: 1, totalPages: 1,
    });
    vi.mocked(sessionsApi.list).mockResolvedValue({
      items: [{ id: 'session-1', quizId: 'quiz-1', quizTitle: 'اختبار العلوم', joinCode: 'JOIN123', mode: 'SelfPaced', status: 'Finished', label: 'الحصة الأولى', participantCount: 3, attemptCount: 3, activatedAt: '2026-01-01', finishedAt: '2026-01-01', createdAt: '2026-01-01' }],
      page: 1, pageSize: 100, totalItems: 1, totalPages: 1,
    });

    renderPage();

    expect(await screen.findByText('الحصة الأولى')).toBeInTheDocument();
    expect(screen.getAllByText('اختبار العلوم').length).toBeGreaterThan(1);
    expect(screen.getByText('ذاتي الإيقاع')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'فتح النتائج' })).toHaveAttribute('href', '/dashboard/reports/session-1?quizId=quiz-1');
  });

  it('يشرح الخطوة التالية عندما لا توجد أنشطة', async () => {
    vi.mocked(quizzesApi.list).mockResolvedValue({ items: [], page: 1, pageSize: 100, totalItems: 0, totalPages: 0 });
    renderPage();
    expect(await screen.findByText('لا توجد نتائج بعد')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'إنشاء نشاط' })).toBeInTheDocument();
    expect(sessionsApi.list).not.toHaveBeenCalled();
  });
});
