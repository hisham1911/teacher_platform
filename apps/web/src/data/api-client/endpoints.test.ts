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
      user: { id: 'u1', email: 'x@example.test', fullName: 'X', emailConfirmed: true, platformRoles: [] },
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
      user: { id: 'u1', email: 'x@example.test', fullName: 'X', emailConfirmed: true, platformRoles: [] },
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

describe('bootstrapSession (Phase 1 — refresh persistence)', () => {
  it('تزامن استدعائين للـ bootstrap يجب أن ينتج طلب Refresh HTTP واحدًا فقط', async () => {
    const { bootstrapSession } = await import('../../data/api-client/endpoints');

    let refreshCount = 0;
    let meCount = 0;
    const sessionPayload = {
      accessToken: 'boot-token',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      user: { id: 'u1', email: 'x@example.test', fullName: 'X', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: null,
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshCount++;
        await new Promise((r) => setTimeout(r, 20)); // محاكاة تأخر حقيقي
        return new Response(JSON.stringify(sessionPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/api/v1/auth/me')) {
        meCount++;
        return new Response(JSON.stringify({ ...sessionPayload, accessToken: '' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([bootstrapSession(), bootstrapSession()]);

    expect(refreshCount).toBe(1); // single-flight بوابة واحدة من session.ts
    expect(meCount).toBeGreaterThanOrEqual(1);
    expect(a?.id).toBe('u1');
    expect(b?.id).toBe('u1');
  });

  it('نجاح Refresh يجعل الجلسة authenticated ويفيّد /auth/me', async () => {
    const { bootstrapSession } = await import('../../data/api-client/endpoints');
    const sessionModule = await import('../../lib/auth/session');

    const payload = {
      accessToken: 'rotated-token',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      user: { id: 'u2', email: 'u2@example.test', fullName: 'U2', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: { id: 'ws-9', name: 'W', slug: 'w', role: 'Owner', status: 'Active' },
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    const user = await bootstrapSession();
    expect(user?.id).toBe('u2');
    const snap = sessionModule.getSessionSnapshot();
    expect(snap.status).toBe('authenticated');
    expect(snap.accessToken).toBe('rotated-token');
  });

  it('فشل Refresh فقط يحوّل الحالة إلى anonymous', async () => {
    const { bootstrapSession } = await import('../../data/api-client/endpoints');
    const sessionModule = await import('../../lib/auth/session');

    sessionModule.__unsafeResetSessionForTests();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));

    const result = await bootstrapSession();
    expect(result).toBeNull();
    expect(sessionModule.getSessionSnapshot().status).toBe('anonymous');
  });

  it('لا يكتب Access Token أبدًا إلى Web Storage أثناء Bootstrap', async () => {
    const { bootstrapSession } = await import('../../data/api-client/endpoints');
    const secretToken = 'must-never-persist-token';

    const payload = {
      accessToken: secretToken,
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      user: { id: 'u3', email: 'u3@example.test', fullName: 'U3', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: null,
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    await bootstrapSession();

    for (const key of Object.keys(window.localStorage)) {
      expect(window.localStorage.getItem(key) ?? '').not.toContain(secretToken);
    }
    for (const key of Object.keys(window.sessionStorage)) {
      expect(window.sessionStorage.getItem(key) ?? '').not.toContain(secretToken);
    }
  });
});

describe('session local persistence', () => {
  it('persists only non-secret activeTenantId to localStorage', async () => {
    const sessionModule = await import('../../lib/auth/session');

    sessionModule.establishSession({
      accessToken: 'tok-abc',
      accessTokenExpiresAtMs: Date.now() + 1000,
      user: { id: 'u1', email: 'x@example.test', fullName: 'X', emailConfirmed: true, platformRoles: [] },
      activeWorkspace: { id: 'ws-1', name: 'WS', slug: 'ws', role: 'Owner', status: 'Active' },
    });

    expect(window.localStorage.getItem('teacher-platform:active-tenant-id')).toBe('ws-1');
    expect(window.localStorage.getItem('tok-abc')).toBeNull();

    sessionModule.clearSession();
    expect(window.localStorage.getItem('teacher-platform:active-tenant-id')).toBeNull();
  });
});
