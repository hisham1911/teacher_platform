import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import PlatformAdminPage from './platform-admin-page';
import { platformApi } from '../../data/api-client/endpoints';

vi.mock('../../data/api-client/endpoints', () => ({
  platformApi: {
    listPlans: vi.fn().mockResolvedValue([{ id: 'plan-1', code: 'pilot', name: 'Pilot', isActive: true, version: 1, limits: { maxQuizzesPerTenant: 10, maxQuestionsPerQuiz: 20, maxPublishedQuizzesPerTenant: 5, maxAttemptsPerMonth: 100, maxStorageBytes: 1048576, maxCertificatesPerMonth: 100 } }]),
    listTenants: vi.fn().mockResolvedValue([{ id: 'tenant-1', name: 'Maryam Academy', slug: 'maryam', status: 'Active', createdAt: '2026-08-09T00:00:00Z', subscription: null }]),
    listUsers: vi.fn().mockResolvedValue([{ id: 'user-1', email: 'maryam@example.test', fullName: 'Maryam', status: 'Active', emailConfirmed: true, lockoutEnd: null, tenantCount: 1, platformRoles: [], createdAt: '2026-08-09T00:00:00Z' }]),
    getUsage: vi.fn().mockResolvedValue({ tenantId: 'tenant-1', periodStart: '2026-08-01T00:00:00Z', periodEnd: '2026-09-01T00:00:00Z', metrics: [] }),
    listAudit: vi.fn().mockResolvedValue([{ id: 'audit-1', tenantId: 'tenant-1', actorUserId: 'user-1', action: 'SubscriptionActivated', entityType: 'Subscription', entityId: 'subscription-1', metadataJson: '{}', requestId: null, createdAt: '2026-08-09T00:00:00Z' }]),
    activateSubscription: vi.fn().mockResolvedValue({}),
    createPlan: vi.fn().mockResolvedValue({}),
  },
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PlatformAdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PlatformAdminPage', () => {
  it('shows platform records and activates a selected customer plan', async () => {
    renderPage();
    expect(await screen.findByText('Maryam Academy')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pilot' })).toBeInTheDocument();
    expect(screen.getByText('maryam@example.test')).toBeInTheDocument();
    expect(await screen.findByText('SubscriptionActivated')).toBeInTheDocument();
    expect(screen.getByLabelText('أسئلة/نشاط')).toHaveValue(200);
    expect(screen.getByLabelText('التخزين (م.ب)')).toHaveValue(5120);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'plan-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'تفعيل الخطة' }));

    await waitFor(() => expect(platformApi.activateSubscription).toHaveBeenCalledWith('tenant-1', 'plan-1'));
    expect(await screen.findByText('تم تفعيل الاشتراك.')).toBeInTheDocument();
  });
});
