import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import DashboardPage from './dashboard-page';
import { establishSession, clearSession } from '../../lib/auth/session';

vi.mock('../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/api-client/endpoints')>();
  return {
    ...actual,
    tenantsApi: {
      ...actual.tenantsApi,
      listMine: vi.fn().mockResolvedValue([
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
      ]),
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

describe('DashboardPage — Phase 1', () => {
  it('يعرض بيانات المستخدم والـWorkspace بدون إحصائيات أو بيانات زائفة', async () => {
    establishSession({
      accessToken: 'tok',
      accessTokenExpiresAtMs: Date.now() + 100_000,
      user: { id: 'u1', email: 't@example.com', fullName: 'معلمة تجريبية', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: { id: 't1', name: 'مساحة أحمد', slug: 'ahmed-ws', role: 'Owner', status: 'Active' },
    });

    renderDashboard();

    // انتظر حتى تكتمل بيانات الـworkspaces ويُحسم الـactive
    await screen.findByText(/مساحة أحمد/);
    const heading = await screen.findByRole('heading', { name: /لوحة التحكم/ });
    expect(heading.textContent).toContain('مساحة أحمد');

    // لا توجد أرقام إحصائية مؤقتة أو قوائم وهمية
    expect(screen.queryByText(/عدد الاختبارات|الطلاب النشطون|معدل النجاح/)).not.toBeInTheDocument();
    clearSession();
  });
});
