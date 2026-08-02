import { HttpError } from './http-error';
import type {
  AuthUser,
  MessageResponse,
  SessionResponse,
  TenantDetail,
  TenantSettings,
} from '../../types/auth';
import {
  clearSession,
  establishSession,
  getActiveTenantId,
  getSessionSnapshot,
  singleFlightRefresh,
  type SessionSnapshot,
} from '../../lib/auth/session';

/**
 * نقطة الوصول الوحيدة للـAPI لمصادقة Workspace.
 * Access Token يأتي من session.ts (الذاكرة). Refresh Token يعيش في HttpOnly Cookie —
 * لا يقرأه JavaScript، يُرسل تلقائيًا لأن fetch يستخدم credentials:'include' هنا.
 */

function authHeader(): Record<string, string> {
  const { accessToken } = getSessionSnapshot();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

function tenantHeader(): Record<string, string> {
  const tenantId = getActiveTenantId();
  return tenantId ? { 'X-Tenant-Id': tenantId } : {};
}

function resolveBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not set. الاتصال بالـAPI غير ممكن بدونها.');
  }
  return baseUrl.replace(/\/+$/, '');
}

interface CallOptions {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: unknown;
  signal?: AbortSignal;
  /** طلبات المصادقة (login/refresh) لا تحتاج Authorization header ولا Tenant */
  needsAuth?: boolean;
  needsTenant?: boolean;
  /** علامة داخلية لمنع Infinite Loop: لا نعيد الطلب إذا كان هذا هو الطلب المعاد بعد Refresh */
  retriedAfterRefresh?: boolean;
}

/** ينفّذ الطلب ويعيد النافذة المنظمة. عند 401 يحاول Refresh مرة واحدة ثم يعيد الطلب مرة واحدة فقط. */
async function call<T>(options: CallOptions): Promise<T> {
  const {
    method,
    path,
    body,
    signal,
    needsAuth = false,
    needsTenant = false,
    retriedAfterRefresh = false,
  } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(needsAuth ? authHeader() : {}),
    ...(needsTenant ? tenantHeader() : {}),
  };

  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    method,
    credentials: 'include',
    signal,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && needsAuth && !retriedAfterRefresh) {
    // 401 — جرّب Refresh مرة واحدة ثم أعد الطلب الأصلي مرة واحدة فقط
    try {
      await performSingleFlightRefresh(signal);
    } catch {
      // فشل Refresh → امسح الجلسة وأعد رمي 401
      throw new HttpError(401, null);
    }
    return call<T>({ ...options, retriedAfterRefresh: true });
  }

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    throw new HttpError(response.status, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function performSingleFlightRefresh(signal?: AbortSignal): Promise<SessionSnapshot> {
  return singleFlightRefresh(async () => {
    const response = await fetch(`${resolveBaseUrl()}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new HttpError(response.status, null);
    }

    const data = (await response.json()) as SessionResponse;
    return {
      status: 'authenticated',
      accessToken: data.accessToken,
      accessTokenExpiresAtMs: Date.parse(data.accessTokenExpiresAt),
      user: data.user,
      activeWorkspace: data.activeWorkspace,
    };
  });
}

// ---------- Auth endpoints ----------

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ConfirmEmailPayload {
  uid: string;
  token: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  uid: string;
  token: string;
  newPassword: string;
}

export const authApi = {
  register(payload: RegisterPayload, signal?: AbortSignal) {
    return call<MessageResponse>({ method: 'POST', path: '/api/v1/auth/register', body: payload, signal });
  },
  confirmEmail(payload: ConfirmEmailPayload, signal?: AbortSignal) {
    return call<MessageResponse>({ method: 'POST', path: '/api/v1/auth/confirm-email', body: payload, signal });
  },
  async login(payload: LoginPayload, signal?: AbortSignal) {
    const data = await call<SessionResponse>({
      method: 'POST',
      path: '/api/v1/auth/login',
      body: payload,
      signal,
    });
    establishSession({
      accessToken: data.accessToken,
      accessTokenExpiresAtMs: Date.parse(data.accessTokenExpiresAt),
      user: data.user,
      activeWorkspace: data.activeWorkspace,
    });
    return data;
  },
  async logout(signal?: AbortSignal) {
    try {
      await call<MessageResponse>({ method: 'POST', path: '/api/v1/auth/logout', signal });
    } finally {
      clearSession();
    }
  },
  forgotPassword(payload: ForgotPasswordPayload, signal?: AbortSignal) {
    return call<MessageResponse>({
      method: 'POST',
      path: '/api/v1/auth/forgot-password',
      body: payload,
      signal,
    });
  },
  resetPassword(payload: ResetPasswordPayload, signal?: AbortSignal) {
    return call<MessageResponse>({
      method: 'POST',
      path: '/api/v1/auth/reset-password',
      body: payload,
      signal,
    });
  },
  /** يستدعي /api/v1/auth/me — يعيد access token جديد non-empty عند عدم وجود Refresh Cookie */
  me(signal?: AbortSignal) {
    return call<SessionResponse>({ method: 'GET', path: '/api/v1/auth/me', signal, needsAuth: true });
  },
};

// ---------- Tenants endpoints ----------

export interface CreateWorkspacePayload {
  name: string;
  slug: string;
  countryCode: string;
  timezone: string;
  defaultLocale: string;
}

export interface UpdateWorkspacePayload {
  name: string;
  slug: string;
}

export interface UpdateSettingsPayload {
  publicTeacherName?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export const tenantsApi = {
  listMine(signal?: AbortSignal) {
    return call<TenantDetail[]>({ method: 'GET', path: '/api/v1/tenants/mine', signal, needsAuth: true });
  },
  create(payload: CreateWorkspacePayload, signal?: AbortSignal) {
    return call<TenantDetail>({ method: 'POST', path: '/api/v1/tenants', body: payload, signal, needsAuth: true });
  },
  getSettings(tenantId: string, signal?: AbortSignal) {
    return call<TenantSettings>({
      method: 'GET',
      path: `/api/v1/tenants/${tenantId}/settings`,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
  updateSettings(tenantId: string, payload: UpdateSettingsPayload, signal?: AbortSignal) {
    return call<TenantSettings>({
      method: 'PATCH',
      path: `/api/v1/tenants/${tenantId}/settings`,
      body: payload,
      signal,
      needsAuth: true,
      needsTenant: true,
    });
  },
};

/** Boot-after-Reload: يستدعي Refresh مرة واحدة (single-flight) ثم يجلب /auth/me */
export async function bootstrapSession(): Promise<AuthUser | null> {
  try {
    await performSingleFlightRefresh();
  } catch {
    return null;
  }

  try {
    const meData = await authApi.me();
    // لا نفقد accessToken الجديد الذي أعاده الـRefresh
    const current = getSessionSnapshot();
    establishSession({
      accessToken: current.accessToken,
      accessTokenExpiresAtMs: current.accessTokenExpiresAtMs,
      user: meData.user,
      activeWorkspace: meData.activeWorkspace,
    });
    return meData.user;
  } catch {
    return null;
  }
}
