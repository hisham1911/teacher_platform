import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { RootLayout } from './root-layout';
import { clearSession, establishSession } from '../../lib/auth/session';

vi.mock('../../data/api-client/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/api-client/endpoints')>();
  return { ...actual, tenantsApi: { ...actual.tenantsApi, listMine: vi.fn().mockResolvedValue([]) } };
});

const { tenantsApi } = await import('../../data/api-client/endpoints');

function renderLayout(path = '/dashboard') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}><RootLayout><div>محتوى</div></RootLayout></MemoryRouter></QueryClientProvider>);
}

describe('RootLayout', () => {
  it('يعرض روابط التنقل المحايدة للزائر', () => {
    clearSession();
    renderLayout('/');
    expect(screen.getByRole('link', { name: 'English Spark' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'الرئيسية' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'تسجيل الدخول' })).toBeInTheDocument();
  });

  it('يعرض Player بلا تنقل Studio', () => {
    clearSession();
    renderLayout('/play/JOIN123');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByText('English Spark — Learn • Play • Explore')).not.toBeInTheDocument();
  });

  it('يعرض Live Host في وضع تركيز بلا تنقل Studio', () => {
    establishSession({
      accessToken: 'token', accessTokenExpiresAtMs: Date.now() + 10_000,
      user: { id: 'u1', email: 'creator@example.test', fullName: 'صانع محتوى', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: { id: 'tenant-1', name: 'مساحتي', slug: 'workspace', role: 'Owner', status: 'Active' },
    });
    const view = renderLayout('/dashboard/sessions/session-1/live');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    view.unmount();
    clearSession();
  });

  it('لا يعرض إدارة المنصة نهائيًا لحساب المعلم العادي', async () => {
    establishSession({
      accessToken: 'token', accessTokenExpiresAtMs: Date.now() + 10_000,
      user: { id: 'u1', email: 'teacher@example.test', fullName: 'مريم', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: { id: 'tenant-1', name: 'English class', slug: 'workspace', role: 'Owner', status: 'Active' },
    });
    const view = renderLayout('/dashboard');
    expect(screen.queryByText(/إدارة المنصة/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /إدارة المنصة/ })).not.toBeInTheDocument();
    await waitFor(() => expect(tenantsApi.listMine).toHaveBeenCalled());
    view.unmount();
    clearSession();
  });

  it('يعرض إدارة المنصة فقط لمن يحمل PlatformAdmin', async () => {
    establishSession({
      accessToken: 'token', accessTokenExpiresAtMs: Date.now() + 10_000,
      user: { id: 'admin', email: 'admin@example.test', fullName: 'مدير المنصة', emailConfirmed: true, platformRoles: ['PlatformAdmin'] },
      activeWorkspace: { id: 'tenant-1', name: 'مساحتي', slug: 'workspace', role: 'Owner', status: 'Active' },
    });
    const view = renderLayout('/dashboard');
    expect(screen.getAllByRole('link', { name: /إدارة المنصة/ }).length).toBeGreaterThan(0);
    await waitFor(() => expect(tenantsApi.listMine).toHaveBeenCalled());
    view.unmount();
    clearSession();
  });

  it('يعرض النتائج والتنقل السريع للمستخدم المسجل', async () => {
    establishSession({
      accessToken: 'token', accessTokenExpiresAtMs: Date.now() + 10_000,
      user: { id: 'u1', email: 'creator@example.test', fullName: 'صانع محتوى', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: { id: 'tenant-1', name: 'مساحتي', slug: 'workspace', role: 'Owner', status: 'Active' },
    });
    const view = renderLayout('/dashboard/attempts/attempt-1');
    expect(screen.getByText('المزيد')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'التنقل السريع' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'النتائج' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'النتائج' })[0]).toHaveAttribute('href', '/dashboard/reports');
    expect(screen.getAllByRole('link', { name: 'النتائج' }).every((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
    await waitFor(() => expect(tenantsApi.listMine).toHaveBeenCalled());
    view.unmount();
    clearSession();
  });
});
