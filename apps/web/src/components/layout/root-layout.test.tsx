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
  it('يعرض روابط التنقل العامة للزائر', () => {
    clearSession();
    const view = renderLayout('/');
    expect(screen.getByRole('link', { name: /تسجيل الدخول/ })).toBeInTheDocument();
    view.unmount();
  });

  it('يعرض بوابة الطالب بلا أي تنقل أو دخول خاص بالمعلم', () => {
    clearSession();
    const view = renderLayout('/join');
    expect(screen.getByText('محتوى')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /تسجيل الدخول/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'التنقل الرئيسي' })).not.toBeInTheDocument();
    view.unmount();
  });

  it('يعرض Player بلا تنقل Studio', () => {
    clearSession();
    const view = renderLayout('/play/ABC123');
    expect(screen.queryByText('English Spark Studio')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'التنقل السريع' })).not.toBeInTheDocument();
    view.unmount();
  });

  it('يعرض Live Host في وضع تركيز بلا تنقل Studio', () => {
    establishSession({
      accessToken: 'token', accessTokenExpiresAtMs: Date.now() + 10_000,
      user: { id: 'u1', email: 'creator@example.test', fullName: 'صانع محتوى', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: { id: 'tenant-1', name: 'مساحتي', slug: 'workspace', role: 'Owner', status: 'Active' },
    });
    const view = renderLayout('/dashboard/sessions/session-1/live');
    expect(screen.queryByText('English Spark Studio')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'التنقل السريع' })).not.toBeInTheDocument();
    view.unmount();
    clearSession();
  });

  it('لا يعرض إدارة الحسابات لحساب المعلم العادي', async () => {
    establishSession({
      accessToken: 'token', accessTokenExpiresAtMs: Date.now() + 10_000,
      user: { id: 'u1', email: 'creator@example.test', fullName: 'صانع محتوى', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: { id: 'tenant-1', name: 'مساحتي', slug: 'workspace', role: 'Owner', status: 'Active' },
    });
    const view = renderLayout('/dashboard');
    expect(screen.queryByRole('link', { name: /إدارة الحسابات/ })).not.toBeInTheDocument();
    await waitFor(() => expect(tenantsApi.listMine).toHaveBeenCalled());
    view.unmount();
    clearSession();
  });

  it('يعرض إدارة الحسابات بوضوح لمن يحمل PlatformAdmin', async () => {
    establishSession({
      accessToken: 'token', accessTokenExpiresAtMs: Date.now() + 10_000,
      user: { id: 'admin', email: 'admin@example.test', fullName: 'مدير المنصة', emailConfirmed: true, platformRoles: ['PlatformAdmin'] },
      activeWorkspace: { id: 'tenant-1', name: 'مساحتي', slug: 'workspace', role: 'Owner', status: 'Active' },
    });
    const view = renderLayout('/dashboard');
    expect(screen.getAllByRole('link', { name: /إدارة الحسابات/ }).length).toBeGreaterThan(0);
    await waitFor(() => expect(tenantsApi.listMine).toHaveBeenCalled());
    view.unmount();
    clearSession();
  });

  it('يعرض النتائج كقسم نشط ويضع الطلاب في التنقل السريع للمستخدم المسجل', async () => {
    establishSession({
      accessToken: 'token', accessTokenExpiresAtMs: Date.now() + 10_000,
      user: { id: 'u1', email: 'creator@example.test', fullName: 'صانع محتوى', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: { id: 'tenant-1', name: 'مساحتي', slug: 'workspace', role: 'Owner', status: 'Active' },
    });
    const view = renderLayout('/dashboard/attempts/attempt-1');
    expect(screen.getByText('المزيد')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'التنقل السريع' })).toBeInTheDocument();
    const resultLinks = screen.getAllByRole('link', { name: 'النتائج' });
    expect(resultLinks).toHaveLength(2);
    expect(resultLinks[0]).toHaveAttribute('href', '/dashboard/reports');
    expect(resultLinks.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
    expect(screen.getAllByRole('link', { name: 'الطلاب' }).length).toBeGreaterThan(1);
    await waitFor(() => expect(tenantsApi.listMine).toHaveBeenCalled());
    view.unmount();
    clearSession();
  });
});