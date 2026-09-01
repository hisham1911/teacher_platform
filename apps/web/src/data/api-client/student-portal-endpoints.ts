import type { JoinSessionResponse } from '../../types/sessions';
import type {
  StudentPortalAccessCode,
  StudentPortalAccessStatus,
  StudentPortalHome,
  StudentPortalProfile,
} from '../../types/student-portal';
import { getActiveTenantId, getSessionSnapshot } from '../../lib/auth/session';
import { authApi, resolveBaseUrl } from './endpoints';
import { HttpError } from './http-error';

interface PortalRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

async function portalRequest<T>(path: string, options: PortalRequestOptions = {}): Promise<T> {
  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    signal: options.signal,
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    throw new HttpError(response.status, errorBody);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function teacherPortalRequest<T>(
  tenantId: string,
  path: string,
  options: PortalRequestOptions = {},
  retriedAfterRefresh = false,
): Promise<T> {
  const session = getSessionSnapshot();
  const activeTenantId = getActiveTenantId();
  if (!session.accessToken || activeTenantId !== tenantId) {
    throw new HttpError(401, null);
  }

  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    signal: options.signal,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
      'X-Tenant-Id': tenantId,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && !retriedAfterRefresh) {
    await authApi.me(options.signal);
    return teacherPortalRequest<T>(tenantId, path, options, true);
  }

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    throw new HttpError(response.status, errorBody);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const studentPortalApi = {
  login(accessCode: string, signal?: AbortSignal) {
    return portalRequest<StudentPortalProfile>('/api/v1/student-portal/login', {
      method: 'POST',
      body: { accessCode },
      signal,
    });
  },
  me(signal?: AbortSignal) {
    return portalRequest<StudentPortalProfile>('/api/v1/student-portal/me', { signal });
  },
  home(signal?: AbortSignal) {
    return portalRequest<StudentPortalHome>('/api/v1/student-portal/home', { signal });
  },
  logout(signal?: AbortSignal) {
    return portalRequest<void>('/api/v1/student-portal/logout', { method: 'POST', signal });
  },
  joinActivity(joinCode: string, signal?: AbortSignal) {
    return portalRequest<JoinSessionResponse>(
      `/api/v1/player/sessions/${encodeURIComponent(joinCode)}/portal-join`,
      { method: 'POST', signal },
    );
  },
};

export const teacherStudentPortalApi = {
  getAccessStatus(tenantId: string, studentId: string, signal?: AbortSignal) {
    return teacherPortalRequest<StudentPortalAccessStatus>(
      tenantId,
      `/api/v1/tenants/${tenantId}/students/${studentId}/portal-access`,
      { signal },
    );
  },
  rotateAccessCode(tenantId: string, studentId: string, signal?: AbortSignal) {
    return teacherPortalRequest<StudentPortalAccessCode>(
      tenantId,
      `/api/v1/tenants/${tenantId}/students/${studentId}/portal-access`,
      { method: 'POST', signal },
    );
  },
  revokeAccess(tenantId: string, studentId: string, signal?: AbortSignal) {
    return teacherPortalRequest<void>(
      tenantId,
      `/api/v1/tenants/${tenantId}/students/${studentId}/portal-access`,
      { method: 'DELETE', signal },
    );
  },
};
