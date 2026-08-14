import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSession, establishSession } from '../../lib/auth/session';
import { tenantTransferApi } from '../../data/api-client/endpoints';
import SettingsPage from './settings-page';

vi.mock('../../data/api-client/endpoints', () => ({
  tenantsApi: {
    getSettings: vi.fn().mockResolvedValue({
      publicTeacherName: 'Teacher', primaryColor: '#0ea5e9', secondaryColor: '#f59e0b',
    }),
    updateSettings: vi.fn().mockResolvedValue({}),
  },
  tenantTransferApi: {
    exportArchive: vi.fn(),
    importArchive: vi.fn().mockImplementation((_tenantId, _file, dryRun: boolean) => Promise.resolve({
      dryRun, sourceTenantId: 'source', targetTenantId: 'tenant-1', counts: { questions: 2 },
    })),
  },
}));

function renderPage() {
  establishSession({
    accessToken: 'token',
    accessTokenExpiresAtMs: Date.now() + 60_000,
    user: { id: 'user-1', email: 'owner@example.test', fullName: 'Owner', emailConfirmed: true, platformRoles: [] },
    activeWorkspace: { id: 'tenant-1', name: 'Workspace', slug: 'workspace', role: 'Owner', status: 'Active' },
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

describe('SettingsPage tenant transfer', () => {
  it('requires a successful dry run before importing the same archive', async () => {
    renderPage();
    await screen.findByDisplayValue('Teacher');
    const archive = new File(['portable'], 'tenant-export.zip', {
      type: 'application/zip', lastModified: 123,
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
