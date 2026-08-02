import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RequireAuth } from './require-auth';
import { establishSession, clearSession } from '../../lib/auth/session';

function renderGuard(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/auth/login" element={<div>صفحة تسجيل الدخول</div>} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<div>لوحة التحكم</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  it('يوجه الزائر غير المصادق إلى /auth/login مع from', () => {
    clearSession();
    renderGuard('/dashboard');
    expect(screen.getByText('صفحة تسجيل الدخول')).toBeInTheDocument();
  });

  it('يعرض المحتوى للمستخدم المصادق', () => {
    establishSession({
      accessToken: 'tok',
      accessTokenExpiresAtMs: Date.now() + 60_000,
      user: { id: 'u1', email: 'x@example.test', fullName: 'X', emailConfirmed: true },
      activeWorkspace: null,
    });
    renderGuard('/dashboard');
    expect(screen.getByText('لوحة التحكم')).toBeInTheDocument();
    clearSession();
  });
});
