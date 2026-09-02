import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { commercialPlatformApi } from '../../data/api-client/commercial-endpoints';
import PlatformAdminPage from './platform-admin-page';

const { limits, entitlements } = vi.hoisted(() => ({
  limits: {
    maxQuizzesPerTenant: 10,
    maxQuestionsPerQuiz: 20,
    maxPublishedQuizzesPerTenant: 5,
    maxAttemptsPerMonth: 100,
    maxStorageBytes: 1_048_576,
    maxCertificatesPerMonth: 100,
    maxStudents: 150,
    maxMembers: 1,
    maxClasses: 10,
    maxActiveAssignments: 20,
    maxLiveParticipants: 50,
  },
  entitlements: {
    bulkImport: false,
    advancedReports: false,
    certificates: false,
    customBranding: false,
    dataExport: false,
    customDomain: false,
  },
}));

vi.mock('../../data/api-client/commercial-endpoints', () => ({
  commercialPlatformApi: {
    listPackages: vi.fn().mockResolvedValue([
      { package: 'Teacher', displayName: 'Teacher', isAvailable: true, limits, entitlements },
      { package: 'TeacherPro', displayName: 'Teacher Pro', isAvailable: true, limits: { ...limits, maxStudents: 1000 }, entitlements: { ...entitlements, bulkImport: true, advancedReports: true } },
      { package: 'Academy', displayName: 'Academy', isAvailable: true, limits: { ...limits, maxMembers: 50 }, entitlements: { ...entitlements, bulkImport: true } },
      { package: 'School', displayName: 'School (Later)', isAvailable: false, limits, entitlements },
    ]),
    listPlans: vi.fn().mockResolvedValue([
      { id: 'plan-1', code: 'pilot', name: 'Pilot', isActive: true, contractVersion: 2, package: 'Teacher', version: 1, limits, entitlements },
    ]),
    listTenants: vi.fn().mockResolvedValue([
      {
        id: 'tenant-1',
        name: 'Maryam Academy',
        slug: 'maryam',
        status: 'Active',
        createdAt: '2026-08-09T00:00:00Z',
        subscription: null,
        commercialStatus: 'Grandfathered',
        isGrandfathered: true,
        plan: null,
        usage: { members: 1, students: 22, classes: 3, activeAssignments: 4 },
      },
    ]),
    listUsers: vi.fn().mockResolvedValue([
      { id: 'user-1', email: 'maryam@example.test', fullName: 'Maryam', status: 'Active', emailConfirmed: true, lockoutEnd: null, tenantCount: 1, platformRoles: [], createdAt: '2026-08-09T00:00:00Z' },
    ]),
    getUsage: vi.fn().mockResolvedValue({ tenantId: 'tenant-1', periodStart: '2026-08-01T00:00:00Z', periodEnd: '2026-09-01T00:00:00Z', metrics: [] }),
    listAudit: vi.fn().mockResolvedValue([{ id: 'audit-1', tenantId: 'tenant-1', actorUserId: 'user-1', action: 'SubscriptionActivated', entityType: 'Subscription', entityId: 'subscription-1', metadataJson: '{}', requestId: null, createdAt: '2026-08-09T00:00:00Z' }]),
    activateSubscription: vi.fn().mockResolvedValue({}),
    setTenantStatus: vi.fn().mockResolvedValue({ suspended: true }),
    setUserStatus: vi.fn().mockResolvedValue({ suspended: true }),
    createPlan: vi.fn().mockResolvedValue({}),
  },
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><PlatformAdminPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PlatformAdminPage commercial control plane', () => {
  it('shows workspace plan, usage and supports a safe manual plan change', async () => {
    renderPage();
    expect(await screen.findByText('Maryam Academy')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pilot' })).toBeInTheDocument();
    expect(screen.getByText('maryam@example.test')).toBeInTheDocument();
    expect(screen.getAllByText('حساب حالي محفوظ')).toHaveLength(2);
    expect(screen.getByText('22')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('خطة Maryam Academy'), { target: { value: 'plan-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'تغيير الخطة' }));
    await waitFor(() => expect(commercialPlatformApi.activateSubscription).toHaveBeenCalledWith(
      'tenant-1',
      { planId: 'plan-1', endsAt: null, changeReason: null },
    ));
    expect(await screen.findByText('تم تغيير خطة العميل بأمان.')).toBeInTheDocument();
  });

  it('can suspend and reactivate a workspace independently from user status', async () => {
    renderPage();
    expect(await screen.findByText('Maryam Academy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'إيقاف Workspace' }));
    await waitFor(() => expect(commercialPlatformApi.setTenantStatus).toHaveBeenCalledWith(
      'tenant-1',
      true,
      'PlatformAdmin action',
    ));
    expect(await screen.findByText('تم إيقاف مساحة العمل.')).toBeInTheDocument();
  });

  it('allows a platform admin to suspend an account without deleting its data', async () => {
    renderPage();
    expect(await screen.findByText('maryam@example.test')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'إيقاف الحساب' }));
    await waitFor(() => expect(commercialPlatformApi.setUserStatus).toHaveBeenCalledWith('user-1', true));
    expect(await screen.findByText('تم إيقاف الحساب وتسجيل خروجه من الجلسات الطويلة.')).toBeInTheDocument();
  });
});
