import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { clearSession, establishSession } from '../../lib/auth/session';
import { RequireTenant } from './require-tenant';

afterEach(() => clearSession());

describe('RequireTenant', () => {
  it('يرسل المستخدم إلى اختيار المساحة قبل فتح صفحات لوحة التحكم', async () => {
    establishSession({
      accessToken: 'token',
      accessTokenExpiresAtMs: Date.now() + 10_000,
      user: { id: 'u1', email: 'teacher@example.test', fullName: 'معلمة', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: null,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<RequireTenant />}><Route path="/dashboard" element={<p>لوحة التحكم</p>} /></Route>
          <Route path="/onboarding/choose" element={<p>اختيار مساحة العمل</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('اختيار مساحة العمل')).toBeInTheDocument();
    expect(screen.queryByText('لوحة التحكم')).not.toBeInTheDocument();
  });
});
