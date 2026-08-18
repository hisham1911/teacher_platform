import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './dashboard-page';
import { establishSession, clearSession } from '../../lib/auth/session';

const listMineMock = vi.hoisted(() => vi.fn());
const listQuizzesMock = vi.hoisted(() => vi.fn());

vi.mock('../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/api-client/endpoints')>();
  return {
    ...actual,
    tenantsApi: {
      ...actual.tenantsApi,
      listMine: listMineMock,
    },
    quizzesApi: {
      ...actual.quizzesApi,
      list: listQuizzesMock,
    },
  };
});

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  listMineMock.mockResolvedValue([
    {
      id: 't1',
      name: 'مساحة أحمد',
      slug: 'ahmed-ws',
      countryCode: 'SA',
      timezone: 'Asia/Riyadh',
      defaultLocale: 'ar',
      status: 'Active',
      myRole: 'Owner',
      settings: { settingsJson: '{}' },
    },
  ]);
  listQuizzesMock.mockResolvedValue({
    items: [{ id: 'q1', title: 'اختبار قواعد', slug: 'grammar', status: 'Draft', currentPublishedVersionNumber: null, itemCount: 3, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' }],
    page: 1,
    pageSize: 5,
    totalItems: 1,
    totalPages: 1,
  });
});

afterEach(() => {
  cleanup();
  clearSession();
  vi.clearAllMocks();
});

describe('DashboardPage', () => {
  it('يعرض المهام الأساسية وأحدث الاختبارات الفعلية بلا بيانات زائفة', async () => {
    establishSession({
      accessToken: 'tok',
      accessTokenExpiresAtMs: Date.now() + 100_000,
      user: { id: 'u1', email: 't@example.com', fullName: 'معلمة تجريبية', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: { id: 't1', name: 'مساحة أحمد', slug: 'ahmed-ws', role: 'Owner', status: 'Active' },
    });

    renderDashboard();

    // انتظر حتى تكتمل بيانات الـworkspaces ويُحسم الـactive
    expect(await screen.findByRole('heading', { name: 'مرحبًا، معلمة تجريبية' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /إنشاء اختبار جديد/ })).toHaveAttribute('href', '/dashboard/quizzes/new');
    expect(screen.getByRole('link', { name: /تشغيل اختبار/ })).toHaveAttribute('href', '/dashboard/quizzes');
    expect(screen.getByRole('link', { name: /عرض النتائج والتقارير/ })).toHaveAttribute('href', '/dashboard/reports');
    expect(await screen.findByText('اختبار قواعد')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'متابعة التحرير' })).toHaveAttribute('href', '/dashboard/quizzes/q1/edit');

    expect(screen.queryByText(/الطلاب النشطون|معدل النجاح/)).not.toBeInTheDocument();
    expect(screen.queryByText(/المرحلة القادمة/)).not.toBeInTheDocument();
  });

  it('يعرض خطأ قابلًا لإعادة المحاولة عند فشل تحميل مساحات العمل', async () => {
    listMineMock.mockRejectedValueOnce(new Error('offline'));
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر تحميل مساحة العمل');
    expect(screen.getByRole('button', { name: 'إعادة المحاولة' })).toBeInTheDocument();
  });
});
