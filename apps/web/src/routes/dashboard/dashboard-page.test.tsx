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
    tenantsApi: { ...actual.tenantsApi, listMine: listMineMock },
    quizzesApi: { ...actual.quizzesApi, list: listQuizzesMock },
  };
});

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><DashboardPage /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  listMineMock.mockResolvedValue([{ id: 't1', name: 'مساحة أحمد', slug: 'ahmed-ws', countryCode: 'SA', timezone: 'Asia/Riyadh', defaultLocale: 'ar', status: 'Active', myRole: 'Owner', settings: { settingsJson: '{}' } }]);
  listQuizzesMock.mockResolvedValue({
    items: [{ id: 'q1', title: 'اختبار قواعد', slug: 'grammar', status: 'Draft', currentPublishedVersionNumber: null, itemCount: 3, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' }],
    page: 1, pageSize: 5, totalItems: 1, totalPages: 1,
  });
});

afterEach(() => { cleanup(); clearSession(); vi.clearAllMocks(); });

describe('DashboardPage', () => {
  it('يعرض مسارًا محايدًا يركز على تجربة الطالب واختصارات العمل الأساسية', async () => {
    establishSession({
      accessToken: 'tok', accessTokenExpiresAtMs: Date.now() + 100_000,
      user: { id: 'u1', email: 'creator@example.com', fullName: 'صانع محتوى تجريبي', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: { id: 't1', name: 'مساحة أحمد', slug: 'ahmed-ws', role: 'Owner', status: 'Active' },
    });

    renderDashboard();
    expect(await screen.findByRole('heading', { name: /^مرحبًا، صانع/ })).toBeInTheDocument();
    expect(screen.getByText('ابدأ بما يحتاجه الطلاب الآن، واترك التفاصيل التقنية خلف الكواليس.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'إنشاء نشاط جديد' })).toHaveAttribute('href', '/dashboard/activities/new');
    expect(screen.getByRole('link', { name: /شاهد بوابة الطالب/ })).toHaveAttribute('href', '/join');
    expect(screen.getByRole('link', { name: /ابنِ مكتبة قابلة لإعادة الاستخدام/ })).toHaveAttribute('href', '/dashboard/questions');
    expect(screen.getByRole('link', { name: /أكواد دخول ثابتة وملف نتائج لكل طالب/ })).toHaveAttribute('href', '/dashboard/students');
    expect(screen.getByRole('link', { name: /اعرف ما حدث بعد النشاط/ })).toHaveAttribute('href', '/dashboard/reports');
    expect(await screen.findByText('اختبار قواعد')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'فتح النشاط' })).toHaveAttribute('href', '/dashboard/activities/q1/manage');
    expect(screen.queryByText(/اختاري|اكتبي|أضيفي|أنشئي|افتحي|كمّلي/)).not.toBeInTheDocument();
  });

  it('يعرض خطأ قابلًا لإعادة المحاولة عند فشل تحميل مساحات العمل', async () => {
    listMineMock.mockRejectedValueOnce(new Error('offline'));
    renderDashboard();
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر تحميل مساحة العمل');
    expect(screen.getByRole('button', { name: 'إعادة المحاولة' })).toBeInTheDocument();
  });
});
