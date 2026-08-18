import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { RootLayout } from './root-layout';
import { clearSession, establishSession } from '../../lib/auth/session';

vi.mock('../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/api-client/endpoints')>();
  return {
    ...actual,
    tenantsApi: { ...actual.tenantsApi, listMine: vi.fn().mockResolvedValue([]) },
  };
});

const { tenantsApi } = await import('../../data/api-client/endpoints');

describe('RootLayout', () => {
  it('يعرض روابط التنقل الأساسية للزائر', () => {
    clearSession();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RootLayout>
            <div>محتوى</div>
          </RootLayout>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('link', { name: 'منصة المعلم' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'الرئيسية' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'تسجيل الدخول' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'إنشاء حساب' })).toBeInTheDocument();
    expect(screen.getByText('محتوى')).toBeInTheDocument();
  });

  it('يعرض Player بلا تنقل أو Footer المعلم', () => {
    clearSession();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/play/JOIN123']}>
          <RootLayout><div>واجهة الطالب المستقلة</div></RootLayout>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('واجهة الطالب المستقلة')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByText('منصة المعلم — إدارة الاختبارات والنتائج')).not.toBeInTheDocument();
  });

  it('يعرض التقارير وقائمة موبايل رأسية للمستخدم المسجل', async () => {
    establishSession({
      accessToken: 'token', accessTokenExpiresAtMs: Date.now() + 10_000,
      user: { id: 'u1', email: 'teacher@example.test', fullName: 'معلمة', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: { id: 'tenant-1', name: 'مدرستي', slug: 'school', role: 'Owner', status: 'Active' },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={queryClient}><MemoryRouter><RootLayout><div>محتوى</div></RootLayout></MemoryRouter></QueryClientProvider>);

    expect(screen.getByText('القائمة الرئيسية')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'النتائج والتقارير' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'النتائج والتقارير' })[0]).toHaveAttribute('href', '/dashboard/reports');
    await waitFor(() => expect(tenantsApi.listMine).toHaveBeenCalled());
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    view.unmount();
    clearSession();
  });
});
