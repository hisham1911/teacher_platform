import type { TenantSettings } from '../../types/auth';
import { getActiveTenantId, getSessionSnapshot } from '../../lib/auth/session';
import type {
  ActivateSubscriptionRequest,
  CommercialPackageCatalogItem,
  CommercialWorkspaceState,
  CreatePlanRequest,
  PlatformAuditLog,
  PlatformTenant,
  PlatformUser,
  SaasPlan,
  SaasSubscription,
  TenantUsage,
  UpdatePlanRequest,
} from '../../types/saas';
import { authApi, resolveBaseUrl } from './endpoints';
import { HttpError } from './http-error';

interface CommercialRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  body?: unknown;
  signal?: AbortSignal;
  tenantId?: string;
}

export interface ControlledBrandingUpdate {
  publicTeacherName?: string | null;
  brandDisplayName?: string | null;
  studentPortalWelcomeText?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  supportContact?: string | null;
}

async function commercialRequest<T>(
  path: string,
  options: CommercialRequestOptions = {},
  retriedAfterRefresh = false,
): Promise<T> {
  const session = getSessionSnapshot();
  if (!session.accessToken) {
    throw new HttpError(401, null);
  }

  if (options.tenantId && getActiveTenantId() !== options.tenantId) {
    throw new HttpError(403, {
      title: 'TenantContextMismatch',
      detail: 'Active workspace does not match the requested workspace.',
    });
  }

  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    signal: options.signal,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
      ...(options.tenantId ? { 'X-Tenant-Id': options.tenantId } : {}),
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && !retriedAfterRefresh) {
    await authApi.me(options.signal);
    return commercialRequest<T>(path, options, true);
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

export const commercialWorkspaceApi = {
  get(tenantId: string, signal?: AbortSignal) {
    return commercialRequest<CommercialWorkspaceState>(
      `/api/v1/tenants/${tenantId}/commercial`,
      { tenantId, signal },
    );
  },
  updateBranding(tenantId: string, payload: ControlledBrandingUpdate, signal?: AbortSignal) {
    return commercialRequest<TenantSettings>(`/api/v1/tenants/${tenantId}/settings`, {
      method: 'PATCH',
      tenantId,
      body: payload,
      signal,
    });
  },
};

export const commercialPlatformApi = {
  listPackages(signal?: AbortSignal) {
    return commercialRequest<CommercialPackageCatalogItem[]>('/api/v1/platform/packages', { signal });
  },
  listPlans(signal?: AbortSignal) {
    return commercialRequest<SaasPlan[]>('/api/v1/platform/plans', { signal });
  },
  createPlan(payload: CreatePlanRequest, signal?: AbortSignal) {
    return commercialRequest<SaasPlan>('/api/v1/platform/plans', {
      method: 'POST',
      body: payload,
      signal,
    });
  },
  updatePlan(planId: string, payload: UpdatePlanRequest, signal?: AbortSignal) {
    return commercialRequest<SaasPlan>(`/api/v1/platform/plans/${planId}`, {
      method: 'PUT',
      body: payload,
      signal,
    });
  },
  listTenants(signal?: AbortSignal) {
    return commercialRequest<PlatformTenant[]>('/api/v1/platform/tenants', { signal });
  },
  setTenantStatus(tenantId: string, suspended: boolean, reason?: string, signal?: AbortSignal) {
    return commercialRequest<{ suspended: boolean }>(`/api/v1/platform/tenants/${tenantId}/status`, {
      method: 'PUT',
      body: { suspended, reason: reason || null },
      signal,
    });
  },
  listUsers(signal?: AbortSignal) {
    return commercialRequest<PlatformUser[]>('/api/v1/platform/users', { signal });
  },
  setUserStatus(userId: string, suspended: boolean, signal?: AbortSignal) {
    return commercialRequest<{ suspended: boolean }>(`/api/v1/platform/users/${userId}/status`, {
      method: 'PUT',
      body: { suspended },
      signal,
    });
  },
  activateSubscription(
    tenantId: string,
    payload: ActivateSubscriptionRequest,
    signal?: AbortSignal,
  ) {
    return commercialRequest<SaasSubscription>(
      `/api/v1/platform/tenants/${tenantId}/subscriptions/activate`,
      { method: 'POST', body: payload, signal },
    );
  },
  getUsage(tenantId: string, signal?: AbortSignal) {
    return commercialRequest<TenantUsage>(`/api/v1/platform/tenants/${tenantId}/usage`, { signal });
  },
  listAudit(tenantId?: string | null, signal?: AbortSignal) {
    const params = new URLSearchParams({ take: '100' });
    if (tenantId) params.set('tenantId', tenantId);
    return commercialRequest<PlatformAuditLog[]>(`/api/v1/platform/audit?${params.toString()}`, { signal });
  },
};
