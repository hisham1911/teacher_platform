import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RequireAuth } from './require-auth';
import { establishSession, clearSession, __unsafeResetSessionForTests } from '../../lib/auth/session';

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
  it('يوجه الزائر anonymous بعد محاولة استعادة الجلسة إلى /auth/login مع from', () => {
    __unsafeResetSessionForTests();
    // status=anonymous فقط بعد انتهاء bootstrap الفاشل
    clearSession();
    renderGuard('/dashboard');
    expect(screen.getByText('صفحة تسجيل الدخول')).toBeInTheDocument();
  });

  it('لا يحوّل أثناء initializing — ينتظر نتيجة Refresh/bootstrap', () => {
    __unsafeResetSessionForTests(); // status = 'initializing'
    renderGuard('/dashboard');
    // أثناء التهيئة: لا Dashboard ولا Login — فقط Loading
    expect(screen.queryByText('لوحة التحكم')).not.toBeInTheDocument();
    expect(screen.queryByText('صفحة تسجيل الدخول')).not.toBeInTheDocument();
    __unsafeResetSessionForTests();
    clearSession();
  });

  it('يعرض المحتوى للمستخدم المصادق', () => {
    establishSession({
      accessToken: 'tok',
      accessTokenExpiresAtMs: Date.now() + 60_000,
      user: { id: 'u1', email: 'x@example.test', fullName: 'X', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: null,
    });
    renderGuard('/dashboard');
    expect(screen.getByText('لوحة التحكم')).toBeInTheDocument();
    clearSession();
  });
});
