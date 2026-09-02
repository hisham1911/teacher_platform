import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSession, establishSession } from '../../lib/auth/session';
import { tenantTransferApi } from '../../data/api-client/endpoints';
import { commercialWorkspaceApi } from '../../data/api-client/commercial-endpoints';
import SettingsPage from './settings-page';

vi.mock('../../data/api-client/endpoints', () => ({
  tenantsApi: {
    getSettings: vi.fn().mockResolvedValue({
      publicTeacherName: 'Teacher',
      brandDisplayName: 'Maryam Academy',
      studentPortalWelcomeText: '',
      supportContact: '',
      primaryColor: '#0ea5e9',
      secondaryColor: '#f59e0b',
    }),
    updateSettings: vi.fn().mockResolvedValue({}),
  },
  tenantTransferApi: {
    exportArchive: vi.fn(),
    importArchive: vi.fn().mockImplementation((_tenantId, _file, dryRun: boolean) => Promise.resolve({
      dryRun,
      sourceTenantId: 'source',
      targetTenantId: 'tenant-1',
      counts: { questions: 2 },
    })),
  },
}));

vi.mock('../../data/api-client/commercial-endpoints', () => ({
  commercialWorkspaceApi: {
    get: vi.fn().mockResolvedValue({
      tenantId: 'tenant-1',
      commercialStatus: 'Grandfathered',
      isGrandfathered: true,
      subscription: null,
      plan: null,
      limits: {
        maxQuizzesPerTenant: 100,
        maxQuestionsPerQuiz: 200,
        maxPublishedQuizzesPerTenant: 50,
        maxAttemptsPerMonth: 10_000,
        maxStorageBytes: 5_368_709_120,
        maxCertificatesPerMonth: 10_000,
        maxStudents: 100_000,
        maxMembers: 10_000,
        maxClasses: 100_000,
        maxActiveAssignments: 100_000,
        maxLiveParticipants: 10_000,
      },
      entitlements: {
        bulkImport: true,
        advancedReports: true,
        certificates: true,
        customBranding: true,
        dataExport: true,
        customDomain: false,
      },
      usage: { members: 1, students: 2, classes: null, activeAssignments: null },
    }),
    updateBranding: vi.fn().mockResolvedValue({}),
  },
}));

function renderPage() {
  establishSession({
    accessToken: 'token',
    accessTokenExpiresAtMs: Date.now() + 60_000,
    user: {
      id: 'user-1',
      email: 'owner@example.test',
      fullName: 'Owner',
      emailConfirmed: true,
      platformRoles: [],
    },
    activeWorkspace: {
      id: 'tenant-1',
      name: 'Workspace',
      slug: 'workspace',
      role: 'Owner',
      status: 'Active',
    },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><SettingsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  clearSession();
  vi.clearAllMocks();
});

describe('SettingsPage commercial workspace', () => {
  it('shows the current commercial capacities without exposing them to the student experience', async () => {
    renderPage();
    expect(await screen.findByDisplayValue('Maryam Academy')).toBeInTheDocument();
    expect(await screen.findByText('حساب حالي محفوظ')).toBeInTheDocument();
    expect(screen.getByText('الطلاب')).toBeInTheDocument();
    expect(screen.getByText(/يُربط بعد مزامنة Classes \+ Assignments/)).toBeInTheDocument();
    expect(commercialWorkspaceApi.get).toHaveBeenCalledWith('tenant-1', expect.any(AbortSignal));
  });

  it('requires a successful dry run before importing the same archive', async () => {
    renderPage();
    await screen.findByDisplayValue('Teacher');
    const archive = new File(['portable'], 'tenant-export.zip', {
      type: 'application/zip',
      lastModified: 123,
    });

    fireEvent.change(screen.getByLabelText('نسخة محتوى مساحة العمل بصيغة ZIP'), {
      target: { files: [archive] },
    });
    const importButton = screen.getByRole('button', { name: 'استيراد المحتوى' });
    expect(importButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'فحص الملف' }));
    await screen.findByText(/الفحص ناجح/);
    expect(tenantTransferApi.importArchive).toHaveBeenCalledWith('tenant-1', archive, true);
    expect(importButton).toBeEnabled();

    fireEvent.click(importButton);
    await waitFor(() => expect(tenantTransferApi.importArchive).toHaveBeenLastCalledWith(
      'tenant-1', archive, false,
    ));
    expect(await screen.findByText(/تم استيراد المحتوى/)).toBeInTheDocument();
  });
});
