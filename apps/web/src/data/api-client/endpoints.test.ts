import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../data/api-client/http-error';

const BASE_URL = 'http://localhost:5000';

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', BASE_URL);
  window.localStorage.clear();
  // Reset session state between tests via public surface
});

describe('authApi (single-flight refresh)', () => {
  it('401 on data request triggers a single refresh even when concurrent requests fail together', async () => {
    const { authApi, tenantsApi } = await import('../../data/api-client/endpoints');

    let refreshCount = 0;
    const mePayload = {
      accessToken: 'new-access-token',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      user: { id: 'u1', email: 'x@example.test', fullName: 'X', emailConfirmed: true },
      activeWorkspace: null,
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshCount++;
        return new Response(JSON.stringify(mePayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // كل طلبات البيانات ترجع 401 بدون Authorization و200 معه
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const hasAuth = Boolean(headers.Authorization);
      if (url.includes('/api/v1/tenants/mine') || url.includes('/api/v1/auth/me')) {
        if (!hasAuth) {
          return new Response('{}', { status: 401 });
        }
        return new Response(JSON.stringify(url.includes('mine') ? [] : mePayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    // محاكاة ثلاثة طلبات متزامنة فاشلة بعد انتهاء الجلسة — تتشارك طلب Refresh واحدًا
    const results = await Promise.all([
      tenantsApi.listMine(),
      tenantsApi.listMine(),
      authApi.me(),
    ]);

    expect(results).toHaveLength(3);
    // Refresh حدث مرةً واحدة فقط رغم ثلاثة طلبات متزامنة
    expect(refreshCount).toBe(1);
  });

  it('failed refresh clears the session and does not loop', async () => {
    const { authApi } = await import('../../data/api-client/endpoints');
    const sessionModule = await import('../../lib/auth/session');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.endsWith('/api/v1/auth/refresh')) {
        return new Response('{}', { status: 401 });
      }
      return new Response('{}', { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(authApi.me()).rejects.toBeInstanceOf(HttpError);

    const snapshot = sessionModule.getSessionSnapshot();
    expect(snapshot.accessToken).toBeNull();
    expect(snapshot.user).toBeNull();
  });

  it('access token is never written to Web Storage after login refresh cycle', async () => {
    const { authApi } = await import('../../data/api-client/endpoints');
    const sessionModule = await import('../../lib/auth/session');

    const payload = {
      accessToken: 'access-token-secret-123',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      user: { id: 'u1', email: 'x@example.test', fullName: 'X', emailConfirmed: true },
      activeWorkspace: null,
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.endsWith('/api/v1/auth/login') || url.endsWith('/api/v1/auth/refresh')) {
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await authApi.login({ email: 'x@example.test', password: 'Secret123!' });

    const snapshot = sessionModule.getSessionSnapshot();
    expect(snapshot.accessToken).toBe('access-token-secret-123');

    // ممنوع كتابة Access Token في LocalStorage/SessionStorage
    expect(window.localStorage.getItem('accessToken')).toBeNull();
    expect(window.sessionStorage.getItem('accessToken')).toBeNull();
    const allKeys = Object.keys(window.localStorage);
    for (const key of allKeys) {
      expect(window.localStorage.getItem(key)).not.toContain('access-token-secret-123');
    }
  });
});

describe('session local persistence', () => {
  it('persists only non-secret activeTenantId to localStorage', async () => {
    const sessionModule = await import('../../lib/auth/session');

    sessionModule.establishSession({
      accessToken: 'tok-abc',
      accessTokenExpiresAtMs: Date.now() + 1000,
      user: { id: 'u1', email: 'x@example.test', fullName: 'X', emailConfirmed: true },
      activeWorkspace: { id: 'ws-1', name: 'WS', slug: 'ws', role: 'Owner', status: 'Active' },
    });

    expect(window.localStorage.getItem('teacher-platform:active-tenant-id')).toBe('ws-1');
    expect(window.localStorage.getItem('tok-abc')).toBeNull();

    sessionModule.clearSession();
    expect(window.localStorage.getItem('teacher-platform:active-tenant-id')).toBeNull();
  });
});
