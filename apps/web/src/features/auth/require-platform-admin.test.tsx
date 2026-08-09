import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { establishSession, __unsafeResetSessionForTests } from '../../lib/auth/session';
import { RequirePlatformAdmin } from './require-platform-admin';

function renderGuard(roles: string[]) {
  establishSession({
    accessToken: 'token',
    accessTokenExpiresAtMs: Date.now() + 60_000,
    user: {
      id: 'user-1', email: 'admin@example.test', fullName: 'Admin',
      emailConfirmed: true, platformRoles: roles,
    },
    activeWorkspace: null,
  });
  return render(
    <MemoryRouter initialEntries={['/platform']}>
      <Routes>
        <Route path="/dashboard" element={<p>لوحة التحكم</p>} />
        <Route element={<RequirePlatformAdmin />}>
          <Route path="/platform" element={<p>إدارة المنصة</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequirePlatformAdmin', () => {
  afterEach(() => {
    cleanup();
    __unsafeResetSessionForTests();
  });

  it('allows the global PlatformAdmin role', () => {
    renderGuard(['PlatformAdmin']);
    expect(screen.getByText('إدارة المنصة')).toBeInTheDocument();
  });

  it('redirects a tenant-only user', () => {
    renderGuard([]);
    expect(screen.getByText('لوحة التحكم')).toBeInTheDocument();
  });
});
