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

vi.mock('../../../data/api-client/phase2-endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../data/api-client/phase2-endpoints')>();
  return { ...actual, assignmentsApi: { ...actual.assignmentsApi, list: vi.fn() } };
});

const { quizzesApi, sessionsApi } = await import('../../../data/api-client/endpoints');
const { assignmentsApi } = await import('../../../data/api-client/phase2-endpoints');

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><ReportsIndexPage /></MemoryRouter></QueryClientProvider>);
}

describe('ReportsIndexPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('teacher-platform:active-tenant-id', 'tenant-1');
  });

  it('يبدأ بالإسنادات ثم يترك نتائج التشغيلات السريعة متاحة', async () => {
    vi.mocked(assignmentsApi.list).mockResolvedValue([{
      id: 'assignment-1', quizVersionId: 'version-1', quizId: 'quiz-1', activityTitle: 'اختبار العلوم',
      availableAt: null, dueAt: '2026-01-10T00:00:00Z', recipientCount: 8, startedCount: 5, completedCount: 3,
      version: 1, createdAt: '2026-01-01T00:00:00Z',
    }]);
    vi.mocked(quizzesApi.list).mockResolvedValue({
      items: [{ id: 'quiz-1', title: 'اختبار العلوم', slug: 'science', status: 'Published', currentPublishedVersionNumber: 1, itemCount: 5, createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
      page: 1, pageSize: 100, totalItems: 1, totalPages: 1,
    });
    vi.mocked(sessionsApi.list).mockResolvedValue({
      items: [{ id: 'session-1', quizId: 'quiz-1', quizTitle: 'اختبار العلوم', joinCode: 'JOIN123', mode: 'SelfPaced', status: 'Finished', label: 'الحصة الأولى', participantCount: 3, attemptCount: 3, activatedAt: '2026-01-01', finishedAt: '2026-01-01', createdAt: '2026-01-01' }],
      page: 1, pageSize: 100, totalItems: 1, totalPages: 1,
    });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'تقدم الطلاب في الأنشطة المرسلة' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'تقدم الطلاب' })).toHaveAttribute('href', '/dashboard/assignments/assignment-1');
    expect(screen.getByText('الحصة الأولى')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'تشغيلات النشاط السابقة' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'فتح النتائج' })).toHaveAttribute('href', '/dashboard/reports/session-1?quizId=quiz-1');
  });

  it('يشرح الخطوة التالية عندما لا توجد إسنادات أو تشغيلات', async () => {
    vi.mocked(assignmentsApi.list).mockResolvedValue([]);
    vi.mocked(quizzesApi.list).mockResolvedValue({ items: [], page: 1, pageSize: 100, totalItems: 0, totalPages: 0 });
    renderPage();
    expect(await screen.findByText('لا توجد إسنادات بعد')).toBeInTheDocument();
    expect(screen.getByText('لا توجد تشغيلات بعد')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'إنشاء نشاط' }).length).toBeGreaterThan(0);
    expect(sessionsApi.list).not.toHaveBeenCalled();
  });
});
