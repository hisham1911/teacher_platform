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

    expect(screen.getByRole('link', { name: 'English Spark' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'الرئيسية' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'دخول المعلمة' })).toBeInTheDocument();
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
    expect(screen.queryByText('English Spark — Learn • Play • Explore')).not.toBeInTheDocument();
  });

  it('يعرض Live Host في وضع تركيز بلا تنقل أو Footer المعلم', () => {
    establishSession({
      accessToken: 'token', accessTokenExpiresAtMs: Date.now() + 10_000,
      user: { id: 'u1', email: 'teacher@example.test', fullName: 'معلمة', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: { id: 'tenant-1', name: 'مدرستي', slug: 'school', role: 'Owner', status: 'Active' },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard/sessions/session-1/live']}>
          <RootLayout><div>واجهة المضيف المستقلة</div></RootLayout>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('واجهة المضيف المستقلة')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByText('English Spark — Learn • Play • Explore')).not.toBeInTheDocument();
    view.unmount();
    clearSession();
  });

  it('يعرض النتائج والتنقل السريع للمستخدم المسجل', async () => {
    establishSession({
      accessToken: 'token', accessTokenExpiresAtMs: Date.now() + 10_000,
      user: { id: 'u1', email: 'teacher@example.test', fullName: 'معلمة', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: { id: 'tenant-1', name: 'مدرستي', slug: 'school', role: 'Owner', status: 'Active' },
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/dashboard/attempts/attempt-1']}><RootLayout><div>محتوى</div></RootLayout></MemoryRouter></QueryClientProvider>);

    expect(screen.getByText('المزيد')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'التنقل السريع' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'النتائج' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'النتائج' })[0]).toHaveAttribute('href', '/dashboard/reports');
    expect(screen.getAllByRole('link', { name: 'النتائج' }).every((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
    await waitFor(() => expect(tenantsApi.listMine).toHaveBeenCalled());
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    view.unmount();
    clearSession();
  });
});
